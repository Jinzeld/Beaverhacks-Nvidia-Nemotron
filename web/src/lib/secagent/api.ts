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

export async function getHealth(): Promise<boolean> {
  try {
    const r = await fetch(url('/api/health'))
    return r.ok
  } catch {
    return false
  }
}

export async function postReview(goal: string, targetHost?: string): Promise<ApiReviewResponse> {
  const resp = await fetch(url('/api/review'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, target_host: targetHost || undefined }),
  })
  if (!resp.ok) throw new Error(await parseErrorBody(resp))
  return (await resp.json()) as ApiReviewResponse
}

export async function getReportMarkdown(): Promise<string> {
  const resp = await fetch(url('/api/report'))
  if (!resp.ok) throw new Error(await parseErrorBody(resp))
  const data = (await resp.json()) as { report_markdown?: string }
  return data.report_markdown ?? ''
}


export async function getTraceEvents(): Promise<unknown[]> {
  const resp = await fetch(url('/api/trace'))
  if (!resp.ok) throw new Error(await parseErrorBody(resp))
  const data = (await resp.json()) as { events?: unknown[] }
  return data.events ?? []
}
