import { V2 } from '@lunaterra/math';
import { tracing } from '@lunaterra/tracing';
import type { LunaTerraEngine } from '../engine/engine';
import type { CanvasRenderer } from '../render/CanvasRenderer';
import { LTElement } from '../render/Elements/LTElement';

// Hit-test region for the FPS label (canvas pixels, before HDPI scaling applied in click handler)
const HIT_X1 = 5;
const HIT_X2 = 130;
const HIT_Y1 = 5;
const HIT_Y2 = 28;

const LINE_H = 16;
const PAD = 6;
const PANEL_W = 185;

export class PerfOverlay extends LTElement<{}> {
  private expanded = false;
  private lastDt = 16;
  private cleanupClick?: () => void;

  protected override defaultOptions() {
    return {};
  }

  override setup(engine: LunaTerraEngine) {
    super.setup(engine);

    const canvas = engine.renderer.canvas;

    const handler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      if (cx >= HIT_X1 && cx <= HIT_X2 && cy >= HIT_Y1 && cy <= HIT_Y2) {
        this.expanded = !this.expanded;
        engine.requestUpdate();
      }
    };

    canvas.addEventListener('click', handler);
    this.cleanupClick = () => canvas.removeEventListener('click', handler);
  }

  override update(dt: number) {
    this.lastDt = dt;
  }

  override render(renderer: CanvasRenderer) {
    const fps = this.lastDt > 0 ? Math.round(1000 / this.lastDt) : 0;
    const toggle = this.expanded ? '▾' : '▸';
    const fpsLabel = `FPS: ${fps} ${toggle}`;

    if (this.expanded) {
      const stats = Array.from(tracing.getStats().entries());
      const bgH = PAD + LINE_H + stats.length * LINE_H + PAD;

      // semi-transparent background panel
      const bg = renderer.batchScreenSpace('rgba(243,243,243,0.92)');
      bg.rect(new V2(4, 4), new V2(4 + PANEL_W, 4 + bgH));
      bg.fill();

      // FPS row
      const text = renderer.batchScreenSpace('#333333');
      text.renderText(fpsLabel, new V2(10, PAD + LINE_H));

      // stat rows
      let y = PAD + LINE_H + LINE_H;
      for (const [tag, ms] of stats) {
        text.renderText(`${tag}: ${ms.toFixed(2)}ms`, new V2(14, y));
        y += LINE_H;
      }
    } else {
      renderer.batchScreenSpace('#333333').renderText(fpsLabel, new V2(10, 20));
    }
  }

  override destroy() {
    this.cleanupClick?.();
  }
}
