import { Code2, Sparkles } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'default' | 'pro';
}

export default function Logo({ size = 'md', showText = true, variant = 'pro' }: LogoProps) {
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

  const badgeSizes = {
    sm: 'text-[8px] px-1',
    md: 'text-[9px] px-1.5',
    lg: 'text-[10px] px-2',
  };

  return (
    <div className="flex items-center gap-2" data-testid="logo-novacode">
      <div className="relative">
        <Code2 className={`${iconSizes[size]} text-primary`} />
        <div className={`absolute inset-0 bg-primary/30 ${glowSizes[size]} rounded-full`} />
        {variant === 'pro' && (
          <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
        )}
      </div>
      {showText && (
        <div className="flex items-center gap-1.5">
          <span className={`font-bold tracking-tight ${textSizes[size]}`}>
            <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">Nova</span>
            <span>Code</span>
          </span>
          {variant === 'pro' && (
            <span className={`${badgeSizes[size]} py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold`}>
              IDE PRO
            </span>
          )}
        </div>
      )}
    </div>
  );
}
