::: FOR AMD GPU'S ON WINDOWS :::

## Dependencies

If coming from the very start, you need :

1. **Git**: Download from https://git-scm.com/download/win.
   During installation don't forget to check the box for "Use Git from the Windows Command line and also from
   3rd-party-software" to add Git to your system's PATH.
2. **Python** ([3.10.11](https://www.python.org/ftp/python/3.10.11/python-3.10.11-amd64.exe) 3.11 also works, but 3.10 is used by most popular nodes atm): Install the latest release from python.org. **Don't Use
   Windows Store Version**. If you have that installed, uninstall and please install from python.org. During
   installation remember to check the box for "Add Python to PATH when you are at the "Customize Python" screen.
3. **Visual C++ Runtime**: Download [vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe) and install it.
4. Install **HIP SDK 6.2** from [HERE](https://www.amd.com/en/developer/resources/rocm-hub/hip-sdk.html) the correct version, "Windows 10 & 11 6.2.x HIP SDK"
5. To see system variables : Right click My Computer - Properties - Advanced System Settings (on the menu right side) - Environment Variable.
   Add the system variable HIP_PATH, value: `C:\\Program Files\\AMD\\ROCm\\6.2\\` (This is the default folder, if you
   have installed it on another drive, change if necessary)
    1. Check the variables on the lower part (System Variables), there should be a variable called: HIP_PATH.
    2. Also check the variables on the lower part (System Variables), there should be a variable called: "Path".
       Double-click it and click "New" add this: `C:\Program Files\AMD\ROCm\6.2\bin`
7. If you have an AMD GPU below 6800 (6700,6600 etc.), download the recommended library files for your gpu
   from [likelovewant Repository](https://github.com/likelovewant/ROCmLibs-for-gfx1103-AMD780M-APU/releases/tag/v0.6.2.4)
    1. Go to folder "C:\Program Files\AMD\ROCm\6.2\bin\rocblas", there would be a "library" folder, backup the files
       inside to somewhere else.
    2. Open your downloaded optimized library archive and put them inside the library folder (overwriting if
       necessary): "C:\\Program Files\\AMD\\ROCm\\6.2\\bin\\rocblas\\library"
    *** GPU LIST : gfx1010: RX 5700, RX 5700 XT , gfx1012: RX 5500, RX 5500 XT ,gfx1031: RX 6700, RX 6700 XT, RX 6750 XT , gfx1032: RX 6600, RX 6600 XT, RX 6650 XT , gfx1103: Radeon 780M, gfx803: RX 570, RX 580...
       To look for gfx code for your gpu not listed use this : `https://github.com/likelovewant/ROCmLibs-for-gfx1103-AMD780M-APU/releases/tag/v0.6.2.4](https://llvm.org/docs/AMDGPUUsage.html#processors`
8. Reboot your system.

## Setup (Windows-Only)

Open a cmd prompt. (Powershell doesn't work, you have to use command prompt.)

[ You open command prompt via typing "cmd" in start / run OR the easier way going into the drive or directory you want to install nunif/iw3 to on explorer, click on the address bar and type "cmd" press enter, this would open a commandline window on the directory you are in on explorer at the moment. ]

```bash
git clone https://github.com/patientx/nunif-amd
```

```bash
cd nunif-amd
```

```bash
installzludaforamd.bat
```

to start for later use (or create a shortcut to) :

```bash
iw3z.bat
```

NOTES :::: 

- You can now use the iw3 gui & cli with gpu acceleration with amd gpu's. 
- Run iw3z.bat to start iw3 with amd gpu support.
- CLI can also be used, to use it first you have enable venv , go into nunif-amd folder in commandline, "venv\scripts\activate" enter , now you can see the available parameters with "zluda\zluda.exe -- python -m iw3 -h" then use them to generate from the command prompt.

******** The first time you select a model and generate, (only a new type of model) it would seem like your computer is doing nothing, that's normal , zluda is creating a database for future use. That only happens once for every new type of model. You will see "Compilation in progress..." a few times.
