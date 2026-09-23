export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5 md:h-[52px] md:flex-nowrap md:py-0">
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-tight">{title}</div>
        {subtitle ? (
          <div className="truncate text-[11.5px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto md:flex-nowrap">
        {children}
      </div>
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16">
      <div className="max-w-sm text-center">
        <div className="mb-1.5 text-[14px] font-medium">{title}</div>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
