import { useRef } from 'react';
import type { DocRecord } from '../types';
import { kindIcon, CheckIcon, TrashIcon } from './icons';

interface DocumentRowProps {
  doc: DocRecord;
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onLongPress: () => void;
  onDelete: () => void;
}

function statusLine(doc: DocRecord): string {
  if (doc.status === 'parsing') return 'Reading file…';
  if (doc.status === 'summarizing') return `Converting · ${Math.round(doc.progress * 100)}%`;
  if (doc.status === 'error') return doc.error ? `Failed · ${doc.error}` : 'Failed';
  return `${doc.readingMinutes} min read · ${doc.cardCount} cards`;
}

export default function DocumentRow({
  doc,
  selectMode,
  selected,
  onOpen,
  onToggleSelect,
  onLongPress,
  onDelete,
}: DocumentRowProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout>>();
  const longPressFired = useRef(false);

  return (
    <div
      className={`doc-row${selected ? ' selected' : ''}`}
      onClick={() => {
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        selectMode ? onToggleSelect() : onOpen();
      }}
      onPointerDown={() => {
        longPressFired.current = false;
        pressTimer.current = setTimeout(() => {
          longPressFired.current = true;
          onLongPress();
        }, 420);
      }}
      onPointerUp={() => clearTimeout(pressTimer.current)}
      onPointerLeave={() => clearTimeout(pressTimer.current)}
      role="button"
      tabIndex={0}
    >
      {selectMode && (
        <span className={`doc-check${selected ? ' checked' : ''}`}>
          {selected && <CheckIcon size={12} />}
        </span>
      )}
      <span className={`doc-icon kind-${doc.kind}`}>{kindIcon(doc.kind, { size: 19 })}</span>
      <span className="doc-info">
        <span className="doc-title">{doc.title}</span>
        <span className={`doc-status status-${doc.status}`}>{statusLine(doc)}</span>
      </span>
      {(doc.status === 'parsing' || doc.status === 'summarizing') && (
        <span className="doc-spinner" aria-hidden />
      )}
      {!selectMode && (
        <button
          type="button"
          className="doc-delete"
          aria-label={`Delete ${doc.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <TrashIcon size={16} />
        </button>
      )}
      <style>{`
        .doc-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 10px;
          border-radius: var(--radius-sm);
          transition: background 0.15s var(--ease-out);
          user-select: none;
          -webkit-touch-callout: none;
          touch-action: manipulation;
        }
        .doc-row:hover,
        .doc-row.selected {
          background: var(--bg-elevated);
        }
        .doc-check {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1.5px solid var(--text-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-ink);
        }
        .doc-check.checked {
          background: var(--accent);
          border-color: var(--accent);
        }
        .doc-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated-2);
          color: var(--text-secondary);
        }
        .doc-icon.kind-pdf { color: #ff8a7a; }
        .doc-icon.kind-docx { color: #7ab6ff; }
        .doc-icon.kind-text { color: #b3ff7a; }
        .doc-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .doc-title {
          font-size: 14.5px;
          font-weight: 650;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .doc-status {
          font-size: 12px;
          color: var(--text-tertiary);
        }
        .doc-status.status-error {
          color: var(--danger);
        }
        .doc-spinner {
          flex-shrink: 0;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(215, 255, 61, 0.25);
          border-top-color: var(--accent);
          animation: spin 0.8s linear infinite;
        }
        .doc-delete {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--text-tertiary);
        }
        .doc-delete:hover,
        .doc-delete:active {
          color: var(--danger);
          background: rgba(255, 107, 107, 0.12);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
