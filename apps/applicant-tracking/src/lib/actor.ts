import { zite } from 'zitejs/db';

type SessionUser = { email?: string | null; [key: string]: unknown } | null | undefined;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const nameFromEmail = (email: string) =>
  email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || email;

// A fresh install has nobody on the hiring team, and ownership, panels and
// authorship all hang off Team Members rows. So the first person to open the
// app is added as its Admin. This only acts while the team is empty; after
// that, people are added in Settings. Returns whether it created the row.
export async function ensureFirstAdmin(user: SessionUser): Promise<boolean> {
  const email = text(user?.email).toLowerCase();
  if (!email) return false;
  const existing = await zite.teamMembers.findAll({ limit: 1 });
  if (existing.records.length > 0) return false;

  let name = [text(user?.firstName), text(user?.lastName)].filter(Boolean).join(' ') || text(user?.name);
  let image = '';
  try {
    const { rows } = await zite.sql({
      query: `SELECT "name", "image" FROM "ziteUsers" WHERE LOWER("email") = $1 LIMIT 1`,
      params: [email],
    });
    name = name || text(rows[0]?.name);
    image = text(rows[0]?.image);
  } catch {
    // The profile only improves the name and avatar; the row matters more.
  }

  await zite.teamMembers.create({
    record: {
      name: name || nameFromEmail(email),
      email,
      title: null,
      role: 'Admin',
      department: null,
      active: true,
      avatarUrl: image || null,
    },
  });
  return true;
}

// The signed-in person's own Team Members row, matched by email and nothing
// else. Use this where acting as someone else would be wrong, such as an
// admin-only action; resolveActorId below is for attribution.
export async function findMemberByEmail(email?: string | null) {
  const lower = (email ?? '').trim().toLowerCase();
  if (!lower) return undefined;
  const team = await zite.teamMembers.findAll({ limit: 200 });
  return team.records.find((t) => (t.email ?? '').toLowerCase() === lower);
}

// Every write logs who did it. The signed-in Zite user is matched to a Team
// Members row by email; someone who has not been added to the team yet falls
// back to an admin rather than dropping attribution entirely.
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
