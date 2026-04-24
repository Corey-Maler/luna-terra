import { Angles, Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement, LTStyledElement } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

const RADIUS = 0.35;
const DOMAIN = 0.48;

// ── Scene 1: Unit circle with angle constants ─────────────────────────────

/** Renders the unit circle, labelled spokes for each Angles constant, and a
 *  custom scrubbed angle for comparison. */
class AngleConstantsElement extends LTStyledElement<{ customAngle: number }> {
  protected defaultOptions() { return { customAngle: 40 }; }

  override render(renderer: CanvasRenderer): void {
    const { customAngle } = this.options;
    const circleColor = 'rgba(130, 145, 165, 0.5)';
    const spokeColor = 'rgba(130, 145, 165, 0.55)';
    const customColor = 'rgba(220, 80, 60, 0.85)';

    // ── Bounding circle ──────────────────────────────────────────────────
    const steps = 128;
    const pts = Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return new V2(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS);
    });
    const circle = renderer.batch(circleColor, 1);
    circle.path(pts);
    circle.stroke();

    // ── Named constants ──────────────────────────────────────────────────
    const constants: Array<{ key: string; rad: number; color: string }> = [
      { key: 'd30',  rad: Angles.d30,  color: 'rgba(100, 180, 240, 0.85)' },
      { key: 'd45',  rad: Angles.d45,  color: 'rgba(100, 200, 160, 0.85)' },
      { key: 'd60',  rad: Angles.d60,  color: 'rgba(160, 200, 80, 0.85)'  },
      { key: 'd90',  rad: Angles.d90,  color: 'rgba(220, 180, 40, 0.85)'  },
      { key: 'd120', rad: Angles.d120, color: 'rgba(220, 120, 40, 0.85)'  },
      { key: 'd180', rad: Angles.d180, color: 'rgba(200, 80, 200, 0.85)'  },
    ];

    const tipR = renderer.measureScreenInWorld(4);
    const labelOffset = renderer.measureScreenInWorld(14);

    for (const { key, rad, color } of constants) {
      const tipX = Math.cos(rad) * RADIUS;
      const tipY = Math.sin(rad) * RADIUS;
      const tip = new V2(tipX, tipY);

      // spoke
      const spoke = renderer.batch(color, 1.5);
      spoke.line(new V2(0, 0), tip);
      spoke.stroke();

      // dot at rim
      const dot = renderer.batch(color, 1);
      dot.fillStyle = color;
      dot.arc(tip, tipR);
      dot.fill();

      // label
      const labelR = RADIUS + labelOffset * 2.5;
      const lx = Math.cos(rad) * labelR;
      const ly = Math.sin(rad) * labelR;
      renderer.batch(color, 1).renderText(
        `${key} (${Angles.toDegrees(rad).toFixed(0)}°)`,
        new V2(lx - renderer.measureScreenInWorld(20), ly),
        10,
      );
    }

    // ── Custom angle ─────────────────────────────────────────────────────
    const customRad = (customAngle * Math.PI) / 180;
    const cx = Math.cos(customRad) * RADIUS;
    const cy = Math.sin(customRad) * RADIUS;
    const customTip = new V2(cx, cy);

    const custom = renderer.batch(customColor, 2);
    custom.line(new V2(0, 0), customTip);
    custom.stroke();

    const customSpokeSize = renderer.measureScreenInWorld(9);
    const angle = customRad;
    const spread = 0.42;
    const a1 = new V2(cx - Math.cos(angle - spread) * customSpokeSize * 1.6, cy - Math.sin(angle - spread) * customSpokeSize * 1.6);
    const a2 = new V2(cx - Math.cos(angle + spread) * customSpokeSize * 1.6, cy - Math.sin(angle + spread) * customSpokeSize * 1.6);
    renderer.batch(customColor, 2).line(customTip, a1); renderer.batch(customColor, 2).stroke();
    renderer.batch(customColor, 2).line(customTip, a2); renderer.batch(customColor, 2).stroke();

    const customLabelR = RADIUS + labelOffset * 2.5;
    const clx = Math.cos(customRad) * customLabelR;
    const cly = Math.sin(customRad) * customLabelR;
    renderer.batch(customColor, 1).renderText(
      `${customAngle}° → ${Angles.prettyPrint(customRad)}`,
      new V2(clx - renderer.measureScreenInWorld(cx > 0 ? 10 : 60), cly),
      10,
    );

    // ── Axes (thin) ───────────────────────────────────────────────────────
    renderer.batch(spokeColor, 1).line(new V2(-DOMAIN + 0.02, 0), new V2(DOMAIN - 0.02, 0));
    renderer.batch(spokeColor, 1).stroke();
    renderer.batch(spokeColor, 1).line(new V2(0, -DOMAIN + 0.02), new V2(0, DOMAIN - 0.02));
    renderer.batch(spokeColor, 1).stroke();
  }
}

type Scene1Config = { angle: number };
const scene1Defaults: Scene1Config = { angle: 40 };

const SCENE1_CODE = `
// All angle constants are in radians.
const { d30, d45, d60, d90, d120, d180 } = Angles;

// Custom angle: scrub to compare with the named constants.
const myAngle = Angles.toRadians(/*@live:angle:0:360*/40);
console.log(Angles.prettyPrint(myAngle)); // e.g. "40.00°"
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();
  root.appendChild(new AngleConstantsElement({ customAngle: config.angle }));

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.85);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Conversion ───────────────────────────────────────────────────

type Scene2Config = { degrees: number };
const scene2Defaults: Scene2Config = { degrees: 90 };

const SCENE2_CODE = `
const deg = /*@live:degrees:0:360*/90;

const rad = Angles.toRadians(deg);   // 1.5708…
const back = Angles.toDegrees(rad);  // 90
`.trim();

class ConversionScene extends LTStyledElement<{ degrees: number }> {
  protected defaultOptions() { return { degrees: 90 }; }
  override render(renderer: CanvasRenderer): void {
    const { degrees } = this.options;
    const rad = Angles.toRadians(degrees);
    const circleColor = 'rgba(130, 145, 165, 0.4)';
    const color = 'rgba(70, 130, 220, 0.85)';

    // circle
    const steps = 64;
    const pts = Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return new V2(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS);
    });
    const circle = renderer.batch(circleColor, 1);
    circle.path(pts);
    circle.stroke();

    // arc
    const arcSteps = Math.max(4, Math.round(degrees));
    const arcPts = Array.from({ length: arcSteps + 1 }, (_, i) => {
      const a = (i / arcSteps) * rad;
      return new V2(Math.cos(a) * RADIUS * 0.5, Math.sin(a) * RADIUS * 0.5);
    });
    if (arcPts.length >= 2) {
      const arc = renderer.batch('rgba(220,180,40,0.5)', 1);
      arc.path(arcPts);
      arc.stroke();
    }

    // spoke
    const cx = Math.cos(rad) * RADIUS;
    const cy = Math.sin(rad) * RADIUS;
    renderer.batch(color, 2).line(new V2(0, 0), new V2(cx, cy));
    renderer.batch(color, 2).stroke();

    // label
    const lx = renderer.measureScreenInWorld(14);
    const ly = renderer.measureScreenInWorld(14);
    renderer.batch('rgba(28,28,32,0.8)', 1).renderText(
      `${degrees}° = ${rad.toFixed(4)} rad`,
      new V2(-DOMAIN + 0.02, DOMAIN - 0.04),
      11,
    );
  }
}

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const root = new GroupElement();
  root.appendChild(new ConversionScene({ degrees: config.degrees }));

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.85);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AnglesPage() {
  return (
    <DocPage title="Angles" section="@lunaterra/math">
      <p>
        The <code>Angles</code> namespace provides radian ↔ degree conversions and
        pre-computed constants for common angles. All internal representations in
        Luna-Terra use <strong>radians</strong>. Positive angles rotate
        counter-clockwise (Y-up convention).
      </p>

      <DocPage.Section id="constants" title="Constants">
        <p>
          The spokes below represent the six named constants on the unit circle.
          The <strong style={{ color: 'rgba(220,80,60,0.9)' }}>red arrow</strong> shows
          a custom angle — scrub it to compare with the named constants.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={480}
          scrollBounds={null}
        />
      </DocPage.Section>

      <DocPage.Section id="conversion" title="Conversion">
        <p>
          <code>Angles.toRadians()</code> and <code>Angles.toDegrees()</code> convert
          between the two representations. Scrub the degree value to see the
          radian equivalent.
        </p>
        <LiveCodeScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={380}
          scrollBounds={null}
        />
      </DocPage.Section>

      <DocPage.Section id="api" title="API Reference">

        <DocPage.Method
          signature="Angles.toRadians(degrees: number): number"
          description="Converts degrees to radians: degrees × (π / 180)."
          params={[{ name: 'degrees', type: 'number', description: 'Angle in degrees.' }]}
          returns={{ type: 'number', description: 'Angle in radians.' }}
        />

        <DocPage.Method
          signature="Angles.toDegrees(radians: number): number"
          description="Converts radians to degrees: radians × (180 / π)."
          params={[{ name: 'radians', type: 'number', description: 'Angle in radians.' }]}
          returns={{ type: 'number', description: 'Angle in degrees.' }}
        />

        <DocPage.Method
          signature="Angles.normalize(angle: number): number"
          description="Reduces an angle to the range [0, 2π) via modulo."
          params={[{ name: 'angle', type: 'number', description: 'Angle in radians.' }]}
          returns={{ type: 'number', description: 'Normalised angle in [0, 2π).' }}
        />

        <DocPage.Method
          signature="Angles.prettyPrint(radians: number): string"
          description={'Returns a formatted degree string, e.g. Angles.prettyPrint(Math.PI) → "180.00°".'}
          params={[{ name: 'radians', type: 'number', description: 'Angle in radians.' }]}
          returns={{ type: 'string' }}
        />

        <DocPage.Method
          signature="Angles.d30 — Angles.d180"
          description="Pre-computed radian values for 30°, 45°, 60°, 90°, 120°, and 180°. Use instead of computing Math.PI / 6 etc. manually."
          returns={{ type: 'number' }}
        />

      </DocPage.Section>
    </DocPage>
  );
}
