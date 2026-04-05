import { useParams } from 'react-router-dom';
import { Layers } from 'lucide-react';

export default function PatternDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-24">
      <Layers className="h-12 w-12" />
      <h1 className="text-2xl font-semibold text-foreground">Pattern Detail</h1>
      <p>Pattern {id} — coming soon.</p>
    </div>
  );
}
