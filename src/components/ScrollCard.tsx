import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import type { CardRecord } from '../types';

interface ScrollCardProps {
  card: CardRecord;
  index: number;
  total: number;
  active: boolean;
}

const ScrollCard = forwardRef<HTMLDivElement, ScrollCardProps>(function ScrollCard(
  { card, index, total, active },
  ref,
) {
  return (
    <section ref={ref} className={`scroll-card gradient-${card.accent}`} data-index={index}>
      <div className="scroll-card-inner">
        <motion.span
          className="scroll-card-index"
          initial={false}
          animate={{ opacity: active ? 1 : 0.4 }}
        >
          {index + 1} / {total}
        </motion.span>
        <motion.h2
          className="scroll-card-title"
          initial={{ opacity: 0, y: 14 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0.55, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {card.title}
        </motion.h2>
        <motion.p
          className="scroll-card-body"
          initial={{ opacity: 0, y: 14 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0.4, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          {card.body}
        </motion.p>
      </div>
      <style>{`
        .scroll-card {
          height: 100dvh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          display: flex;
          align-items: flex-end;
          position: relative;
        }
        .scroll-card-inner {
          padding: 0 var(--space-5) calc(var(--space-7) + 56px);
          width: 100%;
        }
        .scroll-card-index {
          display: block;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-tertiary);
          margin-bottom: var(--space-4);
        }
        .scroll-card-title {
          font-size: 30px;
          line-height: 1.18;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0 0 14px;
          max-width: 22ch;
        }
        .scroll-card-body {
          font-size: 16px;
          line-height: 1.55;
          color: var(--text-secondary);
          margin: 0;
          max-width: 42ch;
        }
      `}</style>
    </section>
  );
});

export default ScrollCard;
