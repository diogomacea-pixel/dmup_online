// ============================================================
// ESTADO GLOBAL
// ============================================================
let todosStreamers   = [];
let todosLogs        = [];
let todasMetricas    = [];
let periodoAdmin     = 'mes';
let dadosExcel       = [];
let graficoComp      = null;
let historicoImport  = []; // Para armazenar o histórico de importações localmente

// ============================================================
// LOGIN ADMIN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  carregarConfig(); // Carrega as configurações visuais (cores, logo)

  // Verifica se já está autenticado como admin
  const sessao = getSessao();
  if (sessao?.perfil === 'admin') {
    document.getElementById('loginAdminOverlay').style.display = 'none';
    inicializarAdmin();
  } else {
    // Se não for admin ou não tiver sessão, mostra a tela de login do admin
    document.getElementById('loginAdminOverlay').style.display = 'flex';
    // Aplica as configurações de logo na tela de login também
    const logoLogin = document.getElementById('logoImgLogin');
    if (logoLogin) {
      const config = JSON.parse(localStorage.getItem('config_visual') || '{}');
      if (config.logo_url) {
        logoLogin.src = config.logo_url;
        logoLogin.style.display = 'block';
      }
    }
  }
});

document.getElementById('formLoginAdmin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const senha = document.getElementById('senhaAdmin').value;
  const btn   = e.target.querySelector('button');

  btn.disabled    = true;
  btn.textContent = 'Verificando...';

  const res = await api('loginAdmin', { senha });

  btn.disabled    = false;
  btn.textContent = 'Entrar';

  if (res.status === 'ok') {
    salvarSessao(res.dados);
    document.getElementById('loginAdminOverlay').style.display = 'none';
    inicializarAdmin();
  } else {
    const err = document.getElementById('erroLoginAdmin');
    err.textContent = res.mensagem;
    err.classList.remove('oculto');
    setTimeout(() => err.classList.add('oculto'), 4000);
  }
});

async function inicializarAdmin() {
  mostrarLoading(true); // Ativa o overlay de carregamento
  await Promise.all([
    carregarStreamers(),
    carregarLogs(),
    carregarMetasAdmin()
  ]);
  await renderizarVisaoGeral(); // Renderiza a visão geral após carregar tudo
  mostrarLoading(false); // Desativa o overlay de carregamento
}

// ============================================================
// STREAMERS
// ============================================================
async function carregarStreamers() {
  const res = await api('getAllStreamers');
  if (res.status === 'ok') {
    todosStreamers = res.dados;
    renderizarGridStreamers(todosStreamers);
    popularSelectImportar();
  }
}

function renderizarGridStreamers(lista) {
  const grid = document.getElementById('gridStreamers');
  if (!lista.length) {
    grid.innerHTML = '<p style="color:#888;grid-column:1/-1">Nenhum streamer cadastrado.</p>';
    return;
  }

  grid.innerHTML = lista.map(s => `
    <div class="card-streamer" onclick="abrirModalStreamer('${s.ID}')">
      <div class="streamer-avatar">
        ${s.Nome?.charAt(0).toUpperCase() || '?'}
      </div>
      <div class="streamer-info">
        <strong>${s.Nome}</strong>
        <span>@${s.TikTok_Usuario}</span>
        <span style="font-size:0.78rem;color:#555;">${s.Telefone || ''}</span>
      </div>
      <div class="streamer-status">
        <span class="badge-status ${s.Ativo === 'ativo' ? 'ativo' : 'inativo'}">
          ${s.Ativo === 'ativo' ? '● Ativo' : '● Inativo'}
        </span>
        <span style="font-size:0.75rem;color:#555;margin-top:4px;">
          Desde ${formatarDataCurta(s.DataCadastro)}
        </span>
      </div>
    </div>`).join('');
}

function filtrarStreamers() {
  const busca = document.getElementById('buscaStreamer').value.toLowerCase();
  const filtrados = todosStreamers.filter(s =>
    s.Nome?.toLowerCase().includes(busca) ||
    s.TikTok_Usuario?.toLowerCase().includes(busca)
  );
  renderizarGridStreamers(filtrados);
}

function popularSelectImportar() {
  const sel = document.getElementById('streamerImportar');
  sel.innerHTML = '<option value="">Selecione o streamer...</option>' +
    todosStreamers.map(s =>
      `<option value="${s.ID}">${s.Nome} (@${s.TikTok_Usuario})</option>`
    ).join('');
}

// Modal detalhes streamer
async function abrirModalStreamer(id) {
  const s = todosStreamers.find(x => x.ID === id);
  if (!s) return;

  document.getElementById('modalNome').textContent = s.Nome;

  // Busca métricas do streamer
  const res = await api('getMetricas', { streamer_id: id });
  const registros = res.status === 'ok' ? res.dados.registros : [];
  const total = registros.length;
  const soma  = (c) => registros.reduce((a, r) => a + (parseFloat(r[c])||0), 0);

  document.getElementById('modalBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="campo">
        <label>Nome</label>
        <input type="text" value="${s.Nome}" id="editNome"/>
      </div>
      <div class="campo">
        <label>TikTok</label>
        <input type="text" value="${s.TikTok_Usuario}" id="editTiktok"/>
      </div>
      <div class="campo">
        <label>Telefone</label>
        <input type="text" value="${s.Telefone || ''}" id="editTelefone"/>
      </div>
      <div class="campo">
        <label>TikTok User ID</label>
        <input type="text" value="${s.TikTok_UserID || ''}" id="editUserID"
          placeholder="Número único do perfil"/>
      </div>
    </div>

    <div style="background:#1a1a1a;border-radius:8px;padding:16px;
                display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
      <div style="text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:#fff">${total}</div>
        <div style="font-size:0.78rem;color:#888">Lives realizadas</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:#78206E">
          💎 ${formatNum(soma('Diamantes'))}
        </div>
        <div style="font-size:0.78rem;color:#888">Total de diamantes</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:#13501B">
          ${formatNum(soma('NovosSeguidores'))}
        </div>
        <div style="font-size:0.78rem;color:#888">Novos seguidores</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button class="btn-danger" onclick="desativarStreamer('${id}')">
        🚫 Desativar conta
      </button>
      <button class="btn-primary" onclick="salvarEdicaoStreamer('${id}')"
        style="width:auto;padding:11px 24px;">
        💾 Salvar alterações
      </button>
    </div>`;

  document.getElementById('modalStreamer').classList.remove('oculto');
}

function fecharModal() {
  document.getElementById('modalStreamer').classList.add('oculto');
}

async function salvarEdicaoStreamer(id) {
  const payload = {
    id,
    nome:           document.getElementById('editNome').value,
    tiktok_usuario: document.getElementById('editTiktok').value.replace('@',''),
    telefone:       document.getElementById('editTelefone').value,
    tiktok_userid:  document.getElementById('editUserID').value
  };

  const res = await api('atualizarStreamer', payload);
  if (res.status === 'ok') {
    alert('Dados do streamer atualizados com sucesso!');
    fecharModal();
    carregarStreamers(); // Recarrega a lista para refletir as mudanças
  } else {
    alert('Erro ao atualizar dados do streamer: ' + res.mensagem);
  }
}

async function desativarStreamer(id) {
  if (!confirm('Tem certeza que deseja desativar este streamer? Ele não poderá mais acessar o dashboard.')) return;
  const res = await api('alterarStatusStreamer', { id, status: 'inativo' });
  if (res.status === 'ok') {
    alert('Streamer desativado com sucesso!');
    fecharModal();
    carregarStreamers(); // Recarrega a lista para refletir as mudanças
  } else {
    alert('Erro ao desativar streamer: ' + res.mensagem);
  }
}

// ============================================================
// IMPORTAÇÃO DE EXCEL
// ============================================================

// Mapeamento: coluna interna → possíveis nomes no Backstage
const MAPA_COLUNAS = {
  Data:                    ['data', 'date', 'dia'],
  HoraInicio:              ['hora inicio', 'start time', 'início', 'inicio'],
  HoraFim:                 ['hora fim', 'end time', 'fim'],
  DuracaoHoras:            ['duração', 'duracao', 'duration', 'horas'],
  TipoLive:                ['tipo', 'type', 'categoria'],
  Impressoes:              ['impressões', 'impressoes', 'impressions', 'views'],
  Espectadores:            ['espectadores', 'viewers', 'unique viewers'],
  PicoSimultaneo:          ['pico', 'peak', 'peak viewers', 'pico simultâneo'],
  ACU:                     ['acu', 'average concurrent', 'média simultânea'],
  MediaDuracaoEspectador:  ['tempo médio', 'avg watch time', 'duração média', 'watch time'],
  Comentarios:             ['comentários', 'comentarios', 'comments'],
  NovosSeguidores:         ['novos seguidores', 'new followers', 'seguidores'],
  Diamantes:               ['diamantes', 'diamonds', 'moedas'],
  DiamantesConvidados:     ['diamantes convidados', 'guest diamonds'],
  PessoasEnviaramPresentes:['pessoas presentes', 'gifters', 'gift senders'],
  TotalPresentes:          ['total presentes', 'total gifts', 'presentes'],
};

let mapeamentoAtual = {};
let colunasExcel    = [];

function preVisualizarExcel() {
  const arquivo = document.getElementById('arquivoExcel').files[0];
  if (!arquivo) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const workbook = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
      const sheet    = workbook.Sheets[workbook.SheetNames[0]];
      const json     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!json.length) {
        alert('O arquivo Excel está vazio ou não pôde ser lido.');
        limparImport();
        return;
      }

      dadosExcel    = json;
      colunasExcel  = Object.keys(json[0]);

      // Auto-mapeamento inteligente
      mapeamentoAtual = {};
      Object.entries(MAPA_COLUNAS).forEach(([campo, sinonimos]) => {
        const encontrada = colunasExcel.find(col =>
          sinonimos.some(s => col.toLowerCase().includes(s.toLowerCase()))
        );
        mapeamentoAtual[campo] = encontrada || '';
      });

      renderizarMapeamento();
      renderizarPreview(json.slice(0, 5));
      document.getElementById('btnImportar').disabled = false;
    } catch (error) {
      alert('Erro ao ler o arquivo Excel. Verifique se é um arquivo válido e tente novamente.');
      console.error('Erro na leitura do Excel:', error);
      limparImport();
    }
  };
  reader.readAsBinaryString(arquivo);
}

function renderizarMapeamento() {
  const grid = document.getElementById('gridMapeamento');
  grid.innerHTML = Object.keys(MAPA_COLUNAS).map(campo => `
    <div class="campo">
      <label>${campo}</label>
      <select onchange="mapeamentoAtual['${campo}'] = this.value"
        style="background:#1e1e1e;border:1px solid #2a2a2a;color:#e0e0e0;
               padding:8px 10px;border-radius:6px;font-size:0.82rem;width:100%;">
        <option value="">— não mapear —</option>
        ${colunasExcel.map(col =>
          `<option value="${col}" ${mapeamentoAtual[campo] === col ? 'selected' : ''}>
            ${col}
          </option>`
        ).join('')}
      </select>
    </div>`).join('');

  document.getElementById('mapeamentoColunas').style.display = 'grid'; // Alterado para grid
}

function renderizarPreview(linhas) {
  const tabela = document.getElementById('tabelaPreview');
  const colunas = Object.keys(linhas[0] || {}).slice(0, 8); // Limita a 8 colunas para o preview

  tabela.innerHTML = `
    <thead>
      <tr>${colunas.map(c => `<th>${c}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${linhas.map(l => `
        <tr>${colunas.map(c => `<td>${l[c] ?? ''}</td>`).join('')}</tr>
      `).join('')}
    </tbody>`;

  document.getElementById('previewImport').style.display = 'block';
}

async function importarDados() {
  const streamerId = document.getElementById('streamerImportar').value;
  if (!streamerId) {
    alert('Selecione um streamer antes de importar.');
    return;
  }

  const btn = document.getElementById('btnImportar');
  btn.disabled    = true;
  btn.textContent = '⏳ Importando...';

  // Converter usando mapeamento
  const dadosMapeados = dadosExcel.map(linha => {
    const obj = {};
    Object.entries(MAPA_COLUNAS).forEach(([campo, _]) => {
      const colOrigem = mapeamentoAtual[campo];
      let valor = colOrigem ? linha[colOrigem] ?? '' : '';

      // Tratamento específico para datas e horas
      if (campo === 'Data' && valor instanceof Date) {
        valor = valor.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      } else if ((campo === 'HoraInicio' || campo === 'HoraFim') && valor instanceof Date) {
        valor = valor.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); // Formato HH:MM
      }
      obj[campo] = valor;
    });
    return obj;
  });

  const res = await api('importarPlanilha', {
    streamer_id: streamerId,
    dados:       dadosMapeados
  });

  btn.disabled    = false;
  btn.textContent = '📤 Importar Dados';

  const el = document.getElementById('resultadoImport');
  el.classList.remove('oculto');

  if (res.status === 'ok') {
    const { importados, duplicados } = res.dados;
    el.className = 'msg-sucesso';
    el.textContent =
      `✅ Importados: ${importados} registros. Duplicatas ignoradas: ${duplicados}.`;

    // Adicionar ao histórico local
    const s = todosStreamers.find(x => x.ID === streamerId);
    historicoImport.unshift({
      dataHora:   new Date().toLocaleString('pt-BR'),
      nome:       s?.Nome || streamerId,
      importados,
      duplicados
    });
    renderizarHistoricoImport();
    // Recarregar dados para atualizar a visão geral e rankings
    await renderizarVisaoGeral();
  } else {
    el.className = 'msg-erro';
    el.textContent = `❌ Erro: ${res.mensagem}`;
  }
}

function renderizarHistoricoImport() {
  document.getElementById('corpoHistoricoImport').innerHTML =
    historicoImport.map(h => `
      <tr>
        <td>${h.dataHora}</td>
        <td>${h.nome}</td>
        <td style="color:#2ecc71;font-weight:600">${h.importados}</td>
        <td style="color:#888">${h.duplicados}</td>
      </tr>`).join('') ||
    '<tr><td colspan="4" style="text-align:center;color:#888;padding:24px;">Nenhuma importação.</td></tr>';
}

function limparImport() {
  dadosExcel   = [];
  colunasExcel = [];
  document.getElementById('arquivoExcel').value         = '';
  document.getElementById('mapeamentoColunas').style.display = 'none';
  document.getElementById('previewImport').style.display     = 'none';
  document.getElementById('resultadoImport').classList.add('oculto');
  document.getElementById('btnImportar').disabled             = true;
  document.getElementById('streamerImportar').value = ''; // Limpa o select também
}

// ============================================================
// LOGS
// ============================================================
async function carregarLogs() {
  const res = await api('getLogs');
  if (res.status === 'ok') {
    todosLogs = res.dados;
    renderizarLogs(todosLogs);
    renderizarResumoLogs(todosLogs);
  }
}

function filtrarLogs() {
  const busca = document.getElementById('buscaLog').value.toLowerCase();
  const data  = document.getElementById('filtroDataLog').value;

  const filtrados = todosLogs.filter(l => {
    const matchBusca = !busca ||
      l.TikTok_Usuario?.toLowerCase().includes(busca) ||
      todosStreamers.find(s => s.ID === l.Streamer_ID)?.Nome?.toLowerCase().includes(busca);
    const matchData  = !data ||
      l.DataHora?.toString().slice(0, 10) === data;
    return matchBusca && matchData;
  });

  renderizarLogs(filtrados);
}

function renderizarLogs(lista) {
  document.getElementById('totalLogs').textContent =
    `${lista.length} registro${lista.length !== 1 ? 's' : ''}`;

  const acaoLabel = {
    'login_dashboard': '🔑 Login',
    'logout':          '🚪 Logout',
    'importarPlanilha':'📥 Importação'
  };

  document.getElementById('corpoLogs').innerHTML = lista.length
    ? lista.map(l => `
        <tr>
          <td style="white-space:nowrap">${formatarDataHora(l.DataHora)}</td>
          <td>${l.TikTok_Usuario === 'admin' ? '👑 Admin' :
            todosStreamers.find(s => s.ID === l.Streamer_ID)?.Nome || l.Streamer_ID}</td>
          <td>${l.TikTok_Usuario !== 'admin' ? '@' + l.TikTok_Usuario : '—'}</td>
          <td>${acaoLabel[l.Acao] || l.Acao}</td>
          <td>${l.DuracaoSegundos > 0 ? formatarDuracao(l.DuracaoSegundos) : '—'}</td>
        </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#888;padding:24px;">Nenhum log encontrado.</td></tr>';
}

function renderizarResumoLogs(lista) {
  const hoje    = new Date().toISOString().slice(0, 10);
  const acessosHoje  = lista.filter(l =>
    l.DataHora?.toString().slice(0,10) === hoje && l.Acao === 'login_dashboard').length;
  const streamersUnicos = new Set(lista.filter(l => l.Streamer_ID !== 'admin').map(l => l.Streamer_ID)).size;
  const totalSessoes = lista.filter(l => l.Acao === 'login_dashboard').length;

  document.getElementById('gridResumoLogs').innerHTML = [
    { label:'Logins Hoje',        valor: acessosHoje,       icone:'📅', cor:'#13501B' },
    { label:'Streamers Logados',  valor: streamersUnicos,   icone:'👥', cor:'#C04F15' },
    { label:'Total de Logins',    valor: totalSessoes,      icone:'🔑', cor:'#78206E' },
  ].map(m => `
    <div class="card-metrica" style="--cor-acento:${m.cor}">
      <div class="label">${m.icone} ${m.label}</div>
      <div class="valor">${m.valor}</div>
    </div>`).join('');
}

// ============================================================
// VISÃO GERAL ADMIN
// ============================================================
function selecionarPeriodoAdmin(periodo, btn) {
  periodoAdmin = periodo;
  document.querySelectorAll('.seletor-periodo button')
    .forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  renderizarVisaoGeral();
}

async function renderizarVisaoGeral() {
  // Buscar todas as métricas de todos os streamers
  // Isso é feito uma vez e armazenado em 'todasMetricas'
  if (todasMetricas.length === 0 && todosStreamers.length > 0) {
    const promessas = todosStreamers.map(s =>
      api('getMetricas', { streamer_id: s.ID })
        .then(r => r.status === 'ok'
          ? r.dados.registros.map(m => ({ ...m, _streamer: s }))
          : [])
    );
    const resultados = await Promise.all(promessas);
    todasMetricas    = resultados.flat();
  }

  const filtradas  = filtrarPorPeriodo(todasMetricas);
  const soma = (c) => filtradas.reduce((a, r) => a + (parseFloat(r[c])||0), 0);

  // Cards resumo
  document.getElementById('gridResumoGeral').innerHTML = [
    { label:'Total de Diamantes',   valor: formatNum(soma('Diamantes')),       icone:'💎', cor:'#78206E' },
    { label:'Total de Espectadores',valor: formatNum(soma('Espectadores')),     icone:'👥', cor:'#13501B' },
    { label:'Total de Impressões',  valor: formatNum(soma('Impressoes')),       icone:'👁️', cor:'#C04F15' },
    { label:'Streamers Ativos',     valor: todosStreamers.filter(s => s.Ativo==='ativo').length, icone:'✅', cor:'#2980b9' },
    { label:'Total de Lives',       valor: filtradas.length,                   icone:'📹', cor:'#8e44ad' },
    { label:'Novos Seguidores',     valor: formatNum(soma('NovosSeguidores')), icone:'➕', cor:'#1abc9c' },
  ].map(m => `
    <div class="card-metrica" style="--cor-acento:${m.cor}">
      <div class="label">${m.icone} ${m.label}</div>
      <div class="valor">${m.valor}</div>
    </div>`).join('');

  renderizarRanking();
  renderizarGraficoComparativo(filtradas);
}

function renderizarRanking() {
  const campo    = document.getElementById('seletorRanking')?.value || 'Diamantes';
  const filtradas = filtrarPorPeriodo(todasMetricas);

  // Agrupar por streamer
  const porStreamer = {};
  filtradas.forEach(r => {
    const id = r._streamer?.ID;
    if (!porStreamer[id]) {
      porStreamer[id] = {
        streamer: r._streamer,
        lives:    0,
        dias:     new Set(),
        Diamantes: 0, Espectadores: 0, NovosSeguidores: 0, DuracaoHoras: 0
      };
    }
    porStreamer[id].lives++;
    porStreamer[id].dias.add(r.Data?.toString().slice(0,10));
    ['Diamantes','Espectadores','NovosSeguidores','DuracaoHoras'].forEach(c => {
      porStreamer[id][c] += parseFloat(r[c]) || 0;
    });
  });

  const lista = Object.values(porStreamer)
    .sort((a, b) => b[campo] - a[campo]);

  const medalhas = ['🥇','🥈','🥉'];

  document.getElementById('corpoRanking').innerHTML = lista.length
    ? lista.map((item, i) => {
        // Para calcular a meta de diamantes para o ranking, precisamos da meta global
        const metaDiamantesBase = 80000; // Valor padrão se não houver meta configurada
        const metaStreamer = item.Diamantes > 0
          ? Math.min(((item.Diamantes / metaDiamantesBase) * 100), 100).toFixed(0)
          : 0; // Simplificado para o ranking, pode ser mais complexo com metas individuais

        const statusMeta = metaStreamer >= 100 ? '✅ Meta batida'
          : metaStreamer >= 60 ? '⚠️ No caminho'
          : '❌ Abaixo da meta';

        return `<tr>
          <td style="font-size:1.2rem">${medalhas[i] || i + 1}</td>
          <td><strong>${item.streamer?.Nome}</strong></td>
          <td style="color:#888">@${item.streamer?.TikTok_Usuario}</td>
          <td>${item.lives}</td>
          <td>${item.dias.size}</td>
          <td style="color:#78206E;font-weight:600">💎 ${formatNum(item.Diamantes)}</td>
          <td>${formatNum(item.Espectadores)}</td>
          <td>${formatNum(item.NovosSeguidores)}</td>
          <td>${metaStreamer}%</td>
          <td>${statusMeta}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" style="text-align:center;color:#888;padding:24px;">Sem dados para o período.</td></tr>';
}

function renderizarGraficoComparativo(filtradas) {
  const porStreamer = {};
  filtradas.forEach(r => {
    const nome = r._streamer?.Nome || 'Desconhecido';
    porStreamer[nome] = (porStreamer[nome] || 0) + (parseFloat(r.Diamantes) || 0);
  });

  const labels = Object.keys(porStreamer);
  const values = Object.values(porStreamer);
  const cores  = ['#13501B','#C04F15','#78206E','#2980b9','#8e44ad',
                   '#1abc9c','#e67e22','#c0392b','#27ae60','#d35400'];

  const ctx = document.getElementById('graficoComparativo')?.getContext('2d');
  if (!ctx) return;
  if (graficoComp) graficoComp.destroy();

  graficoComp = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Diamantes',
        data:  values,
        backgroundColor: cores.slice(0, labels.length),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#e0e0e0' } } },
      scales: {
        x: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } }
      }
    }
  });
}

// ============================================================
// METAS ADMIN
// ============================================================
async function carregarMetasAdmin() {
  const res = await api('getMetas');
  if (res.status === 'ok') {
    const m = res.dados;
    document.getElementById('metaDias').value        = m.diasMes      || 22;
    document.getElementById('metaHoras').value       = m.horasDia     || 2;
    document.getElementById('metaCrescimento').value = m.crescimento  || 15;
    document.getElementById('metaMoedasNovo').value  = m.moedasNovo   || 80000;
  }
}

async function salvarMetas() {
  const payload = {
    diasMes:     document.getElementById('metaDias').value,
    horasDia:    document.getElementById('metaHoras').value,
    crescimento: document.getElementById('metaCrescimento').value,
    moedasNovo:  document.getElementById('metaMoedasNovo').value,
  };

  const res = await api('setMeta', payload);
  const el  = document.getElementById('msgMetas');
  el.classList.remove('oculto');

  if (res.status === 'ok') {
    el.className = 'msg-sucesso';
    el.textContent = '✅ Metas salvas com sucesso!';
  } else {
    el.className = 'msg-erro';
    el.textContent = '❌ Erro ao salvar metas.';
  }
  setTimeout(() => el.classList.add('oculto'), 3000);
}

// ============================================================
// CONFIGURAÇÕES VISUAIS
// ============================================================
async function carregarConfiguracoesIniciais() {
  const config = await api('getConfig');
  if (config.status === 'ok') {
    const c = config.dados;
    document.getElementById('corPrimaria').value    = c.cor_primaria   || CORES_PADRAO.cor_primaria;
    document.getElementById('corPrimariaHex').value = c.cor_primaria   || CORES_PADRAO.cor_primaria;
    document.getElementById('corSecundaria').value    = c.cor_secundaria || CORES_PADRAO.cor_secundaria;
    document.getElementById('corSecundariaHex').value = c.cor_secundaria || CORES_PADRAO.cor_secundaria;
    document.getElementById('corTerciaria').value    = c.cor_terciaria  || CORES_PADRAO.cor_terciaria;
    document.getElementById('corTerciariaHex').value = c.cor_terciaria  || CORES_PADRAO.cor_terciaria;
    document.getElementById('corFundo').value    = c.cor_fundo      || CORES_PADRAO.cor_fundo;
    document.getElementById('corFundoHex').value = c.cor_fundo      || CORES_PADRAO.cor_fundo;
    document.getElementById('logoUrl').value        = c.logo_url       || '';
    previewLogo(c.logo_url);
    aplicarConfig(c); // Aplica as cores carregadas
  }
}

function previewCor(variavel, valor) {
  document.documentElement.style.setProperty(variavel, valor);
  const mapa = {
    '--cor-primaria':   'corPrimariaHex',
    '--cor-secundaria': 'corSecundariaHex',
    '--cor-terciaria':  'corTerciariaHex',
    '--cor-fundo':      'corFundoHex',
  };
  const el = document.getElementById(mapa[variavel]);
  if (el) el.value = valor;
}

function sincronizarCor(inputColorId, valor) {
  const el = document.getElementById(inputColorId);
  if (el && /
^
#[0-9A-Fa-f]{6}
$
/.test(valor)) {
    el.value = valor;
    // Atualiza a cor no root para refletir a mudança
    const varName = '--' + inputColorId.replace('Hex', '').replace(/([A-Z])/g, '-$1').toLowerCase();
    document.documentElement.style.setProperty(varName, valor);
  }
}

function previewLogo(url) {
  const img  = document.getElementById('previewLogoImg');
  const sem  = document.getElementById('semLogo');
  if (url) {
    img.src              = url;
    img.style.display    = 'block';
    sem.style.display    = 'none';
  } else {
    img.style.display    = 'none';
    sem.style.display    = 'block';
  }
}

const CORES_PADRAO = {
  cor_primaria:   '#13501B',
  cor_secundaria: '#C04F15',
  cor_terciaria:  '#78206E',
  cor_fundo:      '#0a0a0a',
};

function resetarCores() {
  document.getElementById('corPrimaria').value    = CORES_PADRAO.cor_primaria;
  document.getElementById('corPrimariaHex').value = CORES_PADRAO.cor_primaria;
  document.getElementById('corSecundaria').value    = CORES_PADRAO.cor_secundaria;
  document.getElementById('corSecundariaHex').value = CORES_PADRAO.cor_secundaria;
  document.getElementById('corTerciaria').value    = CORES_PADRAO.cor_terciaria;
  document.getElementById('corTerciariaHex').value = CORES_PADRAO.cor_terciaria;
  document.getElementById('corFundo').value    = CORES_PADRAO.cor_fundo;
  document.getElementById('corFundoHex').value = CORES_PADRAO.cor_fundo;

  Object.entries(CORES_PADRAO).forEach(([k, v]) =>
    document.documentElement.style.setProperty('--' + k.replace('_','-'), v));
}

async function salvarConfiguracoes() {
  const config = {
    cor_primaria:   document.getElementById('corPrimaria').value,
    cor_secundaria: document.getElementById('corSecundaria').value,
    cor_terciaria:  document.getElementById('corTerciaria').value,
    cor_fundo:      document.getElementById('corFundo').value,
    logo_url:       document.getElementById('logoUrl').value,
  };

  const res = await api('setConfig', { config });
  const el  = document.getElementById('msgConfig');
  el.classList.remove('oculto');

  if (res.status === 'ok') {
    el.className = 'msg-sucesso';
    el.textContent = '✅ Configurações salvas! Os streamers verão as novas cores no próximo acesso.';
    localStorage.removeItem('config_visual'); // limpa cache para forçar recarregamento
    aplicarConfig(config); // Aplica as novas configurações imediatamente
  } else {
    el.className = 'msg-erro';
    el.textContent = '❌ Erro ao salvar configurações.';
  }
  setTimeout(() => el.classList.add('oculto'), 4000);
}

async function alterarSenhaAdmin() {
  const atual     = document.getElementById('senhaAtual').value;
  const nova      = document.getElementById('novaSenha').value;
  const confirmar = document.getElementById('confirmarSenha').value;
  const el        = document.getElementById('msgSenha');

  if (nova.length < 6) {
    el.className   = 'msg-erro';
    el.textContent = '❌ A nova senha deve ter no mínimo 6 caracteres.';
    el.classList.remove('oculto');
    return;
  }

  if (nova !== confirmar) {
    el.className   = 'msg-erro';
    el.textContent = '❌ As senhas não coincidem.';
    el.classList.remove('oculto');
    return;
  }

  const res = await api('alterarSenhaAdmin', { senhaAtual: atual, novaSenha: nova });
  el.classList.remove('oculto');

  if (res.status === 'ok') {
    el.className   = 'msg-sucesso';
    el.textContent = '✅ Senha alterada com sucesso!';
    ['senhaAtual','novaSenha','confirmarSenha'].forEach(id =>
      document.getElementById(id).value = '');
  } else {
    el.className   = 'msg-erro';
    el.textContent = '❌ ' + res.mensagem;
  }
  setTimeout(() => el.classList.add('oculto'), 4000);
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navegarPara(id, btn) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('ativo'));
  document.getElementById(id)?.classList.add('ativa');
  btn?.classList.add('ativo');

  // Carrega as configurações visuais quando a página de configurações é acessada
  if (id === 'configuracoes') {
    carregarConfiguracoesIniciais();
  }
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function filtrarPorPeriodo(registros) {
  const agora    = new Date();
  const anoMes   = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
  const anterior = (() => {
    const d = new Date(agora.getFullYear(), agora.getMonth()-1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  if (periodoAdmin === 'mes')
    return registros.filter(r => r.Data?.toString().slice(0,7) === anoMes);
  if (periodoAdmin === 'anterior')
    return registros.filter(r => r.Data?.toString().slice(0,7) === anterior);
  return registros;
}

function formatNum(v) {
  const n = parseFloat(v);
  if (!v || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}

function formatarDataCurta(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

function formatarDataHora(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR');
}

function formatarDuracao(segundos) {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  return min < 60 ? `${min}min` : `${Math.floor(min/60)}h ${min%60}min`;
}

function mostrarLoading(ativo) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = ativo ? 'flex' : 'none';
}