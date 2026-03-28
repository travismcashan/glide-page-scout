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

export type CardTabsProps = {
  tabs: CardTab[];
  defaultValue?: string;
  headerExtra?: React.ReactNode;
};

/**
 * Unified tabbed layout for multi-section integration cards.
 * Large, clear tab strip at the top — consistent across all cards.
 */
export function CardTabs({ tabs, defaultValue, headerExtra }: CardTabsProps) {
  const visibleTabs = tabs.filter(t => t.visible !== false);
  const firstValue = defaultValue || visibleTabs[0]?.value;

  if (visibleTabs.length === 0) return null;

  return (
    <Tabs defaultValue={firstValue} className="w-full">
      <div className="flex items-center justify-between border-b border-foreground pb-3 mb-0">
        <TabsList className="w-auto justify-start h-auto flex-wrap gap-1.5 bg-transparent p-0 rounded-none">
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
        {headerExtra}
      </div>

      {visibleTabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
