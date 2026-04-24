import { Color } from '@lunaterra/color';

export type LTThemeColorLeaf = Color | string;

export type LTThemePalette = {
  [key: string]: LTThemeColorLeaf | LTThemePalette;
};

export interface LTThemeColorRef {
  readonly path: string;
  readonly __ltThemeColorRef: true;
}

export type LTColorValue = Color | LTThemeColorRef | null;

export function themeColor(path: string): LTThemeColorRef {
  return {
    path,
    __ltThemeColorRef: true,
  };
}

export function isThemeColorRef(value: unknown): value is LTThemeColorRef {
  return !!value
    && typeof value === 'object'
    && '__ltThemeColorRef' in value
    && 'path' in value;
}

export function resolveThemeColor(value: LTColorValue, theme: LTThemePalette | null): Color | null {
  if (value === null) return null;
  if (value instanceof Color) return value;
  if (!isThemeColorRef(value)) return null;

  const resolved = getThemeColor(theme, value.path);
  if (resolved === null) return null;

  return resolved instanceof Color ? resolved : Color.from(resolved);
}

function getThemeColor(theme: LTThemePalette | null, path: string): LTThemeColorLeaf | null {
  if (!theme) return null;

  let cursor: LTThemePalette | LTThemeColorLeaf = theme;
  for (const segment of path.split('.')) {
    if (!isThemeBranch(cursor) || !(segment in cursor)) {
      return null;
    }
    cursor = cursor[segment];
  }

  return isThemeBranch(cursor) ? null : cursor;
}

function isThemeBranch(value: LTThemePalette | LTThemeColorLeaf): value is LTThemePalette {
  return typeof value === 'object' && value !== null && !(value instanceof Color);
}