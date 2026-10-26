import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CheckCircle2 } from 'lucide-react';

import { i18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/api/settings.api';
import { useStats, type Stats } from '@/lib/api/stats.api';
import { Skeleton } from '@/components/ui/skeleton';
import PageLayout from '@/components/layout/PageLayout';

import { POLICY_LABELS, SUPPORT_LABELS } from '../residents/labels';
import { RESIDENCE_STATUS_LABELS } from '../residents/components/ResidenceStatusBadge';

// Status colours: calm for settled residents, attention colours for the ones the head should follow up.
const STATUS_COLORS: Record<string, string> = {
  permanent: 'bg-primary',
  temporary: 'bg-warning',
  absent: 'bg-destructive',
  moved: 'bg-muted-foreground-400',
  unknown: 'bg-border',
};

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Overview: the numbers a ward head checks first, each one a shortcut to the matching list. */
export default function DashboardPage({ title }: { title: string }) {
  const { data: settings } = useSettings();
  const { data: stats } = useStats();

  return (
    <PageLayout title={title} meta={settings.ward_name ? `${settings.ward_code} · ${settings.ward_name}` : settings.ward_code}>
      {stats ? <Content stats={stats} /> : <Loading />}
    </PageLayout>
  );
}

function Content({ stats }: { stats: Stats }) {
  const { people, households, health_exam: examined } = stats;
  const examRate = percent(examined, people);
  const knownAge = stats.age.child + stats.age.adult + stats.age.senior;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi to="/residents" label={i18n.__('People', 'quan-li-dan-cu')} value={people.toLocaleString()}>
          {i18n.sprintf(
            /* translators: %s: number of households */
            i18n.__('in %s households', 'quan-li-dan-cu'),
            households.toLocaleString(),
          )}
        </Kpi>
        <Kpi
          label={i18n.__('Average household', 'quan-li-dan-cu')}
          value={households ? (people / households).toFixed(1) : '—'}
        >
          {i18n.__('people per household', 'quan-li-dan-cu')}
        </Kpi>
        <Kpi to="/residents?exam=no" label={i18n.__('Health exam 2026', 'quan-li-dan-cu')} value={`${examRate}%`}>
          <Bar value={examRate} className="mb-1.5" />
          {i18n.sprintf(
            /* translators: 1: people examined, 2: total people */
            i18n.__('%1$s of %2$s examined', 'quan-li-dan-cu'),
            examined.toLocaleString(),
            people.toLocaleString(),
          )}
        </Kpi>
        <Kpi
          to="/residents?phone=no"
          label={i18n.__('Missing phone number', 'quan-li-dan-cu')}
          value={stats.quality.no_phone.toLocaleString()}
          tone={stats.quality.no_phone ? 'warning' : undefined}
        >
          {i18n.__('people to call back for a number', 'quan-li-dan-cu')}
        </Kpi>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={i18n.__('Residence status', 'quan-li-dan-cu')}>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted-400" role="img" aria-label={i18n.__('Residence status', 'quan-li-dan-cu')}>
            {Object.entries(stats.residence).map(([status, count]) => (
              <div key={status} className={STATUS_COLORS[status]} style={{ width: `${percent(count, people)}%` }} />
            ))}
          </div>
          <ul className="m-0 grid list-none gap-1 p-0">
            {Object.entries(stats.residence).map(([status, count]) => (
              <li key={status}>
                <Link to={`/residents?status=${status}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground no-underline hover:bg-muted-400">
                  <span className={cn('size-2.5 rounded-full', STATUS_COLORS[status])} />
                  <span className="flex-1">{RESIDENCE_STATUS_LABELS[status as keyof typeof RESIDENCE_STATUS_LABELS]}</span>
                  <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{percent(count, people)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={i18n.__('Population', 'quan-li-dan-cu')}>
          <div className="grid gap-2.5">
            <BarRow label={i18n.__('Children (under 16)', 'quan-li-dan-cu')} value={stats.age.child} whole={knownAge} />
            <BarRow label={i18n.__('Working age (16–59)', 'quan-li-dan-cu')} value={stats.age.adult} whole={knownAge} />
            <BarRow label={i18n.__('Elderly (60 and over)', 'quan-li-dan-cu')} value={stats.age.senior} whole={knownAge} />
            {stats.age.unknown > 0 && (
              <p className="m-0 text-xs text-muted-foreground">
                {i18n.sprintf(
                  /* translators: %d: people without a year of birth */
                  i18n._n('%d person has no year of birth and is not counted above.', '%d people have no year of birth and are not counted above.', stats.age.unknown, 'quan-li-dan-cu'),
                  stats.age.unknown,
                )}
              </p>
            )}
          </div>
          <div className="grid gap-2.5 border-t pt-4">
            <BarRow label={i18n.__('Male', 'quan-li-dan-cu')} value={stats.gender.male} whole={people} />
            <BarRow label={i18n.__('Female', 'quan-li-dan-cu')} value={stats.gender.female} whole={people} />
            {stats.gender.unknown > 0 && (
              <BarRow label={i18n.__('Not recorded', 'quan-li-dan-cu')} value={stats.gender.unknown} whole={people} muted />
            )}
          </div>
        </Section>

        <Section title={i18n.__('Policy & support', 'quan-li-dan-cu')}>
          <CountList items={Object.entries(POLICY_LABELS).map(([key, label]) => [label, stats.policy[key] ?? 0])} />
          <div className="border-t pt-4">
            <CountList items={Object.entries(SUPPORT_LABELS).map(([key, label]) => [label, stats.support[key] ?? 0])} />
          </div>
        </Section>

        <Section title={i18n.__('Data to complete', 'quan-li-dan-cu')}>
          <Todo to="/residents?phone=no" label={i18n.__('No phone number', 'quan-li-dan-cu')} count={stats.quality.no_phone} />
          <Todo label={i18n.__('No year of birth', 'quan-li-dan-cu')} count={stats.quality.no_birth_year} />
          <Todo label={i18n.__('Documents not verified', 'quan-li-dan-cu')} count={stats.quality.unverified} />
          <Todo label={i18n.__('Documents expired', 'quan-li-dan-cu')} count={stats.quality.expired} />
        </Section>
      </div>

      {stats.recent.length > 0 && (
        <Section title={i18n.__('Recent activity', 'quan-li-dan-cu')}>
          <ul className="m-0 grid list-none gap-0 p-0">
            {stats.recent.map((entry, index) => (
              <li key={index} className="flex items-baseline gap-3 border-b py-2 text-sm last:border-b-0">
                <span className="flex-1">{describe(entry)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function Kpi({ to, label, value, tone, children }: { to?: string; label: string; value: string; tone?: 'warning'; children?: ReactNode }) {
  const body = (
    <>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className={cn('text-3xl leading-tight font-semibold tabular-nums', tone === 'warning' && 'text-warning')}>{value}</span>
      <span className="grid text-sm text-muted-foreground">{children}</span>
    </>
  );
  const classes = 'grid content-start gap-1 rounded-lg border bg-background p-4 text-foreground no-underline';
  return to ? (
    <Link to={to} className={cn(classes, 'transition-colors hover:border-primary')}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-4 rounded-lg border bg-background p-4">
      <h2 className="m-0 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Bar({ value, className, muted }: { value: number; className?: string; muted?: boolean }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-muted-400', className)}>
      <div className={cn('h-full rounded-full', muted ? 'bg-muted-foreground-400' : 'bg-primary')} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function BarRow({ label, value, whole, muted }: { label: string; value: number; whole: number; muted?: boolean }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums">
          <span className="font-medium">{value.toLocaleString()}</span>
          <span className="ms-2 text-xs text-muted-foreground">{percent(value, whole)}%</span>
        </span>
      </div>
      <Bar value={percent(value, whole)} muted={muted} />
    </div>
  );
}

function CountList({ items }: { items: Array<[string, number]> }) {
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0">
      {items.map(([label, count]) => (
        <li key={label} className={cn('flex items-center justify-between text-sm', !count && 'text-muted-foreground')}>
          <span>{label}</span>
          <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

/** One line of the "data to complete" list: a count to work down, or a tick when it is zero. */
function Todo({ to, label, count }: { to?: string; label: string; count: number }) {
  const row = (
    <>
      <span className="flex-1">{label}</span>
      {count === 0 ? (
        <CheckCircle2 className="size-4 text-success" aria-label={i18n.__('All good', 'quan-li-dan-cu')} />
      ) : (
        <span className="font-medium text-warning tabular-nums">{count.toLocaleString()}</span>
      )}
    </>
  );
  const classes = 'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground no-underline';
  return to && count > 0 ? (
    <Link to={to} className={cn(classes, 'hover:bg-muted-400')}>
      {row}
    </Link>
  ) : (
    <div className={classes}>{row}</div>
  );
}

function describe(entry: Stats['recent'][number]): string {
  const who = entry.user || i18n.__('Someone', 'quan-li-dan-cu');
  const person = entry.resident ?? i18n.__('a resident', 'quan-li-dan-cu');
  const sentence: Record<string, string> = {
    create: /* translators: 1: user, 2: resident name */ i18n.__('%1$s added %2$s', 'quan-li-dan-cu'),
    update: /* translators: 1: user, 2: resident name */ i18n.__('%1$s updated %2$s', 'quan-li-dan-cu'),
    delete: /* translators: 1: user, 2: resident name */ i18n.__('%1$s moved %2$s to the trash', 'quan-li-dan-cu'),
    untrash: /* translators: 1: user, 2: resident name */ i18n.__('%1$s restored %2$s from the trash', 'quan-li-dan-cu'),
    purge: /* translators: 1: user, 2: resident name */ i18n.__('%1$s permanently deleted %2$s', 'quan-li-dan-cu'),
    import: /* translators: 1: user */ i18n.__('%1$s imported residents', 'quan-li-dan-cu'),
    restore: /* translators: 1: user */ i18n.__('%1$s restored a backup', 'quan-li-dan-cu'),
  };
  return i18n.sprintf(sentence[entry.action] ?? '%1$s', who, person);
}

/** "5 minutes ago" from the server's UTC "Y-m-d H:i:s". */
function ago(utc: string): string {
  const seconds = Math.round((new Date(utc.replace(' ', 'T') + 'Z').getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(document.documentElement.lang || undefined, { numeric: 'auto' });
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'second');
}

function Loading() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
