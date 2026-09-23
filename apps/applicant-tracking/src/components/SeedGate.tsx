import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { seedDemoData } from 'zitejs/api';
import { Loader2 } from 'lucide-react';

// A template opened on an empty database looks broken, so the app seeds itself
// the first time it is used. Seeding is phased server-side; this walks the
// phases in order and shows honest progress rather than a frozen spinner.
const PHASES = 5;

export function SeedGate({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState(0);
  const [label, setLabel] = useState('Preparing your workspace');
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (seeded || started.current) return;
    started.current = true;

    (async () => {
      try {
        for (let p = 1; p <= PHASES; p++) {
          setPhase(p);
          const result = await seedDemoData({ phase: p });
          setLabel(result.label);
          if (result.done) break;
        }
        await queryClient.invalidateQueries();
      } catch {
        setFailed(true);
      }
    })();
  }, [seeded, queryClient]);

  if (seeded) return <>{children}</>;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground">
          A
        </div>
        {failed ? (
          <>
            <h1 className="mb-1.5 text-[15px] font-medium">Could not load demo data</h1>
            <p className="text-[13px] text-muted-foreground">
              Reload the page to try again. The app works with an empty database too — you can
              create a job and start from scratch.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-1.5 text-[15px] font-medium">Loading demo data</h1>
            <p className="mb-5 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {label}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${(phase / PHASES) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Step {phase} of {PHASES}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
