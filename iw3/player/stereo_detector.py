import os

# Define formats
SBS_FULL = "SBS_FULL"
SBS_HALF = "SBS_HALF"
SBS_FULL_CROSS = "SBS_FULL_CROSS"
TB_FULL = "TB_FULL"
TB_HALF = "TB_HALF"
FLAT = "FLAT"

# Map tags to formats.
# Note: Based on spec, _TBF is in both, so we'll prioritize it as Full.
TAG_MAP = {
    "_Full_SBS": SBS_FULL,
    "_fullsbs": SBS_FULL,
    "_LRF": SBS_FULL,
    "_SBS": SBS_FULL,
    "_3DHF": SBS_FULL,
    "_3DPHF": SBS_FULL,
    "_RLF": SBS_FULL_CROSS,
    "_LR": SBS_HALF,
    "_3DH": SBS_HALF,
    "_3DPH": SBS_HALF,
    "_Full_TB": TB_FULL,
    "_fulltb": TB_FULL,
    "_TBF": TB_FULL,
    "_3DVF": TB_FULL,
    "_3DPVF": TB_FULL,
    "_TB": TB_HALF,
    "_3DV": TB_HALF,
    "_3DPV": TB_HALF,
}

# Sort tags by length (longest first) to ensure precise matching
SORTED_TAGS = sorted(TAG_MAP.keys(), key=len, reverse=True)


def detect_stereo_format(path_or_list):
    """
    Detects the stereo format based on tags in the provided paths or strings.
    If a string is provided, it checks the filename, then the parent directory.
    If a list is provided, it checks each item in the list in order.
    """
    candidates = []
    if isinstance(path_or_list, str):
        # 1. Filename
        candidates.append(os.path.basename(path_or_list))
        # 2. Parent directory
        parent = os.path.basename(os.path.dirname(path_or_list))
        if parent:
            candidates.append(parent)
    else:
        candidates = path_or_list

    for name in candidates:
        if not name:
            continue
        name = name.lower()
        for tag in SORTED_TAGS:
            if tag.lower() in name:
                return TAG_MAP[tag]

    return FLAT
