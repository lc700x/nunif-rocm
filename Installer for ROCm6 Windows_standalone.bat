@echo off
cls
echo --- IW3 Installer for AMD GPU's on Windows (With ROCm6)---
echo - Setting up the virtual enviroment
Set "VIRTUAL_ENV=.\python"
Set "PYTHON_EXE=.\python\python.exe"
echo - Updating the pip package 
%PYTHON_EXE% -m pip install --upgrade pip --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
@REM %PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir -r requirements-torch-rocm6.txt
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir https://repo.radeon.com/rocm/windows/rocm-rel-6.4.4/torchvision-0.24.0a0+c85f008-cp312-cp312-win_amd64.whl
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir https://repo.radeon.com/rocm/windows/rocm-rel-6.4.4/torch-2.8.0a0+gitfc14c65-cp312-cp312-win_amd64.whl
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir -r requirements.txt --trusted-host http://mirrors.aliyun.com/pypi/simple/
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir -r requirements-gui.txt --trusted-host http://mirrors.aliyun.com/pypi/simple/
@REM %PYTHON_EXE% -m waifu2x.download_models
@REM %PYTHON_EXE% -m waifu2x.web.webgen
%PYTHON_EXE% -m iw3.download_models
pause
