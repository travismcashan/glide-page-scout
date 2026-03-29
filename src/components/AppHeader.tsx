import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Settings, Shield, ChevronDown, Check, Menu, Link2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProduct, PRODUCTS } from '@/contexts/ProductContext';
import { Badge } from '@/components/ui/badge';

const NAV_ITEMS = [
  { label: 'Chat', to: '/chat' },
  { label: 'Knowledge', to: '/knowledge' },
  { label: 'Sites', to: '/history', matchPrefix: '/sites/' },
  { label: 'Groups', to: '/groups' },
  { label: 'Wishlist', to: '/wishlist' },
  { label: 'Integrations', to: '/integrations' },
];

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { currentProduct, setCurrentProduct } = useProduct();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkBase =
    'text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md';
  const linkActive = 'text-foreground bg-accent/10';

  const ProductIcon = currentProduct.icon;

  const isNavActive = (item: typeof NAV_ITEMS[number]) =>
    location.pathname === item.to || (item.matchPrefix && location.pathname.startsWith(item.matchPrefix));

  return (
    <header className="border-b border-black/50 bg-background sticky top-0 z-40 shadow-sm shadow-primary/[0.03]">
      <div className="mx-auto px-3 sm:px-6 max-w-6xl h-[55px] flex items-center justify-between">
        {/* Brand + Product Switcher */}
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
          >
            <ProductIcon className="h-8 w-8 sm:h-8 sm:w-8 text-primary shrink-0" />
            <span className="text-lg sm:text-base font-semibold tracking-tight truncate">
              {currentProduct.fullName}
            </span>
          </button>

        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
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
                <Button variant="ghost" size="icon" className="ml-2 rounded-full">
                  <Avatar className="h-7 w-7">
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
                <DropdownMenuItem onClick={() => navigate('/connections')}>
                  <Link2 className="h-4 w-4 mr-2" /> Connections
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
        </nav>

        {/* Mobile hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Avatar className="h-7 w-7">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {(profile?.display_name || user.email || '?')[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-0 bg-transparent border-none outline-none">
                <Menu className="h-8 w-8 text-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[320px] p-0 border-none bg-background flex flex-col overflow-y-auto">
              {/* Nav section */}
              <nav className="flex-1 flex flex-col justify-center px-8 py-10">
                <button
                  onClick={() => { navigate('/'); setMobileOpen(false); }}
                  className={cn(
                    'text-left text-2xl font-semibold py-2.5 transition-colors tracking-tight',
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
                      'text-left text-2xl font-semibold py-2.5 transition-colors tracking-tight',
                      'text-foreground/40 active:text-foreground',
                      isNavActive(item) && 'text-foreground'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Bottom section — user info & secondary links */}
              <div className="px-8 pb-10 flex flex-col gap-3">
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
                        onClick={() => { navigate('/connections'); setMobileOpen(false); }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Link2 className="h-4 w-4" /> Connections
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
        </div>
      </div>
    </header>
  );
}
