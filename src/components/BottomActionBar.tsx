import { ArchiveIcon, ShareIcon, TrashIcon } from './icons';

interface BottomActionBarProps {
  count: number;
  onDelete: () => void;
  onArchive: () => void;
  onShare: () => void;
}

export default function BottomActionBar({ count, onDelete, onArchive, onShare }: BottomActionBarProps) {
  return (
    <div className="action-bar">
      <span className="action-count">{count}</span>
      <button type="button" className="action-btn danger" onClick={onDelete} aria-label="Delete">
        <TrashIcon size={18} />
      </button>
      <button type="button" className="action-btn pill" onClick={onArchive}>
        <ArchiveIcon size={16} />
        Archive
      </button>
      <button type="button" className="action-btn pill accent" onClick={onShare}>
        <ShareIcon size={16} />
        Share
      </button>
      <style>{`
        .action-bar {
          position: fixed;
          left: 50%;
          bottom: max(16px, env(safe-area-inset-bottom));
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          border-radius: var(--radius-pill);
          background: rgba(23, 23, 26, 0.95);
          backdrop-filter: blur(18px);
          border: 1px solid var(--surface-border);
          box-shadow: var(--shadow-card);
          z-index: 45;
          width: calc(100% - 32px);
          max-width: 448px;
          animation: slideUp 0.25s var(--ease-out) both;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .action-count {
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--bg-elevated-2);
          font-size: 13px;
          font-weight: 700;
        }
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 34px;
          border-radius: var(--radius-pill);
          font-size: 13px;
          font-weight: 650;
          color: var(--text-primary);
        }
        .action-btn.danger {
          width: 34px;
          flex-shrink: 0;
          background: rgba(255, 107, 107, 0.14);
          color: var(--danger);
        }
        .action-btn.pill {
          flex: 1;
          background: var(--bg-elevated-2);
          padding: 0 14px;
        }
        .action-btn.pill.accent {
          background: var(--accent);
          color: var(--accent-ink);
        }
      `}</style>
    </div>
  );
}
