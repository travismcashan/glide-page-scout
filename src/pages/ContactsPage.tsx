import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Phone, Linkedin, ArrowUpDown, ArrowUp, ArrowDown,
  LayoutList, LayoutGrid, X, SlidersHorizontal,
} from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { useProduct } from '@/contexts/ProductContext';
import { useContacts, type ContactListRow } from '@/hooks/useContacts';
import type { GrowthFilter } from '@/hooks/useCompanies';
import { ContactDetailDrawer } from '@/components/contacts/ContactDetailDrawer';

const LEAD_STATUS_COLORS: Record<string, string> = {
  'Inbound': 'text-foreground border-emerald-500',
  'Contacting': 'text-foreground border-blue-500',
  'Scheduled': 'text-foreground border-violet-500',
  'Future Follow-Up': 'text-foreground border-amber-500',
};

type SortKey = 'name_asc' | 'name_desc' | 'company_asc' | 'company_desc' | 'title_asc' | 'title_desc' | 'updated_desc';

const COLUMN_SORT_MAP: Record<string, [SortKey, SortKey]> = {
  name: ['name_asc', 'name_desc'],
  title: ['title_asc', 'title_desc'],
  company: ['company_asc', 'company_desc'],
};

function sortContacts(list: ContactListRow[], key: SortKey): ContactListRow[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    switch (key) {
      case 'name_asc': case 'name_desc': {
        const na = [a.first_name, a.last_name].filter(Boolean).join(' ').toLowerCase();
        const nb = [b.first_name, b.last_name].filter(Boolean).join(' ').toLowerCase();
        return key === 'name_asc' ? na.localeCompare(nb) : nb.localeCompare(na);
      }
      case 'company_asc': case 'company_desc':
        return key === 'company_asc'
          ? (a.company_name || '').localeCompare(b.company_name || '')
          : (b.company_name || '').localeCompare(a.company_name || '');
      case 'title_asc': case 'title_desc':
        return key === 'title_asc'
          ? (a.title || '').localeCompare(b.title || '')
          : (b.title || '').localeCompare(a.title || '');
      case 'updated_desc':
        return (b.updated_at || '').localeCompare(a.updated_at || '');
      default: return 0;
    }
  });
  return sorted;
}

export default function ContactsPage() {
  const { currentProduct } = useProduct();
  const navigate = useNavigate();
  const workspace = currentProduct.id;

  const [growthFilter, setGrowthFilter] = useState<GrowthFilter>('pipeline');
  const { contacts, loading } = useContacts(workspace, growthFilter);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedContact, setSelectedContact] = useState<ContactListRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = contacts;
    if (q) {
      list = list.filter(c => {
        const name = [c.first_name, c.last_name].filter(Boolean).join(' ').toLowerCase();
        return name.includes(q)
          || (c.email?.toLowerCase().includes(q))
          || (c.title?.toLowerCase().includes(q))
          || (c.company_name?.toLowerCase().includes(q));
      });
    }
    return sortContacts(list, sortKey);
  }, [contacts, search, sortKey]);

  const handleColumnSort = useCallback((column: string) => {
    const pair = COLUMN_SORT_MAP[column];
    if (!pair) return;
    setSortKey(sortKey === pair[0] ? pair[1] : pair[0]);
  }, [sortKey]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <BrandLoader size={48} />
      </div>
    );
  }

  return (
    <div>
      <main className="px-4 sm:px-6 py-6">

        {/* ── Row 1: Title + Count + Search + Sort + View toggle ── */}
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-bold tracking-tight shrink-0">Contacts</h1>
          {!loading && (
            <Badge variant="secondary" className="text-sm px-2.5 py-0.5 tabular-nums shrink-0">
              {filtered.length}
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
            <Select value={growthFilter} onValueChange={(v) => setGrowthFilter(v as GrowthFilter)}>
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
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-fit h-8 text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="company_asc">Company (A-Z)</SelectItem>
              <SelectItem value="company_desc">Company (Z-A)</SelectItem>
              <SelectItem value="title_asc">Title (A-Z)</SelectItem>
              <SelectItem value="updated_desc">Recently Updated</SelectItem>
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
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {search ? 'No contacts match your search.' : 'No contacts found.'}
          </div>
        ) : viewMode === 'table' ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="name" label="Name" />
                  <SortableHeader column="title" label="Title" />
                  <TableHead>Email</TableHead>
                  <SortableHeader column="company" label="Company" />
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(contact => {
                  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';
                  return (
                    <TableRow
                      key={contact.id}
                      className="cursor-pointer hover:bg-accent/5 [&>td]:py-1.5 [&>td]:whitespace-nowrap"
                      onClick={() => setSelectedContact(contact)}
                    >
                      <TableCell className="max-w-[280px]">
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {contact.photo_url ? (
                              <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {(contact.first_name?.[0] || '') + (contact.last_name?.[0] || '') || '?'}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate text-sm">{name}</div>
                            {contact.is_primary && <Badge variant="outline" className="text-xs px-2 py-0.5 mt-0.5 text-foreground border-violet-500">Primary</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
                        {contact.title || <span className="text-muted-foreground/30">--</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
                        <div className="flex items-center gap-2">
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()} className="hover:text-foreground truncate">
                              {contact.email}
                            </a>
                          ) : (
                            <span className="text-muted-foreground/30">--</span>
                          )}
                          {contact.phone && <Phone className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                          {contact.linkedin_url && <Linkedin className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[180px]">
                        {contact.company_name ? (
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/companies/${contact.company_id}`); }}
                            className="text-primary hover:underline truncate block"
                          >
                            {contact.company_name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/30">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.lead_status ? (
                          <Badge variant="outline" className={`text-xs px-2 py-0.5 capitalize ${LEAD_STATUS_COLORS[contact.lead_status] || ''}`}>
                            {contact.lead_status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/30">--</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* Card view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(contact => {
              const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';
              return (
                <div
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className="cursor-pointer p-4 rounded-lg border border-border/50 hover:border-border hover:bg-accent/5 transition-all bg-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          {(contact.first_name?.[0] || '') + (contact.last_name?.[0] || '') || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{name}</div>
                      {contact.title && <div className="text-xs text-muted-foreground truncate">{contact.title}</div>}
                      {contact.company_name && (
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/companies/${contact.company_id}`); }}
                          className="text-xs text-primary hover:underline truncate block mt-0.5"
                        >
                          {contact.company_name}
                        </button>
                      )}
                    </div>
                  </div>
                  {(contact.lead_status || contact.email) && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {contact.lead_status && (
                        <Badge variant="outline" className={`text-xs px-2 py-0.5 capitalize ${LEAD_STATUS_COLORS[contact.lead_status] || ''}`}>
                          {contact.lead_status}
                        </Badge>
                      )}
                      {contact.email && <span className="text-xs text-muted-foreground truncate">{contact.email}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Drawer */}
      <ContactDetailDrawer
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        companyName={selectedContact?.company_name || undefined}
        companyId={selectedContact?.company_id || undefined}
      />
    </div>
  );
}
