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

# numpy to torch by nagadomi

import torch


def compute_scale_and_shift(prediction, target, mask, scale_only=False):
    if scale_only:
        return compute_scale(prediction, target, mask), 0
    else:
        return compute_scale_and_shift_full(prediction, target, mask)


def compute_scale(prediction, target, mask=None):
    prediction = prediction.to(torch.float32)
    target = target.to(torch.float32)
    if mask is not None:
        mask = mask.to(torch.float32)
        a_00 = torch.sum(mask * prediction * prediction)
        b_0 = torch.sum(mask * prediction * target)
    else:
        a_00 = torch.sum(prediction * prediction)
        b_0 = torch.sum(prediction * target)

    x_0 = b_0 / (a_00 + 1e-6)

    return x_0.item()


def compute_scale_and_shift_full(prediction, target, mask=None):
    prediction = prediction.to(torch.float32)
    target = target.to(torch.float32)
    if mask is not None:
        mask = mask.to(torch.float32)
        a_00 = torch.sum(mask * prediction * prediction)
        a_01 = torch.sum(mask * prediction)
        a_11 = torch.sum(mask)
        b_0 = torch.sum(mask * prediction * target)
        b_1 = torch.sum(mask * target)
    else:
        a_00 = torch.sum(prediction * prediction)
        a_01 = torch.sum(prediction)
        a_11 = float(target.numel())
        b_0 = torch.sum(prediction * target)
        b_1 = torch.sum(target)

    det = a_00 * a_11 - a_01 * a_01

    if det.item() != 0:
        x_0 = ((a_11 * b_0 - a_01 * b_1) / det).item()
        x_1 = ((-a_01 * b_0 + a_00 * b_1) / det).item()
    else:
        x_0 = 1.0
        x_1 = 0.0

    return x_0, x_1


def get_interpolate_frames(frame_list_pre, frame_list_post):
    assert len(frame_list_pre) == len(frame_list_post)
    min_w = 0.0
    max_w = 1.0
    step = (max_w - min_w) / (len(frame_list_pre) - 1)
    post_w_list = [min_w] + [i * step for i in range(1, len(frame_list_pre) - 1)] + [max_w]
    interpolated_frames = []
    for i in range(len(frame_list_pre)):
        interpolated = frame_list_pre[i] * (1 - post_w_list[i]) + frame_list_post[i] * post_w_list[i]
        interpolated_frames.append(interpolated)
    return interpolated_frames
