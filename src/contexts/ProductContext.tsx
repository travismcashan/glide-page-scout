import { createContext, useContext, useState, ReactNode, forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fibonacci radii: 46, 28 (46×0.618), 18 (46×0.382) — matching AnimatedLogo ratios
// strokeWidth=9 matches AnimatedLogo's lineWidth=3 on a 34px canvas (3/34×100≈9)

// Growth: bottom-aligned — the sales funnel (TAM → qualified leads → closed)
const GrowthIcon = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 104" fill="none" className={className} {...props}>
      <circle className="growth-c1" cx="50" cy="49" r="46" stroke="currentColor" strokeWidth="9"/>
      <circle className="growth-c2" cx="50" cy="67" r="28" stroke="currentColor" strokeWidth="9"/>
      <circle className="growth-c3" cx="50" cy="77" r="18" stroke="currentColor" strokeWidth="9"/>
    </svg>
  )
) as unknown as LucideIcon;

// Delivery: right-offset arrangement — layered relationship, circles resting at side
const DeliveryIcon = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 104" fill="none" className={className} {...props}>
      <circle className="delivery-c1" cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="9"/>
      <circle className="delivery-c2" cx="68" cy="50" r="28" stroke="currentColor" strokeWidth="9"/>
      <circle className="delivery-c3" cx="68" cy="60" r="18" stroke="currentColor" strokeWidth="9"/>
    </svg>
  )
) as unknown as LucideIcon;

// Admin: concentric — precise, ordered, centered
const AdminIcon = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 104" fill="none" className={className} {...props}>
      <circle className="admin-c1" cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="9"/>
      <circle className="admin-c2" cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="9"/>
      <circle className="admin-c3" cx="50" cy="50" r="13" stroke="currentColor" strokeWidth="9"/>
    </svg>
  )
) as unknown as LucideIcon;

export type ProductId = 'growth' | 'delivery' | 'admin';

export interface Product {
  id: ProductId;
  name: string;
  fullName: string;
  discipline: string;
  description: string;
  icon: LucideIcon;
  color: string;
  active: boolean;
  settleAngle?: number; // legacy single settle angle
  settleAngles?: [number, number, number]; // per-circle settle angles
  startAngles?: [number, number, number]; // start from resting state (no fade-in)
  introAngles?: [number, number, number]; // orbital sweep angles
  bloomAnimation?: boolean; // CSS bloom animation (Growth)
}

export const PRODUCTS: Product[] = [
  { id: 'growth',   name: 'Growth',   fullName: 'GLIDE® Growth',   discipline: 'Sales Intelligence',    description: 'Walk in knowing. Walk out winning.',      icon: GrowthIcon,   color: 'hsl(var(--primary))', active: true,  bloomAnimation: true },
  { id: 'delivery', name: 'Delivery', fullName: 'GLIDE® Delivery', discipline: 'Client Delivery',        description: 'The partner that never stops working.',   icon: DeliveryIcon, color: '#2DD4BF',              active: true,  settleAngle: 0, settleAngles: [0, 0, Math.PI / 2], startAngles: [0, 0, Math.PI / 2], introAngles: [0, 2 * Math.PI, 2 * Math.PI] },
  { id: 'admin',    name: 'Admin',    fullName: 'GLIDE® Admin',    discipline: 'Business Operations',    description: 'The business, beautifully in order.',     icon: AdminIcon,    color: '#FB923C',              active: true },
];

interface ProductContextValue {
  currentProduct: Product;
  setCurrentProduct: (id: ProductId) => void;
  products: Product[];
}

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState<ProductId>(() => {
    const stored = localStorage.getItem('glide-product') as ProductId;
    return PRODUCTS.find(p => p.id === stored) ? stored : 'growth';
  });

  const setCurrentProduct = (id: ProductId) => {
    const product = PRODUCTS.find(p => p.id === id);
    if (product?.active) {
      setCurrentId(id);
      localStorage.setItem('glide-product', id);
    }
    // inactive products are no-ops — coming soon
  };

  const currentProduct = PRODUCTS.find(p => p.id === currentId) || PRODUCTS[0];

  return (
    <ProductContext.Provider value={{ currentProduct, setCurrentProduct, products: PRODUCTS }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProduct must be used within ProductProvider');
  return ctx;
}
