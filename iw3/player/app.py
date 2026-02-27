import hashlib
import os
import sys
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from .dir_config import PUBLIC_DIR
from .media_library import MediaLibrary
from .server_state import ServerState

# auto_error=False prevents automatic 401 response from the dependency itself
security = HTTPBasic(auto_error=False)


async def authenticate(request: Request, credentials: Optional[HTTPBasicCredentials] = Depends(security)):
    state: ServerState = request.app.state.server_state
    # If no auth is configured, everyone is allowed
    if state.auth_user is None and state.auth_password is None:
        return None

    # If auth is configured but no credentials provided, OR incorrect credentials
    import secrets

    if credentials:
        is_user_ok = secrets.compare_digest(credentials.username, state.auth_user or "")
        is_pass_ok = secrets.compare_digest(credentials.password, state.auth_password or "")
        if is_user_ok and is_pass_ok:
            return credentials.username

    # Trigger Basic Auth dialog in browser
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Basic"},
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic handled in server.py if needed
    yield
    # Shutdown logic
    if hasattr(app.state, "server_state"):
        app.state.server_state.close()


# Define app at module level
app = FastAPI(lifespan=lifespan, dependencies=[Depends(authenticate)])


# Helper Dependency to get instances
def get_library(request: Request) -> MediaLibrary:
    return request.app.state.media_library


def get_state(request: Request) -> ServerState:
    return request.app.state.server_state


# Endpoints
@app.get("/api/list")
async def list_files(path: str = "/", library: MediaLibrary = Depends(get_library)):
    return library.list_files(path)


@app.get("/api/environments")
async def list_environments():
    env_dir = os.path.join(PUBLIC_DIR, "environments")
    if not os.path.exists(env_dir):
        return []
    envs = []
    try:
        for entry in os.scandir(env_dir):
            if entry.is_file() and entry.name.lower().endswith((".hdr", ".exr", ".glb")):
                envs.append(entry.name)
    except Exception as e:
        print(f"Environments error: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail="Internal server error")
    return sorted(envs)


@app.get("/api/luts")
async def list_luts():
    lut_dir = os.path.join(PUBLIC_DIR, "lut")
    if not os.path.exists(lut_dir):
        return []
    luts = []
    try:
        for entry in os.scandir(lut_dir):
            if entry.is_file() and entry.name.lower().endswith(".cube"):
                luts.append(entry.name)
    except Exception as e:
        print(f"LUTs error: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail="Internal server error")
    return sorted(luts, key=lambda lut_path: os.path.splitext(os.path.basename(lut_path))[0])


@app.get("/api/key")
async def get_key(state: ServerState = Depends(get_state)):
    if not os.path.exists(state.secret_key_file):
        raise HTTPException(status_code=404, detail="Secret key not found")
    try:
        with open(state.secret_key_file, "rb") as f:
            key_data = f.read()
            import base64

            return {"key": base64.b64encode(key_data).decode("utf-8")}
    except Exception as e:
        print(f"Key error: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/image")
async def serve_image(path: str, library: MediaLibrary = Depends(get_library)):
    return library.get_file_response(path)


@app.get("/api/thumbnail")
async def serve_thumbnail(
    request: Request,
    path: str,
    library: MediaLibrary = Depends(get_library),
    state: ServerState = Depends(get_state),
):
    zip_rel, internal_path = library.split_zip_path(path.lstrip("/"))
    raw_key = f"{path}"
    if not internal_path:
        abs_path = library.safe_join(path)
        if abs_path and os.path.exists(abs_path):
            raw_key += f"{int(os.path.getmtime(abs_path))}"
    etag = hashlib.sha256(raw_key.encode()).hexdigest()
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304)
    return library.get_thumbnail(path, etag)


@app.get("/api/subtitles")
async def serve_subtitles(request: Request, path: str, library: MediaLibrary = Depends(get_library)):
    zip_rel, internal_path = library.split_zip_path(path.lstrip("/"))
    raw_key = f"subs_{path}"

    if internal_path:
        # Archives do not support video, so no subtitles
        return Response(content="[]", media_type="application/json")

    abs_path = library.safe_join(path)
    if abs_path and os.path.exists(abs_path):
        raw_key += f"{int(os.path.getmtime(abs_path))}"
        # Include external subtitle mtime if it exists
        base_path = os.path.splitext(abs_path)[0]
        vtt_path = base_path + ".vtt"
        srt_path = base_path + ".srt"
        if os.path.exists(vtt_path):
            raw_key += f"_vtt_{int(os.path.getmtime(vtt_path))}"
        elif os.path.exists(srt_path):
            raw_key += f"_srt_{int(os.path.getmtime(srt_path))}"

    etag = hashlib.sha256(raw_key.encode()).hexdigest()
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304)
    return library.get_subtitles(path, etag)


@app.post("/api/cache/clear")
async def clear_cache(state: ServerState = Depends(get_state)):
    state.cache_db.clear()
    return {"status": "ok", "message": "Cache cleared"}


@app.get("/js/debug_log.js")
async def serve_debug_log_js(state: ServerState = Depends(get_state)):
    if state.debug_mode:
        filename = "debug_log.js"
    elif state.debug_console:
        filename = "debug_log_console.js"
    else:
        filename = "debug_log_empty.js"
    return FileResponse(os.path.join(PUBLIC_DIR, "js", filename))


@app.get("/{filename:path}")
async def serve_static(filename: str):
    if not filename or filename == "index.html":
        return FileResponse(os.path.join(PUBLIC_DIR, "index.html"), headers={"Cache-Control": "no-cache"})

    # Securely join path with PUBLIC_DIR
    abs_public = os.path.abspath(PUBLIC_DIR)
    target_path = os.path.join(abs_public, filename.lstrip("/"))
    abs_path = os.path.abspath(target_path)

    if not os.path.isfile(abs_path) or os.path.commonpath([abs_public, abs_path]) != abs_public:
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(abs_path, headers={"Cache-Control": "no-cache"})
