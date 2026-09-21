import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DocumentRow from '../components/DocumentRow';
import BottomActionBar from '../components/BottomActionBar';
import { listCards } from '../lib/db';
import { initDocsStore, persistDoc, removeDoc, useDocs } from '../lib/docsStore';
import type { DocRecord } from '../types';

function groupLabel(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function Library() {
  const docs = useDocs();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    initDocsStore();
  }, []);

  const filtered = useMemo(
    () => docs.filter((d) => d.title.toLowerCase().includes(query.trim().toLowerCase())),
    [docs, query],
  );
  const active = filtered.filter((d) => !d.archived);
  const archived = filtered.filter((d) => d.archived);

  const groups = useMemo(() => {
    const map = new Map<string, DocRecord[]>();
    for (const doc of active) {
      const label = groupLabel(doc.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(doc);
    }
    return Array.from(map.entries());
  }, [active]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }

  function enterSelectMode(id: string) {
    setSelectMode(true);
    setSelected(new Set([id]));
  }

  async function handleDelete() {
    const ids = Array.from(selected);
    for (const id of ids) await removeDoc(id);
    setSelected(new Set());
    setSelectMode(false);
  }

  async function handleArchive() {
    const ids = Array.from(selected);
    for (const id of ids) {
      const doc = docs.find((d) => d.id === id);
      if (doc) await persistDoc({ ...doc, archived: !doc.archived });
    }
    setSelected(new Set());
    setSelectMode(false);
  }

  async function handleShare() {
    const ids = Array.from(selected);
    const doc = docs.find((d) => d.id === ids[0]);
    if (!doc) return;
    const cards = await listCards(doc.id);
    const summary = cards
      .slice(0, 3)
      .map((c) => `• ${c.title}`)
      .join('\n');
    const text = `${doc.title}\n\n${summary}\n\nConverted with AnyScroll`;
    if (navigator.share) {
      try {
        await navigator.share({ title: doc.title, text });
      } catch {
        /* user cancelled */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    setSelected(new Set());
    setSelectMode(false);
  }

  return (
    <div className="page">
      <div className="lib-header">
        <div>
          <h1 className="section-title">Documents</h1>
          <span className="meta">{active.length} document{active.length === 1 ? '' : 's'}</span>
        </div>
        {selectMode && (
          <button
            type="button"
            className="cancel-select"
            onClick={() => {
              setSelectMode(false);
              setSelected(new Set());
            }}
          >
            Cancel
          </button>
        )}
      </div>

      <input
        className="lib-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search documents"
      />

      {groups.length === 0 && (
        <p className="empty-hint">
          {docs.length === 0 ? 'No documents yet — upload one from Home.' : 'No documents match your search.'}
        </p>
      )}

      {groups.map(([label, items]) => (
        <div key={label}>
          <div className="group-header">{label}</div>
          {items.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              selectMode={selectMode}
              selected={selected.has(doc.id)}
              onOpen={() => {
                if (doc.status === 'ready') navigate(`/reader/${doc.id}`);
              }}
              onToggleSelect={() => toggleSelect(doc.id)}
              onLongPress={() => enterSelectMode(doc.id)}
            />
          ))}
        </div>
      ))}

      {archived.length > 0 && (
        <div>
          <button type="button" className="group-header archived-toggle" onClick={() => setShowArchived((s) => !s)}>
            Archived ({archived.length}) {showArchived ? '▾' : '▸'}
          </button>
          {showArchived &&
            archived.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                selectMode={selectMode}
                selected={selected.has(doc.id)}
                onOpen={() => {
                  if (doc.status === 'ready') navigate(`/reader/${doc.id}`);
                }}
                onToggleSelect={() => toggleSelect(doc.id)}
                onLongPress={() => enterSelectMode(doc.id)}
              />
            ))}
        </div>
      )}

      {selectMode && selected.size > 0 && (
        <BottomActionBar
          count={selected.size}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onShare={handleShare}
        />
      )}

      <style>{`
        .lib-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding-top: var(--space-2);
        }
        .cancel-select {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--accent);
          padding: 6px 2px;
        }
        .lib-search {
          width: 100%;
          margin-top: var(--space-4);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          border: 1px solid var(--surface-border);
          font-size: 14px;
          outline: none;
        }
        .lib-search::placeholder {
          color: var(--text-tertiary);
        }
        .group-header {
          margin: var(--space-5) 2px var(--space-1);
          font-size: 12.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
        }
        .archived-toggle {
          width: 100%;
          text-align: left;
        }
        .empty-hint {
          margin-top: var(--space-6);
          font-size: 13.5px;
          color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
