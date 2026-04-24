/**
 * ColorSwatch — tiny inline color swatch used inside the code preview.
 * Clicking opens a popover color picker.
 */
import { DialogTrigger, Button, Popover, Dialog } from 'react-aria-components';
import { Color } from '@lunaterra/color';
import { ColorPickerContent } from '../ColorSelector/ColorPickerContent';
import styles from './ColorSwatch.module.css';

export interface ColorSwatchProps {
  colorKey: string;
  color: Color;
  onChange: (key: string, color: Color) => void;
}

export function ColorSwatch({ colorKey, color, onChange }: ColorSwatchProps) {
  return (
    <DialogTrigger>
      <Button
        className={styles.swatch}
        style={{ background: color.toString() }}
        aria-label={`Pick color for ${colorKey}`}
      />
      <Popover className={styles.popover} placement="bottom start">
        <Dialog className={styles.dialog}>
          <ColorPickerContent
            defaultColor={color}
            onChange={c => onChange(colorKey, c)}
          />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
