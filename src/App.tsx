import { useMemo, useState } from 'react';
import { ACTIVITIES, COURSE, type Activity, type Entry } from './data/showcase';

function EntryCard({ entry, fallbackTitle }: { entry: Entry; fallbackTitle: string }) {
  const label = entry.title ?? fallbackTitle;
  const host = entry.url ? new URL(entry.url).host : null;

  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium tracking-tight">{entry.student}</h3>
        {entry.url && (
          <span
            aria-hidden
            className="text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          >
            ↗
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-4 truncate font-mono text-xs text-[var(--muted)]">
        {host ?? entry.note ?? 'No link yet'}
      </p>
    </>
  );

  const base =
    'group block rounded-xl border border-[var(--line)] bg-[var(--card)] p-5 transition-colors';

  return entry.url
    ? (
      <a
        href={entry.url}
        target="_blank"
        rel="noreferrer"
        className={`${base} hover:border-[var(--fg)]`}
      >
        {inner}
      </a>
    )
    : <div className={`${base} opacity-55`}>{inner}</div>;
}

function Section({ activity }: { activity: Activity }) {
  return (
    <section id={activity.id} className="scroll-mt-24 border-t border-[var(--line)] pt-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          {activity.label}
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">{activity.title}</h2>
        <span className="font-mono text-xs text-[var(--muted)]">
          {activity.entries.length} project{activity.entries.length === 1 ? '' : 's'}
        </span>
      </div>
      {activity.blurb && <p className="mt-2 max-w-prose text-[var(--muted)]">{activity.blurb}</p>}

      {activity.entries.length === 0
        ? <p className="mt-8 text-sm text-[var(--muted)]">Nothing submitted yet.</p>
        : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activity.entries.map((entry, i) => (
              <EntryCard key={entry.url ?? i} entry={entry} fallbackTitle={activity.title} />
            ))}
          </div>
        )}
    </section>
  );
}

export default function App() {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIVITIES;
    return ACTIVITIES
      .map(a => ({
        ...a,
        entries: a.entries.filter(e =>
          `${e.student} ${e.title ?? ''} ${e.url ?? ''}`.toLowerCase().includes(q)
        ),
      }))
      .filter(a => a.entries.length > 0);
  }, [query]);

  const total = ACTIVITIES.reduce((n, a) => n + a.entries.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          {COURSE.code}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{COURSE.name}</h1>
        <p className="mt-4 max-w-prose text-lg text-[var(--muted)]">{COURSE.tagline}</p>

        <nav className="mt-8 flex flex-wrap gap-2">
          {ACTIVITIES.map(a => (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]"
            >
              {a.title}
            </a>
          ))}
        </nav>

        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${total} projects by name or title…`}
          className="mt-8 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--fg)]"
        />
      </header>

      <main className="mt-14 space-y-16">
        {sections.length === 0
          ? <p className="text-[var(--muted)]">No projects match “{query}”.</p>
          : sections.map(a => <Section key={a.id} activity={a} />)}
      </main>

      <footer className="mt-24 border-t border-[var(--line)] pt-6 font-mono text-xs text-[var(--muted)]">
        {COURSE.code} · Brandeis University
      </footer>
    </div>
  );
}
