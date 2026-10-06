import { useState, type KeyboardEvent, type SubmitEvent } from 'react';

import type { AttachmentView, DestinationsView, IpcError } from '../shared/ipc.js';
import { AttachmentList } from './AttachmentList.js';
import { DestinationPicker } from './DestinationPicker.js';

type ShareStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent'; readonly destination: string }
  | { readonly kind: 'error'; readonly error: IpcError };

interface ShareFormProps {
  readonly destinations: DestinationsView;
}

export function ShareForm({ destinations }: ShareFormProps) {
  const [destination, setDestination] = useState(destinations.defaultDestination ?? '');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<readonly AttachmentView[]>([]);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<ShareStatus>({ kind: 'idle' });

  const sending = status.kind === 'sending';
  const hasContent = text.trim() !== '' || attachments.length > 0;
  const canShare = !sending && destination !== '' && hasContent;

  async function addFiles() {
    setPicking(true);
    const result = await window.devshare.pickFiles();
    setPicking(false);
    if (result.ok) {
      setAttachments((current) => [...current, ...result.value]);
    } else {
      setStatus({ kind: 'error', error: result.error });
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
    void window.devshare.removeAttachment(id);
  }

  async function share() {
    if (!canShare) {
      return;
    }
    setStatus({ kind: 'sending' });
    const result = await window.devshare.share({
      destination,
      text,
      attachmentIds: attachments.map((attachment) => attachment.id),
    });
    if (result.ok) {
      setText('');
      setAttachments([]);
      setStatus({ kind: 'sent', destination: result.value.destination });
    } else {
      setStatus({ kind: 'error', error: result.error });
    }
  }

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    void share();
  }

  function onMessageKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void share();
    }
  }

  return (
    <form className="share-form" onSubmit={onSubmit}>
      <DestinationPicker
        destinations={destinations.destinations}
        value={destination}
        onChange={setDestination}
      />

      <label className="field">
        <span className="field-label">Message</span>
        <textarea
          value={text}
          rows={8}
          spellCheck={false}
          placeholder="Paste code, logs, or a note"
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={onMessageKeyDown}
        />
      </label>

      <div className="field">
        <div className="field-header">
          <span className="field-label">Files</span>
          <button
            type="button"
            disabled={picking || sending}
            onClick={() => {
              void addFiles();
            }}
          >
            Add files…
          </button>
        </div>
        <AttachmentList attachments={attachments} disabled={sending} onRemove={removeAttachment} />
      </div>

      <div className="actions">
        <ShareStatusMessage status={status} />
        <button type="submit" className="primary" disabled={!canShare}>
          {sending ? 'Sharing…' : 'Share'}
        </button>
      </div>
    </form>
  );
}

function ShareStatusMessage({ status }: { readonly status: ShareStatus }) {
  switch (status.kind) {
    case 'idle':
    case 'sending':
      return <p className="status muted">Ctrl+Enter to share</p>;
    case 'sent':
      return (
        <p className="status success" role="status">
          Shared to {status.destination}.
        </p>
      );
    case 'error':
      return (
        <p className="status error-text" role="alert">
          {status.error.message}
        </p>
      );
  }
}
