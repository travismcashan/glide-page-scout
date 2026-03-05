import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Clock, MessageSquare, Phone, Video, Users, FileText, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { format } from 'date-fns';
import { CardTabs } from './CardTabs';
import { supabase } from '@/integrations/supabase/client';

type Sentence = { text: string; speakerName: string; start: number; end: number };

type Meeting = {
  uuid: string;
  subject: string;
  startAt: string;
  endAt: string;
  duration: number;
  state: string;
  isCall: boolean;
  organizerEmail: string;
  attendees: { email: string; name: string }[];
  purpose: string | null;
  outcome: string | null;
  transcriptReady: boolean;
  notesReady: boolean;
  transcriptionUuid: string | null;
  transcript: {
    sentences: Sentence[];
    totalSentences: number;
    truncated?: boolean;
  } | null;
  insights: {
    aiNotes: { text: string; noteType: string }[];
    keywords: { word: string; count: number }[];
    speakers: { name: string; email: string; is_rep: boolean }[];
  } | null;
  matchReason?: string;
};

type AvomaData = {
  domain: string;
  totalMatches: number;
  meetings: Meeting[];
  matchBreakdown?: { emailDomain: number; attendeeName: number; subject: number };
};

function TranscriptView({ meeting }: { meeting: Meeting }) {
  const [fullSentences, setFullSentences] = useState<Sentence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentences = fullSentences || meeting.transcript?.sentences || [];
  const totalSentences = fullSentences ? fullSentences.length : (meeting.transcript?.totalSentences || 0);
  const isTruncated = !fullSentences && meeting.transcript?.truncated;

  const loadFullTranscript = async () => {
    if (!meeting.transcriptionUuid) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('avoma-lookup', {
        body: { action: 'transcript', transcriptionUuid: meeting.transcriptionUuid },
      });
      if (fnError || !data?.success) {
        setError(fnError?.message || data?.error || 'Failed to load transcript');
      } else {
        setFullSentences(data.sentences);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (sentences.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium mb-1.5">Transcript ({totalSentences} sentences)</p>
      <div className="max-h-96 overflow-y-auto space-y-0.5 text-xs text-muted-foreground bg-background rounded-md p-2 border border-border">
        {sentences.map((s, i) => (
          <p key={i}>
            <span className="font-medium text-foreground">{s.speakerName}:</span> {s.text}
          </p>
        ))}
      </div>
      {isTruncated && (
        <div className="mt-2">
          {error && <p className="text-xs text-destructive mb-1">{error}</p>}
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={loadFullTranscript}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading full transcript...</>
            ) : (
              <>Load Full Transcript ({totalSentences - sentences.length} more sentences)</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function MeetingsList({ data }: { data: AvomaData }) {
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-1">
        Found <strong>{data.totalMatches}</strong> meetings matching <strong>{data.domain}</strong>
      </p>
      {data.matchBreakdown && (data.matchBreakdown.attendeeName > 0 || data.matchBreakdown.subject > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.matchBreakdown.emailDomain > 0 && (
            <Badge variant="secondary" className="text-[10px]">📧 Email domain: {data.matchBreakdown.emailDomain}</Badge>
          )}
          {data.matchBreakdown.attendeeName > 0 && (
            <Badge variant="secondary" className="text-[10px]">👤 Name match: {data.matchBreakdown.attendeeName}</Badge>
          )}
          {data.matchBreakdown.subject > 0 && (
            <Badge variant="secondary" className="text-[10px]">📋 Subject match: {data.matchBreakdown.subject}</Badge>
          )}
        </div>
      )}
      {data.meetings.map((meeting) => {
        const isExpanded = expandedMeeting === meeting.uuid;
        const domainAttendees = meeting.attendees.filter(a =>
          a.email?.toLowerCase().endsWith(`@${data.domain}`)
        );
        return (
          <Collapsible key={meeting.uuid} open={isExpanded} onOpenChange={() => setExpandedMeeting(isExpanded ? null : meeting.uuid)}>
            <CollapsibleTrigger className="w-full text-left">
              <Card className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {meeting.isCall ? <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <p className="text-sm font-medium truncate">{meeting.subject || 'Untitled Meeting'}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(meeting.startAt), 'MMM d, yyyy h:mm a')}
                      </span>
                      {meeting.duration && (
                        <span>{Math.round(meeting.duration / 60)}m</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {meeting.attendees.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {meeting.matchReason && meeting.matchReason !== 'email_domain' && (
                      <Badge variant="outline" className="text-[9px] text-muted-foreground">
                        {meeting.matchReason === 'attendee_name' ? '👤 name' : '📋 subject'}
                      </Badge>
                    )}
                    {meeting.purpose && <Badge variant="secondary" className="text-[10px]">{meeting.purpose}</Badge>}
                    {meeting.outcome && <Badge variant="outline" className="text-[10px]">{meeting.outcome}</Badge>}
                    {meeting.transcriptReady && <FileText className="h-3.5 w-3.5 text-primary" />}
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <Card className="p-4 bg-muted/30 space-y-4">
                <div>
                  <p className="text-xs font-medium mb-1.5">Attendees from @{data.domain}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {domainAttendees.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {a.name || a.email}
                      </Badge>
                    ))}
                  </div>
                </div>

                {meeting.insights?.aiNotes && meeting.insights.aiNotes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1.5 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> AI Notes
                    </p>
                    <ul className="space-y-1">
                      {meeting.insights.aiNotes.slice(0, 10).map((note, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          {note.noteType && <Badge variant="outline" className="text-[9px] mr-1.5">{note.noteType}</Badge>}
                          {note.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {meeting.insights?.keywords && meeting.insights.keywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1.5">Top Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {meeting.insights.keywords.map((kw: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {kw.word} ({kw.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <TranscriptView meeting={meeting} />
              </Card>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function InsightsSummary({ data }: { data: AvomaData }) {
  const allKeywords = new Map<string, number>();
  const allPurposes = new Map<string, number>();
  const allOutcomes = new Map<string, number>();

  for (const m of data.meetings) {
    if (m.purpose) allPurposes.set(m.purpose, (allPurposes.get(m.purpose) || 0) + 1);
    if (m.outcome) allOutcomes.set(m.outcome, (allOutcomes.get(m.outcome) || 0) + 1);
    if (m.insights?.keywords) {
      for (const kw of m.insights.keywords) {
        allKeywords.set(kw.word, (allKeywords.get(kw.word) || 0) + kw.count);
      }
    }
  }

  const sortedKeywords = [...allKeywords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  const totalDuration = data.meetings.reduce((sum, m) => sum + (m.duration || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold">{data.totalMatches}</p>
          <p className="text-xs text-muted-foreground">Total Meetings</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold">{Math.round(totalDuration / 3600)}h</p>
          <p className="text-xs text-muted-foreground">Total Duration</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold">{data.meetings.filter(m => m.transcriptReady).length}</p>
          <p className="text-xs text-muted-foreground">With Transcripts</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold">{data.meetings.filter(m => m.notesReady).length}</p>
          <p className="text-xs text-muted-foreground">With AI Notes</p>
        </Card>
      </div>

      {allPurposes.size > 0 && (
        <div>
          <p className="text-xs font-medium mb-1.5">Meeting Types</p>
          <div className="flex flex-wrap gap-1.5">
            {[...allPurposes.entries()].map(([purpose, count]) => (
              <Badge key={purpose} variant="secondary">{purpose} ({count})</Badge>
            ))}
          </div>
        </div>
      )}

      {allOutcomes.size > 0 && (
        <div>
          <p className="text-xs font-medium mb-1.5">Outcomes</p>
          <div className="flex flex-wrap gap-1.5">
            {[...allOutcomes.entries()].map(([outcome, count]) => (
              <Badge key={outcome} variant="outline">{outcome} ({count})</Badge>
            ))}
          </div>
        </div>
      )}

      {sortedKeywords.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1.5">Top Keywords Across All Calls</p>
          <div className="flex flex-wrap gap-1">
            {sortedKeywords.map(([word, count]) => (
              <Badge key={word} variant="outline" className="text-[10px]">{word} ({count})</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AvomaCard({ data, onSearchDomain }: { data: AvomaData; onSearchDomain?: (domain: string) => void }) {
  const [manualInput, setManualInput] = useState('');
  const [searching, setSearching] = useState(false);

  const handleManualSearch = () => {
    if (!manualInput.trim() || !onSearchDomain) return;
    let domain = manualInput.trim().toLowerCase();
    if (domain.includes('@')) domain = domain.split('@').pop() || domain;
    try { domain = new URL(domain.startsWith('http') ? domain : `https://${domain}`).hostname.replace(/^www\./, ''); } catch { /* use as-is */ }
    setSearching(true);
    onSearchDomain(domain);
  };

  if (!data.meetings || data.meetings.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No Avoma meetings found with attendees from <strong>@{data.domain}</strong> in the last 12 months.
        </p>
        {onSearchDomain && (
          <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Try searching by a contact's email address or company domain:
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. john@company.com or company.com"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={handleManualSearch}
                disabled={!manualInput.trim() || searching}
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const tabs = [
    { value: 'meetings', label: `Meetings (${data.totalMatches})`, content: <MeetingsList data={data} /> },
    { value: 'insights', label: 'Insights', content: <InsightsSummary data={data} /> },
  ];

  return <CardTabs tabs={tabs} />;
}
