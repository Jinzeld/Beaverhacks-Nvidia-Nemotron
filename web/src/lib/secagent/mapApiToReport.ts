import type { ScanReportVM, SeverityUi, VulnerabilityVM } from './types'

/** Backend finding shape from POST /api/review */
export interface ApiFinding {
  finding_id: string
  title: string
  category: string
  severity: string
  evidence: string
  affected_target: string
  recommendation: string
  created_at?: string
}

export interface ApiReviewResponse {
  goal?: string
  target_url?: string
  findings?: ApiFinding[]
  error?: string | null
  [key: string]: unknown
}

/** Mirrors frontend/scan.js severityToUi (info/unknown → LOW). */
function severityToUi(sev: string | undefined): SeverityUi {
  const s = String(sev || 'low').toLowerCase()
  if (s === 'high') return 'HIGH'
  if (s === 'medium') return 'MEDIUM'
  if (s === 'low') return 'LOW'
  return 'LOW'
}

/** Mirrors frontend/scan.js riskScoreFromFindings. */
export function riskScoreFromFindings(findings: ApiFinding[]): number {
  if (!findings.length) return 0
  const rank: Record<string, number> = { low: 1, medium: 2, high: 3, info: 0 }
  let maxR = 0
  for (const f of findings) {
    const r = rank[String(f.severity || 'low').toLowerCase()] ?? 1
    if (r > maxR) maxR = r
  }
  const base = maxR === 3 ? 72 : maxR === 2 ? 48 : maxR === 1 ? 28 : 12
  return Math.min(95, base + Math.min(findings.length * 3, 18))
}

/**
 * Mirrors frontend/scan.js mapApiResponseToViewModel — single source for UI.
 */
export function mapApiToReport(apiJson: ApiReviewResponse): ScanReportVM {
  const findings = apiJson.findings ?? []
  const targetUrl = apiJson.target_url ?? ''
  const err = apiJson.error

  const vulnerabilities: VulnerabilityVM[] = findings.map((f) => {
    const cat = String(f.category || '').toLowerCase()
    const type =
      cat.includes('http') || String(f.title || '').toLowerCase().includes('header')
        ? 'EXPOSED_HEADER'
        : 'MISCONFIGURATION'
    const sevUi = severityToUi(f.severity)
    const desc = [f.title || '', f.evidence || ''].filter(Boolean).join('\n\n')
    return {
      id: f.finding_id || '',
      type,
      severity: sevUi,
      description: desc,
      impact: f.recommendation || '',
      endpoint: f.affected_target || '',
      vulnerable_code: f.evidence || '',
      fix: f.recommendation
        ? {
            explanation: f.recommendation,
            patched_code: '',
            additional_steps: [],
          }
        : undefined,
    }
  })

  const tips: string[] = []
  const seen = new Set<string>()
  for (const f of findings) {
    const r = f.recommendation
    if (r && !seen.has(r)) {
      seen.add(r)
      tips.push(r)
    }
  }

  let summary = `${findings.length} finding(s) from read-only header review.`
  if (err) summary = `Error: ${err}. ${summary}`
  if (apiJson.goal) summary += ` Goal: ${apiJson.goal}`

  const scannedAt = findings[0]?.created_at ?? new Date().toISOString()

  return {
    target: targetUrl,
    summary,
    risk_score: riskScoreFromFindings(findings),
    scanned_at: scannedAt,
    model_used: 'Nemotron VM Fix Agent (read-only API)',
    vulnerabilities,
    secure_coding_tips: tips.slice(0, 6),
  }
}
