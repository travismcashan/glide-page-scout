import { useState } from 'react';
import { AudioLines, Video, Mail, MessageSquare, Loader2 } from 'lucide-react';
import { AvomaCard } from '@/components/AvomaCard';
import { GmailCard } from '@/components/GmailCard';
import { SlackMessagesCard } from '@/components/company/SlackMessagesCard';
import { useCompanyMeetings } from '@/hooks/useCompanyMeetings';
import { cn } from '@/lib/utils';

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

export function CompanyVoiceTab({ companyId, companyName, companyDomain, contactEmails, sessionId }: CompanyVoiceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('meetings');
  const { data: meetings, isLoading: meetingsLoading } = useCompanyMeetings(companyId);

  // Build AvomaCard-compatible data shape from local meetings
  const avomaData = meetings && meetings.length > 0
    ? {
        domain: companyDomain || '',
        totalMatches: meetings.length,
        meetings: meetings.map(m => ({
          uuid: m.external_id || m.id,
          subject: m.title || 'Untitled Meeting',
          scheduled_at: m.date,
          duration: m.duration_minutes ? m.duration_minutes * 60 : null,
          attendees: m.attendees || [],
          summary: m.summary,
          transcript_url: m.recording_url,
        })),
      }
    : null;

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
          {meetingsLoading && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Loading meetings...</div>
            </div>
          )}
          {!meetingsLoading && avomaData && (
            <AvomaCard data={avomaData} />
          )}
          {!meetingsLoading && !avomaData && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No meetings found for this company. Use "Sync Meetings" to pull from Avoma.
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
