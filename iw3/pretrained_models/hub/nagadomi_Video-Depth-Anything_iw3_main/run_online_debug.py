# Debug script for VideoDepthAnythingOnline
# This makes sure that the results match run.py exactly by offline processing
#
# $ python run.py --encoder vits
# $ python run_online_debug.py --encoder vits
# ./diffvideo.sh outputs/davis_rollercoaster_vis.mp4 outputs/davis_rollercoaster_vis_online_debug.mp4
# > PSNR y:inf u:inf v:inf average:inf min:inf max:inf
import argparse
import numpy as np
import os
import torch
from tqdm import tqdm

from video_depth_anything.video_depth_online import VideoDepthAnythingOnline
from utils.dc_utils import read_video_frames, save_video


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Video Depth Anything')
    parser.add_argument('--input_video', type=str, default='./assets/example_videos/davis_rollercoaster.mp4')
    parser.add_argument('--output_dir', type=str, default='./outputs')
    parser.add_argument('--input_size', type=int, default=518)
    parser.add_argument('--max_res', type=int, default=1280)
    parser.add_argument('--encoder', type=str, default='vitl', choices=['vits', 'vitb', 'vitl'])
    parser.add_argument('--max_len', type=int, default=-1, help='maximum length of the input video, -1 means no limit')
    parser.add_argument('--target_fps', type=int, default=-1, help='target fps of the input video, -1 means the original fps')
    parser.add_argument('--disable-amp', action="store_true", help='disable AMP(float16)')

    args = parser.parse_args()

    DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

    model_configs = {
        'vits': {'encoder': 'vits', 'features': 64, 'out_channels': [48, 96, 192, 384]},
        'vitb': {'encoder': 'vitb', 'features': 128, 'out_channels': [96, 192, 384, 768]},
        'vitl': {'encoder': 'vitl', 'features': 256, 'out_channels': [256, 512, 1024, 1024]},
    }
    video_depth_anything = VideoDepthAnythingOnline(**model_configs[args.encoder])
    video_depth_anything.load_state_dict(torch.load(f'./checkpoints/video_depth_anything_{args.encoder}.pth',
                                                    map_location='cpu'), strict=True)
    video_depth_anything = video_depth_anything.to(DEVICE).eval()

    frames, target_fps = read_video_frames(args.input_video, args.max_len, args.target_fps, args.max_res)
    # sequential input
    frame_len = len(frames)
    input_frame_count = output_frame_count = 0
    frame_width, frame_height = frames[0].shape[1], frames[0].shape[0]
    depths = []
    for frame in tqdm(frames, ncols=80):
        depth_list = video_depth_anything.infer(frame, frame_width, frame_height)
        input_frame_count += 1
        if depth_list is None:
            continue
        for depth in depth_list:
            output_frame_count += 1
            depths.append(depth)

    # flush
    while output_frame_count < input_frame_count:
        depth_list = video_depth_anything.infer(None, frame_width, frame_height)
        if depth_list is None:
            continue
        for depth in depth_list:
            output_frame_count += 1
            depths.append(depth)

    depths = np.stack(depths[:input_frame_count], axis=0)
    video_name = os.path.basename(args.input_video)
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    depth_vis_path = os.path.join(args.output_dir, os.path.splitext(video_name)[0]+'_vis_online_debug.mp4')
    save_video(depths, depth_vis_path, fps=target_fps, is_depths=True)

    max_vram_mb = int(torch.cuda.max_memory_allocated(DEVICE) / (1024 * 1024))
    print(f"GPU Max Memory Allocated {max_vram_mb}MB")

    # ./diffvideo.sh outputs/davis_rollercoaster_vis.mp4 outputs/davis_rollercoaster_vis_online_debug.mp4
    # PSNR = inf
