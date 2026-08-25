import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import ensure_indexes
from app.routers import admin, auth, event, migrate, stats, websites
from app.scheduler import start_scheduler, stop_scheduler

settings = get_settings()

# Without a configured handler, module-level logger.info()/exception() calls
# (scheduler, report failures) are silently dropped — no output at all, not
# even buffered. Needed for the same "diagnosable from the log viewer"
# requirement the boot-log line satisfies for startup.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title=settings.app_name, debug=settings.debug)


@app.on_event("startup")
def _startup() -> None:
    ensure_indexes()
    # NOTE: if this ever runs under `uvicorn --workers N>1`, each worker
    # process starts its own scheduler and the monthly job fires N times —
    # fine for the current single-worker Docker setup, but worth revisiting
    # (e.g. a Mongo-based leader lock) before scaling to multiple workers.
    start_scheduler()
    # Required boot-log line per the deploy panel's CONTAINER_CONTRACT.md —
    # makes a clean boot vs. a silent hang distinguishable in the log viewer.
    print(f"SERVER IS LIVE AND LISTENING on port {settings.port}")


@app.on_event("shutdown")
def _shutdown() -> None:
    stop_scheduler()


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(websites.router)
app.include_router(stats.router)
app.include_router(admin.router)
app.include_router(event.router)
app.include_router(migrate.router)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/js/script.js")
def tracking_script():
    # Served at this exact path (not /static/js/script.js) because every
    # already-embedded <script src="https://a2ganalytics.com/js/script.js">
    # tag points here and cannot be changed.
    return FileResponse("static/js/script.js", media_type="application/javascript")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# The Vite build output lands here only inside the Docker image (see the
# root Dockerfile) — local dev serves the frontend from the separate Vite
# dev server instead, so this directory legitimately doesn't exist there.
WEBAPP_DIR = Path("webapp")
if WEBAPP_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(WEBAPP_DIR / "assets")), name="webapp-assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Registered last, so every API/tracking route above already had first
        # crack at matching. Still guard the API prefix explicitly so a typo'd
        # API path 404s instead of silently returning the SPA shell.
        if full_path.startswith(("api/", "js/", "static/", "assets/")):
            raise HTTPException(status_code=404)
        return FileResponse(WEBAPP_DIR / "index.html")
