import torch
import torch.nn.functional as F


# from nunif/iw3/depth_anything.py
# NOTE: This part does not match the original code
def batch_preprocess(x, lower_bound=392, max_aspect_ratio=4):
    # x: BCHW float32 0-1
    B, C, H, W = x.shape

    # resize
    ensure_multiple_of = 14
    if W < H:
        scale_factor = lower_bound / W
    else:
        scale_factor = lower_bound / H
    new_h = int(H * scale_factor)
    new_w = int(W * scale_factor)

    # Limit aspect ratio to avoid OOM
    if new_h < new_w:
        new_w = min(new_w, int(max_aspect_ratio * new_h))
    else:
        new_h = min(new_h, int(max_aspect_ratio * new_w))

    if True:
        if new_h % ensure_multiple_of != 0:
            new_h += (ensure_multiple_of - new_h % ensure_multiple_of)
        if new_w % ensure_multiple_of != 0:
            new_w += (ensure_multiple_of - new_w % ensure_multiple_of)
    else:
        new_h -= new_h % ensure_multiple_of
        new_w -= new_w % ensure_multiple_of

    if new_h < lower_bound:
        new_h = lower_bound
    if new_w < lower_bound:
        new_w = lower_bound

    # TODO: 'aten::_upsample_bilinear2d_aa.out' is not currently implemented for mps/xpu device
    antialias = True  # not (device_is_mps(x.device) or device_is_xpu(x.device))
    x = F.interpolate(x, size=(new_h, new_w), mode="bilinear", align_corners=False, antialias=antialias)
    x.clamp_(0, 1)

    # normalize
    mean = torch.tensor([0.485, 0.456, 0.406], dtype=x.dtype, device=x.device).reshape(1, 3, 1, 1)
    stdv = torch.tensor([0.229, 0.224, 0.225], dtype=x.dtype, device=x.device).reshape(1, 3, 1, 1)
    x.sub_(mean).div_(stdv)
    return x


def transform(image, input_size):
    if image.ndim == 3:
        return batch_preprocess(image.unsqueeze(0), lower_bound=input_size).squeeze(0)
    elif image.ndim == 4:
        return batch_preprocess(image, lower_bound=input_size)
    else:
        raise ValueError()
