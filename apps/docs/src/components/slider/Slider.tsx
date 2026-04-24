import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components';

import styles from './Slider.module.css';

export const Slider = ({
  value,
  onChange,
  label,
  step = 0.01,
  minValue = 0,
  maxValue = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  step?: number;
  minValue?: number;
  maxValue?: number;
}) => {
  return (
    <AriaSlider
      step={step}
      minValue={minValue}
      maxValue={maxValue}
      className={styles.slider}
      value={value}
      onChange={onChange}
    >
      <Label className={styles.label}>{label}</Label>
      <SliderOutput className={styles.output} />
      <SliderTrack className={styles.track}>
        <SliderThumb className={styles.thumb} />
      </SliderTrack>
    </AriaSlider>
  );
};
