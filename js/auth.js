// ============================================================
// CONFIGURAÇÃO — substitua pela URL do seu Apps Script
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbxcW98Cr5pTa-B5Cs17jYPzRR73N-88w3bGII3it1TK3Zuoki9WO_xrRl1ZmhzVhoSj/exec';

// ============================================================
// API
// ============================================================
async function api(acao, params = {}) {
  try {
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ acao, ...params })
    });
    return await res.json();
  } catch (err) {
    return { status: 'erro', mensagem: 'Erro de conexão. Tente novamente.' };
  }
}

// ============================================================
// SESSÃO
// ============================================================
function salvarSessao(dados) {
  localStorage.setItem('sessao', JSON.stringify({
    ...dados,
    loginEm:  new Date().toISOString(),
    expiraEm: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8h
  }));
}

function getSessao() {
  const raw = localStorage.getItem('sessao');
  if (!raw) return null;
  const sessao = JSON.parse(raw);
  if (new Date() > new Date(sessao.expiraEm)) {
    localStorage.removeItem('sessao');
    return null;
  }
  return sessao;
}

function exigirLogin() {
  const sessao = getSessao();
  if (!sessao || !sessao.id) {
    window.location.href = 'index.html';
    return null;
  }
  return sessao;
}

function exigirAdmin() {
  const sessao = getSessao();
  if (!sessao || sessao.perfil !== 'admin') {
    window.location.href = 'index.html';
    return null;
  }
  return sessao;
}

function logout() {
  localStorage.removeItem('sessao');
  window.location.href = 'index.html';
}

// ============================================================
// UI HELPERS
// ============================================================
function mostrarErro(msg) {
  const el = document.getElementById('msgErro');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('oculto');
  setTimeout(() => el.classList.add('oculto'), 5000);
}

function mostrarCarregando(ativo) {
  const btn = document.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled    = ativo;
  btn.textContent = ativo ? 'Aguarde...' : btn.dataset.label || 'Entrar';
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
}

// ============================================================
// CONFIG VISUAL (cores + logo dinâmicos)
// ============================================================
async function carregarConfig() {
  try {
    const cacheLocal = localStorage.getItem('config_visual');
    if (cacheLocal) {
      try {
        const cfg = JSON.parse(cacheLocal);
        aplicarConfig(cfg);
      } catch (e) {
        console.warn('Config local inválida, limpando cache.');
        localStorage.removeItem('config_visual');
      }
    }

    const res = await api('getConfig');

    if (!res || typeof res !== 'object') {
      console.warn('Resposta inválida de getConfig, mantendo apenas config local.');
      return;
    }

    if (res.status === 'ok') {
      aplicarConfig(res.dados);
      localStorage.setItem('config_visual', JSON.stringify(res.dados));
    } else {
      console.warn('Erro em getConfig:', res.mensagem);
    }
  } catch (e) {
    console.error('Erro em carregarConfig:', e);
  }
}

function aplicarConfig(config) {
  const r = document.documentElement.style;
  r.setProperty('--cor-primaria',   config.cor_primaria   || '#13501B');
  r.setProperty('--cor-secundaria', config.cor_secundaria || '#C04F15');
  r.setProperty('--cor-terciaria',  config.cor_terciaria  || '#78206E');
  r.setProperty('--cor-fundo',      config.cor_fundo      || '#0a0a0a');

  if (config.logo_url) {
    const logo = document.getElementById('logoImg');
    if (logo) { logo.src = config.logo_url; logo.style.display = 'block'; }
  }
}
