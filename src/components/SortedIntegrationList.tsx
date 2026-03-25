import React from 'react';

/**
 * Renders children sorted so that paused/inactive integration cards
 * appear after all active ones. Checks for the `paused` prop on children.
 * Preserves relative order within each group.
 */
export function SortedIntegrationList({ children, className }: { children: React.ReactNode; className?: string }) {
  const items = React.Children.toArray(children).filter(Boolean);
  
  const active: React.ReactNode[] = [];
  const paused: React.ReactNode[] = [];
  
  for (const child of items) {
    if (React.isValidElement(child) && (child.props as any)?.paused === true) {
      paused.push(child);
    } else {
      active.push(child);
    }
  }
  
  return <div className={className}>{active}{paused}</div>;
}
