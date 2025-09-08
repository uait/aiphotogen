'use client';

import Image from 'next/image';

interface PixtorLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  className?: string;
  showText?: boolean;
  animate?: boolean;
}

const sizeConfig = {
  xs: { 
    logo: 'w-6 h-6 sm:w-8 sm:h-8',
    text: 'text-xs sm:text-sm' 
  },
  sm: { 
    logo: 'w-10 h-10 sm:w-12 sm:h-12',
    text: 'text-sm sm:text-base' 
  },
  md: { 
    logo: 'w-12 h-12 sm:w-16 sm:h-16',
    text: 'text-lg sm:text-xl' 
  },
  lg: { 
    logo: 'w-20 h-20 sm:w-24 sm:h-24',
    text: 'text-xl sm:text-2xl' 
  },
  xl: { 
    logo: 'w-24 h-24 sm:w-32 sm:h-32',
    text: 'text-2xl sm:text-3xl' 
  },
  xxl: { 
    logo: 'w-32 h-32 sm:w-40 sm:h-40',
    text: 'text-3xl sm:text-4xl' 
  }
};

export default function PixtorLogo({ 
  size = 'md', 
  className = '', 
  showText = true,
  animate = false 
}: PixtorLogoProps) {
  const config = sizeConfig[size];
  
  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      <div className={`relative ${config.logo} ${animate ? 'pixtor-glow' : ''} bg-gray-200 rounded-xl p-2 shadow-lg`}>
        <Image
          src="/pixtor-logo.png"
          alt="PixtorAI Logo"
          fill
          className={`object-contain ${animate ? 'animate-pulse' : ''}`}
          priority
          sizes="(max-width: 640px) 128px, 160px"
        />
      </div>
      {showText && (
        <span className={`font-bold pixtor-text-gradient ${config.text}`}>
          PixtorAI
        </span>
      )}
    </div>
  );
}