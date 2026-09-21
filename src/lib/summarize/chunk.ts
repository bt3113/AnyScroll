const MIN_WORDS = 350;
const MAX_WORDS = 650;

/** Splits text into paragraph-aligned chunks sized for the summarizer's input window. */
export function chunkText(raw: string): string[] {
  const paragraphs = raw
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current.join(' '));
      current = [];
      currentWords = 0;
    }
  };

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    if (words > MAX_WORDS) {
      flush();
      const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
      let sentenceChunk: string[] = [];
      let sentenceWords = 0;
      for (const sentence of sentences) {
        const sWords = sentence.split(/\s+/).length;
        sentenceChunk.push(sentence.trim());
        sentenceWords += sWords;
        if (sentenceWords >= MIN_WORDS) {
          chunks.push(sentenceChunk.join(' '));
          sentenceChunk = [];
          sentenceWords = 0;
        }
      }
      if (sentenceChunk.length > 0) chunks.push(sentenceChunk.join(' '));
      continue;
    }

    if (currentWords + words > MAX_WORDS && currentWords >= MIN_WORDS) {
      flush();
    }
    current.push(para);
    currentWords += words;
  }
  flush();

  return chunks.length > 0 ? chunks : [raw.trim()].filter(Boolean);
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function estimateReadingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}
