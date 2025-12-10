FROM jrottenberg/ffmpeg:6.1-nvidia2204 AS ffmpeg

FROM node:20-slim

# Copy ffmpeg binaries from ffmpeg image
COPY --from=ffmpeg /usr/local /usr/local

# Install runtime dependencies for ffmpeg
RUN apt-get update && apt-get install -y \
    libva-drm2 \
    libva2 \
    libvdpau1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci --only=production
RUN cd frontend && npm ci --only=production && npm run build

# Copy application code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "src/index.js"]
