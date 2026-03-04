import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Globe, MapPin, Users, Calendar, DollarSign, Cpu, ExternalLink } from 'lucide-react';

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
  yearFounded?: number | null;
  revenue?: string | null;
  linkedinUrl?: string | null;
  description?: string | null;
  ecommercePlatform?: string | null;
  websiteTraffic?: Record<string, any> | null;
  error?: string;
};

export default function OceanCard({ data }: { data: OceanData }) {
  if (!data?.success) {
    return (
      <div className="text-sm text-muted-foreground">
        {data?.error || 'No firmographic data available.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Company overview */}
      <div className="space-y-2">
        {data.companyName && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm">{data.companyName}</span>
          </div>
        )}
        {data.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{data.description}</p>
        )}
      </div>

      {/* Key facts grid */}
      <div className="grid grid-cols-2 gap-3">
        {data.companySize && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Employees</p>
              <p className="text-xs font-medium">{data.companySize}</p>
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
      </div>

      {/* Industries */}
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

      {/* Industry categories */}
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

      {/* Technologies */}
      {data.technologies && data.technologies.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
            <Cpu className="h-3 w-3" /> Technologies
          </p>
          <div className="flex flex-wrap gap-1">
            {data.technologies.map((tech, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{tech}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Countries */}
      {data.countries && data.countries.length > 1 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
            <Globe className="h-3 w-3" /> All Countries
          </p>
          <p className="text-xs">{data.countries.map(c => c.toUpperCase()).join(', ')}</p>
        </div>
      )}

      {/* Ecommerce platform */}
      {data.ecommercePlatform && (
        <div className="text-xs">
          <span className="text-muted-foreground">E-commerce: </span>
          <span className="font-medium">{data.ecommercePlatform}</span>
        </div>
      )}

      {/* LinkedIn link */}
      {data.linkedinUrl && (
        <a
          href={data.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> LinkedIn Profile
        </a>
      )}
    </div>
  );
}
