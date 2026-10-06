import type { AttachmentView } from '../shared/ipc.js';

interface AttachmentListProps {
  readonly attachments: readonly AttachmentView[];
  readonly disabled: boolean;
  readonly onRemove: (id: string) => void;
}

export function AttachmentList({ attachments, disabled, onRemove }: AttachmentListProps) {
  if (attachments.length === 0) {
    return <p className="muted">No files attached.</p>;
  }
  return (
    <ul className="attachments">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <span className="attachment-name" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="muted">{formatSize(attachment.size)}</span>
          <button
            type="button"
            className="remove"
            disabled={disabled}
            aria-label={`Remove ${attachment.name}`}
            onClick={() => {
              onRemove(attachment.id);
            }}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
