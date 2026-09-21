const MIN_WORDS = 180;
const MAX_WORDS = 520;

function wordsIn(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function cleanHeading(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/\s+\d+(?:\s+\d+)+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHeading(line: string): boolean {
  const clean = cleanHeading(line);
  const words = clean.split(/\s+/).filter(Boolean);
  if (!clean || clean.length > 92 || words.length > 12 || /[.!?;,]$/.test(clean)) return false;
  if (/^(chapter|section|part|unit|lesson|module)\b/i.test(clean)) return true;
  if (/^\d+(?:\.\d+)*\s+[A-Za-z]/.test(clean)) return true;

  const significant = words.filter((word) => /[A-Za-z]/.test(word));
  if (significant.length < 2) return false;
  const titleCase = significant.filter((word) => /^[A-Z][A-Za-z'’-]*/.test(word)).length;
  return titleCase / significant.length >= 0.65;
}

function isListLine(line: string): boolean {
  return /^(?:[-*•▪◦]|\d+[.)]|[A-Za-z][.)])\s+/.test(line);
}

function normalizeBlocks(raw: string): string[] {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    const value = paragraph.join(' ').replace(/\s+/g, ' ').trim();
    if (value) blocks.push(value);
    paragraph = [];
  };

  const flushList = () => {
    if (list.length) blocks.push(list.join('\n'));
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (isHeading(line)) {
      flushParagraph();
      flushList();
      blocks.push(`## ${cleanHeading(line)}`);
      continue;
    }

    const inlineBullets = line.split(/\s*[•▪◦]\s*/).filter(Boolean);
    if (inlineBullets.length >= 3) {
      flushParagraph();
      for (const item of inlineBullets) list.push(`• ${item}`);
      continue;
    }

    if (isListLine(line)) {
      flushParagraph();
      list.push(line);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function splitOversizedBlock(block: string): string[] {
  const sentences = block.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [block];
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const sentence of sentences) {
    const cleaned = sentence.replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const count = wordsIn(cleaned);
    if (current.length && currentWords + count > MAX_WORDS) {
      chunks.push(current.join(' '));
      current = [];
      currentWords = 0;
    }
    current.push(cleaned);
    currentWords += count;
  }

  if (current.length) chunks.push(current.join(' '));
  return chunks;
}

/** Splits text around semantic structure so unrelated sections are less likely to share a card. */
export function chunkText(raw: string): string[] {
  const blocks = normalizeBlocks(raw);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  const flush = () => {
    if (!current.length) return;
    const value = current.join('\n\n').trim();
    if (value) chunks.push(value);
    current = [];
    currentWords = 0;
  };

  for (const block of blocks) {
    const blockWords = wordsIn(block);
    const heading = block.startsWith('## ');

    if (heading && currentWords >= 80) flush();

    if (blockWords > MAX_WORDS) {
      flush();
      chunks.push(...splitOversizedBlock(block));
      continue;
    }

    if (current.length && currentWords + blockWords > MAX_WORDS && currentWords >= MIN_WORDS) {
      flush();
    }

    current.push(block);
    currentWords += blockWords;
  }

  flush();
  return chunks.length > 0 ? chunks : [raw.trim()].filter(Boolean);
}

export function countWords(text: string): number {
  return wordsIn(text);
}

export function estimateReadingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}
