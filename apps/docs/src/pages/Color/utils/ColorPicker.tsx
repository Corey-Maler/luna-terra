import { ColorArea, ColorAreaProps, ColorThumb } from "react-aria-components"

import styles from './ColorPicker.module.css';

export const ColorPicker = (props: ColorAreaProps) => {
    return <ColorArea className={styles.ColorArea} {...props}>
        <ColorThumb className={styles.ColorThumb} />
    </ColorArea>
}