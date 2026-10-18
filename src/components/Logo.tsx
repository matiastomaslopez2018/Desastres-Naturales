/** Logo del Atlas: un círculo con el trazo de un sismograma en naranja (también es el favicon). */
export const LOGO_PATH = 'M3.5 16H9l2-4.5 2 9 2.2-13.5 2.4 18 2-12 1.9 5L23 16h5.5';

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="16" cy="16" r="14.75" fill="#ffffff" stroke="#141414" strokeWidth="1.5" />
      <path d={LOGO_PATH} fill="none" stroke="#e8590c" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
