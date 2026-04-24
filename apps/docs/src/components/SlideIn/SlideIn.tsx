import styles from './SlideIn.module.css';

export const SlideIn = ({
  children,
  isOpen,
  from = 'top',
}: {
  children: React.ReactNode;
  isOpen: boolean;
  from?: 'left' | 'right' | 'top' | 'bottom';
}) => {
  return (
    <div
      className={styles.slideIn}
      data-from={from}
      data-open={isOpen ? 'true' : 'false'}
    >
      <div className={styles.inner}>
        {children}
      </div>
    </div>
  );
}