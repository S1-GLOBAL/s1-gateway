import { useMe } from '@/features/accounts';
import { OfflineBanner } from '../pwa/OfflineBanner';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { navItemsFor } from '../nav';
import { AnimatedOutlet } from './AnimatedOutlet';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useSidebarCollapsed } from './use-sidebar-collapsed';

/** The frame every signed-in page lives in. Only the content region changes between pages. */
export function AppShell() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const { data: me } = useMe();
  const items = navItemsFor(me.isAdmin);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-accent px-3 py-2 text-sm font-medium text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar items={items} account={me} collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <TopBar />
        <AnimatedOutlet />
      </div>
      <BottomNav items={items} />
      <UpdatePrompt />
    </div>
  );
}