import { useEffect, useRef } from 'react';
import { Camera3D, LTElement, LunaTerraEngine, Transform3D, type CanvasRenderer } from '@lunaterra/core';
import { M4, V2, V3 } from '@lunaterra/math';
import { DocPage } from '../../components/DocPage/DocPage';

const CUBE_POINTS = new Float32Array([
  // front
  -1, -1, 1, 1, -1, 1, 1, 1, 1,
  -1, -1, 1, 1, 1, 1, -1, 1, 1,
  // back
  1, -1, -1, -1, -1, -1, -1, 1, -1,
  1, -1, -1, -1, 1, -1, 1, 1, -1,
  // left
  -1, -1, -1, -1, -1, 1, -1, 1, 1,
  -1, -1, -1, -1, 1, 1, -1, 1, -1,
  // right
  1, -1, 1, 1, -1, -1, 1, 1, -1,
  1, -1, 1, 1, 1, -1, 1, 1, 1,
  // top
  -1, 1, 1, 1, 1, 1, 1, 1, -1,
  -1, 1, 1, 1, 1, -1, -1, 1, -1,
  // bottom
  -1, -1, -1, 1, -1, -1, 1, -1, 1,
  -1, -1, -1, 1, -1, 1, -1, -1, 1,
]);

const PREVIEW_CODE = `class Cube3D extends LTElement {
  private transform = new Transform3D();

  setup(engine) {
    super.setup(engine);
    engine.requestContinuousLoop();
  }

  update(dt) {
    this.transform.rotation.y += dt * 0.001;
    this.transform.rotation.x += dt * 0.0004;
  }

  render(renderer) {
    const camera = new Camera3D({
      mode: 'perspective',
      eye: new V3(0, 0.7, 5),
      target: new V3(0, 0, 0),
      aspect: renderer.width / renderer.height,
    });

    renderer.webgl3d.drawTriangles(
      cubePoints,
      '#5d7890',
      camera,
      this.transform.modelMatrix.scale(0.7, 0.7, 0.7),
    );
  }
}`;

class Cube3D extends LTElement {
  private readonly transform = new Transform3D();

  protected defaultOptions() {
    return {};
  }

  override setup(engine: LunaTerraEngine) {
    super.setup(engine);
    engine.requestContinuousLoop();
  }

  override update(dt: number) {
    this.transform.rotation.y += dt * 0.001;
    this.transform.rotation.x += dt * 0.0004;
  }

  override destroy() {
    this.engine?.releaseContinuousLoop();
  }

  override render(renderer: CanvasRenderer) {
    const aspect = renderer.height === 0 ? 1 : renderer.width / renderer.height;
    const camera = new Camera3D({
      mode: 'perspective',
      eye: new V3(0, 0.75, 5),
      target: new V3(0, 0, 0),
      up: new V3(0, 1, 0),
      aspect,
      near: 0.1,
      far: 100,
    });

    const model = this.transform.modelMatrix
      .scale(0.7, 0.7, 0.7)
      .rotateZ(Math.PI / 7);

    renderer.webgl3d.drawTriangles(CUBE_POINTS, '#5d7890', camera, model);

    renderer.drawScreenSpace('#364152').renderText(
      'renderer.webgl3d + Camera3D + Transform3D',
      new V2(16, 28),
      13,
    );
  }
}

function ThreeDScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    engine.interactive = false;
    engine.background = '#f7f3ec';
    container.appendChild(engine.getHtmlElements());
    engine.add(new Cube3D());
    engine.requestUpdate();

    return () => {
      engine.destroy();
      container.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height: 420,
        display: 'flex',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--surface)',
      }}
    />
  );
}

export default function ThreeDPreviewPage() {
  return (
    <DocPage title="3D Preview" section="@lunaterra/core">
      <DocPage.Section id="overview" title="Overview">
        <p>
          Luna-Terra now exposes a minimal generic 3D path in core. It is separate
          from the existing 2D element renderer: old 2D scenes still use
          <code>renderer.draw()</code> and <code>renderer.webgl</code>, while 3D
          scenes can use <code>renderer.webgl3d</code>.
        </p>
        <p>
          This preview is intentionally small. It proves that core can draw 3D
          primitives without depending on Terra maps.
        </p>
      </DocPage.Section>

      <DocPage.Section id="preview" title="Preview">
        <ThreeDScene />
      </DocPage.Section>

      <DocPage.Section id="code" title="Shape">
        <DocPage.Pre>{PREVIEW_CODE}</DocPage.Pre>
      </DocPage.Section>

      <DocPage.Section id="next" title="Next">
        <p>
          The next step is to use this path for a flat Terra map plane. Later,
          existing 2D graphics can be rendered as layers on arbitrary 3D planes.
        </p>
      </DocPage.Section>
    </DocPage>
  );
}
