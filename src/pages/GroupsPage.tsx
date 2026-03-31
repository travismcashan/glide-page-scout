import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, FolderOpen, Globe, Clock, Loader2, Share2, Trash2 } from 'lucide-react';
import { slugifyName, buildListPath } from '@/lib/sessionSlug';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SiteGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  member_count: number;
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<SiteGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SiteGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGroups = async () => {
    const { data: groupRows } = await supabase
      .from('site_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (!groupRows) { setLoading(false); return; }

    const { data: members } = await supabase
      .from('site_group_members')
      .select('group_id');

    const counts = new Map<string, number>();
    members?.forEach(m => counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1));

    setGroups(groupRows.map(g => ({
      ...g,
      member_count: counts.get(g.id) ?? 0,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      // Generate a unique slug
      const base = slugifyName(name.trim());
      const { data: existing } = await supabase
        .from('site_groups')
        .select('slug')
        .ilike('slug', `${base}%`);
      const taken = new Set((existing || []).map((r: any) => r.slug));
      let slug = base;
      let i = 2;
      while (taken.has(slug)) { slug = `${base}-${i++}`; }

      const { data, error } = await supabase
        .from('site_groups')
        .insert({ name: name.trim(), description: description.trim() || null, slug })
        .select()
        .single();

      if (error) throw error;
      setDialogOpen(false);
      setName('');
      setDescription('');
      navigate(buildListPath(data.slug));
    } catch {
      toast.error('Failed to create list');
    }
    setCreating(false);
  };

  const handleShare = async (e: React.MouseEvent, g: SiteGroup) => {
    e.stopPropagation();
    const url = `${window.location.origin}${buildListPath(g.slug)}?view=shared`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Shareable list link copied');
    } catch {
      toast.success('Shareable list link', { description: url });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('site_group_members').delete().eq('group_id', deleteTarget.id);
      const { error } = await supabase.from('site_groups').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      setGroups(prev => prev.filter(g => g.id !== deleteTarget.id));
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete list');
    }
    setDeleting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Site Lists</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize related sites for comparative analysis
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New List
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Site List</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">List Name</label>
                  <Input
                    placeholder="e.g. Acme Corp Network"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></label>
                  <Textarea
                    placeholder="Franchise locations, subsidiary brands…"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!name.trim() || creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create List
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">No lists yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {groups.map(g => (
              <div
                key={g.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(buildListPath(g.slug))}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{g.name}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      <Globe className="h-3 w-3" />{g.member_count}
                    </span>
                  </div>
                  {g.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{g.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {format(new Date(g.created_at), 'MMM d, yyyy')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Copy shareable link"
                    onClick={e => handleShare(e, g)}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Delete list"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(g); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and remove all its sites from the list. The sites themselves won't be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {deleting ? 'Deleting…' : 'Delete List'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
