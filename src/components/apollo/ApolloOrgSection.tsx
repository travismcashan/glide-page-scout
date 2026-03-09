import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, DollarSign, MapPin, Phone, Linkedin, Twitter, Globe, Tag, TrendingUp, TrendingDown, BarChart3, ExternalLink } from 'lucide-react';
import { ApolloData } from './types';

function GrowthBadge({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  const pct = (value * 100).toFixed(1);
  const isPositive = value > 0;
  return (
    <span className="flex items-center gap-1 text-xs">
      {isPositive ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
      <span className={isPositive ? 'text-primary' : 'text-destructive'}>{isPositive ? '+' : ''}{pct}%</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function ApolloOrgSection({ data }: { data: ApolloData }) {
  if (!data.organizationName) return null;

  return (
    <div className="border-t pt-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Company</h4>
      <div className="flex items-start gap-3">
        {data.organizationLogo ? (
          <img src={data.organizationLogo} alt="" className="h-10 w-10 rounded border object-contain bg-background p-0.5" />
        ) : (
          <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{data.organizationName}</span>
            {data.organizationIndustry && <Badge variant="outline" className="text-[10px] capitalize">{data.organizationIndustry}</Badge>}
            {data.organizationPubliclyTradedSymbol && (
              <Badge variant="secondary" className="text-[10px]">
                {data.organizationPubliclyTradedExchange ? `${data.organizationPubliclyTradedExchange}:` : ''}{data.organizationPubliclyTradedSymbol}
              </Badge>
            )}
          </div>
          {data.organizationDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2">{data.organizationDescription}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {data.organizationSize && (
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{data.organizationSize.toLocaleString()} employees</span>
            )}
            {data.organizationFounded && (
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Founded {data.organizationFounded}</span>
            )}
            {data.organizationRevenue && (
              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{data.organizationRevenue}</span>
            )}
            {(data.organizationCity || data.organizationCountry) && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />
                {data.organizationRawAddress || [data.organizationStreetAddress, data.organizationCity, data.organizationState, data.organizationPostalCode, data.organizationCountry].filter(Boolean).join(', ')}
              </span>
            )}
            {data.organizationAlexaRanking && (
              <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />Alexa #{data.organizationAlexaRanking.toLocaleString()}</span>
            )}
            {data.organizationRetailLocationCount != null && data.organizationRetailLocationCount > 0 && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{data.organizationRetailLocationCount} locations</span>
            )}
          </div>

          {/* Headcount growth */}
          {(data.organizationHeadcountGrowth6mo != null || data.organizationHeadcountGrowth12mo != null || data.organizationHeadcountGrowth24mo != null) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <GrowthBadge label="6mo" value={data.organizationHeadcountGrowth6mo} />
              <GrowthBadge label="12mo" value={data.organizationHeadcountGrowth12mo} />
              <GrowthBadge label="24mo" value={data.organizationHeadcountGrowth24mo} />
            </div>
          )}

          {/* Links row */}
          <div className="flex flex-wrap gap-3 text-xs">
            {data.organizationWebsite && (
              <a href={data.organizationWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><Globe className="h-3 w-3" />Website</a>
            )}
            {data.organizationLinkedin && (
              <a href={data.organizationLinkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><Linkedin className="h-3 w-3" />LinkedIn</a>
            )}
            {data.organizationTwitter && (
              <a href={data.organizationTwitter} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><Twitter className="h-3 w-3" />Twitter</a>
            )}
            {data.organizationFacebook && (
              <a href={data.organizationFacebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><Globe className="h-3 w-3" />Facebook</a>
            )}
            {data.organizationBlogUrl && (
              <a href={data.organizationBlogUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" />Blog</a>
            )}
            {data.organizationAngellistUrl && (
              <a href={data.organizationAngellistUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" />AngelList</a>
            )}
            {data.organizationCrunchbaseUrl && (
              <a href={data.organizationCrunchbaseUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" />Crunchbase</a>
            )}
            {data.organizationPhone && (
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{data.organizationPhone}</span>
            )}
          </div>

          {/* Industry classification codes */}
          {((data.organizationSicCodes && data.organizationSicCodes.length > 0) || (data.organizationNaicsCodes && data.organizationNaicsCodes.length > 0)) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {data.organizationSicCodes && data.organizationSicCodes.length > 0 && (
                <span>SIC: {data.organizationSicCodes.join(', ')}</span>
              )}
              {data.organizationNaicsCodes && data.organizationNaicsCodes.length > 0 && (
                <span>NAICS: {data.organizationNaicsCodes.join(', ')}</span>
              )}
            </div>
          )}

          {/* Secondary industries */}
          {data.organizationSecondaryIndustries && data.organizationSecondaryIndustries.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.organizationSecondaryIndustries.map(ind => (
                <Badge key={ind} variant="outline" className="text-[10px] capitalize">{ind}</Badge>
              ))}
            </div>
          )}

          {/* Languages */}
          {data.organizationLanguages && data.organizationLanguages.length > 0 && (
            <div className="text-xs text-muted-foreground">Languages: {data.organizationLanguages.join(', ')}</div>
          )}
        </div>
      </div>

      {/* Technologies */}
      {data.organizationTechnologies && data.organizationTechnologies.length > 0 && (
        <div className="mt-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Tag className="h-3 w-3" />Technologies</span>
          <div className="flex flex-wrap gap-1">
            {data.organizationTechnologies.slice(0, 15).map(t => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
            ))}
            {data.organizationTechnologies.length > 15 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{data.organizationTechnologies.length - 15} more</Badge>
            )}
          </div>
        </div>
      )}

      {/* Keywords */}
      {data.organizationKeywords && data.organizationKeywords.length > 0 && (
        <div className="mt-2">
          <span className="text-xs text-muted-foreground mb-1 block">Keywords</span>
          <p className="text-xs text-muted-foreground">{data.organizationKeywords.slice(0, 10).join(', ')}{data.organizationKeywords.length > 10 ? ` (+${data.organizationKeywords.length - 10} more)` : ''}</p>
        </div>
      )}
    </div>
  );
}
