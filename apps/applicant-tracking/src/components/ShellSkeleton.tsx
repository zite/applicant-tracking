// Matches the real shell's geometry so first paint does not reflow when the
// bootstrap query lands.
export function ShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-[228px] shrink-0 border-r border-sidebar-border bg-sidebar-background p-3">
        <div className="mb-4 flex items-center gap-2 px-1 pt-1">
          <div className="h-6 w-6 rounded-md bg-primary/80" />
          <div className="h-3 w-14 rounded skeleton-shimmer" />
        </div>
        <div className="mb-4 h-7 rounded-md skeleton-shimmer" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-1.5 h-6 rounded skeleton-shimmer" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </aside>
      <main className="flex-1 p-6">
        <div className="mb-6 h-5 w-48 rounded skeleton-shimmer" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 space-y-2">
              <div className="h-6 rounded skeleton-shimmer" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div
                  key={j}
                  className="h-20 rounded-lg skeleton-shimmer"
                  style={{ opacity: 1 - j * 0.25 }}
                />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
