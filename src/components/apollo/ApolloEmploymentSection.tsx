import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, GraduationCap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ApolloData } from './types';

function formatDate(d?: string) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM yyyy'); } catch { return d; }
}

export function ApolloEmploymentSection({ data }: { data: ApolloData }) {
  const [showAll, setShowAll] = useState(false);
  const history = data.employmentHistory;
  if (!history || history.length === 0) return null;

  const education = history.filter(h => h.kind === 'education');
  const jobs = history.filter(h => h.kind !== 'education');

  return (
    <div className="border-t pt-3 space-y-3">
      {/* Jobs */}
      {jobs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Employment History ({jobs.length} positions)
          </h4>
          <div className="space-y-2">
            {(showAll ? jobs : jobs.slice(0, 5)).map((job, i) => (
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
          {jobs.length > 5 && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="mt-2 text-xs">
              {showAll ? 'Show less' : `Show all ${jobs.length} positions`}
            </Button>
          )}
        </div>
      )}

      {/* Education */}
      {education.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" /> Education
          </h4>
          <div className="space-y-2">
            {education.map((edu, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <div className="mt-1.5 h-2 w-2 rounded-full shrink-0 bg-muted-foreground/30" />
                <div className="min-w-0">
                  <span className="font-medium text-muted-foreground">{edu.degree || edu.title}</span>
                  <div className="text-xs text-muted-foreground">
                    {edu.organizationName}
                    {(edu.startDate || edu.endDate) && (
                      <span className="ml-1.5">· {formatDate(edu.startDate)}{edu.endDate ? ` – ${formatDate(edu.endDate)}` : ''}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
