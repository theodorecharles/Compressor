FROM jrottenberg/ffmpeg:6.1-nvidia2204 AS ffmpeg

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

# Production image
FROM node:20-slim

# Copy ffmpeg binaries from ffmpeg image
COPY --from=ffmpeg /usr/local /usr/local

# Install runtime dependencies for ffmpeg and build tools for better-sqlite3
RUN apt-get update && apt-get install -y \
    libva-drm2 \
    libva2 \
    libvdpau1 \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

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

EXPOSE 3000

CMD ["node", "src/index.js"]
