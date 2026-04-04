import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronUp, ChevronsUpDown, LogOut, Shield, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProduct, PRODUCTS, type ProductId } from '@/contexts/ProductContext';
import { WORKSPACE_NAV, SECONDARY_NAV, WORKSPACE_DEFAULT_ROUTE } from '@/config/workspace-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { currentProduct, setCurrentProduct } = useProduct();
  const { state, toggleSidebar, setOpenMobile } = useSidebar();

  const navItems = WORKSPACE_NAV[currentProduct.id];

  const isActive = (item: { to: string; matchPrefix?: string }) =>
    location.pathname === item.to ||
    (item.matchPrefix && location.pathname.startsWith(item.matchPrefix));

  const handleNav = (to: string) => {
    navigate(to);
    setOpenMobile(false);
  };

  const handleWorkspaceSwitch = (id: ProductId) => {
    setCurrentProduct(id);
    navigate(WORKSPACE_DEFAULT_ROUTE[id]);
  };

  return (
    <Sidebar collapsible="icon">
      {/* ── Workspace switcher ─────────────────────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div
                    className="flex aspect-square size-8 items-center justify-center"
                    style={{ color: currentProduct.color }}
                  >
                    {(() => { const Icon = currentProduct.icon; return <Icon className="size-8" />; })()}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{currentProduct.fullName}</span>
                    <span className="truncate text-xs text-muted-foreground">{currentProduct.discipline}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="start"
                sideOffset={4}
              >
                {PRODUCTS.map((product) => {
                  const Icon = product.icon;
                  const isCurrent = product.id === currentProduct.id;
                  return (
                    <DropdownMenuItem
                      key={product.id}
                      onClick={() => handleWorkspaceSwitch(product.id)}
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center" style={{ color: product.color }}>
                        <Icon className="size-6" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{product.fullName}</span>
                        <p className="text-xs text-muted-foreground">{product.discipline}</p>
                      </div>
                      {isCurrent && <span className="text-xs text-primary">Active</span>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Collapse/expand toggle ───────────────────── */}
      <div className="px-2 flex justify-end">
        <button
          onClick={toggleSidebar}
          className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          title={state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {state === 'expanded' ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
        </button>
      </div>

      <SidebarSeparator />

      {/* ── Primary nav ────────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{currentProduct.name}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to + item.label}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={isActive(item)}
                    onClick={() => handleNav(item.to)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* ── Secondary nav ──────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY_NAV.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={isActive(item)}
                    onClick={() => handleNav(item.to)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Admin"
                    isActive={location.pathname === '/admin'}
                    onClick={() => handleNav('/admin')}
                  >
                    <Shield />
                    <span>Admin</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── User footer ──────────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="rounded-lg text-xs">
                        {(profile?.display_name || user.email || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{profile?.display_name || 'User'}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                    <ChevronUp className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="start"
                  sideOffset={4}
                >
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{profile?.display_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton onClick={() => navigate('/login')}>
                <span>Sign In</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
