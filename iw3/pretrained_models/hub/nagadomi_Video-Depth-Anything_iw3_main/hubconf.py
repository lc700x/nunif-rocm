import torch
from os import path


def _load_state_dict(encoder, metric_depth):
    if not metric_depth:
        if encoder == "vits":
            file_name = "video_depth_anything_vits.pth"
            url = f"https://huggingface.co/depth-anything/Video-Depth-Anything-Small/resolve/main/{file_name}?download=true"
            state_dict = torch.hub.load_state_dict_from_url(url, file_name=file_name,
                                                            weights_only=True, map_location=torch.device("cpu"))
            return state_dict
        elif encoder in {"vitb", "vitl"}:
            file_name = f"video_depth_anything_{encoder}.pth"
            checkpoint_path = path.join(torch.hub.get_dir(), "checkpoints", file_name)
            if path.exists(checkpoint_path):
                state_dict = torch.load(checkpoint_path, weights_only=True, map_location=torch.device("cpu"))
                return state_dict
            else:
                raise RuntimeError(f"Please place the checkpoint file yourself.\n{checkpoint_path}")
        else:
            raise ValueError(f"encoder={encoder} is not supported")
    else:
        if encoder == "vits":
            file_name = "metric_video_depth_anything_vits.pth"
            url = f"https://huggingface.co/depth-anything/Metric-Video-Depth-Anything-Small/resolve/main/{file_name}?download=true"
            state_dict = torch.hub.load_state_dict_from_url(url, file_name=file_name,
                                                            weights_only=True, map_location=torch.device("cpu"))
            return state_dict
        elif encoder in {"vitb", "vitl"}:
            file_name = f"metric_video_depth_anything_{encoder}.pth"
            checkpoint_path = path.join(torch.hub.get_dir(), "checkpoints", file_name)
            if path.exists(checkpoint_path):
                state_dict = torch.load(checkpoint_path, weights_only=True, map_location=torch.device("cpu"))
                return state_dict
            else:
                raise RuntimeError(f"Please place the checkpoint file yourself.\n{checkpoint_path}")
        else:
            raise ValueError(f"encoder={encoder} is not supported")


def VideoDepthAnythingOnline(encoder, device="cpu"):
    from video_depth_anything.video_depth_online_torch import VideoDepthAnythingOnline
    assert encoder in {"vitl", "vitb", "vits"}

    model_configs = {
        'vits': {'encoder': 'vits', 'features': 64, 'out_channels': [48, 96, 192, 384]},
        'vitb': {'encoder': 'vitb', 'features': 128, 'out_channels': [96, 192, 384, 768]},
        'vitl': {'encoder': 'vitl', 'features': 256, 'out_channels': [256, 512, 1024, 1024]},
    }
    model = VideoDepthAnythingOnline(device=device, metric_depth=False, **model_configs[encoder])
    model.load_state_dict(_load_state_dict(encoder, metric_depth=False), strict=True)

    return model


def VideoDepthAnythingStreaming(encoder, device="cpu", metric_depth=False):
    from video_depth_anything.video_depth_stream_torch import VideoDepthAnythingStreamingTorch
    assert encoder in {"vitl", "vitb", "vits"}

    model_configs = {
        'vits': {'encoder': 'vits', 'features': 64, 'out_channels': [48, 96, 192, 384]},
        'vitb': {'encoder': 'vitb', 'features': 128, 'out_channels': [96, 192, 384, 768]},
        'vitl': {'encoder': 'vitl', 'features': 256, 'out_channels': [256, 512, 1024, 1024]},
    }
    model = VideoDepthAnythingStreamingTorch(device=device, **model_configs[encoder])
    model.load_state_dict(_load_state_dict(encoder, metric_depth=metric_depth), strict=True)

    return model


def MetricVideoDepthAnythingOnline(encoder, device="cpu"):
    from video_depth_anything.video_depth_online_torch import VideoDepthAnythingOnline
    assert encoder in {"vitl", "vitb", "vits"}
    model_configs = {
        'vits': {'encoder': 'vits', 'features': 64, 'out_channels': [48, 96, 192, 384]},
        'vitb': {'encoder': 'vitb', 'features': 128, 'out_channels': [96, 192, 384, 768]},
        'vitl': {'encoder': 'vitl', 'features': 256, 'out_channels': [256, 512, 1024, 1024]},
    }
    model = VideoDepthAnythingOnline(device=device, metric_depth=True, **model_configs[encoder])
    model.load_state_dict(_load_state_dict(encoder, metric_depth=True), strict=True)

    return model


def _test():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--encoder", type=str, default="vitl", choices=["vits", "vitb", "vitl"])
    parser.add_argument("--metric", action="store_true")
    parser.add_argument("--remote", action="store_true", help="use remote repo")
    parser.add_argument("--reload", action="store_true", help="reload remote repo")
    args = parser.parse_args()

    if args.metric:
        model_name = "MetricVideoDepthAnythingOnline"
        model_kwargs = {"encoder": args.encoder}
    else:
        model_name = "VideoDepthAnythingOnline"
        model_kwargs = {"encoder": args.encoder}

    if not args.remote:
        model = torch.hub.load(".", model_name, **model_kwargs,
                               source="local", trust_repo=True).cuda()
    else:
        force_reload = bool(args.reload)
        model = torch.hub.load("nagadomi/Video-Depth-Anything_iw3:main", model_name, **model_kwargs,
                               force_reload=force_reload, trust_repo=True).cuda()

    print(model)


if __name__ == "__main__":
    _test()
