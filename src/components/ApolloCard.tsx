import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Linkedin, Mail, Phone, Building2, MapPin, Briefcase, Search, Globe, Twitter, Github, Calendar, DollarSign, Tag, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

type ApolloData = {
  success: boolean;
  found?: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  headline?: string;
  linkedinUrl?: string;
  photoUrl?: string;
  email?: string;
  emailStatus?: string;
  personalEmails?: string[];
  phone?: string;
  phoneNumbers?: { sanitized_number: string; type: string }[];
  city?: string;
  state?: string;
  country?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  githubUrl?: string;
  organizationName?: string;
  organizationDomain?: string;
  organizationIndustry?: string;
  organizationSize?: number;
  organizationLinkedin?: string;
  organizationLogo?: string;
  organizationWebsite?: string;
  organizationFounded?: number;
  organizationRevenue?: string;
  organizationDescription?: string;
  organizationKeywords?: string[];
  organizationPhone?: string;
  organizationCity?: string;
  organizationState?: string;
  organizationCountry?: string;
  organizationTechnologies?: string[];
  seniority?: string;
  departments?: string[];
  employmentHistory?: { title: string; organizationName: string; startDate?: string; endDate?: string; current?: boolean; description?: string }[];
  error?: string;
};

type Props = {
  data: ApolloData | null;
  isLoading: boolean;
  onSearch: (email: string, firstName?: string, lastName?: string) => void;
};

function formatDate(d?: string) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM yyyy'); } catch { return d; }
}

export function ApolloCard({ data, isLoading, onSearch }: Props) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showAllJobs, setShowAllJobs] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Email is required'); return; }
    onSearch(email.trim(), firstName.trim() || undefined, lastName.trim() || undefined);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Enter your prospect's email to pull their professional profile, employment history, and company details from Apollo's 275M+ contact database.</p>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" type="email" required disabled={isLoading} />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">First name</label>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" disabled={isLoading} />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">Last name</label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" disabled={isLoading} />
        </div>
        <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {isLoading ? 'Searching...' : 'Enrich'}
        </Button>
      </form>

      {data && data.found === false && (
        <p className="text-sm text-muted-foreground">No matching contact found in Apollo's database.</p>
      )}

      {data && data.found && (
        <div className="border rounded-lg overflow-hidden">
          {/* Person Header */}
          <div className="p-4 bg-muted/30">
            <div className="flex items-start gap-4">
              {data.photoUrl ? (
                <img src={data.photoUrl} alt={data.name || ''} className="h-16 w-16 rounded-full object-cover border-2 border-background shadow" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
                  {(data.firstName?.[0] || '?')}{(data.lastName?.[0] || '')}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-lg leading-tight">{data.name}</h3>
                  {data.seniority && <Badge variant="secondary" className="text-[10px] capitalize">{data.seniority}</Badge>}
                  {data.departments?.map(d => (
                    <Badge key={d} variant="outline" className="text-[10px] capitalize">{d.replace('master_', '')}</Badge>
                  ))}
                </div>
                {data.title && <p className="text-sm font-medium text-muted-foreground mt-0.5">{data.title}</p>}
                {data.headline && data.headline !== data.title && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{data.headline}</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Contact & Social */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact & Social</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {data.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${data.email}`} className="text-primary hover:underline truncate">{data.email}</a>
                    {data.emailStatus && <Badge variant={data.emailStatus === 'verified' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{data.emailStatus}</Badge>}
                  </div>
                )}
                {data.personalEmails && data.personalEmails.length > 0 && data.personalEmails.map(pe => (
                  <div key={pe} className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${pe}`} className="text-primary hover:underline truncate">{pe}</a>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">personal</Badge>
                  </div>
                ))}
                {data.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{data.phone}</span>
                  </div>
                )}
                {data.linkedinUrl && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                      {data.linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}
                    </a>
                  </div>
                )}
                {data.twitterUrl && (
                  <div className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={data.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{data.twitterUrl.replace(/https?:\/\/(www\.)?twitter\.com\//, '@')}</a>
                  </div>
                )}
                {data.githubUrl && (
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={data.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{data.githubUrl.replace(/https?:\/\/(www\.)?github\.com\//, '')}</a>
                  </div>
                )}
                {(data.city || data.state || data.country) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{[data.city, data.state, data.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Organization */}
            {data.organizationName && (
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
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[data.organizationCity, data.organizationState, data.organizationCountry].filter(Boolean).join(', ')}</span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs">
                      {data.organizationWebsite && (
                        <a href={data.organizationWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><Globe className="h-3 w-3" />Website</a>
                      )}
                      {data.organizationLinkedin && (
                        <a href={data.organizationLinkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><Linkedin className="h-3 w-3" />LinkedIn</a>
                      )}
                      {data.organizationPhone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{data.organizationPhone}</span>
                      )}
                    </div>
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
            )}

            {/* Employment History */}
            {data.employmentHistory && data.employmentHistory.length > 0 && (
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Employment History ({data.employmentHistory.length} positions)
                </h4>
                <div className="space-y-2">
                  {(showAllJobs ? data.employmentHistory : data.employmentHistory.slice(0, 5)).map((job, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: job.current ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)' }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${job.current ? 'text-foreground' : 'text-muted-foreground'}`}>{job.title}</span>
                          {job.current && <Badge variant="default" className="text-[10px] px-1.5 py-0">Current</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.organizationName}
                          {(job.startDate || job.endDate) && (
                            <span className="ml-1.5">· {formatDate(job.startDate)}{job.endDate ? ` – ${formatDate(job.endDate)}` : ' – Present'}</span>
                          )}
                        </div>
                        {job.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{job.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                {data.employmentHistory.length > 5 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllJobs(!showAllJobs)} className="mt-2 text-xs">
                    {showAllJobs ? 'Show less' : `Show all ${data.employmentHistory.length} positions`}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
