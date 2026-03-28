const STORAGE_KEY = 'glide-recently-viewed';
const MAX_ENTRIES = 20;

export interface RecentView {
  sessionId: string;
  domain: string;
  createdAt: string; // when the crawl was run
  viewedAt: number;  // Date.now() timestamp of last view
}

export function recordView(sessionId: string, domain: string, createdAt: string) {
  if (domain === '__global_chat__') return;
  const views = getRecentViews().filter(v => v.sessionId !== sessionId);
  views.unshift({ sessionId, domain, createdAt, viewedAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_ENTRIES)));
}

export function getRecentViews(): RecentView[] {
  try {
    const views: RecentView[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return views.filter(v => v.domain !== '__global_chat__');
  } catch {
    return [];
  }
}
