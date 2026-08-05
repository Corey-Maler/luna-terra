import { Color, Colors } from './color';

describe('Color', () => {
  it('parses hex strings', () => {
    const c = Color.fromHex('#ff0000');
    expect(c.r).toBe(255);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });

  it('applies opacity multiplication', () => {
    const c = Colors.blue.opaque(0.5);
    expect(c.a).toBe(0.5);
    expect(c.toString()).toBe('rgba(0, 0, 255, 0.5)');
  });

  it('parses compact rgba strings with fractional alpha', () => {
    const color = Color.fromString('rgba(200,192,180,0.55)');

    expect(color.r).toBe(200);
    expect(color.g).toBe(192);
    expect(color.b).toBe(180);
    expect(color.a).toBe(0.55);
  });

  it('parses rgb strings with flexible whitespace', () => {
    const color = Color.fromString('rgb( 60, 42, 26 )');

    expect(color.toString()).toBe('rgba(60, 42, 26, 1)');
  });
});
