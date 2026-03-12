@echo off
cls
echo --- IW3 Installer for AMD GPU's on Windows (With Official ROCm7)---

echo - Setting up the virtual environment
REM Set paths
Set "PYTHON_EXE=.\python\python.exe"

echo.
echo Installing requirements from: %REQUIREMENTS_FILE%
@REM echo - Installing the requirements from %REQUIREMENTS_FILE%
echo - Updating pip package
%PYTHON_EXE% -m pip install --upgrade pip --no-cache-dir --no-warn-script-location -i https://repo.huaweicloud.com/repository/pypi/simple/ --trusted-host https://repo.huaweicloud.com/
if %errorlevel% neq 0 (
  echo Failed to update pip
  pause
  exit /b 1
)
%PYTHON_EXE% -m pip install -r requirements-rocm7-official.txt --no-cache-dir --no-warn-script-location -i https://repo.huaweicloud.com/repository/pypi/simple/ --trusted-host https://repo.huaweicloud.com/
@REM %PYTHON_EXE% -m pip install "triton-windows<3.6" --no-cache-dir --no-warn-script-location -i https://repo.huaweicloud.com/repository/pypi/simple/ --trusted-host https://repo.huaweicloud.com/
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir -r requirements.txt -i https://repo.huaweicloud.com/repository/pypi/simple/ --trusted-host https://repo.huaweicloud.com/
%PYTHON_EXE% -m pip install --no-warn-script-location --no-cache-dir -r requirements-gui.txt -i https://repo.huaweicloud.com/repository/pypi/simple/ --trusted-host https://repo.huaweicloud.com/
@REM %PYTHON_EXE% -m waifu2x.download_models
@REM %PYTHON_EXE% -m waifu2x.web.webgen
@REM %PYTHON_EXE% -m iw3.download_models
pause
