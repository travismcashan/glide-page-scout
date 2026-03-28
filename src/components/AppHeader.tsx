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
import { LogOut, Settings, Shield, ChevronDown, Check, Sparkles, MessageSquare, Link2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProduct, PRODUCTS } from '@/contexts/ProductContext';
import { Badge } from '@/components/ui/badge';

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { currentProduct, setCurrentProduct } = useProduct();

  const linkBase =
    'text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md';
  const linkActive = 'text-foreground bg-accent/10';

  const ProductIcon = currentProduct.icon;

  return (
    <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-40 shadow-sm shadow-primary/[0.03]">
      <div className="max-w-6xl mx-auto px-6 h-[55px] flex items-center justify-between">
        {/* Brand + Product Switcher */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <ProductIcon className="h-7 w-7 text-primary" />
            <span className="text-base font-semibold tracking-tight">
              {currentProduct.fullName}
            </span>
          </button>

          {/* Product switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-0.5">
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Glide Products
              </DropdownMenuLabel>
              {PRODUCTS.map((product) => {
                const Icon = product.icon;
                const isCurrent = product.id === currentProduct.id;
                return (
                  <DropdownMenuItem
                    key={product.id}
                    disabled={!product.active}
                    onClick={() => product.active && setCurrentProduct(product.id)}
                    className="flex items-center gap-3 py-2"
                  >
                    <Icon className={`h-5 w-5 ${
                      isCurrent ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{product.fullName}</span>
                        {!product.active && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Soon
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{product.description}</span>
                    </div>
                    {isCurrent && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <NavLink to="/chat" className={linkBase} activeClassName={linkActive}>
            Chat
          </NavLink>
          <button
            onClick={() => navigate('/history')}
            className={cn(linkBase, (location.pathname === '/history' || location.pathname.startsWith('/sites/')) && linkActive)}
          >
            Sites
          </button>
          <NavLink to="/groups" className={linkBase} activeClassName={linkActive}>
            Groups
          </NavLink>
          <NavLink to="/wishlist" className={linkBase} activeClassName={linkActive}>
            Wishlist
          </NavLink>
          <NavLink to="/integrations" className={linkBase} activeClassName={linkActive}>
            Integrations
          </NavLink>

          {/* Avatar / Sign In */}
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
                  <p className="text-sm font-medium truncate">
                    {profile?.display_name || 'User'}
                  </p>
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
            <Button
              variant="default"
              size="sm"
              className="ml-2"
              onClick={() => navigate('/login')}
            >
              Sign In
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
