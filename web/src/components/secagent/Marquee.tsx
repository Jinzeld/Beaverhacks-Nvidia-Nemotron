import { useState } from 'react'
import { cn } from '@/lib/utils'

const TEXT =
  'SECAGENT · READ-ONLY · HTTP SECURITY HEADERS · WILDCARD CORS · CONTROLLED INVENTORY · LAB DOTFILE · DIRECTORY LISTING · AGENT TRACE · NEMOTRON-3-NANO · MARKDOWN REPORT · BEAVERHACKS 2026 · SECAGENT · READ-ONLY · HTTP SECURITY HEADERS · WILDCARD CORS · CONTROLLED INVENTORY · LAB DOTFILE · DIRECTORY LISTING · AGENT TRACE · NEMOTRON-3-NANO · MARKDOWN REPORT · BEAVERHACKS 2026 · SECAGENT · READ-ONLY · HTTP SECURITY HEADERS · WILDCARD CORS · CONTROLLED INVENTORY · LAB DOTFILE · DIRECTORY LISTING · AGENT TRACE · NEMOTRON-3-NANO · MARKDOWN REPORT · BEAVERHACKS 2026 · '

export function Marquee() {
  const [pause, setPause] = useState(false)
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 overflow-hidden border-t border-border bg-bg/95 py-2 backdrop-blur-md"
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
    >
      <div
        className={cn('animate-marquee inline-block whitespace-nowrap font-mono text-[10px] text-muted', pause && '[animation-play-state:paused]')}
      >
        <span>
          {TEXT}
          {TEXT}
        </span>
      </div>
    </div>
  )
}
