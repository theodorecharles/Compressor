export default function StatusBadge({ status }) {
  const statusClasses = {
    queued: 'badge-queued',
    encoding: 'badge-encoding',
    finished: 'badge-finished',
    skipped: 'badge-skipped',
    excluded: 'badge-excluded',
    errored: 'badge-errored',
    rejected: 'badge-rejected',
  };

  return (
    <span className={`badge ${statusClasses[status] || 'bg-slate-600'}`}>
      {status}
    </span>
  );
}
