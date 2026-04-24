import * as styles from './Button.module.css';

export const Button = ({
  children,
  onClick,
  variant = 'solid',
}: {
  children: string;
  onClick?: () => void;
  variant?: 'solid' | 'secondary' | 'link';
}) => {
  return (
    <button  data-variant={variant} className={styles.button} onClick={onClick}>
      {children}
    </button>
  );
};
