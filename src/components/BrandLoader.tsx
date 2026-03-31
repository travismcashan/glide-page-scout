import { DotLottiePlayer } from '@dotlottie/react-player';

interface BrandLoaderProps {
  size?: number;
  className?: string;
}

export function BrandLoader({ size = 48, className = '' }: BrandLoaderProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <DotLottiePlayer src="/loader.lottie" autoplay loop style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
