import { useState, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Settings, Shield, ChevronDown, Check, Menu, Link2, Heart, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProduct, PRODUCTS, type ProductId } from '@/contexts/ProductContext';
import { AnimatedLogo } from '@/components/AnimatedLogo';
import { AnimatedProductIcon } from '@/components/AnimatedProductIcon';
import { useActiveCrawl } from '@/hooks/use-active-crawl';

function darkenHex(hex: string, factor = 0.55): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

const NAV_ITEMS = [
  { label: 'Chat', to: '/chat' },
  { label: 'Knowledge', to: '/knowledge' },
  { label: 'Sites', to: '/sites', matchPrefix: '/sites' },
  { label: 'Groups', to: '/groups' },
  { label: 'Integrations', to: '/integrations' },
];

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isSharedView = searchParams.get('view') === 'shared';
  const { user, profile, isAdmin, signOut } = useAuth();
  const { currentProduct, setCurrentProduct } = useProduct();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<ProductId | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCrawling = useActiveCrawl();

  const linkBase =
    'text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md';
  const linkActive = 'text-foreground bg-accent/10';

  const previewProduct = hoveredId ? PRODUCTS.find(p => p.id === hoveredId) : null;
  const displayProduct = previewProduct || currentProduct;
  const PreviewIcon = displayProduct.icon;

  const openSwitcher = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setSwitcherOpen(true);
  };
  const closeSwitcher = () => {
    closeTimer.current = setTimeout(() => {
      setSwitcherOpen(false);
      setHoveredId(null);
    }, 120);
  };

  const isNavActive = (item: typeof NAV_ITEMS[number]) =>
    location.pathname === item.to || (item.matchPrefix && location.pathname.startsWith(item.matchPrefix));

  return (
    <header className="border-b border-foreground/15 bg-background sticky top-0 z-40">
      <div className="mx-auto px-3 sm:px-6 max-w-6xl h-[55px] flex items-center justify-between">
        {/* Brand + Product Switcher */}
        <div
          className="relative flex items-center gap-1 min-w-0 cursor-pointer self-stretch"
          onMouseEnter={openSwitcher}
          onMouseLeave={closeSwitcher}
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 min-w-0 cursor-pointer"
          >
            <div className="relative w-[34px] h-[34px] shrink-0">
              <AnimatePresence>
                {!previewProduct && (
                  <motion.div
                    key="animated"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <AnimatedLogo size={34} isAnimating={isCrawling} />
                  </motion.div>
                )}
                {previewProduct && previewProduct.settleAngle !== undefined && (
                  <motion.div
                    key={previewProduct.id}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: displayProduct.color }}
                  >
                    <AnimatedProductIcon size={34} settleAngle={previewProduct.settleAngle} />
                  </motion.div>
                )}
                {previewProduct && previewProduct.settleAngle === undefined && (
                  <motion.div
                    key={previewProduct.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: displayProduct.color }}
                    data-hovered="true"
                  >
                    <PreviewIcon className="w-[34px] h-[34px]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={displayProduct.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="text-xl sm:text-lg font-semibold tracking-tight truncate flex items-center gap-1"
              >
                {displayProduct.fullName}
                <ChevronDown className={cn(
                  'h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200',
                  switcherOpen && 'rotate-180'
                )} />
              </motion.span>
            </AnimatePresence>
          </button>

          {/* Product switcher panel */}
          <AnimatePresence>
            {switcherOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                onMouseEnter={openSwitcher}
                onMouseLeave={closeSwitcher}
                className="absolute top-full left-0 w-80 bg-background border border-foreground/15 border-t-0 rounded-b-xl shadow-md overflow-hidden z-50"
              >
                {PRODUCTS.map((product, index) => {
                  const Icon = product.icon;
                  const isCurrent = product.id === currentProduct.id;
                  const isHovered = hoveredId === product.id;
                  const hoverBg = product.color.startsWith('hsl(') ? product.color.replace(/\)$/, ' / 0.12)') : `${product.color}1F`;
                  return (
                    <div key={product.id}>
                      {index > 0 && <div className="h-px bg-border/50 mx-3" />}
                      <button
                        onMouseEnter={() => setHoveredId(product.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => {
                          if (product.active) {
                            setCurrentProduct(product.id);
                            setSwitcherOpen(false);
                          }
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 pl-3 pr-4 py-3 text-left transition-colors',
                          !product.active ? 'cursor-not-allowed' : 'cursor-pointer'
                        )}
                        style={isHovered ? { backgroundColor: hoverBg } : undefined}
                      >
                        <div className="shrink-0 w-[34px] h-[34px] flex items-center justify-center">
                          <Icon className="w-[34px] h-[34px]" style={{ color: product.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{product.fullName}</span>
                            {!product.active && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                                style={{ backgroundColor: `${product.color}25`, color: product.color.startsWith('hsl') ? 'hsl(var(--primary))' : darkenHex(product.color) }}
                              >
                                Coming Soon
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{product.description}</p>
                        </div>
                        {isCurrent && <Check className="h-5 w-5 text-primary shrink-0" strokeWidth={2.5} />}
                      </button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop nav - hidden in shared view */}
        {!isSharedView && <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) =>
            item.matchPrefix ? (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cn(linkBase, isNavActive(item) && linkActive)}
              >
                {item.label}
              </button>
            ) : (
              <NavLink key={item.to} to={item.to} className={linkBase} activeClassName={linkActive}>
                {item.label}
              </NavLink>
            )
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-2 rounded-full h-9 w-9">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {(profile?.display_name || user.email || '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{profile?.display_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <Shield className="h-4 w-4 mr-2" /> Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/wishlist')}>
                  <Heart className="h-4 w-4 mr-2" /> Wishlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/connections')}>
                  <Link2 className="h-4 w-4 mr-2" /> Connections
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/usage')}>
                  <Activity className="h-4 w-4 mr-2" /> Usage
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="default" size="sm" className="ml-2" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          )}
        </nav>}

        {/* Mobile: left hamburger - hidden in shared view */}
        {isSharedView ? null :
        <div className="flex md:hidden items-center gap-2">
          {location.pathname === '/chat' ? (
            <button
              className="p-0 bg-transparent border-none outline-none"
              onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-chat-drawer'))}
            >
              <Menu className="h-7 w-7 text-foreground" />
            </button>
          ) : (
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-0 bg-transparent border-none outline-none">
                <Menu className="h-7 w-7 text-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-[340px] p-0 border-none bg-background flex flex-col overflow-y-auto">
              {/* Nav section */}
              <nav className="flex-1 flex flex-col px-6 pt-12 pb-4">
                <button
                  onClick={() => { navigate('/'); setMobileOpen(false); }}
                  className={cn(
                    'text-left text-base font-semibold py-1.5 transition-colors tracking-tight',
                    'text-foreground/40 active:text-foreground',
                    location.pathname === '/' && 'text-foreground'
                  )}
                >
                  New Search
                </button>
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.to}
                    onClick={() => { navigate(item.to); setMobileOpen(false); }}
                    className={cn(
                      'text-left text-base font-semibold py-1.5 transition-colors tracking-tight',
                      'text-foreground/40 active:text-foreground',
                      isNavActive(item) && 'text-foreground'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Bottom section — user info & secondary links */}
              <div className="px-6 pb-8 flex flex-col gap-3">
                {user ? (
                  <>
                    <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border/30">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-sm">
                          {(profile?.display_name || user.email || '?')[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-base font-medium truncate">{profile?.display_name || 'User'}</p>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {isAdmin && (
                        <button
                          onClick={() => { navigate('/admin'); setMobileOpen(false); }}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Shield className="h-4 w-4" /> Admin
                        </button>
                      )}
                      <button
                        onClick={() => { navigate('/wishlist'); setMobileOpen(false); }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Heart className="h-4 w-4" /> Wishlist
                      </button>
                      <button
                        onClick={() => { navigate('/connections'); setMobileOpen(false); }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Link2 className="h-4 w-4" /> Connections
                      </button>
                      <button
                        onClick={() => { navigate('/usage'); setMobileOpen(false); }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Activity className="h-4 w-4" /> Usage
                      </button>
                      <button
                        onClick={() => { navigate('/settings'); setMobileOpen(false); }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Settings className="h-4 w-4" /> Settings
                      </button>
                      <button
                        onClick={() => { signOut(); setMobileOpen(false); }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full text-base"
                    onClick={() => { navigate('/login'); setMobileOpen(false); }}
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
          )}
        </div>}
      </div>
    </header>
  );
}
