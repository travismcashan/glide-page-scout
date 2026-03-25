import React from 'react';

/**
 * Renders children sorted so that elements with data-paused="true"
 * appear after all other elements. Preserves relative order within
 * each group.
 */
export function SortedIntegrationList({ children, className }: { children: React.ReactNode; className?: string }) {
  const items = React.Children.toArray(children).filter(Boolean);
  
  const active: React.ReactNode[] = [];
  const paused: React.ReactNode[] = [];
  
  for (const child of items) {
    if (React.isValidElement(child) && child.props?.['data-paused'] === true) {
      paused.push(child);
    } else {
      active.push(child);
    }
  }
  
  return <div className={className}>{active}{paused}</div>;
}
