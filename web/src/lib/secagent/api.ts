import { agentDebugLog } from './agentDebug'
import type { ApiReviewResponse } from './mapApiToReport'

function apiBase(): string {
  const b = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (b === undefined || b === '') return ''
  return String(b).replace(/\/$/, '')
}

function url(path: string): string {
  const base = apiBase()
  if (!base) return path
  return `${base}${path}`
}

export async function parseErrorBody(resp: Response): Promise<string> {
  const text = await resp.text().catch(() => '')
  try {
    const j = JSON.parse(text) as { detail?: unknown }
    if (j.detail !== undefined) {
      return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    }
    return text || `HTTP ${resp.status}`
  } catch {
    return text || `HTTP ${resp.status}`
  }
}

/** Result of GET /api/health for UI messaging (e.g. 502 = proxy cannot reach FastAPI). */
export type ApiHealthResult =
  | { ok: true }
  | { ok: false; httpStatus?: number; fetchFailed: boolean; errMsg?: string }

export async function checkApiHealth(): Promise<ApiHealthResult> {
  const base = apiBase()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const resolvedUrl = url('/api/health')
  try {
    const r = await fetch(resolvedUrl)
    if (!r.ok) {
      // #region agent log
      agentDebugLog('B', 'api.ts:getHealth', 'GET /api/health response not ok', {
        healthy: false,
        httpStatus: r.status,
        apiBaseSet: Boolean(base),
        resolvedUrl,
        origin,
      })
      // #endregion
      return { ok: false, httpStatus: r.status, fetchFailed: false }
    }
    // #region agent log
    agentDebugLog('B', 'api.ts:getHealth', 'GET /api/health ok', {
      healthy: true,
      httpStatus: r.status,
      apiBaseSet: Boolean(base),
      origin,
    })
    // #endregion
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // #region agent log
    agentDebugLog('B', 'api.ts:getHealth', 'GET /api/health fetch threw', {
      healthy: false,
      errMsg: msg.slice(0, 160),
      apiBaseSet: Boolean(base),
      resolvedUrl,
      origin,
    })
    // #endregion
    return { ok: false, fetchFailed: true, errMsg: msg.slice(0, 200) }
  }
}

export async function postReview(goal: string): Promise<ApiReviewResponse> {
  const base = apiBase()
  let resp: Response
  try {
    resp = await fetch(url('/api/review'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    })
  } catch (e) {
    // #region agent log
    const msg = e instanceof Error ? e.message : String(e)
    agentDebugLog('C', 'api.ts:postReview', 'fetch threw', {
      errMsg: msg.slice(0, 200),
      apiBaseSet: Boolean(base),
      likelyNetwork: /fetch|network|Failed|load|CORS/i.test(msg),
    })
    // #endregion
    throw e
  }
  // #region agent log
  agentDebugLog('D', 'api.ts:postReview', 'POST /api/review response', {
    status: resp.status,
    ok: resp.ok,
    apiBaseSet: Boolean(base),
  })
  // #endregion
  if (!resp.ok) throw new Error(await parseErrorBody(resp))
  const json = (await resp.json()) as ApiReviewResponse & {
    findings?: unknown[]
    error?: unknown
  }
  // #region agent log
  agentDebugLog('E', 'api.ts:postReview', 'parsed review JSON', {
    findingsLen: Array.isArray(json.findings) ? json.findings.length : -1,
    hasError: json.error != null,
  })
  // #endregion
  return json
}

export async function getReportMarkdown(): Promise<string> {
  const resp = await fetch(url('/api/report'))
  if (!resp.ok) throw new Error(await parseErrorBody(resp))
  const data = (await resp.json()) as { report_markdown?: string }
  return data.report_markdown ?? ''
}
