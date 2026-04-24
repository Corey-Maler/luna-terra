import { useEffect, useRef } from 'react';
import { LunaTerraEngine, DummyElement } from '@lunaterra/core';
import { DocPage } from '../../components/DocPage/DocPage';

export default () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    container.appendChild(engine.getHtmlElements());

    engine.add(new DummyElement());
    engine.requestUpdate();

    return () => {
      engine.destroy();
      container.innerHTML = '';
    };
  }, []);

  return (
    <DocPage title="Core engine" section="@lunaterra/color">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '400px',
          width: '100%',
        }}
      >
        <div ref={containerRef} style={{ flex: 1, display: 'flex', minHeight: 0 }} />
      </div>
    </DocPage>
  );
};
