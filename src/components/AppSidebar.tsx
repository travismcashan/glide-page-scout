import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  ChevronUp, ChevronsUpDown, LogOut, Shield, PanelLeftClose, PanelLeft,
  Settings, X, Cable, ListChecks, Layers, BarChart3, GitCompareArrows, Link2, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProduct, PRODUCTS, type ProductId } from '@/contexts/ProductContext';
import { WORKSPACE_NAV, WORKSPACE_COMPANY_TABS, WORKSPACE_DEFAULT_ROUTE, TAB_ICONS } from '@/config/workspace-nav';
import { useCompany } from '@/hooks/useCompany';
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

  // Detect if we're inside a company detail page
  const companyMatch = location.pathname.match(/^\/companies\/([^/]+)$/);
  const activeCompanyId = companyMatch?.[1] || null;

  const isActive = (item: { to: string; matchPrefix?: string }) => {
    // Handle routes with query params (e.g. /pipeline?tab=leads)
    const [itemPath, itemSearch] = item.to.split('?');
    if (itemSearch && location.pathname === itemPath) {
      return location.search === `?${itemSearch}`;
    }
    return location.pathname === item.to ||
      (item.matchPrefix && location.pathname.startsWith(item.matchPrefix));
  };

  const handleNav = (to: string) => {
    navigate(to);
    setOpenMobile(false);
  };

  const handleWorkspaceSwitch = (id: ProductId) => {
    setCurrentProduct(id);
    navigate(WORKSPACE_DEFAULT_ROUTE[id]);
  };

  // Get company name for contextual section (reads from TanStack cache — no extra fetch)
  const { company: activeCompany } = useCompany(activeCompanyId || undefined);

  // Get company tabs for contextual section
  const companyTabs = activeCompanyId
    ? WORKSPACE_COMPANY_TABS[currentProduct.id]
    : [];

  // Read active tab from URL search params (synced with CompanyDetailPage)
  const activeTabParam = new URLSearchParams(location.search).get('tab');

  return (
    <Sidebar collapsible="icon">
      {/* ── Workspace switcher + collapse toggle ────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="flex-1 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
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
              <button
                onClick={toggleSidebar}
                className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:hidden"
                title={state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                {state === 'expanded' ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mb-1" />

      {/* ── Global nav (max 3-4 items per workspace) ────── */}
      <SidebarContent>
        <SidebarGroup>
          {/* Workspace name already in switcher above — no label needed */}
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

        {/* ── Contextual: Company tabs (when inside a company) ── */}
        {activeCompanyId && companyTabs.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center justify-between">
                <span className="truncate">{activeCompany?.name || 'Company'}</span>
                <button
                  onClick={() => handleNav('/companies')}
                  className="h-4 w-4 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                  title="Back to list"
                >
                  <X className="size-3" />
                </button>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {companyTabs.map((tab) => {
                    const Icon = tab.icon || TAB_ICONS[tab.value];
                    // Tab is active if it matches the URL search param, or if no param and it's 'overview'
                    const isTabActive = activeTabParam
                      ? activeTabParam === tab.value
                      : tab.value === 'overview';
                    return (
                      <SidebarMenuItem key={tab.value}>
                        <SidebarMenuButton
                          tooltip={tab.label}
                          isActive={isTabActive}
                          onClick={() => {
                            // Navigate to company page with tab param
                            navigate(`/companies/${activeCompanyId}?tab=${tab.value}`);
                            setOpenMobile(false);
                          }}
                        >
                          {Icon && <Icon />}
                          <span>{tab.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Spacer to push settings to bottom */}
        <div className="flex-1" />

        {/* ── Utility: Settings (absorbs Connections, Wishlist, Services, Usage) ── */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Settings"
                  isActive={location.pathname.startsWith('/settings') || location.pathname === '/connections' || location.pathname === '/wishlist' || location.pathname === '/services' || location.pathname === '/usage'}
                  onClick={() => handleNav('/settings')}
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
                  <DropdownMenuItem onClick={() => { navigate('/connections'); setOpenMobile(false); }}>
                    <Cable className="mr-2 h-4 w-4" />
                    Connections
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate('/wishlist'); setOpenMobile(false); }}>
                    <ListChecks className="mr-2 h-4 w-4" />
                    Wishlist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate('/services'); setOpenMobile(false); }}>
                    <Layers className="mr-2 h-4 w-4" />
                    Services
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate('/usage'); setOpenMobile(false); }}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Usage
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate('/projects/mapping'); setOpenMobile(false); }}>
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                    Project Mapping
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate('/companies/mapping'); setOpenMobile(false); }}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Company Mapping
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate('/companies/cleanup'); setOpenMobile(false); }}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Cleanup
                  </DropdownMenuItem>
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
