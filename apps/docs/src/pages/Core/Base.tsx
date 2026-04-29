import { DocPage } from '../../components/DocPage/DocPage';

const T = DocPage.Type;

const ENGINE_BOOTSTRAP = `import { LunaTerraEngine } from '@lunaterra/core';
import { Line } from '@lunaterra/elements';
import { V2 } from '@lunaterra/math';

const engine = new LunaTerraEngine();
document.body.appendChild(engine.getHtmlElements());

engine.background = '#fcf9f2';
engine.interactive = true;

engine.add(new Line({
  points: [new V2(-0.4, -0.2), new V2(0.4, 0.25)],
}));

engine.requestUpdate();`;

const RENDER_FLOW = `LunaTerraEngine.update()
├─ children.forEach(child => child.doUpdate(dt, renderer))
├─ renderer.tick(dt)           // pan / zoom animation step
├─ renderer.prepare()
├─ children.forEach(child => child.doRender(renderer))
└─ renderer.postRender(dt)`;

const DRAW_SNIPPET = `render(renderer: CanvasRenderer) {
  const draw = renderer.draw('#1f2937', 2);
  draw.line(a, b);
  draw.stroke();

  renderer.drawScreenSpace('#475569').renderText(
    'HUD label',
    new V2(12, 20),
    12,
  );
}`;

const SCREEN_CONTAINER_SNIPPET = `const panel = new ScreenContainer({
  anchor: 'top-right',
  offsetX: 12,
  offsetY: 12,
  width: 220,
  height: 120,
});

panel.appendChild(new Line({
  points: [new V2(12, 20), new V2(180, 90)],
}));

engine.add(panel);`;

const CLICK_SNIPPET = `const engine = new LunaTerraEngine();
document.body.appendChild(engine.getHtmlElements());

const unsubscribe = engine.renderer.mouseHandlers.$clicksWorld.subscribe((point) => {
  console.log('clicked world point', point.x, point.y);
  engine.requestUpdate();
});

// later
unsubscribe();`;

const EDIT_MODE_SNIPPET = `const cancelEdit = engine.activateEditMode({
  mode: 'clicks',
  onStart: (point) => {
    console.log('session start', point);
  },
  onClick: (point) => {
    console.log('click', point);
  },
  onEnd: (point) => {
    console.log('session end', point);
  },
});

// later
cancelEdit();`;

export default function CoreBasePage() {
  return (
    <DocPage title="Engine & Renderers" section="@lunaterra/core">
      <DocPage.Section id="overview" title="Overview">
        <p>
          <T symbol="LunaTerraEngine" /> is the runtime entry point for a canvas scene. It owns a
          layered renderer, updates your element tree, runs render passes, and exposes convenience
          controls for viewport motion, interaction, background, and theme state.
        </p>
        <p>
          The render stack has three layers with distinct roles: the engine coordinates frame
          timing, <T symbol="CanvasRenderer" /> owns the layered canvases and transform/style stacks,
          and draw backends perform the actual 2D or WebGL work.
        </p>
        <DocPage.Pre>{ENGINE_BOOTSTRAP}</DocPage.Pre>
      </DocPage.Section>

      <DocPage.Section id="architecture" title="Render architecture">
        <p>
          The engine mounts a root <code>&lt;div&gt;</code> containing two canvases. The lower canvas is the
          Canvas2D surface used by <T symbol="DrawContext" />; the upper transparent canvas is the WebGL
          layer used for grid dots, glow lines, and other shader-driven effects.
        </p>
        <DocPage.Pre>{`DOM
└─ engine.getHtmlElements()
   ├─ canvas        // Canvas2D draw surface
   └─ canvas        // transparent WebGL overlay

Runtime objects
└─ LunaTerraEngine
   └─ renderer: CanvasRenderer
      ├─ draw(): DrawContext
      ├─ drawScreenSpace(): DrawContext
      └─ webgl: WebGLDrawBackend`}</DocPage.Pre>
        <p>
          Element transforms are not applied through native canvas transforms during normal world
          rendering. Instead, the renderer keeps a software matrix stack so line widths remain in
          screen pixels even while the scene pans, zooms, or rotates.
        </p>
      </DocPage.Section>

      <DocPage.Section id="frame-flow" title="Frame flow">
        <p>
          Every frame follows the same sequence: update elements, advance camera animation, prepare
          the render surfaces, draw the element tree, then flush the WebGL layer.
        </p>
        <DocPage.Pre>{RENDER_FLOW}</DocPage.Pre>
        <p>
          For one-shot redraws call <code>engine.requestUpdate()</code>. For animated features such as
          flowing glow lines, elements can opt into the continuous loop via
          <code>requestContinuousLoop()</code> / <code>releaseContinuousLoop()</code>.
        </p>
      </DocPage.Section>

      <DocPage.Section id="engine-api" title="LunaTerraEngine API">
        <DocPage.Method
          signature={<>new <T symbol="LunaTerraEngine" variant="code" />()</>}
          description="Create a new engine with a Canvas2D layer, a WebGL overlay, and a fresh root renderer."
        />

        <DocPage.Method
          signature="engine.getHtmlElements(): HTMLDivElement"
          description="Return the root DOM node that contains the engine's layered canvases. Append this once to your application UI."
          returns={{ type: 'HTMLDivElement', description: 'Root container for the renderer surfaces.' }}
        />

        <DocPage.Method
          signature={<>engine.add(element: <T symbol="LTElement" variant="code" />): void</>}
          description="Attach an element subtree to the scene. The engine calls setup() immediately and will include the element in future update/render passes."
          params={[{ name: 'element', type: <T symbol="LTElement" />, description: 'Root element to mount into the scene graph.' }]}
        />

        <DocPage.Method
          signature="engine.requestUpdate(type?: 'quick' | 'full'): void"
          description="Schedule a single future frame. Use this after changing state in response to UI, timers, or external data."
          params={[{ name: 'type', type: "'quick' | 'full'", optional: true, default: "'full'", description: 'Update priority flag. Full updates win if both are requested.' }]}
        />

        <DocPage.Method
          signature="engine.requestQuickUpdate(): void"
          description="Shorthand for requestUpdate('quick')."
        />

        <DocPage.Method
          signature={<>engine.activateInteraction(): <T symbol="InteractionManager" variant="code" /></>}
          description="Enable handle picking, dragging, resizing, and rotation tools for interactive scenes."
          returns={{ type: <T symbol="InteractionManager" />, description: 'Shared manager instance, created lazily.' }}
        />

        <DocPage.Method
          signature={<>engine.zoomToRect(rect: <T symbol="Rect2D" variant="code" />, padding = 0.85): void</>}
          description="Animate the camera so a world-space rectangle fits within the viewport."
          params={[
            { name: 'rect', type: <T symbol="Rect2D" />, description: 'World-space bounds to fit.' },
            { name: 'padding', type: 'number', optional: true, default: '0.85', description: 'Viewport fill fraction from 0 to 1.' },
          ]}
        />

        <DocPage.Method
          signature={<>engine.zoomToPoint(worldPoint: <T symbol="V2" variant="code" />, targetZoom: number): void</>}
          description="Animate the camera to centre a world-space point at the requested zoom level."
          params={[
            { name: 'worldPoint', type: <T symbol="V2" />, description: 'Point to centre in view.' },
            { name: 'targetZoom', type: 'number', description: 'Target linear zoom factor.' },
          ]}
        />

        <DocPage.Method
          signature="engine.requestContinuousLoop(): void"
          description="Acquire one reference on the continuous animation loop. Each caller must later release its own reference."
        />

        <DocPage.Method
          signature="engine.releaseContinuousLoop(): void"
          description="Release one continuous-loop reference previously acquired with requestContinuousLoop()."
        />

        <p>
          Useful writable properties: <code>engine.renderer</code>, <code>engine.interactive</code>,
          <code>engine.scrollBounds</code>, <code>engine.background</code>, <code>engine.theme</code>, and
          <code>engine.fpsPanel</code>.
        </p>
      </DocPage.Section>

      <DocPage.Section id="renderer-api" title="CanvasRenderer API">
        <p>
          <T symbol="CanvasRenderer" /> is the bridge between scene graph code and low-level drawing.
          Most custom elements only need <code>draw()</code>, <code>drawScreenSpace()</code>, and a few
          coordinate helpers.
        </p>

        <DocPage.Method
          signature={<>renderer.draw(initialColor: string | <T symbol="Color" variant="code" />, lineWidth = 1): <T symbol="DrawContext" variant="code" /></>}
          description="Return the shared world-space draw context, reset for a new path. Use this inside element render() methods for normal scene geometry."
          params={[
            { name: 'initialColor', type: <>string | <T symbol="Color" /></>, description: 'Initial stroke/fill color for the draw context.' },
            { name: 'lineWidth', type: 'number', optional: true, default: '1', description: 'Line width in screen pixels.' },
          ]}
          returns={{ type: <T symbol="DrawContext" />, description: 'Shared world-space drawing surface.' }}
        />

        <DocPage.Method
          signature={<>renderer.drawScreenSpace(initialColor: string, lineWidth = 1): <T symbol="DrawContext" variant="code" /></>}
          description="Return a screen-space draw context that ignores the world camera transform. Use this for HUDs, overlays, and fixed-pixel UI."
          params={[
            { name: 'initialColor', type: 'string', description: 'Initial stroke/fill color.' },
            { name: 'lineWidth', type: 'number', optional: true, default: '1', description: 'Line width in screen pixels.' },
          ]}
          returns={{ type: <T symbol="DrawContext" />, description: 'Shared screen-space drawing surface.' }}
        />

        <DocPage.Method
          signature={<>renderer.worldToScreen(p: <T symbol="V2" variant="code" />): <T symbol="V2" variant="code" /></>}
          description="Convert a world-space point into physical canvas-pixel coordinates."
          params={[{ name: 'p', type: <T symbol="V2" />, description: 'World-space point.' }]}
          returns={{ type: <T symbol="V2" />, description: 'Screen-space point in canvas pixels.' }}
        />

        <DocPage.Method
          signature={<>renderer.screenToWorld(p: <T symbol="V2" variant="code" />): <T symbol="V2" variant="code" /></>}
          description="Convert a canvas-pixel point back into world coordinates."
          params={[{ name: 'p', type: <T symbol="V2" />, description: 'Screen-space point in pixels.' }]}
          returns={{ type: <T symbol="V2" />, description: 'World-space point.' }}
        />

        <DocPage.Method
          signature="renderer.measureScreenInWorld(x: number): number"
          description="Ask how many world units correspond to x screen pixels at the current zoom level. Useful for keeping handles and labels readable."
          params={[{ name: 'x', type: 'number', description: 'Distance in screen pixels.' }]}
          returns={{ type: 'number', description: 'Equivalent distance in world units.' }}
        />

        <DocPage.Method
          signature={<>renderer.pushScreenTransform(screenMatrix: <T symbol="M3" variant="code" />): void</>}
          description="Temporarily replace the world camera transform with a custom screen-space affine mapping. Advanced API used by ScreenContainer."
          params={[{ name: 'screenMatrix', type: <T symbol="M3" />, description: 'Matrix mapping local worldBounds into a fixed canvas sub-rect.' }]}
        />

        <DocPage.Method
          signature="renderer.popScreenTransform(): void"
          description="Restore the previous world transform after pushScreenTransform()."
        />

        <p>
          Read-only geometry helpers include <code>renderer.visibleArea</code>, <code>renderer.zoom</code>,
          <code>renderer.zoomLevel</code>, <code>renderer.width</code>, <code>renderer.height</code>, and
          <code>renderer.hdpi</code>. The WebGL backend is exposed as <code>renderer.webgl</code> for
          advanced rendering paths.
        </p>

        <DocPage.Pre>{DRAW_SNIPPET}</DocPage.Pre>
      </DocPage.Section>

      <DocPage.Section id="draw-context" title="DrawContext API">
        <p>
          <T symbol="DrawContext" /> wraps the Canvas2D path API with automatic world-to-screen
          transforms, text sizing, and a few geometry helpers.
        </p>

        <DocPage.Method
          signature="draw.begin(color?: string | Color, width?: number, opts?: { preservePath?: boolean; dashPattern?: number[] }): void"
          description="Reset stroke state for a fresh path. This is called automatically by renderer.draw() / drawScreenSpace()."
        />

        <DocPage.Method
          signature={<>draw.line(start: <T symbol="V2" variant="code" />, end: <T symbol="V2" variant="code" />): void</>}
          description="Move to start and append one line segment to end."
        />

        <DocPage.Method
          signature={<>draw.path(points: <T symbol="V2" variant="code" />[]): void</>}
          description="Append a polyline through an array of world-space points."
        />

        <DocPage.Method
          signature={<>draw.rect(p1: <T symbol="V2" variant="code" /> | <T symbol="Rect2D" variant="code" />, p2?: <T symbol="V2" variant="code" />): void</>}
          description="Append a rectangle path from corners or from a Rect2D object."
        />

        <DocPage.Method
          signature={<>draw.arc(center: <T symbol="V2" variant="code" />, radius: number, startAngle = 0, endAngle = Math.PI * 2, anticlockwise = false): void</>}
          description="Append a circular arc in world coordinates."
        />

        <DocPage.Method
          signature="draw.stroke(): void"
          description="Stroke the current path with the configured color and line width."
        />

        <DocPage.Method
          signature={<>draw.fill(color?: <T symbol="Color" variant="code" />): void</>}
          description="Fill the current path. If a color is provided it overrides the context's current color for the fill call."
        />

        <DocPage.Method
          signature={<>draw.renderText(text: string, p: <T symbol="V2" variant="code" />, size?: number, align?: CanvasTextAlign, baseline?: CanvasTextBaseline): void</>}
          description="Render text using logical font size while automatically compensating for HiDPI canvas scaling."
        />

        <DocPage.Method
          signature="draw.save() / draw.restore() / draw.clip()"
          description="Access the underlying Canvas2D state stack for clipping and temporary blend/alpha adjustments."
        />

        <DocPage.Method
          signature="draw.setAlpha(a: number) / draw.resetAlpha()"
          description="Temporarily change Canvas2D globalAlpha for layered effects."
        />

        <p>
          Important: <code>renderer.draw()</code> returns a shared draw context, not a fresh object.
          Calling it again resets the path state. Capture the result once if you need to build a
          path and then stroke or fill it later.
        </p>
      </DocPage.Section>

      <DocPage.Section id="webgl-backend" title="WebGLDrawBackend">
        <p>
          <code>renderer.webgl</code> exposes the WebGL overlay for advanced or performance-sensitive
          effects. Most app code should prefer higher-level elements such as <code>Grid</code> or
          <code>Line</code>; direct backend access is mainly for custom renderer work.
        </p>

        <DocPage.Method
          signature={<>renderer.webgl.renderGridDots(viewArea: <T symbol="Rect2D" variant="code" />, density = 0, gridColor = {"'#dddddd'"}, subgridColor = {"'rgba(...)'"}, subgridOpacity = 0.5, dotSize = 2): void</>}
          description="Render shader-based drafting dots over the current view area. Used by the Grid element in DOTS mode."
        />

        <DocPage.Method
          signature="renderer.webgl.renderGlowLine(points: Float32Array, parametric: Float32Array, options: GlowLineOptions): void"
          description="Render an SDF-based glow path with optional flow animation on the WebGL overlay."
        />

        <DocPage.Method
          signature="renderer.webgl.renderPoints(points: Float32Array, color: string, pointSize = 1): void"
          description="Render a list of point sprites using GL_POINTS."
        />

        <DocPage.Method
          signature="renderer.webgl.p3(points: Float32Array, offsets: number[], sizes: number[], colors: string[], lineWidth = 1): void"
          description="Low-level line-strip submission path. Public, but closer to backend plumbing than to the normal scene API."
        />

        <DocPage.Method
          signature="renderer.webgl.p3Fill(points: Float32Array, triangles: Uint16Array, color: string): void"
          description="Render indexed triangle meshes on the WebGL layer."
        />
      </DocPage.Section>

      <DocPage.Section id="interaction-manager" title="InteractionManager">
        <p>
          <T symbol="InteractionManager" /> is the engine-level coordinator for draggable
          <code>Handle</code> instances. It subscribes to renderer mouse streams, tracks hover and
          active drag state, and requests redraws whenever interaction affordances change.
        </p>
        <DocPage.Method
          signature={<>engine.activateInteraction(): <T symbol="InteractionManager" variant="code" /></>}
          description="Construct or reuse the shared interaction manager and activate it against the current engine instance."
          returns={{ type: <T symbol="InteractionManager" />, description: 'Shared drag and hover coordinator.' }}
        />
        <DocPage.Method
          signature="interaction.registerHandle(handle: Handle): void"
          description="Register a draggable handle explicitly. Most scenes rely on activateInteraction() scanning the mounted element tree instead."
        />
        <DocPage.Method
          signature="interaction.unregisterHandle(handle: Handle): void"
          description="Remove a handle from the active interaction set when it is destroyed or detached."
        />
      </DocPage.Section>

      <DocPage.Section id="pointer-input" title="Pointer input and clicks">
        <p>
          For raw pointer input, the main surface is <code>engine.renderer.mouseHandlers</code>, which
          exposes observable streams in both screen and world space. For tool-style interactions,
          use <code>engine.activateEditMode(...)</code> or <code>engine.activateItemDragMode(...)</code>
          so the subsystem manages click-vs-drag behavior for you.
        </p>
        <p>
          The most useful streams are <code>$clicksWorld</code>, <code>$mousePositionWorld</code>,
          <code>$mouseDraggingFromWorld</code>, and <code>$mouseUpScreen</code>. These are ideal when
          you want to listen directly to clicks, hover, or drag start without building a custom DOM
          event layer on top of the engine canvas.
        </p>

        <DocPage.Method
          signature="engine.renderer.mouseHandlers.$clicksWorld.subscribe((point: V2) => void): () => void"
          description="Subscribe to click events in world coordinates. The returned function unsubscribes the listener."
        />

        <DocPage.Method
          signature="engine.renderer.mouseHandlers.$mousePositionWorld.subscribe((point: V2) => void): () => void"
          description="Subscribe to pointer movement in world coordinates for hover tools, crosshairs, or inspectors."
        />

        <DocPage.Method
          signature={<>engine.activateEditMode(options: <T symbol="EditModeOptions" variant="code" />): {'() => void'}</>}
          description="Start a higher-level click or drag session. In clicks mode you get click callbacks directly; in auto or drag&drop mode the subsystem promotes pointer movement past the drag threshold into a drag session."
          returns={{ type: '() => void', description: 'Cancel function that removes the active edit session.' }}
        />

        <DocPage.Method
          signature={<>engine.activateItemDragMode(options: <T symbol="ItemDragModeOptions" variant="code" />): {'() => void'}</>}
          description="Capture drags for a specific item with optional hit testing while still allowing normal canvas panning when the pointer-down misses your element."
          returns={{ type: '() => void', description: 'Cancel function that removes the active drag session.' }}
        />

        <DocPage.Pre>{CLICK_SNIPPET}</DocPage.Pre>
        <DocPage.Pre>{EDIT_MODE_SNIPPET}</DocPage.Pre>
      </DocPage.Section>

      <DocPage.Section id="screen-container" title="ScreenContainer">
        <p>
          If you want a full element subtree to live inside a fixed on-screen panel instead of using
          ad-hoc <code>drawScreenSpace()</code> calls, mount it under <T symbol="ScreenContainer" />. The
          renderer uses <code>pushScreenTransform()</code> internally to map a local coordinate system
          into a fixed CSS-pixel rectangle.
        </p>
        <DocPage.Pre>{SCREEN_CONTAINER_SNIPPET}</DocPage.Pre>
      </DocPage.Section>

      <DocPage.Section id="notes" title="Practical notes">
        <p>
          Use <code>engine.interactive = false</code> when the canvas is embedded in a page and you do
          not want mouse wheel or drag gestures to pan/zoom the world.
        </p>
        <p>
          Use <code>engine.theme</code> and <code>engine.background</code> to keep custom scenes aligned
          with the docs drawing theme or your host application theme.
        </p>
        <p>
          Reach for direct backend APIs only when the higher-level element packages do not already
          express the effect you need. In normal scene code, the stable abstraction boundary is the
          engine, the renderer, and the draw context.
        </p>
      </DocPage.Section>
    </DocPage>
  );
}
