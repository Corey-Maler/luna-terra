import { clamp, Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement, LTStyledElement } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── Scene 1: Clamp number line ────────────────────────────────────────────

interface NumberLineOptions {
  value: number;
  min: number;
  max: number;
}

class NumberLineElement extends LTStyledElement<NumberLineOptions> {
  protected defaultOptions(): NumberLineOptions {
    return { value: 0.5, min: 0.2, max: 0.8 };
  }

  override render(renderer: CanvasRenderer): void {
    const { value, min, max } = this.options;
    const clamped = clamp(value, min, max);

    const lineY = 0.0;
    const lineX1 = 0.08;
    const lineX2 = 0.92;
    const lineColor = 'rgba(130, 145, 165, 0.55)';
    const rangeColor = 'rgba(70, 130, 220, 0.7)';
    const dotR = renderer.measureScreenInWorld(5);
    const tickH = renderer.measureScreenInWorld(8);
    const lbl = 11;

    // ── Full number line ─────────────────────────────────────────────────
    renderer.draw(lineColor, 1.5).line(new V2(lineX1, lineY), new V2(lineX2, lineY));
    renderer.draw(lineColor, 1.5).stroke();

    // ── Clamped range highlight ──────────────────────────────────────────
    renderer.draw(rangeColor, 3).line(
      new V2(clamp(min, lineX1, lineX2), lineY),
      new V2(clamp(max, lineX1, lineX2), lineY),
    );
    renderer.draw(rangeColor, 3).stroke();

    // ── Min tick ─────────────────────────────────────────────────────────
    const minX = clamp(min, lineX1, lineX2);
    renderer.draw(rangeColor, 1.5).line(new V2(minX, lineY - tickH), new V2(minX, lineY + tickH));
    renderer.draw(rangeColor, 1.5).stroke();
    renderer.draw(rangeColor, 1).renderText(`min=${min.toFixed(2)}`, new V2(minX - renderer.measureScreenInWorld(16), lineY - tickH * 3), lbl);

    // ── Max tick ─────────────────────────────────────────────────────────
    const maxX = clamp(max, lineX1, lineX2);
    renderer.draw(rangeColor, 1.5).line(new V2(maxX, lineY - tickH), new V2(maxX, lineY + tickH));
    renderer.draw(rangeColor, 1.5).stroke();
    renderer.draw(rangeColor, 1).renderText(`max=${max.toFixed(2)}`, new V2(maxX - renderer.measureScreenInWorld(16), lineY - tickH * 3), lbl);

    // ── Raw value dot ────────────────────────────────────────────────────
    const rawInRange = value >= lineX1 && value <= lineX2;
    const rawX = clamp(value, lineX1 - 0.05, lineX2 + 0.05);
    const rawColor = rawInRange ? 'rgba(130,145,165,0.6)' : 'rgba(220,80,60,0.75)';
    const rawDot = renderer.draw(rawColor, 1.5);
    rawDot.fillStyle = rawColor;
    rawDot.arc(new V2(rawX, lineY), dotR);
    rawDot.fill();
    renderer.draw(rawColor, 1).renderText(
      `value=${value.toFixed(2)}`,
      new V2(rawX - renderer.measureScreenInWorld(22), lineY + tickH * 3),
      lbl,
    );

    // ── Arrow from raw to clamped (when clamped) ─────────────────────────
    const clampedX = clamp(clamped, lineX1, lineX2);
    const wasClipped = Math.abs(rawX - clampedX) > 0.005;
    if (wasClipped) {
      const arrowColor = 'rgba(80,180,120,0.75)';
      renderer.draw(arrowColor, 1.5).line(new V2(rawX, lineY + tickH * 1.5), new V2(clampedX, lineY + tickH * 1.5));
      renderer.draw(arrowColor, 1.5).stroke();
    }

    // ── Clamped value dot ────────────────────────────────────────────────
    const clampColor = 'rgba(60, 200, 100, 0.9)';
    const clampDot = renderer.draw(clampColor, 1.5);
    clampDot.fillStyle = clampColor;
    clampDot.arc(new V2(clampedX, lineY), dotR * 1.3);
    clampDot.fill();
    renderer.draw(clampColor, 1).renderText(
      `clamped=${clamped.toFixed(2)}`,
      new V2(clampedX - renderer.measureScreenInWorld(24), lineY - tickH * 6),
      lbl,
    );
  }
}

type Scene1Config = { value: number; min: number; max: number };
const scene1Defaults: Scene1Config = { value: 0.78, min: 0.25, max: 0.7 };

const SCENE1_CODE = `
const value = /*@live:value:0:1*/0.78;
const min   = /*@live:min:0:0.5*/0.25;
const max   = /*@live:max:0.5:1*/0.70;

// Returns value clamped to [min, max].
const result = clamp(value, min, max);
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();

  const line = new NumberLineElement({
    value: config.value,
    min: config.min,
    max: config.max,
  });
  line.styles.color = new Color(70, 130, 220);
  root.appendChild(line);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(0, -0.15), new V2(1, 0.15)), 0.75);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function NumbersPage() {
  return (
    <DocPage title="Numbers" section="@lunaterra/math">
      <p>
        A small set of numeric utilities used throughout the library. Currently
        the module exports a single function: <code>clamp</code>.
      </p>

      <DocPage.Section id="clamp" title="clamp">
        <p>
          <code>clamp(value, min, max)</code> constrains <em>value</em> to the
          closed interval [<em>min</em>, <em>max</em>]. Scrub the values below —
          when the raw value (grey dot) falls outside the range it snaps to the
          nearest boundary (green dot).
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={220}
          scrollBounds={null}
        />
      </DocPage.Section>

      <DocPage.Section id="api" title="API Reference">

        <DocPage.Method
          signature="clamp(value: number, min: number, max: number): number"
          description="Constrains value to the closed interval [min, max]. Equivalent to Math.max(min, Math.min(max, value))."
          params={[
            { name: 'value', type: 'number', description: 'The number to clamp.' },
            { name: 'min', type: 'number', description: 'Lower bound (inclusive).' },
            { name: 'max', type: 'number', description: 'Upper bound (inclusive).' },
          ]}
          returns={{ type: 'number', description: 'value if within [min, max], otherwise the nearest bound.' }}
        />

      </DocPage.Section>
    </DocPage>
  );
}
