/**
 * Lightweight parser for live-edit annotations embedded in source strings.
 *
 * Numeric annotation:  /*@live:key:min:max*\/NUMBER
 *   e.g.  glow: { radius: /*@live:glowR:0.01:0.08*\/0.03 }
 *
 * Color annotation: /*@color:key*\/identifier
 *   e.g.  pipe.styles.color = /*@color:hotColor*\/hotColor;
 *   Strips the comment; inserts an inline ColorSwatch before the identifier.
 *
 * Both strip annotations to produce clean `displayCode` and record positions
 * (line + column) so the interactive renderer can intercept tokens.
 */

export interface LiveSlot {
  key: string;
  min: number;
  max: number;
  /**
   * Dragging sensitivity (px → value).
   * Derived from the number's decimal places: integers → 1, floats → 0.01.
   */
  step: number;
  defaultValue: number;
  /** The original number string — used to match the syntax-highlighted token. */
  defaultText: string;
  /** 0-based line index in `displayCode`. */
  lineIndex: number;
  /** 0-based column offset (chars from line start) in `displayCode`. */
  colOffset: number;
}

export interface ColorSlot {
  key: string;
  /** The identifier text left in displayCode — used to locate the token. */
  defaultText: string;
  /** 0-based line index in `displayCode`. */
  lineIndex: number;
  /** 0-based column offset (chars from line start) in `displayCode`. */
  colOffset: number;
}

export interface ParsedLiveCode {
  /** Source with all annotations stripped. Passed to SyntaxHighlighter. */
  displayCode: string;
  slots: LiveSlot[];
  colorSlots: ColorSlot[];
}

function deriveStep(numStr: string): number {
  return numStr.includes('.') ? 0.01 : 1;
}

// Matches either /*@live:key:min:max*/NUMBER  or  /*@color:key*/IDENTIFIER
const ANNOTATION_RE =
  /\/\*@live:([^:*]+):([^:*]+):([^*]+)\*\/(-?\d+(?:\.\d+)?)|\/\*@color:([^*]+)\*\/(\w+)/g;

export function parseLiveCode(annotatedSource: string): ParsedLiveCode {
  const slots: LiveSlot[] = [];
  const colorSlots: ColorSlot[] = [];
  let displayCode = '';
  let lastIndex = 0;

  const re = new RegExp(ANNOTATION_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(annotatedSource)) !== null) {
    const [full, liveKey, minStr, maxStr, numStr, colorKey, identifier] = match;
    const annotationStart = match.index;

    // Flush the text that precedes this annotation into displayCode.
    displayCode += annotatedSource.slice(lastIndex, annotationStart);

    // Position in displayCode where the kept text will land.
    const linesBeforeToken = displayCode.split('\n');
    const lineIndex = linesBeforeToken.length - 1;
    const colOffset = linesBeforeToken[lineIndex].length;

    if (liveKey !== undefined) {
      // ── @live numeric slot ────────────────────────────────────────────────
      const annotationLen = full.length - numStr.length;
      slots.push({
        key: liveKey,
        min: parseFloat(minStr),
        max: parseFloat(maxStr),
        step: deriveStep(numStr),
        defaultValue: parseFloat(numStr),
        defaultText: numStr,
        lineIndex,
        colOffset,
      });
      displayCode += numStr;
      lastIndex = annotationStart + annotationLen + numStr.length;
    } else {
      // ── @color slot ───────────────────────────────────────────────────────
      const annotationLen = full.length - identifier.length;
      colorSlots.push({
        key: colorKey,
        defaultText: identifier,
        lineIndex,
        colOffset,
      });
      // Keep the identifier text in displayCode (the swatch is prepended before it).
      displayCode += identifier;
      lastIndex = annotationStart + annotationLen + identifier.length;
    }
  }

  // Flush remainder.
  displayCode += annotatedSource.slice(lastIndex);

  return { displayCode, slots, colorSlots };
}

