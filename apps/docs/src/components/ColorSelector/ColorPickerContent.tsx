/**
 * ColorPickerContent — the body of the color picker UI.
 *
 * Internally stateful (uncontrolled). Initialized once from `defaultColor`.
 * When the popover opens fresh each time (react-aria Popover unmounts on close),
 * effects reset to neutral — the output Color has effects baked in.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  ColorPicker,
  ColorArea,
  ColorThumb,
  ColorSlider,
  SliderTrack,
  ColorField,
  Label,
  Input,
  parseColor,
  type Color as AriaColor,
} from 'react-aria-components';
import { Color } from '@lunaterra/color';
import { Slider } from '../slider/Slider';
import styles from './ColorPickerContent.module.css';

// ── Internal effect state ──────────────────────────────────────────────────

interface EffectState {
  hueRotation: number; // degrees, 0 = neutral
  brightness: number;  // multiplier, 1.0 = neutral
  saturation: number;  // offset (-1..+1), 0 = neutral
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function lunaterraToAriaColor(c: Color): AriaColor {
  const { h, s, l } = c.toHsl();
  return parseColor(
    `hsba(${h.toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${c.a})`,
  );
}

function ariaColorToLunaterra(c: AriaColor, alpha: number): Color {
  const rgb = c.toFormat('rgb');
  return new Color(
    Math.round(rgb.getChannelValue('red')),
    Math.round(rgb.getChannelValue('green')),
    Math.round(rgb.getChannelValue('blue')),
    alpha,
  );
}

function applyEffects(base: Color, effects: EffectState): Color {
  let c = base;
  if (effects.hueRotation !== 0) c = c.hueRotate(effects.hueRotation);
  if (effects.brightness !== 1.0) c = c.brighter(effects.brightness);
  if (effects.saturation !== 0)
    c = effects.saturation > 0 ? c.saturate(effects.saturation) : c.desaturate(-effects.saturation);
  return c;
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface ColorPickerContentProps {
  defaultColor: Color;
  onChange: (color: Color) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ColorPickerContent({ defaultColor, onChange }: ColorPickerContentProps) {
  const [ariaColor, setAriaColor] = useState<AriaColor>(() => lunaterraToAriaColor(defaultColor));
  const [alpha, setAlpha] = useState(defaultColor.a);
  const [effects, setEffects] = useState<EffectState>({ hueRotation: 0, brightness: 1.0, saturation: 0 });
  const [effectsOpen, setEffectsOpen] = useState(false);

  const emit = useCallback(
    (color: AriaColor, a: number, fx: EffectState) => {
      onChange(applyEffects(ariaColorToLunaterra(color, a), fx));
    },
    [onChange],
  );

  // Emit initial value once on mount.
  useEffect(() => {
    emit(ariaColor, alpha, effects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleColorChange = useCallback(
    (c: AriaColor) => { setAriaColor(c); emit(c, alpha, effects); },
    [alpha, effects, emit],
  );

  const handleAlphaChange = useCallback(
    (a: number) => { setAlpha(a); emit(ariaColor, a, effects); },
    [ariaColor, effects, emit],
  );

  const updateEffect = useCallback(
    <K extends keyof EffectState>(key: K, value: EffectState[K]) => {
      const next = { ...effects, [key]: value };
      setEffects(next);
      emit(ariaColor, alpha, next);
    },
    [ariaColor, alpha, effects, emit],
  );

  const hasEffects = effects.hueRotation !== 0 || effects.brightness !== 1.0 || effects.saturation !== 0;

  return (
    <div className={styles.root}>
      <ColorPicker value={ariaColor} onChange={handleColorChange}>
        <ColorArea
          className={styles.colorArea}
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
        >
          <ColorThumb className={styles.colorThumb} />
        </ColorArea>

        <ColorSlider colorSpace="hsl" channel="hue" className={styles.hueSlider}>
          <SliderTrack className={styles.hueTrack}>
            <ColorThumb className={styles.hueThumb} />
          </SliderTrack>
        </ColorSlider>

        <ColorField colorSpace="rgb" className={styles.hexField}>
          <Label className={styles.hexLabel}>Hex</Label>
          <Input className={styles.hexInput} />
        </ColorField>
      </ColorPicker>

      <Slider label="Opacity" value={alpha} onChange={handleAlphaChange} minValue={0} maxValue={1} step={0.01} />

      <div className={styles.effectsSection}>
        <button className={styles.effectsToggle} onClick={() => setEffectsOpen(o => !o)} aria-expanded={effectsOpen}>
          <span className={styles.effectsToggleIcon}>{effectsOpen ? '▾' : '▸'}</span>
          Effects
          {hasEffects && <span className={styles.effectsBadge} />}
        </button>

        {effectsOpen && (
          <div className={styles.effectsBody}>
            <Slider label="Hue rotation" value={effects.hueRotation} onChange={v => updateEffect('hueRotation', v)} minValue={-180} maxValue={180} step={1} />
            <Slider label="Brightness" value={effects.brightness} onChange={v => updateEffect('brightness', v)} minValue={0.2} maxValue={3} step={0.01} />
            <Slider label="Saturation" value={effects.saturation} onChange={v => updateEffect('saturation', v)} minValue={-1} maxValue={1} step={0.01} />
            <button
              className={styles.resetButton}
              onClick={() => {
                const reset: EffectState = { hueRotation: 0, brightness: 1.0, saturation: 0 };
                setEffects(reset);
                emit(ariaColor, alpha, reset);
              }}
            >
              Reset effects
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
