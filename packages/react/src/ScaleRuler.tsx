import {
  type KeyboardEvent,
  type MouseEventHandler,
  type PointerEventHandler,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { LTThemePalette, LunaTerraEngine } from '@lunaterra/core';
import {
  ScaleRuler as CanvasScaleRuler,
  type ScaleRulerOptions,
} from '@lunaterra/ui/scale-ruler';
import {
  LunaTerraCanvas,
  type LunaTerraCanvasProps,
} from './LunaTerraCanvas';

export type ScaleRulerConfig = Omit<
  ScaleRulerOptions,
  'value' | 'onChange'
>;

export interface ScaleRulerProps extends Omit<
  LunaTerraCanvasProps,
  'interactive' | 'onCreate' | 'onChange' | 'role'
> {
  /** Controlled numeric value. */
  value: number;
  /** Tick, layout, formatting, and interaction options for the canvas ruler. */
  config: ScaleRulerConfig;
  /** Called with user-selected values. */
  onChange: (value: number) => void;
  /** Optional Luna-Terra colour palette. */
  theme?: LTThemePalette | null;
  /** Accessible value text. Defaults to config.formatValue when available. */
  formatAriaValue?: (value: number) => string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Controlled React host for the canvas-rendered `@lunaterra/ui` ScaleRuler.
 */
export function ScaleRuler({
  value,
  config,
  onChange,
  theme = null,
  formatAriaValue,
  style,
  'aria-label': ariaLabel = 'Scale ruler',
  onKeyDown,
  onClick,
  onPointerDownCapture,
  ...hostProps
}: ScaleRulerProps) {
  const rulerRef = useRef<CanvasScaleRuler | null>(null);
  const engineRef = useRef<LunaTerraEngine | null>(null);
  const configRef = useRef(config);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  configRef.current = config;
  valueRef.current = value;
  onChangeRef.current = onChange;

  const emitChange = useCallback((nextValue: number) => {
    onChangeRef.current(nextValue);
  }, []);

  const createRuler = useCallback((engine: LunaTerraEngine) => {
    engine.theme = theme;
    const ruler = new CanvasScaleRuler({
      ...configRef.current,
      value: valueRef.current,
      onChange: emitChange,
    });
    rulerRef.current = ruler;
    engineRef.current = engine;
    engine.add(ruler);

    return () => {
      rulerRef.current = null;
      engineRef.current = null;
    };
  }, [emitChange, theme]);

  useEffect(() => {
    const ruler = rulerRef.current;
    const engine = engineRef.current;
    if (!ruler || !engine) return;

    Object.assign(ruler.options, config, { onChange: emitChange });
    ruler.setValue(value);
    engine.theme = theme;
    engine.requestUpdate();
  }, [config, emitChange, theme, value]);

  const ticks = config.ticks;
  const min = ticks[0]?.value ?? 0;
  const max = ticks.at(-1)?.value ?? 100;
  const keyboardStep = config.step && config.step > 0
    ? config.step
    : (max - min) / 100;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    let nextValue: number | null = null;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        nextValue = value - keyboardStep;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        nextValue = value + keyboardStep;
        break;
      case 'PageDown':
        nextValue = value - keyboardStep * 10;
        break;
      case 'PageUp':
        nextValue = value + keyboardStep * 10;
        break;
      case 'Home':
        nextValue = min;
        break;
      case 'End':
        nextValue = max;
        break;
      default:
        break;
    }

    if (nextValue !== null) {
      event.preventDefault();
      emitChange(clamp(nextValue, min, max));
    }
  };

  const handleClick: MouseEventHandler<HTMLDivElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) event.currentTarget.focus();
  };

  const handlePointerDownCapture: PointerEventHandler<HTMLDivElement> = (event) => {
    onPointerDownCapture?.(event);
    if (!event.defaultPrevented) {
      event.currentTarget.focus({ preventScroll: true });
    }
  };

  const nearestTick = ticks.reduce<ScaleRulerOptions['ticks'][number] | null>(
    (nearest, tick) => nearest === null ||
      Math.abs(tick.value - value) < Math.abs(nearest.value - value)
      ? tick
      : nearest,
    null,
  );
  const ariaValueText = formatAriaValue?.(value) ??
    (nearestTick && config.formatValue
      ? config.formatValue(value, nearestTick)
      : String(value));

  return (
    <LunaTerraCanvas
      {...hostProps}
      onCreate={createRuler}
      interactive={false}
      role="slider"
      aria-label={ariaLabel}
      tabIndex={hostProps.tabIndex ?? 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={ariaValueText}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onPointerDownCapture={handlePointerDownCapture}
      style={{ height: 96, ...style }}
    />
  );
}
