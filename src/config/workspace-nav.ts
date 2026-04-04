import {
  Search,
  Building2,
  TrendingUp,
  Globe,
  BookOpen,
  MessageSquare,
  LayoutList,
  FolderKanban,
  Clock,
  Receipt,
  FileText,
  Link2,
  Heart,
  Wrench,
  Activity,
  Settings,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProductId } from '@/contexts/ProductContext';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  matchPrefix?: string;
}

export interface CompanyTab {
  value: string;
  label: string;
  /** Tab only renders if condition returns true (checked against company record) */
  condition?: (company: any) => boolean;
}

// ── Primary nav items per workspace ────────────────────────────────

export const WORKSPACE_NAV: Record<ProductId, NavItem[]> = {
  growth: [
    { label: 'New Search', to: '/', icon: Search },
    { label: 'Companies', to: '/companies', icon: Building2, matchPrefix: '/companies' },
    { label: 'Pipeline', to: '/pipeline', icon: TrendingUp },
    { label: 'Sites', to: '/sites', icon: Globe, matchPrefix: '/sites' },
    { label: 'Knowledge', to: '/knowledge', icon: BookOpen },
    { label: 'Chat', to: '/chat', icon: MessageSquare },
    { label: 'Lists', to: '/lists', icon: LayoutList, matchPrefix: '/lists' },
  ],
  delivery: [
    { label: 'Clients', to: '/companies', icon: Building2, matchPrefix: '/companies' },
    { label: 'Projects', to: '/pipeline', icon: FolderKanban },
    { label: 'Knowledge', to: '/knowledge', icon: BookOpen },
    { label: 'Chat', to: '/chat', icon: MessageSquare },
    { label: 'Sites', to: '/sites', icon: Globe, matchPrefix: '/sites' },
  ],
  admin: [
    { label: 'Clients', to: '/companies', icon: Building2, matchPrefix: '/companies' },
    { label: 'Hours', to: '/pipeline', icon: Clock },
    { label: 'Invoicing', to: '/knowledge', icon: Receipt },
    { label: 'Agreements', to: '/sites', icon: FileText },
  ],
};

// ── Company detail tabs per workspace ──────────────────────────────

export const WORKSPACE_COMPANY_TABS: Record<ProductId, CompanyTab[]> = {
  growth: [
    { value: 'overview', label: 'Overview' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'sites', label: 'Sites' },
    { value: 'knowledge', label: 'Knowledge' },
    { value: 'chat', label: 'Chat' },
    { value: 'roadmap', label: 'Roadmap' },
  ],
  delivery: [
    { value: 'overview', label: 'Overview' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'deals', label: 'Deals' },
    { value: 'projects', label: 'Projects', condition: (c) => !!c?.harvest_client_id },
    { value: 'time', label: 'Time', condition: (c) => !!c?.harvest_client_id },
    { value: 'tickets', label: 'Tickets', condition: (c) => !!c?.freshdesk_company_id },
    { value: 'sites', label: 'Sites' },
    { value: 'knowledge', label: 'Knowledge' },
    { value: 'chat', label: 'Chat' },
    { value: 'roadmap', label: 'Roadmap' },
  ],
  admin: [
    { value: 'overview', label: 'Overview' },
    { value: 'time', label: 'Hours', condition: (c) => !!c?.harvest_client_id },
    { value: 'invoices', label: 'Invoices' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'source-data', label: 'Source Data' },
  ],
};

// ── Default route per workspace ────────────────────────────────────

export const WORKSPACE_DEFAULT_ROUTE: Record<ProductId, string> = {
  growth: '/companies',
  delivery: '/companies',
  admin: '/companies',
};

// ── Secondary nav (shared across workspaces) ───────────────────────

export const SECONDARY_NAV: NavItem[] = [
  { label: 'Connections', to: '/connections', icon: Link2 },
  { label: 'Wishlist', to: '/wishlist', icon: Heart },
  { label: 'Services', to: '/services', icon: Wrench },
  { label: 'Usage', to: '/usage', icon: Activity },
  { label: 'Settings', to: '/settings', icon: Settings },
];
