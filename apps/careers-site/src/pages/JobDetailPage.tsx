import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, Building2, MapPin, Wallet } from 'lucide-react';
import { getPublicJob } from 'zitejs/api';
import { JobBody } from '../components/JobBody';
import { ApplyForm } from '../components/ApplyForm';

const compact = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

export function JobDetailPage() {
  const { slug } = useParams();
  const q = useQuery({
    queryKey: ['publicJob', slug],
    queryFn: () => getPublicJob({ slug: slug! }),
    enabled: Boolean(slug),
    retry: false,
  });

  if (q.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-4 h-9 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="mb-10 h-5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
      </main>
    );
  }

  if (q.isError || !q.data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="mb-2 text-[22px] font-semibold">This role is no longer open</h1>
        <p className="mb-6 text-muted-foreground">
          It may have been filled or closed since you last saw it.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[14.5px] transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> See all open roles
        </Link>
      </main>
    );
  }

  const job = q.data.job;
  const facts = [
    { icon: MapPin, value: job.location ?? 'Remote' },
    { icon: Building2, value: job.workplaceType },
    { icon: Briefcase, value: job.employmentType },
    job.salaryMin != null && job.salaryMax != null
      ? { icon: Wallet, value: `${compact(job.salaryMin)} – ${compact(job.salaryMax)}` }
      : null,
  ].filter(Boolean) as { icon: typeof MapPin; value: string | null }[];

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-12 animate-rise">
      <Link
        to="/"
        className="mb-9 inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All roles
      </Link>

      <header className="mb-9">
        <div className="mb-2 text-[13px] font-semibold uppercase tracking-widest text-primary">
          {job.department ?? 'Open role'}
          {/* Several jobs name the team after the department; printing both
              gives "Design · Design". */}
          {job.team && job.team.toLowerCase() !== (job.department ?? '').toLowerCase()
            ? ` · ${job.team}`
            : ''}
        </div>
        <h1 className="mb-4 text-[34px] font-semibold leading-tight tracking-tight">{job.title}</h1>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-muted-foreground">
          {facts.map(({ icon: Icon, value }) => (
            <span key={value} className="flex items-center gap-1.5">
              <Icon className="h-4 w-4" />
              {value}
            </span>
          ))}
        </div>
      </header>

      <article className="space-y-9">
        <JobBody text={job.description} />

        {job.requirements && (
          <section>
            <h2 className="mb-3 text-[18px] font-medium">What we are looking for</h2>
            <JobBody text={job.requirements} />
          </section>
        )}

        {job.benefits && (
          <section>
            <h2 className="mb-3 text-[18px] font-medium">What we offer</h2>
            <JobBody text={job.benefits} />
          </section>
        )}
      </article>

      <div className="mt-12">
        <ApplyForm jobSlug={job.slug} jobTitle={job.title} />
      </div>
    </main>
  );
}
