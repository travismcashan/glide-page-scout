import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, Sparkles, Bug, Lightbulb, Send, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { WishlistItem } from './KanbanCard';

const STATUS_OPTIONS = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const CATEGORY_OPTIONS = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const EFFORT_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
};

type CardDetailModalProps = {
  item: WishlistItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (item: WishlistItem) => void;
  onDelete: (id: string) => void;
};

export function CardDetailModal({ item, open, onOpenChange, onUpdate, onDelete }: CardDetailModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('feature');
  const [status, setStatus] = useState('wishlist');
  const [priority, setPriority] = useState('medium');
  const [effort, setEffort] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setCategory(item.category);
      setStatus(item.status);
      setPriority(item.priority);
      setEffort(item.effort_estimate || '');
      loadComments(item.id);
    }
  }, [item]);

  async function loadComments(itemId: string) {
    const { data } = await supabase
      .from('wishlist_comments')
      .select('*')
      .eq('wishlist_item_id', itemId)
      .order('created_at', { ascending: true });

    const comments = (data as any[]) || [];
    const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
      if (profiles?.length) {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        for (const c of comments) {
          if (c.user_id) c.profile = profileMap.get(c.user_id) || null;
        }
      }
    }
    setComments(comments);
  }

  async function handleSendComment() {
    if (!newComment.trim() || !item) return;
    setSendingComment(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('wishlist_comments').insert({
      wishlist_item_id: item.id,
      user_id: user?.id || null,
      content: newComment.trim(),
    } as any);
    setNewComment('');
    setSendingComment(false);
    await loadComments(item.id);
    // Update count on parent
    onUpdate({ ...item, comment_count: (item.comment_count || 0) + 1 });
  }

  if (!item) return null;

  const hasChanges =
    title !== item.title ||
    description !== (item.description || '') ||
    category !== item.category ||
    status !== item.status ||
    priority !== item.priority ||
    effort !== (item.effort_estimate || '');

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const updates = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      status,
      priority,
      effort_estimate: effort || null,
    };
    await supabase.from('wishlist_items').update(updates as any).eq('id', item!.id);
    onUpdate({ ...item!, ...updates });
    setSaving(false);
    toast({ title: 'Card updated' });
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${item!.title.slice(0, 60)}"?`)) return;
    setDeletingItem(true);
    onDelete(item!.id);
    setDeletingItem(false);
    onOpenChange(false);
  }

  const createdDate = new Date(item.created_at).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Edit Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold border-0 px-0 h-auto focus-visible:ring-0 shadow-none"
            placeholder="Card title"
          />

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
              placeholder="Describe what needs to happen..."
            />
          </div>

          {/* Fields grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Effort</label>
              <Select value={effort || 'none'} onValueChange={(v) => setEffort(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {EFFORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground pt-2 border-t">
            {item.profiles?.display_name && (
              <div className="flex items-center gap-2">
                {item.profiles.avatar_url ? (
                  <img src={item.profiles.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {item.profiles.display_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span>{item.profiles.display_name}</span>
              </div>
            )}
            <span className="text-xs">{createdDate}</span>
          </div>

          {/* Comments */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Comments</span>
              {comments.length > 0 && (
                <span className="text-xs text-muted-foreground">{comments.length}</span>
              )}
            </div>

            {comments.length > 0 && (
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    {c.profile?.avatar_url ? (
                      <img src={c.profile.avatar_url} alt="" className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                        {(c.profile?.display_name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{c.profile?.display_name || 'Unknown'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New comment input */}
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSendComment}
                disabled={sendingComment || !newComment.trim()}
                className="shrink-0"
              >
                {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={deletingItem}
            >
              {deletingItem ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges || !title.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
