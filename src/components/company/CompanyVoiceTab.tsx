import { useState, useEffect, useRef } from 'react';
import { AudioLines, Video, Mail, MessageSquare, Loader2 } from 'lucide-react';
import { AvomaCard } from '@/components/AvomaCard';
import { GmailCard } from '@/components/GmailCard';
import { SlackMessagesCard } from '@/components/company/SlackMessagesCard';
import { useCompanyAvoma } from '@/hooks/useCompanyAvoma';
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
  const avomaAutoSearched = useRef(false);
  const { data: avomaData, loading: avomaLoading, progress: avomaProgress, error: avomaError, search: avomaSearch, loadCached: avomaLoadCached } = useCompanyAvoma(companyId, companyDomain, contactEmails);

  // Load cached Avoma data on mount
  useEffect(() => {
    avomaLoadCached();
  }, [avomaLoadCached]);

  // Auto-search Avoma on first activation if no cached data
  useEffect(() => {
    if (activeSubTab === 'meetings' && !avomaData && !avomaLoading && !avomaAutoSearched.current && companyDomain) {
      avomaAutoSearched.current = true;
      avomaSearch();
    }
  }, [activeSubTab, avomaData, avomaLoading, avomaSearch, companyDomain]);

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

      {/* Meetings sub-tab (Avoma) */}
      {activeSubTab === 'meetings' && (
        <div>
          {avomaLoading && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                {avomaProgress
                  ? `${avomaProgress.phase} — ${avomaProgress.matchesFound} matches found (scanned ${avomaProgress.meetingsScanned}/${avomaProgress.totalMeetings})`
                  : 'Searching Avoma meetings...'}
              </div>
            </div>
          )}
          {avomaError && (
            <div className="text-sm text-red-400 py-4">
              {avomaError}
              <button onClick={() => avomaSearch()} className="ml-2 underline hover:text-foreground">Retry</button>
            </div>
          )}
          {!avomaLoading && !avomaError && avomaData && (
            <AvomaCard
              data={avomaData}
              onSearchDomain={(domain) => avomaSearch(domain)}
            />
          )}
          {!avomaLoading && !avomaError && !avomaData && !companyDomain && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No domain set for this company. Add a domain to search Avoma meetings.
            </p>
          )}
          {!avomaLoading && !avomaError && !avomaData && companyDomain && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No Avoma meetings found for {companyDomain}.
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
