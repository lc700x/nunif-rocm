# Online method
# This can process 10 hours video with constant memory usage.
#
# I think using EMA for min max normalize is not a good idea,
# but I don't have a good idea to do it.
import argparse
import os
from os import path
import math
from tqdm import tqdm
import av
from av.video.frame import VideoFrame
import torch
from video_depth_anything.video_depth_online import VideoDepthAnythingOnline
import numpy as np
import matplotlib


COLORMAP = np.array(matplotlib.colormaps.get_cmap("inferno").colors)
VIDEO_CONTAINER = "mkv"  # mp4 or mkv


def color_depth(depth, d_min, d_max):
    depth_norm = np.clip(((depth - d_min) / (d_max - d_min) * 255), 0, 255).astype(np.uint8)
    depth_vis = (COLORMAP[depth_norm] * 255).astype(np.uint8)
    return depth_vis


def guess_frames(stream, container_duration=None):
    fps = stream.guessed_rate
    if stream.duration:
        duration = float(stream.duration * stream.time_base)
    else:
        duration = container_duration
    duration = math.ceil(duration)
    if duration is None:
        return -1

    return math.ceil(duration * fps)


class EMAMinMax():
    def __init__(self, alpha=0.75):
        self.min = None
        self.max = None
        self.alpha = alpha

    def update(self, min_value, max_value):
        if self.min is None:
            self.min = float(min_value)
            self.max = float(max_value)
        else:
            self.min = self.alpha * self.min + (1. - self.alpha) * float(min_value)
            self.max = self.alpha * self.max + (1. - self.alpha) * float(max_value)

        return self.min, self.max

    def clear(self):
        self.min = self.max = None


class EMAScaler():
    def __init__(self, alpha=0.75):
        self.ema = EMAMinMax(alpha=alpha)

    def scale(self, depth_list):
        color_depth_list = []
        for depth in depth_list:
            color_depth_list.append(
                color_depth(depth, *self.ema.update(depth.min(), depth.max()))
            )
        return color_depth_list

    def clear(self):
        self.ema.clear()


class InterpolationScaler():
    # Linear interpolation from the previous batch to the current batch
    def __init__(self, alpha=0.75):
        self.ema = EMAMinMax(alpha=alpha)

    def scale(self, depth_list):
        min_value = min(depth.min() for depth in depth_list)
        max_value = min(depth.max() for depth in depth_list)

        prev_min_value = self.ema.min if self.ema.min is not None else min_value
        prev_max_value = self.ema.max if self.ema.max is not None else max_value
        cur_min_value, cur_max_value = self.ema.update(min_value, max_value)

        min_steps = torch.linspace(prev_min_value, cur_min_value, len(depth_list))
        max_steps = torch.linspace(prev_max_value, cur_max_value, len(depth_list))

        color_depth_list = []
        for i, depth in enumerate(depth_list):
            color_depth_list.append(
                color_depth(depth, min_steps[i].item(), max_steps[i].item())
            )
        return color_depth_list

    def clear(self):
        self.ema.clear()


def main():
    parser = argparse.ArgumentParser(description='Video Depth Anything')
    parser.add_argument('--input_video', type=str, default='./assets/example_videos/davis_rollercoaster.mp4')
    parser.add_argument('--output_dir', type=str, default='./outputs')
    parser.add_argument('--input_size', type=int, default=518)
    parser.add_argument('--encoder', type=str, default='vitl', choices=['vits', 'vitb', 'vitl'])
    parser.add_argument('--scaler', type=str, default='ema', choices=["ema", "linear", "ema_linear"])
    parser.add_argument('--ema-alpha', type=float, default=0.75)

    args = parser.parse_args()
    DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
    model_configs = {
        'vits': {'encoder': 'vits', 'features': 64, 'out_channels': [48, 96, 192, 384]},
        'vitb': {'encoder': 'vitb', 'features': 128, 'out_channels': [96, 192, 384, 768]},
        'vitl': {'encoder': 'vitl', 'features': 256, 'out_channels': [256, 512, 1024, 1024]},
    }
    video_depth_anything = VideoDepthAnythingOnline(**model_configs[args.encoder])
    state_dict = torch.load(f'./checkpoints/video_depth_anything_{args.encoder}.pth',
                            map_location='cpu', weights_only=True)
    video_depth_anything.load_state_dict(state_dict, strict=True)
    video_depth_anything = video_depth_anything.to(DEVICE).eval()
    video_name = path.splitext(path.basename(args.input_video))[0]
    os.makedirs(args.output_dir, exist_ok=True)

    input_container = av.open(args.input_video)
    if len(input_container.streams.video) == 0:
        raise ValueError("No video stream")
    input_stream = input_container.streams.video[0]
    input_stream.thread_type = "AUTO"

    if input_container.duration:
        container_duration = float(input_container.duration / av.time_base)
    else:
        container_duration = None
    output_container = av.open(path.join(args.output_dir, f"{video_name}_vis_online.{VIDEO_CONTAINER}"), 'w')
    codec = "libopenh264" if "libopenh264" in av.codec.codecs_available else "libx264"
    output_stream = output_container.add_stream(codec, rate=input_stream.guessed_rate)
    output_stream.thread_type = "AUTO"
    output_stream.pix_fmt = "yuv420p"
    output_stream.width = input_stream.width
    output_stream.height = input_stream.height
    if codec == "libx264":
        output_stream.options = {"preset": "medium", "crf": "20"}
    elif codec == "libopenh264":
        # bitrate
        output_stream.options = {"b": "8M"}
    output_stream.thread_type = "AUTO"

    total = guess_frames(input_stream, container_duration=container_duration) + 32  # Rough value
    pbar = tqdm(desc=video_name, total=total, ncols=80)

    # online sequential frame input
    if args.scaler == "ema":
        scaler = EMAScaler(args.ema_alpha)
    elif args.scaler == "linear":
        scaler = InterpolationScaler(0.0)
    elif args.scaler == "ema_linear":
        scaler = InterpolationScaler(args.ema_alpha)

    input_frame_count = 0
    output_frame_count = 0
    for packet in input_container.demux([input_stream]):
        for frame in packet.decode():
            frame = frame.to_ndarray(format="rgb24")
            depth_list = video_depth_anything.infer(frame, input_stream.width, input_stream.height)
            input_frame_count += 1

            if depth_list is None:
                continue

            color_depth_list = scaler.scale(depth_list)
            for depth in color_depth_list:
                output_frame_count += 1
                enc_packet = output_stream.encode(VideoFrame.from_ndarray(depth))
                if enc_packet:
                    output_container.mux(enc_packet)
                pbar.update(1)

    # flush
    while output_frame_count < input_frame_count:
        depth_list = video_depth_anything.infer(None, input_stream.width, input_stream.height)
        if depth_list is None:
            continue
        color_depth_list = scaler.scale(depth_list)
        for depth in color_depth_list:
            output_frame_count += 1
            enc_packet = output_stream.encode(VideoFrame.from_ndarray(depth))
            if enc_packet:
                output_container.mux(enc_packet)
            pbar.update(1)
            if output_frame_count >= input_frame_count:
                break

    pbar.close()

    packet = output_stream.encode(None)
    if packet:
        output_container.mux(packet)

    input_container.close()
    output_container.close()


if __name__ == "__main__":
    main()
