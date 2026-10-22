import { useMediaQuery } from '@/hooks/use-media-query';
import {
  type PersistedStateOptions,
  setPersistedState,
  usePersistedState,
} from '@/hooks/use-persisted-state';
import { useEffect, useState } from 'react';
import {
  type Layout,
  type LayoutChangedMeta,
  type PanelSize,
  usePanelRef,
} from 'react-resizable-panels';
import { z } from 'zod';

const layoutSchema = z
  .record(z.string(), z.number().min(0).max(100))
  .optional();

function layoutState(
  panelIds: string[]
): PersistedStateOptions<Layout | undefined> {
  return {
    key: `react-resizable-panels:lab-chat-layout:${panelIds.join(':')}`,
    defaultValue: undefined,
    schema: layoutSchema,
  };
}

export function useSidebar() {
  const desktop = useMediaQuery('(min-width: 768px)');

  const [defaultLayout] = usePersistedState(
    layoutState(desktop ? ['sidebar', 'conversation'] : ['conversation'])
  );

  const panelRef = usePanelRef();

  const [collapsed, setCollapsed] = useState(
    () => defaultLayout?.sidebar === 0
  );

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (desktop) {
      setMobileOpen(false);
    }
  }, [desktop]);

  return {
    closeMobile: () => setMobileOpen(false),
    collapse: () => panelRef.current?.collapse(),
    collapsed,
    defaultLayout,
    desktop,
    expand: () => panelRef.current?.expand(),
    mobileOpen,
    onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => {
      const requestedLayout = meta.requestedLayout ?? layout;

      setPersistedState(
        layoutState(Object.keys(requestedLayout)),
        requestedLayout
      );
    },
    onResize: (size: PanelSize) => setCollapsed(size.inPixels === 0),
    openMobile: () => setMobileOpen(true),
    panelRef,
    setMobileOpen,
  };
}
