import { DialogTrigger, Button, Popover, Dialog } from 'react-aria-components';
import { Color } from '@lunaterra/color';
import { ColorPickerContent } from './ColorPickerContent';
import styles from './ColorSelector.module.css';

// ── Props ──────────────────────────────────────────────────────────────────

export interface ColorSelectorProps {
  /** Initial color (uncontrolled). */
  defaultColor?: Color;
  /** Label shown next to the swatch. */
  label?: string;
  /** Called every time the output color changes. */
  onChange: (color: Color) => void;
  /** Current color for swatch display (controlled from outside if needed). */
  color?: Color;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ColorSelector({ defaultColor, label, onChange, color }: ColorSelectorProps) {
  const initial = defaultColor ?? new Color(255, 60, 30);
  const swatchColor = color ?? initial;

  return (
    <DialogTrigger>
      <Button className={styles.trigger} aria-label={label ?? 'Pick color'}>
        <span
          className={styles.swatch}
          style={{ background: swatchColor.toString() }}
        />
        {label && <span className={styles.label}>{label}</span>}
      </Button>
      <Popover className={styles.popover} placement="bottom start">
        <Dialog className={styles.dialog}>
          <ColorPickerContent defaultColor={initial} onChange={onChange} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
