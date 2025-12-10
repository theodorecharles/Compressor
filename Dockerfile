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

# Final production image - use NVIDIA CUDA with Ubuntu 22.04
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, FFmpeg (with NVENC via ubuntu-restricted-extras approach), and build tools
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    software-properties-common \
    python3 \
    make \
    g++ \
    && add-apt-repository ppa:ubuntuhandbook1/ffmpeg6 -y \
    && apt-get update \
    && apt-get install -y ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify ffmpeg is installed
RUN ffmpeg -version && ffprobe -version

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

EXPOSE 3000

CMD ["node", "src/index.js"]
