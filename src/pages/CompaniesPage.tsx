import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Building2, Users, Globe, MapPin, ChevronRight } from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';

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
  created_at: string;
  contact_count: number;
  site_count: number;
};

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  past: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

export default function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchCompanies() {
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('id, name, domain, industry, employee_count, annual_revenue, location, logo_url, status, created_at')
        .order('name');

      if (error || !companiesData) {
        console.error('Failed to fetch companies:', error);
        setLoading(false);
        return;
      }

      // Get contact counts per company
      const { data: contactCounts } = await supabase
        .from('contacts')
        .select('company_id');

      // Get session counts per company
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

      setCompanies(companiesData.map(c => ({
        ...c,
        contact_count: contactMap.get(c.id) || 0,
        site_count: sessionMap.get(c.id) || 0,
      })));
      setLoading(false);
    }

    fetchCompanies();
  }, []);

  const filtered = companies.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.domain || '').toLowerCase().includes(q) ||
      (c.industry || '').toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-3 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {companies.length} {companies.length === 1 ? 'company' : 'companies'}
            </p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, domain, industry, or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <BrandLoader size={48} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {search ? 'No companies match your search.' : 'No companies yet. Enrich a site with Apollo to create one.'}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(company => (
              <button
                key={company.id}
                onClick={() => navigate(`/companies/${company.id}`)}
                className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-foreground/20 hover:bg-accent/5 transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Logo / Icon */}
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Main content */}
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
                      {company.industry && (
                        <span className="capitalize">{company.industry}</span>
                      )}
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
                    </div>

                    {/* Counts */}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground/70">
                      <span>{company.contact_count} {company.contact_count === 1 ? 'contact' : 'contacts'}</span>
                      <span>{company.site_count} {company.site_count === 1 ? 'site' : 'sites'}</span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors shrink-0 mt-2" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
