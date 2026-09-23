import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin } from 'lucide-react';
import { listPublicJobs } from 'zitejs/api';

const compact = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

export function JobsListPage() {
  const q = useQuery({
    queryKey: ['publicJobs'],
    queryFn: () => listPublicJobs({}),
    staleTime: 60_000,
  });

  const [dept, setDept] = useState<string | null>(null);
  const allJobs = q.data?.jobs ?? [];
  const allDepartments = [...new Set(allJobs.map((j) => j.department ?? 'Other'))];
  const jobs = dept ? allJobs.filter((j) => (j.department ?? 'Other') === dept) : allJobs;
  const departments = [...new Set(jobs.map((j) => j.department ?? 'Other'))];

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
      <header className="mb-14 animate-rise">
        <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-[17px] font-bold text-primary-foreground">
          N
        </div>
        <h1 className="mb-4 text-[38px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">
          A small team
          <br />
          doing careful work.
        </h1>
        <p className="max-w-xl text-[16px] leading-relaxed text-muted-foreground">
          Northwind Labs hires people who care about the details and then gives them real
          ownership of the outcome. If that sounds like how you want to spend your time,
          we would like to meet you.
        </p>
      </header>

      {q.isPending ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-xl bg-muted"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[15px] font-medium">No open roles right now</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Check back soon — we are usually hiring for something.
          </p>
        </div>
      ) : (
        <div className="space-y-12 animate-rise">
          {allDepartments.length > 1 && (
            <div className="-mt-4 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDept(null)}
                className={`rounded-full border px-3 py-1 text-[13px] transition ${
                  dept === null
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                All {allJobs.length} roles
              </button>
              {allDepartments.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setDept(x)}
                  className={`rounded-full border px-3 py-1 text-[13px] transition ${
                    dept === x
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          {departments.map((dept) => (
            <section key={dept}>
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                {dept}
              </h2>
              <div className="space-y-2">
                {jobs
                  .filter((j) => (j.department ?? 'Other') === dept)
                  .map((j) => (
                    <Link
                      key={j.id}
                      to={`/role/${j.slug}`}
                      className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-medium leading-snug">{j.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {j.location ?? 'Remote'}
                          </span>
                          <span>{j.workplaceType}</span>
                          <span>{j.employmentType}</span>
                          {j.salaryMin != null && j.salaryMax != null && (
                            <span className="tabular-nums">
                              {compact(j.salaryMin)} – {compact(j.salaryMax)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-20 border-t border-border pt-6 text-[13px] text-muted-foreground">
        Northwind Labs is a demo company. Every role here is sample data in an applicant tracking
        template.
      </footer>
    </main>
  );
}
