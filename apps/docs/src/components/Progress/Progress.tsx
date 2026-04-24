import {Meter, Label} from 'react-aria-components';
import styles from './Progress.module.css';

export const Progress = ({ label, value }: {label: string, value: number}) => {
  return (<Meter className={styles.meter} value={value}>
    {({ percentage, valueText }) => (
      <>
        <Label>{label?.toUpperCase()}</Label>
        <span className={styles.value}>{valueText}</span>
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: percentage + '%' }} />
        </div>
      </>
    )}
  </Meter>);
}