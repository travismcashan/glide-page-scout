import { FileText, Database, Globe, MessageSquare, CheckCircle2, Loader2, Clock, AlertCircle, FileImage } from 'lucide-react';

export type KnowledgeDocument = {
  id: string;
  name: string;
  source_type: string;
  source_key: string | null;
  chunk_count: number;
  char_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
};

export type SortField = 'name' | 'created_at' | 'char_count' | 'chunk_count' | 'source_type';
export type SortDir = 'asc' | 'desc';

export const SOURCE_ICONS: Record<string, typeof FileText> = {
  integration: Database,
  upload: FileText,
  scrape: Globe,
  chat: MessageSquare,
};

export const SOURCE_LABELS: Record<string, string> = {
  integration: 'Integration',
  upload: 'Upload',
  scrape: 'Scraped',
  chat: 'Chat Note',
};

export const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ready: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Indexed' },
  processing: { icon: Loader2, color: 'text-amber-500', label: 'Processing' },
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
  error: { icon: AlertCircle, color: 'text-destructive', label: 'Error' },
};

/** Integration-specific icons keyed by common name patterns */
const INTEGRATION_ICON_MAP: Record<string, typeof FileText> = {
  semrush: BarChart3,
  pagespeed: Zap,
  psi: Zap,
  crux: Gauge,
  builtwith: Cpu,
  wappalyzer: Cpu,
  detectzestack: Cpu,
  wave: Accessibility,
  observatory: Shield,
  ssllabs: Shield,
  ssl: Shield,
  httpstatus: Link,
  linkcheck: Link,
  'link checker': Link,
  'broken links': Link,
  w3c: FileCode,
  schema: Code,
  readable: FileText,
  carbon: Leaf,
  yellowlab: Gauge,
  gtmetrix: Gauge,
  nav: Navigation,
  navigation: Navigation,
  sitemap: Map,
  forms: FormInput,
  templates: LayoutTemplate,
  'content types': LayoutTemplate,
  content_types: LayoutTemplate,
  tech: Cpu,
  'tech analysis': Cpu,
  apollo: Users,
  ocean: Building2,
  hubspot: Mail,
  avoma: Users,
  'deep research': Search,
  observations: Search,
};

export function getDocumentIcon(name: string, sourceType: string) {
  // For uploads, use file-extension-based icons
  if (sourceType === 'upload') {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return FileImage;
    if (['pdf'].includes(ext)) return FileType2;
    if (['doc', 'docx'].includes(ext)) return FileType2;
    if (['json', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx'].includes(ext)) return FileCode;
    return FileText;
  }

  if (sourceType === 'chat') return MessageSquare;
  if (sourceType === 'scrape') return Globe;

  // For integration docs, match by name keywords
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(INTEGRATION_ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }

  return Database;
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function sortDocuments(docs: KnowledgeDocument[], field: SortField, dir: SortDir): KnowledgeDocument[] {
  return [...docs].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      case 'char_count': cmp = a.char_count - b.char_count; break;
      case 'chunk_count': cmp = a.chunk_count - b.chunk_count; break;
      case 'source_type': cmp = a.source_type.localeCompare(b.source_type); break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}
