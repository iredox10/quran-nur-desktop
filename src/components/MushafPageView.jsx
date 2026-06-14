import { useMemo } from 'react';
import { getWordArabicText } from '../utils/quranText';
import { State } from 'ts-fsrs';

export default function MushafPageView({ verses, mushaf, arabicFont, fontSize, activeAudioVerseKey, isHeatmapMode, hifdhHistory }) {
  const lines = useMemo(() => {
    const lineMap = new Map();

    verses.forEach((verse) => {
      verse.words?.forEach((word) => {
        const lineNumber = Number(word.line_number || 0);
        if (!lineNumber) {
          return;
        }

        if (!lineMap.has(lineNumber)) {
          lineMap.set(lineNumber, []);
        }

        lineMap.get(lineNumber).push({
          key: `${verse.verse_key}-${word.position || lineMap.get(lineNumber).length}`,
          text: getWordArabicText(word, mushaf),
          verseKey: verse.verse_key,
          charType: word.char_type_name,
        });
      });
    });

    return Array.from(lineMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([lineNumber, words]) => ({ lineNumber, words }));
  }, [mushaf, verses]);

  if (!lines.length) {
    return null;
  }

  const getHeatmapColor = (verseKey) => {
    if (!isHeatmapMode || !hifdhHistory) return null;
    const history = hifdhHistory[verseKey];
    if (!history || !history.card) return 'rgba(128, 128, 128, 0.05)';
    
    const card = history.card;
    if (card.state === State.New || card.state === State.Learning || card.state === State.Relearning) {
      return 'rgba(239, 68, 68, 0.15)';
    }
    
    const stability = card.stability;
    if (stability < 7) {
      return 'rgba(245, 158, 11, 0.15)';
    } else if (stability < 21) {
      return 'rgba(132, 204, 22, 0.15)';
    } else {
      return 'rgba(34, 197, 94, 0.15)';
    }
  };

  return (
    <div className="mx-auto max-w-[840px] rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-md)]">
      <div className="mb-4 text-[0.8rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {mushaf.name} · line-grouped page scaffolding
      </div>

      <div className="flex flex-col gap-[0.3rem]">
        {lines.map((line) => (
          <div
            key={line.lineNumber}
            data-line-number={line.lineNumber}
            className="flex min-h-[2.8rem] items-center justify-between gap-[0.4rem] text-justify"
            style={{ direction: 'rtl' }}
          >
            {line.words.map((word) => (
              <span
                key={word.key}
                style={{
                  fontFamily: arabicFont,
                  fontSize: `${fontSize * 0.4 + 1.35}rem`,
                  lineHeight: 1.95,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.3s ease',
                  backgroundColor: word.verseKey === activeAudioVerseKey ? 'var(--accent-light)' : (getHeatmapColor(word.verseKey) || 'transparent'),
                  borderRadius: '4px'
                }}
                className={
                  word.verseKey === activeAudioVerseKey || word.charType === 'end'
                    ? 'text-accent'
                    : 'text-[var(--text-primary)]'
                }
              >
                {word.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
