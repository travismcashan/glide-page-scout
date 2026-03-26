/** A small modern geometric AI avatar – a stylised crystal / neural node shape rendered as inline SVG. */
export function AiAvatar({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer hexagonal glow */}
      <path
        d="M14 2L24.5 8.5V19.5L14 26L3.5 19.5V8.5L14 2Z"
        className="fill-primary/10 stroke-primary/30"
        strokeWidth="0.5"
      />
      {/* Inner diamond */}
      <path
        d="M14 6L20 14L14 22L8 14L14 6Z"
        className="fill-primary/20 stroke-primary/50"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      {/* Center dot */}
      <circle cx="14" cy="14" r="2.5" className="fill-primary" />
      {/* Connecting lines – neural web */}
      <line x1="14" y1="6" x2="14" y2="11.5" className="stroke-primary/40" strokeWidth="0.6" />
      <line x1="14" y1="16.5" x2="14" y2="22" className="stroke-primary/40" strokeWidth="0.6" />
      <line x1="8" y1="14" x2="11.5" y2="14" className="stroke-primary/40" strokeWidth="0.6" />
      <line x1="16.5" y1="14" x2="20" y2="14" className="stroke-primary/40" strokeWidth="0.6" />
    </svg>
  );
}
