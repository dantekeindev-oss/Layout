interface AvatarProps {
  female: boolean;
  isLeader?: boolean;
  size?: number;
}

/**
 * Cartoon headset avatar matching the illustration style.
 * Circular frame with colored background, character with headset.
 */
export function AgentAvatar({ female, isLeader = false, size = 44 }: AvatarProps) {
  const circleBg = isLeader
    ? '#f59e0b'
    : female
    ? '#a78bfa'
    : '#60a5fa';

  const skin = '#fbbf24';
  const skinDark = '#f59e0b';
  const hairColor = female ? '#7c3aed' : '#1e3a5f';
  const shirtColor = isLeader
    ? '#d97706'
    : female
    ? '#7c3aed'
    : '#1d4ed8';
  const headsetColor = '#1e293b';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Circular background */}
      <circle cx="24" cy="24" r="24" fill={circleBg} />

      {/* Shirt / body */}
      <ellipse cx="24" cy="46" rx="14" ry="9" fill={shirtColor} />

      {/* Neck */}
      <rect x="21" y="35" width="6" height="6" rx="3" fill={skin} />

      {/* Head */}
      <ellipse cx="24" cy="27" rx="10" ry="11" fill={skin} />

      {/* Hair */}
      {female ? (
        <>
          <ellipse cx="24" cy="18" rx="10" ry="6" fill={hairColor} />
          <rect x="14" y="17" width="4" height="12" rx="2" fill={hairColor} />
          <rect x="30" y="17" width="4" height="12" rx="2" fill={hairColor} />
        </>
      ) : (
        <>
          <ellipse cx="24" cy="18" rx="10" ry="5.5" fill={hairColor} />
          <rect x="14" y="17" width="3" height="7" rx="1.5" fill={hairColor} />
          <rect x="31" y="17" width="3" height="7" rx="1.5" fill={hairColor} />
        </>
      )}

      {/* Eyes */}
      <ellipse cx="20.5" cy="27" rx="1.6" ry="1.8" fill="#1e293b" />
      <ellipse cx="27.5" cy="27" rx="1.6" ry="1.8" fill="#1e293b" />
      <circle cx="21.2" cy="26.3" r="0.55" fill="white" />
      <circle cx="28.2" cy="26.3" r="0.55" fill="white" />

      {/* Smile */}
      <path d="M20.5 31.5 Q24 34.5 27.5 31.5" stroke={skinDark} strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Headset arc */}
      <path d="M13.5 23 Q13.5 13 24 13 Q34.5 13 34.5 23"
        stroke={headsetColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Ear cups */}
      <rect x="9.5" y="21" width="6" height="8" rx="3" fill={headsetColor} />
      <rect x="32.5" y="21" width="6" height="8" rx="3" fill={headsetColor} />
      {/* Mic boom */}
      <path d="M33 26 Q38 28 38 33" stroke={headsetColor} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="38" cy="34" r="1.8" fill={headsetColor} />
    </svg>
  );
}
