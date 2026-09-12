FROM python:3.12-slim

WORKDIR /app
COPY apps/mavlink-adapter/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/mavlink-adapter/ ./apps/mavlink-adapter/
COPY packages/contracts/ ./packages/contracts/
ENV PYTHONUNBUFFERED=1
# Docker use requires MAVSDK_SYSTEM_ADDRESS to point at a reachable UDP MAVLink endpoint.
CMD ["python", "apps/mavlink-adapter/main.py"]
