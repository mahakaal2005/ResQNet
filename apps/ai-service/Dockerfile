FROM python:3.11-slim

WORKDIR /app

# Install dependencies before application source to preserve Docker's layer cache.
COPY apps/ai-service/requirements.txt ./requirements.txt
# Use CPU-only PyTorch wheels. The default PyPI wheel is much larger and can
# time out on an ordinary demo connection; this service does not configure GPU
# access in Compose.
RUN pip install --no-cache-dir --timeout 600 --retries 5 \
    --index-url https://download.pytorch.org/whl/cpu \
    torch==2.5.1+cpu torchvision==0.20.1+cpu
RUN pip install --no-cache-dir --timeout 600 --retries 5 -r requirements.txt

COPY apps/ai-service/ ./

ENV PYTHONUNBUFFERED=1
EXPOSE 8001

CMD ["uvicorn", "src.detection.app:app", "--app-dir", "src/detection", "--host", "0.0.0.0", "--port", "8001"]
