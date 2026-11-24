import { useCallback, useEffect, useState } from "react"

// Live A/B mock gallery + top-three vote. Data comes from /api/* (worker/index.ts).
// Results stay hidden until the admin reveals them. Admin bar: add #admin to the URL.

type Project = { id: string; url: string; n: number; ts?: string }
type State = {
  projects: Project[]
  sheetOk: boolean
  revealed: boolean
  voters: number
  mine: string[]
  admin: boolean
  adminClaimed: boolean
  manual?: string
  results: Record<string, number> | null
}

const MAX = 3
const POLL_MS = 8000

function store(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value)
    return localStorage.getItem(key)
  } catch {
    return value ?? null
  }
}

function voterId(): string {
  const existing = store("ab-voter")
  if (existing) return existing
  return store("ab-voter", crypto.randomUUID()) as string
}

function describe(url: string): { kind: string; host: string } {
  try {
    const u = new URL(url)
    if (u.host === "docs.google.com" && u.pathname.startsWith("/presentation"))
      return { kind: "Google Slides", host: u.host }
    if (u.host.endsWith("canva.com")) return { kind: "Canva", host: u.host }
    if (u.host.endsWith("figma.com")) return { kind: "Figma", host: u.host }
    return { kind: u.host.replace(/^www\./, ""), host: u.host }
  } catch {
    return { kind: "Link", host: "" }
  }
}

export default function AbVote() {
  const [voter] = useState(voterId)
  const [adminMode, setAdminMode] = useState(() => location.hash === "#admin" || !!store("ab-admin"))
  const [adminKey, setAdminKey] = useState(() => store("ab-admin") ?? "")
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?voter=${voter}`, {
        headers: adminKey ? { "x-admin-key": adminKey } : {},
      })
      if (!res.ok) throw new Error(String(res.status))
      setState(await res.json())
      setError(null)
    } catch {
      setError("Can't reach the voting server. Retrying…")
    }
  }, [voter, adminKey])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    const onHash = () => location.hash === "#admin" && setAdminMode(true)
    window.addEventListener("hashchange", onHash)
    return () => (clearInterval(t), window.removeEventListener("hashchange", onHash))
  }, [load])

  async function toggle(id: string) {
    if (!state) return
    const picks = state.mine.includes(id)
      ? state.mine.filter((p) => p !== id)
      : state.mine.length < MAX
        ? [...state.mine, id]
        : null
    if (!picks) return
    setState({ ...state, mine: picks })
    setSaving(true)
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voter, picks }),
      })
      const data = await res.json()
      setState((s) => (s ? { ...s, mine: data.mine } : s))
    } finally {
      setSaving(false)
    }
  }

  async function admin(action: string, value?: unknown) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: adminKey, action, value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.ok === false) alert(data.error ?? "Wrong passcode")
    await load()
  }

  const projects = state?.projects ?? []
  const results = state?.results
  const ranked = results
    ? [...projects].sort((a, b) => (results[b.id] ?? 0) - (results[a.id] ?? 0) || a.n - b.n)
    : []
  const maxVotes = Math.max(1, ...Object.values(results ?? {}))

  return (
    <section id="ab-mocks" className="scroll-mt-24 border-t border-[var(--line)] pt-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          Live · In class
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">A/B Mocks</h2>
        <span className="font-mono text-xs text-[var(--muted)]">
          {projects.length} submission{projects.length === 1 ? "" : "s"} · {state?.voters ?? 0} voted
        </span>
      </div>
      <p className="mt-2 max-w-prose text-[var(--muted)]">
        Click through each team's slides, then pick your top three. You can change your picks
        anytime until results are revealed.
      </p>

      {adminMode && (
        <AdminBar
          state={state}
          adminKey={adminKey}
          setAdminKey={(k) => (setAdminKey(k), store("ab-admin", k))}
          act={admin}
        />
      )}

      {error && <p className="mt-6 text-sm text-red-500">{error}</p>}
      {state && !state.sheetOk && projects.length === 0 && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Waiting for submissions. (Sheet not readable yet.)
        </p>
      )}
      {state?.sheetOk && projects.length === 0 && (
        <p className="mt-8 text-sm text-[var(--muted)]">Nothing submitted yet. This updates live.</p>
      )}

      {results && (
        <div className="mt-8 rounded-xl border border-[var(--fg)] bg-[var(--card)] p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Results</h3>
            <span className="font-mono text-xs text-[var(--muted)]">
              {state?.revealed ? "Revealed" : "Admin preview · hidden from class"}
            </span>
          </div>
          <ol className="mt-4 space-y-2">
            {ranked.map((p, i) => {
              const v = results[p.id] ?? 0
              return (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-right font-mono text-[var(--muted)]">{i + 1}</span>
                  <a href={p.url} target="_blank" rel="noreferrer" className="w-24 shrink-0 font-medium hover:underline">
                    Mock {p.n}
                  </a>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-[var(--bg)]">
                    <div
                      className="h-full rounded bg-[var(--fg)] transition-[width] duration-500"
                      style={{ width: `${(v / maxVotes) * 100}%`, opacity: i < 3 && v > 0 ? 1 : 0.35 }}
                    />
                  </div>
                  <span className="w-20 whitespace-nowrap text-right font-mono">{v} vote{v === 1 ? "" : "s"}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mt-8 grid gap-3 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const picked = state!.mine.includes(p.id)
            const full = !picked && state!.mine.length >= MAX
            const { kind, host } = describe(p.url)
            const hue = (p.n * 47) % 360
            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-[var(--card)] p-3 transition-colors ${
                  picked ? "border-[var(--fg)] ring-1 ring-[var(--fg)]" : "border-[var(--line)]"
                }`}
              >
                <a href={p.url} target="_blank" rel="noreferrer" className="group block">
                  <div
                    className="flex aspect-[8/5] flex-col justify-between rounded-lg p-4 transition-transform duration-300 group-hover:scale-[1.02]"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue} 42% 38%), hsl(${(hue + 40) % 360} 48% 26%))`,
                    }}
                  >
                    <span className="text-3xl font-semibold tracking-tight text-white/95">Mock {p.n}</span>
                    <span className="flex items-center justify-between font-mono text-[11px] text-white/70">
                      <span className="truncate">{kind}</span>
                      <span aria-hidden>Open ↗</span>
                    </span>
                  </div>
                </a>
                <div className="flex items-center justify-between gap-3 px-1 pt-3">
                  <span className="truncate font-mono text-xs text-[var(--muted)]">{host}</span>
                  <button
                    onClick={() => toggle(p.id)}
                    disabled={full}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      picked
                        ? "bg-[var(--fg)] text-[var(--bg)]"
                        : "border border-[var(--line)] hover:border-[var(--fg)]"
                    }`}
                  >
                    {picked ? `★ Pick #${state!.mine.indexOf(p.id) + 1}` : "Vote"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {projects.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3 text-sm sm:px-8">
            <span>
              Your top three: <strong>{state?.mine.length ?? 0}/{MAX}</strong>
              {state?.mine.length
                ? ` · ${state.mine
                    .map((id) => `Mock ${projects.find((p) => p.id === id)?.n ?? "?"}`)
                    .join(", ")}`
                : ""}
            </span>
            <span className="font-mono text-xs text-[var(--muted)]">
              {saving ? "Saving…" : state?.mine.length ? "Saved" : "Tap Vote on a card"}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

function AdminBar({
  state,
  adminKey,
  setAdminKey,
  act,
}: {
  state: State | null
  adminKey: string
  setAdminKey: (k: string) => void
  act: (action: string, value?: unknown) => Promise<void>
}) {
  const [draft, setDraft] = useState(adminKey)
  const [manual, setManual] = useState<string | null>(null)

  if (!state?.admin) {
    return (
      <form
        className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--line)] p-4 text-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!state?.adminClaimed) {
            await fetch("/api/admin", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ key: draft, action: "claim" }),
            })
          }
          setAdminKey(draft)
        }}
      >
        <span className="text-[var(--muted)]">
          {state?.adminClaimed ? "Admin passcode" : "Set an admin passcode (first time only)"}
        </span>
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 outline-none focus:border-[var(--fg)]"
        />
        <button className="rounded-full bg-[var(--fg)] px-4 py-1.5 font-medium text-[var(--bg)]">
          Unlock
        </button>
      </form>
    )
  }

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-dashed border-[var(--fg)] p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">Admin</span>
        <button
          onClick={() => act("reveal", !state.revealed)}
          className="rounded-full bg-[var(--fg)] px-4 py-1.5 font-medium text-[var(--bg)]"
        >
          {state.revealed ? "Hide results" : "Show results to everyone"}
        </button>
        <button
          onClick={() => setManual(manual === null ? (state.manual ?? "") : null)}
          className="rounded-full border border-[var(--line)] px-4 py-1.5 hover:border-[var(--fg)]"
        >
          {manual === null ? "Add links manually" : "Close"}
        </button>
        <button
          onClick={() => confirm("Delete all votes and hide results?") && act("reset")}
          className="rounded-full border border-[var(--line)] px-4 py-1.5 text-red-500 hover:border-red-500"
        >
          Reset votes
        </button>
        <span className="font-mono text-xs text-[var(--muted)]">
          Sheet: {state.sheetOk ? "connected" : "not readable (share as Anyone with the link)"}
        </span>
      </div>
      {manual !== null && (
        <div className="space-y-2">
          <textarea
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            rows={5}
            placeholder="Paste links, one per line. These are added after the sheet's links."
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 font-mono text-xs outline-none focus:border-[var(--fg)]"
          />
          <button
            onClick={() => act("manual", manual)}
            className="rounded-full bg-[var(--fg)] px-4 py-1.5 font-medium text-[var(--bg)]"
          >
            Save links
          </button>
        </div>
      )}
    </div>
  )
}
