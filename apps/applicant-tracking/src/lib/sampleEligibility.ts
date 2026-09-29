import { zite } from 'zitejs/db';
import { findMemberByEmail } from './actor';

// Who may load the sample data, and into what. Shared by bootstrap (to decide
// whether Settings shows the control) and seedDemoData (which enforces it), so
// the two can never disagree.
//
// Loading is for an Admin on the hiring team, into a workspace with no jobs and
// no candidates. The app has no way to delete a job, and the sample's first
// phase creates eight, so "no jobs" also means the sample was never loaded.

export async function adminBlocker(email?: string | null): Promise<string | null> {
  const me = await findMemberByEmail(email);
  return me?.role === 'Admin' ? null : 'Only an admin on the hiring team can load the sample data.';
}

export async function contentBlocker(): Promise<string | null> {
  const [jobs, candidates] = await Promise.all([
    zite.jobs.findAll({ limit: 1 }),
    zite.candidates.findAll({ limit: 1 }),
  ]);
  if (jobs.records.length > 0 || candidates.records.length > 0) {
    return 'This workspace already has jobs or candidates, so the sample data was not loaded. It only loads into a workspace with neither.';
  }
  return null;
}

/** Why the sample cannot be loaded right now, or null when it can. */
export async function sampleDataBlocker(email?: string | null): Promise<string | null> {
  return (await adminBlocker(email)) ?? (await contentBlocker());
}
