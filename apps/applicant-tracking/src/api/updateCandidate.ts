import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Edit a candidate profile: contact details, tags and skills',
  authenticated: true,
  inputSchema: z.object({
    candidateId: z.string().min(1),
    fullName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    headline: z.string().trim().max(160).nullable().optional(),
    currentCompany: z.string().trim().max(120).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    linkedInUrl: z.string().trim().max(300).nullable().optional(),
    gitHubUrl: z.string().trim().max(300).nullable().optional(),
    portfolioUrl: z.string().trim().max(300).nullable().optional(),
    resumeUrl: z.string().trim().max(500).nullable().optional(),
    yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
    tags: z.array(z.string()).max(20).optional(),
    skills: z.array(z.string()).max(40).optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const candidate = await zite.candidates.findOne({ id: input.candidateId });
    if (!candidate) throw new ZiteError('Candidate not found', 'NOT_FOUND');

    // Only patch keys that were actually sent — an omitted field is "leave it
    // alone", while an explicit null is "clear it".
    const patch: Record<string, unknown> = {};
    const copy = [
      'fullName', 'email', 'phone', 'headline', 'currentCompany', 'location',
      'linkedInUrl', 'gitHubUrl', 'portfolioUrl', 'yearsExperience', 'tags', 'skills',
    ] as const;
    for (const key of copy) {
      const value = (input as Record<string, unknown>)[key];
      if (value !== undefined) patch[key] = value;
    }
    if (input.resumeUrl !== undefined) {
      patch.resume = input.resumeUrl
        ? [{ url: input.resumeUrl, filename: `${candidate.fullName ?? 'Candidate'} resume` }]
        : null;
    }

    if (Object.keys(patch).length === 0) {
      throw new ZiteError('Nothing to update', 'BAD_REQUEST');
    }

    await zite.candidates.update({ id: candidate.id, record: patch as never });
    return { id: candidate.id };
  },
});
