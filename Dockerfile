# Build stage for frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy frontend package files and install dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy frontend source and build
COPY frontend ./frontend
RUN cd frontend && npm run build

# Build stage for backend
FROM node:20-slim AS backend-builder

WORKDIR /app

# Copy package files and install all dependencies (including dev for TypeScript)
COPY package*.json ./
RUN npm ci

# Copy tsconfig and source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Runtime stage
FROM nvidia/cuda:12.6.3-runtime-ubuntu24.04

# Install system dependencies and ffmpeg with NVIDIA support
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    npm cache clean --force

# Create app directory
WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built backend from builder stage
COPY --from=backend-builder /app/dist ./dist

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directory
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,video,utility

EXPOSE 3000

CMD ["node", "dist/index.js"]
