// Demo content for this applicant tracking template. Shipped as code so an
// installed copy of the template seeds itself — see src/api/seedDemoData.ts.
// The fictional employer is Northwind Labs; nothing here is a real address.

export const TEAM = [
  { name: 'Maya Chen', email: 'maya.chen@northwindlabs.com', title: 'Head of Talent', role: 'Admin', department: 'People' },
  { name: 'Daniel Okafor', email: 'daniel.okafor@northwindlabs.com', title: 'Technical Recruiter', role: 'Recruiter', department: 'People' },
  { name: 'Jordan Ellis', email: 'jordan.ellis@northwindlabs.com', title: 'Recruiting Coordinator', role: 'Coordinator', department: 'People' },
  { name: 'Priya Raman', email: 'priya.raman@northwindlabs.com', title: 'Director of Engineering', role: 'Hiring Manager', department: 'Engineering' },
  { name: 'Tom Wexler', email: 'tom.wexler@northwindlabs.com', title: 'Staff Engineer', role: 'Interviewer', department: 'Engineering' },
  { name: 'Nina Patel', email: 'nina.patel@northwindlabs.com', title: 'Principal Engineer', role: 'Interviewer', department: 'Engineering' },
  { name: 'Sofia Marino', email: 'sofia.marino@northwindlabs.com', title: 'Head of Design', role: 'Hiring Manager', department: 'Design' },
  { name: 'Alex Kim', email: 'alex.kim@northwindlabs.com', title: 'VP Product', role: 'Hiring Manager', department: 'Product' },
  { name: 'Ruth Delgado', email: 'ruth.delgado@northwindlabs.com', title: 'VP Sales', role: 'Hiring Manager', department: 'Sales' },
];

type StageSpec = { name: string; kind: string; targetDays: number; kit?: string };

const ENG_STAGES: StageSpec[] = [
  { name: 'Applied', kind: 'Applied', targetDays: 3, kit: 'Screen the resume for depth of ownership, not just tenure. Look for systems they built end to end.' },
  { name: 'Recruiter Screen', kind: 'Screen', targetDays: 5, kit: '30 min. Motivation, comp expectations, notice period, and one specific project they are proud of.' },
  { name: 'Technical Screen', kind: 'Interview', targetDays: 7, kit: '60 min pairing on a realistic bug in an unfamiliar codebase. Assess debugging method over syntax recall.' },
  { name: 'Hiring Manager', kind: 'Interview', targetDays: 5, kit: '45 min. Scope of past ownership, how they handle ambiguity, and what they want next.' },
  { name: 'Onsite Loop', kind: 'Interview', targetDays: 7, kit: 'Four sessions: system design, code review, cross-functional collaboration, and values.' },
  { name: 'Offer', kind: 'Offer', targetDays: 5, kit: 'Align comp with the band before the call. Close on motivation, not just numbers.' },
  { name: 'Hired', kind: 'Hired', targetDays: 0 },
];

const DESIGN_STAGES: StageSpec[] = [
  { name: 'Applied', kind: 'Applied', targetDays: 3, kit: 'Portfolio first. Look for problem framing and iteration, not polished final frames.' },
  { name: 'Recruiter Screen', kind: 'Screen', targetDays: 5, kit: '30 min. Craft focus, team preferences, comp expectations.' },
  { name: 'Portfolio Review', kind: 'Interview', targetDays: 7, kit: '60 min walkthrough of two projects. Probe the decisions they reversed and why.' },
  { name: 'Hiring Manager', kind: 'Interview', targetDays: 5, kit: '45 min. Design leadership, critique style, partnership with engineering.' },
  { name: 'Onsite Loop', kind: 'Interview', targetDays: 7, kit: 'Whiteboard exercise, cross-functional session, and a craft deep dive.' },
  { name: 'Offer', kind: 'Offer', targetDays: 5, kit: 'Confirm level against the design ladder before extending.' },
  { name: 'Hired', kind: 'Hired', targetDays: 0 },
];

const SALES_STAGES: StageSpec[] = [
  { name: 'Applied', kind: 'Applied', targetDays: 2, kit: 'Look for quota attainment with context — deal size, cycle length, and segment.' },
  { name: 'Recruiter Screen', kind: 'Screen', targetDays: 4, kit: '30 min. Territory history, quota, and why they are leaving.' },
  { name: 'Role Play', kind: 'Interview', targetDays: 6, kit: 'Live discovery call against a realistic persona. Assess questioning, not pitching.' },
  { name: 'Hiring Manager', kind: 'Interview', targetDays: 5, kit: '45 min. Pipeline generation habits and forecast discipline.' },
  { name: 'Onsite Loop', kind: 'Interview', targetDays: 6, kit: 'Deal review presentation plus cross-functional partnership session.' },
  { name: 'Offer', kind: 'Offer', targetDays: 4, kit: 'Confirm OTE split and ramp expectations.' },
  { name: 'Hired', kind: 'Hired', targetDays: 0 },
];

const GENERAL_STAGES: StageSpec[] = [
  { name: 'Applied', kind: 'Applied', targetDays: 3, kit: 'Screen for relevant scope and measurable outcomes.' },
  { name: 'Recruiter Screen', kind: 'Screen', targetDays: 5, kit: '30 min. Motivation, comp expectations, and timeline.' },
  { name: 'Working Session', kind: 'Interview', targetDays: 7, kit: '60 min applied exercise drawn from real work on the team.' },
  { name: 'Hiring Manager', kind: 'Interview', targetDays: 5, kit: '45 min. Ownership, judgement, and how they prioritise.' },
  { name: 'Final Loop', kind: 'Interview', targetDays: 7, kit: 'Cross-functional partners plus a values conversation.' },
  { name: 'Offer', kind: 'Offer', targetDays: 5, kit: 'Align on level and start date before extending.' },
  { name: 'Hired', kind: 'Hired', targetDays: 0 },
];

export const STAGE_TEMPLATES: Record<string, StageSpec[]> = {
  eng: ENG_STAGES,
  design: DESIGN_STAGES,
  sales: SALES_STAGES,
  general: GENERAL_STAGES,
};

export const JOBS = [
  {
    title: 'Senior Full-Stack Engineer', slug: 'senior-full-stack-engineer', department: 'Engineering', team: 'Core Product',
    location: 'Remote (US)', workplaceType: 'Remote', employmentType: 'Full-time', status: 'Open', priority: 'Critical',
    published: true, openings: 2, salaryMin: 180000, salaryMax: 230000, openedDays: 62, template: 'eng',
    hiringManager: 'Priya Raman', recruiter: 'Daniel Okafor',
    description: 'We are looking for a senior engineer to own features end to end across our TypeScript stack. You will work directly with product and design on problems that are still loosely defined, and you will ship the result yourself.\n\nThis is a high-autonomy role on a small team. The work spans React on the front end, Node and Postgres on the back, and the operational glue in between.',
    requirements: '- 6+ years building production web applications\n- Deep TypeScript, React, and Node experience\n- Comfortable designing schemas and writing non-trivial SQL\n- Track record of owning a system from design through operation\n- Clear written communication; we default to async',
    benefits: '- Fully remote within the US\n- Equity in a company with real revenue\n- $2,500 annual learning budget\n- Top-tier health, dental, and vision\n- Four weeks paid vacation, actually taken',
  },
  {
    title: 'Staff Product Designer', slug: 'staff-product-designer', department: 'Design', team: 'Design',
    location: 'San Francisco, CA', workplaceType: 'Hybrid', employmentType: 'Full-time', status: 'Open', priority: 'High',
    published: true, openings: 1, salaryMin: 190000, salaryMax: 240000, openedDays: 45, template: 'design',
    hiringManager: 'Sofia Marino', recruiter: 'Maya Chen',
    description: 'Own the design of a core surface used by thousands of teams every day. You will set direction rather than execute someone else’s spec, and you will be the design voice in the room when the roadmap is decided.\n\nWe care about craft. We also care about shipping, and the tension between those is the interesting part of the job.',
    requirements: '- 8+ years of product design, including a staff or lead role\n- Portfolio showing systems thinking, not just screens\n- Fluent in Figma and comfortable in a mature design system\n- Experience partnering closely with engineering from the start\n- Able to run your own research when there is no researcher available',
    benefits: '- Hybrid: three days a week in our SF office\n- Equity refresh every year\n- $2,500 annual learning budget\n- Top-tier health, dental, and vision\n- Four weeks paid vacation',
  },
  {
    title: 'Product Manager, Platform', slug: 'product-manager-platform', department: 'Product', team: 'Platform',
    location: 'Remote (US)', workplaceType: 'Remote', employmentType: 'Full-time', status: 'Open', priority: 'High',
    published: true, openings: 1, salaryMin: 175000, salaryMax: 215000, openedDays: 38, template: 'general',
    hiringManager: 'Alex Kim', recruiter: 'Daniel Okafor',
    description: 'Own the platform surface that every other team builds on: APIs, permissions, and the extensibility model. Your customers are both external developers and the internal teams shipping on top of you.\n\nThis role suits someone who is energised by infrastructure-shaped problems and is comfortable saying no to good ideas that do not belong in the platform.',
    requirements: '- 5+ years in product management, at least two on a platform or API product\n- Technical enough to review an API design and push back\n- Strong written communication — specs, not slide decks\n- Experience balancing internal and external customers',
    benefits: '- Fully remote within the US\n- Equity in a company with real revenue\n- $2,500 annual learning budget\n- Top-tier health, dental, and vision',
  },
  {
    title: 'Engineering Manager, Infrastructure', slug: 'engineering-manager-infrastructure', department: 'Engineering', team: 'Infrastructure',
    location: 'New York, NY', workplaceType: 'Hybrid', employmentType: 'Full-time', status: 'Open', priority: 'High',
    published: true, openings: 1, salaryMin: 210000, salaryMax: 260000, openedDays: 29, template: 'eng',
    hiringManager: 'Priya Raman', recruiter: 'Maya Chen',
    description: 'Lead the team that owns our compute, data, and deployment story. You will manage six engineers and stay close enough to the technical detail to be useful in a design review.\n\nWe are looking for a manager who has operated systems at scale and can tell the difference between complexity that is earned and complexity that is accidental.',
    requirements: '- 3+ years managing engineers, plus a strong IC background\n- Operated distributed systems in production\n- Experience with Kubernetes, Terraform, and a major cloud\n- Track record of growing engineers, with references to prove it',
    benefits: '- Hybrid: three days a week in our NYC office\n- Equity refresh every year\n- $2,500 annual learning budget\n- Top-tier health, dental, and vision',
  },
  {
    title: 'Enterprise Account Executive', slug: 'enterprise-account-executive', department: 'Sales', team: 'Enterprise',
    location: 'Remote (US)', workplaceType: 'Remote', employmentType: 'Full-time', status: 'Open', priority: 'Medium',
    published: true, openings: 3, salaryMin: 140000, salaryMax: 170000, openedDays: 51, template: 'sales',
    hiringManager: 'Ruth Delgado', recruiter: 'Daniel Okafor',
    description: 'Sell into enterprise accounts with a product that already has strong bottom-up adoption. Most of your pipeline starts as an existing team inside the account, so the job is expansion and navigation more than cold outbound.\n\nOTE is split 50/50 with an uncapped accelerator above plan.',
    requirements: '- 5+ years closing enterprise SaaS deals above $100k ACV\n- Track record of quota attainment, with specifics\n- Experience with a product-led motion feeding your pipeline\n- Disciplined forecasting and CRM hygiene',
    benefits: '- Fully remote within the US\n- Uncapped commission with accelerators\n- Equity in a company with real revenue\n- Top-tier health, dental, and vision',
  },
  {
    title: 'Growth Marketing Lead', slug: 'growth-marketing-lead', department: 'Marketing', team: 'Growth',
    location: 'Remote (US)', workplaceType: 'Remote', employmentType: 'Full-time', status: 'Paused', priority: 'Low',
    published: true, openings: 1, salaryMin: 150000, salaryMax: 185000, openedDays: 74, template: 'general',
    hiringManager: 'Alex Kim', recruiter: 'Maya Chen',
    description: 'Own acquisition end to end: paid, lifecycle, and the experimentation practice behind both. You will be the first senior growth hire, so you will do the work before you build the team.',
    requirements: '- 6+ years in growth marketing at a B2B SaaS company\n- Owned a paid budget above $1M annually\n- Fluent in analytics; you write your own queries\n- Experience with product-led growth motions',
    benefits: '- Fully remote within the US\n- Equity in a company with real revenue\n- $2,500 annual learning budget\n- Top-tier health, dental, and vision',
  },
  {
    title: 'Data Scientist, Product Analytics', slug: 'data-scientist-product-analytics', department: 'Engineering', team: 'Data',
    location: 'Remote (US)', workplaceType: 'Remote', employmentType: 'Full-time', status: 'Open', priority: 'Medium',
    published: true, openings: 1, salaryMin: 165000, salaryMax: 205000, openedDays: 21, template: 'general',
    hiringManager: 'Priya Raman', recruiter: 'Daniel Okafor',
    description: 'Answer the questions that decide the roadmap. You will own our experimentation platform, build the models behind activation and retention, and make the results legible to people who do not read notebooks.',
    requirements: '- 4+ years in product analytics or data science\n- Expert SQL and strong Python\n- Experience designing and reading experiments correctly\n- Able to present to executives without hedging everything',
    benefits: '- Fully remote within the US\n- Equity in a company with real revenue\n- $2,500 annual learning budget\n- Top-tier health, dental, and vision',
  },
  {
    title: 'Head of People', slug: 'head-of-people', department: 'People', team: 'People',
    location: 'San Francisco, CA', workplaceType: 'Hybrid', employmentType: 'Full-time', status: 'Draft', priority: 'Medium',
    published: false, openings: 1, salaryMin: 200000, salaryMax: 250000, openedDays: 8, template: 'general',
    hiringManager: 'Maya Chen', recruiter: 'Maya Chen',
    description: 'Build the people function for the next stage of the company: performance, compensation, and the operating cadence that keeps a distributed team coherent.',
    requirements: '- 8+ years in people roles with 3+ leading the function\n- Built compensation bands and performance cycles from scratch\n- Experience scaling a company through 100 to 300 people',
    benefits: '- Hybrid: three days a week in our SF office\n- Equity refresh every year\n- Top-tier health, dental, and vision',
  },
];

export const EMAIL_TEMPLATES = [
  {
    name: 'Recruiter screen invite', category: 'Scheduling',
    subject: 'Next step for {{job}} at Northwind Labs',
    body: 'Hi {{firstName}},\n\nThanks for applying to the {{job}} role. I read through your background and would love to set up a 30 minute call to walk through what you are looking for and answer your questions about the team.\n\nAre there a couple of windows that work well for you this week or next?\n\nBest,\n{{recruiter}}',
  },
  {
    name: 'Onsite loop confirmation', category: 'Scheduling',
    subject: 'Your interview loop for {{job}}',
    body: 'Hi {{firstName}},\n\nGreat news — the team would like to move you to the final loop for {{job}}. It is four sessions totalling about three hours, and we can run them in one day or split across two.\n\nI will send calendar invites once you confirm which works better. Let me know if you would like any prep material in advance.\n\nBest,\n{{recruiter}}',
  },
  {
    name: 'Rejection after screen', category: 'Rejection',
    subject: 'Update on your {{job}} application',
    body: 'Hi {{firstName}},\n\nThank you for taking the time to speak with us about {{job}}. After reviewing everything, we have decided not to move forward at this stage.\n\nThis was a genuinely close call and it was not a reflection of your ability. We would welcome an application from you for a future opening, and I am happy to flag one if something relevant opens up.\n\nAll the best,\n{{recruiter}}',
  },
  {
    name: 'Offer extended', category: 'Offer',
    subject: 'Offer: {{job}} at Northwind Labs',
    body: 'Hi {{firstName}},\n\nWe would love for you to join us as {{job}}. The full details are attached, and I have set aside time tomorrow to walk through them and answer anything.\n\nThe whole team was genuinely energised after your loop, and we think you would do the best work of your career here.\n\nBest,\n{{recruiter}}',
  },
  {
    name: 'Sourcing outreach', category: 'Outreach',
    subject: 'Your work at {{company}}',
    body: 'Hi {{firstName}},\n\nI came across your work at {{company}} and wanted to reach out. We are hiring for {{job}} at Northwind Labs and the overlap with what you have been building looked strong enough to be worth a note.\n\nNo pressure at all if the timing is wrong — happy to just stay in touch.\n\nBest,\n{{recruiter}}',
  },
  {
    name: 'Nudge after silence', category: 'Follow-up',
    subject: 'Still interested in {{job}}?',
    body: 'Hi {{firstName}},\n\nChecking in on my last note about {{job}}. Completely understand if the timing is not right — just let me know either way and I will close the loop on our side.\n\nBest,\n{{recruiter}}',
  },
];
