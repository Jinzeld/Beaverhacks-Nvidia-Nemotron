export type SeverityUi = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export interface VulnFix {
  explanation: string
  patched_code: string
  additional_steps: string[]
}

export interface VulnerabilityVM {
  id: string
  type: string
  severity: SeverityUi
  description: string
  impact: string
  endpoint: string
  vulnerable_code: string
  cwe_id?: string
  cve_id?: string
  cvss?: string
  fix?: VulnFix
}

export interface ScanReportVM {
  target: string
  summary: string
  risk_score: number
  scanned_at: string
  model_used: string
  vulnerabilities: VulnerabilityVM[]
  secure_coding_tips: string[]
}

export type Phase = 'idle' | 'scanning' | 'done'
