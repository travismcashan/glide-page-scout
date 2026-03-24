import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ReadableData = {
  rating?: string | null;
  reach?: string | null;
  reachPublic?: string | null;
  averageGradeLevel?: string | null;
  cefrLevel?: string | null;
  ieltsLevel?: string | null;
  fleschReadingEase?: string | null;
  fleschKincaidGradeLevel?: string | null;
  gunningFogScore?: string | null;
  colemanLiauIndex?: string | null;
  automatedReadabilityIndex?: string | null;
  smogIndex?: string | null;
  daleChallScore?: string | null;
  spacheScore?: string | null;
  forcastGrade?: string | null;
  lixScore?: number | null;
  rixScore?: number | null;
  lensearWrite?: string | null;
  fryGrade?: number | null;
  raygorGrade?: number | null;
  powersSumnerKearlScore?: string | null;
  wordCount?: number | null;
  sentenceCount?: number | null;
  paragraphCount?: number | null;
  syllableCount?: number | null;
  letterCount?: number | null;
  uniqueWordCount?: number | null;
  wordsPerSentence?: string | null;
  syllablesPerWord?: string | null;
  lettersPerWord?: string | null;
  sentencesPerParagraph?: string | null;
  readingTime?: string | null;
  speakingTime?: string | null;
  sentiment?: string | null;
  sentimentNumber?: number | null;
  tone?: string | null;
  toneNumber?: number | null;
  personal?: string | null;
  personalNumber?: number | null;
  gender?: string | null;
  genderNumber?: number | null;
  compositionNouns?: number | null;
  compositionVerbs?: number | null;
  compositionAdjectives?: number | null;
  compositionAdverbs?: number | null;
  compositionPronouns?: number | null;
  compositionPrepositions?: number | null;
  compositionConjunctions?: number | null;
  keywordDensity?: Record<string, Record<string, { item: string; count: number; percentage: string }>> | null;
  scoreId?: string | null;
};

const ratingColors: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-green-400 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  E: 'bg-destructive text-destructive-foreground',
};

function RatingBadge({ rating }: { rating: string }) {
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-lg font-bold ${ratingColors[rating] || 'bg-muted text-muted-foreground'}`}>
      {rating}
    </span>
  );
}

function StatBox({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FormulaRow({ name, value, description }: { name: string; value: string | number | null | undefined; description: string }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="text-sm font-mono font-semibold shrink-0 ml-3">{value}</span>
    </div>
  );
}

function ToneBar({ label, value, leftLabel, rightLabel }: { label: string; value: number | null | undefined; leftLabel: string; rightLabel: string }) {
  if (value == null) return null;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{leftLabel}</span>
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{rightLabel}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ReadableCard({ data }: { data: ReadableData }) {
  // Parse keyword density from Readable's nested format
  const keywords: { word: string; count: number; pct: string }[] = [];
  if (data.keywordDensity) {
    for (const group of Object.values(data.keywordDensity)) {
      if (typeof group === 'object' && group !== null) {
        for (const entry of Object.values(group)) {
          if (entry && typeof entry === 'object' && 'item' in entry) {
            keywords.push({ word: entry.item, count: entry.count, pct: entry.percentage });
          }
        }
      }
    }
    keywords.sort((a, b) => b.count - a.count);
  }

  const fre = data.fleschReadingEase ? parseFloat(data.fleschReadingEase) : null;
  const freColor = fre != null ? (fre >= 60 ? 'text-green-500' : fre >= 30 ? 'text-yellow-500' : 'text-destructive') : '';

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="formulas">Formulas</TabsTrigger>
        <TabsTrigger value="tone">Tone & Sentiment</TabsTrigger>
        {keywords.length > 0 && <TabsTrigger value="keywords">Keywords</TabsTrigger>}
        <TabsTrigger value="stats">Statistics</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <div className="flex flex-wrap items-center gap-6">
          {data.rating && (
            <div className="flex flex-col items-center gap-1">
              <RatingBadge rating={data.rating} />
              <span className="text-xs text-muted-foreground">Rating</span>
            </div>
          )}
          {fre != null && (
            <div className="flex flex-col items-center gap-1">
              <span className={`text-3xl font-bold ${freColor}`}>{fre.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">Flesch Reading Ease</span>
            </div>
          )}
          {data.averageGradeLevel && (
            <div className="flex flex-col items-center gap-1">
              <Badge variant="secondary" className="text-sm">Grade {data.averageGradeLevel}</Badge>
              <span className="text-xs text-muted-foreground">Avg Grade Level</span>
            </div>
          )}
          {data.cefrLevel && (
            <div className="flex flex-col items-center gap-1">
              <Badge variant="outline" className="text-sm">{data.cefrLevel}</Badge>
              <span className="text-xs text-muted-foreground">CEFR Level</span>
            </div>
          )}
          {data.ieltsLevel && (
            <div className="flex flex-col items-center gap-1">
              <Badge variant="outline" className="text-sm">IELTS {data.ieltsLevel}</Badge>
              <span className="text-xs text-muted-foreground">IELTS Band</span>
            </div>
          )}
          {data.reach && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold">{data.reach}%</span>
              <span className="text-xs text-muted-foreground">Audience Reach</span>
            </div>
          )}
        </div>
        {(data.readingTime || data.speakingTime) && (
          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            {data.readingTime && <span>📖 Reading time: <strong className="text-foreground text-sm">{data.readingTime}</strong></span>}
            {data.speakingTime && <span>🗣️ Speaking time: <strong className="text-foreground text-sm">{data.speakingTime}</strong></span>}
          </div>
        )}
      </TabsContent>

      <TabsContent value="formulas" className="mt-4">
        <div className="space-y-0">
          <FormulaRow name="Flesch Reading Ease" value={data.fleschReadingEase} description="0–100; higher = easier (60+ recommended)" />
          <FormulaRow name="Flesch-Kincaid Grade" value={data.fleschKincaidGradeLevel} description="US grade level needed to understand" />
          <FormulaRow name="Gunning Fog" value={data.gunningFogScore} description="Years of education needed; aim for < 12" />
          <FormulaRow name="Coleman-Liau" value={data.colemanLiauIndex} description="Grade level via character counts" />
          <FormulaRow name="SMOG Index" value={data.smogIndex} description="Grade level for health/legal content" />
          <FormulaRow name="ARI" value={data.automatedReadabilityIndex} description="Automated Readability Index" />
          <FormulaRow name="Dale-Chall" value={data.daleChallScore} description="< 5.0 = easily understood by 4th graders" />
          <FormulaRow name="Spache" value={data.spacheScore} description="For primary-school texts (grades 1-3)" />
          <FormulaRow name="FORCAST" value={data.forcastGrade} description="Grade level for forms & lists" />
          <FormulaRow name="Powers-Sumner-Kearl" value={data.powersSumnerKearlScore} description="Grade level for primary texts" />
          <FormulaRow name="Linsear Write" value={data.lensearWrite} description="Grade level for technical docs" />
          <FormulaRow name="LIX" value={data.lixScore} description="Readability index (< 30 easy, > 60 difficult)" />
          <FormulaRow name="RIX" value={data.rixScore} description="Long words per sentence" />
          <FormulaRow name="Fry Grade" value={data.fryGrade} description="Fry readability graph grade" />
          <FormulaRow name="Raygor Grade" value={data.raygorGrade} description="Raygor readability estimate" />
        </div>
      </TabsContent>

      <TabsContent value="tone" className="mt-4 space-y-4">
        <ToneBar label={data.sentiment || '—'} value={data.sentimentNumber} leftLabel="Negative" rightLabel="Positive" />
        <ToneBar label={data.tone || '—'} value={data.toneNumber} leftLabel="Formal" rightLabel="Informal" />
        <ToneBar label={data.personal || '—'} value={data.personalNumber} leftLabel="Impersonal" rightLabel="Personal" />
        <ToneBar label={data.gender || '—'} value={data.genderNumber} leftLabel="Female" rightLabel="Male" />

        {(data.compositionNouns != null) && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Word Composition</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatBox label="Nouns" value={data.compositionNouns} />
              <StatBox label="Verbs" value={data.compositionVerbs} />
              <StatBox label="Adjectives" value={data.compositionAdjectives} />
              <StatBox label="Adverbs" value={data.compositionAdverbs} />
              <StatBox label="Pronouns" value={data.compositionPronouns} />
              <StatBox label="Prepositions" value={data.compositionPrepositions} />
              <StatBox label="Conjunctions" value={data.compositionConjunctions} />
            </div>
          </div>
        )}
      </TabsContent>

      {keywords.length > 0 && (
        <TabsContent value="keywords" className="mt-4">
          <div className="space-y-4">
            {Object.entries(data.keywordDensity || {}).map(([group, entries]) => {
              const items = Object.values(entries as Record<string, any>).filter(e => e?.item);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">{group}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {items.map((k: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <span className="text-sm truncate mr-2">{k.item}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-mono text-muted-foreground">×{k.count}</span>
                          <span className="text-xs font-mono text-muted-foreground">{k.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      )}

      <TabsContent value="stats" className="mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <StatBox label="Words" value={data.wordCount} />
          <StatBox label="Sentences" value={data.sentenceCount} />
          <StatBox label="Paragraphs" value={data.paragraphCount} />
          <StatBox label="Syllables" value={data.syllableCount} />
          <StatBox label="Letters" value={data.letterCount} />
          <StatBox label="Unique Words" value={data.uniqueWordCount} />
          <StatBox label="Words / Sentence" value={data.wordsPerSentence} />
          <StatBox label="Syllables / Word" value={data.syllablesPerWord} />
          <StatBox label="Letters / Word" value={data.lettersPerWord} />
          <StatBox label="Sentences / Paragraph" value={data.sentencesPerParagraph} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
