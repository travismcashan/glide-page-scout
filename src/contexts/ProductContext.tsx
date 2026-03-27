import { createContext, useContext, useState, ReactNode } from 'react';
import { Crosshair, ClipboardCheck, Eye, Command } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
  { id: 'scout', name: 'Scout', fullName: 'Glide Scout', description: 'Sales prospecting & pre-call intel', icon: Crosshair, active: true },
  { id: 'audit', name: 'Audit', fullName: 'Glide Audit', description: 'Marketing website analysis', icon: ClipboardCheck, active: false },
  { id: 'lens', name: 'Lens', fullName: 'Lens', description: 'Client-facing report portal', icon: Eye, active: false },
  { id: 'command', name: 'Command', fullName: 'Glide Command', description: 'Agency delivery operations', icon: Command, active: false },
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
