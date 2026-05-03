#!/usr/bin/env node
/**
 * Non-blocking TCP check before Vite: if nothing listens, /api proxy returns 502.
 * Host/port default to 127.0.0.1:8000; override with VITE_DEV_API_PROXY_TARGET in web/.env.
 */
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function probeTargetFromEnvFile() {
  let host = process.env.VITE_DEV_API_PROBE_HOST || '127.0.0.1'
  let port = parseInt(process.env.VITE_DEV_API_PROBE_PORT || '8000', 10)
  const envFile = path.join(webRoot, '.env')
  if (!fs.existsSync(envFile)) return { host, port }
  const text = fs.readFileSync(envFile, 'utf8')
  for (const line of text.split(/\n/)) {
    const t = line.replace(/#.*/, '').trim()
    const m = t.match(/^VITE_DEV_API_PROXY_TARGET=(.*)$/)
    if (!m) continue
    const raw = m[1].trim().replace(/^["']|["']$/g, '')
    if (!raw) continue
    try {
      const u = new URL(raw.includes('://') ? raw : `http://${raw}`)
      host = u.hostname
      port = parseInt(u.port || '80', 10)
    } catch {
      /* keep previous */
    }
    break
  }
  return { host, port }
}

function portOpen(host, port, ms) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port })
    const done = (v) => {
      s.removeAllListeners()
      try {
        s.destroy()
      } catch {
        /* ignore */
      }
      resolve(v)
    }
    s.once('connect', () => done(true))
    s.once('error', () => done(false))
    s.setTimeout(ms, () => done(false))
  })
}

const { host, port } = probeTargetFromEnvFile()
const open = await portOpen(host, port, 600)
if (!open) {
  console.warn(
    `\n[web] Nothing is accepting TCP on ${host}:${port} (FastAPI / proxy target). ` +
      `/api will return 502 from Vite.\n` +
      `    Fix: npm run dev:api   or   npm run dev:full\n` +
      `    Or set VITE_DEV_API_PROXY_TARGET in web/.env if the API uses another host:port.\n`,
  )
}
