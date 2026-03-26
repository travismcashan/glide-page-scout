/** Agency Atlas logo avatar */
export function AiAvatar({ className = '' }: { className?: string }) {
  return (
    <img
      src="/agency-atlas-logo.png"
      alt="Agency Atlas"
      className={`rounded ${className}`}
    />
  );
}
