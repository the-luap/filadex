import { FC } from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  color?: string; // für einfarbige Nutzung (wenn als Filter angewandt)
}

export const Logo: FC<LogoProps> = ({
  className = '',
  size = 40,
  color
}) => {
  // Wenn Farbe gesetzt ist, wird ein Filter angewendet (für einfarbige Darstellung)
  const filter = color ? 'brightness(0) saturate(100%) invert(100%)' : undefined;

  return (
    <img
      src="/logo.svg"
      alt="Filadex Logo"
      width={size}
      height={size}
      className={className}
      style={{
        filter,
        width: size,
        height: size
      }}
    />
  );
};

export default Logo;