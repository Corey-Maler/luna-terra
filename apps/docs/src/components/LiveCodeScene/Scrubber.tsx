import { useCallback } from 'react';
import styles from './LiveCodeScene.module.css';

export interface ScrubberProps {
  slotKey: string;
  value: number;
  min: number;
  max: number;
  /** Dragging sensitivity: value-units per pixel of horizontal drag. */
  step: number;
  onChange: (key: string, value: number) => void;
}

export function Scrubber({ slotKey, value, min, max, step, onChange }: ScrubberProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startValue = value;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = (ev.clientX - startX) * step;
        const clamped = Math.min(max, Math.max(min, startValue + delta));
        // Round to avoid floating-point drift.
        const decimals = step < 1 ? Math.round(-Math.log10(step)) : 0;
        const rounded = parseFloat(clamped.toFixed(decimals));
        onChange(slotKey, rounded);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    // `value` must be in deps so startValue captures the right snapshot.
    [slotKey, value, min, max, step, onChange],
  );

  // Display with the same precision as the step size.
  const decimals = step < 1 ? Math.round(-Math.log10(step)) : 0;
  const display = value.toFixed(decimals);

  return (
    <span
      className={styles.scrubber}
      onMouseDown={handleMouseDown}
      title={`Drag to change · range [${min}, ${max}]`}
    >
      {display}
    </span>
  );
}
