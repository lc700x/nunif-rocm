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

# online version modified by nagadomi

import torch
import torch.nn.functional as F
import torch.nn as nn

from .dinov2 import DINOv2
from .dpt_temporal import DPTHeadTemporal
from .util.align_torch import compute_scale_and_shift, get_interpolate_frames

# infer settings, do not change
INFER_LEN = 32
OVERLAP = 10
KEYFRAMES = [0, 12, 24, 25, 26, 27, 28, 29, 30, 31]
INTERP_LEN = 8

ALIGN_LEN = OVERLAP - INTERP_LEN  # =2
KF_ALIGN_LIST = KEYFRAMES[:ALIGN_LEN]  # const


def _expand_tensor_info(x, ret=[]):
    if isinstance(x, (list, tuple)):
        for xx in x:
            ret += _expand_tensor_info(xx, ret)
    else:
        ret.append((x.dtype, x.shape))

    return ret


def _show_vram(device, name=""):
    max_vram_mb = int(torch.cuda.max_memory_allocated(device) / (1024 * 1024))
    vram_mb = int(torch.cuda.memory_allocated(device) / (1024 * 1024))
    print(f"[{name}] VRAM Max: {max_vram_mb}MB, Usage: {vram_mb}MB")


class VideoDepthAnythingOnline(nn.Module):
    def __init__(
            self,
            encoder='vitl',
            features=256,
            out_channels=[256, 512, 1024, 1024],
            use_bn=False,
            use_clstoken=False,
            num_frames=32,
            device="cuda",
            pe='ape',
            metric_depth=False,
    ):
        super(VideoDepthAnythingOnline, self).__init__()

        self.intermediate_layer_idx = {
            'vits': [2, 5, 8, 11],
            'vitb': [2, 5, 8, 11],
            'vitl': [4, 11, 17, 23]
        }

        self.encoder = encoder
        self.pretrained = DINOv2(model_name=encoder)
        self.metric_depth = metric_depth
        self.head = DPTHeadTemporal(
            self.pretrained.embed_dim, features, use_bn,
            out_channels=out_channels, use_clstoken=use_clstoken, num_frames=num_frames, pe=pe)
        if device is not None:
            self.device = torch.device(device)
        else:
            self.device = None

        self.reset_state()

    def reset_state(self):
        self.cur_list = []
        self.pre_input = None
        self.overlap_input = None
        self.depth_list_aligned = []
        self.ref_align = []

    def forward(self, x):
        B, T, C, H, W = x.shape
        patch_h, patch_w = H // 14, W // 14

        features = self.pretrained.get_intermediate_layers(
            x.flatten(0, 1), self.intermediate_layer_idx[self.encoder], return_class_token=True)

        depth = self.head(features, patch_h, patch_w, T, return_hidden_state_list=False)[0]
        depth = F.interpolate(depth, size=(H, W), mode="bilinear", align_corners=True).to(depth.dtype)
        depth = F.relu(depth)
        return depth.squeeze(1).unflatten(0, (B, T))  # return shape [B, T, H, W]

    def infer(self, frame, use_amp=True):
        """
        infer online
        """
        depth_list = self.infer_depth(
            frame,
            use_amp=use_amp)
        if depth_list is not None:
            depth_list = self.infer_align(depth_list)
            return depth_list
        else:
            return None

    def infer_depth(self, frame, use_amp=True):
        append_frame_len = 0
        if frame is None:
            # final
            if self.overlap_input is not None:
                append_frame_len = INFER_LEN - (len(self.cur_list) + self.overlap_input.shape[1])
            else:
                append_frame_len = INFER_LEN - len(self.cur_list)
            if append_frame_len > 0:
                if len(self.cur_list) > 0:
                    self.cur_list += [self.cur_list[-1].detach().clone()] * append_frame_len
                else:
                    self.cur_list = [self.overlap_input[:, -1:].detach().clone()] * append_frame_len
        else:
            self.cur_list.append(frame.unsqueeze(0).unsqueeze(0))
            if self.overlap_input is None:
                # INFER_LEN input, INFER_LEN output
                if len(self.cur_list) < INFER_LEN:
                    return None
            else:
                # (INFER_LEN - OVERLAP) input, INFER_LEN output
                if self.overlap_input.shape[1] + len(self.cur_list) < INFER_LEN:
                    return None

        cur_input = torch.cat(self.cur_list, dim=1).to(self.device)
        self.cur_list = []
        if self.overlap_input is None:
            assert self.pre_input is None
            self.overlap_input = cur_input[:, -OVERLAP:].detach().clone()
        else:
            assert self.pre_input is not None
            new_overlap_input = cur_input[:, -OVERLAP:].detach().clone()
            cur_input = torch.cat((self.overlap_input, cur_input), dim=1)
            self.overlap_input = new_overlap_input
            cur_input[:, :OVERLAP, ...] = self.pre_input[:, KEYFRAMES, ...]

        if cur_input.device.type == "cuda":
            with torch.no_grad(), torch.autocast(device_type=cur_input.device.type, enabled=use_amp):
                depth = self.forward(cur_input)  # depth shape: [1, T, H, W] # fp16
        else:
            with torch.no_grad():
                depth = self.forward(cur_input)  # depth shape: [1, T, H, W]

        depth = depth.flatten(0, 1).unsqueeze(1)
        depth = depth.float()
        depth_list = [depth[i][0] for i in range(depth.shape[0])]
        if self.pre_input is None:
            self.pre_input = cur_input.detach()
        else:
            self.pre_input.copy_(cur_input.detach())

        # gc.collect()

        return depth_list  # len(depth_list) == 32

    def infer_align(self, depth_list):
        assert len(depth_list) == INFER_LEN

        if len(self.depth_list_aligned) == 0:
            self.depth_list_aligned += depth_list
            for kf_id in KF_ALIGN_LIST:
                self.ref_align.append(depth_list[kf_id])
            return None

        curr_align = []
        for i in range(len(KF_ALIGN_LIST)):
            curr_align.append(depth_list[i])

        if self.metric_depth:
            scale, shift = 1.0, 0.0
        else:
            scale, shift = compute_scale_and_shift(torch.cat(curr_align), torch.cat(self.ref_align), mask=None)

        pre_depth_list = self.depth_list_aligned[-INTERP_LEN:]
        post_depth_list = depth_list[ALIGN_LEN:OVERLAP]  # 0+2:0+10, = 8
        for i in range(len(post_depth_list)):
            post_depth_list[i] = post_depth_list[i] * scale + shift
            post_depth_list[i][post_depth_list[i] < 0] = 0  # clamp

        self.depth_list_aligned[-INTERP_LEN:] = get_interpolate_frames(pre_depth_list, post_depth_list)
        for i in range(OVERLAP, INFER_LEN):
            new_depth = depth_list[i] * scale + shift
            new_depth[new_depth < 0] = 0
            self.depth_list_aligned.append(new_depth)

        # TODO: NOTE: This line uses the first frame permanently. I guess this is some kind of mistake.
        self.ref_align = self.ref_align[:1]
        for kf_id in KF_ALIGN_LIST[1:]:
            new_depth = depth_list[kf_id] * scale + shift
            new_depth[new_depth < 0] = 0  # clamp
            self.ref_align.append(new_depth)

        depth_list = self.depth_list_aligned[0:-INTERP_LEN]
        self.depth_list_aligned = self.depth_list_aligned[-INTERP_LEN:]

        return depth_list
