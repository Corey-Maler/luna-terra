/**
 * LiveCodeView — syntax-highlighted code block with draggable numeric scrubbers.
 *
 * Uses react-syntax-highlighter with a custom `renderer` prop to intercept
 * token spans that correspond to annotated live slots, replacing the plain
 * text of each numeric token with a `<Scrubber>` widget.
 *
 * Tokenisation approach
 * ─────────────────────
 * With `wrapLines={true}` the library gives exactly one row per code line in
 * the `renderer` callback.  We pre-build a per-line Map of
 *   colOffset → LiveSlot
 * from the parsed slot metadata, then walk each row's token children tracking
 * the running column offset.  When a text node's start-column matches a slot,
 * the Scrubber is rendered in its place.
 */
import React, { useMemo } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import type { LiveSlot, ColorSlot } from './parseLiveCode';
import { Scrubber } from './Scrubber';
import { ColorSwatch } from './ColorSwatch';
import { Color } from '@lunaterra/color';
import { getDocsCodeBlockStyle, getDocsCodeTheme } from '../../theme/codeTheme';
import { useDocsDarkMode } from '../../theme/useDocsDarkMode';

// ── Local re-declaration of react-syntax-highlighter renderer types ──────────
// (The package's ambient `rendererNode` / `rendererProps` interfaces live in
//  global scope inside its .d.ts, which may or may not be visible depending on
//  the project's tsconfig. Declaring them locally avoids import gymnastics.)

type RendererNode = {
  type: 'element' | 'text';
  value?: string | number;
  tagName?: keyof React.JSX.IntrinsicElements | React.ComponentType<unknown>;
  properties?: {
    className?: string[];
    style?: React.CSSProperties;
    [key: string]: unknown;
  };
  children?: RendererNode[];
};

type RendererProps = {
  rows: RendererNode[];
  stylesheet: Record<string, React.CSSProperties>;
  useInlineStyles: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNodeStyle(
  node: RendererNode,
  stylesheet: Record<string, React.CSSProperties>,
  useInlineStyles: boolean,
): React.CSSProperties {
  if (!useInlineStyles) return {};
  const fromClasses = (node.properties?.className ?? []).reduce<React.CSSProperties>(
    (acc, cls) => ({ ...acc, ...stylesheet[cls] }),
    {},
  );
  // Direct inline style on the node takes precedence over class-derived styles.
  return { ...fromClasses, ...(node.properties?.style ?? {}) };
}

function renderNode(
  node: RendererNode,
  keyVal: React.Key,
  stylesheet: Record<string, React.CSSProperties>,
  useInlineStyles: boolean,
  colRef: { v: number },
  slotMap: Map<number, LiveSlot>,
  currentConfig: Record<string, number>,
  onChange: (key: string, val: number) => void,
  colorSlotMap: Map<number, ColorSlot>,
  colorConfig: Record<string, Color>,
  onColorChange: (key: string, color: Color) => void,
): React.ReactNode {
  if (node.type === 'text') {
    const text = String(node.value ?? '');
    const col = colRef.v;
    colRef.v += text.length;

    // Numeric scrubbers: hljs makes number literals their own tokens → exact match.
    const numSlot = slotMap.get(col);
    if (numSlot && text === numSlot.defaultText) {
      return (
        <Scrubber
          key={keyVal}
          slotKey={numSlot.key}
          value={currentConfig[numSlot.key] ?? numSlot.defaultValue}
          min={numSlot.min}
          max={numSlot.max}
          step={numSlot.step}
          onChange={onChange}
        />
      );
    }

    // Color swatches: identifiers are NOT their own hljs token — they appear
    // inside a larger text node (e.g. " = hotColor;").  Scan the slot map for
    // any slot whose column falls within this text node's range, then split
    // the text and inject swatches inline.
    const colorSlotsInRange: Array<{ relOffset: number; slot: ColorSlot }> = [];
    for (const [slotCol, slot] of colorSlotMap) {
      if (slotCol < col || slotCol >= col + text.length) continue;
      const relOffset = slotCol - col;
      if (text.slice(relOffset, relOffset + slot.defaultText.length) === slot.defaultText) {
        colorSlotsInRange.push({ relOffset, slot });
      }
    }

    if (colorSlotsInRange.length === 0) return text;

    colorSlotsInRange.sort((a, b) => a.relOffset - b.relOffset);

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (let i = 0; i < colorSlotsInRange.length; i++) {
      const { relOffset, slot } = colorSlotsInRange[i];
      const currentColor = colorConfig[slot.key];
      if (!currentColor) continue;
      if (relOffset > cursor) parts.push(text.slice(cursor, relOffset));
      parts.push(
        <ColorSwatch
          key={`${String(keyVal)}-cs-${i}`}
          colorKey={slot.key}
          color={currentColor}
          onChange={onColorChange}
        />,
      );
      parts.push(slot.defaultText);
      cursor = relOffset + slot.defaultText.length;
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return <React.Fragment key={keyVal}>{parts}</React.Fragment>;
  }

  if (node.type === 'element') {
    const TagName = (node.tagName ?? 'span') as keyof React.JSX.IntrinsicElements;
    const style = getNodeStyle(node, stylesheet, useInlineStyles);
    const className = !useInlineStyles ? node.properties?.className?.join(' ') : undefined;

    const children = (node.children ?? []).map((child, i) =>
      renderNode(child, i, stylesheet, useInlineStyles, colRef, slotMap, currentConfig, onChange, colorSlotMap, colorConfig, onColorChange),
    );

    return React.createElement(TagName, { key: keyVal, style, className }, ...children);
  }

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface LiveCodeViewProps {
  displayCode: string;
  slots: LiveSlot[];
  colorSlots?: ColorSlot[];
  currentConfig: Record<string, number>;
  colorConfig?: Record<string, Color>;
  onChange: (key: string, value: number) => void;
  onColorChange?: (key: string, color: Color) => void;
  language?: string;
}

export function LiveCodeView({
  displayCode,
  slots,
  colorSlots = [],
  currentConfig,
  colorConfig = {},
  onChange,
  onColorChange = () => {},
  language = 'typescript',
}: LiveCodeViewProps) {
  const isDarkMode = useDocsDarkMode();

  // Build per-line lookups for both numeric and color slots.
  const slotsByLine = useMemo(() => {
    const map = new Map<number, Map<number, LiveSlot>>();
    for (const slot of slots) {
      if (!map.has(slot.lineIndex)) map.set(slot.lineIndex, new Map());
      map.get(slot.lineIndex)!.set(slot.colOffset, slot);
    }
    return map;
  }, [slots]);

  const colorSlotsByLine = useMemo(() => {
    const map = new Map<number, Map<number, ColorSlot>>();
    for (const slot of colorSlots) {
      if (!map.has(slot.lineIndex)) map.set(slot.lineIndex, new Map());
      map.get(slot.lineIndex)!.set(slot.colOffset, slot);
    }
    return map;
  }, [colorSlots]);

  // Re-created on every config change so widgets reflect latest values.
  const renderer = ({ rows, stylesheet, useInlineStyles }: RendererProps): React.ReactNode => {
    return rows.map((row, rowIndex) => {
      const slotMap = slotsByLine.get(rowIndex) ?? new Map<number, LiveSlot>();
      const colorSlotMap = colorSlotsByLine.get(rowIndex) ?? new Map<number, ColorSlot>();
      const colRef = { v: 0 };

      const TagName = (row.tagName ?? 'span') as keyof React.JSX.IntrinsicElements;
      const style = getNodeStyle(row, stylesheet, useInlineStyles);
      const className = !useInlineStyles ? row.properties?.className?.join(' ') : undefined;

      const children = (row.children ?? []).map((child, i) =>
        renderNode(child, i, stylesheet, useInlineStyles, colRef, slotMap, currentConfig, onChange, colorSlotMap, colorConfig, onColorChange),
      );

      return React.createElement(TagName, { key: rowIndex, style, className }, ...children);
    });
  };

  return (
    <SyntaxHighlighter
      language={language}
      style={getDocsCodeTheme(isDarkMode)}
      customStyle={getDocsCodeBlockStyle(isDarkMode)}
      wrapLines
      renderer={renderer}
    >
      {displayCode}
    </SyntaxHighlighter>
  );
}
