import { Badge } from '@/components/ui/badge';
import { ApolloData } from './types';

export function ApolloPersonHeader({ data }: { data: ApolloData }) {
  return (
    <div className="p-4 bg-muted/30">
      <div className="flex items-start gap-4">
        {data.photoUrl ? (
          <img src={data.photoUrl} alt={data.name || ''} className="h-16 w-16 rounded-full object-cover border-2 border-background shadow" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
            {(data.firstName?.[0] || '?')}{(data.lastName?.[0] || '')}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg leading-tight">{data.name}</h3>
            {data.seniority && <Badge variant="secondary" className="text-[10px] capitalize">{data.seniority}</Badge>}
            {data.departments?.map(d => (
              <Badge key={d} variant="outline" className="text-[10px] capitalize">{d.replace('master_', '')}</Badge>
            ))}
          </div>
          {data.title && <p className="text-sm font-medium text-muted-foreground mt-0.5">{data.title}</p>}
          {data.headline && data.headline !== data.title && (
            <p className="text-xs text-muted-foreground mt-1 italic">{data.headline}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {data.subdepartments?.map(s => (
              <Badge key={s} variant="outline" className="text-[10px] capitalize">{s}</Badge>
            ))}
            {data.functions?.map(f => (
              <Badge key={f} variant="secondary" className="text-[10px] capitalize">{f}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
