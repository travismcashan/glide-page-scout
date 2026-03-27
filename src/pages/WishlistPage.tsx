import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Sparkles, Bug, Lightbulb, Trash2, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type WishlistItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  created_at: string;
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  feature: { label: 'Feature', icon: Sparkles, color: 'bg-primary/10 text-primary border-primary/20' },
  bug: { label: 'Bug', icon: Bug, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  idea: { label: 'Idea', icon: Lightbulb, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  wishlist: { label: 'Wishlist', color: 'bg-muted text-muted-foreground' },
  planned: { label: 'Planned', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  'in-progress': { label: 'In Progress', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  done: { label: 'Done', color: 'bg-green-600/10 text-green-600 border-green-600/20' },
};

export default function WishlistPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('feature');
  const [priority, setPriority] = useState('medium');

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('wishlist_items')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from('wishlist_items').insert({
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority,
    } as any);
    setTitle('');
    setDescription('');
    setCategory('feature');
    setPriority('medium');
    setShowForm(false);
    setSaving(false);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    setDeleting(id);
    await supabase.from('wishlist_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    setDeleting(null);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('wishlist_items').update({ status } as any).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const grouped = {
    wishlist: items.filter(i => i.status === 'wishlist'),
    planned: items.filter(i => i.status === 'planned'),
    'in-progress': items.filter(i => i.status === 'in-progress'),
    done: items.filter(i => i.status === 'done'),
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">Wishlist</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
              <Plus className="h-3 w-3 mr-1" />
              Add Item
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-muted-foreground text-sm mb-6">
          Track feature requests, bugs, and ideas. Drag items between statuses to build your roadmap.
        </p>

        {/* Add form */}
        {showForm && (
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">New Item</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowForm(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addItem()}
              />
              <Textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
              <div className="flex gap-3">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="idea">Idea</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addItem} disabled={saving || !title.trim()} className="ml-auto">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Add
                </Button>
              </div>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No items yet. Add your first feature request or idea.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([status, statusItems]) => {
              if (statusItems.length === 0) return null;
              const config = STATUS_CONFIG[status];
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className={`text-xs ${config.color}`}>
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{statusItems.length}</span>
                  </div>
                  <div className="space-y-2">
                    {statusItems.map((item) => {
                      const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.feature;
                      const CatIcon = cat.icon;
                      return (
                        <Card key={item.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${cat.color}`}>
                                <CatIcon className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{item.title}</p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {item.priority}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                                <SelectTrigger className="h-7 text-xs w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="wishlist">Wishlist</SelectItem>
                                  <SelectItem value="planned">Planned</SelectItem>
                                  <SelectItem value="in-progress">In Progress</SelectItem>
                                  <SelectItem value="done">Done</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteItem(item.id)}
                                disabled={deleting === item.id}
                              >
                                {deleting === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
