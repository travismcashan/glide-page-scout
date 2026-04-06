import { useState, useCallback } from 'react';
import { AudioLines, Video, Mail, MessageSquare, Loader2, RefreshCw, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { GmailCard } from '@/components/GmailCard';
import { SlackMessagesCard } from '@/components/company/SlackMessagesCard';
import { useCompanyMeetings, CompanyMeeting } from '@/hooks/useCompanyMeetings';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type SubTab = 'meetings' | 'emails' | 'messages';

const SUB_TABS: { value: SubTab; label: string; icon: React.ReactNode }[] = [
  { value: 'meetings', label: 'Meetings', icon: <Video className="h-3.5 w-3.5" /> },
  { value: 'emails', label: 'Emails', icon: <Mail className="h-3.5 w-3.5" /> },
  { value: 'messages', label: 'Messages', icon: <MessageSquare className="h-3.5 w-3.5" /> },
];

interface CompanyVoiceTabProps {
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  contactEmails: string[];
  /** A session ID for knowledge ingestion (sentinel chat session or first site) */
  sessionId?: string;
}

function MeetingCard({ meeting }: { meeting: CompanyMeeting }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="w-full text-left">
        <Card className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium truncate">{meeting.title || 'Untitled Meeting'}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {meeting.date && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(meeting.date), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
                {meeting.duration_minutes != null && (
                  <span>{meeting.duration_minutes}m</span>
                )}
                {meeting.attendees && meeting.attendees.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {meeting.attendees.length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {meeting.source && (
                <Badge variant="secondary" className="text-[10px]">{meeting.source}</Badge>
              )}
              {meeting.recording_url && (
                <Badge variant="outline" className="text-[10px]">Recording</Badge>
              )}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <Card className="p-4 bg-muted/30 space-y-3">
          {meeting.attendees && meeting.attendees.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5">Attendees</p>
              <div className="flex flex-wrap gap-1.5">
                {meeting.attendees.map((a: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {typeof a === 'string' ? a : (a.name || a.email || 'Unknown')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {meeting.summary && (
            <div>
              <p className="text-xs font-medium mb-1">Summary</p>
              <p className="text-xs text-muted-foreground">{meeting.summary}</p>
            </div>
          )}
          {meeting.recording_url && (
            <a
              href={meeting.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View Recording
            </a>
          )}
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CompanyVoiceTab({ companyId, companyName, companyDomain, contactEmails, sessionId }: CompanyVoiceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('meetings');
  const { data: meetings, isLoading: meetingsLoading } = useCompanyMeetings(companyId);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSyncAvoma = useCallback(async () => {
    if (!companyDomain) {
      toast.error('No domain available for this company');
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('avoma-sync', {
        body: { companyId, domain: companyDomain, contactEmails },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const count = data?.synced ?? data?.meetings_synced ?? 0;
      toast.success(`Synced ${count} meeting${count !== 1 ? 's' : ''} from Avoma`);
      queryClient.invalidateQueries({ queryKey: ['company-meetings', companyId] });
    } catch (err: any) {
      console.error('[avoma-sync]', err);
      toast.error(err.message || 'Avoma sync failed');
    } finally {
      setSyncing(false);
    }
  }, [companyId, companyDomain, contactEmails, queryClient]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <AudioLines className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">Agency Voice</h2>
        <span className="text-xs text-muted-foreground">Communications across all channels</span>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 mb-6 bg-muted/30 rounded-lg p-1 w-fit">
        {SUB_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveSubTab(tab.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
              activeSubTab === tab.value
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Meetings sub-tab */}
      {activeSubTab === 'meetings' && (
        <div>
          {/* Sync button */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-muted-foreground">
              {meetings && meetings.length > 0
                ? `${meetings.length} meeting${meetings.length !== 1 ? 's' : ''} from local data`
                : 'Meetings synced from Avoma'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAvoma}
              disabled={syncing || !companyDomain}
              className="gap-1.5 h-7 text-xs"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {syncing ? 'Syncing...' : 'Sync from Avoma'}
            </Button>
          </div>

          {meetingsLoading && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Loading meetings...</div>
            </div>
          )}
          {!meetingsLoading && meetings && meetings.length > 0 && (
            <div className="space-y-2">
              {meetings.map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
          {!meetingsLoading && (!meetings || meetings.length === 0) && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No meetings found for this company. Click "Sync from Avoma" to pull meetings.
            </p>
          )}
        </div>
      )}

      {/* Emails sub-tab (Gmail) */}
      {activeSubTab === 'emails' && (
        <GmailCard
          domain={companyDomain || companyName}
          companyId={companyId}
          contactEmails={contactEmails}
          lookbackDays={180}
        />
      )}

      {/* Messages sub-tab (Slack) */}
      {activeSubTab === 'messages' && (
        <SlackMessagesCard
          companyName={companyName}
          companyId={companyId}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}
