import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Briefcase, CalendarDays, Inbox, KanbanSquare, Menu, Moon, Search,
  Settings, Sun, UserPlus, Users,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@project/components/ui/sheet';
import { Avatar } from './Avatar';
import { CommandPalette } from './CommandPalette';
import { AddCandidateDialog } from './AddCandidateDialog';
import { AppActionsProvider } from '../lib/appActions';
import { useTheme } from '../lib/useTheme';
import { priorityTone } from '../lib/format';
import type { Bootstrap } from '../lib/queries';

const NAV = [
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/interviews', label: 'Interviews', icon: CalendarDays },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

function SidebarContent({
  data,
  theme,
  onToggleTheme,
  onSearch,
  onAddCandidate,
  onNavigate,
}: {
  data: Bootstrap;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSearch: () => void;
  onAddCandidate: () => void;
  onNavigate?: () => void;
}) {
  const openJobs = data.jobs.filter((j) => j.status === 'Open' || j.status === 'Paused');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[12px] font-bold text-primary-foreground">
          A
        </div>
        <span className="whitespace-nowrap text-[12.5px] font-semibold tracking-tight">Applicant Tracking</span>
      </div>

      <div className="space-y-1.5 px-3 pb-2">
        <button
          type="button"
          onClick={onSearch}
          className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background/40 px-2 py-1.5 text-[12px] text-muted-foreground transition hover:bg-sidebar-accent"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <span className="kbd ml-auto">⌘K</span>
        </button>
        <button
          type="button"
          onClick={onAddCandidate}
          className="flex w-full items-center gap-2 rounded-md bg-primary px-2 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add candidate
        </button>
      </div>

      <nav className="px-2 pt-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition ${
                isActive
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Icon className="h-[15px] w-[15px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-2">
        <div className="px-2 pb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          Pipelines
        </div>
        {openJobs.map((j) => (
          <NavLink
            key={j.id}
            to={`/pipeline/${j.id}`}
            onClick={onNavigate}
            className={({ isActive }) =>
              `mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition ${
                isActive
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <span className={`text-[15px] leading-none ${priorityTone(j.priority)}`} aria-hidden>
              •
            </span>
            <span className="truncate">{j.title}</span>
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {j.activeCount}
            </span>
          </NavLink>
        ))}
        {openJobs.length === 0 && (
          <p className="px-2 py-1 text-[11.5px] text-muted-foreground">No open pipelines.</p>
        )}
      </div>

      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <Avatar name={data.me?.name ?? 'You'} src={data.me?.avatarUrl} size={22} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium">{data.me?.name ?? 'You'}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {data.me?.title ?? 'Team member'}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="rounded p-1 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <NavLink
            to="/settings"
            onClick={onNavigate}
            aria-label="Settings"
            className="rounded p-1 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
          </NavLink>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ data }: { data: Bootstrap }) {
  const { theme, toggle } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addJobId, setAddJobId] = useState<string | undefined>(undefined);
  const [mobileNav, setMobileNav] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pendingGo = useRef<number | null>(null);

  // Close the mobile drawer whenever the route changes, so tapping a link does
  // not leave the sheet covering the page it just opened.
  useEffect(() => setMobileNav(false), [location.pathname]);

  useEffect(() => {
    const GO: Record<string, string> = {
      h: '/inbox', p: '/pipeline', c: '/candidates', i: '/interviews', j: '/jobs', a: '/analytics',
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (pendingGo.current !== null) {
        window.clearTimeout(pendingGo.current);
        pendingGo.current = null;
        const to = GO[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          navigate(to);
          return;
        }
      }

      if (e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === 'g') {
        e.preventDefault();
        pendingGo.current = window.setTimeout(() => {
          pendingGo.current = null;
        }, 1200);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (pendingGo.current !== null) window.clearTimeout(pendingGo.current);
    };
  }, [navigate]);

  const openAddCandidate = (jobId?: string) => {
    setAddJobId(jobId);
    setAddOpen(true);
  };

  const sidebarProps = {
    data,
    theme,
    onToggleTheme: toggle,
    onSearch: () => setPaletteOpen(true),
    onAddCandidate: () => openAddCandidate(),
  };

  return (
    <AppActionsProvider value={{ openAddCandidate }}>
      <div className="flex h-[100dvh] overflow-hidden bg-background">
        <aside className="hidden w-[228px] shrink-0 border-r border-sidebar-border bg-sidebar-background md:block">
          <SidebarContent {...sidebarProps} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile chrome. The desktop sidebar is hidden below md, so the same
              navigation lives in a drawer rather than being unreachable. */}
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 md:hidden">
            <Sheet open={mobileNav} onOpenChange={setMobileNav}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Open navigation" className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[268px] bg-sidebar-background p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContent {...sidebarProps} onNavigate={() => setMobileNav(false)} />
              </SheetContent>
            </Sheet>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              A
            </div>
            <span className="whitespace-nowrap text-[12.5px] font-semibold tracking-tight">Applicant Tracking</span>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="ml-auto rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          <Outlet />
        </main>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          jobs={data.jobs}
          theme={theme}
          onToggleTheme={toggle}
          onAddCandidate={() => openAddCandidate()}
        />

        <AddCandidateDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          jobs={data.jobs}
          defaultJobId={addJobId}
        />
      </div>
    </AppActionsProvider>
  );
}
