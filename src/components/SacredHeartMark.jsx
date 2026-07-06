export function SacredHeartMark({ size = 30, color = '#E8D5A0' }) {
  return (
    <svg
      className="sacred-heart-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* radiating rays */}
      <g stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <line x1="32" y1="2" x2="32" y2="12" />
        <line x1="14" y1="8" x2="19" y2="16" />
        <line x1="50" y1="8" x2="45" y2="16" />
        <line x1="4" y1="24" x2="13" y2="26" />
        <line x1="60" y1="24" x2="51" y2="26" />
      </g>
      {/* heart */}
      <path
        d="M32 54C32 54 10 40.5 10 25.5C10 17.5 16.5 12 23.5 12C27.5 12 30.5 14 32 17C33.5 14 36.5 12 40.5 12C47.5 12 54 17.5 54 25.5C54 40.5 32 54 32 54Z"
        fill={color}
      />
      {/* small cross on top */}
      <line x1="32" y1="10" x2="32" y2="2" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="5" x2="36" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
