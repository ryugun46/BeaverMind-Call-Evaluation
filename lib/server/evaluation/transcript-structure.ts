import "server-only";

export type TranscriptTurn = {
  index: number;
  speaker: string;
  timestamp?: string;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  labelled: boolean;
};

export type ParsedTranscript = {
  turns: TranscriptTurn[];
  labelledWordCount: number;
  totalWordCount: number;
  labelledWordCoverage: number;
  speakerLabels: string[];
  attributionReliable: boolean;
};

export type TranscriptChunk = {
  index: number;
  content: string;
  sourceStart: number;
  sourceEnd: number;
  firstTurnIndex: number;
  lastTurnIndex: number;
  wordCount: number;
};

export type LocatedTranscriptQuote = {
  quote: string;
  speaker: string;
  turnIndex: number;
  timestamp?: string;
  sourceStart: number;
  sourceEnd: number;
};

const WORD = /[A-Za-zÀ-ž0-9]+(?:['’][A-Za-zÀ-ž0-9]+)*/g;
const TIMESTAMP = "(?:\\d{1,2}:)?\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?";
const SPEAKER_LINE = new RegExp(
  `^\\s*(?:(?:\\[|\\()?(?<prefixTimestamp>${TIMESTAMP})(?:\\]|\\))?\\s+)?` +
    `(?<speaker>[A-Za-zÀ-ž][A-Za-zÀ-ž0-9 _().'’\\-]{0,79}?)` +
    `(?:\\s*(?:\\[|\\()(?<suffixTimestamp>${TIMESTAMP})(?:\\]|\\)))?\\s*:\\s*` +
    `(?:(?:\\[|\\()(?<contentTimestamp>${TIMESTAMP})(?:\\]|\\))\\s*)?(?<text>.*)$`,
);
const SPEAKER_HEADER_NAME = "[A-Za-z\\u00c0-\\u017e][A-Za-z\\u00c0-\\u017e0-9 _().'\\u2019\\-]{0,79}?";
const TIMESTAMP_FIRST_SPEAKER_HEADER = new RegExp(
  `^\\s*(?:(?:\\[|\\()(?<bracketedTimestamp>${TIMESTAMP})(?:\\]|\\))\\s*(?:[-–—|]\\s*)?|(?<separatedTimestamp>${TIMESTAMP})\\s*[-–—|]\\s*)(?<speaker>${SPEAKER_HEADER_NAME})\\s*$`
);
const SPEAKER_FIRST_TIMESTAMP_HEADER = new RegExp(
  `^\\s*(?<speaker>${SPEAKER_HEADER_NAME})\\s*(?:(?:[-–—|]\\s*)(?:\\[|\\()?(?<separatedTimestamp>${TIMESTAMP})(?:\\]|\\))?|(?:\\[|\\()(?<bracketedTimestamp>${TIMESTAMP})(?:\\]|\\)))\\s*$`
);
const TOPIC_SHIFT = /^(?:next|now|moving on|let(?:'|’)s (?:move|talk|review|discuss)|before we (?:finish|wrap|close)|to recap|in summary)\b/i;

export function countTranscriptWords(value: string): number {
  return value.match(WORD)?.length ?? 0;
}

function lineRecords(transcript: string) {
  const records: Array<{ text: string; start: number; end: number }> = [];
  const linePattern = /.*(?:\r?\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = linePattern.exec(transcript)) !== null) {
    if (!match[0]) break;
    const start = match.index;
    records.push({ text: match[0].replace(/\r?\n$/, ""), start, end: start + match[0].length });
  }
  return records;
}

/**
 * Parses common `Speaker: utterance` layouts while retaining source offsets.
 * Continuation lines remain attached to the preceding labelled turn, and any
 * unlabelled preamble becomes an explicit Unknown turn rather than disappearing.
 */
export function parseTranscript(transcript: string): ParsedTranscript {
  const turns: TranscriptTurn[] = [];
  let active:
    | { speaker: string; timestamp?: string; textStart: number; sourceStart: number; labelled: boolean }
    | undefined;

  const finish = (sourceEnd: number) => {
    if (!active || sourceEnd <= active.sourceStart) return;
    const rawText = transcript.slice(active.textStart, sourceEnd).trim();
    if (!rawText) return;
    turns.push({
      index: turns.length,
      speaker: active.speaker,
      ...(active.timestamp ? { timestamp: active.timestamp } : {}),
      text: rawText,
      sourceStart: active.sourceStart,
      sourceEnd,
      labelled: active.labelled,
    });
  };

  for (const line of lineRecords(transcript)) {
    const headerMatch =
      TIMESTAMP_FIRST_SPEAKER_HEADER.exec(line.text) ??
      SPEAKER_FIRST_TIMESTAMP_HEADER.exec(line.text);
    if (headerMatch?.groups) {
      finish(line.start);
      active = {
        speaker: headerMatch.groups.speaker!.trim(),
        timestamp:
          headerMatch.groups.bracketedTimestamp ??
          headerMatch.groups.separatedTimestamp,
        textStart: line.end,
        sourceStart: line.start,
        labelled: true,
      };
      continue;
    }

    const match = SPEAKER_LINE.exec(line.text);
    if (!match?.groups) {
      if (!active && line.text.trim()) {
        active = {
          speaker: "Unknown",
          textStart: line.start,
          sourceStart: line.start,
          labelled: false,
        };
      }
      continue;
    }

    finish(line.start);
    const headerText = match.groups.text ?? "";
    const textOffset = line.text.lastIndexOf(headerText);
    active = {
      speaker: match.groups.speaker!.trim(),
      timestamp:
        match.groups.prefixTimestamp ??
        match.groups.suffixTimestamp ??
        match.groups.contentTimestamp,
      textStart: line.start + Math.max(0, textOffset),
      sourceStart: line.start,
      labelled: true,
    };
  }
  finish(transcript.length);

  if (turns.length === 0 && transcript.trim()) {
    const sourceStart = transcript.search(/\S/);
    turns.push({
      index: 0,
      speaker: "Unknown",
      text: transcript.trim(),
      sourceStart,
      sourceEnd: transcript.length,
      labelled: false,
    });
  }

  const totalWordCount = turns.reduce((total, turn) => total + countTranscriptWords(turn.text), 0);
  const labelledWordCount = turns.reduce(
    (total, turn) => total + (turn.labelled ? countTranscriptWords(turn.text) : 0),
    0
  );
  const speakerLabels = Array.from(
    new Map(
      turns
        .filter((turn) => turn.labelled)
        .map((turn) => [turn.speaker.toLocaleLowerCase(), turn.speaker] as const)
    ).values()
  );
  const labelledWordCoverage =
    totalWordCount === 0 ? 0 : Number((labelledWordCount / totalWordCount).toFixed(4));

  return {
    turns,
    labelledWordCount,
    totalWordCount,
    labelledWordCoverage,
    speakerLabels,
    attributionReliable:
      turns.filter((turn) => turn.labelled).length >= 2 &&
      labelledWordCoverage >= 0.8 &&
      speakerLabels.length >= 2,
  };
}

type ChunkUnit = Pick<TranscriptTurn, "index" | "speaker" | "sourceStart" | "sourceEnd"> & {
  wordCount: number;
};

function splitOversizedTurn(
  transcript: string,
  turn: TranscriptTurn,
  maxWords: number
): ChunkUnit[] {
  const source = transcript.slice(turn.sourceStart, turn.sourceEnd);
  const words = Array.from(source.matchAll(WORD));
  if (words.length <= maxWords) {
    return [{
      index: turn.index,
      speaker: turn.speaker,
      sourceStart: turn.sourceStart,
      sourceEnd: turn.sourceEnd,
      wordCount: words.length,
    }];
  }

  const units: ChunkUnit[] = [];
  for (let startWord = 0; startWord < words.length; startWord += maxWords) {
    const endWord = Math.min(words.length, startWord + maxWords);
    const localStart = startWord === 0 ? 0 : words[startWord]!.index;
    const lastWord = words[endWord - 1]!;
    const localEnd =
      endWord === words.length
        ? source.length
        : lastWord.index + lastWord[0].length;
    units.push({
      index: turn.index,
      speaker: turn.speaker,
      sourceStart: turn.sourceStart + localStart,
      sourceEnd: turn.sourceStart + localEnd,
      wordCount: endWord - startWord,
    });
  }
  return units;
}

/** Builds overlapping chunks on speaker-turn boundaries, preferring natural topic-shift turns. */
export function chunkTranscript(
  transcript: string,
  options: { maxWords: number; overlapTurns: number }
): TranscriptChunk[] {
  const parsed = parseTranscript(transcript);
  const units = parsed.turns.flatMap((turn) => splitOversizedTurn(transcript, turn, options.maxWords));
  if (units.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let start = 0;
  while (start < units.length) {
    let words = 0;
    let end = start;
    let preferredBoundary: number | undefined;

    for (; end < units.length; end += 1) {
      const unit = units[end]!;
      if (end > start && words + unit.wordCount > options.maxWords) break;
      words += unit.wordCount;
      const opening = transcript.slice(unit.sourceStart, Math.min(unit.sourceEnd, unit.sourceStart + 180));
      const utterance = opening.includes(":") ? opening.slice(opening.indexOf(":") + 1).trim() : opening.trim();
      if (words >= options.maxWords * 0.55 && TOPIC_SHIFT.test(utterance)) {
        preferredBoundary = end;
      }
    }

    if (end === start) end = start + 1;
    if (end < units.length && preferredBoundary !== undefined && preferredBoundary > start) {
      end = preferredBoundary;
    }
    const last = units[end - 1]!;
    const first = units[start]!;
    const content = transcript.slice(first.sourceStart, last.sourceEnd);
    chunks.push({
      index: chunks.length,
      content,
      sourceStart: first.sourceStart,
      sourceEnd: last.sourceEnd,
      firstTurnIndex: first.index,
      lastTurnIndex: last.index,
      wordCount: countTranscriptWords(content),
    });

    if (end >= units.length) break;
    start = Math.max(start + 1, end - Math.max(0, options.overlapTurns));
  }
  return chunks;
}

function canonicalEvidenceCharacter(character: string): string {
  if (/\s/.test(character)) return " ";
  if (/[‘’‚‛]/.test(character)) return "'";
  if (/[“”„‟]/.test(character)) return '"';
  if (/[‐‑‒–—―−]/.test(character)) return "-";
  if (character === "…") return "...";
  return character.toLocaleLowerCase();
}

function speakerMatches(left: string, right: string): boolean {
  const a = left.toLocaleLowerCase().replace(/[^A-Za-zÀ-ž0-9]+/g, " ").trim();
  const b = right.toLocaleLowerCase().replace(/[^A-Za-zÀ-ž0-9]+/g, " ").trim();
  return a === b || a.includes(b) || b.includes(a);
}

/** Locates and canonicalizes a quote, then derives its speaker/turn/timestamp from source offsets. */
export function locateTranscriptQuote(
  transcript: string,
  quote: string,
  speakerHint?: string,
  parsed: ParsedTranscript = parseTranscript(transcript),
  sourceRange?: { start: number; end: number }
): LocatedTranscriptQuote | null {
  const exactOffsets: number[] = [];
  for (let offset = transcript.indexOf(quote); offset >= 0; offset = transcript.indexOf(quote, offset + 1)) {
    if (!sourceRange || (offset >= sourceRange.start && offset + quote.length <= sourceRange.end)) {
      exactOffsets.push(offset);
    }
  }

  let sourceStart = exactOffsets.find((offset) => {
    const turn = parsed.turns.find((candidate) => offset >= candidate.sourceStart && offset < candidate.sourceEnd);
    return turn && speakerHint ? speakerMatches(turn.speaker, speakerHint) : false;
  });
  sourceStart ??= exactOffsets[0];
  let exactQuote = quote;

  if (sourceStart === undefined) {
    const normalizedQuote = Array.from(quote).map(canonicalEvidenceCharacter).join("").replace(/ +/g, " ").trim();
    if (!normalizedQuote) return null;
    const normalizedCharacters: string[] = [];
    const starts: number[] = [];
    const ends: number[] = [];
    let sourceOffset = 0;
    for (const character of transcript) {
      const startOffset = sourceOffset;
      sourceOffset += character.length;
      for (const outputCharacter of canonicalEvidenceCharacter(character)) {
        if (outputCharacter === " " && normalizedCharacters.at(-1) === " ") {
          ends[ends.length - 1] = sourceOffset;
          continue;
        }
        normalizedCharacters.push(outputCharacter);
        starts.push(startOffset);
        ends.push(sourceOffset);
      }
    }
    const normalizedTranscript = normalizedCharacters.join("");
    let normalizedOffset = normalizedTranscript.indexOf(normalizedQuote);
    while (
      normalizedOffset >= 0 &&
      sourceRange &&
      (starts[normalizedOffset]! < sourceRange.start ||
        ends[normalizedOffset + normalizedQuote.length - 1]! > sourceRange.end)
    ) {
      normalizedOffset = normalizedTranscript.indexOf(normalizedQuote, normalizedOffset + 1);
    }
    if (normalizedOffset < 0) return null;
    sourceStart = starts[normalizedOffset];
    const normalizedEnd = normalizedOffset + normalizedQuote.length - 1;
    exactQuote = transcript.slice(sourceStart, ends[normalizedEnd]);
  }

  const sourceEnd = sourceStart + exactQuote.length;
  const turn = parsed.turns.find(
    (candidate) => sourceStart! >= candidate.sourceStart && sourceStart! < candidate.sourceEnd
  );
  if (!turn) return null;
  return {
    quote: exactQuote,
    speaker: turn.speaker,
    turnIndex: turn.index,
    ...(turn.timestamp ? { timestamp: turn.timestamp } : {}),
    sourceStart,
    sourceEnd,
  };
}
