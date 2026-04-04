import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { withQueryTimeout } from '@/lib/queryTimeout';
import { KanbanBoard } from '@/components/wishlist/KanbanBoard';
import { WishlistInput } from '@/components/wishlist/WishlistInput';
import { KanbanToolbar, type SortMode } from '@/components/wishlist/KanbanToolbar';
import { CardDetailModal } from '@/components/wishlist/CardDetailModal';
import { RecommendBanner } from '@/components/wishlist/RecommendBanner';
import { RecommendModal, type RecommendedItem } from '@/components/wishlist/RecommendModal';
import type { WishlistItem } from '@/components/wishlist/KanbanCard';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function WishlistPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Collapsible input
  const [inputOpen, setInputOpen] = useState(false);

  // Detail modal
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Toolbar state — persisted to localStorage
  const stored = useMemo(() => {
    try {
      const raw = localStorage.getItem('wishlist-toolbar');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);
  const [search, setSearch] = useState(stored?.search || '');
  const [categoryFilter, setCategoryFilter] = useState(stored?.category || 'all');
  const [priorityFilter, setPriorityFilter] = useState(stored?.priority || 'all');
  const [sort, setSort] = useState<SortMode>(stored?.sort || 'priority');
  const [prioritizing, setPrioritizing] = useState(false);

  // Persist toolbar state
  useEffect(() => {
    localStorage.setItem('wishlist-toolbar', JSON.stringify({
      search, category: categoryFilter, priority: priorityFilter, sort,
    }));
  }, [search, categoryFilter, priorityFilter, sort]);

  // AI recommendation
  const [recommendedItems, setRecommendedItems] = useState<RecommendedItem[]>([]);
  const [recommendSummary, setRecommendSummary] = useState('');
  const [recommendModalOpen, setRecommendModalOpen] = useState(false);
  const [recommending, setRecommending] = useState(false);

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

      if (error) throw error;

      const items = (data as any[]) || [];
      const itemIds = items.map(i => i.id);

      // Enrich with profile data
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

      // Enrich with attachment + comment counts
      if (itemIds.length) {
        const [{ data: attCounts }, { data: cmtCounts }] = await Promise.all([
          supabase.from('wishlist_attachments').select('wishlist_item_id').in('wishlist_item_id', itemIds),
          supabase.from('wishlist_comments').select('wishlist_item_id').in('wishlist_item_id', itemIds),
        ]);
        const attMap = new Map<string, number>();
        const cmtMap = new Map<string, number>();
        for (const a of attCounts || []) attMap.set(a.wishlist_item_id, (attMap.get(a.wishlist_item_id) || 0) + 1);
        for (const c of cmtCounts || []) cmtMap.set(c.wishlist_item_id, (cmtMap.get(c.wishlist_item_id) || 0) + 1);
        for (const item of items) {
          item.attachment_count = attMap.get(item.id) || 0;
          item.comment_count = cmtMap.get(item.id) || 0;
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

  const deleteItem = async (id: string) => {
    setDeleting(id);
    await supabase.from('wishlist_items').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleting(null);
  };

  const updateStatus = async (id: string, status: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    await supabase.from('wishlist_items').update({ status } as any).eq('id', id);
  };

  // Filter + sort
  const filteredItems = useMemo(() => {
    let result = items;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description && i.description.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter((i) => i.category === categoryFilter);
    }

    if (priorityFilter !== 'all') {
      result = result.filter((i) => i.priority === priorityFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      // priority: high first
      return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    });

    return result;
  }, [items, search, categoryFilter, priorityFilter, sort]);

  const handleItemsAdded = () => {
    setInputOpen(false);
    fetchItems();
  };

  const handlePrioritize = async () => {
    setPrioritizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('wishlist-prioritize', {
        body: { items: items.map(({ id, title, category, priority, effort_estimate, status, created_at }) => ({ id, title, category, priority, effort_estimate, status, created_at })) },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: 'AI Error', description: data.error, variant: 'destructive' }); return; }

      let changeCount = 0;
      const updates: Record<string, any> = {};

      // Apply priority changes
      for (const ch of data.priority_changes || []) {
        if (!updates[ch.id]) updates[ch.id] = {};
        updates[ch.id].priority = ch.new_priority;
        changeCount++;
      }
      // Apply effort changes
      for (const ch of data.effort_changes || []) {
        if (!updates[ch.id]) updates[ch.id] = {};
        updates[ch.id].effort_estimate = ch.new_effort;
        changeCount++;
      }
      // Apply category changes
      for (const ch of data.category_changes || []) {
        if (!updates[ch.id]) updates[ch.id] = {};
        updates[ch.id].category = ch.new_category;
        changeCount++;
      }

      // Persist all changes to DB
      for (const [id, fields] of Object.entries(updates)) {
        await supabase.from('wishlist_items').update(fields as any).eq('id', id);
      }

      // Build updated items list
      const updatedItems = items.map((item) => {
        const u = updates[item.id];
        return u ? { ...item, ...u } : item;
      });
      setItems(updatedItems);

      // Show recommendation modal with single item
      const nextItem = updatedItems.find((i) => i.id === data.next_item_id);
      if (nextItem) {
        setRecommendedItems([{
          id: nextItem.id, title: nextItem.title, description: nextItem.description,
          reason: data.next_item_reason, category: nextItem.category,
          priority: nextItem.priority, effort: nextItem.effort_estimate,
        }]);
        setRecommendSummary('');
        setRecommendModalOpen(true);
      } else {
        toast({
          title: 'Backlog analyzed',
          description: data.next_item_reason + (changeCount ? ` (${changeCount} fields updated)` : ''),
        });
      }

      if (changeCount) {
        toast({ title: `${changeCount} field${changeCount > 1 ? 's' : ''} updated` });
      }

      // Auto-generate cover images for large-effort items without one
      const needsCover = updatedItems.filter(
        (i) => i.effort_estimate === 'large' && !i.cover_image_url && i.status !== 'done'
      );
      if (needsCover.length) {
        Promise.allSettled(
          needsCover.map((item) =>
            supabase.functions.invoke('wishlist-cover-image', {
              body: { item_id: item.id, title: item.title, description: item.description },
            }).then(({ data: imgData, error: imgErr }) => {
              if (imgErr || imgData?.error) return;
              if (imgData?.cover_image_url) {
                setItems((prev) =>
                  prev.map((i) => i.id === item.id ? { ...i, cover_image_url: imgData.cover_image_url } : i)
                );
              }
            })
          )
        ).then((results) => {
          const generated = results.filter((r) => r.status === 'fulfilled').length;
          if (generated > 0) {
            toast({ title: `Generated ${generated} cover image${generated > 1 ? 's' : ''}` });
          }
        });
      }
    } catch (e: any) {
      toast({ title: 'Prioritize failed', description: e.message || 'Try again', variant: 'destructive' });
    } finally {
      setPrioritizing(false);
    }
  };

  const handleRecommend = async () => {
    setRecommending(true);
    try {
      const backlogItems = items
        .filter((i) => i.status === 'wishlist' || i.status === 'planned')
        .map(({ id, title, category, priority, effort_estimate, status, created_at }) =>
          ({ id, title, category, priority, effort_estimate, status, created_at }));

      if (backlogItems.length < 2) {
        toast({ title: 'Not enough items', description: 'Need at least 2 items in wishlist or planned to recommend a sprint.' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('wishlist-recommend', {
        body: { items: backlogItems },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: 'AI Error', description: data.error, variant: 'destructive' }); return; }

      const recs: RecommendedItem[] = (data.recommendations || [])
        .map((r: any) => {
          const item = items.find((i) => i.id === r.id);
          if (!item) return null;
          return {
            id: item.id, title: item.title, description: item.description,
            reason: r.reason, category: item.category,
            priority: item.priority, effort: item.effort_estimate,
          };
        })
        .filter(Boolean);

      if (recs.length) {
        setRecommendedItems(recs);
        setRecommendSummary(data.sprint_summary || '');
        setRecommendModalOpen(true);
      } else {
        toast({ title: 'No recommendations', description: 'AI could not find suitable items.' });
      }
    } catch (e: any) {
      toast({ title: 'Recommend failed', description: e.message || 'Try again', variant: 'destructive' });
    } finally {
      setRecommending(false);
    }
  };

  return (
    <div>
      <main className="px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
          <p className="text-sm text-muted-foreground mt-1">Brain dump your ideas and let AI break them into actionable items.</p>
        </div>

        {/* Collapsible brain dump input */}
        {inputOpen && (
          <WishlistInput onItemsAdded={handleItemsAdded} onClose={() => setInputOpen(false)} />
        )}

        {/* Toolbar: Add button left, search + filters right */}
        {!loading && (
          <KanbanToolbar
            search={search}
            onSearchChange={setSearch}
            category={categoryFilter}
            onCategoryChange={setCategoryFilter}
            priority={priorityFilter}
            onPriorityChange={setPriorityFilter}
            sort={sort}
            onSortChange={setSort}
            totalCount={items.length}
            filteredCount={filteredItems.length}
            onAddClick={() => setInputOpen(!inputOpen)}
            onPrioritize={handlePrioritize}
            prioritizing={prioritizing}
            onRecommend={handleRecommend}
            recommending={recommending}
          />
        )}

        {/* AI Recommendation banner (visible after modal dismissed) */}
        {recommendedItems.length > 0 && !recommendModalOpen && (
          <RecommendBanner
            title={recommendedItems.length > 1
              ? `${recommendedItems.length} items recommended`
              : recommendedItems[0].title}
            reason={recommendSummary || recommendedItems[0].reason}
            onView={() => setRecommendModalOpen(true)}
            onDismiss={() => setRecommendedItems([])}
          />
        )}

        {/* Board */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <BrandLoader size={48} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">No items yet. Brain dump your first idea above.</p>
          </div>
        ) : (
          <KanbanBoard
            items={filteredItems}
            onStatusChange={updateStatus}
            onDelete={deleteItem}
            onCardClick={(item) => { setSelectedItem(item); setModalOpen(true); }}
            deleting={deleting}
          />
        )}
        {/* AI Recommendation modal */}
        {recommendedItems.length > 0 && (
          <RecommendModal
            open={recommendModalOpen}
            onOpenChange={setRecommendModalOpen}
            items={recommendedItems}
            summary={recommendSummary}
            onAccept={async () => {
              for (const rec of recommendedItems) {
                await updateStatus(rec.id, 'planned');
              }
              setRecommendModalOpen(false);
              const count = recommendedItems.length;
              setRecommendedItems([]);
              toast({ title: `${count} item${count > 1 ? 's' : ''} moved to Planned` });
            }}
            onDismiss={() => setRecommendModalOpen(false)}
          />
        )}

        <CardDetailModal
          item={selectedItem}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onUpdate={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
          }}
          onDelete={deleteItem}
        />
      </main>
    </div>
  );
}
