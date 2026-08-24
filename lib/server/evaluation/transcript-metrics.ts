import "server-only";

export interface TranscriptSpeakerMetric {
  label: string;
  wordCount: number;
  wordSharePercent: number;
  questionMarkCount: number;
  turnCount: number;
}

export interface TranscriptMetrics {
  parsedTurnCount: number;
  parsedWordCount: number;
  speakers: TranscriptSpeakerMetric[];
}

const SPEAKER_LINE = /^\s*(?:\[[^\]]+\]\s*)?([A-Za-z][A-Za-z0-9 _().'-]{0,79}):\s*(.*)$/;
const WORD = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g;

function countWords(value: string): number {
  return value.match(WORD)?.length ?? 0;
}

/**
 * Extracts reproducible, model-independent counts from ordinary
 * `Speaker: utterance` transcripts. Unlabelled continuation lines are assigned
 * to the most recently recognized speaker.
 */
export function analyzeTranscript(transcript: string): TranscriptMetrics {
  const speakers = new Map<
    string,
    Omit<TranscriptSpeakerMetric, "wordSharePercent">
  >();
  let currentSpeakerKey: string | null = null;
  let parsedTurnCount = 0;

  const addText = (speakerKey: string, text: string) => {
    const metric = speakers.get(speakerKey);
    if (!metric) return;
    metric.wordCount += countWords(text);
    metric.questionMarkCount += Array.from(text).filter(
      (character) => character === "?"
    ).length;
  };

  for (const line of transcript.split(/\r?\n/)) {
    const match = SPEAKER_LINE.exec(line);
    if (match) {
      const label = match[1]!.trim();
      const speakerKey = label.toLocaleLowerCase();
      currentSpeakerKey = speakerKey;
      parsedTurnCount += 1;
      const current = speakers.get(speakerKey);
      if (current) {
        current.turnCount += 1;
      } else {
        speakers.set(speakerKey, {
          label,
          wordCount: 0,
          questionMarkCount: 0,
          turnCount: 1,
        });
      }
      addText(speakerKey, match[2] ?? "");
    } else if (currentSpeakerKey && line.trim()) {
      addText(currentSpeakerKey, line);
    }
  }

  const parsedWordCount = Array.from(speakers.values()).reduce(
    (total, speaker) => total + speaker.wordCount,
    0
  );

  return {
    parsedTurnCount,
    parsedWordCount,
    speakers: Array.from(speakers.values()).map((speaker) => ({
      ...speaker,
      wordSharePercent:
        parsedWordCount === 0
          ? 0
          : Number(((speaker.wordCount / parsedWordCount) * 100).toFixed(2)),
    })),
  };
}

export function getSpeakerWordShareByLabel(
  metrics: TranscriptMetrics,
  labelIncludes: string
): number | null {
  const needle = labelIncludes.toLocaleLowerCase();
  const matchingWordCount = metrics.speakers
    .filter((speaker) => speaker.label.toLocaleLowerCase().includes(needle))
    .reduce((total, speaker) => total + speaker.wordCount, 0);

  if (metrics.parsedWordCount === 0 || matchingWordCount === 0) return null;
  return Number(((matchingWordCount / metrics.parsedWordCount) * 100).toFixed(2));
}
