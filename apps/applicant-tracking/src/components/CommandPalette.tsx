import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { listCandidates } from 'zitejs/api';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@project/components/ui/command';
import {
  BarChart3, Briefcase, CalendarDays, Inbox, KanbanSquare, Moon, Settings, Sun, UserPlus, Users,
} from 'lucide-react';
import { Avatar } from './Avatar';
import type { JobSummary } from '../lib/queries';

export function CommandPalette({
  open,
  onOpenChange,
  jobs,
  theme,
  onToggleTheme,
  onAddCandidate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobs: JobSummary[];
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onAddCandidate: () => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced] = useDebounce(search, 180);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // Only hit the server once there is enough to match on — a palette that
  // queries on every keystroke feels slower, not faster.
  const results = useQuery({
    queryKey: ['palette', debounced],
    queryFn: () => listCandidates({ search: debounced, limit: 6 }),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 30_000,
  });

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search candidates, jump to a pipeline…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {results.isFetching ? 'Searching…' : 'No matches.'}
        </CommandEmpty>

        {(results.data?.rows.length ?? 0) > 0 && (
          <CommandGroup heading="Candidates">
            {results.data!.rows.map((r) => (
              <CommandItem
                key={r.applicationId}
                value={`cand-${r.applicationId}-${r.name}`}
                onSelect={() => go(`/candidate/${r.applicationId}`)}
              >
                <Avatar name={r.name} src={r.avatarUrl} size={20} />
                <span className="ml-2 truncate">{r.name}</span>
                <span className="ml-auto truncate pl-3 text-[11px] text-muted-foreground">
                  {r.jobTitle ?? '—'}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Actions">
          <CommandItem
            value="action-add-candidate"
            onSelect={() => {
              onOpenChange(false);
              onAddCandidate();
            }}
          >
            <UserPlus className="mr-2 h-3.5 w-3.5" /> Add a candidate
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          <CommandItem value="nav-inbox" onSelect={() => go('/inbox')}>
            <Inbox className="mr-2 h-3.5 w-3.5" /> Inbox
          </CommandItem>
          <CommandItem value="nav-pipeline" onSelect={() => go('/pipeline')}>
            <KanbanSquare className="mr-2 h-3.5 w-3.5" /> Pipeline
          </CommandItem>
          <CommandItem value="nav-candidates" onSelect={() => go('/candidates')}>
            <Users className="mr-2 h-3.5 w-3.5" /> Candidates
          </CommandItem>
          <CommandItem value="nav-interviews" onSelect={() => go('/interviews')}>
            <CalendarDays className="mr-2 h-3.5 w-3.5" /> Interviews
          </CommandItem>
          <CommandItem value="nav-jobs" onSelect={() => go('/jobs')}>
            <Briefcase className="mr-2 h-3.5 w-3.5" /> Jobs
          </CommandItem>
          <CommandItem value="nav-analytics" onSelect={() => go('/analytics')}>
            <BarChart3 className="mr-2 h-3.5 w-3.5" /> Analytics
          </CommandItem>
          <CommandItem value="nav-settings" onSelect={() => go('/settings')}>
            <Settings className="mr-2 h-3.5 w-3.5" /> Settings
          </CommandItem>
        </CommandGroup>

        {jobs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Pipelines">
              {jobs.slice(0, 8).map((j) => (
                <CommandItem
                  key={j.id}
                  value={`job-${j.id}-${j.title}`}
                  onSelect={() => go(`/pipeline/${j.id}`)}
                >
                  <KanbanSquare className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{j.title}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{j.activeCount}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem
            value="toggle-theme"
            onSelect={() => {
              onToggleTheme();
              onOpenChange(false);
            }}
          >
            {theme === 'dark' ? (
              <Sun className="mr-2 h-3.5 w-3.5" />
            ) : (
              <Moon className="mr-2 h-3.5 w-3.5" />
            )}
            Switch to {theme === 'dark' ? 'light' : 'dark'} theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
