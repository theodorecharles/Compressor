# Compressor

A Docker-based media transcoding application that uses NVIDIA GPU hardware acceleration to compress video files to HEVC/H.265 format. Designed for home media servers (especially Unraid) to reduce storage usage while maintaining quality.

![Dashboard Screenshot](compressor_icon.png)

## Features

- **NVIDIA GPU Acceleration**: Uses NVENC/NVDEC for fast hardware-accelerated transcoding
- **Automatic Library Scanning**: Monitors media folders and automatically queues new files
- **Smart Transcoding**:
  - Converts to HEVC/H.265 with ~50% bitrate reduction
  - Downscales 4K content to 1080p
  - Converts HDR to SDR for broader compatibility
  - Skips files already in HEVC format
  - Rejects encodes that are larger than the original
- **Exclusion Patterns**: Skip specific folders or file patterns (e.g., keep "Remux" files untouched)
- **Web Dashboard**: Real-time monitoring with encoding progress, statistics, and space savings charts
- **File Watching**: Automatically detects and queues new files added to libraries

## Requirements

- Docker with NVIDIA Container Toolkit (`nvidia-docker`)
- NVIDIA GPU with NVENC support (GTX 10xx series or newer)
- NVIDIA drivers installed on the host

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/tedcharles/compressor.git
   cd compressor
   ```

2. Configure your media volumes in `docker-compose.yml`:
   ```yaml
   volumes:
     - ./data:/app/data
     - /path/to/movies:/media/movies
     - /path/to/tv:/media/tv
   ```

3. Build and start the container:
   ```bash
   docker-compose up -d
   ```

4. Access the web interface at `http://localhost:3000`

5. Add your media libraries through the Libraries page

## Docker Compose

```yaml
version: '3.8'

services:
  compressor:
    image: tedcharles/compressor:latest
    runtime: nvidia
    container_name: compressor
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
      - NODE_ENV=production
      - TZ=America/New_York
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - /mnt/user/media/movies:/media/movies
      - /mnt/user/media/tv:/media/tv
    restart: unless-stopped
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Web server port |
| `DB_PATH` | /app/data/compressor.db | SQLite database path |
| `TZ` | UTC | Container timezone |

## How It Works

1. **Add Libraries**: Point Compressor to your media folders
2. **Scan**: The scanner finds all video files and analyzes them with ffprobe
3. **Queue**: Non-HEVC files over 500MB are queued for transcoding
4. **Encode**: Files are transcoded using NVIDIA hardware acceleration
5. **Validate**: If the new file is smaller, it replaces the original; otherwise, the original is kept

### Transcoding Strategy

- **Target Bitrate**: Original bitrate / 2 (configurable)
- **Fallback**: CRF 24 if bitrate cannot be detected
- **4K Content**: Scaled down to 1080p
- **HDR Content**: Tonemapped to SDR
- **Output Format**: MKV (preserves all audio and subtitle tracks)
- **Minimum File Size**: 500MB (smaller files are skipped)

## Dashboard Pages

- **Dashboard**: Overview with current encoding status, quick stats, and space savings chart
- **Libraries**: Manage media library paths and trigger scans
- **Files**: Browse all files with status, size, and savings information
- **Queue**: View pending files and current encoding progress
- **Exclusions**: Configure folders or patterns to skip
- **Settings**: Adjust encoding quality and other options

## File Statuses

| Status | Description |
|--------|-------------|
| `queued` | Waiting to be processed |
| `encoding` | Currently being transcoded |
| `finished` | Successfully transcoded and saved space |
| `skipped` | Already HEVC or under 500MB |
| `excluded` | Matches an exclusion pattern |
| `rejected` | Output was larger than original |
| `errored` | Transcoding failed |

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, SQLite (better-sqlite3)
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Recharts
- **Transcoding**: FFmpeg with NVENC/NVDEC
- **Container**: NVIDIA CUDA runtime base image

## Development

### Prerequisites

- Node.js 20+
- NVIDIA GPU with drivers installed
- FFmpeg with NVENC support

### Setup

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Build backend
npm run build

# Build frontend
cd frontend && npm run build && cd ..

# Run development server
npm run dev
```

### Project Structure

```
compressor/
├── src/                    # Backend source (TypeScript)
│   ├── api/               # Express routes
│   ├── db/                # SQLite database layer
│   ├── services/          # Core services (scanner, encoder, etc.)
│   └── worker/            # Background encoding worker
├── frontend/              # React frontend
│   └── src/
│       ├── components/    # UI components
│       └── pages/         # Page components
├── data/                  # SQLite database (persisted)
├── Dockerfile
└── docker-compose.yml
```

## Docker Hub

Pre-built images are available:

- `tedcharles/compressor:latest` - Stable release (master branch)
- `tedcharles/compressor:dev` - Development build (devel branch)

## License

MIT
