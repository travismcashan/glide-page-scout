import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'section-collapse-state';

type CollapseMap = Record<string, boolean>;

function loadState(sessionId: string): CollapseMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw);
    return all[sessionId] || {};
  } catch {
    return {};
  }
}

function saveState(sessionId: string, map: CollapseMap) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[sessionId] = map;

    const keys = Object.keys(all);
    if (keys.length > 20) {
      for (const k of keys.slice(0, keys.length - 20)) {
        delete all[k];
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // silent
  }
}

export function useSectionCollapse(sessionId: string | undefined) {
  const [collapseMap, setCollapseMap] = useState<CollapseMap>(() =>
    sessionId ? loadState(sessionId) : {}
  );

  useEffect(() => {
    setCollapseMap(sessionId ? loadState(sessionId) : {});
  }, [sessionId]);

  const isSectionCollapsed = useCallback(
    (sectionId: string): boolean | undefined => collapseMap[sectionId],
    [collapseMap]
  );

  const toggleSection = useCallback(
    (sectionId: string, collapsed: boolean) => {
      setCollapseMap((prev) => {
        const next = { ...prev, [sectionId]: collapsed };
        if (sessionId) saveState(sessionId, next);
        return next;
      });
    },
    [sessionId]
  );

  return { isSectionCollapsed, toggleSection };
}
