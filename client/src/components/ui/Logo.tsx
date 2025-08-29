import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

  export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-24 h-6',
    md: 'w-32 h-8',
    lg: 'w-40 h-10'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <img 
        src="/goodhabit.ai(200 x 40 px).png"
        alt="goodhabit.ai logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
};
