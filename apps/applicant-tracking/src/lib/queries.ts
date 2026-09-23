import { useQuery } from '@tanstack/react-query';
import { bootstrap, getIntegrationStatus, type BootstrapOutputType } from 'zitejs/api';

export type Bootstrap = BootstrapOutputType;
export type TeamMember = Bootstrap['team'][number];
export type JobSummary = Bootstrap['jobs'][number];

// The shell's single source of truth. Everything that renders chrome — sidebar,
// avatars, job switcher, counts — reads this one cached entry instead of
// fetching its own copy.
export function useBootstrap() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => bootstrap({}),
    staleTime: 30_000,
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => getIntegrationStatus({}),
    staleTime: 5 * 60_000,
  });
}

export function memberMap(team: TeamMember[] | undefined) {
  return new Map((team ?? []).map((t) => [t.id, t]));
}
