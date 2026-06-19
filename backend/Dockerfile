FROM python:3.11-slim

# System deps for sentence-transformers / torch
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download small embedder + reranker weights at build time so the
# worker doesn't fetch on first request (offline-friendly for HK users)
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; \
    SentenceTransformer('BAAI/bge-small-en-v1.5'); \
    CrossEncoder('BAAI/bge-reranker-base')" || echo "weight download skipped"

COPY . .

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TRANSFORMERS_CACHE=/root/.cache/huggingface

EXPOSE 8000

# Default command overridden by docker-compose for api-server vs worker
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
