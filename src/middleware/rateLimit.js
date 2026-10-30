// ═══════════════════════════════════════════════════════════════════════════
// Rate-limit de tentativas de login — proteção contra força bruta
// ═══════════════════════════════════════════════════════════════════════════
//
// Contexto (hardening, 30/10/2026): POST /api/auth/login não tinha trava de
// tentativas. Com a URL pública, dava pra testar senha indefinidamente. Este
// middleware conta SÓ as FALHAS (resposta 401) por IP numa janela deslizante e
// ZERA no sucesso (200) — então quem acerta a senha nunca é penalizado, e um
// bot que erra em série é bloqueado rápido (429).
//
// Sem dependência externa, in-memory. É um container único no Coolify, então
// um Map em memória basta; reinício de deploy zera os contadores (aceitável:
// o atacante também teria que recomeçar). Se um dia escalar para N instâncias
// ou quiser persistência, trocar por um store compartilhado (Redis).
//
// IP do cliente: com `app.set('trust proxy', 1)` no server.js, req.ip já é o IP
// REAL do cliente (o Express extrai do X-Forwarded-For confiando só no proxy do
// Coolify). NÃO ler o X-Forwarded-For na mão aqui: pegar o primeiro item da
// lista é spoofável (o atacante manda um XFF falso e burla o limite).

function clientIp (req) {
  return req.ip || req.connection?.remoteAddress || 'desconhecido'
}

/**
 * @param {object} opts
 * @param {number} opts.windowMs janela em ms (default 15 min)
 * @param {number} opts.maxFailures falhas permitidas na janela antes de bloquear (default 8)
 */
function loginRateLimit ({ windowMs = 15 * 60 * 1000, maxFailures = 8 } = {}) {
  // ip -> array de timestamps (ms) de falhas recentes
  const falhas = new Map()

  // Limpeza periódica para não crescer memória sem limite.
  const limpeza = setInterval(() => {
    const corte = Date.now() - windowMs
    for (const [ip, ts] of falhas) {
      const recentes = ts.filter(t => t > corte)
      if (recentes.length) falhas.set(ip, recentes)
      else falhas.delete(ip)
    }
  }, windowMs)
  if (limpeza.unref) limpeza.unref() // não segura o processo vivo

  return function (req, res, next) {
    const ip = clientIp(req)
    const corte = Date.now() - windowMs
    const recentes = (falhas.get(ip) || []).filter(t => t > corte)

    if (recentes.length >= maxFailures) {
      const esperaMs = recentes[0] + windowMs - Date.now()
      res.set('Retry-After', String(Math.ceil(esperaMs / 1000)))
      return res.status(429).json({
        error: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
      })
    }

    // Inspeciona o desfecho da tentativa depois da resposta: 401 = falha (conta),
    // 200 = sucesso (zera o IP). Qualquer outro status não mexe nos contadores.
    res.on('finish', () => {
      if (res.statusCode === 401) {
        const atuais = (falhas.get(ip) || []).filter(t => t > Date.now() - windowMs)
        atuais.push(Date.now())
        falhas.set(ip, atuais)
      } else if (res.statusCode === 200) {
        falhas.delete(ip)
      }
    })

    next()
  }
}

module.exports = { loginRateLimit }
