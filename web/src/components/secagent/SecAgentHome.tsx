import { useCallback, useEffect, useRef, useState } from 'react'
import { agentDebugLog } from '@/lib/secagent/agentDebug'
import { checkApiHealth, postReview, type ApiHealthResult } from '@/lib/secagent/api'
import { buildReviewGoal, MODULES_DEFAULT, normalizeTarget } from '@/lib/secagent/constants'
import { mapApiToReport } from '@/lib/secagent/mapApiToReport'
import { buildMockResult } from '@/lib/secagent/mock'
import type { Phase, ScanReportVM } from '@/lib/secagent/types'
import { CapabilityGrid } from './CapabilityGrid'
import { Footer } from './Footer'
import { GridBackground } from './GridBackground'
import { Header } from './Header'
import { Hero } from './Hero'
import { Marquee } from './Marquee'
import { ScanForm } from './ScanForm'
import { ScanReport } from './ScanReport'
import { ScanTerminal } from './ScanTerminal'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const TERMINAL_CHIPS = [
  'resolving DNS',
  'TLS handshake',
  'HTTP security headers',
  'CORS policy',
  'content security policy',
  'recommendations',
]

const MOCK_LINES = [
  'resolving host…',
  'fetching response headers…',
  'evaluating CSP / XFO…',
  'checking Access-Control-Allow-Origin…',
  'aggregating findings…',
]

function toastForApiHealth(h: ApiHealthResult): string {
  if (h.ok) return ''
  if (h.fetchFailed) {
    const detail = h.errMsg ? ` (${h.errMsg.slice(0, 72)}${h.errMsg.length > 72 ? '…' : ''})` : ''
    const hint =
      /failed to fetch|networkerror|load failed|econnrefused|connection refused/i.test(
        h.errMsg || '',
      )
        ? ' Start FastAPI (npm run dev:api) and match VITE_API_BASE_URL port.'
        : ''
    return `Cannot reach API${detail}.${hint}`.replace(/\s+/g, ' ').trim()
  }
  if (h.httpStatus === 502) {
    return '502: Vite proxy could not reach the API (see VITE_DEV_API_PROXY_TARGET). Use npm run dev (starts API+Vite), or npm run dev:api in another terminal if you use npm run dev:vite.'
  }
  return `API health check failed (HTTP ${h.httpStatus ?? '?'}). Start FastAPI or adjust proxy / VITE_API_BASE_URL.`
}

export function SecAgentHome() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [target, setTarget] = useState('')
  const [report, setReport] = useState<ScanReportVM | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [chipIdx, setChipIdx] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const chipTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanningRef = useRef(false)

  useEffect(() => {
    return () => {
      if (chipTimer.current) clearInterval(chipTimer.current)
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  useEffect(() => {
    if (USE_MOCK) return
    let cancelled = false
    void checkApiHealth().then((h) => {
      if (cancelled || h.ok) return
      showToast(toastForApiHealth(h))
    })
    return () => {
      cancelled = true
    }
  }, [showToast])

  const pushLine = (s: string) => setLines((prev) => [...prev, s])

  const runMockFlow = async (note: string) => {
    for (const line of MOCK_LINES) {
      pushLine(line)
      setProgress((p) => Math.min(95, p + 12))
      await new Promise((r) => setTimeout(r, 380))
    }
    setProgress(100)
    setReport(buildMockResult(note))
    setPhase('done')
  }

  const runLiveFlow = async (note: string) => {
    const goal = buildReviewGoal(note, MODULES_DEFAULT)
    pushLine(`POST /api/review`)
    pushLine(`goal: ${goal.slice(0, 80)}…`)

    const progressTimer = setInterval(() => {
      setProgress((p) => (p >= 88 ? p : p + 2))
    }, 160)

    try {
      const api = await postReview(goal)
      clearInterval(progressTimer)
      setProgress(100)
      pushLine('response OK, mapping findings…')
      setReport(mapApiToReport(api))
      setPhase('done')
    } catch (e) {
      clearInterval(progressTimer)
      const msg = e instanceof Error ? e.message : 'Request failed'
      // #region agent log
      agentDebugLog('D', 'SecAgentHome:runLiveFlow:catch', 'live flow error', {
        errMsg: msg.slice(0, 200),
        likelyNetwork: /fetch|network|Failed|load|CORS/i.test(msg),
      })
      // #endregion
      pushLine(`error: ${msg}`)
      showToast(msg.length > 90 ? `${msg.slice(0, 90)}…` : msg)
      setPhase('idle')
      setProgress(0)
    }
  }

  const startScan = async () => {
    if (scanningRef.current) return
    scanningRef.current = true
    const raw = target.trim()
    if (!raw) {
      scanningRef.current = false
      showToast('Enter a URL or label first')
      return
    }
    if (!USE_MOCK) {
      const h = await checkApiHealth()
      if (!h.ok) {
        scanningRef.current = false
        showToast(toastForApiHealth(h))
        return
      }
    }
    const note = normalizeTarget(raw)
    // #region agent log
    if (!USE_MOCK) {
      agentDebugLog('A', 'SecAgentHome:startScan', 'live scan starting', {
        noteLen: note.length,
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      })
    }
    // #endregion

    setPhase('scanning')
    setLines([])
    setProgress(0)
    setReport(null)
    setChipIdx(0)

    if (
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      chipTimer.current = setInterval(() => {
        setChipIdx((i) => (i + 1) % TERMINAL_CHIPS.length)
      }, 1400)
    }

    try {
      if (USE_MOCK) await runMockFlow(note)
      else await runLiveFlow(note)
    } finally {
      if (chipTimer.current) {
        clearInterval(chipTimer.current)
        chipTimer.current = null
      }
      scanningRef.current = false
    }
  }

  const resetScan = () => {
    setPhase('idle')
    setReport(null)
    setLines([])
    setProgress(0)
  }

  return (
    <div className="relative min-h-screen pb-16">
      <GridBackground />
      <Header />
      <main className="relative">
        {phase !== 'done' && <Hero />}
        <ScanForm
          phase={phase}
          value={target}
          onChange={setTarget}
          onSubmit={startScan}
          disabled={phase === 'scanning' || phase === 'done'}
          useMock={USE_MOCK}
        />
        {phase === 'done' && (
          <div className="relative z-10 mx-auto max-w-3xl px-6 pb-6 text-center">
            <button
              type="button"
              onClick={resetScan}
              className="font-mono text-xs uppercase tracking-wider text-green underline-offset-4 hover:underline"
            >
              New scan
            </button>
          </div>
        )}
        <ScanTerminal
          visible={phase === 'scanning'}
          lines={lines}
          progress={progress}
          chip={TERMINAL_CHIPS[chipIdx] ?? ''}
        />
        {phase === 'done' && report && (
          <ScanReport report={report} useMock={USE_MOCK} onToast={showToast} />
        )}
        {phase !== 'done' && <CapabilityGrid />}
      </main>
      <Footer />
      <Marquee />
      {toast && (
        <div className="fixed bottom-20 right-6 z-[100] max-w-sm bg-green px-4 py-3 font-mono text-xs font-bold text-[#070808] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
