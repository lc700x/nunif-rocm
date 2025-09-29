import torch


def DepthAnythingMetricDepth(model_type="indoor", remove_prep=True):
    from zoedepth_depth_anything.utils.config import get_config
    from zoedepth_depth_anything.models.builder import build_model
    assert model_type in {"indoor", "outdoor"}
    file_name = f"depth_anything_metric_depth_{model_type}.pt"
    url = f"url::https://huggingface.co/spaces/LiheYoung/Depth-Anything/resolve/main/checkpoints_metric_depth/{file_name}?download=true"

    config = get_config("zoedepth", "infer", pretrained_resource=url)
    model = build_model(config)

    if remove_prep:
        # remove preprocessing layer
        model.core.prep = lambda x: x

    return model
