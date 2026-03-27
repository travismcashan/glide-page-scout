import { useProduct } from '@/contexts/ProductContext';

/** Glide product avatar */
export function AiAvatar({ className = '' }: { className?: string }) {
  const { currentProduct } = useProduct();
  const Icon = currentProduct.icon;
  return (
    <div className={`h-6 w-6 rounded-md bg-primary flex items-center justify-center ${className}`}>
      <Icon className="h-3 w-3 text-primary-foreground" />
    </div>
  );
}
