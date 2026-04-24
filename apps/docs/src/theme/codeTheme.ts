import type { CSSProperties } from 'react';

type SyntaxTheme = Record<string, CSSProperties>;

const LIGHT_CODE_THEME: SyntaxTheme = {
  'hljs': {
    display: 'block',
    overflowX: 'auto',
    background: 'linear-gradient(180deg, #fffaf3 0%, #f6efe3 100%)',
    color: '#3c2a1a',
    padding: '1.35rem 1.5rem',
    border: '1px solid rgba(90, 53, 18, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.55)',
  },
  'hljs-comment': { color: '#8c7763', fontStyle: 'italic' },
  'hljs-quote': { color: '#8c7763', fontStyle: 'italic' },
  'hljs-keyword': { color: '#8f4c2d', fontWeight: 700 },
  'hljs-selector-tag': { color: '#8f4c2d', fontWeight: 700 },
  'hljs-literal': { color: '#b06f52', fontWeight: 700 },
  'hljs-number': { color: '#b06f52' },
  'hljs-string': { color: '#7a5a2f' },
  'hljs-doctag': { color: '#7a5a2f' },
  'hljs-title': { color: '#5a3512', fontWeight: 700 },
  'hljs-section': { color: '#5a3512', fontWeight: 700 },
  'hljs-function': { color: '#5a3512' },
  'hljs-built_in': { color: '#7f7569' },
  'hljs-type': { color: '#8c6a3a' },
  'hljs-attr': { color: '#9d6e31' },
  'hljs-attribute': { color: '#9d6e31' },
  'hljs-variable': { color: '#3c2a1a' },
  'hljs-params': { color: '#614534' },
  'hljs-property': { color: '#3c2a1a' },
  'hljs-punctuation': { color: '#7f746b' },
  'hljs-operator': { color: '#8c6a3a' },
};

const DARK_CODE_THEME: SyntaxTheme = {
  'hljs': {
    display: 'block',
    overflowX: 'auto',
    background: 'linear-gradient(180deg, #1b1612 0%, #14100d 100%)',
    color: '#ead8c8',
    padding: '1.35rem 1.5rem',
    border: '1px solid rgba(200, 184, 168, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  'hljs-comment': { color: '#9a8a7a', fontStyle: 'italic' },
  'hljs-quote': { color: '#9a8a7a', fontStyle: 'italic' },
  'hljs-keyword': { color: '#e2b875', fontWeight: 700 },
  'hljs-selector-tag': { color: '#e2b875', fontWeight: 700 },
  'hljs-literal': { color: '#c78b70', fontWeight: 700 },
  'hljs-number': { color: '#c78b70' },
  'hljs-string': { color: '#d7b27e' },
  'hljs-doctag': { color: '#d7b27e' },
  'hljs-title': { color: '#f1e5d7', fontWeight: 700 },
  'hljs-section': { color: '#f1e5d7', fontWeight: 700 },
  'hljs-function': { color: '#f1e5d7' },
  'hljs-built_in': { color: '#c4b09b' },
  'hljs-type': { color: '#c49a60' },
  'hljs-attr': { color: '#f5c97a' },
  'hljs-attribute': { color: '#f5c97a' },
  'hljs-variable': { color: '#ead8c8' },
  'hljs-params': { color: '#d5c2b1' },
  'hljs-property': { color: '#ead8c8' },
  'hljs-punctuation': { color: '#a99c8e' },
  'hljs-operator': { color: '#c8b8a8' },
};

export function getDocsCodeTheme(isDark: boolean): SyntaxTheme {
  return isDark ? DARK_CODE_THEME : LIGHT_CODE_THEME;
}

export function getDocsCodeBlockStyle(isDark: boolean): CSSProperties {
  return {
    margin: 0,
    borderRadius: 0,
    fontSize: '0.92rem',
    lineHeight: 1.7,
    background: isDark ? 'linear-gradient(180deg, #1b1612 0%, #14100d 100%)' : 'linear-gradient(180deg, #fffaf3 0%, #f6efe3 100%)',
  };
}

export function getDocsLineNumberStyle(isDark: boolean): CSSProperties {
  return {
    minWidth: '2.5rem',
    paddingRight: '1rem',
    color: isDark ? 'rgba(200, 184, 168, 0.42)' : 'rgba(60, 42, 26, 0.32)',
  };
}