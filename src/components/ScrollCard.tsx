import { forwardRef, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CardRecord, CardVisual } from '../types';

interface ScrollCardProps {
  card: CardRecord;
  index: number;
  total: number;
  active: boolean;
}

function Diagram({ visual }: { visual: CardVisual }) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [visual]);

  const activeNode = visual.nodes[Math.min(selected, visual.nodes.length - 1)];

  return (
    <div className={`card-diagram diagram-${visual.type}`}>
      <div className="diagram-heading">
        <span>{visual.title ?? 'Visual map'}</span>
        <small>Tap a node</small>
      </div>

      {visual.type === 'compare' ? (
        <div className="compare-grid">
          {visual.nodes.slice(0, 2).map((node, i) => (
            <button
              type="button"
              key={`${node.label}-${i}`}
              className={`diagram-node compare-node${selected === i ? ' selected' : ''}`}
              onClick={() => setSelected(i)}
            >
              <span className="node-kicker">{i === 0 ? 'A' : 'B'}</span>
              <span>{node.label}</span>
            </button>
          ))}
          <span className="compare-vs">VS</span>
        </div>
      ) : visual.type === 'hub' ? (
        <div className="hub-map">
          <div className="hub-center">Core idea</div>
          <div className="hub-nodes">
            {visual.nodes.map((node, i) => (
              <button
                type="button"
                key={`${node.label}-${i}`}
                className={`diagram-node${selected === i ? ' selected' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="node-index">{i + 1}</span>
                <span>{node.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="diagram-track">
          {visual.nodes.map((node, i) => (
            <div className="diagram-step" key={`${node.label}-${i}`}>
              <button
                type="button"
                className={`diagram-node${selected === i ? ' selected' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="node-index">{visual.type === 'timeline' ? node.label : i + 1}</span>
                {visual.type !== 'timeline' && <span>{node.label}</span>}
              </button>
              {i < visual.nodes.length - 1 && <span className="diagram-connector">→</span>}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeNode && (
          <motion.div
            key={`${selected}-${activeNode.detail}`}
            className="diagram-detail"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            {activeNode.detail}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ScrollCard = forwardRef<HTMLDivElement, ScrollCardProps>(function ScrollCard(
  { card, index, total, active },
  ref,
) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [card.id]);

  return (
    <section ref={ref} className={`scroll-card gradient-${card.accent}`} data-index={index}>
      <div className="scroll-card-inner">
        <motion.div
          className="card-meta-row"
          initial={false}
          animate={{ opacity: active ? 1 : 0.45 }}
        >
          <span className="scroll-card-index">{index + 1} / {total}</span>
          {card.visual && <span className="card-format">Interactive visual</span>}
        </motion.div>

        <motion.h2
          className="scroll-card-title"
          initial={{ opacity: 0, y: 12 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0.6, y: 0 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        >
          {card.title}
        </motion.h2>

        {card.visual && <Diagram visual={card.visual} />}

        <motion.p
          className="scroll-card-body"
          initial={{ opacity: 0, y: 10 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0.5, y: 0 }}
          transition={{ duration: 0.42, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
        >
          {card.body}
        </motion.p>

        {card.keyPoints && card.keyPoints.length > 1 && (
          <div className="card-points" aria-label="Key takeaways">
            {card.keyPoints.slice(0, 4).map((point, i) => (
              <div className="card-point" key={`${point}-${i}`}>
                <span className="point-dot" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        )}

        {card.interaction && (
          <div className="quick-check">
            <button type="button" className="quick-check-button" onClick={() => setRevealed((value) => !value)}>
              <span>
                <small>Quick check</small>
                {card.interaction.prompt}
              </span>
              <strong>{revealed ? 'Hide' : 'Reveal'}</strong>
            </button>
            <AnimatePresence initial={false}>
              {revealed && (
                <motion.div
                  className="quick-check-answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24 }}
                >
                  <span>{card.interaction.answer}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <style>{`
        .scroll-card {
          height: 100dvh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          display: flex;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .scroll-card::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(to bottom, rgba(8,8,10,0.1), rgba(8,8,10,0.18));
        }
        .scroll-card-inner {
          position: relative;
          z-index: 1;
          width: min(100%, 620px);
          max-height: calc(100dvh - 84px);
          margin: 0 auto;
          padding: 84px var(--space-5) 34px;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: none;
        }
        .scroll-card-inner::-webkit-scrollbar { display: none; }
        .card-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .scroll-card-index {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: var(--text-tertiary);
        }
        .card-format {
          padding: 5px 9px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-secondary);
          background: rgba(255,255,255,0.045);
        }
        .scroll-card-title {
          font-size: clamp(27px, 7vw, 36px);
          line-height: 1.08;
          font-weight: 850;
          letter-spacing: -0.035em;
          margin: 0 0 18px;
          max-width: 22ch;
        }
        .scroll-card-body {
          font-size: 14.5px;
          line-height: 1.52;
          color: var(--text-secondary);
          margin: 16px 0 0;
          max-width: 56ch;
        }
        .card-diagram {
          padding: 14px;
          border-radius: 20px;
          background: rgba(7, 7, 10, 0.44);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(14px);
        }
        .diagram-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 11px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .diagram-heading small {
          font-size: 10px;
          font-weight: 600;
          text-transform: none;
          letter-spacing: 0;
          color: var(--text-tertiary);
        }
        .diagram-track {
          display: flex;
          align-items: stretch;
          gap: 4px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .diagram-track::-webkit-scrollbar { display: none; }
        .diagram-step {
          display: flex;
          align-items: center;
          min-width: 0;
        }
        .diagram-node {
          min-width: 105px;
          min-height: 64px;
          padding: 10px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.055);
          color: var(--text-primary);
          text-align: left;
          font: inherit;
          font-size: 11.5px;
          line-height: 1.25;
          transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
        }
        .diagram-node:active { transform: scale(0.97); }
        .diagram-node.selected {
          background: rgba(215,255,61,0.12);
          border-color: rgba(215,255,61,0.48);
        }
        .node-index, .node-kicker {
          display: block;
          margin-bottom: 6px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          color: var(--accent);
        }
        .diagram-connector {
          padding: 0 4px;
          color: rgba(215,255,61,0.68);
          font-size: 14px;
        }
        .diagram-detail {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.08);
          color: var(--text-secondary);
          font-size: 12.5px;
          line-height: 1.42;
        }
        .hub-map {
          display: grid;
          grid-template-columns: 84px 1fr;
          align-items: center;
          gap: 10px;
        }
        .hub-center {
          display: grid;
          place-items: center;
          min-height: 84px;
          padding: 10px;
          border-radius: 50%;
          border: 1px solid rgba(215,255,61,0.45);
          background: rgba(215,255,61,0.1);
          text-align: center;
          font-size: 11px;
          font-weight: 800;
          color: var(--accent);
        }
        .hub-nodes {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .hub-nodes .diagram-node {
          min-width: 0;
          min-height: 54px;
        }
        .compare-grid {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .compare-node { min-width: 0; }
        .compare-vs {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #111216;
          border: 1px solid rgba(255,255,255,0.12);
          color: var(--text-tertiary);
          font-size: 8px;
          font-weight: 900;
        }
        .card-points {
          display: grid;
          gap: 7px;
          margin-top: 14px;
        }
        .card-point {
          display: grid;
          grid-template-columns: 7px 1fr;
          gap: 9px;
          align-items: start;
          font-size: 12.5px;
          line-height: 1.38;
          color: rgba(235,235,239,0.8);
        }
        .point-dot {
          width: 6px;
          height: 6px;
          margin-top: 5px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 12px rgba(215,255,61,0.28);
        }
        .quick-check {
          margin-top: 15px;
          border-radius: 17px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.045);
        }
        .quick-check-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 13px;
          text-align: left;
          color: var(--text-primary);
          font: inherit;
        }
        .quick-check-button span {
          font-size: 12px;
          line-height: 1.3;
        }
        .quick-check-button small {
          display: block;
          margin-bottom: 3px;
          color: var(--accent);
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .quick-check-button strong {
          flex-shrink: 0;
          font-size: 10.5px;
          color: var(--text-secondary);
        }
        .quick-check-answer {
          overflow: hidden;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .quick-check-answer span {
          display: block;
          padding: 11px 13px 13px;
          color: var(--text-secondary);
          font-size: 12.5px;
          line-height: 1.4;
        }
        @media (max-height: 720px) {
          .scroll-card-inner { padding-top: 76px; padding-bottom: 24px; }
          .scroll-card-title { font-size: 25px; margin-bottom: 13px; }
          .card-diagram { padding: 11px; }
          .scroll-card-body { font-size: 13.5px; margin-top: 12px; }
          .card-points { margin-top: 10px; }
          .quick-check { margin-top: 11px; }
        }
      `}</style>
    </section>
  );
});

export default ScrollCard;
