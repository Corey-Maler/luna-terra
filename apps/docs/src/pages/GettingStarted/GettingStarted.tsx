import { DocPage } from '../../components/DocPage/DocPage';

export default function GettingStarted() {
  return (
    <DocPage title="Getting Started" section="Overview">
      <DocPage.Section id="installation" title="Installation">
        <p>
          Install LunaTerra packages via your preferred package manager.
          The library is organised as a set of focused packages under the
          <code>@lunaterra</code> scope.
        </p>
        <DocPage.Pre>{`pnpm add @lunaterra/core @lunaterra/math @lunaterra/color`}</DocPage.Pre>
      </DocPage.Section>

      <DocPage.Section id="quick-start" title="Quick start">
        <p>
          Create an engine instance, mount its canvas into the DOM, add
          elements, and request an update to render the first frame.
        </p>
        <DocPage.Pre>{`import { LunaTerraEngine, LTElement } from '@lunaterra/core';
import { V2 } from '@lunaterra/math';

const engine = new LunaTerraEngine();
document.getElementById('container')!.appendChild(engine.getHtmlElements());

class Circle extends LTElement {
  protected defaultOptions() { return {}; }

  render(renderer) {
    const batch = renderer.batch('#222', 2);
    batch.arc(new V2(0.5, 0.5), 0.2);
    batch.stroke();
  }
}

engine.add(new Circle());
engine.requestUpdate();`}</DocPage.Pre>
      </DocPage.Section>

      <DocPage.Section id="packages" title="Packages">
        <p>
          <strong>@lunaterra/core</strong> — Canvas renderer, engine, element
          system, interaction manager.
        </p>
        <p>
          <strong>@lunaterra/math</strong> — V2 (2D vector), M3 (3×3 matrix),
          Rect2D, and angle/number utilities.
        </p>
        <p>
          <strong>@lunaterra/color</strong> — Immutable Color class with
          manipulation methods (lighten, darken, hue-rotate, etc.).
        </p>
        <p>
          <strong>@lunaterra/elements</strong> — Pre-built elements: Line
          (with Bézier, glow, flow), TextElement, TimeControl.
        </p>
        <p>
          <strong>@lunaterra/tracing</strong> — Lightweight performance
          tracing utility for profiling render cycles.
        </p>
      </DocPage.Section>

      <DocPage.Section id="next-steps" title="Next steps">
        <p>
          Explore the sidebar to learn about each package in detail.
          The <em>Math/V2</em> page is a great place to start with
          interactive vector visualisations.
        </p>
      </DocPage.Section>
    </DocPage>
  );
}
