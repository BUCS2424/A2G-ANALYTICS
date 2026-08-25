# Single-container build for the VM Fusion Pro Panel's `git` deploy path:
# it runs `docker build -t fusion-<name>:latest .` from this repo's root with
# no custom Dockerfile path and no build args, so both the frontend and
# backend have to come out of this one file. Frontend is built to static
# assets and served by the same FastAPI process as the API, on one port —
# see CONTAINER_CONTRACT.md's networking section for why that matters (the
# panel maps one hostPort:containerPort pair per container).

# ---- Stage 1: build the Vite frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend runtime, serving the built frontend ----
FROM python:3.12-slim AS runtime
WORKDIR /app

# Without this, Python buffers stdout when it isn't a TTY (always true in a
# container), so boot logs — including the panel-required "SERVER IS LIVE"
# line — don't actually reach `docker logs` until something else flushes the
# buffer (e.g. the first request). Diagnosing a hung boot needs it immediate.
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/static ./static
COPY backend/geoip ./geoip
COPY --from=frontend-build /app/frontend/dist ./webapp

# Fixed internal port — tell whoever sets up the deploy's port mapping to use
# this as the containerPort (see CONTAINER_CONTRACT.md §1).
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
