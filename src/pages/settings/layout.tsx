import type { ReactNode } from 'react';

/** A settings page: its title and one line about it, then the rows. */
export function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-4">
      <div className="grid gap-1">
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        {description && <p className="m-0 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** The grey block the rows of one settings page sit in, told apart by rules. */
export function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="divide-y rounded-lg border bg-muted/30">{children}</div>;
}

/** One setting: what it is on the left, its control on the right (stacked on a narrow screen). */
export function SettingRow({ title, description, note, children }: { title: string; description?: string; note?: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8">
      <div className="grid content-start gap-1">
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        {description && <p className="m-0 text-sm text-muted-foreground">{description}</p>}
        {note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="grid content-start gap-3">{children}</div>
    </div>
  );
}
