// ============================================================
// ESTADO GLOBAL
// ============================================================
let sessao         = null;
let todosRegistros = [];
let registrosFiltrados = [];
let metas          = {};
let periodoAtual   = 'mes';
let graficoEvolucao = null;
let graficoDiamantes = null;

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  sessao = exigirLogin();
  if (!sessao) return;

  document.getElementById('nomeStreamer').textContent = sessao.nome;
  await carregarConfig();
  await carregarDados();
  preencherGlossario();
  registrarAcesso();
});

async function carregarDados() {
  mostrarLoading(true);

  const [resMetricas, resMetas] = await Promise.all([
    api('getMetricas', { streamer_id: sessao.id }),
    api('getMetas')
  ]);

  if (resMetricas.status === 'ok') {
    todosRegistros = resMetricas.dados.registros || [];
  }

  if (resMetas.status === 'ok') {
    metas = resMetas.dados;
  }

  aplicarPeriodo();
  renderizarMetas();
  renderizarTabelaLives(todosRegistros);
  mostrarLoading(false);
}

// ============================================================
// PERÍODO
// ============================================================
function selecionarPeriodo(periodo, btn) {
  periodoAtual = periodo;
  document.querySelectorAll('.seletor-periodo button')
    .forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  aplicarPeriodo();
}

function aplicarPeriodo() {
  const agora   = new Date();
  const anoMes  = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
  const anterior = (() => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  if (periodoAtual === 'mes') {
    registrosFiltrados = todosRegistros.filter(r => {
      const data = new Date(r.Data);
      return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}` === anoMes;
    });
    document.getElementById('subtituloGeral').textContent =
      `Dados de ${formatarMes(agora)}`;
  } else if (periodoAtual === 'anterior') {
    registrosFiltrados = todosRegistros.filter(r => {
      const data = new Date(r.Data);
      return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}` === anterior;
    });
    document.getElementById('subtituloGeral').textContent =
      `Dados do mês anterior`;
  } else {
    registrosFiltrados = [...todosRegistros];
    document.getElementById('subtituloGeral').textContent =
      `Todos os dados disponíveis`;
  }

  renderizarMetricasPrincipais();
  renderizarMetricasSecundarias();
  atualizarGrafico();
}

// ============================================================
// CARDS DE MÉTRICAS
// ============================================================
function renderizarMetricasPrincipais() {
  const r   = registrosFiltrados;
  const tot = r.length;

  if (tot === 0) {
    document.getElementById('gridMetricasPrincipais').innerHTML =
      '<p style="color:#888;grid-column:1/-1">Nenhum dado encontrado para este período.</p>';
    return;
  }

  const soma = (campo) => r.reduce((acc, x) => acc + (parseFloat(x[campo]) || 0), 0);
  const media = (campo) => tot ? soma(campo) / tot : 0;

  const diasUnicos = new Set(r.map(x => x.Data?.toString().slice(0,10))).size;
  const horasTotal = soma('DuracaoHoras');

  // Comparativo com mês anterior (para variação)
  const agora    = new Date();
  const anterior = todosRegistros.filter(x => {
    const d = new Date(x.Data);
    return d.getMonth() === agora.getMonth() - 1 &&
           d.getFullYear() === agora.getFullYear();
  });
  const somaAnt = (campo) => anterior.reduce((acc, x) => acc + (parseFloat(x[campo]) || 0), 0);
  const variacao = (atual, ant) => {
    if (!ant) return null;
    return (((atual - ant) / ant) * 100).toFixed(1);
  };

  const metricas = [
    {
      label:  'Total de Diamantes',
      valor:  formatNum(soma('Diamantes')),
      var:    variacao(soma('Diamantes'), somaAnt('Diamantes')),
      acento: 'var(--cor-terciaria)',
      icone:  '💎'
    },
    {
      label:  'Total de Espectadores',
      valor:  formatNum(soma('Espectadores')),
      var:    variacao(soma('Espectadores'), somaAnt('Espectadores')),
      acento: 'var(--cor-primaria)',
      icone:  '👥'
    },
    {
      label:  'Total de Impressões',
      valor:  formatNum(soma('Impressoes')),
      var:    variacao(soma('Impressoes'), somaAnt('Impressoes')),
      acento: 'var(--cor-secundaria)',
      icone:  '👁️'
    },
    {
      label:  'Dias de Live',
      valor:  diasUnicos,
      var:    null,
      acento: '#3498db',
      icone:  '📅'
    },
    {
      label:  'Horas Transmitidas',
      valor:  horasTotal.toFixed(1) + 'h',
      var:    null,
      acento: '#9b59b6',
      icone:  '⏱️'
    },
    {
      label:  'Novos Seguidores',
      valor:  formatNum(soma('NovosSeguidores')),
      var:    variacao(soma('NovosSeguidores'), somaAnt('NovosSeguidores')),
      acento: '#1abc9c',
      icone:  '➕'
    }
  ];

  document.getElementById('gridMetricasPrincipais').innerHTML =
    metricas.map(m => cardMetrica(m)).join('');
}

function renderizarMetricasSecundarias() {
  const r   = registrosFiltrados;
  const tot = r.length;
  if (!tot) { document.getElementById('gridMetricasSecundarias').innerHTML = ''; return; }

  const soma  = (c) => r.reduce((acc, x) => acc + (parseFloat(x[c]) || 0), 0);
  const media = (c) => (soma(c) / tot).toFixed(1);

  const metricas = [
    { label: 'Pico de Simultâneos',       valor: formatNum(Math.max(...r.map(x => parseFloat(x.PicoSimultaneo)||0))), acento:'#e67e22', icone:'🔥' },
    { label: 'ACU Médio',                  valor: parseFloat(media('ACU')).toFixed(0),         acento:'#2980b9', icone:'📡' },
    { label: 'Tempo Médio por Espectador', valor: media('MediaDuracaoEspectador') + ' min',     acento:'#27ae60', icone:'⏰' },
    { label: 'Total de Comentários',       valor: formatNum(soma('Comentarios')),               acento:'#8e44ad', icone:'💬' },
    { label: 'Presentes Enviados',         valor: formatNum(soma('TotalPresentes')),            acento:'#c0392b', icone:'🎁' },
    { label: 'Pessoas que Presentearam',   valor: formatNum(soma('PessoasEnviaramPresentes')), acento:'#d35400', icone:'🤝' },
    { label: 'Diamantes de Convidados',    valor: formatNum(soma('DiamantesConvidados')),       acento:'#16a085', icone:'🌟' },
    { label: 'Total de Lives',             valor: tot,                                          acento:'#7f8c8d', icone:'📹' }
  ];

  document.getElementById('gridMetricasSecundarias').innerHTML =
    metricas.map(m => cardMetrica(m)).join('');
}

function cardMetrica({ label, valor, var: variacao, acento, icone }) {
  const varHTML = variacao !== null && variacao !== undefined ? (() => {
    const cls  = variacao > 0 ? 'positiva' : variacao < 0 ? 'negativa' : 'neutra';
    const seta = variacao > 0 ? '▲' : variacao < 0 ? '▼' : '—';
    return `<div class="variacao ${cls}">${seta} ${Math.abs(variacao)}% vs mês anterior</div>`;
  })() : '';

  return `
    <div class="card-metrica" style="--cor-acento:${acento}">
      <div class="label">${icone} ${label}</div>
      <div class="valor">${valor}</div>
      ${varHTML}
    </div>`;
}

// ============================================================
// GRÁFICO DE EVOLUÇÃO
// ============================================================
function atualizarGrafico() {
  const campo  = document.getElementById('seletorGrafico')?.value || 'Espectadores';
  const dados  = registrosFiltrados
    .sort((a, b) => new Date(a.Data) - new Date(b.Data))
    .slice(-30); // últimas 30 lives

  const labels = dados.map(r => formatarData(r.Data));
  const values = dados.map(r => parseFloat(r[campo]) || 0);

  const ctx = document.getElementById('graficoEvolucao')?.getContext('2d');
  if (!ctx) return;

  if (graficoEvolucao) graficoEvolucao.destroy();

  graficoEvolucao = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: campo,
        data:  values,
        borderColor:     getComputedStyle(document.documentElement)
                           .getPropertyValue('--cor-primaria').trim() || '#13501B',
        backgroundColor: 'rgba(19,80,27,0.1)',
        borderWidth:     2,
        pointRadius:     4,
        pointHoverRadius:6,
        fill:            true,
        tension:         0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#e0e0e0' } }
      },
      scales: {
        x: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } },
        y: { ticks: { color: '#888' }, grid: { color: '#2a2a2a' } }
      }
    }
  });
}

// ============================================================
// METAS
// ============================================================
function renderizarMetas() {
  const agora   = new Date();
  const diasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();

  // Dados do mês atual
  const anoMes  = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
  const doMes   = todosRegistros.filter(r => {
    const d = new Date(r.Data);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === anoMes;
  });

  const diasAtivos  = new Set(doMes.map(r => r.Data?.toString().slice(0,10))).size;
  const horasTotal  = doMes.reduce((a, r) => a + (parseFloat(r.DuracaoHoras)||0), 0);
  const diamantes   = doMes.reduce((a, r) => a + (parseFloat(r.Diamantes)||0), 0);

  // Diamantes do mês anterior
  const anterior    = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const anoMesAnt   = `${anterior.getFullYear()}-${String(anterior.getMonth()+1).padStart(2,'0')}`;
  const doMesAnt    = todosRegistros.filter(r => {
    const d = new Date(r.Data);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === anoMesAnt;
  });
  const diamantesAnt = doMesAnt.reduce((a, r) => a + (parseFloat(r.Diamantes)||0), 0);

  // Meta de diamantes
  const ehNovo         = diamantesAnt === 0;
  const metaDiamantes  = ehNovo
    ? (metas.moedasNovo || 80000)
    : Math.round(diamantesAnt * (1 + (metas.crescimento || 15) / 100));

  // Meta horas (dias × horas/dia)
  const metaHorasTotal = (metas.diasMes || 22) * (metas.horasDia || 2);

  document.getElementById('subtituloMetas').textContent =
    `${formatarMes(agora)} — ${diasAtivos} de ${metas.diasMes || 22} dias realizados`;

  const itens = [
    {
      titulo:  '📅 Dias de Live no Mês',
      atual:   diasAtivos,
      meta:    metas.diasMes || 22,
      unidade: 'dias',
      detalhe: `Meta recomendada: ${metas.diasMes || 22} dias por mês`
    },
    {
      titulo:  '⏱️ Horas Transmitidas',
      atual:   parseFloat(horasTotal.toFixed(1)),
      meta:    metaHorasTotal,
      unidade: 'horas',
      detalhe: `${metas.horasDia || 2}h por dia × ${metas.diasMes || 22} dias`
    },
    {
      titulo:  ehNovo
        ? '💎 Diamantes (Meta Inicial)'
        : `💎 Diamantes (+${metas.crescimento || 15}% vs mês anterior)`,
      atual:   diamantes,
      meta:    metaDiamantes,
      unidade: 'diamantes',
      detalhe: ehNovo
        ? `Você é novo! Meta de estreia: ${formatNum(metaDiamantes)}`
        : `Mês anterior: ${formatNum(diamantesAnt)} → Meta: ${formatNum(metaDiamantes)}`
    }
  ];

  document.getElementById('gridMetas').innerHTML = itens.map(item => {
    const pct    = Math.min((item.atual / item.meta) * 100, 100).toFixed(1);
    const classe = pct >= 100 ? 'ok' : pct >= 60 ? 'alerta' : 'critico';
    const emoji  = pct >= 100 ? '✅' : pct >= 60 ? '⚠️' : '❌';

    return `
      <div class="card-meta">
        <div class="meta-titulo">${item.titulo}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:1.4rem;font-weight:700;color:#fff">${formatNum(item.atual)}</span>
          <span style="font-size:0.85rem;color:#888">meta: ${formatNum(item.meta)} ${item.unidade}</span>
        </div>
        <div class="barra-progresso">
          <div class="barra-preenchimento ${classe}" style="width:${pct}%"></div>
        </div>
        <div class="meta-valores">
          <span>${emoji} ${pct}% concluído</span>
          <span>${item.detalhe}</span>
        </div>
      </div>`;
  }).join('');

  renderizarGraficoDiamantes();
}

function renderizarGraficoDiamantes() {
  // Agrupar por mês
  const porMes = {};
  todosRegistros.forEach(r => {
    const d    = new Date(r.Data);
    const chave = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    porMes[chave] = (porMes[chave] || 0) + (parseFloat(r.Diamantes) || 0);
  });

  const mesesOrdenados = Object.keys(porMes).sort().slice(-6);
  const labels = mesesOrdenados.map(m => {
    const [ano, mes] = m.split('-');
    return new Date(ano, mes-1).toLocaleDateString('pt-BR', { month:'short', year:'2-digit' });
  });
  const values = mesesOrdenados.map(m => porMes[m]);

  const ctx = document.getElementById('graficoDiamantes')?.getContext('2d');
  if (!ctx) return;
  if (graficoDiamantes) graficoDiamantes.destroy();

  graficoDiamantes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:           'Diamantes',
        data:            values,
        backgroundColor: ['#78206E','#C04F15','#13501B','#2980b9','#8e44ad','#c0392b']
                           .slice(0, values.length),
        borderRadius:    6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color:'#e0e0e0' } } },
      scales: {
        x: { ticks: { color:'#888' }, grid: { color:'#2a2a2a' } },
        y: { ticks: { color:'#888' }, grid: { color:'#2a2a2a' } }
      }
    }
  });
}

// ============================================================
// TABELA DE LIVES
// ============================================================
function filtrarLives() {
  const filtro = document.getElementById('filtroMes')?.value;
  const dados  = filtro
    ? todosRegistros.filter(r => r.Data?.toString().slice(0,7) === filtro)
    : todosRegistros;
  renderizarTabelaLives(dados);
}

function renderizarTabelaLives(dados) {
  const sorted = [...dados].sort((a, b) => new Date(b.Data) - new Date(a.Data));
  document.getElementById('totalLivesFiltro').textContent =
    `${sorted.length} live${sorted.length !== 1 ? 's' : ''}`;

  if (!sorted.length) {
    document.getElementById('corpoTabelaLives').innerHTML =
      '<tr><td colspan="12" style="text-align:center;color:#888;padding:32px;">Nenhuma live encontrada.</td></tr>';
    return;
  }

  document.getElementById('corpoTabelaLives').innerHTML = sorted.map(r => `
    <tr>
      <td style="white-space:nowrap">${formatarData(r.Data)}</td>
      <td><span class="badge-tipo">${r.TipoLive || '—'}</span></td>
      <td>${r.DuracaoHoras ? parseFloat(r.DuracaoHoras).toFixed(1) + 'h' : '—'}</td>
      <td>${formatNum(r.Impressoes)}</td>
      <td>${formatNum(r.Espectadores)}</td>
      <td>${formatNum(r.PicoSimultaneo)}</td>
      <td>${formatNum(r.ACU)}</td>
      <td>${r.MediaDuracaoEspectador ? r.MediaDuracaoEspectador + ' min' : '—'}</td>
      <td>${formatNum(r.Comentarios)}</td>
      <td>${formatNum(r.NovosSeguidores)}</td>
      <td style="color:#78206E;font-weight:600">💎 ${formatNum(r.Diamantes)}</td>
      <td>${formatNum(r.TotalPresentes)}</td>
    </tr>`).join('');
}

// ============================================================
// GLOSSÁRIO (página Aprenda)
// ============================================================
const GLOSSARIO = [
  { termo:'Impressões',              icone:'👁️',  cor:'#C04F15',
    def:'Número total de pessoas que viram sua live aparecer no feed do TikTok, mesmo sem entrar.' },
  { termo:'Espectadores',            icone:'👥',  cor:'#13501B',
    def:'Número de pessoas que de fato clicaram e entraram na sua live.' },
  { termo:'Taxa de Conversão',       icone:'📊',  cor:'#78206E',
    def:'Percentual de pessoas que viram sua live no feed e decidiram entrar. Quanto maior, melhor seu título e thumbnail.' },
  { termo:'ACU',                     icone:'📡',  cor:'#2980b9',
    def:'Average Concurrent Users — média de pessoas assistindo ao mesmo tempo durante a live.' },
  { termo:'Pico de Simultâneos',     icone:'🔥',  cor:'#e74c3c',
    def:'O maior número de pessoas que esteve ao mesmo tempo na sua live.' },
  { termo:'Tempo Médio de Exibição', icone:'⏰',  cor:'#27ae60',
    def:'Quanto tempo em média cada espectador ficou na sua live. Quanto maior, mais engajante é seu conteúdo.' },
  { termo:'Diamantes',               icone:'💎',  cor:'#9b59b6',
    def:'Moedas virtuais que você recebe de presentes enviados pelos espectadores. Refletem diretamente sua monetização.' },
  { termo:'Diamantes de Convidados', icone:'🌟',  cor:'#16a085',
    def:'Diamantes ganhos por convidados que participaram da sua live. Indica o sucesso das suas co-lives.' },
  { termo:'Novos Seguidores',        icone:'➕',  cor:'#1abc9c',
    def:'Pessoas que decidiram seguir seu perfil durante ou após sua live. Indica que seu conteúdo gerou interesse.' },
  { termo:'Presentes Enviados',      icone:'🎁',  cor:'#d35400',
    def:'Total de itens de presente enviados pelos espectadores. Quanto mais, maior o engajamento emocional com seu conteúdo.' },
];

function preencherGlossario() {
  document.getElementById('gridGlossario').innerHTML = GLOSSARIO.map(g => `
    <div class="card-glossario" style="border-left-color:${g.cor}">
      <div class="glossario-header">
        <span class="glossario-icone" style="background:${g.cor}20;color:${g.cor}">${g.icone}</span>
        <strong>${g.termo}</strong>
      </div>
      <p>${g.def}</p>
    </div>`).join('');
}

// ============================================================
// LOGS
// ============================================================
async function registrarAcesso() {
  await api('registrarLog', {
    streamer_id:    sessao.id,
    tiktok_usuario: sessao.tiktok_usuario,
    acao:           'login_dashboard',
    duracao:        0
  });

  // Registrar logout ao sair
  window.addEventListener('beforeunload', () => {
    const inicio   = performance.now();
    const duracao  = Math.round((performance.now() - inicio) / 1000);
    navigator.sendBeacon(
      API_URL,
      JSON.stringify({
        acao:           'registrarLog',
        streamer_id:    sessao.id,
        tiktok_usuario: sessao.tiktok_usuario,
        acao_log:       'logout',
        duracao
      })
    );
  });
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navegarPara(id, btn) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('ativo'));
  document.getElementById(id)?.classList.add('ativa');
  btn?.classList.add('ativo');
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatNum(v) {
  const n = parseFloat(v);
  if (!v || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}

function formatarData(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function formatarMes(d) {
  return d.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
}

function mostrarLoading(ativo) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = ativo ? 'flex' : 'none';
}