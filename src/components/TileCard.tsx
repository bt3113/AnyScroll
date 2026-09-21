import type { DocRecord } from '../types';
import { kindIcon } from './icons';

interface TileCardProps {
  doc: DocRecord;
  highlighted?: boolean;
  onClick: () => void;
}

function statusLabel(doc: DocRecord): string {
  if (doc.status === 'parsing') return 'Reading file…';
  if (doc.status === 'summarizing') return `Converting… ${Math.round(doc.progress * 100)}%`;
  if (doc.status === 'error') return 'Failed';
  return `${doc.readingMinutes} min · ${doc.cardCount} cards`;
}

export default function TileCard({ doc, highlighted, onClick }: TileCardProps) {
  const processing = doc.status === 'parsing' || doc.status === 'summarizing';

  return (
    <button
      type="button"
      className={`tile${highlighted ? ' tile-highlight' : ''}`}
      onClick={onClick}
    >
      <span className="tile-bar" />
      <span className="tile-icon">{kindIcon(doc.kind, { size: 20 })}</span>
      <span className="tile-title">{doc.title}</span>
      <span className="tile-meta">{statusLabel(doc)}</span>
      {processing && (
        <span className="tile-progress">
          <span className="tile-progress-fill" style={{ width: `${Math.max(6, doc.progress * 100)}%` }} />
        </span>
      )}
      <style>{`
        .tile {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          padding: 14px;
          min-height: 108px;
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          border: 1px solid var(--surface-border);
          text-align: left;
          overflow: hidden;
          box-shadow: var(--shadow-tile);
          transition: transform 0.15s var(--ease-out), background 0.15s var(--ease-out);
        }
        .tile:active {
          transform: scale(0.97);
        }
        .tile-highlight {
          background: var(--accent);
        }
        .tile-bar {
          position: absolute;
          top: 0;
          left: 14px;
          width: 22px;
          height: 3px;
          border-radius: 0 0 3px 3px;
          background: var(--accent);
        }
        .tile-highlight .tile-bar {
          background: var(--accent-ink);
          opacity: 0.5;
        }
        .tile-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
        }
        .tile-highlight .tile-icon {
          background: rgba(10, 10, 12, 0.14);
          color: var(--accent-ink);
        }
        .tile-title {
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .tile-highlight .tile-title {
          color: var(--accent-ink);
        }
        .tile-meta {
          font-size: 11.5px;
          color: var(--text-tertiary);
          margin-top: auto;
        }
        .tile-highlight .tile-meta {
          color: rgba(10, 10, 12, 0.65);
        }
        .tile-progress {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 3px;
          background: rgba(255, 255, 255, 0.08);
        }
        .tile-progress-fill {
          display: block;
          height: 100%;
          background: var(--accent);
          transition: width 0.3s var(--ease-out);
        }
      `}</style>
    </button>
  );
}
