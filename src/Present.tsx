import { useCallback, useEffect, useRef, useState } from "react"

// Presentation view (/#present): every submitted deck stitched into one
// continuous slideshow. Google Slides decks are fetched as PDF through
// /api/deck and drawn with pdf.js (loaded from CDN, no npm dependency).
// A deck that isn't public falls back to Google's embedded player, and
// non-Slides links fall back to an embed or an "open link" card.

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38"
const POLL_MS = 15000

type Project = { id: string; url: string; n: number }
type Deck = Project & {
  status: "loading" | "pdf" | "embed" | "link"
  pdf?: any
  pages: number
  embed?: string
}

let pdfjsPromise: Promise<any> | null = null
function pdfjs() {
  pdfjsPromise ??= import(/* @vite-ignore */ `${PDFJS}/pdf.min.mjs`).then((m) => {
    m.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`
    return m
  })
  return pdfjsPromise
}

function slidesId(url: string): string | null {
  return url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]{20,80})/)?.[1] ?? null
}

function embedFor(url: string): string | null {
  const sid = slidesId(url)
  if (sid) return `https://docs.google.com/presentation/d/${sid}/embed?start=false&loop=false`
  const canva = url.match(/(https:\/\/www\.canva\.com\/design\/[^/]+\/[^/?#]+)/)
  if (canva) return `${canva[1]}/view?embed`
  if (/figma\.com\/(proto|design|slides|deck)\//.test(url))
    return `https://www.figma.com/embed?embed_host=bus131&url=${encodeURIComponent(url)}`
  return null
}

async function loadDeck(p: Project): Promise<Deck> {
  const sid = slidesId(p.url)
  if (sid) {
    try {
      const lib = await pdfjs()
      const pdf = await lib.getDocument(`/api/deck?id=${sid}`).promise
      return { ...p, status: "pdf", pdf, pages: pdf.numPages }
    } catch {
      // not public; fall through to the embed
    }
  }
  const embed = embedFor(p.url)
  return embed ? { ...p, status: "embed", embed, pages: 1 } : { ...p, status: "link", pages: 1 }
}

export default function Present() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [pos, setPos] = useState({ d: 0, p: 0 })
  const [chrome, setChrome] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const known = useRef(new Set<string>())

  // Load the project list, then each deck, preserving submission order.
  const sync = useCallback(async () => {
    const res = await fetch("/api/state").catch(() => null)
    if (!res?.ok) return
    const { projects } = (await res.json()) as { projects: Project[] }
    const fresh = projects.filter((p) => !known.current.has(p.id))
    if (!fresh.length) return
    fresh.forEach((p) => known.current.add(p.id))
    setDecks((ds) => [...ds, ...fresh.map((p) => ({ ...p, status: "loading" as const, pages: 1 }))])
    for (const p of fresh) {
      loadDeck(p).then((deck) => setDecks((ds) => ds.map((d) => (d.id === deck.id ? deck : d))))
    }
  }, [])

  useEffect(() => {
    sync()
    const t = setInterval(sync, POLL_MS)
    return () => clearInterval(t)
  }, [sync])

  const deck = decks[pos.d]
  const total = decks.reduce((n, d) => n + d.pages, 0)
  const flat = decks.slice(0, pos.d).reduce((n, d) => n + d.pages, 0) + pos.p + 1

  const next = useCallback(() => {
    setPos(({ d, p }) => {
      if (p < (decks[d]?.pages ?? 1) - 1) return { d, p: p + 1 }
      return d < decks.length - 1 ? { d: d + 1, p: 0 } : { d, p }
    })
  }, [decks])

  const prev = useCallback(() => {
    setPos(({ d, p }) => {
      if (p > 0) return { d, p: p - 1 }
      return d > 0 ? { d: d - 1, p: (decks[d - 1]?.pages ?? 1) - 1 } : { d, p }
    })
  }, [decks])

  const jump = (d: number) => setPos({ d, p: 0 })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) (e.preventDefault(), next())
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) (e.preventDefault(), prev())
      else if (e.key === "f") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
      else if (e.key === "h") setChrome((c) => !c)
      else if (e.key === "Escape" && !document.fullscreenElement) location.hash = "ab-mocks"
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev])

  // Draw the current PDF page, sized to fit the stage at device resolution.
  useEffect(() => {
    if (deck?.status !== "pdf") return
    let task: any
    let cancelled = false
    const draw = async () => {
      const page = await deck.pdf.getPage(pos.p + 1)
      const stage = stageRef.current
      const canvas = canvasRef.current
      if (cancelled || !stage || !canvas) return
      const base = page.getViewport({ scale: 1 })
      const fit = Math.min(stage.clientWidth / base.width, stage.clientHeight / base.height)
      const dpr = window.devicePixelRatio || 1
      const vp = page.getViewport({ scale: fit * dpr })
      canvas.width = vp.width
      canvas.height = vp.height
      canvas.style.width = `${vp.width / dpr}px`
      canvas.style.height = `${vp.height / dpr}px`
      task?.cancel()
      task = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp })
      await task.promise.catch(() => {})
    }
    draw()
    window.addEventListener("resize", draw)
    return () => {
      cancelled = true
      task?.cancel()
      window.removeEventListener("resize", draw)
    }
  }, [deck, pos.p])

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      {chrome && (
        <header className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
          <a href="#ab-mocks" className="text-white/60 hover:text-white">
            ← Back to voting
          </a>
          <div className="flex min-w-0 gap-1 overflow-x-auto">
            {decks.map((d, i) => (
              <button
                key={d.id}
                onClick={() => jump(i)}
                className={`shrink-0 rounded-full px-3 py-1 font-mono text-xs ${
                  i === pos.d ? "bg-white text-black" : "text-white/60 hover:bg-white/10"
                }`}
              >
                {d.n}
              </button>
            ))}
          </div>
          <span className="shrink-0 font-mono text-xs text-white/60">
            {total ? `${flat} / ${total}` : ""}
          </span>
        </header>
      )}

      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        {!deck ? (
          <p className="text-white/60">Waiting for submissions…</p>
        ) : deck.status === "loading" ? (
          <p className="text-white/60">Loading Mock {deck.n}…</p>
        ) : deck.status === "pdf" ? (
          <canvas ref={canvasRef} className="shadow-2xl" />
        ) : deck.status === "embed" ? (
          <iframe
            key={deck.id}
            src={deck.embed}
            title={`Mock ${deck.n}`}
            allowFullScreen
            className="aspect-video max-h-full w-full max-w-[min(100%,calc((100vh-8rem)*16/9))] rounded bg-white"
          />
        ) : (
          <div className="text-center">
            <p className="text-5xl font-semibold tracking-tight">Mock {deck.n}</p>
            <p className="mt-3 text-white/60">This link can't be shown inline.</p>
            <a
              href={deck.url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block rounded-full bg-white px-5 py-2 font-medium text-black"
            >
              Open it ↗
            </a>
          </div>
        )}

        {/* Click zones: left third goes back, right two thirds go forward. Hidden over iframes so their own controls work. */}
        {deck?.status === "pdf" && (
          <>
            <button aria-label="Previous slide" onClick={prev} className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize" />
            <button aria-label="Next slide" onClick={next} className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize" />
          </>
        )}
      </div>

      {chrome && (
        <footer className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
          <span className="font-semibold">
            Mock {deck?.n ?? "–"}
            {deck?.status === "pdf" && (
              <span className="ml-2 font-mono text-xs font-normal text-white/60">
                slide {pos.p + 1} of {deck.pages}
              </span>
            )}
            {deck?.status === "embed" && (
              <span className="ml-2 font-mono text-xs font-normal text-white/60">
                not public, use the player's arrows, then → for the next mock
              </span>
            )}
          </span>
          <span className="hidden font-mono text-xs text-white/40 sm:inline">
            ← → navigate · F fullscreen · H hide bars · Esc exit
          </span>
          <span className="flex gap-2">
            <button onClick={prev} className="rounded-full border border-white/20 px-3 py-1 hover:border-white">←</button>
            <button onClick={next} className="rounded-full border border-white/20 px-3 py-1 hover:border-white">→</button>
          </span>
        </footer>
      )}
    </div>
  )
}
