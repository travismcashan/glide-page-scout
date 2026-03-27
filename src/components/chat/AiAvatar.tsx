import { useProduct } from '@/contexts/ProductContext';

/** Glide product avatar */
export function AiAvatar({ className = '' }: { className?: string }) {
  const { currentProduct } = useProduct();
  const Icon = currentProduct.icon;
  return (
    <Icon className={`h-6 w-6 text-primary ${className}`} />
  );
}
