# Copyright (2025) Bytedance Ltd. and/or its affiliates

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

#     http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import torch
import torch.nn.functional as F
import torch.nn as nn
import contextlib
from .dinov2 import DINOv2
from .dpt_temporal import DPTHeadTemporal

# infer settings, do not change
INFER_LEN = 32
OVERLAP = 10
INTERP_LEN = 8


def autocast(device, enabled):
    if device.type == "cuda":
        return torch.autocast(device_type=device.type, enabled=enabled)
    else:
        return contextlib.nullcontext()


class VideoDepthAnythingStreamingTorch(nn.Module):
    def __init__(
        self,
        encoder='vitl',
        features=256,
        out_channels=[256, 512, 1024, 1024],
        use_bn=False,
        use_clstoken=False,
        num_frames=32,
        device="cuda",
        pe='ape'
    ):
        super(VideoDepthAnythingStreamingTorch, self).__init__()

        self.intermediate_layer_idx = {
            'vits': [2, 5, 8, 11],
            'vitb': [2, 5, 8, 11],
            'vitl': [4, 11, 17, 23]
        }

        self.device = torch.device(device)
        self.encoder = encoder
        self.pretrained = DINOv2(model_name=encoder)

        self.head = DPTHeadTemporal(self.pretrained.embed_dim, features, use_bn,
                                    out_channels=out_channels, use_clstoken=use_clstoken,
                                    num_frames=num_frames, pe=pe)
        self.frame_id_list = []
        self.frame_cache_list = []
        self.gap = (INFER_LEN - OVERLAP) * 2 - 1 - (OVERLAP - INTERP_LEN)
        assert self.gap == 41
        self.id = -1

    def reset_state(self):
        self.id = -1
        self.frame_id_list = []
        self.frame_cache_list = []

    def forward(self, x):
        return self.forward_depth(self.forward_features(x), x.shape)[0]

    def forward_features(self, x):
        features = self.pretrained.get_intermediate_layers(
            x.flatten(0, 1), self.intermediate_layer_idx[self.encoder], return_class_token=True)
        return features

    def forward_depth(self, features, x_shape, cached_hidden_state_list=None):
        B, T, C, H, W = x_shape
        patch_h, patch_w = H // 14, W // 14
        depth, cur_cached_hidden_state_list = self.head(features, patch_h, patch_w, T,
                                                        cached_hidden_state_list=cached_hidden_state_list)
        depth = F.interpolate(depth, size=(H, W), mode="bilinear", align_corners=True)
        depth = F.relu(depth)
        return depth.squeeze(1).unflatten(0, (B, T)), cur_cached_hidden_state_list  # return shape [B, T, H, W]

    @torch.inference_mode
    def infer_video_depth_one(self, frame, use_amp=False):
        assert frame.ndim == 3

        self.id += 1
        if not self.frame_cache_list:  # first frame
            # Inference the first frame
            cur_list = [frame.unsqueeze(0).unsqueeze(0)]
            cur_input = torch.cat(cur_list, dim=1).to(self.device)

            with autocast(self.device, enabled=use_amp):
                cur_feature = self.forward_features(cur_input)
                x_shape = cur_input.shape
                depth, cached_hidden_state_list = self.forward_depth(cur_feature, x_shape)

            depth = depth.to(cur_input.dtype)
            depth = depth.flatten(0, 1).unsqueeze(1)

            # Copy multiple cache to simulate the windows
            self.frame_cache_list = [cached_hidden_state_list] * INFER_LEN
            self.frame_id_list.extend([0] * (INFER_LEN - 1))

            new_depth = depth[0]
        else:
            # infer feature
            cur_input = frame.unsqueeze(0).unsqueeze(0).to(self.device)
            with autocast(self.device, enabled=use_amp):
                cur_feature = self.forward_features(cur_input)
                x_shape = cur_input.shape

            cur_list = self.frame_cache_list[0:2] + self.frame_cache_list[-INFER_LEN+3:]
            '''
            cur_id = self.frame_id_list[0:2] + self.frame_id_list[-INFER_LEN+3:]
            print(f"cur_id: {cur_id}")
            '''
            assert len(cur_list) == INFER_LEN - 1
            cur_cache = [torch.cat([h[i] for h in cur_list], dim=1) for i in range(len(cur_list[0]))]

            # infer depth
            with autocast(self.device, enabled=use_amp):
                depth, new_cache = self.forward_depth(cur_feature, x_shape, cached_hidden_state_list=cur_cache)

            depth = depth.to(cur_input.dtype)
            depth = depth.flatten(0, 1).unsqueeze(1)
            new_depth = depth[-1]

            self.frame_cache_list.append(new_cache)

        # adjust the sliding window
        self.frame_id_list.append(self.id)
        if self.id + INFER_LEN > self.gap + 1:
            del self.frame_id_list[1]
            del self.frame_cache_list[1]

        # NOTE: (1, H, W)
        return new_depth
