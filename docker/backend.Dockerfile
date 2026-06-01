FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# libgomp is needed by onnxruntime. build-essential is needed because the
# insightface PyPI package has no aarch64 wheel and compiles a C++ extension.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libgomp1 build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the InsightFace buffalo_l model so the kiosk never stalls on first frame.
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=-1, det_size=(640,640))"

COPY backend/ .

RUN chmod +x entrypoint.sh

EXPOSE 8000
CMD ["./entrypoint.sh"]
