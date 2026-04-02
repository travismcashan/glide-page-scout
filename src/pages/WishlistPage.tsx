import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Sparkles, Bug, Lightbulb, Trash2, Loader2, X, Wand2, ChevronDown, ExternalLink, Crosshair } from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppHeader from '@/components/AppHeader';
import { withQueryTimeout } from '@/lib/queryTimeout';

type WishlistItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  effort_estimate: string | null;
  created_at: string;
  submitted_by: string | null;
  page_url: string | null;
  element_selector: string | null;
  source: string | null;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
};

type ParsedItem = {
  title: string;
  description: string;
  category: string;
  priority: string;
  effort_estimate: string;
  selected: boolean;
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

const EFFORT_CONFIG: Record<string, { label: string; color: string }> = {
  small: { label: 'Small', color: 'bg-green-600/10 text-green-600 border-green-600/20' },
  medium: { label: 'Medium', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  large: { label: 'Large', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function WishlistPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Brain dump state
  const [rawInput, setRawInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);

  // Manual form state
  const [showManual, setShowManual] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('feature');
  const [priority, setPriority] = useState('medium');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await withQueryTimeout(
        supabase
          .from('wishlist_items')
          .select('*')
          .order('created_at', { ascending: false }),
        12000,
        'Loading wishlist timed out'
      );

      if (error) {
        throw error;
      }

      // Enrich with profile data
      const items = (data as any[]) || [];
      const userIds = [...new Set(items.map(i => i.submitted_by).filter(Boolean))];
      if (userIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
        if (profiles?.length) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          for (const item of items) {
            if (item.submitted_by) item.profiles = profileMap.get(item.submitted_by) || null;
          }
        }
      }

      setItems(items);
    } catch (error: any) {
      console.error('Failed to load wishlist items:', error);
      setItems([]);
      toast({
        title: 'Wishlist failed to load',
        description: error?.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const breakItDown = async () => {
    if (!rawInput.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('wishlist-parse', {
        body: { rawInput: rawInput.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'AI Error', description: data.error, variant: 'destructive' });
        setParsing(false);
        return;
      }
      const items = (data?.items || []).map((item: any) => ({ ...item, selected: true }));
      setParsedItems(items);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to parse ideas', variant: 'destructive' });
    }
    setParsing(false);
  };

  const saveSelected = async () => {
    if (!parsedItems) return;
    const selected = parsedItems.filter((i) => i.selected);
    if (selected.length === 0) return;
    setSaving(true);
    const rows = selected.map((i) => ({
      title: i.title,
      description: i.description || null,
      category: i.category,
      priority: i.priority,
      effort_estimate: i.effort_estimate || null,
    }));
    await supabase.from('wishlist_items').insert(rows as any);
    setParsedItems(null);
    setRawInput('');
    setSaving(false);
    fetchItems();
    toast({ title: `${selected.length} item${selected.length > 1 ? 's' : ''} added` });
  };

  const addManualItem = async () => {
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
    setShowManual(false);
    setSaving(false);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    setDeleting(id);
    await supabase.from('wishlist_items').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleting(null);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('wishlist_items').update({ status } as any).eq('id', id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const toggleParsedItem = (index: number) => {
    setParsedItems((prev) =>
      prev ? prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item)) : prev
    );
  };

  const updateParsedItem = (index: number, field: string, value: string) => {
    setParsedItems((prev) =>
      prev ? prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)) : prev
    );
  };

  const grouped = {
    wishlist: items.filter((i) => i.status === 'wishlist'),
    planned: items.filter((i) => i.status === 'planned'),
    'in-progress': items.filter((i) => i.status === 'in-progress'),
    done: items.filter((i) => i.status === 'done'),
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Brain dump your ideas and let AI break them into actionable items.
            </p>
          </div>
        </div>

        {/* Brain dump input */}
        {!parsedItems && (
          <Card className="p-5 mb-4">
            <Textarea
              placeholder="What's on your mind? Describe features, bugs, ideas — anything. AI will break it down..."
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={3}
              className="resize-none mb-3"
            />
            <div className="flex items-center justify-between">
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowManual(!showManual)}
              >
                {showManual ? 'Hide manual form' : 'or add manually'}
              </button>
              <Button onClick={breakItDown} disabled={parsing || !rawInput.trim()} size="sm">
                {parsing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                Break it down
              </Button>
            </div>
          </Card>
        )}

        {/* Manual form */}
        {showManual && !parsedItems && (
          <Card className="p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Add Manually</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowManual(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addManualItem()}
              />
              <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              <div className="flex gap-3">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="idea">Idea</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addManualItem} disabled={saving || !title.trim()} className="ml-auto" size="sm">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Add
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Review parsed items */}
        {parsedItems && (
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">
                AI found {parsedItems.length} item{parsedItems.length !== 1 ? 's' : ''}
              </h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setParsedItems(null); }}>
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={saveSelected}
                  disabled={saving || parsedItems.filter((i) => i.selected).length === 0}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Add {parsedItems.filter((i) => i.selected).length} Selected
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {parsedItems.map((item, idx) => {
                const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.feature;
                const CatIcon = cat.icon;
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-opacity ${item.selected ? 'border-border' : 'border-border/50 opacity-50'}`}
                  >
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleParsedItem(idx)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Input
                        value={item.title}
                        onChange={(e) => updateParsedItem(idx, 'title', e.target.value)}
                        className="h-8 text-sm font-medium"
                      />
                      <Input
                        value={item.description}
                        onChange={(e) => updateParsedItem(idx, 'description', e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Description"
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Select value={item.category} onValueChange={(v) => updateParsedItem(idx, 'category', v)}>
                          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="feature">Feature</SelectItem>
                            <SelectItem value="bug">Bug</SelectItem>
                            <SelectItem value="idea">Idea</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={item.priority} onValueChange={(v) => updateParsedItem(idx, 'priority', v)}>
                          <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={item.effort_estimate} onValueChange={(v) => updateParsedItem(idx, 'effort_estimate', v)}>
                          <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Existing items list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <BrandLoader size={48} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No items yet. Brain dump your first idea above.</p>
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
                      const effort = item.effort_estimate ? EFFORT_CONFIG[item.effort_estimate] : null;
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
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {item.priority}
                                  </Badge>
                                  {effort && (
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${effort.color}`}>
                                      {effort.label}
                                    </Badge>
                                  )}
                                  {item.source === 'claude' && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                      Claude
                                    </Badge>
                                  )}
                                  {item.profiles?.display_name && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      {item.profiles.avatar_url ? (
                                        <img src={item.profiles.avatar_url} alt="" className="h-3.5 w-3.5 rounded-full" />
                                      ) : (
                                        <span className="h-3.5 w-3.5 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[8px] font-bold">
                                          {item.profiles.display_name.charAt(0)}
                                        </span>
                                      )}
                                      {item.profiles.display_name}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(item.created_at).toLocaleDateString()}
                                  </span>
                                  {item.page_url && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      <ExternalLink className="h-2.5 w-2.5" />
                                      {item.page_url.replace(/^https?:\/\/[^/]+/, '').slice(0, 40)}
                                    </span>
                                  )}
                                  {item.element_selector && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      <Crosshair className="h-2.5 w-2.5" />
                                      <code className="max-w-[120px] truncate">{item.element_selector}</code>
                                    </span>
                                  )}
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
