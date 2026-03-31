/**
 * FullBleedTable: breaks a table out of the parent container to use
 * the full viewport width with consistent padding from the browser edge.
 * The table scrolls horizontally if it exceeds the viewport.
 * Headers/summaries above this wrapper stay within the normal body width.
 */
export function FullBleedTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-x-auto"
      style={{
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        paddingLeft: 'clamp(1rem, 4vw, 6rem)',
        paddingRight: 'clamp(1rem, 4vw, 6rem)',
      }}
    >
      {children}
    </div>
  );
}
