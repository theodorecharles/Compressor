import React from 'react';
import type { FileStatus } from '../types';

interface StatusBadgeProps {
  status: FileStatus;
}

const statusClasses: Record<FileStatus, string> = {
  queued: 'badge-queued',
  encoding: 'badge-encoding',
  finished: 'badge-finished',
  skipped: 'badge-skipped',
  excluded: 'badge-excluded',
  errored: 'badge-errored',
  rejected: 'badge-rejected',
};

export default function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  return (
    <span className={`badge ${statusClasses[status] || 'bg-slate-600'}`}>
      {status}
    </span>
  );
}
