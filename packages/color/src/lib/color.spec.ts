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
});
