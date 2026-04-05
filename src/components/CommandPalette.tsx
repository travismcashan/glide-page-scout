import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandShortcut, CommandSeparator,
} from '@/components/ui/command';
import {
  Building2, TrendingUp, Search, Users, FolderKanban,
  ScrollText, Settings, MessageSquare, Sparkles, Plus, Globe,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type CompanyResult = { id: string; name: string; domain: string | null };

const PAGES = [
  { label: 'Leads', to: '/leads', icon: Building2, shortcut: '1' },
  { label: 'Deals', to: '/deals', icon: TrendingUp, shortcut: '2' },
  { label: 'Companies', to: '/companies', icon: Building2, shortcut: '3' },
  { label: 'Contacts', to: '/contacts', icon: Users, shortcut: '4' },
  { label: 'Crawls', to: '/crawls', icon: Search, shortcut: '5' },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Plans', to: '/plans', icon: ScrollText },
  { label: 'Chat', to: '/chat', icon: MessageSquare },
  { label: 'Wishlist', to: '/wishlist', icon: Sparkles },
  { label: 'Settings', to: '/settings', icon: Settings },
];

const ACTIONS = [
  { label: 'New Crawl', to: '/crawls', icon: Globe },
  { label: 'New Plan', to: '/plans?new=1', icon: Plus },
  { label: 'New Wishlist Item', to: '/wishlist?add=1', icon: Plus },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const navigate = useNavigate();

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Search companies when query has 2+ chars
  useEffect(() => {
    if (query.length < 2) { setCompanies([]); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, domain')
        .ilike('name', `%${query}%`)
        .limit(8);
      if (data) setCompanies(data as CompanyResult[]);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const go = useCallback((to: string) => {
    setOpen(false);
    setQuery('');
    navigate(to);
  }, [navigate]);

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}>
      <CommandInput
        placeholder="Search pages, companies, actions..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {PAGES.map(p => (
            <CommandItem key={p.to} onSelect={() => go(p.to)}>
              <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {p.label}
              {p.shortcut && <CommandShortcut>{p.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        {companies.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Companies">
              {companies.map(c => (
                <CommandItem key={c.id} onSelect={() => go(`/companies/${c.id}`)}>
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.domain && <span className="text-xs text-muted-foreground ml-2">{c.domain}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {ACTIONS.map(a => (
            <CommandItem key={a.label} onSelect={() => go(a.to)}>
              <a.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
