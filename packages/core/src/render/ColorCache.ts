export class ColorCache {
  private static instance: ColorCache;
  private cache: Map<string, number[]> = new Map();

  private constructor() {}

  static getInstance(): ColorCache {
    if (!ColorCache.instance) {
      ColorCache.instance = new ColorCache();
    }
    return ColorCache.instance;
  }

  getColor(color: string | undefined): number[] {
    if (!color) return [1, 1, 1, 1];

    // Check if color is already in cache
    if (this.cache.has(color)) {
      return this.cache.get(color)!;
    }

    // Parse and cache the color
    const parsedColor = this.parseColor(color);
    this.cache.set(color, parsedColor);
    return parsedColor;
  }

  private parseColor(color: string): number[] {
    try {
      // Handle rgba format
      if (color.startsWith('rgba(')) {
        const rgbaMatch = color.match(
          /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
        );
        if (rgbaMatch) {
          return [
            Number.parseInt(rgbaMatch[1], 10) / 255,
            Number.parseInt(rgbaMatch[2], 10) / 255,
            Number.parseInt(rgbaMatch[3], 10) / 255,
            Number.parseFloat(rgbaMatch[4]),
          ];
        }
      }

      // Handle rgb format
      if (color.startsWith('rgb(')) {
        const rgbMatch = color.match(
          /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/,
        );
        if (rgbMatch) {
          return [
            Number.parseInt(rgbMatch[1], 10) / 255,
            Number.parseInt(rgbMatch[2], 10) / 255,
            Number.parseInt(rgbMatch[3], 10) / 255,
            1,
          ];
        }
      }

      // Handle hex format
      const hex = color.replace('#', '');
      if (hex.length === 6) {
        return [
          Number.parseInt(hex.substr(0, 2), 16) / 255,
          Number.parseInt(hex.substr(2, 2), 16) / 255,
          Number.parseInt(hex.substr(4, 2), 16) / 255,
          1,
        ];
      }

      // If we can't parse the color properly, log and return a default with full opacity
      console.warn(`Unsupported color format: ${color}, defaulting to gray`);
      return [0.5, 0.5, 0.5, 1]; // Default to gray with full opacity
    } catch (e) {
      console.error(`Error parsing color: ${color}`, e);
      return [0.5, 0.5, 0.5, 1]; // Default to gray with full opacity when an error occurs
    }
  }
}
