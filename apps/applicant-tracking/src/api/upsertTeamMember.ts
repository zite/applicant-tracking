import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Team members are app-level records, not platform accounts — they exist so
// applications have an owner and interviews have a panel. Removing one is
// therefore refused while anything still points at them; deactivating keeps the
// history intact and takes them out of the pickers.

export default createEndpoint({
  description: 'Add or update a member of the hiring team',
  authenticated: true,
  inputSchema: z.object({
    memberId: z.string().optional(),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    title: z.string().trim().max(120).optional(),
    role: z.enum(['Admin', 'Recruiter', 'Hiring Manager', 'Interviewer', 'Coordinator']),
    department: z.string().max(50).optional(),
    active: z.boolean().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const email = input.email.toLowerCase();

    if (!input.memberId) {
      const clash = await zite.teamMembers.findAll({ filters: { email }, limit: 1 });
      if (clash.records.length > 0) {
        throw new ZiteError('Someone with that email is already on the team', 'CONFLICT');
      }
    }

    const record = {
      name: input.name,
      email,
      title: input.title || null,
      role: input.role,
      department: input.department || null,
      active: input.active ?? true,
      avatarUrl: `https://i.pravatar.cc/160?u=${encodeURIComponent(email)}`,
    };

    if (input.memberId) {
      const existing = await zite.teamMembers.findOne({ id: input.memberId });
      if (!existing) throw new ZiteError('Team member not found', 'NOT_FOUND');
      // Keep whatever avatar they already had rather than resetting it on edit.
      await zite.teamMembers.update({
        id: input.memberId,
        record: { ...record, avatarUrl: existing.avatarUrl ?? record.avatarUrl } as never,
      });
      return { id: input.memberId };
    }

    const created = await zite.teamMembers.create({ record: record as never });
    return { id: created.id };
  },
});
