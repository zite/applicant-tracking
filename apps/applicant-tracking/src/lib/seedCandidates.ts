// Candidate roster for the demo workspace.
//
// `s` is the index into that job's stage template (0 = Applied … 6 = Hired) and
// `st` the application status. The spread is deliberate: every stage of every
// open pipeline has someone in it, so no board column renders empty.

export type SeedCandidate = {
  n: string; h: string; c: string; l: string; y: number;
  j: string; s: number; st: 'Active' | 'Rejected' | 'Hired' | 'Withdrawn' | 'On Hold';
  src: string; sk: string[]; t?: string[]; rr?: string;
};

const ENG = 'senior-full-stack-engineer';
const DES = 'staff-product-designer';
const PM = 'product-manager-platform';
const EM = 'engineering-manager-infrastructure';
const AE = 'enterprise-account-executive';
const GM = 'growth-marketing-lead';
const DS = 'data-scientist-product-analytics';

export const CANDIDATES: SeedCandidate[] = [
  // Senior Full-Stack Engineer
  { n: 'Amara Osei', h: 'Senior Software Engineer', c: 'Stripe', l: 'Austin, TX', y: 8, j: ENG, s: 5, st: 'Active', src: 'Referral', sk: ['TypeScript', 'React', 'Postgres', 'AWS'], t: ['Top Prospect', 'Referral'] },
  { n: 'Ben Lindqvist', h: 'Staff Engineer', c: 'Figma', l: 'Remote, US', y: 10, j: ENG, s: 4, st: 'Active', src: 'Sourced', sk: ['TypeScript', 'React', 'Go'], t: ['Top Prospect', 'Senior'] },
  { n: 'Carmen Ruiz', h: 'Full-Stack Engineer', c: 'Notion', l: 'Brooklyn, NY', y: 7, j: ENG, s: 4, st: 'Active', src: 'Applied', sk: ['TypeScript', 'React', 'Postgres'] },
  { n: 'Dmitri Volkov', h: 'Senior Backend Engineer', c: 'Datadog', l: 'Remote, US', y: 9, j: ENG, s: 3, st: 'Active', src: 'Sourced', sk: ['Go', 'Postgres', 'Kubernetes', 'AWS'] },
  { n: 'Elena Fitzgerald', h: 'Software Engineer II', c: 'Airtable', l: 'San Francisco, CA', y: 6, j: ENG, s: 3, st: 'Active', src: 'Applied', sk: ['TypeScript', 'React'] },
  { n: 'Farid Haddad', h: 'Senior Engineer', c: 'Vercel', l: 'Remote, US', y: 8, j: ENG, s: 2, st: 'Active', src: 'Referral', sk: ['TypeScript', 'React', 'Postgres'], t: ['Referral'] },
  { n: 'Grace Nakamura', h: 'Full-Stack Developer', c: 'Retool', l: 'Seattle, WA', y: 7, j: ENG, s: 2, st: 'Active', src: 'Applied', sk: ['TypeScript', 'React', 'AWS'] },
  { n: 'Hugo Almeida', h: 'Senior Software Engineer', c: 'Shopify', l: 'Remote, US', y: 9, j: ENG, s: 2, st: 'Active', src: 'Applied', sk: ['TypeScript', 'Postgres', 'Rust'] },
  { n: 'Imani Brooks', h: 'Software Engineer', c: 'Linear', l: 'Denver, CO', y: 6, j: ENG, s: 1, st: 'Active', src: 'Applied', sk: ['TypeScript', 'React'] },
  { n: 'Jonas Berger', h: 'Backend Engineer', c: 'Segment', l: 'Chicago, IL', y: 7, j: ENG, s: 1, st: 'Active', src: 'Applied', sk: ['Go', 'Postgres', 'Kubernetes'] },
  { n: 'Kavya Reddy', h: 'Senior Engineer', c: 'Plaid', l: 'Remote, US', y: 8, j: ENG, s: 1, st: 'Active', src: 'Sourced', sk: ['TypeScript', 'React', 'AWS'], t: ['Top Prospect'] },
  { n: 'Liam Gallagher', h: 'Full-Stack Engineer', c: 'Webflow', l: 'Portland, OR', y: 6, j: ENG, s: 1, st: 'Active', src: 'Applied', sk: ['TypeScript', 'React'] },
  { n: 'Mira Kowalski', h: 'Software Engineer', c: 'Census', l: 'Remote, US', y: 5, j: ENG, s: 0, st: 'Active', src: 'Applied', sk: ['TypeScript', 'Python'] },
  { n: 'Noah Whitfield', h: 'Senior Developer', c: 'Amplitude', l: 'Boston, MA', y: 9, j: ENG, s: 0, st: 'Active', src: 'Applied', sk: ['TypeScript', 'React', 'Postgres'] },
  { n: 'Olga Petrova', h: 'Staff Software Engineer', c: 'Cloudflare', l: 'Remote, US', y: 11, j: ENG, s: 0, st: 'Active', src: 'Sourced', sk: ['Rust', 'Go', 'Kubernetes'], t: ['Senior'] },
  { n: 'Pedro Castillo', h: 'Full-Stack Engineer', c: 'Loom', l: 'Miami, FL', y: 6, j: ENG, s: 0, st: 'Active', src: 'Applied', sk: ['TypeScript', 'React'] },
  { n: 'Quinn Sutherland', h: 'Software Engineer', c: 'Mercury', l: 'Remote, US', y: 5, j: ENG, s: 0, st: 'Active', src: 'Applied', sk: ['TypeScript', 'Postgres'] },
  { n: 'Rania Aziz', h: 'Senior Engineer', c: 'Ramp', l: 'New York, NY', y: 8, j: ENG, s: 0, st: 'Active', src: 'Referral', sk: ['TypeScript', 'React', 'AWS'], t: ['Referral'] },
  { n: 'Samuel Adeyemi', h: 'Backend Engineer', c: 'Brex', l: 'Remote, US', y: 7, j: ENG, s: 2, st: 'Rejected', src: 'Applied', sk: ['Go', 'Postgres'], rr: 'Skills Mismatch' },
  { n: 'Tara Lindgren', h: 'Software Engineer', c: 'Coda', l: 'Remote, US', y: 5, j: ENG, s: 1, st: 'Rejected', src: 'Applied', sk: ['TypeScript', 'React'], rr: 'Lacking Experience' },
  { n: 'Umar Farooq', h: 'Senior Engineer', c: 'Asana', l: 'San Francisco, CA', y: 9, j: ENG, s: 3, st: 'Rejected', src: 'Sourced', sk: ['TypeScript', 'Go'], rr: 'Compensation', t: ['Silver Medalist', 'Re-engage Later'] },
  { n: 'Vera Sokolova', h: 'Full-Stack Engineer', c: 'Miro', l: 'Remote, US', y: 6, j: ENG, s: 0, st: 'Rejected', src: 'Applied', sk: ['TypeScript'], rr: 'Unresponsive' },
  { n: 'Wesley Tran', h: 'Senior Software Engineer', c: 'Front', l: 'Los Angeles, CA', y: 8, j: ENG, s: 6, st: 'Hired', src: 'Referral', sk: ['TypeScript', 'React', 'Postgres'], t: ['Referral'] },

  // Staff Product Designer
  { n: 'Ana Beltrán', h: 'Staff Product Designer', c: 'Airbnb', l: 'San Francisco, CA', y: 11, j: DES, s: 5, st: 'Active', src: 'Sourced', sk: ['Figma', 'Design Systems', 'User Research'], t: ['Top Prospect', 'Senior'] },
  { n: 'Bo Halvorsen', h: 'Senior Product Designer', c: 'Dropbox', l: 'Oakland, CA', y: 9, j: DES, s: 4, st: 'Active', src: 'Applied', sk: ['Figma', 'Design Systems'] },
  { n: 'Chiara Rossi', h: 'Product Designer', c: 'Intercom', l: 'San Francisco, CA', y: 8, j: DES, s: 3, st: 'Active', src: 'Referral', sk: ['Figma', 'User Research'], t: ['Referral'] },
  { n: 'Desmond Clarke', h: 'Design Lead', c: 'Atlassian', l: 'San Francisco, CA', y: 12, j: DES, s: 2, st: 'Active', src: 'Sourced', sk: ['Figma', 'Design Systems'], t: ['Senior'] },
  { n: 'Eun-ji Park', h: 'Senior Designer', c: 'Canva', l: 'Berkeley, CA', y: 7, j: DES, s: 2, st: 'Active', src: 'Applied', sk: ['Figma', 'User Research'] },
  { n: 'Fabien Moreau', h: 'Product Designer', c: 'Sketch', l: 'San Jose, CA', y: 8, j: DES, s: 1, st: 'Active', src: 'Applied', sk: ['Figma', 'Design Systems'] },
  { n: 'Gita Sharma', h: 'Senior Product Designer', c: 'Slack', l: 'San Francisco, CA', y: 9, j: DES, s: 1, st: 'Active', src: 'Applied', sk: ['Figma', 'User Research'] },
  { n: 'Henrik Nilsson', h: 'Staff Designer', c: 'Spotify', l: 'San Francisco, CA', y: 10, j: DES, s: 0, st: 'Active', src: 'Applied', sk: ['Figma', 'Design Systems'] },
  { n: 'Ingrid Larsen', h: 'Product Designer', c: 'Framer', l: 'Remote, US', y: 7, j: DES, s: 0, st: 'Active', src: 'Applied', sk: ['Figma'], t: ['Needs Visa'] },
  { n: 'Jae-won Lim', h: 'Senior Designer', c: 'Coinbase', l: 'San Francisco, CA', y: 8, j: DES, s: 2, st: 'Rejected', src: 'Applied', sk: ['Figma'], rr: 'Culture Fit' },

  // Product Manager, Platform
  { n: 'Kiran Malhotra', h: 'Senior PM, Platform', c: 'Twilio', l: 'Remote, US', y: 7, j: PM, s: 4, st: 'Active', src: 'Sourced', sk: ['Product Strategy', 'Analytics'], t: ['Top Prospect'] },
  { n: 'Lucia Ferreira', h: 'Product Manager', c: 'Auth0', l: 'Austin, TX', y: 6, j: PM, s: 3, st: 'Active', src: 'Applied', sk: ['Product Strategy'] },
  { n: 'Marcus Bell', h: 'Group PM', c: 'DigitalOcean', l: 'Remote, US', y: 9, j: PM, s: 2, st: 'Active', src: 'Referral', sk: ['Product Strategy', 'Analytics'], t: ['Referral'] },
  { n: 'Nadia Rahimi', h: 'Senior PM', c: 'Postman', l: 'Remote, US', y: 7, j: PM, s: 2, st: 'Active', src: 'Applied', sk: ['Product Strategy'] },
  { n: 'Oscar Lindholm', h: 'Product Manager, API', c: 'Algolia', l: 'Denver, CO', y: 6, j: PM, s: 1, st: 'Active', src: 'Applied', sk: ['Product Strategy', 'Analytics'] },
  { n: 'Priyanka Nair', h: 'Senior Product Manager', c: 'Okta', l: 'Remote, US', y: 8, j: PM, s: 1, st: 'Active', src: 'Sourced', sk: ['Product Strategy'] },
  { n: 'Rafael Santos', h: 'Product Manager', c: 'Contentful', l: 'Chicago, IL', y: 5, j: PM, s: 0, st: 'Active', src: 'Applied', sk: ['Product Strategy'] },
  { n: 'Sienna Marsh', h: 'PM, Developer Platform', c: 'Netlify', l: 'Remote, US', y: 7, j: PM, s: 0, st: 'Active', src: 'Applied', sk: ['Product Strategy', 'Analytics'] },
  { n: 'Tobias Krueger', h: 'Senior PM', c: 'Fastly', l: 'Remote, US', y: 8, j: PM, s: 1, st: 'Rejected', src: 'Applied', sk: ['Product Strategy'], rr: 'Skills Mismatch' },

  // Engineering Manager, Infrastructure
  { n: 'Ulrika Berg', h: 'Engineering Manager', c: 'MongoDB', l: 'New York, NY', y: 12, j: EM, s: 5, st: 'Active', src: 'Sourced', sk: ['Kubernetes', 'AWS', 'Go'], t: ['Top Prospect', 'Senior'] },
  { n: 'Victor Nwosu', h: 'Senior EM, Platform', c: 'Confluent', l: 'New York, NY', y: 11, j: EM, s: 4, st: 'Active', src: 'Referral', sk: ['Kubernetes', 'AWS'], t: ['Referral'] },
  { n: 'Wendy Achterberg', h: 'Engineering Manager', c: 'HashiCorp', l: 'Remote, US', y: 10, j: EM, s: 3, st: 'Active', src: 'Applied', sk: ['Kubernetes', 'Go', 'AWS'] },
  { n: 'Xavier Dubois', h: 'Infrastructure Lead', c: 'Grafana Labs', l: 'New York, NY', y: 13, j: EM, s: 2, st: 'Active', src: 'Sourced', sk: ['Kubernetes', 'Go'], t: ['Senior'] },
  { n: 'Yuki Tanaka', h: 'Staff SRE', c: 'Snowflake', l: 'Jersey City, NJ', y: 9, j: EM, s: 1, st: 'Active', src: 'Applied', sk: ['Kubernetes', 'AWS', 'Python'] },
  { n: 'Zara Mbeki', h: 'Engineering Manager', c: 'Elastic', l: 'New York, NY', y: 10, j: EM, s: 1, st: 'Active', src: 'Applied', sk: ['Kubernetes', 'AWS'] },
  { n: 'Aaron Feldman', h: 'Senior Engineering Manager', c: 'Cockroach Labs', l: 'New York, NY', y: 12, j: EM, s: 0, st: 'Active', src: 'Applied', sk: ['Go', 'Postgres', 'Kubernetes'] },
  { n: 'Bianca Costa', h: 'Platform Engineering Lead', c: 'Vercel', l: 'Remote, US', y: 11, j: EM, s: 0, st: 'On Hold', src: 'Sourced', sk: ['Kubernetes', 'AWS'] },

  // Enterprise Account Executive
  { n: 'Colin Hayes', h: 'Enterprise AE', c: 'Gong', l: 'Remote, US', y: 9, j: AE, s: 6, st: 'Hired', src: 'Referral', sk: ['Enterprise Sales'], t: ['Referral'] },
  { n: 'Delia Okonkwo', h: 'Strategic Account Executive', c: 'Databricks', l: 'Remote, US', y: 11, j: AE, s: 4, st: 'Active', src: 'Sourced', sk: ['Enterprise Sales'], t: ['Top Prospect'] },
  { n: 'Emilio Vargas', h: 'Enterprise AE', c: 'Snowflake', l: 'Remote, US', y: 8, j: AE, s: 3, st: 'Active', src: 'Applied', sk: ['Enterprise Sales'] },
  { n: 'Fiona Sheridan', h: 'Senior AE', c: 'Salesforce', l: 'Remote, US', y: 10, j: AE, s: 2, st: 'Active', src: 'Sourced', sk: ['Enterprise Sales'] },
  { n: 'Gabriel Moreno', h: 'Account Executive', c: 'Zoom', l: 'Remote, US', y: 7, j: AE, s: 2, st: 'Active', src: 'Applied', sk: ['Enterprise Sales'] },
  { n: 'Hana Yoshida', h: 'Enterprise AE', c: 'Asana', l: 'Remote, US', y: 8, j: AE, s: 1, st: 'Active', src: 'Applied', sk: ['Enterprise Sales'] },
  { n: 'Isaac Brenner', h: 'Senior Account Executive', c: 'Airtable', l: 'Remote, US', y: 9, j: AE, s: 1, st: 'Active', src: 'Referral', sk: ['Enterprise Sales'], t: ['Referral'] },
  { n: 'Jasmine Cole', h: 'Enterprise AE', c: 'Notion', l: 'Remote, US', y: 7, j: AE, s: 1, st: 'Active', src: 'Applied', sk: ['Enterprise Sales'] },
  { n: 'Kofi Mensah', h: 'Account Executive', c: 'Miro', l: 'Remote, US', y: 6, j: AE, s: 0, st: 'Active', src: 'Applied', sk: ['Enterprise Sales'] },
  { n: 'Leonie Fischer', h: 'Enterprise AE', c: 'Personio', l: 'Remote, US', y: 8, j: AE, s: 0, st: 'Active', src: 'Applied', sk: ['Enterprise Sales'], t: ['Needs Visa'] },
  { n: 'Mateo Silva', h: 'Senior AE', c: 'Pipedrive', l: 'Remote, US', y: 7, j: AE, s: 0, st: 'Active', src: 'Applied', sk: ['Enterprise Sales'] },
  { n: 'Nora Sullivan', h: 'Account Executive', c: 'Clari', l: 'Remote, US', y: 6, j: AE, s: 2, st: 'Withdrawn', src: 'Applied', sk: ['Enterprise Sales'] },

  // Growth Marketing Lead
  { n: 'Omar Khalil', h: 'Head of Growth', c: 'Webflow', l: 'Remote, US', y: 9, j: GM, s: 1, st: 'Active', src: 'Sourced', sk: ['Demand Gen', 'Analytics'], t: ['Top Prospect'] },
  { n: 'Paloma Rivas', h: 'Growth Marketing Manager', c: 'Calendly', l: 'Remote, US', y: 7, j: GM, s: 0, st: 'Active', src: 'Applied', sk: ['Demand Gen'] },
  { n: 'Rhys Morgan', h: 'Director of Demand Gen', c: 'Drift', l: 'Remote, US', y: 10, j: GM, s: 0, st: 'On Hold', src: 'Applied', sk: ['Demand Gen', 'Analytics'] },

  // Data Scientist, Product Analytics
  { n: 'Saanvi Iyer', h: 'Senior Data Scientist', c: 'Duolingo', l: 'Remote, US', y: 7, j: DS, s: 3, st: 'Active', src: 'Sourced', sk: ['Python', 'Analytics', 'Machine Learning'], t: ['Top Prospect'] },
  { n: 'Tomás Herrera', h: 'Data Scientist', c: 'Instacart', l: 'Remote, US', y: 6, j: DS, s: 2, st: 'Active', src: 'Applied', sk: ['Python', 'Analytics'] },
  { n: 'Ursula Novak', h: 'Product Analyst', c: 'Robinhood', l: 'Remote, US', y: 5, j: DS, s: 1, st: 'Active', src: 'Applied', sk: ['Python', 'Analytics', 'Postgres'] },
  { n: 'Viktor Andersson', h: 'Senior Analyst', c: 'Spotify', l: 'Remote, US', y: 8, j: DS, s: 1, st: 'Active', src: 'Referral', sk: ['Python', 'Analytics'], t: ['Referral'] },
  { n: 'Willa Bennett', h: 'Data Scientist', c: 'Peloton', l: 'Remote, US', y: 6, j: DS, s: 0, st: 'Active', src: 'Applied', sk: ['Python', 'Machine Learning'] },
  { n: 'Xin Zhao', h: 'Machine Learning Engineer', c: 'Scale AI', l: 'Remote, US', y: 7, j: DS, s: 0, st: 'Active', src: 'Applied', sk: ['Python', 'Machine Learning'] },
  { n: 'Yosef Grunwald', h: 'Analytics Lead', c: 'Lemonade', l: 'Remote, US', y: 9, j: DS, s: 0, st: 'Active', src: 'Applied', sk: ['Python', 'Analytics', 'Postgres'] },
];
