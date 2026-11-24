// Cloudflare Worker for the live A/B mock vote.
//
// Static files in ./dist are served by Workers Assets; only /api/* reaches this
// code (see run_worker_first in wrangler.jsonc). All state lives in a single
// SQLite-backed Durable Object, which Cloudflare provisions on deploy.
//
// Submissions come from the Google Form response sheet, read as CSV. The sheet
// must be viewable by "anyone with the link". If it is not, the admin can paste
// links manually from the admin bar (/#admin).

type Env = {
  VOTE: any
  SHEET_ID: string
  SHEET_GID: string
  /** Optional secret. When unset, the first admin passcode entered is kept. */
  ADMIN_KEY?: string
}

type Project = { id: string; url: string; n: number; ts?: string }

const MAX_PICKS = 3
const SHEET_TTL_MS = 10_000

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 })

    // Presentation view: proxy a Google Slides deck as PDF (browsers can't
    // fetch it cross-origin). Only works for decks shared "Anyone with the link".
    if (url.pathname === "/api/deck") {
      const id = url.searchParams.get("id") ?? ""
      if (!/^[a-zA-Z0-9_-]{20,80}$/.test(id)) return new Response("Bad id", { status: 400 })
      const res = await fetch(`https://docs.google.com/presentation/d/${id}/export/pdf`, {
        cf: { cacheTtl: 60, cacheEverything: true },
      } as RequestInit)
      if (!res.ok || !res.headers.get("content-type")?.includes("pdf"))
        return new Response("Deck not public", { status: 403 })
      return new Response(res.body, {
        headers: { "content-type": "application/pdf", "cache-control": "public, max-age=60" },
      })
    }

    // Card thumbnail: first slide of a public Google Slides deck as PNG.
    if (url.pathname === "/api/thumb") {
      const id = url.searchParams.get("id") ?? ""
      if (!/^[a-zA-Z0-9_-]{20,80}$/.test(id)) return new Response("Bad id", { status: 400 })
      const res = await fetch(`https://docs.google.com/presentation/d/${id}/export/png`, {
        cf: { cacheTtl: 300, cacheEverything: true },
      } as RequestInit)
      if (!res.ok || !res.headers.get("content-type")?.startsWith("image/"))
        return new Response("No thumbnail", { status: 404 })
      return new Response(res.body, {
        headers: { "content-type": "image/png", "cache-control": "public, max-age=300" },
      })
    }

    const stub = env.VOTE.get(env.VOTE.idFromName("ab-mocks"))
    return stub.fetch(req)
  },
}

/** Minimal RFC 4180 CSV parser (handles quotes, commas and newlines in cells). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ",") row.push(cell), (cell = "")
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell), rows.push(row), (row = []), (cell = "")
    } else cell += c
  }
  if (cell || row.length) row.push(cell), rows.push(row)
  return rows
}

const URL_RE = /https?:\/\/[^\s,"'<>]+/g

/** Stable id for a link: strips the fragment, query noise and trailing slash. */
function normalize(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    u.hash = ""
    // Google Slides: collapse /edit?usp=sharing, /view, /present etc. to the deck.
    const deck = u.href.match(/^(https:\/\/docs\.google\.com\/presentation\/d\/[^/]+)/)
    if (deck) return deck[1]
    return u.href.replace(/\/$/, "")
  } catch {
    return null
  }
}

export class VoteRoom {
  state: any
  env: Env
  sheetCache: { at: number; rows: { url: string; ts?: string }[]; ok: boolean } | null = null

  constructor(state: any, env: Env) {
    this.state = state
    this.env = env
  }

  async sheetRows() {
    const now = Date.now()
    if (this.sheetCache && now - this.sheetCache.at < SHEET_TTL_MS) return this.sheetCache
    let rows: { url: string; ts?: string }[] = []
    let ok = false
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${this.env.SHEET_ID}/export?format=csv&gid=${this.env.SHEET_GID}`,
        { redirect: "follow" },
      )
      const text = await res.text()
      // A private sheet redirects to a Google sign-in HTML page.
      if (res.ok && !text.trimStart().startsWith("<")) {
        ok = true
        const [header = [], ...body] = parseCsv(text)
        const linkCol = header.findIndex((h) => /link|url/i.test(h))
        const tsCol = header.findIndex((h) => /timestamp/i.test(h))
        for (const r of body) {
          const cells = linkCol >= 0 ? [r[linkCol] ?? ""] : r
          for (const m of cells.join(" ").match(URL_RE) ?? []) {
            rows.push({ url: m, ts: tsCol >= 0 ? r[tsCol] : undefined })
          }
        }
      }
    } catch {
      // fall through with ok = false
    }
    // Keep the last good read if Google hiccups mid-class.
    if (!ok && this.sheetCache?.ok) return this.sheetCache
    this.sheetCache = { at: now, rows, ok }
    return this.sheetCache
  }

  async projects(): Promise<{ list: Project[]; sheetOk: boolean }> {
    const sheet = await this.sheetRows()
    const manual: string = (await this.state.storage.get("manual")) ?? ""
    const all = [...sheet.rows, ...(manual.match(URL_RE) ?? []).map((url) => ({ url, ts: undefined }))]
    const seen = new Set<string>()
    const list: Project[] = []
    for (const r of all) {
      const id = normalize(r.url)
      if (!id || seen.has(id)) continue
      seen.add(id)
      list.push({ id, url: r.url.trim(), n: list.length + 1, ts: r.ts })
    }
    return { list, sheetOk: sheet.ok }
  }

  async tally() {
    const ballots: Map<string, string[]> = await this.state.storage.list({ prefix: "ballot:" })
    const counts: Record<string, number> = {}
    for (const picks of ballots.values()) for (const id of picks) counts[id] = (counts[id] ?? 0) + 1
    return { counts, voters: ballots.size }
  }

  async isAdmin(key: unknown): Promise<boolean> {
    if (typeof key !== "string" || key.length < 4) return false
    const expected = this.env.ADMIN_KEY || (await this.state.storage.get("adminKey"))
    return !!expected && key === expected
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === "/api/state" && req.method === "GET") {
      const voter = url.searchParams.get("voter") ?? ""
      const admin = await this.isAdmin(req.headers.get("x-admin-key"))
      const revealed: boolean = (await this.state.storage.get("revealed")) ?? false
      const { list, sheetOk } = await this.projects()
      const { counts, voters } = await this.tally()
      const mine: string[] = voter ? ((await this.state.storage.get(`ballot:${voter}`)) ?? []) : []
      return json({
        projects: list,
        sheetOk,
        revealed,
        voters,
        mine,
        admin,
        adminClaimed: !!(this.env.ADMIN_KEY || (await this.state.storage.get("adminKey"))),
        manual: admin ? ((await this.state.storage.get("manual")) ?? "") : undefined,
        results: revealed || admin ? counts : null,
      })
    }

    if (req.method !== "POST") return json({ error: "Not found" }, 404)
    const body: any = await req.json().catch(() => ({}))

    if (path === "/api/vote") {
      const voter = String(body.voter ?? "")
      if (!/^[a-zA-Z0-9-]{8,64}$/.test(voter)) return json({ error: "Bad voter id" }, 400)
      const { list } = await this.projects()
      const valid = new Set(list.map((p) => p.id))
      const picks = [...new Set<string>(Array.isArray(body.picks) ? body.picks : [])]
        .filter((id) => valid.has(id))
        .slice(0, MAX_PICKS)
      if (picks.length) await this.state.storage.put(`ballot:${voter}`, picks)
      else await this.state.storage.delete(`ballot:${voter}`)
      return json({ mine: picks })
    }

    if (path === "/api/admin") {
      const key = body.key
      if (body.action === "claim") {
        if (this.env.ADMIN_KEY || (await this.state.storage.get("adminKey")))
          return json({ ok: await this.isAdmin(key) })
        if (typeof key !== "string" || key.length < 4) return json({ error: "Passcode too short" }, 400)
        await this.state.storage.put("adminKey", key)
        return json({ ok: true })
      }
      if (!(await this.isAdmin(key))) return json({ error: "Wrong passcode" }, 403)
      switch (body.action) {
        case "reveal":
          await this.state.storage.put("revealed", !!body.value)
          break
        case "manual":
          await this.state.storage.put("manual", String(body.value ?? ""))
          break
        case "reset": {
          const ballots: Map<string, unknown> = await this.state.storage.list({ prefix: "ballot:" })
          await this.state.storage.delete([...ballots.keys()])
          await this.state.storage.put("revealed", false)
          break
        }
        default:
          return json({ error: "Unknown action" }, 400)
      }
      return json({ ok: true })
    }

    return json({ error: "Not found" }, 404)
  }
}
