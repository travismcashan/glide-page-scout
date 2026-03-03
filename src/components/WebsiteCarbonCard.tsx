import { Loader2, Leaf, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Props = {
  data: {
    green: boolean;
    bytes: number;
    cleanerThan: number;
    statistics: {
      adjustedBytes: number;
      energy: number;
      co2: { grid: { grams: number; litres: number }; renewable: { grams: number; litres: number } };
    };
    rating: string;
  } | null;
  isLoading: boolean;
};

export function WebsiteCarbonCard({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span className="text-sm">Measuring carbon footprint...</span>
      </div>
    );
  }

  if (!data) return null;

  const co2Grams = data.statistics?.co2?.grid?.grams;
  const cleanerPct = data.cleanerThan != null ? Math.round(data.cleanerThan * 100) : null;
  const transferKB = data.bytes != null ? (data.bytes / 1024).toFixed(0) : null;
  const energyKWh = data.statistics?.energy;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {data.green ? (
          <Badge variant="default" className="gap-1">
            <Leaf className="h-3 w-3" /> Green Hosted
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> Not Green Hosted
          </Badge>
        )}
        {data.rating && (
          <Badge variant="outline">Rating: {data.rating}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {co2Grams != null && (
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{co2Grams.toFixed(2)}g</div>
            <div className="text-xs text-muted-foreground">CO₂ per visit</div>
          </div>
        )}
        {cleanerPct != null && (
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{cleanerPct}%</div>
            <div className="text-xs text-muted-foreground">Cleaner than</div>
          </div>
        )}
        {transferKB != null && (
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{transferKB} KB</div>
            <div className="text-xs text-muted-foreground">Page weight</div>
          </div>
        )}
        {energyKWh != null && (
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{(energyKWh * 1000).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Energy (Wh)</div>
          </div>
        )}
      </div>
    </div>
  );
}
