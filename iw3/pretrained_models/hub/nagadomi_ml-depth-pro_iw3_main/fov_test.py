import os
from os import path
import argparse
import depth_pro
import torch


def fov_eval(test_size=256):
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--input-dir", "-i", type=str, required=True, help="input dire")
    args = parser.parse_args()
    files = [path.join(args.input_dir, fn)
             for fn in os.listdir(args.input_dir)
             if path.splitext(fn)[-1].lower() in {".png", ".jpeg"}]

    model_base, transform = depth_pro.create_model_and_transforms(
        device=torch.device("cuda"),
        precision=torch.float16,
        img_size=384
    )
    model_base.eval()

    model_mod, transform = depth_pro.create_model_and_transforms(
        device=torch.device("cuda"),
        precision=torch.float16,
        img_size=test_size
    )
    model_mod.eval()

    losses = []
    scales = []
    for fn in files:
        image, _, _ = depth_pro.load_rgb(fn)
        image = transform(image)
        pred_base = model_base.infer(image)
        pred_mod = model_mod.infer(image)
        f_base = pred_base["focallength_px"].item()
        f_mod = pred_mod["focallength_px"].item()

        diff = abs(f_base - f_mod)
        scale = f_base / f_mod
        print(fn, diff, scale, f_base, f_mod)
        losses.append(diff)
        scales.append(scale)

    print("abs", "mean", sum(losses) / len(losses), "min", min(losses), "max", max(losses))
    print("scale", sum(scales) / len(scales), "min", min(scales), "max", max(scales))


if __name__ == "__main__":
    fov_eval()
