import type { ReactNode } from 'react';

/** Frame every tab renders inside: title row with an actions slot, then the content in a card panel. */
export default function PageLayout({
  title,
  meta,
  description,
  actions,
  children,
}: {
  title: string;
  /** Muted text right after the title, e.g. a count. */
  meta?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">
            {title}
            {meta && <span className="ml-2 text-sm font-normal text-muted-foreground">— {meta}</span>}
          </h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="grid gap-4 rounded-lg border bg-card p-5">{children}</div>}
    </div>
  );
}
