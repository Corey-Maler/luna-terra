import { Color } from '@lunaterra/color';

import styles from './ColorPreview.module.css';

export const ColorPreview = ({ color }: { color: Color }) => {
  return (
    <div
      className={styles.preview}
      style={{
        backgroundColor: color.toString(),
      }}
    />
  );
};
