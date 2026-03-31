/**
 * FullBleedTable: breaks a table out of the max-w-6xl container to use
 * the full viewport width. The table scrolls horizontally if it exceeds
 * the viewport. Headers/summaries above this wrapper stay within the
 * normal body width.
 */
export function FullBleedTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-x-auto"
      style={{
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        paddingLeft: 'max(1rem, calc(50vw - 576px))',  // 576px = half of max-w-6xl (1152px)
        paddingRight: 'max(1rem, calc(50vw - 576px))',
      }}
    >
      {children}
    </div>
  );
}
