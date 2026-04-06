import { useEngagements, type Engagement } from '@/hooks/useEngagements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Mail, PhoneCall, Calendar, StickyNote, CheckSquare,
  MessageSquare, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { BrandLoader } from '@/components/BrandLoader';

interface EngagementTimelineProps {
  companyId: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  call: <PhoneCall className="h-3.5 w-3.5" />,
  meeting: <Calendar className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
  task: <CheckSquare className="h-3.5 w-3.5" />,
};

const TYPE_COLORS: Record<string, string> = {
  email: 'border-l-blue-500',
  call: 'border-l-green-500',
  meeting: 'border-l-purple-500',
  note: 'border-l-yellow-500',
  task: 'border-l-orange-500',
};

function groupByMonth(engagements: Engagement[]): Record<string, Engagement[]> {
  const groups: Record<string, Engagement[]> = {};
  for (const eng of engagements) {
    const key = eng.occurred_at
      ? format(new Date(eng.occurred_at), 'MMMM yyyy')
      : 'Unknown Date';
    if (!groups[key]) groups[key] = [];
    groups[key].push(eng);
  }
  return groups;
}

export function EngagementTimeline({ companyId }: EngagementTimelineProps) {
  const { data: engagements = [], isLoading } = useEngagements(companyId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <BrandLoader size={24} />
      </div>
    );
  }

  if (engagements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm font-medium">No engagement history</p>
        <p className="text-xs mt-1">Sync HubSpot engagements to see calls, emails, meetings, and tasks.</p>
      </div>
    );
  }

  // Summary counts
  const typeCounts: Record<string, number> = {};
  for (const e of engagements) {
    typeCounts[e.engagement_type] = (typeCounts[e.engagement_type] || 0) + 1;
  }

  const grouped = groupByMonth(engagements);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Engagement Timeline ({engagements.length})
        </CardTitle>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(typeCounts).map(([type, count]) => (
            <Badge key={type} variant="secondary" className="text-xs capitalize gap-1">
              {TYPE_ICONS[type] || <MessageSquare className="h-3 w-3" />}
              {type} ({count})
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, items]) => (
            <div key={month}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {month}
              </h4>
              <div className="space-y-1.5">
                {items.map((eng) => (
                  <div
                    key={eng.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border-l-2 ${TYPE_COLORS[eng.engagement_type] || 'border-l-border'} hover:bg-accent/5 transition-colors`}
                  >
                    <div className="text-muted-foreground mt-0.5 shrink-0">
                      {TYPE_ICONS[eng.engagement_type] || <MessageSquare className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize">{eng.engagement_type}</span>
                        {eng.direction && (
                          <Badge variant="outline" className="text-[10px] py-0 gap-0.5">
                            {eng.direction === 'inbound' ? (
                              <ArrowDownLeft className="h-2.5 w-2.5" />
                            ) : (
                              <ArrowUpRight className="h-2.5 w-2.5" />
                            )}
                            {eng.direction}
                          </Badge>
                        )}
                        {eng.occurred_at && (
                          <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">
                            {format(new Date(eng.occurred_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      {eng.subject && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{eng.subject}</p>
                      )}
                      {eng.body_preview && (
                        <p className="text-xs text-muted-foreground/60 line-clamp-2 mt-0.5">
                          {eng.body_preview}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
