import { zite } from 'zitejs/db';

// Every write logs who did it. The signed-in Zite user is matched to a Team
// Members row by email; in a freshly installed template the person clicking is
// usually not in the seeded roster, so fall back to an admin rather than
// dropping attribution entirely.
export async function resolveActorId(email?: string | null): Promise<string | null> {
  const team = await zite.teamMembers.findAll({ limit: 200 });
  const lower = (email ?? '').toLowerCase();
  const match = team.records.find((t) => (t.email ?? '').toLowerCase() === lower);
  if (match) return match.id;
  const admin = team.records.find((t) => t.role === 'Admin');
  return admin?.id ?? team.records[0]?.id ?? null;
}

export const firstId = (v: unknown): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : typeof v === 'string' && v ? v : null;

// Activity logging is best-effort: there is no transaction here, and a failed
// audit row must never roll back or block the change the user actually asked
// for. A dropped feed entry is recoverable; a half-applied stage move is not.
export async function logActivity(entry: {
  applicationId: string;
  candidateId?: string | null;
  authorId?: string | null;
  type: string;
  summary: string;
  body?: string | null;
}) {
  try {
    await zite.activities.create({
      record: {
        summary: entry.summary,
        body: entry.body ?? null,
        type: entry.type,
        occurredAt: new Date().toISOString(),
        application: [entry.applicationId],
        candidate: entry.candidateId ? [entry.candidateId] : null,
        author: entry.authorId ? [entry.authorId] : null,
      } as never,
    });
  } catch {
    // Swallow: the caller's mutation already succeeded.
  }
}
