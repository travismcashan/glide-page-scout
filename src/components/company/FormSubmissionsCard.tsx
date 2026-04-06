import { useFormSubmissions } from '@/hooks/useFormSubmissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Mail, Globe, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { BrandLoader } from '@/components/BrandLoader';

interface FormSubmissionsCardProps {
  companyId: string;
}

export function FormSubmissionsCard({ companyId }: FormSubmissionsCardProps) {
  const { data: submissions = [], isLoading } = useFormSubmissions(companyId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <BrandLoader size={24} />
      </div>
    );
  }

  if (submissions.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Form Submissions ({submissions.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 bg-card hover:border-border transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {sub.form_name || 'Unknown Form'}
                  </span>
                  {sub.submitted_at && (
                    <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">
                      {format(new Date(sub.submitted_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                  {sub.contact_email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {sub.contact_email}
                    </span>
                  )}
                  {sub.contact_name && (
                    <span>{sub.contact_name}</span>
                  )}
                  {sub.page_url && (
                    <span className="flex items-center gap-1 truncate max-w-[200px]">
                      <Globe className="h-3 w-3 shrink-0" />
                      {sub.page_title || new URL(sub.page_url).pathname}
                    </span>
                  )}
                </div>
                {sub.form_values && Object.keys(sub.form_values).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(sub.form_values).slice(0, 4).map(([key, val]) => (
                      <Badge key={key} variant="secondary" className="text-[10px] py-0">
                        {key}: {String(val).slice(0, 30)}
                      </Badge>
                    ))}
                    {Object.keys(sub.form_values).length > 4 && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        +{Object.keys(sub.form_values).length - 4} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
