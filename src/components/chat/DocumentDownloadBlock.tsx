import { FileDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateGlideDocument, type GlideDocumentOptions } from '@/lib/generateGlideDocument';

interface DocumentDownloadBlockProps {
  docMeta: {
    title: string;
    subtitle?: string;
    clientDomain?: string;
    companyName?: string;
  };
  markdownContent: string;
}

export function DocumentDownloadBlock({ docMeta, markdownContent }: DocumentDownloadBlockProps) {
  const handleDownload = () => {
    const options: GlideDocumentOptions = {
      title: docMeta.title,
      subtitle: docMeta.subtitle,
      clientDomain: docMeta.clientDomain,
      companyName: docMeta.companyName,
      sections: markdownContent,
    };
    generateGlideDocument(options);
  };

  return (
    <div className="my-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{docMeta.title}</p>
          {docMeta.subtitle && (
            <p className="text-xs text-muted-foreground">{docMeta.subtitle}{docMeta.companyName ? ` / ${docMeta.companyName}` : ''}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5 text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleDownload}
          >
            <FileDown className="h-3.5 w-3.5" />
            Download as PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
