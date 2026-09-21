import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ScrollCard from '../components/ScrollCard';
import { CloseIcon } from '../components/icons';
import { listCards } from '../lib/db';
import { initDocsStore, persistDoc, useDocs } from '../lib/docsStore';
import type { CardRecord } from '../types';

export default function Reader() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const docs = useDocs();
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const doc = useMemo(() => docs.find((d) => d.id === docId), [docs, docId]);

  useEffect(() => {
    if (docs.length === 0) initDocsStore();
  }, [docs.length]);

  useEffect(() => {
    if (!docId) return;
    listCards(docId).then(setCards);
  }, [docId, doc?.cardCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: [0, 0.6, 1] },
    );

    for (const el of cardRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [cards.length]);

  useEffect(() => {
    if (!doc || cards.length === 0) return;
    if (doc.lastOpenedCard === activeIndex) return;
    const timer = setTimeout(() => {
      persistDoc({ ...doc, lastOpenedCard: activeIndex });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  if (!doc) {
    return (
      <div className="reader-status">
        <p>Loading…</p>
      </div>
    );
  }

  const isProcessing = doc.status === 'parsing' || doc.status === 'summarizing';

  return (
    <div className="reader">
      <div className="reader-top">
        <button type="button" className="reader-close" onClick={() => navigate('/library')} aria-label="Close">
          <CloseIcon size={16} />
        </button>
        <div className="reader-progress">
          {cards.map((_, i) => (
            <span key={i} className={`reader-seg${i <= activeIndex ? ' filled' : ''}`} />
          ))}
        </div>
        <span className="reader-doc-title">{doc.title}</span>
      </div>

      {cards.length === 0 && isProcessing && (
        <div className="reader-status">
          <div className="reader-status-ring" />
          <p>Converting your document…</p>
          <span>{Math.round(doc.progress * 100)}%</span>
        </div>
      )}

      {cards.length === 0 && doc.status === 'error' && (
        <div className="reader-status">
          <p>Something went wrong converting this document.</p>
          <span>{doc.error}</span>
        </div>
      )}

      {cards.length > 0 && (
        <div className="reader-scroller" ref={containerRef}>
          {cards.map((card, i) => (
            <ScrollCard
              key={card.id}
              card={card}
              index={i}
              total={isProcessing ? doc.cardCount + 1 : cards.length}
              active={i === activeIndex}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
            />
          ))}
          {isProcessing && (
            <div className="scroll-card reader-more">
              <div className="reader-status-ring small" />
              <p>More cards on the way…</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        .reader {
          position: fixed;
          inset: 0;
          background: var(--bg);
          z-index: 50;
        }
        .reader-scroller {
          height: 100dvh;
          overflow-y: auto;
          scroll-snap-type: y mandatory;
          overscroll-behavior-y: contain;
        }
        .reader-top {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          padding: max(14px, env(safe-area-inset-top)) var(--space-4) var(--space-3);
          display: flex;
          align-items: center;
          gap: 12px;
          background: linear-gradient(to bottom, rgba(10,10,12,0.75), transparent);
        }
        .reader-close {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .reader-progress {
          flex: 1;
          display: flex;
          gap: 4px;
        }
        .reader-seg {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.18);
        }
        .reader-seg.filled {
          background: var(--accent);
        }
        .reader-doc-title {
          display: none;
        }
        @media (min-width: 380px) {
          .reader-doc-title {
            display: block;
            font-size: 12px;
            color: var(--text-tertiary);
            max-width: 110px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
        .reader-status {
          height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-align: center;
          padding: 0 var(--space-5);
          color: var(--text-secondary);
        }
        .reader-status span {
          font-size: 13px;
          color: var(--text-tertiary);
        }
        .reader-status-ring {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid rgba(215, 255, 61, 0.2);
          border-top-color: var(--accent);
          animation: spin 0.9s linear infinite;
        }
        .reader-more {
          height: 100dvh;
          scroll-snap-align: start;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-tertiary);
          font-size: 13.5px;
        }
        .reader-status-ring.small {
          width: 22px;
          height: 22px;
          border-width: 2px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
