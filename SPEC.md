# HEVC Media Transcoder - Technical Specification

## Overview

A Docker-based media transcoding application that leverages NVIDIA GPU hardware acceleration to compress video files to HEVC/H.265 format. Designed to run on Unraid servers with a Node.js backend and web-based dashboard for monitoring and management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Container                          │
│                     (runtime=nvidia)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Web Frontend  │  │  Node.js API    │  │  FFmpeg Worker  │  │
│  │   (React/Vue)   │◄─►│  (Express)      │◄─►│  (NVENC/NVDEC) │  │
│  └─────────────────┘  └────────┬────────┘  └─────────────────┘  │
│                                │                                 │
│                       ┌────────▼────────┐                       │
│                       │   SQLite DB     │                       │
│                       │  (files, libs,  │                       │
│                       │   stats, logs)  │                       │
│                       └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Mounted Volumes     │
                    │  /media/movies        │
                    │  /media/tv            │
                    │  /media/...           │
                    └───────────────────────┘
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Docker with `--runtime=nvidia` |
| Backend | Node.js (Express.js) |
| Frontend | React + Vite |
| Database | SQLite3 |
| Transcoding | FFmpeg with NVENC/NVDEC |
| File Watching | chokidar (Node.js) |
| Charts | Chart.js or Recharts |

---

## Docker Configuration

### Required Environment Variables

```yaml
environment:
  - NVIDIA_VISIBLE_DEVICES=all
  - NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  hevc-transcoder:
    build: .
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
      - NODE_ENV=production
      - TZ=America/New_York
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data          # SQLite DB + config
      - /mnt/user/media:/media    # Media libraries (adjust to your Unraid paths)
    restart: unless-stopped
```

### Dockerfile Base

```dockerfile
FROM node:20-slim

# Install FFmpeg with NVIDIA support
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Note: FFmpeg in container must be built with --enable-nvenc --enable-nvdec
# or use linuxserver/ffmpeg or jrottenberg/ffmpeg:nvidia images as base
```

---

## Database Schema (SQLite)

### Table: `libraries`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| name | TEXT NOT NULL | Display name (e.g., "Movies") |
| path | TEXT NOT NULL UNIQUE | Absolute path to library folder |
| enabled | BOOLEAN DEFAULT 1 | Whether to process this library |
| watch_enabled | BOOLEAN DEFAULT 1 | Enable file watching for new files |
| created_at | DATETIME | Timestamp when added |
| updated_at | DATETIME | Timestamp when last modified |

### Table: `exclusions`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| library_id | INTEGER FK NULL | Reference to libraries table (NULL = global exclusion) |
| pattern | TEXT NOT NULL | Folder path or glob pattern to exclude |
| type | TEXT NOT NULL | Type: 'folder' (exact path) or 'pattern' (glob/regex) |
| reason | TEXT | Optional note explaining why excluded (e.g., "Keep original Frasier quality") |
| created_at | DATETIME | Timestamp when added |

**Exclusion Types:**
- `folder`: Exact folder path match (e.g., `/media/tv/Frasier`)
- `pattern`: Glob pattern match (e.g., `*/Frasier/*`, `**/4K/**`)

**Scope:**
- If `library_id` is set: Exclusion only applies to that library
- If `library_id` is NULL: Global exclusion applies to all libraries

### Table: `files`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| library_id | INTEGER FK | Reference to libraries table |
| file_path | TEXT NOT NULL UNIQUE | Absolute path to video file |
| file_name | TEXT NOT NULL | Filename only |
| original_codec | TEXT | Original video codec (e.g., "h264", "mpeg4") |
| original_bitrate | INTEGER | Original video bitrate in bps (nullable) |
| original_size | INTEGER | Original file size in bytes |
| original_width | INTEGER | Original video width in pixels |
| original_height | INTEGER | Original video height in pixels |
| is_hdr | BOOLEAN DEFAULT 0 | Whether source is HDR content |
| new_size | INTEGER | New file size after encoding (nullable) |
| status | TEXT NOT NULL | Status enum (see below) |
| skip_reason | TEXT | Why file was skipped (e.g., "Already HEVC", "Under 500MB", "Excluded") |
| error_message | TEXT | Error details if status is 'errored' |
| started_at | DATETIME | When encoding started |
| completed_at | DATETIME | When encoding finished |
| created_at | DATETIME | When file was discovered |
| updated_at | DATETIME | Last status update |

### Status Enum Values

| Status | Description |
|--------|-------------|
| `queued` | Waiting to be processed |
| `encoding` | Currently being transcoded |
| `finished` | Successfully transcoded, original replaced, file is smaller |
| `skipped` | Already HEVC/H.265, no action needed |
| `excluded` | File is in an excluded folder/matches exclusion pattern |
| `errored` | Transcoding failed (see error_message) |
| `rejected` | Output was larger than original, kept original |

### Table: `stats`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| date | DATE UNIQUE | Date of stats snapshot |
| total_files_processed | INTEGER | Cumulative files processed |
| total_space_saved | INTEGER | Cumulative bytes saved |
| files_finished | INTEGER | Files successfully transcoded |
| files_skipped | INTEGER | Files already HEVC |
| files_rejected | INTEGER | Files where output was larger |
| files_errored | INTEGER | Files that failed |

### Table: `encoding_log`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| file_id | INTEGER FK | Reference to files table |
| event | TEXT | Event type (started, progress, completed, error) |
| details | TEXT | JSON blob with event details |
| created_at | DATETIME | Timestamp |

---

## FFmpeg Transcoding Strategy

### Output Format

All transcoded files are output as **MKV** (Matroska) regardless of input format. MKV supports all codecs, multiple audio/subtitle tracks, and is widely compatible.

### Resolution Scaling

- **4K (2160p) content**: Scale down to 1080p
- **1080p and below**: Keep original resolution

### HDR Handling

- **HDR content is converted to SDR** using tonemapping
- This simplifies encoding and ensures broad device compatibility

### Minimum File Size

- **Files under 500MB are skipped** (not worth processing time)
- These files are marked with status `skipped` and reason stored

### Bitrate Strategy

1. **Primary**: Target bitrate = original bitrate / 2
2. **Fallback**: If bitrate cannot be detected, use CRF 24 (good quality/size balance for HEVC)

### Primary Command (NVDEC + NVENC - Full Hardware, SDR, 1080p)

```bash
# For 4K HDR content - full processing
ffmpeg -hwaccel cuda -hwaccel_output_format cuda \
  -i "input.mkv" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,tonemap=hable,format=yuv420p" \
  -c:v hevc_nvenc \
  -preset p4 \
  -b:v {ORIGINAL_BITRATE / 2} \
  -c:a copy \
  -c:s copy \
  -map 0 \
  "output.mkv"

# For 4K SDR content - scale only
ffmpeg -hwaccel cuda -hwaccel_output_format cuda \
  -i "input.mkv" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease" \
  -c:v hevc_nvenc \
  -preset p4 \
  -b:v {ORIGINAL_BITRATE / 2} \
  -c:a copy \
  -c:s copy \
  -map 0 \
  "output.mkv"

# For 1080p or lower - no scaling
ffmpeg -hwaccel cuda -hwaccel_output_format cuda \
  -i "input.mkv" \
  -c:v hevc_nvenc \
  -preset p4 \
  -b:v {ORIGINAL_BITRATE / 2} \
  -c:a copy \
  -c:s copy \
  -map 0 \
  "output.mkv"
```

### Fallback Command (CPU Decode + NVENC)

Same as above but without `-hwaccel cuda -hwaccel_output_format cuda` flags.

### CRF Fallback (When Bitrate Unknown)

Replace `-b:v {BITRATE}` with `-crf 24 -maxrate 8M -bufsize 16M`

```bash
ffmpeg -hwaccel cuda -hwaccel_output_format cuda \
  -i "input.mkv" \
  -c:v hevc_nvenc \
  -preset p4 \
  -crf 24 -maxrate 8M -bufsize 16M \
  -c:a copy \
  -c:s copy \
  -map 0 \
  "output.mkv"
```

### Transcoding Rules

1. **File Size Check**: If file < 500MB, mark as `skipped`
2. **Codec Detection**: Use `ffprobe` to detect current video codec
3. **Skip Condition**: If codec is `hevc` or `h265`, mark as `skipped`
4. **Resolution Detection**: Check if 4K (width >= 3840 or height >= 2160)
5. **HDR Detection**: Check for HDR metadata (color_transfer, color_primaries)
6. **Bitrate Detection**: Get original bitrate, use CRF 24 as fallback
7. **Build FFmpeg Command**: Select appropriate filter chain based on resolution/HDR
8. **Stream Preservation**:
   - `-c:a copy` - Copy all audio tracks unchanged
   - `-c:s copy` - Copy all subtitle tracks unchanged
   - `-map 0` - Include all streams from input
9. **Output Validation**: Compare output size to input size
   - If output >= input: Delete output, mark as `rejected`
   - If output < input: Delete original, rename output to `.mkv`, mark as `finished`

### FFprobe Command for Metadata

```bash
ffprobe -v quiet -print_format json -show_format -show_streams "input.mkv"
```

Extract:
- `streams[?(@.codec_type=='video')].codec_name` → original codec
- `streams[?(@.codec_type=='video')].bit_rate` → original bitrate
- `streams[?(@.codec_type=='video')].width` → video width
- `streams[?(@.codec_type=='video')].height` → video height
- `streams[?(@.codec_type=='video')].color_transfer` → HDR indicator (e.g., "smpte2084" for HDR10)
- `streams[?(@.codec_type=='video')].color_primaries` → Color space (e.g., "bt2020" for HDR)
- `format.size` → original file size

---

## API Endpoints

### Libraries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/libraries` | List all libraries |
| POST | `/api/libraries` | Add new library |
| PUT | `/api/libraries/:id` | Update library settings |
| DELETE | `/api/libraries/:id` | Remove library |
| POST | `/api/libraries/:id/scan` | Trigger manual scan of library |

### Exclusions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exclusions` | List all exclusions (global + per-library) |
| GET | `/api/exclusions?library_id=:id` | List exclusions for specific library |
| POST | `/api/exclusions` | Add new exclusion |
| PUT | `/api/exclusions/:id` | Update exclusion |
| DELETE | `/api/exclusions/:id` | Remove exclusion |
| POST | `/api/exclusions/check` | Check if a path would be excluded (for testing) |

**POST /api/exclusions Body:**
```json
{
  "library_id": null,           // null for global, or library ID
  "pattern": "/media/tv/Frasier",
  "type": "folder",             // "folder" or "pattern"
  "reason": "Keep original quality"
}
```

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files` | List files with pagination/filtering |
| GET | `/api/files/:id` | Get file details |
| POST | `/api/files/:id/retry` | Retry errored file |
| POST | `/api/files/:id/skip` | Manually skip a file |

### Queue

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/queue` | Get current queue status |
| GET | `/api/queue/current` | Get currently encoding file + progress |
| POST | `/api/queue/pause` | Pause encoding queue |
| POST | `/api/queue/resume` | Resume encoding queue |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get overall statistics |
| GET | `/api/stats/history` | Get historical stats for charts |
| GET | `/api/stats/space-saved` | Get space saved over time data |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/health` | Health check |
| GET | `/api/system/gpu` | GPU status and utilization |

---

## Frontend Dashboard

### Pages/Views

#### 1. Dashboard (Home)
- **Current Status Card**: Shows currently encoding file with progress bar
- **Quick Stats Cards**:
  - Total files in database
  - Files queued
  - Files completed
  - Total space saved (formatted as GB/TB)
- **Space Saved Over Time**: Line chart showing cumulative savings by date
- **Recent Activity**: List of recently processed files with status badges

#### 2. Libraries
- **Library List**: Table of all configured libraries
  - Name, Path, File Count, Enabled toggle, Watch toggle
  - Actions: Edit, Delete, Scan Now
- **Add Library Modal**: Form to add new library path
- **Per-Library Exclusions**: View/manage exclusions specific to each library

#### 3. Exclusions
- **Global Exclusions List**: Patterns/folders excluded across all libraries
- **Per-Library Exclusions**: Grouped by library
- **Add Exclusion Modal**:
  - Scope selector: Global or specific library
  - Type: Folder path or glob pattern
  - Pattern input with validation
  - Reason/note field (optional)
  - Preview: Shows which existing files would be affected
- **Quick Actions**:
  - "Exclude this folder" button available in file browser
  - Bulk exclude from file list selection

#### 4. Files
- **File Browser**: Paginated table with filters
  - Columns: Filename, Library, Original Size, New Size, Savings %, Status, Actions
  - Filters: By status, by library
  - Search: By filename
- **File Detail Modal**: Full metadata and encoding log

#### 5. Queue
- **Currently Encoding**: Large card with file info and real-time progress
- **Queue List**: Ordered list of pending files
- **Controls**: Pause/Resume buttons

#### 6. Settings
- **General Settings**:
  - Encoding preset selection
  - Target bitrate multiplier (default 0.5)
  - Concurrent encode limit (usually 1 for GPU)
- **Scan Settings**:
  - File extensions to include (default: .mkv, .mp4, .avi, .mov, .wmv)
  - Scan interval / watch mode toggle

---

## File Watching

### Implementation with chokidar

```javascript
const chokidar = require('chokidar');

// Watch each library path
libraries.forEach(lib => {
  if (lib.watch_enabled) {
    chokidar.watch(lib.path, {
      ignored: /(^|[\/\\])\../,  // ignore dotfiles
      persistent: true,
      ignoreInitial: true,       // don't fire for existing files
      awaitWriteFinish: {
        stabilityThreshold: 5000, // wait for file to finish writing
        pollInterval: 1000
      }
    }).on('add', filePath => {
      // Check if video file extension
      // Add to database as 'queued'
    });
  }
});
```

### Supported Video Extensions

```
.mkv, .mp4, .avi, .mov, .wmv, .flv, .webm, .m4v, .mpeg, .mpg, .ts
```

---

## Startup Sequence

1. **Initialize Database**: Create tables if not exist
2. **Load Libraries**: Fetch all enabled libraries from DB
3. **Load Exclusions**: Fetch all exclusion patterns (global + per-library)
4. **Scan Libraries**: For each library:
   - Recursively find all video files
   - For each file not in DB:
     - Check against exclusion patterns (global + library-specific)
     - Run ffprobe to get metadata
     - Determine initial status:
       - `excluded` if matches any exclusion pattern
       - `skipped` if already HEVC
       - `queued` otherwise
     - Insert into files table
5. **Re-evaluate Existing Files**: When exclusions change, update affected file statuses
6. **Start File Watchers**: Initialize chokidar for watch-enabled libraries
7. **Start Web Server**: Launch Express API + serve frontend
8. **Start Encoding Worker**: Begin processing queue

---

## Exclusion Matching Logic

### Matching Algorithm

```javascript
function isExcluded(filePath, libraryId, exclusions) {
  for (const exclusion of exclusions) {
    // Check if exclusion applies (global or matching library)
    if (exclusion.library_id !== null && exclusion.library_id !== libraryId) {
      continue;
    }

    if (exclusion.type === 'folder') {
      // Exact folder match - file path starts with exclusion pattern
      if (filePath.startsWith(exclusion.pattern)) {
        return { excluded: true, reason: exclusion.reason, pattern: exclusion.pattern };
      }
    } else if (exclusion.type === 'pattern') {
      // Glob pattern match using minimatch or similar
      if (minimatch(filePath, exclusion.pattern)) {
        return { excluded: true, reason: exclusion.reason, pattern: exclusion.pattern };
      }
    }
  }
  return { excluded: false };
}
```

### Example Exclusion Patterns

| Type | Pattern | Matches |
|------|---------|---------|
| folder | `/media/tv/Frasier` | All files under Frasier folder |
| folder | `/media/movies/Star Wars` | All Star Wars movies |
| pattern | `**/4K/**` | Any file in a 4K subfolder |
| pattern | `**/*Remux*` | Any file with "Remux" in the name |
| pattern | `**/Season 01/*` | First season of any show |

### Exclusion Behavior

- **Adding exclusion**: All matching `queued` files are updated to `excluded`
- **Removing exclusion**: All matching `excluded` files are re-evaluated (may become `queued` or `skipped`)
- **Excluded files**: Still tracked in database but never processed
- **File watcher**: New files in excluded folders are added with status `excluded`

---

## Encoding Worker Logic

```
LOOP forever:
  1. Check if paused → wait and continue
  2. Fetch next file with status='queued' (ORDER BY created_at ASC)
  3. If no file → sleep 10 seconds, continue
  4. Update status to 'encoding', set started_at
  5. Attempt hardware decode + encode (NVDEC + NVENC)
  6. If fails, attempt CPU decode + NVENC
  7. If still fails:
     - Update status to 'errored' with error_message
     - Continue loop
  8. Compare output size to original:
     - If output >= original:
       - Delete output file
       - Update status to 'rejected'
     - If output < original:
       - Delete original file
       - Rename output to original filename
       - Update status to 'finished', set new_size
  9. Update completed_at timestamp
  10. Update daily stats
  11. Continue loop
```

---

## Project Structure

```
hevc-transcoder/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── README.md
├── SPEC.md
├── data/                    # Mounted volume for persistence
│   └── transcoder.db        # SQLite database
├── src/
│   ├── index.js             # Application entry point
│   ├── config.js            # Configuration management
│   ├── db/
│   │   ├── index.js         # Database connection
│   │   ├── migrations.js    # Schema setup
│   │   └── queries.js       # SQL query helpers
│   ├── api/
│   │   ├── index.js         # Express app setup
│   │   ├── routes/
│   │   │   ├── libraries.js
│   │   │   ├── exclusions.js
│   │   │   ├── files.js
│   │   │   ├── queue.js
│   │   │   ├── stats.js
│   │   │   └── system.js
│   │   └── middleware/
│   │       └── errorHandler.js
│   ├── services/
│   │   ├── scanner.js       # Library scanning logic
│   │   ├── watcher.js       # File watching with chokidar
│   │   ├── encoder.js       # FFmpeg transcoding logic
│   │   ├── ffprobe.js       # Media metadata extraction
│   │   └── stats.js         # Statistics calculations
│   └── worker/
│       └── encoder.js       # Background encoding worker
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/              # API client
        ├── components/
        │   ├── Dashboard/
        │   ├── Libraries/
        │   ├── Exclusions/
        │   ├── Files/
        │   ├── Queue/
        │   └── Settings/
        ├── pages/
        └── hooks/
```

---

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Web server port |
| `DB_PATH` | /app/data/transcoder.db | SQLite database path |
| `FFMPEG_PATH` | ffmpeg | Path to ffmpeg binary |
| `FFPROBE_PATH` | ffprobe | Path to ffprobe binary |
| `BITRATE_MULTIPLIER` | 0.5 | Target bitrate as fraction of original |
| `NVENC_PRESET` | p4 | NVENC encoding preset (p1-p7) |
| `SCAN_INTERVAL` | 3600 | Seconds between full library scans (0 to disable) |
| `LOG_LEVEL` | info | Logging verbosity |

---

## Error Handling

### Transcoding Errors to Handle

1. **GPU Memory Full**: Retry with CPU decode
2. **Unsupported Codec for NVDEC**: Fall back to CPU decode
3. **Corrupt Input File**: Mark as errored, log details
4. **Disk Full**: Pause queue, alert in UI
5. **File Permissions**: Log error, skip file
6. **FFmpeg Crash**: Capture stderr, mark as errored

### Recovery Mechanisms

- On startup, reset any files with status `encoding` back to `queued`
- Provide manual retry option for errored files
- Keep original file until new file is verified smaller

---

## CI/CD - GitHub Actions

### Workflow: Docker Build & Push

**File: `.github/workflows/docker-publish.yml`**

```yaml
name: Build and Push Docker Image

on:
  push:
    branches:
      - master
      - devel

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    environment: ${{ github.ref == 'refs/heads/master' && 'Latest' || 'Dev' }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Determine tag
        id: tag
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/master" ]]; then
            echo "tag=latest" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/devel" ]]; then
            echo "tag=dev" >> $GITHUB_OUTPUT
          fi

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: tedcharles/compressor:${{ steps.tag.outputs.tag }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Your DockerHub username |
| `DOCKERHUB_TOKEN` | DockerHub access token (not password) |

### Branch Strategy

| Branch | Docker Tag | Purpose |
|--------|------------|---------|
| `master` | `:latest` | Stable production releases |
| `devel` | `:dev` | Development/testing builds |

---

## Future Enhancements (Out of Scope for v1)

- Multiple encoding profiles per library
- AV1 encoding support
- Audio transcoding options
- Notification webhooks (Discord, email)
- Multi-GPU support with load balancing
- Thumbnail generation
- Quality comparison screenshots
- Scheduled encoding windows (encode only at night)
- Dry run mode (estimate savings without encoding)
- Priority queue for libraries/files
- Backup mode (move originals instead of delete)
