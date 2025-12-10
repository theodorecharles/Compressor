export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '-';
  return `${parseFloat(value).toFixed(1)}%`;
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
}

export function formatDuration(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

export function truncatePath(path, maxLength = 50) {
  if (!path || path.length <= maxLength) return path;
  const parts = path.split('/');
  const filename = parts.pop();
  if (filename.length >= maxLength) {
    return '...' + filename.slice(-maxLength + 3);
  }
  let result = filename;
  for (let i = parts.length - 1; i >= 0; i--) {
    const newResult = parts[i] + '/' + result;
    if (newResult.length > maxLength - 3) {
      return '.../' + result;
    }
    result = newResult;
  }
  return result;
}
