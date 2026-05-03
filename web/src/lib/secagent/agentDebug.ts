// #region agent log
/** NDJSON debug (session 26f689): Cursor ingest + Vite dev POST /__debug/agent-log → repo .cursor/debug-26f689.log */
export function agentDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
): void {
  const body = JSON.stringify({
    sessionId: '26f689',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  })
  if (import.meta.env.DEV) {
    void fetch('http://127.0.0.1:7271/ingest/0ee9d05e-f11f-4641-be84-2d723dec8a93', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '26f689' },
      body,
    }).catch(() => {})
  }
  if (import.meta.env.DEV) {
    const logUrl =
      typeof window !== 'undefined'
        ? new URL('/__debug/agent-log', window.location.origin).href
        : '/__debug/agent-log'
    void fetch(logUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {})
    console.debug('[debug-26f689]', body)
  }
}
// #endregion
