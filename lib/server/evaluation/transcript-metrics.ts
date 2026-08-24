import "server-only";

import { countTranscriptWords, parseTranscript } from "@/lib/server/evaluation/transcript-structure";

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
  labelledWordCoverage: number;
  speakerAttributionReliable: boolean;
  speakers: TranscriptSpeakerMetric[];
}

/**
 * Extracts reproducible, model-independent counts from ordinary
 * `Speaker: utterance` transcripts. Unlabelled continuation lines are assigned
 * to the most recently recognized speaker.
 */
export function analyzeTranscript(transcript: string): TranscriptMetrics {
  const parsed = parseTranscript(transcript);
  const speakers = new Map<
    string,
    Omit<TranscriptSpeakerMetric, "wordSharePercent">
  >();
  for (const turn of parsed.turns) {
    const speakerKey = turn.speaker.toLocaleLowerCase();
    const current = speakers.get(speakerKey);
    if (current) {
      current.turnCount += 1;
      current.wordCount += countTranscriptWords(turn.text);
      current.questionMarkCount += Array.from(turn.text).filter((character) => character === "?").length;
    } else {
      speakers.set(speakerKey, {
        label: turn.speaker,
        wordCount: countTranscriptWords(turn.text),
        questionMarkCount: Array.from(turn.text).filter((character) => character === "?").length,
        turnCount: 1,
      });
    }
  }

  const parsedWordCount = Array.from(speakers.values()).reduce(
    (total, speaker) => total + speaker.wordCount,
    0
  );

  return {
    parsedTurnCount: parsed.turns.length,
    parsedWordCount,
    labelledWordCoverage: parsed.labelledWordCoverage,
    speakerAttributionReliable: parsed.attributionReliable,
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
