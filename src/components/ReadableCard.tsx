import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ReadableData = {
  readabilityScore?: number | null;
  gradeLevel?: number | string | null;
  rating?: string | null;
  fleschKincaid?: number | null;
  fleschReadingEase?: number | null;
  gunningFog?: number | null;
  colemanLiau?: number | null;
  ari?: number | null;
  smog?: number | null;
  daleChall?: number | null;
  spacheScore?: number | null;
  linsearWrite?: number | null;
  wordCount?: number | null;
  sentenceCount?: number | null;
  syllableCount?: number | null;
  avgWordsPerSentence?: number | null;
  avgSyllablesPerWord?: number | null;
  keywordDensity?: Record<string, number> | any[] | null;
};

function ScoreRing({ score, label }: { score: number | null | undefined; label: string }) {
  const val = score ?? 0;
  const color = val >= 60 ? 'text-green-500' : val >= 40 ? 'text-yellow-500' : 'text-destructive';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-3xl font-bold ${color}`}>{score != null ? Math.round(score) : '—'}</div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function GradeBadge({ grade }: { grade: number | string | null | undefined }) {
  if (grade == null) return null;
  const num = typeof grade === 'string' ? parseFloat(grade) : grade;
  const variant = num <= 8 ? 'default' : num <= 12 ? 'secondary' : 'destructive';
  return <Badge variant={variant}>Grade {typeof grade === 'number' ? grade.toFixed(1) : grade}</Badge>;
}

function FormulaRow({ name, value, description }: { name: string; value: number | string | null | undefined; description: string }) {
  if (value == null) return null;
  const display = typeof value === 'number' ? value.toFixed(1) : value;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="text-sm font-mono font-semibold shrink-0 ml-3">{display}</span>
    </div>
  );
}

export function ReadableCard({ data }: { data: ReadableData }) {
  // Parse keyword density — can be object or array
  let keywords: { word: string; density: number }[] = [];
  if (data.keywordDensity) {
    if (Array.isArray(data.keywordDensity)) {
      keywords = data.keywordDensity.slice(0, 20);
    } else if (typeof data.keywordDensity === 'object') {
      keywords = Object.entries(data.keywordDensity)
        .map(([word, density]) => ({ word, density: typeof density === 'number' ? density : parseFloat(String(density)) }))
        .filter(k => !isNaN(k.density))
        .sort((a, b) => b.density - a.density)
        .slice(0, 20);
    }
  }

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="formulas">Readability Formulas</TabsTrigger>
        {keywords.length > 0 && <TabsTrigger value="keywords">Keyword Density</TabsTrigger>}
        <TabsTrigger value="stats">Text Stats</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <div className="flex flex-wrap items-center gap-8">
          <ScoreRing score={data.readabilityScore} label="Readability Score" />
          <ScoreRing score={data.fleschReadingEase} label="Flesch Reading Ease" />
          <div className="flex flex-col items-center gap-1">
            <GradeBadge grade={data.gradeLevel} />
            <span className="text-xs text-muted-foreground">Grade Level</span>
          </div>
          {data.rating && (
            <div className="flex flex-col items-center gap-1">
              <Badge variant="outline" className="text-sm">{data.rating}</Badge>
              <span className="text-xs text-muted-foreground">Rating</span>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="formulas" className="mt-4">
        <div className="space-y-0">
          <FormulaRow name="Flesch-Kincaid Grade" value={data.fleschKincaid} description="US school grade level needed to understand the text" />
          <FormulaRow name="Flesch Reading Ease" value={data.fleschReadingEase} description="0–100 scale; higher = easier to read" />
          <FormulaRow name="Gunning Fog Index" value={data.gunningFog} description="Years of education needed; aim for < 12" />
          <FormulaRow name="Coleman-Liau Index" value={data.colemanLiau} description="Grade level based on characters per word/sentence" />
          <FormulaRow name="Automated Readability Index" value={data.ari} description="Grade level using character counts" />
          <FormulaRow name="SMOG Index" value={data.smog} description="Grade level for health/legal content" />
          <FormulaRow name="Dale-Chall Score" value={data.daleChall} description="Uses familiar word list; < 5.0 = easily understood" />
          <FormulaRow name="Spache Score" value={data.spacheScore} description="For primary-school texts (grades 1-3)" />
          <FormulaRow name="Linsear Write" value={data.linsearWrite} description="Grade level for technical documents" />
        </div>
      </TabsContent>

      {keywords.length > 0 && (
        <TabsContent value="keywords" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {keywords.map((k, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm truncate mr-2">{k.word}</span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">{(k.density * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </TabsContent>
      )}

      <TabsContent value="stats" className="mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Words', value: data.wordCount },
            { label: 'Sentences', value: data.sentenceCount },
            { label: 'Syllables', value: data.syllableCount },
            { label: 'Avg Words/Sentence', value: data.avgWordsPerSentence != null ? data.avgWordsPerSentence.toFixed(1) : null },
            { label: 'Avg Syllables/Word', value: data.avgSyllablesPerWord != null ? data.avgSyllablesPerWord.toFixed(1) : null },
          ].filter(s => s.value != null).map((stat, i) => (
            <div key={i} className="rounded-lg border border-border p-3 text-center">
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
