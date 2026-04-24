import { Color } from '@lunaterra/color';
import type { LTThemePalette } from '@lunaterra/core';

const color = (value: string) => Color.from(value);

const LIGHT_SOLAR = {
  ink: color('#3c2a1a'),
  inkStrong: color('#5a3512'),
  sun: color('#f2c47b'),
  warm: color('#c49a60'),
  terracotta: color('#b06f52'),
  cool: color('#7090b0'),
  stone: color('#9a9080'),
  luna: color('#d1c6bd'),
};

const DARK_SOLAR = {
  ink: color('#c8b8a8'),
  inkStrong: color('#efe2cd'),
  sun: color('#f5c97a'),
  warm: color('#8c6a3a'),
  terracotta: color('#c78b70'),
  cool: color('#5a7a9a'),
  stone: color('#7a7068'),
  luna: color('#978d86'),
};

const LIGHT_DOCS_DRAWING_THEME: LTThemePalette = {
  chart: {
    axis: LIGHT_SOLAR.ink.withAlpha(0.58),
    crosshair: LIGHT_SOLAR.stone.withAlpha(0.78),
    series: {
      primary: LIGHT_SOLAR.cool,
      secondary: LIGHT_SOLAR.warm,
      tertiary: LIGHT_SOLAR.luna,
    },
    widget: {
      title: LIGHT_SOLAR.ink.withAlpha(0.82),
      baseline: LIGHT_SOLAR.stone.withAlpha(0.72),
      watermark: LIGHT_SOLAR.ink,
    },
  },
  math: {
    axis: LIGHT_SOLAR.ink.withAlpha(0.58),
    grid: {
      major: LIGHT_SOLAR.ink.withAlpha(0.24),
      minor: LIGHT_SOLAR.ink.withAlpha(0.10),
    },
    gridDots: {
      major: LIGHT_SOLAR.inkStrong.withAlpha(0.36),
      minor: LIGHT_SOLAR.ink.withAlpha(0.16),
    },
    rect: {
      primary: LIGHT_SOLAR.cool,
      secondary: LIGHT_SOLAR.stone,
      quadrant: LIGHT_SOLAR.sun,
    },
    state: {
      success: LIGHT_SOLAR.sun,
      successStrong: LIGHT_SOLAR.warm,
      danger: LIGHT_SOLAR.terracotta,
    },
    label: LIGHT_SOLAR.ink,
  },
  ui: {
    scaleIndicator: {
      rule: LIGHT_SOLAR.ink.withAlpha(0.55),
      text: LIGHT_SOLAR.ink.withAlpha(0.72),
    },
    scaleRuler: {
      tooth: LIGHT_SOLAR.ink.withAlpha(0.45),
      label: LIGHT_SOLAR.ink.withAlpha(0.55),
      tick: LIGHT_SOLAR.ink.withAlpha(0.38),
      badgeBg: LIGHT_SOLAR.inkStrong.withAlpha(0.88),
      badgeText: color('#ebe1d2'),
    },
    zoomControls: {
      panelBg: color('#fffaf3').withAlpha(0.94),
      panelBorder: LIGHT_SOLAR.ink.withAlpha(0.16),
      buttonText: LIGHT_SOLAR.inkStrong,
      labelText: LIGHT_SOLAR.ink.withAlpha(0.76),
    },
  },
};

const DARK_DOCS_DRAWING_THEME: LTThemePalette = {
  chart: {
    axis: DARK_SOLAR.ink.withAlpha(0.64),
    crosshair: DARK_SOLAR.luna.withAlpha(0.82),
    series: {
      primary: DARK_SOLAR.cool,
      secondary: DARK_SOLAR.sun,
      tertiary: DARK_SOLAR.luna,
    },
    widget: {
      title: DARK_SOLAR.inkStrong.withAlpha(0.86),
      baseline: DARK_SOLAR.stone.withAlpha(0.82),
      watermark: DARK_SOLAR.inkStrong,
    },
  },
  math: {
    axis: DARK_SOLAR.ink.withAlpha(0.64),
    grid: {
      major: DARK_SOLAR.ink.withAlpha(0.34),
      minor: DARK_SOLAR.ink.withAlpha(0.14),
    },
    gridDots: {
      major: DARK_SOLAR.inkStrong.withAlpha(0.44),
      minor: DARK_SOLAR.ink.withAlpha(0.22),
    },
    rect: {
      primary: DARK_SOLAR.cool,
      secondary: DARK_SOLAR.stone,
      quadrant: DARK_SOLAR.sun,
    },
    state: {
      success: DARK_SOLAR.sun,
      successStrong: DARK_SOLAR.warm,
      danger: DARK_SOLAR.terracotta,
    },
    label: DARK_SOLAR.inkStrong,
  },
  ui: {
    scaleIndicator: {
      rule: DARK_SOLAR.ink.withAlpha(0.58),
      text: DARK_SOLAR.inkStrong.withAlpha(0.82),
    },
    scaleRuler: {
      tooth: DARK_SOLAR.ink.withAlpha(0.55),
      label: DARK_SOLAR.ink.withAlpha(0.60),
      tick: DARK_SOLAR.ink.withAlpha(0.45),
      badgeBg: DARK_SOLAR.inkStrong.withAlpha(0.95),
      badgeText: LIGHT_SOLAR.inkStrong,
    },
    zoomControls: {
      panelBg: color('#1b1612').withAlpha(0.94),
      panelBorder: DARK_SOLAR.ink.withAlpha(0.18),
      buttonText: DARK_SOLAR.inkStrong,
      labelText: DARK_SOLAR.ink.withAlpha(0.82),
    },
  },
};

export function getDocsDrawingTheme(dark: boolean): LTThemePalette {
  return dark ? DARK_DOCS_DRAWING_THEME : LIGHT_DOCS_DRAWING_THEME;
}