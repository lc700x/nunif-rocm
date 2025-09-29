# Copyright (C) 2024 Apple Inc. All Rights Reserved.
# Field of View network architecture.

from typing import Optional

import torch
from torch import nn
from torch.nn import functional as F


def replication_pad2d_naive(x, padding, detach=False):
    # For MPS compatibility
    assert x.ndim == 4 and len(padding) == 4
    left, right, top, bottom = padding

    detach_fn = lambda t: t.detach() if detach else t
    if left > 0:
        x = torch.cat((*((detach_fn(x[:, :, :, :1]),) * left), x), dim=3)
    elif left < 0:
        x = x[:, :, :, -left:]
    if right > 0:
        x = torch.cat((x, *((detach_fn(x[:, :, :, -1:]),) * right)), dim=3)
    elif right < 0:
        x = x[:, :, :, :right]
    if top > 0:
        x = torch.cat((*((detach_fn(x[:, :, :1, :]),) * top), x), dim=2)
    elif top < 0:
        x = x[:, :, -top:, :]
    if bottom > 0:
        x = torch.cat((x, *((detach_fn(x[:, :, -1:, :]),) * bottom)), dim=2)
    elif bottom < 0:
        x = x[:, :, :bottom, :]

    return x.contiguous()



class FOVNetwork(nn.Module):
    """Field of View estimation network."""

    def __init__(
        self,
        num_features: int,
        fov_encoder: Optional[nn.Module] = None,
    ):
        """Initialize the Field of View estimation block.

        Args:
        ----
            num_features: Number of features used.
            fov_encoder: Optional encoder to bring additional network capacity.

        """
        super().__init__()

        # Create FOV head.
        fov_head0 = [
            nn.Conv2d(
                num_features, num_features // 2, kernel_size=3, stride=2, padding=1
            ),  # 128 x 24 x 24
            nn.ReLU(True),
        ]
        fov_head = [
            nn.Conv2d(
                num_features // 2, num_features // 4, kernel_size=3, stride=2, padding=1
            ),  # 64 x 12 x 12
            nn.ReLU(True),
            nn.Conv2d(
                num_features // 4, num_features // 8, kernel_size=3, stride=2, padding=1
            ),  # 32 x 6 x 6
            nn.ReLU(True),
            nn.Conv2d(num_features // 8, 1, kernel_size=6, stride=1, padding=0),
        ]
        if fov_encoder is not None:
            self.encoder = nn.Sequential(
                fov_encoder, nn.Linear(fov_encoder.embed_dim, num_features // 2)
            )
            self.downsample = nn.Sequential(*fov_head0)
        else:
            raise NotImplementedError("fov")
            fov_head = fov_head0 + fov_head
        self.head = nn.Sequential(*fov_head)


    def forward_fov_head(self, x):
        assert len(self.head) == 5
        x = self.head[0](x)
        x = self.head[1](x)
        x = self.head[2](x)
        x = self.head[3](x)
        if x.shape[2] < 6:
            pad = (6 - x.shape[2]) // 2
            x = replication_pad2d_naive(x, (pad,) * 4)
            # x = F.interpolate(x, size=(6, 6), mode="bilinear", align_corners=False)

        x = self.head[4](x)
        return x

    def forward(self, x: torch.Tensor, lowres_feature: torch.Tensor) -> torch.Tensor:
        """Forward the fov network.

        Args:
        ----
            x (torch.Tensor): Input image.
            lowres_feature (torch.Tensor): Low resolution feature.

        Returns:
        -------
            The field of view tensor.

        """
        if hasattr(self, "encoder"):
            x = F.interpolate(
                x,
                size=None,
                scale_factor=0.25,
                mode="bilinear",
                align_corners=False,
            )
            x = self.encoder(x)[:, 1:].permute(0, 2, 1)
            if x.device.type == "mps":
                x = x.contiguous()
            lowres_feature = self.downsample(lowres_feature)
            x = x.reshape_as(lowres_feature) + lowres_feature
        else:
            x = lowres_feature
        return self.forward_fov_head(x)
