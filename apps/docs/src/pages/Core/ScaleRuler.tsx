import { useEffect, useRef, useState } from 'react';
import {
  LunaTerraEngine,
} from '@lunaterra/core';
import { ScaleRuler } from '@lunaterra/ui';
import { DocPage } from '../../components/DocPage/DocPage';
import { getDocsDrawingTheme } from '../../theme/drawingTheme';

function isDarkDocsTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

function resolveCanvasBackground(backgroundCssVar: string): string {
  if (!backgroundCssVar.startsWith('--')) {
    return backgroundCssVar;
  }

  const rootStyles = getComputedStyle(document.documentElement);
  return rootStyles.getPropertyValue(backgroundCssVar).trim()
    || rootStyles.getPropertyValue('--surface').trim()
    || '#fcf9f2';
}

// ── Inline live demo ───────────────────────────────────────────────────────

const ZOOM_TICKS = [
  { value: 0, label: 'Luna-Terra' },
  { value: 1, label: 'Inner' },
  { value: 2, label: 'Solar' },
  { value: 3, label: 'Stars' },
  { value: 4, label: 'Galaxy' },
];

const GENERIC_TICKS = [
  { value: 0,   label: '0' },
  { value: 25,  label: '25' },
  { value: 50,  label: '50' },
  { value: 75,  label: '75' },
  { value: 100, label: '100' },
];

function ScaleRulerDemo({
  ticks,
  initial,
  canvasHeight = 200,
  sticky,
  interactionMode = 'drag-caret',
}: {
  ticks: typeof ZOOM_TICKS;
  initial: number;
  canvasHeight?: number;
  sticky?: boolean;
  interactionMode?: 'drag-caret' | 'scroll-scale';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef     = useRef<ScaleRuler | null>(null);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    engine.interactive = false;
    const applyTheme = () => {
      engine.background = resolveCanvasBackground('--surface');
      engine.theme = getDocsDrawingTheme(isDarkDocsTheme());
      engine.requestUpdate();
    };

    applyTheme();
    container.appendChild(engine.getHtmlElements());

    const ruler = new ScaleRuler({
      ticks,
      value: initial,
      onChange: (v) => setValue(v),
      position: 'bottom-center',
      edgeOffset: 28,
      sidePadding: 48,
      sticky,
      interactionMode,
    });
    engine.add(ruler);
    rulerRef.current = ruler;

    engine.requestUpdate();

    const observer = new MutationObserver(() => {
      applyTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      engine.destroy();
      container.innerHTML = '';
      rulerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = interactionMode === 'scroll-scale'
    ? 'drag left / right to scroll the scale under the fixed caret'
    : 'drag the caret or click anywhere on the track';

  return (
    <div>
      <div
        ref={containerRef}
        style={{ width: '100%', height: canvasHeight, display: 'flex', flexDirection: 'column' }}
      />
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', opacity: 0.6 }}>
        Current value: <strong>{value.toFixed(3)}</strong>
        {' — '}{hint}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ScaleRulerPage() {
  return (
    <DocPage title="ScaleRuler" section="@lunaterra/core">

      {/* ── Overview ──────────────────────────────────────────────────── */}
      <DocPage.Section id="overview" title="Overview">
        <p>
          <code>ScaleRuler</code> is a screen-space overlay element that renders a
          horizontal ruler with named tick stops, an animated draggable caret, and
          a row of dot &quot;teeth&quot; that grow in height near the caret position.
        </p>
        <p>
          It is rendered entirely in screen-pixel space via{' '}
          <code>renderer.drawScreenSpace()</code>, so it stays sharp and
          consistently sized regardless of world zoom level. Like{' '}
          <code>ZoomControls</code> and <code>ScaleIndicator</code>, it is an{' '}
          <code>LTElement</code> that you simply <code>engine.add()</code> once.
        </p>
        <DocPage.Pre>{`import { ScaleRuler } from '@lunaterra/ui';

const ruler = new ScaleRuler({
  ticks: [
    { value: 0, label: 'Luna-Terra' },
    { value: 1, label: 'Inner' },
    { value: 2, label: 'Solar' },
    { value: 3, label: 'Stars' },
    { value: 4, label: 'Galaxy' },
  ],
  value: 2,
  formatValue: (v) => v.toFixed(1),
  onChange: (v) => scene.setZoom(v),
});
engine.add(ruler);`}</DocPage.Pre>
      </DocPage.Section>

      {/* ── Live demo: zoom levels ─────────────────────────────────────── */}
      <DocPage.Section id="demo-zoom" title="Demo — zoom level ruler">
        <p>
          Drag the caret along the track. The teeth animate with a Gaussian
          proximity curve centred on the caret. Releasing snaps to the nearest tick.
        </p>
        <ScaleRulerDemo ticks={ZOOM_TICKS} initial={2} canvasHeight={220} />
      </DocPage.Section>

      {/* ── Live demo: generic numbers ────────────────────────────────── */}
      <DocPage.Section id="demo-generic" title="Demo — generic numeric range">
        <p>
          The component is fully generic — ticks can carry any numeric value and
          any label string.
        </p>
        <ScaleRulerDemo ticks={GENERIC_TICKS} initial={50} canvasHeight={200} sticky={false} />
      </DocPage.Section>

      {/* ── Live demo: scroll-scale ───────────────────────────────────── */}
      <DocPage.Section id="demo-scroll" title="Demo — scroll-scale mode">
        <p>
          With <code>interactionMode: &apos;scroll-scale&apos;</code> the caret is fixed at the
          centre of the track and dragging slides the scale beneath it — a natural
          swipe gesture on touch screens. Dragging right increases the value; dragging
          left decreases it.
        </p>
        <ScaleRulerDemo
          ticks={ZOOM_TICKS}
          initial={2}
          canvasHeight={220}
          interactionMode="scroll-scale"
        />
      </DocPage.Section>

      {/* ── API ───────────────────────────────────────────────────────── */}
      <DocPage.Section id="api" title="API">

        <DocPage.Method
          signature="new ScaleRuler(options: ScaleRulerOptions)"
          description="Create a ruler element. Add it to an engine with engine.add(ruler)."
          params={[
            {
              name: 'options',
              type: 'ScaleRulerOptions',
              description: 'See options table below.',
            },
          ]}
        />

        <DocPage.Method
          signature="ruler.setValue(v: number): void"
          description="Programmatically set the value without triggering the snap animation. Clamps to [ticks[0].value, ticks[last].value]."
          params={[
            {
              name: 'v',
              type: 'number',
              description: 'Target value.',
            },
          ]}
        />

        <h3>ScaleRulerOptions</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-container-high)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Prop</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Default</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['ticks', 'ScaleRulerTick[]', '—', 'Ordered tick stops. Must have ≥ 2 entries.'],
              ['value', 'number', '—', 'Initial displayed value.'],
              ['formatValue', '(value: number, nearestTick: ScaleRulerTick) => string', 'undefined', 'Optional formatter for the caret badge text. Useful for timelines such as 12:00 / 16:00 / 20:00.'],
              ['onChange', '(v: number) => void', 'undefined', 'Called on every drag move and after snap-on-release.'],
              ['position', "'bottom-center' | 'top-center'", "'bottom-center'", 'Which edge of the canvas to anchor to.'],
              ['edgeOffset', 'number (CSS px)', '24', 'Distance from the canvas edge to the track line.'],
              ['sidePadding', 'number (CSS px)', '40', 'Horizontal margin from canvas edges to the track ends.'],
              ['sticky', 'boolean', 'true', 'When true, releasing snaps to the nearest tick. Set false for free continuous ranges.'],
              ['interactionMode', "'drag-caret' | 'scroll-scale'", "'drag-caret'", 'drag-caret: user drags caret along fixed track. scroll-scale: caret fixed at centre, dragging scrolls the scale.'],
            ].map(([prop, type, def, desc]) => (
              <tr key={prop} style={{ borderBottom: '1px solid var(--surface-container-high)' }}>
                <td style={{ padding: '6px 8px' }}><code>{prop}</code></td>
                <td style={{ padding: '6px 8px' }}><code>{type}</code></td>
                <td style={{ padding: '6px 8px', opacity: 0.65 }}>{def}</td>
                <td style={{ padding: '6px 8px' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginTop: '1.5rem' }}>ScaleRulerTick</h3>
        <DocPage.Pre>{`interface ScaleRulerTick {
  value: number;  // numeric position of this stop
  label: string;  // short display label (rendered uppercase)
}`}</DocPage.Pre>
      </DocPage.Section>

      {/* ── Behaviour notes ───────────────────────────────────────────── */}
      <DocPage.Section id="behaviour" title="Behaviour notes">
        <ul>
          <li>
            <strong>Continuous drag, snap-on-release.</strong> While dragging,{' '}
            <code>onChange</code> is called on every frame with the exact interpolated
            value. On pointer release the caret animates to the nearest tick and calls{' '}
            <code>onChange</code> once more with the snapped integer (or whatever the
            tick value is).
          </li>
          <li>
            <strong>Tooth height.</strong> Each dot&apos;s height follows a Gaussian
            function centred on the caret:{' '}
            <code>h = baseH + peakH × exp(−d²/2σ²)</code>. The constants{' '}
            <code>TOOTH_BASE_H</code>, <code>TOOTH_PEAK_H</code>, and{' '}
            <code>TOOTH_SIGMA</code> are internal layout constants (CSS px units).
          </li>
          <li>
            <strong>Dark mode.</strong> Colors automatically adapt when{' '}
            <code>html.dark</code> is present on the document element.
          </li>
          <li>
            <strong>HDPI.</strong> All measurements are expressed in CSS pixels and
            multiplied by <code>devicePixelRatio</code> internally for sharp rendering
            on high-DPI displays.
          </li>
        </ul>
      </DocPage.Section>

    </DocPage>
  );
}
