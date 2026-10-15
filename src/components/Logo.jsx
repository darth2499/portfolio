// Wrap's logo: a one-stroke "W" that folds over itself (two shades = the fold) on a brand-blue tile.
export function LogoMark({ size = 30, className = 'brand-mark', style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Wrap">
      <rect width="100" height="100" rx="23" fill="#3346d3" />
      <path d="M22 30 L35 72 L50 44" fill="none" stroke="#fff" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M50 44 L65 72 L78 30" fill="none" stroke="#c7cdfb" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
