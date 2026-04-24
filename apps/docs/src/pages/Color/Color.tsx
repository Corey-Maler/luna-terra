import { Color as C } from 'react-aria-components';

import { Color, Colors } from '@lunaterra/color';
import React from 'react';
import { ColorPicker } from './utils/ColorPicker';
import { ColorPreview } from './utils/ColorPreview';
import { HorizontalStack } from '../../components/horizontalStack';
import { Slider } from '../../components/slider/Slider';
import { DocPage } from '../../components/DocPage/DocPage';

const predefinedColors: { name: string; color: Color }[] = Object.entries(
  Colors
)
  .filter(([, color]) => typeof color !== 'function')
  .map(([name, color]) => ({ name, color: color as Color }));

export default () => {
  const [c, setC] = React.useState<undefined | C>();
  console.log('Color page render ', c);
  const inC = Color.fromString(c?.toString() ?? 'rgba(255, 0, 0, 1)');
  const [opacity, setOpacity] = React.useState(0.5);
  return (
    <DocPage title="Color" section="@lunaterra/color">
      <p>
        The Color package provides a Color class with various colors and operations with color. It is highly optimized for performance with @lunaterra libraries.
      </p>
      <DocPage.Pre>{`import { Color } from '@lunaterra/color';`}</DocPage.Pre>
      <br />
      <h3>Pre-defined colors</h3>
      <HorizontalStack padding={2}>
        {predefinedColors.map(({ name, color }) => (
          <div key={name}>
            <strong>{name}</strong>:&nbsp;
            <ColorPreview color={color} />
          </div>
        ))}
      </HorizontalStack>
      <h3>Color manipulations</h3>
      <h4>Base color</h4>
      <ColorPicker value={c} onChange={setC} />
      <DocPage.Arg>opacity</DocPage.Arg>
      <DocPage.Pre>{`Color.opaque: (n: number) => Color`}</DocPage.Pre>
      <p>Used to make color more transparent</p>
      <Slider value={opacity} onChange={setOpacity} label="Opacity" />
      <ColorPreview color={inC.opaque(opacity)} />
    </DocPage>
  );
};
