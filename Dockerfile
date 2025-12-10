# Build stage for frontend
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install ALL dependencies (including devDependencies for building)
RUN npm ci
RUN cd frontend && npm ci

# Copy application code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Production image - use linuxserver's ffmpeg which has full NVENC support
FROM linuxserver/ffmpeg:latest AS ffmpeg

# Final production image
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Copy ffmpeg from linuxserver image
COPY --from=ffmpeg /usr/local/bin/ff* /usr/local/bin/
COPY --from=ffmpeg /usr/local/lib /usr/local/lib

# Install Node.js and runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    python3 \
    make \
    g++ \
    libgomp1 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && ldconfig

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend from builder
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy backend source
COPY src ./src

# Create data directory
RUN mkdir -p /app/data

ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

EXPOSE 3000

CMD ["node", "src/index.js"]
