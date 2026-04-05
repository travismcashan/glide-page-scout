import { Badge } from '@/components/ui/badge';
import { CardTabs } from '@/components/CardTabs';
import { Building2, Globe, MapPin, Users, Calendar, DollarSign, Cpu, ExternalLink, Mail, Tag, Clock } from 'lucide-react';

type DepartmentSize = { department: string; size: number };
type Location = { country?: string; locality?: string; region?: string; streetAddress?: string; postalCode?: string; primary?: boolean };
type MediaProfile = { handle?: string; url?: string; name?: string };

type OceanData = {
  success: boolean;
  domain?: string;
  companyName?: string;
  countries?: string[];
  primaryCountry?: string;
  companySize?: string;
  industries?: string[];
  industryCategories?: string[];
  linkedinIndustry?: string;
  technologies?: string[];
  technologyCategories?: string[];
  yearFounded?: number | null;
  revenue?: string | null;
  description?: string | null;
  ecommercePlatform?: string | null;
  employeeCountLinkedin?: number | null;
  employeeCountOcean?: number | null;
  departmentSizes?: DepartmentSize[];
  locations?: Location[];
  emails?: string[];
  medias?: Record<string, MediaProfile> | null;
  logo?: string | null;
  keywords?: string[];
  webTraffic?: { visits?: number; pageViews?: number; pagesPerVisit?: number; bounceRate?: number } | null;
  rootUrl?: string | null;
  updatedAt?: string | null;
  error?: string;
};

function fmt(n: number | undefined): string {
  if (n == null) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function pct(n: number | undefined): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

/* ── Tab: Overview ── */
function OverviewTab({ data }: { data: OceanData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {data.companySize && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Company Size</p>
              <p className="text-xs font-medium">{data.companySize}</p>
            </div>
          </div>
        )}
        {(data.employeeCountLinkedin || data.employeeCountOcean) && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Headcount</p>
              <p className="text-xs font-medium">
                {data.employeeCountLinkedin && <span>LinkedIn: {data.employeeCountLinkedin}</span>}
                {data.employeeCountLinkedin && data.employeeCountOcean && <span> · </span>}
                {data.employeeCountOcean && <span>Ocean: {data.employeeCountOcean}</span>}
              </p>
            </div>
          </div>
        )}
        {data.primaryCountry && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">HQ Country</p>
              <p className="text-xs font-medium uppercase">{data.primaryCountry}</p>
            </div>
          </div>
        )}
        {data.yearFounded && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Founded</p>
              <p className="text-xs font-medium">{data.yearFounded}</p>
            </div>
          </div>
        )}
        {data.revenue && (
          <div className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Revenue</p>
              <p className="text-xs font-medium">{data.revenue}</p>
            </div>
          </div>
        )}
        {data.linkedinIndustry && (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">LinkedIn Industry</p>
              <p className="text-xs font-medium">{data.linkedinIndustry}</p>
            </div>
          </div>
        )}
        {data.ecommercePlatform && (
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">E-commerce</p>
              <p className="text-xs font-medium">{data.ecommercePlatform}</p>
            </div>
          </div>
        )}
      </div>

      {data.industries && data.industries.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5">Industries</p>
          <div className="flex flex-wrap gap-1">
            {data.industries.map((ind, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{ind}</Badge>
            ))}
          </div>
        </div>
      )}

      {data.industryCategories && data.industryCategories.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5">Industry Categories</p>
          <div className="flex flex-wrap gap-1">
            {data.industryCategories.map((cat, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{cat}</Badge>
            ))}
          </div>
        </div>
      )}

      {data.countries && data.countries.length > 1 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Presence</p>
          <p className="text-xs">{data.countries.map(c => c.toUpperCase()).join(', ')}</p>
        </div>
      )}

      {data.updatedAt && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border">
          <Clock className="h-3 w-3" />
          Data updated: {new Date(data.updatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

/* ── Tab: Departments ── */
function DepartmentsTab({ departments }: { departments: DepartmentSize[] }) {
  const sorted = [...departments].sort((a, b) => b.size - a.size);
  const max = sorted[0]?.size || 1;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground mb-2">Headcount by department</p>
      {sorted.map((dept, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs w-40 shrink-0 truncate">{dept.department}</span>
          <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-primary/60 rounded transition-all"
              style={{ width: `${(dept.size / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-8 text-right">{dept.size}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Tab: Locations ── */
function LocationsTab({ locations }: { locations: Location[] }) {
  return (
    <div className="space-y-3">
      {locations.map((loc, i) => (
        <div key={i} className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium">
              {loc.locality}{loc.region ? `, ${loc.region}` : ''}{loc.country ? ` (${loc.country.toUpperCase()})` : ''}
              {loc.primary && <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1.5">HQ</Badge>}
            </p>
            {loc.streetAddress && <p className="text-muted-foreground">{loc.streetAddress}{loc.postalCode ? `, ${loc.postalCode}` : ''}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Tab: Traffic ── */
function TrafficTab({ traffic }: { traffic: NonNullable<OceanData['webTraffic']> }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-[10px] text-muted-foreground">Monthly Visits</p>
        <p className="text-lg font-semibold">{fmt(traffic.visits)}</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Page Views</p>
        <p className="text-lg font-semibold">{fmt(traffic.pageViews)}</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Pages / Visit</p>
        <p className="text-lg font-semibold">{traffic.pagesPerVisit?.toFixed(1) ?? '—'}</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Bounce Rate</p>
        <p className="text-lg font-semibold">{pct(traffic.bounceRate)}</p>
      </div>
    </div>
  );
}

/* ── Tab: Tech Stack ── */
function TechTab({ data }: { data: OceanData }) {
  return (
    <div className="space-y-3">
      {data.technologyCategories && data.technologyCategories.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5">Categories</p>
          <div className="flex flex-wrap gap-1">
            {data.technologyCategories.map((cat, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{cat}</Badge>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
          <Cpu className="h-3 w-3" /> Technologies ({data.technologies?.length ?? 0})
        </p>
        <div className="flex flex-wrap gap-1">
          {data.technologies?.map((tech, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{tech}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Contact ── */
function ContactTab({ data }: { data: OceanData }) {
  return (
    <div className="space-y-4">
      {data.emails && data.emails.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
            <Mail className="h-3 w-3" /> Email Addresses
          </p>
          <div className="space-y-1">
            {data.emails.map((email, i) => (
              <a key={i} href={`mailto:${email}`} className="block text-xs text-primary hover:underline">{email}</a>
            ))}
          </div>
        </div>
      )}
      {data.medias && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5">Social Profiles</p>
          <div className="space-y-1.5">
            {Object.entries(data.medias).map(([platform, profile]) => (
              <a
                key={platform}
                href={profile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="capitalize">{platform}</span>
                {profile.handle && <span className="text-muted-foreground">@{profile.handle}</span>}
              </a>
            ))}
          </div>
        </div>
      )}
      {data.rootUrl && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Website</p>
          <a href={data.rootUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
            <Globe className="h-3 w-3" /> {data.rootUrl}
          </a>
        </div>
      )}
    </div>
  );
}

/* ── Tab: Keywords ── */
function KeywordsTab({ keywords }: { keywords: string[] }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
        <Tag className="h-3 w-3" /> AI-extracted keywords ({keywords.length})
      </p>
      <div className="flex flex-wrap gap-1">
        {keywords.map((kw, i) => (
          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{kw}</Badge>
        ))}
      </div>
    </div>
  );
}

/* ── Main Card ── */
export default function OceanCard({ data }: { data: OceanData }) {
  if (!data?.success && !data?.name && !data?.domain) {
    return (
      <div className="text-sm text-muted-foreground">
        {data?.error || 'No firmographic data available.'}
      </div>
    );
  }

  const hasDepts = (data.departmentSizes?.length ?? 0) > 0;
  const hasLocations = (data.locations?.length ?? 0) > 0;
  const hasTraffic = !!data.webTraffic;
  const hasTech = (data.technologies?.length ?? 0) > 0;
  const hasContact = (data.emails?.length ?? 0) > 0 || !!data.medias;
  const hasKeywords = (data.keywords?.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      {/* Header with logo */}
      <div className="flex items-start gap-3">
        {data.logo && (
          <img src={data.logo} alt="" className="h-10 w-10 rounded object-contain bg-muted p-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          {data.companyName && <p className="font-medium text-sm">{data.companyName}</p>}
          {data.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{data.description}</p>}
        </div>
      </div>

      <CardTabs
        defaultValue="overview"
        tabs={[
          { value: 'overview', label: 'Overview', content: <OverviewTab data={data} /> },
          { value: 'departments', label: 'Departments', visible: hasDepts, content: hasDepts ? <DepartmentsTab departments={data.departmentSizes!} /> : null },
          { value: 'locations', label: 'Locations', icon: <MapPin className="h-3.5 w-3.5" />, visible: hasLocations, content: hasLocations ? <LocationsTab locations={data.locations!} /> : null },
          { value: 'traffic', label: 'Traffic', visible: hasTraffic, content: hasTraffic ? <TrafficTab traffic={data.webTraffic!} /> : null },
          { value: 'tech', label: 'Tech Stack', icon: <Cpu className="h-3.5 w-3.5" />, visible: hasTech, content: <TechTab data={data} /> },
          { value: 'contact', label: 'Contact', icon: <Mail className="h-3.5 w-3.5" />, visible: hasContact, content: <ContactTab data={data} /> },
          { value: 'keywords', label: 'Keywords', icon: <Tag className="h-3.5 w-3.5" />, visible: hasKeywords, content: hasKeywords ? <KeywordsTab keywords={data.keywords!} /> : null },
        ]}
      />
    </div>
  );
}
