# @lunaterra/react

Thin React lifecycle bindings for Luna-Terra's canvas engine. The adapter mounts and disposes an engine; scene construction stays in the framework-neutral Luna-Terra packages.

```tsx
import { useCallback } from 'react';
import { LunaTerraCanvas } from '@lunaterra/react';
import { Line } from '@lunaterra/elements';
import { V2 } from '@lunaterra/math';

export function Diagram() {
  const createScene = useCallback((engine) => {
    engine.add(new Line({
      points: [new V2(-1, 0), new V2(1, 0)],
    }));
  }, []);

  return <LunaTerraCanvas onCreate={createScene} />;
}
```

Keep `onCreate` stable with `useCallback`. Changing it deliberately disposes the current engine and creates a new one.

## Controlled scale ruler

`ScaleRuler` is a React-controlled host for the canvas-rendered ruler from `@lunaterra/ui`. It supports pointer, touch, and keyboard input without duplicating the ruler in DOM or SVG.

```tsx
import { ScaleRuler } from '@lunaterra/react';

<ScaleRuler
  value={temperature}
  onChange={setTemperature}
  aria-label="Wire temperature"
  config={{
    ticks: [
      { value: -20, label: '−20 °C' },
      { value: 0, label: '0 °C' },
      { value: 50, label: '50 °C' },
    ],
    step: 1,
    sticky: false,
    formatValue: (value) => `${value.toFixed(0)} °C`,
  }}
/>
```
