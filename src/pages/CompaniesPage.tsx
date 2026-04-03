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
} from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';

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
  | 'created_desc';

type GroupKey = 'none' | 'status' | 'industry' | 'source';

type ViewMode = 'table' | 'cards';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_ORDER = ['active', 'prospect', 'past', 'archived'] as const;

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  past: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-400',
  prospect: 'bg-blue-400',
  past: 'bg-yellow-400',
  archived: 'bg-zinc-400',
};

const SOURCE_BADGE_STYLES: Record<string, string> = {
  Harvest: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  Asana: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  HubSpot: 'bg-red-500/15 text-red-400 border-red-500/20',
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
    default:
      return sorted;
  }
}

const COLUMN_SORT_MAP: Record<string, [SortKey, SortKey]> = {
  company: ['name_asc', 'name_desc'],
  status: ['status', 'status'],
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

  // Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set());
  const [dataFilters, setDataFilters] = useState<Set<string>>(new Set());
  const [activePreset, setActivePreset] = useState<string>('clients');

  // Sort & Group
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [groupKey, setGroupKey] = useState<GroupKey>('none');

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
  // Data fetching
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function fetchCompanies() {
      let allCompanies: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: batch, error: batchError } = await supabase
          .from('companies')
          .select(
            'id, name, domain, industry, employee_count, annual_revenue, location, logo_url, status, harvest_client_id, harvest_client_name, asana_project_gids, hubspot_company_id, last_synced_at, created_at, updated_at',
          )
          .order('name')
          .range(from, from + pageSize - 1);
        if (batchError || !batch) break;
        allCompanies = allCompanies.concat(batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      const companiesData = allCompanies;

      if (allCompanies.length === 0) {
        setLoading(false);
        return;
      }

      const { data: contactCounts } = await supabase.from('contacts').select('company_id');
      const { data: sessionCounts } = await supabase
        .from('crawl_sessions')
        .select('company_id')
        .not('company_id', 'is', null);

      const contactMap = new Map<string, number>();
      (contactCounts || []).forEach((c: any) => {
        if (c.company_id) contactMap.set(c.company_id, (contactMap.get(c.company_id) || 0) + 1);
      });

      const sessionMap = new Map<string, number>();
      (sessionCounts || []).forEach((s: any) => {
        if (s.company_id) sessionMap.set(s.company_id, (sessionMap.get(s.company_id) || 0) + 1);
      });

      setCompanies(
        companiesData.map((c: any) => ({
          ...c,
          contact_count: contactMap.get(c.id) || 0,
          site_count: sessionMap.get(c.id) || 0,
        })),
      );
      setLoading(false);
    }

    fetchCompanies();
  }, []);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  // Preset filter functions
  const presetFilter = useCallback((c: Company, preset: string): boolean => {
    switch (preset) {
      case 'clients':
        // Companies you actually work/worked with: has Harvest, Asana, or sites
        return !!(c.harvest_client_id || (c.asana_project_gids && c.asana_project_gids.length > 0) || c.site_count > 0);
      case 'active':
        return c.status === 'active';
      case 'pipeline':
        // Multi-source prospects or those with contacts/sites but not active
        {
          const sources = getCompanySources(c);
          return c.status !== 'active' && (sources.length >= 2 || c.contact_count > 0 || c.site_count > 0);
        }
      case 'all':
      default:
        return true;
    }
  }, []);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      // Apply preset first
      if (!presetFilter(c, activePreset)) return false;
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
      if (statusFilters.size > 0 && !statusFilters.has(c.status)) return false;
      if (sourceFilters.size > 0) {
        const sources = getCompanySources(c);
        if (![...sourceFilters].some((sf) => sources.includes(sf))) return false;
      }
      if (dataFilters.has('has_sites') && c.site_count === 0) return false;
      if (dataFilters.has('has_contacts') && c.contact_count === 0) return false;
      if (dataFilters.has('has_domain') && !c.domain) return false;
      if (dataFilters.has('has_industry') && !c.industry) return false;
      return true;
    });
  }, [companies, search, statusFilters, sourceFilters, dataFilters, activePreset, presetFilter]);

  const sorted = useMemo(() => sortCompanies(filtered, sortKey), [filtered, sortKey]);

  // Reset page when filters/sort/search change
  useEffect(() => { setPage(0); }, [search, statusFilters, sourceFilters, dataFilters, sortKey, groupKey, pageSize]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedList = useMemo(
    () => (groupKey === 'none' ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted),
    [sorted, page, pageSize, groupKey],
  );
  const groups = useMemo(() => groupCompanies(paginatedList, groupKey), [paginatedList, groupKey]);

  // Summary stats
  const activeCount = useMemo(() => filtered.filter((c) => c.status === 'active').length, [filtered]);
  const withSitesCount = useMemo(() => filtered.filter((c) => c.site_count > 0).length, [filtered]);

  // Total active filter count
  const totalActiveFilters = statusFilters.size + sourceFilters.size + dataFilters.size;

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

  const toggleStatus = toggleSet(setStatusFilters);
  const toggleSource = toggleSet(setSourceFilters);
  const toggleData = toggleSet(setDataFilters);

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
    setSortKey((prev) => (prev === pair[0] ? pair[1] : pair[0]));
  }, []);

  const clearAllFilters = useCallback(() => {
    setStatusFilters(new Set());
    setSourceFilters(new Set());
    setDataFilters(new Set());
    setSearch('');
  }, []);

  const switchPreset = useCallback((preset: string) => {
    setActivePreset(preset);
    setStatusFilters(new Set());
    setSourceFilters(new Set());
    setDataFilters(new Set());
    setSearch('');
    setPage(0);
  }, []);

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
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-4 ${SOURCE_BADGE_STYLES[s]}`}>
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
    const sources = getCompanySources(company);
    return (
      <TableRow className="cursor-pointer hover:bg-accent/5" onClick={() => navigate(`/companies/${company.id}`)}>
        <TableCell className="max-w-[280px]">
          <div className="flex items-center gap-3">
            <CompanyLogo company={company} />
            <div className="min-w-0">
              <div className="font-medium text-foreground truncate">{company.name}</div>
              {company.domain && <div className="text-xs text-muted-foreground truncate">{company.domain}</div>}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs py-0.5 ${STATUS_COLORS[company.status] || ''}`}>
            {company.status}
          </Badge>
        </TableCell>
        <TableCell>
          {sources.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {sources.map((s) => (
                <Badge key={s} variant="outline" className={`text-xs px-2 py-0.5 ${SOURCE_BADGE_STYLES[s]}`}>
                  {s}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground/40">--</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm truncate max-w-[160px]">
          {formatIndustry(company.industry) || <span className="text-muted-foreground/40">--</span>}
        </TableCell>
        <TableCell className="text-muted-foreground tabular-nums">
          {company.employee_count || <span className="text-muted-foreground/40">--</span>}
        </TableCell>
        <TableCell className="text-muted-foreground tabular-nums">{company.contact_count}</TableCell>
        <TableCell className="text-muted-foreground tabular-nums">{company.site_count}</TableCell>
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
              <Badge variant="outline" className={STATUS_COLORS[company.status] || ''}>
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
                    <Badge key={s} variant="outline" className={`text-[10px] px-1.5 py-0 leading-4 ${SOURCE_BADGE_STYLES[s]}`}>
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
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-4">
          {count}
        </Badge>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-3 sm:px-6 py-6">

        {/* ── Header + View Presets ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight">Companies</h1>
            {!loading && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {filtered.length === companies.length
                  ? companies.length.toLocaleString()
                  : `${filtered.length.toLocaleString()} of ${companies.length.toLocaleString()}`}
              </span>
            )}
          </div>
        </div>

        {/* ── Smart Views ── */}
        <div className="flex items-center gap-1 mb-4 border-b border-border pb-3">
          {([
            { key: 'clients', label: 'My Clients' },
            { key: 'active', label: 'Active Now' },
            { key: 'pipeline', label: 'Pipeline' },
            { key: 'all', label: 'All Companies' },
          ]).map((preset) => (
            <button
              key={preset.key}
              onClick={() => switchPreset(preset.key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activePreset === preset.key
                  ? 'bg-foreground/10 text-foreground border border-foreground/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 mb-3">

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-border" />

          {/* Filter dropdowns */}
          <FilterDropdown
            label="Status"
            options={STATUS_ORDER.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
            selected={statusFilters}
            onToggle={toggleStatus}
            onClear={() => setStatusFilters(new Set())}
            dotColors={STATUS_DOT}
          />

          <FilterDropdown
            label="Sources"
            options={[
              { value: 'Harvest', label: 'Harvest' },
              { value: 'Asana', label: 'Asana' },
              { value: 'HubSpot', label: 'HubSpot' },
            ]}
            selected={sourceFilters}
            onToggle={toggleSource}
            onClear={() => setSourceFilters(new Set())}
          />

          <FilterDropdown
            label="Data"
            icon={<SlidersHorizontal className="h-3 w-3" />}
            options={[
              { value: 'has_sites', label: 'Has sites' },
              { value: 'has_contacts', label: 'Has contacts' },
              { value: 'has_domain', label: 'Has domain' },
              { value: 'has_industry', label: 'Has industry' },
            ]}
            selected={dataFilters}
            onToggle={toggleData}
            onClear={() => setDataFilters(new Set())}
          />

          {/* Clear all filters */}
          {totalActiveFilters > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Sort */}
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[165px] h-9 text-sm">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="employee_count_desc">Employees</SelectItem>
              <SelectItem value="contacts_desc">Contacts</SelectItem>
              <SelectItem value="sites_desc">Sites</SelectItem>
              <SelectItem value="last_synced_desc">Last Synced</SelectItem>
              <SelectItem value="created_desc">Created</SelectItem>
            </SelectContent>
          </Select>

          {/* Group */}
          <Select
            value={groupKey}
            onValueChange={(v) => {
              setGroupKey(v as GroupKey);
              setCollapsedGroups(new Set());
            }}
          >
            <SelectTrigger className="w-[145px] h-9 text-sm">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="industry">Industry</SelectItem>
              <SelectItem value="source">Source</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => setViewMode('table')}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Summary ── */}
        <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
          <span>{activeCount} active</span>
          <span>&middot;</span>
          <span>{withSitesCount} with sites</span>
          {totalActiveFilters > 0 && (
            <>
              <span>&middot;</span>
              <span>{totalActiveFilters} {totalActiveFilters === 1 ? 'filter' : 'filters'} applied</span>
            </>
          )}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <BrandLoader size={48} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {totalActiveFilters > 0 || search
              ? 'No companies match your filters.'
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
                        <SortableHeader column="status" label="Status" />
                        <SortableHeader column="sources" label="Streams" />
                        <SortableHeader column="industry" label="Industry" />
                        <SortableHeader column="employees" label="Emp." />
                        <SortableHeader column="contacts" label="Contacts" />
                        <SortableHeader column="sites" label="Sites" />
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
    </div>
  );
}
