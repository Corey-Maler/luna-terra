export const HorizontalStack = (props: { children: React.ReactNode, padding?: number, blockMargin?: number }) => {
  return (
    <div
      style={{
        display: 'flex',
        marginBlock: props.blockMargin ? `${props.blockMargin * 4}px` : '0px',
        flexDirection: 'row',
        gap: '8px',
        alignItems: 'center',
        padding: props.padding ? `${props.padding * 4}px` : '0px',
      }}
    >
      {props.children}
    </div>
  );
};
