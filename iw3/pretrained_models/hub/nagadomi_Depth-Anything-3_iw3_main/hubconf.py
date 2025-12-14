import os
from os import path
import sys
from contextlib import contextmanager
import torch
import safetensors.torch


@contextmanager
def _add_sys_path(p):
    sys.path.insert(0, p)
    try:
        yield
    finally:
        sys.path.remove(p)


def _patch_state_dict_key(state_dict):
    state_dict_new = {}
    for key in state_dict:
        if key.startswith("model."):
            new_key = key[len("model."):]
            state_dict_new[new_key] = state_dict[key]
    return state_dict_new


def _load_state_dict(model_name):
    if model_name == "da3mono-large":
        url = "https://huggingface.co/depth-anything/DA3MONO-LARGE/resolve/main/model.safetensors?download=true"
        file_name = f"{model_name}.safetensors"

    if not file_name:
        raise ValueError(model_name)

    checkpoint_path = path.join(torch.hub.get_dir(), "checkpoints", file_name)
    if not path.exists(checkpoint_path):
        torch.hub.download_url_to_file(url, checkpoint_path)
    state_dict = safetensors.torch.load_file(checkpoint_path, device="cpu")

    return _patch_state_dict_key(state_dict)


def load_model(model_name):
    root = os.path.dirname(__file__)
    pkg_root = os.path.join(root, "src")
    with _add_sys_path(pkg_root):
        from depth_anything_3.cfg import create_object, load_config
        from depth_anything_3.registry import MODEL_REGISTRY
        config = load_config(MODEL_REGISTRY[model_name])
        model = create_object(config)
        model.load_state_dict(_load_state_dict(model_name), strict=True)
        model.eval()

        return model


def _test():
    import argparse
    import torch.nn.functional as F
    import torchvision.transforms.functional as TF
    import torchvision.io as io
    import time

    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--input", "-i", type=str, required=True, help="input image file")
    parser.add_argument("--model_name", type=str, default="da3mono-large",
                        choices=["da3mono-large"],
                        help="model name")
    args = parser.parse_args()

    def normalize_depth_with_sky_mask(depth, sky_mask):
        median_rel_dist = torch.median(depth)
        depth = depth / (median_rel_dist + 1e-6)
        max_rel_dist = torch.quantile(depth, 0.98)
        depth = torch.where(torch.logical_or(sky_mask, depth > max_rel_dist), max_rel_dist, depth)
        depth = 1.0 / (depth + 0.1)
        depth = (depth - depth.min()) / (depth.max() - depth.min())

        return depth

    def compute_sky_mask(sky, sky_thresh=0.3):
        return sky > sky_thresh

    da3 = load_model(args.model_name).cuda()

    resolution = 504
    x = io.read_image(args.input) / 255.0
    x = x.unsqueeze(0).cuda()
    H, W = x.shape[-2], x.shape[-1]
    if True:
        new_h = resolution
        new_w = int(W * (resolution / H))
        new_w -= new_w % 14
    else:
        new_w = resolution
        new_h = int(H * (resolution / W))
        new_h -= new_h % 14

    x = src = F.interpolate(x, size=(new_h, new_w), mode="bilinear", align_corners=False, antialias=True)
    mean = torch.tensor([0.485, 0.456, 0.406], dtype=x.dtype, device=x.device).reshape(1, 3, 1, 1)
    stdv = torch.tensor([0.229, 0.224, 0.225], dtype=x.dtype, device=x.device).reshape(1, 3, 1, 1)
    x = (x - mean) / stdv
    x = x.unsqueeze(1)  # (B, S, C, H, W)

    # NOTE: In my experience, float16 performs better for regression tasks,
    #       but the official code uses bfloat16.
    autocast_dtype = torch.float16  # torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    with torch.inference_mode(), torch.autocast(device_type="cuda", dtype=autocast_dtype):
        z = da3(x)

    depth = z["depth"].squeeze(0).float()
    sky_mask = compute_sky_mask(z["sky"].squeeze(0))
    TF.to_pil_image(normalize_depth_with_sky_mask(depth, sky_mask)).show()
    time.sleep(2)
    TF.to_pil_image(src[0]).show()
    time.sleep(2)
    TF.to_pil_image(sky_mask.float()).show()


if __name__ == "__main__":
    _test()
