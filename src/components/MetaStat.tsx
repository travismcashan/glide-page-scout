interface MetaStatProps {
  value: string | number;
  label: string;
}

/**
 * Typographic lockup: large number with a small stacked label beside it.
 * The label is split roughly in half across two lines for visual balance.
 */
export function MetaStat({ value, label }: MetaStatProps) {
  const words = label.split(' ');
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ');

  return (
    <div className="flex items-center gap-1.5">
      <span className="meta-value text-4xl font-bold text-foreground leading-none tracking-tight">
        {value}
      </span>
      <span className="text-[13px] leading-[1.15] text-muted-foreground">
        {line1}
        {line2 && <br />}
        {line2}
      </span>
    </div>
  );
}

export function MetaStatDivider() {
  return <span className="text-border mx-1">·</span>;
}
