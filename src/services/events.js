/**
 * ① Barramento de eventos em tempo real (SSE).
 * Mantém as conexões abertas (clientes EventSource) e transmite "sinais" de
 * mudança para o frontend recarregar a tela ativa sem F5. Os sinais NÃO
 * carregam dados sensíveis — só um tipo e, no máximo, um id.
 */

const clients = new Set()

/** Registra uma resposta HTTP como assinante do stream SSE. */
function addClient (res) {
  clients.add(res)
  res.on('close', () => clients.delete(res))
}

/** Transmite um sinal para todos os assinantes conectados. */
function broadcast (type, data = {}) {
  const payload = JSON.stringify({ type, ...data, ts: Date.now() })
  const frame = `data: ${payload}\n\n`
  for (const res of clients) {
    try { res.write(frame) } catch (_) { clients.delete(res) }
  }
}

/** Nº de conexões abertas (diagnóstico). */
function clientCount () { return clients.size }

module.exports = { addClient, broadcast, clientCount }
