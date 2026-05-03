import type { ScanReportVM } from './types'

export function buildMockResult(target: string): ScanReportVM {
  const ts = new Date().toISOString()
  return {
    target,
    summary:
      'Demo preview with sample findings. Set VITE_USE_MOCK=false and run the API for live results.',
    risk_score: 62,
    scanned_at: ts,
    model_used: 'SecAgent (mock)',
    vulnerabilities: [
      {
        id: 'VULN-001',
        type: 'EXPOSED_HEADER',
        severity: 'MEDIUM',
        cwe_id: 'CWE-693',
        endpoint: `https://${target}/`,
        description:
          'Content-Security-Policy header is missing; browsers rely on default permissive behavior.',
        impact: 'Increased XSS impact surface if injection exists elsewhere.',
        vulnerable_code:
          'Content-Security-Policy: (absent)\nX-Frame-Options: (absent)',
        fix: {
          patched_code:
            'add_header Content-Security-Policy "default-src \'self\'";\nadd_header X-Frame-Options "SAMEORIGIN";',
          explanation:
            'Add baseline CSP and clickjacking protection at the reverse proxy.',
          additional_steps: ['Reload nginx after validation.', 'Re-scan headers.'],
        },
      },
      {
        id: 'VULN-002',
        type: 'MISCONFIGURATION',
        severity: 'HIGH',
        cwe_id: 'CWE-942',
        cve_id: 'CVE-2024-0000',
        cvss: '7.4',
        endpoint: `https://${target}/api/`,
        description:
          'Access-Control-Allow-Origin allows wildcard for API responses.',
        impact:
          'Cross-origin data access from untrusted sites if credentials are involved.',
        vulnerable_code: 'Access-Control-Allow-Origin: *',
        fix: {
          patched_code: 'Access-Control-Allow-Origin: https://trusted.example',
          explanation: 'Restrict CORS to known origins; avoid * in production.',
          additional_steps: [],
        },
      },
    ],
    secure_coding_tips: [
      'Prefer deny-by-default CSP and iterate allowlists.',
      'Validate TLS and HSTS before exposing admin routes.',
    ],
  }
}
