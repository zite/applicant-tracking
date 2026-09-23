import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Remove a team member, or deactivate them when history references them',
  authenticated: true,
  inputSchema: z.object({ memberId: z.string().min(1) }),
  outputSchema: z.object({ id: z.string(), deactivatedInstead: z.boolean(), references: z.number() }),
  execute: async ({ input }) => {
    const member = await zite.teamMembers.findOne({ id: input.memberId });
    if (!member) throw new ZiteError('Team member not found', 'NOT_FOUND');

    // Anything pointing at them across every link table they can appear in.
    const refs = (
      await zite.sql({
        query: `
          SELECT
            (SELECT COUNT(*) FROM "JobsTeamMembers" WHERE "teamMembersId" = $1) +
            (SELECT COUNT(*) FROM "ApplicationsTeamMembers" WHERE "teamMembersId" = $1) +
            (SELECT COUNT(*) FROM "InterviewsTeamMembers" WHERE "teamMembersId" = $1) +
            (SELECT COUNT(*) FROM "ScorecardsTeamMembers" WHERE "teamMembersId" = $1) +
            (SELECT COUNT(*) FROM "ActivitiesTeamMembers" WHERE "teamMembersId" = $1) +
            (SELECT COUNT(*) FROM "OffersTeamMembers" WHERE "teamMembersId" = $1) +
            (SELECT COUNT(*) FROM "EmailMessagesTeamMembers" WHERE "teamMembersId" = $1)
            AS "n"`,
        params: [input.memberId],
      })
    ).rows[0];
    const references = Number(refs?.n ?? 0);

    if (references > 0) {
      // Deleting would blank the author on notes they wrote and the panel on
      // interviews they sat. Deactivating keeps the record honest.
      await zite.teamMembers.update({ id: input.memberId, record: { active: false } as never });
      return { id: input.memberId, deactivatedInstead: true, references };
    }

    await zite.teamMembers.delete({ id: input.memberId });
    return { id: input.memberId, deactivatedInstead: false, references: 0 };
  },
});
