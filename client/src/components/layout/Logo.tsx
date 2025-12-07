import { Code2 } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({ size = 'md', showText = true }: LogoProps) {
  const iconSizes = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const glowSizes = {
    sm: 'blur-md',
    md: 'blur-lg',
    lg: 'blur-xl',
  };

  return (
    <div className="flex items-center gap-2" data-testid="logo-novacode">
      <div className="relative">
        <Code2 className={`${iconSizes[size]} text-primary`} />
        <div className={`absolute inset-0 bg-primary/30 ${glowSizes[size]} rounded-full`} />
      </div>
      {showText && (
        <span className={`font-bold tracking-tight ${textSizes[size]}`}>
          <span className="text-primary">Nova</span>Code
        </span>
      )}
    </div>
  );
}
