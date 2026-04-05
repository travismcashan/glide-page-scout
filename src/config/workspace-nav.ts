import {
  Search,
  Building2,
  TrendingUp,
  Globe,
  BookOpen,
  MessageSquare,
  FolderKanban,
  Clock,
  Receipt,
  FileText,
  Settings,
  AudioLines,
  LayoutDashboard,
  Briefcase,
  Headphones,
  Map as MapIcon,
  Database,
  Shield,
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
  icon?: LucideIcon;
  /** Tab only renders if condition returns true (checked against company record) */
  condition?: (company: any) => boolean;
}

// ── Global nav items per workspace (top section — max 4) ─────────

export const WORKSPACE_NAV: Record<ProductId, NavItem[]> = {
  growth: [
    { label: 'Crawl', to: '/', icon: Search, matchPrefix: '/sites' },
    { label: 'Leads', to: '/leads', icon: Building2 },
    { label: 'Deals', to: '/deals', icon: TrendingUp },
    { label: 'Companies', to: '/companies', icon: Building2, matchPrefix: '/companies' },
  ],
  delivery: [
    { label: 'Crawl', to: '/', icon: Search, matchPrefix: '/sites' },
    { label: 'Clients', to: '/companies', icon: Building2, matchPrefix: '/companies' },
    { label: 'Projects', to: '/projects', icon: FolderKanban },
  ],
  admin: [
    { label: 'Crawl', to: '/', icon: Search, matchPrefix: '/sites' },
    { label: 'Clients', to: '/companies', icon: Building2, matchPrefix: '/companies' },
    { label: 'Invoicing', to: '/pipeline', icon: Receipt },
  ],
};

// ── Company detail tabs per workspace ──────────────────────────────

export const WORKSPACE_COMPANY_TABS: Record<ProductId, CompanyTab[]> = {
  growth: [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'voice', label: 'Voice', icon: AudioLines },
    { value: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { value: 'chat', label: 'Chat', icon: MessageSquare },
    { value: 'roadmap', label: 'Roadmap', icon: MapIcon },
    { value: 'source-data', label: 'Source Data', icon: Database },
  ],
  delivery: [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'voice', label: 'Voice', icon: AudioLines },
    { value: 'deals', label: 'Deals', icon: Briefcase },
    { value: 'projects', label: 'Projects', icon: FolderKanban, condition: (c) => !!c?.harvest_client_id },
    { value: 'time', label: 'Time', icon: Clock, condition: (c) => !!c?.harvest_client_id },
    { value: 'tickets', label: 'Tickets', icon: Headphones, condition: (c) => !!c?.freshdesk_company_id },
    { value: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { value: 'chat', label: 'Chat', icon: MessageSquare },
    { value: 'roadmap', label: 'Roadmap', icon: MapIcon },
    { value: 'source-data', label: 'Source Data', icon: Database },
  ],
  admin: [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'time', label: 'Hours', icon: Clock, condition: (c) => !!c?.harvest_client_id },
    { value: 'invoices', label: 'Invoices', icon: Receipt },
    { value: 'source-data', label: 'Source Data', icon: Database },
  ],
};

// ── Default route per workspace ────────────────────────────────────

export const WORKSPACE_DEFAULT_ROUTE: Record<ProductId, string> = {
  growth: '/companies',
  delivery: '/companies',
  admin: '/companies',
};

// ── Tab icon map (for sidebar contextual section + company page tabs) ──

export const TAB_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  contacts: Building2,
  deals: Briefcase,
  projects: FolderKanban,
  time: Clock,
  tickets: Headphones,
  sites: Globe,
  voice: AudioLines,
  knowledge: BookOpen,
  chat: MessageSquare,
  roadmap: MapIcon,
  invoices: Receipt,
  'source-data': Database,
};
