import type { ScanReportVM, SeverityUi, VulnerabilityVM } from './types'

/** Backend finding shape from POST /api/review (matches findings.py Finding.to_dict()) */
export interface ApiFinding {
  finding_id: string
  title: string
  category: string
  severity: string
  status?: string
  evidence: string
  affected_target: string
  recommendation: string
  remediation_type?: string
  created_at?: string
}

/** Backend recommendation_summary from recommender.py RecommendationSummary.to_dict() */
export interface ApiRecommendationSummary {
  total_findings: number
  highest_severity: string
  counts_by_severity: Record<string, number>
  priority_actions: string[]
  overall_summary: string
}

export interface ApiReviewResponse {
  goal?: string
  target_url?: string
  findings?: ApiFinding[]
  error?: string | null
  recommendation_summary?: ApiRecommendationSummary
  [key: string]: unknown
}

function severityToUi(sev: string | undefined): SeverityUi {
  switch (String(sev || 'low').toLowerCase()) {
    case 'critical': return 'CRITICAL'
    case 'high':     return 'HIGH'
    case 'medium':   return 'MEDIUM'
    case 'info':     return 'INFO'
    default:         return 'LOW'
  }
}

export function riskScoreFromFindings(findings: ApiFinding[]): number {
  if (!findings.length) return 0
  const rank: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 }
  let maxR = 0
  for (const f of findings) {
    const r = rank[String(f.severity || 'low').toLowerCase()] ?? 1
    if (r > maxR) maxR = r
  }
  const base = maxR === 4 ? 85 : maxR === 3 ? 72 : maxR === 2 ? 48 : maxR === 1 ? 28 : 12
  return Math.min(95, base + Math.min(findings.length * 3, 18))
}

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
    return {
      id: f.finding_id || '',
      type,
      severity: sevUi,
      description: f.title || '',
      impact: '',
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

  // Prefer backend-computed priority_actions (severity-sorted); fall back to deduped recommendations.
  const tips: string[] =
    apiJson.recommendation_summary?.priority_actions?.length
      ? apiJson.recommendation_summary.priority_actions
      : (() => {
          const seen = new Set<string>()
          const out: string[] = []
          for (const f of findings) {
            if (f.recommendation && !seen.has(f.recommendation)) {
              seen.add(f.recommendation)
              out.push(f.recommendation)
            }
          }
          return out
        })()

  // Prefer backend overall_summary; fall back to a derived line.
  const derivedSummary = `${findings.length} finding(s) from read-only header review.`
  let summary = apiJson.recommendation_summary?.overall_summary || derivedSummary
  if (err) summary = `Error: ${err}. ${summary}`

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
