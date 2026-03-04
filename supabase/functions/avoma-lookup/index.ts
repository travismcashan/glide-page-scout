import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AVOMA_API_KEY = Deno.env.get('AVOMA_API_KEY');
    if (!AVOMA_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'AVOMA_API_KEY not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { domain } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: 'domain is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const domainLower = domain.toLowerCase();

    // Fetch meetings from the last 12 months
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const fromDate = oneYearAgo.toISOString();
    const toDate = now.toISOString();

    // Fetch meetings paginated, filter by attendee domain
    const allMeetings: any[] = [];
    let nextUrl: string | null = `https://api.avoma.com/v1/meetings/?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}&page_size=100&is_internal=false`;

    let pageCount = 0;
    const maxPages = 10; // Safety limit

    while (nextUrl && pageCount < maxPages) {
      pageCount++;
      const res = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${AVOMA_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ success: false, error: `Avoma API error [${res.status}]: ${errText}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await res.json();
      const results = data.results || [];

      // Filter: any attendee email ends with @domain
      for (const meeting of results) {
        const attendees = meeting.attendees || [];
        const match = attendees.some((a: any) =>
          a.email && a.email.toLowerCase().endsWith(`@${domainLower}`)
        );
        if (match) {
          allMeetings.push({
            uuid: meeting.uuid,
            subject: meeting.subject,
            startAt: meeting.start_at,
            endAt: meeting.end_at,
            duration: meeting.duration,
            state: meeting.state,
            isCall: meeting.is_call,
            organizerEmail: meeting.organizer_email,
            attendees: attendees.map((a: any) => ({
              email: a.email,
              name: a.name,
            })),
            purpose: meeting.purpose?.label || null,
            outcome: meeting.outcome?.label || null,
            transcriptReady: meeting.transcript_ready || false,
            notesReady: meeting.notes_ready || false,
            transcriptionUuid: meeting.transcription_uuid || null,
            recordingUuid: meeting.recording_uuid || null,
          });
        }
      }

      nextUrl = data.next || null;
    }

    // For each meeting with transcript, fetch the transcription
    const meetingsWithTranscripts = [];
    for (const meeting of allMeetings.slice(0, 20)) { // Limit to 20 transcripts
      let transcript = null;
      if (meeting.transcriptReady && meeting.transcriptionUuid) {
        try {
          const tRes = await fetch(`https://api.avoma.com/v1/transcriptions/${meeting.transcriptionUuid}/`, {
            headers: {
              'Authorization': `Bearer ${AVOMA_API_KEY}`,
              'Content-Type': 'application/json',
            },
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            transcript = {
              sentences: (tData.sentences || []).slice(0, 500).map((s: any) => ({
                text: s.text,
                speakerName: s.speaker_name,
                start: s.start,
                end: s.end,
              })),
              totalSentences: (tData.sentences || []).length,
            };
          }
        } catch {
          // Skip transcript errors
        }
      }

      // Fetch insights if notes are ready
      let insights = null;
      if (meeting.notesReady) {
        try {
          const iRes = await fetch(`https://api.avoma.com/v1/meetings/${meeting.uuid}/insights/`, {
            headers: {
              'Authorization': `Bearer ${AVOMA_API_KEY}`,
              'Content-Type': 'application/json',
            },
          });
          if (iRes.ok) {
            const iData = await iRes.json();
            insights = {
              aiNotes: (iData.ai_notes || []).map((n: any) => ({
                text: n.text,
                noteType: n.note_type,
              })),
              keywords: iData.keywords?.popular?.slice(0, 20) || [],
              speakers: iData.speakers || [],
            };
          }
        } catch {
          // Skip insight errors
        }
      }

      meetingsWithTranscripts.push({
        ...meeting,
        transcript,
        insights,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      domain: domainLower,
      totalMatches: allMeetings.length,
      meetings: meetingsWithTranscripts,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
