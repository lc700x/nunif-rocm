import depth_pro
import time
import torch
import torchvision.transforms.functional as TF


def show(depth):
    depth = 1 / depth
    depth = (depth - depth.min()) / (depth.max() - depth.min() + 1e-6)
    TF.to_pil_image(depth).show()


def _vis(img_size):
    model, transform = depth_pro.create_model_and_transforms(
        device=torch.device("cuda"),
        precision=torch.float16,
        img_size=img_size
    )
    model.eval()
    print("resolution", model.encoder.img_size)

    image, _, f_px = depth_pro.load_rgb("data/example.jpg")
    image = transform(image)

    prediction = model.infer(image)
    show(prediction["depth"])


def _bench(img_size, batch_size, N):
    model, transform = depth_pro.create_model_and_transforms(
        device=torch.device("cuda"),
        precision=torch.float16,
        img_size=img_size
    )
    model.eval()
    print("resolution", model.encoder.img_size)

    image, _, f_px = depth_pro.load_rgb("data/example.jpg")
    image = transform(image)
    image = image.repeat(batch_size, 1, 1, 1)

    # warmup
    model.infer(image)

    torch.cuda.synchronize()
    t = time.time()
    for _ in range(N):
        model.infer(image)
    torch.cuda.synchronize()
    print(round(1.0 / ((time.time() - t) / (N * batch_size)), 3), "FPS")


def bench():
    N = 10
    # on RTX3070ti
    # 1.857 FPS
    _bench(img_size=384, batch_size=1, N=N)
    # 4.341 FPS
    _bench(img_size=256, batch_size=2, N=N)
    # 17.031 FPS
    _bench(img_size=128, batch_size=4, N=N)


def vis():
    _vis(img_size=384)
    time.sleep(1)
    _vis(img_size=256)
    time.sleep(1)
    _vis(img_size=128)
    time.sleep(1)


if __name__ == "__main__":
    #vis()
    bench()
