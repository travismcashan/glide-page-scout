import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Search, Loader2 } from 'lucide-react';
import { ensureCrawl } from '@/lib/ensureCrawl';
import { buildSitePath } from '@/lib/sessionSlug';

/**
 * Consistent domain link used everywhere.
 * - Globe icon if site has been crawled
 * - Search icon if not yet crawled
 * - Always purple, always clickable
 * - Click → ensures crawl exists → navigates to site audit
 */
export function DomainLink({
  domain,
  companyId,
  hasCrawl,
  className = '',
}: {
  domain: string;
  companyId?: string | null;
  /** If known, show different icon for uncrawled domains. If undefined, assumes crawled. */
  hasCrawl?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const Icon = loading ? Loader2 : hasCrawl === false ? Search : Globe;

  return (
    <span
      role="link"
      onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        setLoading(true);
        try {
          const result = await ensureCrawl(domain, companyId);
          navigate(buildSitePath(result.domain, result.createdAt));
        } catch (err) {
          console.error('[DomainLink] crawl error:', err);
        } finally {
          setLoading(false);
        }
      }}
      className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${hasCrawl === false ? 'text-muted-foreground hover:text-primary' : 'text-primary hover:underline'} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} />
      {domain}
    </span>
  );
}
