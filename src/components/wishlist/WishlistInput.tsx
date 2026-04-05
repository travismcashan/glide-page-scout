import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Sparkles, Bug, Lightbulb, FileText, Loader2, X, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  plan: { label: 'Plan', icon: FileText, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
};

type WishlistInputProps = {
  onItemsAdded: () => void;
  onClose: () => void;
};

export function WishlistInput({ onItemsAdded, onClose }: WishlistInputProps) {
  const { toast } = useToast();
  const [rawInput, setRawInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('feature');
  const [priority, setPriority] = useState('medium');

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
    onItemsAdded();
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
    onItemsAdded();
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

  return (
    <>
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
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={breakItDown} disabled={parsing || !rawInput.trim()} size="sm">
                {parsing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                Break it down
              </Button>
            </div>
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
                  <SelectItem value="plan">Plan</SelectItem>
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
              <Button variant="ghost" size="sm" onClick={() => setParsedItems(null)}>
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
                          <SelectItem value="plan">Plan</SelectItem>
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
    </>
  );
}
