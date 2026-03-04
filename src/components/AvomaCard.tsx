import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Clock, MessageSquare, Phone, Video, Users, FileText } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { CardTabs } from './CardTabs';

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
  transcript: {
    sentences: { text: string; speakerName: string; start: number; end: number }[];
    totalSentences: number;
  } | null;
  insights: {
    aiNotes: { text: string; noteType: string }[];
    keywords: { word: string; count: number }[];
    speakers: { name: string; email: string; is_rep: boolean }[];
  } | null;
};

type AvomaData = {
  domain: string;
  totalMatches: number;
  meetings: Meeting[];
};

function MeetingsList({ data }: { data: AvomaData }) {
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Found <strong>{data.totalMatches}</strong> meetings with <strong>@{data.domain}</strong> attendees
      </p>
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

                {meeting.transcript && meeting.transcript.sentences.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1.5">Transcript ({meeting.transcript.totalSentences} sentences)</p>
                    <div className="max-h-48 overflow-y-auto space-y-0.5 text-xs text-muted-foreground bg-background rounded-md p-2 border border-border">
                      {meeting.transcript.sentences.slice(0, 50).map((s, i) => (
                        <p key={i}>
                          <span className="font-medium text-foreground">{s.speakerName}:</span> {s.text}
                        </p>
                      ))}
                      {meeting.transcript.totalSentences > 50 && (
                        <p className="text-muted-foreground/60 italic">... {meeting.transcript.totalSentences - 50} more sentences</p>
                      )}
                    </div>
                  </div>
                )}
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

export function AvomaCard({ data }: { data: AvomaData }) {
  if (!data.meetings || data.meetings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Avoma meetings found with attendees from <strong>@{data.domain}</strong> in the last 12 months.
      </p>
    );
  }

  const tabs = [
    { value: 'meetings', label: `Meetings (${data.totalMatches})`, content: <MeetingsList data={data} /> },
    { value: 'insights', label: 'Insights', content: <InsightsSummary data={data} /> },
  ];

  return <CardTabs tabs={tabs} />;
}
