import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReactNode } from 'react';

export type CardTab = {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  /** If false, tab is hidden entirely */
  visible?: boolean;
};

type CardTabsProps = {
  tabs: CardTab[];
  defaultValue?: string;
};

/**
 * Unified tabbed layout for multi-section integration cards.
 * Large, clear tab strip at the top — consistent across all cards.
 */
export function CardTabs({ tabs, defaultValue }: CardTabsProps) {
  const visibleTabs = tabs.filter(t => t.visible !== false);
  const firstValue = defaultValue || visibleTabs[0]?.value;

  if (visibleTabs.length === 0) return null;

  return (
    <Tabs defaultValue={firstValue} className="w-full">
      <TabsList className="w-full justify-start h-auto flex-wrap gap-1.5 bg-transparent p-0 border-b border-foreground rounded-none pb-3 mb-0">
        {visibleTabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="text-sm font-medium px-4 py-2 rounded-md border border-transparent data-[state=active]:bg-muted data-[state=active]:border-foreground data-[state=active]:shadow-sm transition-all"
          >
            {tab.icon && <span className="mr-1.5 inline-flex">{tab.icon}</span>}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleTabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
