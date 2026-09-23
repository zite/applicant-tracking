import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import Anthropic from '@anthropic-ai/sdk';
import { firstId } from '../lib/actor';

// Turns an attached resume into structured candidate fields. The PDF goes to
// Claude as a document block rather than being text-extracted first — pdf-lib is
// a PDF writer and its extraction is poor enough to be a source of garbage input.
//
// Only fills fields that are currently empty. A recruiter's correction should
// never be overwritten by a later re-parse.

const Parsed = z.object({
  headline: z.string().nullable(),
  currentCompany: z.string().nullable(),
  location: z.string().nullable(),
  yearsExperience: z.number().nullable(),
  skills: z.array(z.string()),
  summary: z.string(),
});

const KNOWN_SKILLS = [
  'TypeScript', 'React', 'Python', 'Go', 'Rust', 'Kubernetes', 'AWS', 'Postgres',
  'Machine Learning', 'Product Strategy', 'Figma', 'Design Systems', 'User Research',
  'Enterprise Sales', 'Demand Gen', 'Analytics',
];

export default createEndpoint({
  description: 'Extract structured fields from a candidate resume',
  authenticated: true,
  inputSchema: z.object({ applicationId: z.string().min(1) }),
  outputSchema: z.object({
    configured: z.boolean(),
    parsed: z.boolean(),
    fieldsUpdated: z.array(z.string()),
    message: z.string().nullable(),
  }),
  execute: async ({ input }) => {
    const apiKey = process.env.ZITE_ANTHROPIC_ACCESS_TOKEN;
    if (!apiKey) {
      return {
        configured: false, parsed: false, fieldsUpdated: [],
        message: 'Connect an Anthropic account to read resumes automatically.',
      };
    }

    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');
    const candidateId = firstId(app.candidate);
    const candidate = candidateId ? await zite.candidates.findOne({ id: candidateId }) : undefined;
    if (!candidate) throw new ZiteError('Candidate not found', 'NOT_FOUND');

    const resume = candidate.resume?.[0];
    if (!resume?.url) {
      return {
        configured: true, parsed: false, fieldsUpdated: [],
        message: 'This candidate has no resume attached.',
      };
    }

    const response = await fetch(resume.url);
    if (!response.ok) {
      return {
        configured: true, parsed: false, fieldsUpdated: [],
        message: 'That resume could not be downloaded.',
      };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    // Keep well inside the request limit; a resume past this is not a resume.
    if (bytes.byteLength > 8_000_000) {
      return {
        configured: true, parsed: false, fieldsUpdated: [],
        message: 'That file is too large to read.',
      };
    }
    const isPdf = (resume.mimeType ?? '').includes('pdf') || resume.url.toLowerCase().endsWith('.pdf');

    const client = new Anthropic({ apiKey });
    const request = {
      model: 'claude-opus-5',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              headline: { type: ['string', 'null'] },
              currentCompany: { type: ['string', 'null'] },
              location: { type: ['string', 'null'] },
              yearsExperience: { type: ['number', 'null'] },
              skills: { type: 'array', items: { type: 'string', enum: KNOWN_SKILLS } },
              summary: { type: 'string' },
            },
            required: ['headline', 'currentCompany', 'location', 'yearsExperience', 'skills', 'summary'],
            additionalProperties: false,
          },
        },
      },
      system:
        'You read resumes and return structured facts. Report only what the document actually states — ' +
        'use null rather than inferring a missing field, and never estimate years of experience unless ' +
        'dates make it calculable. Choose skills only from the provided list. The summary is two sentences ' +
        'of plain prose describing what this person has actually built or owned.',
      messages: [
        {
          role: 'user',
          content: [
            isPdf
              ? {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') },
                }
              : { type: 'text', text: bytes.toString('utf8').slice(0, 120_000) },
            { type: 'text', text: `Extract the structured fields for ${candidate.fullName ?? 'this candidate'}.` },
          ],
        },
      ],
    } as const;

    const message = await client.messages.create(
      request as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const parsed = Parsed.safeParse(JSON.parse(text || '{}'));
    if (!parsed.success) {
      return {
        configured: true, parsed: false, fieldsUpdated: [],
        message: 'The resume could not be read into structured fields.',
      };
    }

    // Fill gaps only — a recruiter's correction outranks a re-parse.
    const patch: Record<string, unknown> = {};
    const updated: string[] = [];
    const fill = (key: string, current: unknown, next: unknown) => {
      if (next == null || next === '') return;
      if (current == null || current === '' || (Array.isArray(current) && current.length === 0)) {
        patch[key] = next;
        updated.push(key);
      }
    };
    fill('headline', candidate.headline, parsed.data.headline);
    fill('currentCompany', candidate.currentCompany, parsed.data.currentCompany);
    fill('location', candidate.location, parsed.data.location);
    fill('yearsExperience', candidate.yearsExperience, parsed.data.yearsExperience);
    fill('skills', candidate.skills, parsed.data.skills.length ? parsed.data.skills : null);
    fill('aiSummary', candidate.aiSummary, parsed.data.summary);

    if (Object.keys(patch).length > 0) {
      await zite.candidates.update({ id: candidate.id, record: patch as never });
    }

    return { configured: true, parsed: true, fieldsUpdated: updated, message: null };
  },
});
