import path from 'node:path'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { agentDebugFileLog } from './vite-plugin-agent-debug-file'

const repoRoot = path.resolve(__dirname, '..')
const webDir = __dirname

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webDir, '')
  const apiProxyTarget =
    (env.VITE_DEV_API_PROXY_TARGET || '').trim() || 'http://127.0.0.1:8000'

  const apiProxy: ProxyOptions = {
    target: apiProxyTarget,
    changeOrigin: true,
    configure(proxy) {
      proxy.on('error', (err) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(
          `[vite] /api proxy → ${apiProxyTarget} failed:`,
          msg,
          '— start FastAPI (from web/: npm run dev:api or npm run dev:full).',
        )
      })
    },
  }

  return {
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    plugins: [tailwindcss(), react(), agentDebugFileLog(repoRoot)],
    server: {
      proxy: {
        '/api': apiProxy,
      },
    },
    preview: {
      proxy: {
        '/api': apiProxy,
      },
    },
  }
})
