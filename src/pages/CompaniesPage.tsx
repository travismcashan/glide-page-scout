import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  Building2,
  Users,
  Globe,
  MapPin,
  ChevronRight,
  ChevronDown,
  LayoutList,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Layers,
  X,
  Check,
  SlidersHorizontal,
  Sparkles,
  Link2,
} from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import { useCompanies, useInvalidateCompanies } from '@/hooks/useCompanies';
import { useProduct } from '@/contexts/ProductContext';
import { ContactDetailDrawer } from '@/components/contacts/ContactDetailDrawer';
import { DomainLink } from '@/components/DomainLink';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Company = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: string | null;
  annual_revenue: string | null;
  location: string | null;
  logo_url: string | null;
  status: string;
  harvest_client_id: string | null;
  harvest_client_name: string | null;
  asana_project_gids: string[] | null;
  hubspot_company_id: string | null;
  freshdesk_company_id: string | null;
  quickbooks_client_name: string | null;
  quickbooks_invoice_summary: {
    count?: number;
    total?: number;
    lastDate?: string;
    firstDate?: string;
    services?: Record<string, { count: number; total: number }>;
  } | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string | null;
  contact_count: number;
  site_count: number;
};

type SortKey =
  | 'name_asc'
  | 'name_desc'
  | 'status'
  | 'employee_count_desc'
  | 'contacts_desc'
  | 'sites_desc'
  | 'last_synced_desc'
  | 'created_desc'
  | 'last_invoiced_desc'
  | 'stage_asc'
  | 'stage_desc'
  | 'domain_asc'
  | 'domain_desc'
  | 'contact_asc'
  | 'contact_desc'
  | 'last_activity_desc'
  | 'last_activity_asc'
  | 'revenue_desc'
  | 'revenue_asc';

type GroupKey = 'none' | 'status' | 'industry' | 'source';

type ViewMode = 'table' | 'cards';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_ORDER = ['active', 'prospect', 'past', 'archived'] as const;

// Stage order: leads first (L→R), then deals (L→R), then no stage last
const STAGE_ORDER: Record<string, number> = {
  // Lead statuses (earliest to latest)
  'Inbound': 0,
  'Contacting': 1,
  'Scheduled': 2,
  'Future Follow-Up': 3,
  // Deal stages — Projects Pipeline (earliest to latest)
  'Follow-Up / Scheduling': 10,
  'Discovery Call': 11,
  'Needs Analysis': 12,
  'Proposal Due': 13,
  'Open Deal': 14,
  // Deal stages — Services Pipeline
  'First-Time Appointment': 15,
  'Eval / Audit / Prep': 16,
  'Needs Analysis Scheduled': 17,
  // Deal stages — RFP Pipeline
  'RFP Identified / Qualification': 20,
  'Intent to Bid': 21,
  'Questions Submitted': 22,
  'Proposal Development': 23,
  'Proposal Submitted': 24,
  'Waiting on Response': 25,
  'Presentation / Finalist': 26,
  'Negotiation & Contracting': 27,
};

const STATUS_COLORS: Record<string, string> = {
  prospect: 'text-foreground border-blue-500',
  active: 'text-foreground border-green-500',
  past: 'text-foreground border-yellow-500',
  archived: 'text-foreground border-zinc-500',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-400',
  prospect: 'bg-blue-400',
  past: 'bg-yellow-400',
  archived: 'bg-zinc-400',
};

const SOURCE_BADGE_STYLES: Record<string, string> = {
  Harvest: 'text-foreground border-orange-500',
  Asana: 'text-foreground border-purple-500',
  HubSpot: 'text-foreground border-red-500',
};

const VIEW_STORAGE_KEY = 'companies-view-mode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatIndustry(raw: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCompanySources(c: Company): string[] {
  const sources: string[] = [];
  if (c.harvest_client_id) sources.push('Harvest');
  if (c.asana_project_gids && c.asana_project_gids.length > 0) sources.push('Asana');
  if (c.hubspot_company_id) sources.push('HubSpot');
  return sources;
}

function sourceAbbrev(s: string): string {
  if (s === 'HubSpot') return 'HS';
  return s[0];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatRevenue(raw: string | null): string {
  if (!raw) return '';
  const n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function sortCompanies(list: Company[], key: SortKey): Company[] {
  const sorted = [...list];
  switch (key) {
    case 'name_asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'status':
      return sorted.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status as (typeof STATUS_ORDER)[number]) -
          STATUS_ORDER.indexOf(b.status as (typeof STATUS_ORDER)[number]),
      );
    case 'employee_count_desc':
      return sorted.sort(
        (a, b) => (parseInt(b.employee_count || '0') || 0) - (parseInt(a.employee_count || '0') || 0),
      );
    case 'contacts_desc':
      return sorted.sort((a, b) => b.contact_count - a.contact_count);
    case 'sites_desc':
      return sorted.sort((a, b) => b.site_count - a.site_count);
    case 'last_synced_desc':
      return sorted.sort(
        (a, b) => new Date(b.last_synced_at || 0).getTime() - new Date(a.last_synced_at || 0).getTime(),
      );
    case 'created_desc':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'last_invoiced_desc':
      return sorted.sort((a, b) => {
        const aDate = (a as any).quickbooks_invoice_summary?.lastDate;
        const bDate = (b as any).quickbooks_invoice_summary?.lastDate;
        return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime();
      });
    case 'domain_asc':
      return sorted.sort((a, b) => (a.domain || '').localeCompare(b.domain || ''));
    case 'domain_desc':
      return sorted.sort((a, b) => (b.domain || '').localeCompare(a.domain || ''));
    case 'last_activity_desc':
      return sorted.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
    case 'last_activity_asc':
      return sorted.sort((a, b) => new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime());
    case 'revenue_desc':
      return sorted.sort((a, b) => {
        const aRev = (a as any).quickbooks_invoice_summary?.total || 0;
        const bRev = (b as any).quickbooks_invoice_summary?.total || 0;
        return bRev - aRev;
      });
    case 'revenue_asc':
      return sorted.sort((a, b) => {
        const aRev = (a as any).quickbooks_invoice_summary?.total || 0;
        const bRev = (b as any).quickbooks_invoice_summary?.total || 0;
        return aRev - bRev;
      });
    case 'contact_asc':
      return sorted.sort((a, b) => ((a as any).primary_contact_name || '').localeCompare((b as any).primary_contact_name || ''));
    case 'contact_desc':
      return sorted.sort((a, b) => ((b as any).primary_contact_name || '').localeCompare((a as any).primary_contact_name || ''));
    case 'stage_asc':
    case 'stage_desc': {
      const dir = key === 'stage_asc' ? 1 : -1;
      return sorted.sort((a, b) => {
        const aStage = (a as any).deal_stage_label || (a as any).lead_status || '';
        const bStage = (b as any).deal_stage_label || (b as any).lead_status || '';
        const aOrder = STAGE_ORDER[aStage] ?? 99;
        const bOrder = STAGE_ORDER[bStage] ?? 99;
        if (aOrder !== bOrder) return (aOrder - bOrder) * dir;
        return a.name.localeCompare(b.name);
      });
    }
    default:
      return sorted;
  }
}

const COLUMN_SORT_MAP: Record<string, [SortKey, SortKey]> = {
  company: ['name_asc', 'name_desc'],
  status: ['status', 'status'],
  stage: ['stage_asc', 'stage_desc'],
  domain: ['domain_asc', 'domain_desc'],
  contact: ['contact_asc', 'contact_desc'],
  last_activity: ['last_activity_desc', 'last_activity_asc'],
  last_invoiced: ['last_invoiced_desc', 'name_asc'],
  revenue: ['revenue_desc', 'revenue_asc'],
  industry: ['name_asc', 'name_desc'],
  employees: ['employee_count_desc', 'name_asc'],
  location: ['name_asc', 'name_desc'],
  sources: ['name_asc', 'name_desc'],
  contacts: ['contacts_desc', 'name_asc'],
  sites: ['sites_desc', 'name_asc'],
};

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

type Group = { label: string; companies: Company[] };

function groupCompanies(list: Company[], key: GroupKey): Group[] {
  if (key === 'none') return [{ label: '', companies: list }];

  const map = new Map<string, Company[]>();

  if (key === 'status') {
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const c of list) {
      const bucket = map.get(c.status) || [];
      bucket.push(c);
      map.set(c.status, bucket);
    }
  } else if (key === 'industry') {
    for (const c of list) {
      const label = formatIndustry(c.industry) || 'Unknown';
      const bucket = map.get(label) || [];
      bucket.push(c);
      map.set(label, bucket);
    }
  } else if (key === 'source') {
    const labels = ['Harvest', 'Asana', 'HubSpot', 'None'];
    for (const l of labels) map.set(l, []);
    for (const c of list) {
      const sources = getCompanySources(c);
      if (sources.length === 0) {
        map.get('None')!.push(c);
      } else {
        for (const s of sources) {
          map.get(s)!.push(c);
        }
      }
    }
  }

  return Array.from(map.entries())
    .filter(([, companies]) => companies.length > 0)
    .map(([label, companies]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      companies,
    }));
}

// ---------------------------------------------------------------------------
// Filter Dropdown Component
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  icon,
  options,
  selected,
  onToggle,
  onClear,
  dotColors,
}: {
  label: string;
  icon?: React.ReactNode;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  dotColors?: Record<string, string>;
}) {
  const activeCount = selected.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
            activeCount > 0
              ? 'border-foreground/25 bg-foreground/8 text-foreground'
              : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
          }`}
        >
          {icon}
          {label}
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-semibold rounded-full bg-foreground/15">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2" sideOffset={6}>
        <div className="space-y-0.5">
          {options.map((opt) => {
            const isActive = selected.has(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => onToggle(opt.value)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                <div
                  className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-foreground border-foreground' : 'border-muted-foreground/30'
                  }`}
                >
                  {isActive && <Check className="h-3 w-3 text-background" />}
                </div>
                {dotColors?.[opt.value] && (
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColors[opt.value]}`} />
                )}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {activeCount > 0 && (
          <>
            <div className="border-t border-border my-2" />
            <button
              onClick={onClear}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-foreground/5 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompaniesPage() {
  const navigate = useNavigate();

  // Workspace context — drives defaults, columns, and filtering
  const { currentProduct } = useProduct();
  const workspace = currentProduct.id; // 'growth' | 'delivery' | 'admin'

  // Workspace-aware defaults
  const defaultPreset = workspace === 'growth' ? 'pipeline' : workspace === 'delivery' ? 'active' : 'all';
  const defaultSort: SortKey = workspace === 'growth' ? 'name_asc' : workspace === 'delivery' ? 'last_invoiced_desc' : 'name_asc';

  // Growth filter
  const [growthFilter, setGrowthFilter] = useState<import('@/hooks/useCompanies').GrowthFilter>('pipeline');

  // Data (cached via TanStack Query, scoped by workspace)
  const { companies, loading } = useCompanies(workspace, growthFilter);
  const invalidateCompanies = useInvalidateCompanies();

  // Search
  const [search, setSearch] = useState('');
  const [selectedContactForDrawer, setSelectedContactForDrawer] = useState<any>(null);

  // Sort & Group
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const saved = localStorage.getItem(`companies-sort-${workspace}`);
    return (saved as SortKey) || defaultSort;
  });
  const setSortKeyPersist = useCallback((key: SortKey) => {
    setSortKey(key);
    localStorage.setItem(`companies-sort-${workspace}`, key);
  }, [workspace]);
  const [groupKey, setGroupKey] = useState<GroupKey>('none');

  // Reset when workspace changes
  useEffect(() => {
    setSortKeyPersist(defaultSort);
    setSearch('');
    setPage(0);
  }, [workspace]);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // View
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      return stored === 'cards' ? 'cards' : 'table';
    } catch {
      return 'table';
    }
  });

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Persist view mode
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  // Workspace-driven filtering: workspace determines base set
  const filtered = useMemo(() => {
    return companies.filter((c) => {
      // Never show archived companies anywhere
      if (c.status === 'archived') return false;

      // Workspace base filter
      // Growth filtering is handled by useCompanies(workspace) — only pipeline companies are fetched
      if (workspace === 'delivery') {
        if (c.status !== 'active') return false;
      }
      // Admin = all non-archived companies

      // Text search
      if (search) {
        const q = search.toLowerCase();
        const match =
          c.name.toLowerCase().includes(q) ||
          (c.domain || '').toLowerCase().includes(q) ||
          (c.industry || '').toLowerCase().includes(q) ||
          (c.location || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [companies, search, workspace]);

  const sorted = useMemo(() => sortCompanies(filtered, sortKey), [filtered, sortKey]);

  // Reset page when filters/sort/search change
  useEffect(() => { setPage(0); }, [search, sortKey, groupKey, pageSize, workspace]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedList = useMemo(
    () => (groupKey === 'none' ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted),
    [sorted, page, pageSize, groupKey],
  );
  const groups = useMemo(() => groupCompanies(paginatedList, groupKey), [paginatedList, groupKey]);

  // Workspace-aware summary stats
  const stats = useMemo(() => {
    if (workspace === 'growth') {
      const withDomain = filtered.filter(c => c.domain).length;
      const withContacts = filtered.filter(c => c.contact_count > 0).length;
      return { label1: `${withDomain} with domain`, label2: `${withContacts} with contacts` };
    } else if (workspace === 'delivery') {
      const withHarvest = filtered.filter(c => c.harvest_client_id).length;
      const withAsana = filtered.filter(c => c.asana_project_gids?.length).length;
      return { label1: `${withHarvest} in Harvest`, label2: `${withAsana} in Asana` };
    } else {
      const invoiced = filtered.filter(c => c.quickbooks_invoice_summary?.total).length;
      const totalRevenue = filtered.reduce((s, c) => s + (c.quickbooks_invoice_summary?.total || 0), 0);
      return { label1: `${invoiced} invoiced`, label2: totalRevenue > 0 ? `$${(totalRevenue / 1000).toFixed(0)}K total` : '' };
    }
  }, [filtered, workspace]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const toggleSet = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (value: string) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
    },
    [],
  );

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const handleColumnSort = useCallback((column: string) => {
    const pair = COLUMN_SORT_MAP[column];
    if (!pair) return;
    setSortKeyPersist(sortKey === pair[0] ? pair[1] : pair[0]);
  }, [sortKey, setSortKeyPersist]);


  // ---------------------------------------------------------------------------
  // Sub-components
  // ---------------------------------------------------------------------------

  function SortableHeader({ column, label, className }: { column: string; label: string; className?: string }) {
    const pair = COLUMN_SORT_MAP[column];
    const isActive = pair && (sortKey === pair[0] || sortKey === pair[1]);
    const isAsc = pair && sortKey === pair[0];
    return (
      <TableHead
        className={`cursor-pointer select-none hover:text-foreground transition-colors ${className || ''}`}
        onClick={() => handleColumnSort(column)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {isActive ? (
            isAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-30" />
          )}
        </span>
      </TableHead>
    );
  }

  function SourceBadges({ company }: { company: Company }) {
    const sources = getCompanySources(company);
    if (sources.length === 0) return <span className="text-muted-foreground/40">--</span>;
    return (
      <div className="flex gap-1">
        {sources.map((s) => (
          <TooltipProvider key={s} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`text-xs px-2 py-0.5 ${SOURCE_BADGE_STYLES[s]}`}>
                  {sourceAbbrev(s)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">{s}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  }

  function CompanyLogo({ company, size = 'sm' }: { company: Company; size?: 'sm' | 'md' }) {
    const dim = size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
    const iconSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
    return (
      <div className={`shrink-0 ${dim} rounded-lg bg-muted flex items-center justify-center overflow-hidden`}>
        {company.logo_url ? (
          <img src={company.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
        ) : (
          <Building2 className={`${iconSize} text-muted-foreground`} />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Table row
  // ---------------------------------------------------------------------------

  function CompanyTableRow({ company }: { company: Company }) {
    const qb = company.quickbooks_invoice_summary;
    const lastActivity = (company as any).deal_close_date || (company as any).lead_updated_at || company.last_synced_at || company.updated_at || company.created_at;
    const services = getCompanySources(company);

    return (
      <TableRow className="cursor-pointer hover:bg-accent/5 [&>td]:py-1.5" onClick={() => navigate(`/companies/${company.id}`)}>
        {/* Name — all workspaces */}
        <TableCell className="max-w-[280px]">
          <div className="flex items-center gap-2.5">
            <CompanyLogo company={company} />
            <div className="min-w-0">
              <div className="font-medium text-foreground truncate text-sm">{company.name}</div>
              {workspace === 'delivery' && company.domain && <div className="text-xs text-muted-foreground truncate">{company.domain}</div>}
            </div>
          </div>
        </TableCell>

        {/* ── Growth columns: Domain, Contact, Stage ── */}
        {workspace === 'growth' && (
          <TableCell className="text-sm truncate max-w-[160px]">
            {company.domain ? (
              <DomainLink domain={company.domain} companyId={company.id} hasCrawl={(company as any).site_count > 0} />
            ) : (
              <span className="text-muted-foreground/30">--</span>
            )}
          </TableCell>
        )}
        {workspace === 'growth' && (
          <TableCell className="text-sm truncate max-w-[140px]">
            {(company as any).primary_contact_name ? (
              <span
                role="link"
                onClick={async (e) => {
                  e.stopPropagation();
                  const contactId = (company as any).primary_contact_id;
                  if (!contactId) return;
                  const { data } = await supabase.from('contacts').select('*').eq('id', contactId).single();
                  if (data) setSelectedContactForDrawer(data);
                }}
                className="text-primary hover:underline cursor-pointer"
              >
                {(company as any).primary_contact_name}
              </span>
            ) : (
              <span className="text-muted-foreground/30">--</span>
            )}
          </TableCell>
        )}
        {workspace === 'growth' && (
          <TableCell className="text-sm">
            {(company as any).deal_stage_label ? (
              <Badge variant="outline" className="text-xs px-2 py-0.5 capitalize text-foreground border-orange-500">{(company as any).deal_stage_label}</Badge>
            ) : (company as any).lead_status ? (
              <Badge variant="outline" className="text-xs px-2 py-0.5 capitalize text-foreground border-blue-500">{(company as any).lead_status}</Badge>
            ) : (
              <span className="text-muted-foreground/30">--</span>
            )}
          </TableCell>
        )}

        {/* ── Delivery columns: Services, Last Activity, Contacts ── */}
        {workspace === 'delivery' && (
          <TableCell>
            {services.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {services.map((s) => (
                  <Badge key={s} variant="outline" className={`text-xs px-2 py-0.5 ${SOURCE_BADGE_STYLES[s] || ''}`}>
                    {s}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground/30">--</span>
            )}
          </TableCell>
        )}
        {workspace === 'delivery' && (
          <TableCell className="text-muted-foreground text-xs">
            {lastActivity ? timeAgo(lastActivity) : <span className="text-muted-foreground/30">--</span>}
          </TableCell>
        )}
        {workspace === 'delivery' && (
          <TableCell className="text-muted-foreground tabular-nums text-sm">
            {company.contact_count || <span className="text-muted-foreground/30">--</span>}
          </TableCell>
        )}

        {/* ── Admin columns: Last Invoice, Revenue, Status ── */}
        {workspace === 'admin' && (
          <TableCell className="text-muted-foreground text-xs">
            {qb?.lastDate ? new Date(qb.lastDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : <span className="text-muted-foreground/30">--</span>}
          </TableCell>
        )}
        {workspace === 'admin' && (
          <TableCell className="text-muted-foreground tabular-nums text-sm font-medium">
            {qb?.total ? `$${Math.round(qb.total).toLocaleString()}` : <span className="text-muted-foreground/30">--</span>}
          </TableCell>
        )}
        {workspace === 'admin' && (
          <TableCell>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 capitalize ${STATUS_COLORS[company.status] || ''}`}>
              {company.status}
            </Badge>
          </TableCell>
        )}
      </TableRow>
    );
  }

  // ---------------------------------------------------------------------------
  // Card
  // ---------------------------------------------------------------------------

  function CompanyCard({ company }: { company: Company }) {
    const sources = getCompanySources(company);
    return (
      <button
        onClick={() => navigate(`/companies/${company.id}`)}
        className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-foreground/20 hover:bg-accent/5 transition-all group"
      >
        <div className="flex items-start gap-4">
          <CompanyLogo company={company} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground truncate">{company.name}</span>
              <Badge variant="outline" className={`text-xs px-2 py-0.5 capitalize ${STATUS_COLORS[company.status] || ''}`}>
                {company.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {company.domain && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" /> {company.domain}
                </span>
              )}
              {company.industry && <span>{formatIndustry(company.industry)}</span>}
              {company.employee_count && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {company.employee_count} employees
                </span>
              )}
              {company.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {company.location}
                </span>
              )}
              {company.annual_revenue && <span>{formatRevenue(company.annual_revenue)}</span>}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground/70">
              <span>
                {company.contact_count} {company.contact_count === 1 ? 'contact' : 'contacts'}
              </span>
              <span>
                {company.site_count} {company.site_count === 1 ? 'site' : 'sites'}
              </span>
              {sources.length > 0 && (
                <div className="flex gap-1">
                  {sources.map((s) => (
                    <Badge key={s} variant="outline" className={`text-xs px-2 py-0.5 ${SOURCE_BADGE_STYLES[s]}`}>
                      {sourceAbbrev(s)}
                    </Badge>
                  ))}
                </div>
              )}
              {company.last_synced_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {timeAgo(company.last_synced_at)}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors shrink-0 mt-2" />
        </div>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Group header
  // ---------------------------------------------------------------------------

  function GroupHeader({ label, count }: { label: string; count: number }) {
    const collapsed = collapsedGroups.has(label);
    return (
      <button
        onClick={() => toggleGroup(label)}
        className="w-full flex items-center gap-2 py-2 px-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        <span>{label}</span>
        <Badge variant="secondary" className="text-xs px-2 py-0.5">
          {count}
        </Badge>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <main className="px-4 sm:px-6 py-6">

        {/* ── Row 1: Title + Count + Search + Sort + View toggle ── */}
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-bold tracking-tight shrink-0">
            {workspace === 'delivery' ? 'Clients' : workspace === 'admin' ? 'Companies' : 'Companies'}
          </h1>
          {!loading && (
            <Badge variant="secondary" className="text-sm px-2.5 py-0.5 tabular-nums shrink-0">
              {filtered.length.toLocaleString()}
            </Badge>
          )}

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Growth filter */}
          {workspace === 'growth' && (
            <Select value={growthFilter} onValueChange={(v) => setGrowthFilter(v as import('@/hooks/useCompanies').GrowthFilter)}>
              <SelectTrigger className="w-fit h-8 text-sm">
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 opacity-50 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pipeline">Pipeline</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Sort */}
          <Select value={sortKey} onValueChange={(v) => setSortKeyPersist(v as SortKey)}>
            <SelectTrigger className="w-fit h-8 text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="stage_asc">Stage (earliest)</SelectItem>
              <SelectItem value="stage_desc">Stage (latest)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="created_desc">Newest</SelectItem>
              <SelectItem value="last_invoiced_desc">Last Invoiced</SelectItem>
              <SelectItem value="contacts_desc">Contacts</SelectItem>
              <SelectItem value="employee_count_desc">Employees</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex items-center h-8 border border-border rounded-md overflow-hidden">
            <button className={`h-full w-8 flex items-center justify-center ${viewMode === 'table' ? 'bg-foreground/10' : 'hover:bg-foreground/5'}`} onClick={() => setViewMode('table')}>
              <LayoutList className="h-3.5 w-3.5" />
            </button>
            <button className={`h-full w-8 flex items-center justify-center ${viewMode === 'cards' ? 'bg-foreground/10' : 'hover:bg-foreground/5'}`} onClick={() => setViewMode('cards')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <BrandLoader size={48} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {search
              ? 'No companies match your search.'
              : 'No companies yet. Run a global sync from Connections to populate.'}
          </div>
        ) : viewMode === 'table' ? (
          groups.map((group) => (
            <div key={group.label || '__flat'} className="mb-4">
              {groupKey !== 'none' && <GroupHeader label={group.label} count={group.companies.length} />}
              {(!collapsedGroups.has(group.label) || groupKey === 'none') && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <SortableHeader column="company" label="Name" />
                        {workspace === 'growth' && <SortableHeader column="domain" label="Domain" />}
                        {workspace === 'growth' && <SortableHeader column="contact" label="Contact" />}
                        {workspace === 'growth' && <SortableHeader column="stage" label="Stage" />}
                        {workspace === 'delivery' && <SortableHeader column="sources" label="Services" />}
                        {workspace === 'delivery' && <SortableHeader column="last_activity" label="Last Activity" />}
                        {workspace === 'delivery' && <SortableHeader column="contacts" label="Contacts" />}
                        {workspace === 'admin' && <SortableHeader column="last_invoiced" label="Last Invoice" />}
                        {workspace === 'admin' && <SortableHeader column="revenue" label="Revenue" />}
                        {workspace === 'admin' && <SortableHeader column="status" label="Status" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.companies.map((company) => (
                        <CompanyTableRow key={company.id} company={company} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))
        ) : (
          groups.map((group) => (
            <div key={group.label || '__flat'} className="mb-4">
              {groupKey !== 'none' && <GroupHeader label={group.label} count={group.companies.length} />}
              {(!collapsedGroups.has(group.label) || groupKey === 'none') && (
                <div className="grid gap-3">
                  {group.companies.map((company) => (
                    <CompanyCard key={company.id} company={company} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {/* ── Pagination ── */}
        {!loading && filtered.length > 0 && groupKey === 'none' && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="w-[70px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 250, 500].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {(page * pageSize + 1).toLocaleString()}-{Math.min((page + 1) * pageSize, sorted.length).toLocaleString()} of {sorted.length.toLocaleString()}
              </span>
              <div className="flex items-center gap-0.5 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                >
                  <span className="text-xs">&#x00AB;</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <span className="text-xs">&#x2039;</span>
                </Button>
                <span className="px-2 tabular-nums text-xs">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <span className="text-xs">&#x203A;</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(totalPages - 1)}
                >
                  <span className="text-xs">&#x00BB;</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <ContactDetailDrawer
        contact={selectedContactForDrawer}
        onClose={() => setSelectedContactForDrawer(null)}
      />
    </div>
  );
}
