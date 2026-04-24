const colorsCache = new Map<string, Color>();

// ── HSL helpers ────────────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
    case gn: h = ((bn - rn) / d + 2) / 6; break;
    default:  h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

export class Color {
  constructor(
    public r: number,
    public g: number,
    public b: number,
    public a = 1
  ) {}

  toString(): string {
    return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
  }

  opaque(alpha: number): Color {
    return new Color(this.r, this.g, this.b, this.a * alpha);
  }

  withAlpha(a: number): Color {
    return new Color(this.r, this.g, this.b, Math.max(0, Math.min(1, a)));
  }

  toHsl(): { h: number; s: number; l: number } {
    return rgbToHsl(this.r, this.g, this.b);
  }

  hueRotate(degrees: number): Color {
    const { h, s, l } = rgbToHsl(this.r, this.g, this.b);
    const { r, g, b } = hslToRgb(h + degrees, s, l);
    return new Color(r, g, b, this.a);
  }

  lighten(amount = 0.1): Color {
    const { h, s, l } = rgbToHsl(this.r, this.g, this.b);
    const { r, g, b } = hslToRgb(h, s, Math.max(0, Math.min(1, l + amount)));
    return new Color(r, g, b, this.a);
  }

  darken(amount = 0.1): Color {
    return this.lighten(-amount);
  }

  saturate(amount = 0.1): Color {
    const { h, s, l } = rgbToHsl(this.r, this.g, this.b);
    const { r, g, b } = hslToRgb(h, Math.max(0, Math.min(1, s + amount)), l);
    return new Color(r, g, b, this.a);
  }

  desaturate(amount = 0.1): Color {
    return this.saturate(-amount);
  }

  brighter(factor = 1.2): Color {
    const { h, s, l } = rgbToHsl(this.r, this.g, this.b);
    const { r, g, b } = hslToRgb(h, s, Math.max(0, Math.min(1, l * factor)));
    return new Color(r, g, b, this.a);
  }

  darker(factor = 1.2): Color {
    return this.brighter(1 / factor);
  }

  mix(other: Color, t = 0.5): Color {
    const s = 1 - t;
    return new Color(
      Math.round(this.r * s + other.r * t),
      Math.round(this.g * s + other.g * t),
      Math.round(this.b * s + other.b * t),
      this.a * s + other.a * t,
    );
  }

  complement(): Color {
    return this.hueRotate(180);
  }

  static from(value: string | Color): Color {
    if (value instanceof Color) {
      return value;
    }

    return Color.fromString(value);
  }

  static fromString(value: string): Color {
    if (colorsCache.has(value)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return colorsCache.get(value)!;
    }

    if (value.startsWith('#')) {
      return Color.fromHex(value);
    }
    const rgb = value.match(/rgba?\((\d+), (\d+), (\d+)(?:, (\d+))?\)/);
    if (!rgb) throw new Error('Invalid RGB color');

    const color = new Color(
      Number(rgb[1]),
      Number(rgb[2]),
      Number(rgb[3]),
      rgb[4] ? Number(rgb[4]) : 1
    );

    colorsCache.set(value, color);

    return color;
  }

  static fromHex(hex: string): Color {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) throw new Error('Invalid hex color');
    return new Color(
      Number.parseInt(result[1], 16),
      Number.parseInt(result[2], 16),
      Number.parseInt(result[3], 16)
    );
  }

  static fromRgb(r: number, g: number, b: number): Color {
    return new Color(r, g, b);
  }

  static fromHsl(h: number, s: number, l: number, a = 1): Color {
    const { r, g, b } = hslToRgb(h, s, l);
    return new Color(r, g, b, a);
  }
}

export const Colors = {
  red: new Color(255, 0, 0),
  orange: new Color(255, 165, 0),
  yellow: new Color(255, 255, 0),
  blue: new Color(0, 0, 255),
  green: new Color(0, 255, 0),
  black: new Color(0, 0, 0),
  random: () => {
    return new Color(
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256)
    );
  },
};
