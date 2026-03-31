import { memo } from 'react';
import { DotLottiePlayer } from '@dotlottie/react-player';

interface BrandLoaderProps {
  size?: number;
  className?: string;
}

export const BrandLoader = memo(function BrandLoader({ size = 48, className = '' }: BrandLoaderProps) {
  return (
    <div className={className} style={{ width: size, height: size, willChange: 'transform' }}>
      <DotLottiePlayer src="/loader.lottie" autoplay loop renderer="canvas" style={{ width: size, height: size }} />
    </div>
  );
});
