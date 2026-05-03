import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

/** Split accidentally concatenated top-level JSON objects into separate lines. */
function splitNdjsonObjects(raw: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '{') {
      if (depth === 0) start = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        out.push(raw.slice(start, i + 1))
        start = -1
      }
    }
  }
  return out.length ? out : [raw]
}

/** Writes one NDJSON line per POST (Cursor debug session 26f689). Dev/preview only. */
export function agentDebugFileLog(repoRoot: string): Plugin {
  const logFile = path.join(repoRoot, '.cursor', 'debug-26f689.log')
  /** Workspace-visible copy (ignored by git via web/.gitignore *.log) when .cursor is missing from tooling. */
  const mirrorFile = path.join(repoRoot, 'web', 'debug-26f689.log')

  function attach(middlewares: Connect.Server) {
    const handler: Connect.NextHandleFunction = (req, res, next) => {
      const im = req as IncomingMessage
      const sr = res as ServerResponse
      if (im.method === 'OPTIONS') {
        sr.statusCode = 204
        sr.end()
        return
      }
      if (im.method !== 'POST') {
        next()
        return
      }
      const chunks: Buffer[] = []
      im.on('data', (c: Buffer) => chunks.push(c))
      im.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8').trim()
          if (raw) {
            const pieces = splitNdjsonObjects(raw)
            fs.mkdirSync(path.dirname(logFile), { recursive: true })
            try {
              fs.mkdirSync(path.dirname(mirrorFile), { recursive: true })
            } catch {
              /* ignore */
            }
            for (const piece of pieces) {
              const line = `${piece.trim()}\n`
              fs.appendFileSync(logFile, line, 'utf8')
              try {
                fs.appendFileSync(mirrorFile, line, 'utf8')
              } catch (mirrorErr) {
                console.warn('[agent-debug-file-log] mirror append failed:', mirrorErr)
              }
            }
          }
        } catch (err) {
          console.warn('[agent-debug-file-log] append failed:', err)
        }
        sr.statusCode = 204
        sr.end()
      })
    }
    middlewares.use('/__debug/agent-log', handler)
  }

  return {
    name: 'agent-debug-file-log',
    configureServer({ middlewares }) {
      attach(middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}
