import torch


def DepthPro(img_size=384, device=torch.device("cpu"), dtype=torch.float16):
    from depth_pro import create_model_and_transforms
    assert img_size in {384, 256, 128}
    model, transforms = create_model_and_transforms(
        device=device,
        precision=dtype,
        img_size=img_size
    )
    model = model.eval()
    return model, transforms


def _test_run():
    import argparse
    import PIL
    import torchvision.transforms.functional as TF

    """
    pytyon hubconf.py -i ./input.jpg -o ./output.png
    """
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--input", "-i", type=str, required=True, help="input image file")
    parser.add_argument("--output", "-o", type=str, required=True, help="output image file")
    parser.add_argument("--encoder", type=int, default=384, choices=[384, 256, 128],
                        help="encoder for relative depth model")
    parser.add_argument("--remote", action="store_true", help="use remote repo")
    parser.add_argument("--reload", action="store_true", help="reload remote repo")
    args = parser.parse_args()

    model_kwargs = dict(img_size=args.encoder, device="cuda")
    if not args.remote:
        model, transforms = torch.hub.load(".", "DepthPro", **model_kwargs,
                                           source="local", trust_repo=True)
    else:
        force_reload = bool(args.reload)
        model, transforms = torch.hub.load("nagadomi/ml-depth-pro_iw3", "DepthPro", **model_kwargs,
                                           force_reload=force_reload, trust_repo=True)
    image = PIL.Image.open(args.input).convert("RGB")
    image = transforms(image)
    with torch.inference_mode():
        ret = model.infer(image)
        depth = ret["depth"]
        print(depth.dtype, depth.shape)
        depth = 1.0 - (depth - depth.min()) / (depth.max() - depth.min() + 1e-6)
        if True:
            c = 0.45
            c1 = 1.0 + c
            min_v = c / c1
            depth = ((c / (c1 - depth)) - min_v) / (1.0 - min_v)
        depth = depth.squeeze(dim=[0, 1])
        depth = torch.clamp(depth, 0, 1)
    depth = TF.to_pil_image(depth.cpu())
    depth.save(args.output)


if __name__ == "__main__":
    _test_run()
