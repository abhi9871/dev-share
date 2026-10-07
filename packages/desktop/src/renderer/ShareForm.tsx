import { useCallback, useEffect, useState, type KeyboardEvent, type SubmitEvent } from 'react';

import type {
  AttachmentView,
  ClipboardView,
  DestinationsView,
  IpcError,
  IpcResult,
} from '../shared/ipc.js';
import { AttachmentList } from './AttachmentList.js';
import { DestinationPicker } from './DestinationPicker.js';

type ShareStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent'; readonly destination: string }
  | { readonly kind: 'info'; readonly message: string }
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

  /** Adds clipboard content to the share; text goes after any message already typed. */
  const addClipboardContent = useCallback((clipboard: ClipboardView) => {
    if (clipboard.text !== '') {
      setText((current) => (current === '' ? clipboard.text : `${current}\n${clipboard.text}`));
    }
    const { image } = clipboard;
    if (image) {
      setAttachments((current) => [...current, image]);
    }
  }, []);

  /**
   * Adds a clipboard read to the share. `wanted` is false if the form no longer needs the
   * result by the time it arrives; any attached image is then released again.
   */
  const applyClipboardResult = useCallback(
    (result: IpcResult<ClipboardView>, wanted: boolean) => {
      if (!wanted) {
        if (result.ok && result.value.image) {
          void window.devshare.removeAttachment(result.value.image.id);
        }
        return;
      }
      if (!result.ok) {
        setStatus({ kind: 'error', error: result.error });
      } else if (!isEmpty(result.value)) {
        addClipboardContent(result.value);
        setStatus({ kind: 'info', message: 'Loaded from your clipboard.' });
      }
    },
    [addClipboardContent],
  );

  // Start with whatever was copied, so the usual flow is: copy, open DevShare, press Share.
  // Not when DevShare started hidden at sign-in: what was copied then is stale by the time
  // the user brings it up, which loads the clipboard anyway.
  useEffect(() => {
    let active = true;
    void Promise.all([window.devshare.getLaunchState(), loadsClipboardOnOpen()])
      .then(([launch, wanted]) =>
        wanted && !(launch.ok && launch.value.startedInTray) && active
          ? window.devshare.readClipboard()
          : undefined,
      )
      .then((result) => {
        if (result) {
          applyClipboardResult(result, active);
        }
      });
    return () => {
      active = false;
    };
  }, [applyClipboardResult]);

  // Bringing DevShare up again (shortcut, tray, relaunch) picks up what was copied since,
  // unless there is an unsent draft: that is kept as it is rather than mixed with new content.
  const draftEmpty = text === '' && attachments.length === 0;
  useEffect(
    () =>
      window.devshare.onSummoned(() => {
        if (sending) {
          return;
        }
        void loadsClipboardOnOpen().then(async (wanted) => {
          if (!wanted) {
            return;
          }
          if (draftEmpty) {
            applyClipboardResult(await window.devshare.readClipboard(), true);
          } else {
            setStatus({
              kind: 'info',
              message:
                'Your unsent draft was kept. Use Paste from clipboard to add what you copied.',
            });
          }
        });
      }),
    [draftEmpty, sending, applyClipboardResult],
  );

  async function pasteFromClipboard() {
    const result = await window.devshare.readClipboard();
    if (!result.ok) {
      setStatus({ kind: 'error', error: result.error });
    } else if (isEmpty(result.value)) {
      setStatus({ kind: 'info', message: 'The clipboard has no text or image.' });
    } else {
      addClipboardContent(result.value);
      setStatus({ kind: 'idle' });
    }
  }

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
          <div className="buttons">
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                void pasteFromClipboard();
              }}
            >
              Paste from clipboard
            </button>
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
    case 'info':
      return (
        <p className="status muted" role="status">
          {status.message}
        </p>
      );
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

function isEmpty(clipboard: ClipboardView): boolean {
  return clipboard.text === '' && clipboard.image === undefined;
}

/** Whether the user wants the clipboard loaded when DevShare opens (the default). */
async function loadsClipboardOnOpen(): Promise<boolean> {
  const preferences = await window.devshare.getPreferences();
  return !preferences.ok || preferences.value.loadClipboardOnOpen;
}
