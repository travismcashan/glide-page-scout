import { Layers } from 'lucide-react';

export default function PatternsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-24">
      <Layers className="h-12 w-12" />
      <h1 className="text-2xl font-semibold text-foreground">Pattern Library</h1>
      <p>Coming soon — industry patterns, block-level conversion data, and persona-mapped flows.</p>
    </div>
  );
}
