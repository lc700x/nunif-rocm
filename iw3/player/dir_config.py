from os import path


def _get_tmp_dir():
    dirname = path.dirname(__file__)
    iw3_dir = path.join(dirname, "..", "..", "iw3")
    iw3_player_dir = path.join(dirname, "..", "..", "iw3", "player")
    if path.exists(iw3_dir) and path.exists(iw3_player_dir):
        # in nunif/iw3/player
        from nunif.utils.home_dir import ensure_home_dir

        tmp_dir = ensure_home_dir("iw3", path.join(dirname, "..", "..", "tmp"))
    else:
        # gemini dev proj
        tmp_dir = path.join(dirname, "tmp")

    return tmp_dir


TMP_DIR = _get_tmp_dir()
EXAMPLE_DIR = path.join(path.dirname(__file__), "example")
PUBLIC_DIR = path.join(path.dirname(__file__), "public")
CACHE_DIR = path.join(TMP_DIR, "iw3_player_cache")
CERT_DIR = path.join(TMP_DIR, "iw3_player_certs")
# TODO: package
VERSION_DIR = path.join(path.dirname(__file__), "version")
