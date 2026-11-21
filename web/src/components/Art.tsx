// Placeholder illustrations used when the CMS supplies no image.

/** Sunburst + rocket hero used on news items. */
export function RocketArt() {
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a1 = (i / 18) * Math.PI * 2, a2 = a1 + Math.PI / 18;
    return `M235 108 L${235 + 600 * Math.cos(a1)} ${108 + 600 * Math.sin(a1)} L${235 + 600 * Math.cos(a2)} ${108 + 600 * Math.sin(a2)} Z`;
  });
  return (
    <svg className="art" viewBox="0 0 470 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="470" height="200" fill="#f6e27a" />
      {rays.map((d, i) => <path key={i} d={d} fill="#f9ec9e" />)}
      <circle cx="200" cy="100" r="66" fill="#fff" />
      <g transform="translate(330 70) rotate(35)">
        <path d="M-6 30 L-30 150 L-14 150 Z" fill="#fff" opacity=".85" />
        <path d="M6 30 L20 160 L34 160 Z" fill="#fff" opacity=".7" />
        <path d="M0 -70 C28 -40 30 10 18 40 L-18 40 C-30 10 -28 -40 0 -70Z" fill="#4c4e5e" />
        <path d="M0 -70 C14 -55 20 -40 22 -28 L-22 -28 C-20 -40 -14 -55 0 -70Z" fill="#3b3d4c" />
        <circle cx="0" cy="-10" r="9" fill="#9fa1ad" stroke="#3b3d4c" strokeWidth="3" />
        <path d="M-18 20 L-38 52 L-16 40Z M18 20 L38 52 L16 40Z" fill="#4bb7c4" />
        <path d="M-10 40 L0 66 L10 40Z" fill="#f2a93b" />
      </g>
      <g fill="#6d6f7a">
        {[[20, 190, 34], [70, 185, 30], [120, 195, 32], [170, 188, 26], [250, 196, 30], [300, 190, 22], [400, 196, 34], [455, 190, 26]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  );
}

const offerGradients = [
  ['#2c7a3c', '#e0a434', '#3d2a1a'],
  ['#4a1e78', '#d74ac9', '#1a1a3a'],
  ['#5b6fe6', '#c88bf0', '#2b2f8a'],
];
export function OfferArt({ i }: { i: number }) {
  const [a, b, c] = offerGradients[i % offerGradients.length];
  return (
    <svg className="offer-img" viewBox="0 0 44 44" aria-hidden>
      <defs>
        <radialGradient id={`og${i}`} cx="35%" cy="35%" r="75%"><stop offset="0" stopColor={b} /><stop offset=".55" stopColor={a} /><stop offset="1" stopColor={c} /></radialGradient>
      </defs>
      <circle cx="22" cy="22" r="22" fill={`url(#og${i})`} />
      <path d="M6 30 C16 18 28 16 40 10" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

/** Right-hand "photo" area of a resource banner. */
export function ResourcePhoto({ art }: { art: 'phone' | 'laptop' | 'network' }) {
  if (art === 'phone') return (
    <svg className="photo" viewBox="0 0 120 110" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="110" fill="#d9d4cf" />
      <rect x="40" y="10" width="46" height="88" rx="7" fill="#2a2b31" transform="rotate(12 63 54)" />
      <rect x="45" y="18" width="36" height="72" rx="3" fill="#f2f2f4" transform="rotate(12 63 54)" />
      <g transform="rotate(12 63 54)" fill="#e05a5a">{[28, 40, 52].map((y) => <rect key={y} x="49" y={y} width="28" height="7" rx="2" />)}</g>
      <path d="M30 110 C34 80 52 70 64 78 L70 110Z" fill="#e8b79a" />
    </svg>
  );
  if (art === 'laptop') return (
    <svg className="photo" viewBox="0 0 120 110" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="110" fill="#e9ecef" />
      <rect x="22" y="22" width="92" height="58" rx="3" fill="#2d2f38" />
      <rect x="26" y="26" width="84" height="50" fill="#fff" />
      <rect x="26" y="26" width="84" height="7" fill="#34364f" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={30 + i * 20} y="37" width="16" height="9" fill="#eef" />)}
      <circle cx="40" cy="60" r="8" fill="none" stroke="#ecc531" strokeWidth="4" />
      {[60, 66, 72, 78, 84, 90, 96, 102].map((x, i) => <rect key={x} x={x} y={70 - (i % 4) * 4 - 4} width="4" height={(i % 4) * 4 + 4} fill="#ecc531" />)}
      <path d="M14 80 H122 L116 88 H20Z" fill="#9ea2ab" />
    </svg>
  );
  return (
    <svg className="photo" viewBox="0 0 120 110" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="110" fill="#283a52" />
      <rect x="10" y="22" width="110" height="40" fill="#3c4f69" />
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i}>
          <rect x={16 + (i % 6) * 17} y={i < 6 ? 28 : 44} width="12" height="10" fill="#1b2433" />
          <circle cx={22 + (i % 6) * 17} cy={i < 6 ? 26 : 42} r="1.5" fill={i % 3 ? '#9be36d' : '#f4d03f'} />
        </g>
      ))}
      <text x="30" y="18" fill="#cfd6e0" fontSize="8" fontFamily="monospace">1 2 3 4 5</text>
      <text x="40" y="76" fill="#cfd6e0" fontSize="8" fontFamily="monospace">6 7 8 9 10</text>
    </svg>
  );
}
