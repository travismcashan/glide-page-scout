import { FileText, Database, Globe, MessageSquare, CheckCircle2, Loader2, Clock, AlertCircle, FileImage, Upload, HardDrive } from 'lucide-react';

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
  'google-drive': HardDrive,
};

export const SOURCE_LABELS: Record<string, string> = {
  integration: 'Integration',
  upload: 'Upload',
  scrape: 'Scraped',
  chat: 'Chat Note',
  'google-drive': 'Google Drive',
};

export const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ready: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Indexed' },
  processing: { icon: Loader2, color: 'text-amber-500', label: 'Indexing' },
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Queued' },
  uploading: { icon: Upload, color: 'text-blue-500', label: 'Uploading' },
  error: { icon: AlertCircle, color: 'text-destructive', label: 'Error' },
};

export function getDocumentIcon(_name: string, sourceType: string) {
  if (sourceType === 'upload' || sourceType === 'google-drive') {
    const ext = _name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return FileImage;
    if (sourceType === 'google-drive') return HardDrive;
    return FileText;
  }
  if (sourceType === 'chat') return MessageSquare;
  if (sourceType === 'scrape') return Globe;
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
