interface KosmosLogoProps {
  className?: string;
  markClassName?: string;
}

export function KosmosLogo({
  className,
  markClassName = 'size-8',
}: KosmosLogoProps): React.JSX.Element {
  return (
    <span className={className}>
      <svg
        className={markClassName}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="48" rx="13" fill="#4F46E5" />
        <circle cx="24" cy="24" r="4" fill="white" />
        <ellipse
          cx="24"
          cy="24"
          rx="15"
          ry="7.5"
          stroke="white"
          strokeWidth="2"
        />
        <ellipse
          cx="24"
          cy="24"
          rx="15"
          ry="7.5"
          transform="rotate(60 24 24)"
          stroke="white"
          strokeWidth="2"
          strokeOpacity="0.72"
        />
        <circle cx="38.5" cy="20" r="3.5" fill="#A7F3D0" />
      </svg>
      <span>Kosmos</span>
    </span>
  );
}
