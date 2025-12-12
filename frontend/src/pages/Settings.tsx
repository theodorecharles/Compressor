import React, { useState, useEffect } from 'react';
import { getEncodingSettings, updateEncodingSettings } from '../api/client';
import type { EncodingSettings } from '../types';

export default function Settings(): React.ReactElement {
  const [settings, setSettings] = useState<EncodingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [scale4kTo1080p, setScale4kTo1080p] = useState(true);
  const [bitrateFactor, setBitrateFactor] = useState('0.5');
  const [bitrateCap1080p, setBitrateCap1080p] = useState('6');
  const [bitrateCap720p, setBitrateCap720p] = useState('3');
  const [bitrateCapOther, setBitrateCapOther] = useState('3');
  const [minFileSizeMb, setMinFileSizeMb] = useState('500');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings(): Promise<void> {
    try {
      const data = await getEncodingSettings();
      setSettings(data);
      setScale4kTo1080p(data.scale_4k_to_1080p);
      setBitrateFactor(data.bitrate_factor.toString());
      setBitrateCap1080p(data.bitrate_cap_1080p.toString());
      setBitrateCap720p(data.bitrate_cap_720p.toString());
      setBitrateCapOther(data.bitrate_cap_other.toString());
      setMinFileSizeMb(data.min_file_size_mb.toString());
    } catch (err) {
      setError('Failed to load settings: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(): Promise<void> {
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const factor = parseFloat(bitrateFactor);
      const cap1080p = parseFloat(bitrateCap1080p);
      const cap720p = parseFloat(bitrateCap720p);
      const capOther = parseFloat(bitrateCapOther);
      const minSize = parseInt(minFileSizeMb, 10);

      // Validation
      if (isNaN(factor) || factor <= 0 || factor > 1) {
        throw new Error('Bitrate factor must be between 0 and 1 (e.g., 0.5 for 50%)');
      }
      if (isNaN(cap1080p) || cap1080p <= 0) {
        throw new Error('1080p bitrate cap must be a positive number');
      }
      if (isNaN(cap720p) || cap720p <= 0) {
        throw new Error('720p bitrate cap must be a positive number');
      }
      if (isNaN(capOther) || capOther <= 0) {
        throw new Error('Other resolution bitrate cap must be a positive number');
      }
      if (isNaN(minSize) || minSize < 0) {
        throw new Error('Minimum file size must be 0 or greater');
      }

      const data = await updateEncodingSettings({
        scale_4k_to_1080p: scale4kTo1080p,
        bitrate_factor: factor,
        bitrate_cap_1080p: cap1080p,
        bitrate_cap_720p: cap720p,
        bitrate_cap_other: capOther,
        min_file_size_mb: minSize,
      });

      setSettings(data);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset(): void {
    if (settings) {
      setScale4kTo1080p(settings.scale_4k_to_1080p);
      setBitrateFactor(settings.bitrate_factor.toString());
      setBitrateCap1080p(settings.bitrate_cap_1080p.toString());
      setBitrateCap720p(settings.bitrate_cap_720p.toString());
      setBitrateCapOther(settings.bitrate_cap_other.toString());
      setMinFileSizeMb(settings.min_file_size_mb.toString());
      setError(null);
      setSuccess(null);
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Encoding Settings</h1>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Resolution Scaling */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Resolution Scaling</h2>
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={scale4kTo1080p}
              onChange={(e) => setScale4kTo1080p(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-neutral-600 bg-neutral-700 text-green-500 focus:ring-green-500"
            />
            <div>
              <span className="font-medium">Scale 4K videos to 1080p</span>
              <p className="text-neutral-400 text-sm mt-1">
                Automatically downscale 4K (2160p) content to 1080p during encoding.
                This significantly reduces file sizes while maintaining good quality for most displays.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Bitrate Settings */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Bitrate Settings</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Bitrate Factor
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={bitrateFactor}
                onChange={(e) => setBitrateFactor(e.target.value)}
                min="0.1"
                max="1"
                step="0.1"
                className="input w-32"
              />
              <span className="text-neutral-400">
                ({Math.round(parseFloat(bitrateFactor || '0') * 100)}% of original bitrate)
              </span>
            </div>
            <p className="text-neutral-400 text-sm mt-1">
              Target bitrate as a fraction of the original. HEVC typically achieves similar quality
              at ~50% (0.5) of H.264 bitrates. Lower values = smaller files, potentially lower quality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                1080p Bitrate Cap (Mbps)
              </label>
              <input
                type="number"
                value={bitrateCap1080p}
                onChange={(e) => setBitrateCap1080p(e.target.value)}
                min="1"
                max="50"
                step="0.5"
                className="input w-full"
              />
              <p className="text-neutral-400 text-sm mt-1">
                Max bitrate for 1080p content and downscaled 4K.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                720p Bitrate Cap (Mbps)
              </label>
              <input
                type="number"
                value={bitrateCap720p}
                onChange={(e) => setBitrateCap720p(e.target.value)}
                min="0.5"
                max="20"
                step="0.5"
                className="input w-full"
              />
              <p className="text-neutral-400 text-sm mt-1">
                Max bitrate for 720p and lower resolution content.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Other Bitrate Cap (Mbps)
              </label>
              <input
                type="number"
                value={bitrateCapOther}
                onChange={(e) => setBitrateCapOther(e.target.value)}
                min="0.5"
                max="20"
                step="0.5"
                className="input w-full"
              />
              <p className="text-neutral-400 text-sm mt-1">
                Max bitrate for other resolutions (between 720p and 1080p).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* File Filtering */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">File Filtering</h2>
        <div>
          <label className="block text-sm font-medium mb-2">
            Minimum File Size (MB)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={minFileSizeMb}
              onChange={(e) => setMinFileSizeMb(e.target.value)}
              min="0"
              max="100000"
              step="100"
              className="input w-32"
            />
            <span className="text-neutral-400">MB</span>
          </div>
          <p className="text-neutral-400 text-sm mt-1">
            Files smaller than this will be skipped during scanning. Set to 0 to process all files.
            Useful for skipping small clips, trailers, or already-compressed content.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="btn btn-secondary disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {/* Info Box */}
      <div className="card bg-neutral-800/50 border border-neutral-700">
        <h3 className="font-medium mb-2">About Encoding Settings</h3>
        <ul className="text-neutral-400 text-sm space-y-2">
          <li>
            <strong>Bitrate Factor:</strong> The target bitrate is calculated as (original bitrate x factor).
            For example, a 20 Mbps file with factor 0.5 targets 10 Mbps.
          </li>
          <li>
            <strong>Bitrate Caps:</strong> After applying the factor, the bitrate is capped based on resolution.
            This prevents unnecessarily high bitrates for lower resolution content.
          </li>
          <li>
            <strong>4K Scaling:</strong> When enabled, 4K content is downscaled to 1080p and uses the 1080p
            bitrate cap, which typically results in 70-80% space savings.
          </li>
          <li>
            <strong>Changes apply to new encodes only.</strong> Files currently in the queue or already
            processed are not affected.
          </li>
        </ul>
      </div>
    </div>
  );
}
