import { createContext, useContext, useState, ReactNode, forwardRef } from 'react';
import { ScanSearch, Aperture, TerminalSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ScoutLogo = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" fill="currentColor" className={className} {...props}>
      <path d="M1017.06,1011.87c-232.48,235.32-613.41,231.82-841.61-7.7C-43.54,774.3-39.52,411.06,184.97,186.05c223.2-223.73,583.85-230.25,814.84-14.73,121.24,113.12,189.07,272.24,186.31,438.33-2.5,150.88-62.98,294.84-169.06,402.22ZM589.49,556.52c-88.09-89.54-87.65-232.14.31-321.11,44.69-45.21,105.36-70.44,171.21-68.63-40.72-29.18-87.9-45.48-135.52-49.78-163.93-14.81-303.41,112.16-305.86,275.06-2.32,154.36,120.61,282.69,277.02,284.36,57.7.62,115.63-16.19,164.35-50.93-65.64,1.79-126.58-23.29-171.51-68.96ZM755.57,523.53c70.58-1.44,125.36-58.77,124.79-128.44-.57-69.99-56.46-125.85-126.4-126.42-70.75-.57-127.96,55.62-128.53,126.4-.58,71.79,57.45,129.95,130.14,128.47ZM965.17,283.22c9.23,29.43,13.66,59.19,16.03,89.37,1.23,15.58,1.01,29.28.1,44.87-5.22,89.48-41.79,174.37-101.71,238.33-145.54,157.77-391.26,163.6-545.03,15.03-102.35-98.89-143.22-248.88-99.56-387.81-112.09,128.03-148.07,305.18-95.45,466.8,42.95,131.93,141.62,239.88,269.39,295.07,112.57,48.48,240.09,52.26,355.41,10.61,132.52-48.04,238.03-152.07,288.07-283.04,63.73-166.77,30.14-355.18-87.25-489.24Z"/>
    </svg>
  )
) as unknown as LucideIcon;

export type ProductId = 'scout' | 'audit' | 'lens' | 'command';

export interface Product {
  id: ProductId;
  name: string;
  fullName: string;
  description: string;
  icon: LucideIcon;
  active: boolean;
}

export const PRODUCTS: Product[] = [
  { id: 'scout', name: 'Scout', fullName: 'GLIDE® Scout', description: 'Sales prospecting & pre-call intel', icon: ScoutLogo, active: true },
  { id: 'audit', name: 'Audit', fullName: 'GLIDE® Audit', description: 'Marketing website analysis', icon: ScanSearch, active: false },
  { id: 'lens', name: 'Lens', fullName: 'Lens', description: 'Client-facing report portal', icon: Aperture, active: false },
  { id: 'command', name: 'Command', fullName: 'GLIDE® Command', description: 'Agency delivery operations', icon: TerminalSquare, active: false },
];

interface ProductContextValue {
  currentProduct: Product;
  setCurrentProduct: (id: ProductId) => void;
  products: Product[];
}

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState<ProductId>(() => {
    return (localStorage.getItem('glide-product') as ProductId) || 'scout';
  });

  const setCurrentProduct = (id: ProductId) => {
    const product = PRODUCTS.find(p => p.id === id);
    if (product?.active) {
      setCurrentId(id);
      localStorage.setItem('glide-product', id);
    }
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
