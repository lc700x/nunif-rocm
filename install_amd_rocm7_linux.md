# steps
## iw3 desktop (rocm6 OK), iw3 (rocm7 OK)
## Linux must on Xorg mode
```bash
sudo apt update
sudo apt install libsecret-1-0 libsdl2-dev 
sudo apt-get install xcb git-core libmagickwand-dev libraqm-dev
sudo apt install python3.10-venv -y
sudo apt install git
wget https://repo.radeon.com/rocm/manylinux/rocm-rel-7.0/pytorch_triton_rocm-3.3.1%2Brocm7.0.0.git9c7bc0a3-cp310-cp310-linux_x86_64.whl
wget https://repo.radeon.com/rocm/manylinux/rocm-rel-7.0/torch-2.7.1%2Brocm7.0.0.lw.git698b58a9-cp310-cp310-linux_x86_64.whl
wget https://repo.radeon.com/rocm/manylinux/rocm-rel-7.0/torchvision-0.21.0%2Brocm7.0.0.git4040d51f-cp310-cp310-linux_x86_64.whl

python -m pip install torch-2.7.1+rocm7.0.0.lw.git698b58a9-cp310-cp310-linux_x86_64.whl pytorch_triton_rocm-3.3.1+rocm7.0.0.git9c7bc0a3-cp310-cp310-linux_x86_64.whl torchvision-0.21.0+rocm7.0.0.git4040d51f-cp310-cp310-linux_x86_64.whl
python -m pip install -r requirements.txt --no-cache-dir
python -m pip install -f https://extras.wxpython.org/wxPython4/extras/linux/gtk3/ubuntu-22.04/ wxpython --no-cache-dir


git clone https://github.com/nagadomi/nunif.git\
cd nunif
python3 -m venv venv
. venv/bin/activate

```
