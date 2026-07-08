interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 20, className = '' }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded shrink-0 ${className}`}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
    >
      {name}
    </span>
  );
}
