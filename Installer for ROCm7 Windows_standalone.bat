@echo off
cls
echo --- IW3 Installer for AMD GPU's on Windows (With ROCm7)---
echo - Setting up the virtual enviroment
Set "VIRTUAL_ENV=.\python"
Set "PYTHON_EXE=.\python\python.exe"
echo - Updating the pip package 
%PYTHON_EXE% -m pip install --upgrade pip --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir -r requirements-torch-rocm7.txt
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir -r requirements.txt
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir -r requirements-gui.txt
@REM %PYTHON_EXE% -m waifu2x.download_models
@REM %PYTHON_EXE% -m waifu2x.web.webgen
%PYTHON_EXE% -m iw3.download_models
pause
