import {
  Activity,
  AlertTriangle,
  Brain,
  FileText,
  FolderOpen,
  Globe,
  Server,
  Shield,
  Webhook,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULES_DEFAULT } from '@/lib/secagent/constants'

const DESC: Record<string, string> = {
  'HTTP Security Headers': 'CSP, XFO, HSTS, and baseline response header hygiene.',
  'Wildcard CORS': 'Access-Control-Allow-Origin posture and unsafe wildcard patterns.',
  'Controlled Service Inventory': 'Lab-scoped surface signals where tools are enabled.',
  'Exposed Lab Dotfile Check': 'Sensitive dotfiles and config leakage patterns in scope.',
  'Directory Listing Check': 'Path enumeration and indexing exposure signals.',
  'Agent Decision Trace': 'Structured JSONL trace of planner and tool steps.',
  'Nemotron Reasoning': 'Model-assisted interpretation of read-only findings.',
  'Markdown Report': 'Human-readable summary when report generation is available.',
}

const ICONS = [Shield, Webhook, Server, AlertTriangle, FolderOpen, Activity, Brain, FileText] as const

export function CapabilityGrid() {
  return (
    <section className="relative z-10 mx-auto max-w-5xl px-6 py-20">
      <h2 className="mb-3 text-center font-display text-3xl font-semibold text-text">
        Read-only detection modules
      </h2>
      <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-muted">
        Backend tools collect signals; nothing is modified on your systems. Outputs are findings,
        trace, and markdown when available.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES_DEFAULT.map((label, i) => {
          const Icon = ICONS[i] ?? Globe
          return (
            <div
              key={label}
              className={cn(
                'group rounded-lg border border-border bg-surface p-5 transition-all duration-300',
                'motion-safe:hover:-translate-y-1',
                'hover:border-green-bright/45 hover:shadow-[0_0_32px_rgba(118,237,75,0.22),0_0_1px_rgba(168,255,122,0.35)]',
              )}
            >
              <Icon className="mb-3 h-8 w-8 text-green opacity-80 group-hover:opacity-100" />
              <h3 className="font-display text-base font-medium leading-snug text-text">{label}</h3>
              <p className="mt-2 text-sm text-muted">{DESC[label] ?? ''}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
