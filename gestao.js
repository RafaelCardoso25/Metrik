// ═══════════════════════════════════════════════════════════════
//  METRIK — GESTÃO DE CLIENTES & CONTAS
//  Categorias (Clássico/Gold/Black), distribuição inteligente
//  entre contas (2 PJ + 1 PF) e gestão de custos por conta.
//  Depende de: script.js (normStr, fmt, parseBrNum, showToast,
//  MONTHS_PT), db/auth (_sb), empresas.js (_empresaAtiva, _modoTeste)
// ═══════════════════════════════════════════════════════════════

const G = {
  contas: [],
  clientes: [],
  lanc: [],        // todos os lançamentos (todas as chaves)
  despesas: [],
  cfg: null,
  mesAtivo: null,  // 'AAAA-MM'
  tab: 'painel',
  detalheId: null,
  filtros: { tier: 'all', conta: 'all', rec: 'all' },
  sort: { key: 'faturamento', dir: -1 },
  loadedFor: undefined, // empresa id (ou 'teste') dos dados carregados
  trendChart: null,
  telaAnterior: 'upload',
};

const G_CFG_PADRAO = () => ({
  custo_hora: 90,
  pf_custo_padrao: 0,
  tier_regras: {
    black: { margem: 75, faturamento: 7000, recorrente: true },
    gold: { margem: 70, recorrente: true },
  },
  imposto_faixas: [
    { ate: 60, pct: 6 },
    { ate: 85, pct: 9 },
    { ate: 100, pct: 13.5 },
    { ate: null, pct: 19 },
  ],
});

const G_TIER_LABEL = { Classico: 'Clássico', Gold: 'Gold', Black: 'Black' };
const G_TIER_COLOR = { Classico: 'var(--classic)', Gold: 'var(--gold)', Black: 'var(--graphite)' };
const G_TIER_ORDEM = { Classico: 0, Gold: 1, Black: 2 };

function gEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function gId() {
  return (crypto.randomUUID) ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
function gNum(v) { const n = +v; return isFinite(n) ? n : 0; }
function gChaveLabel(chave) {
  if (!chave) return '—';
  const [ano, mes] = chave.split('-');
  return MONTHS_PT[parseInt(mes) - 1] + ' ' + ano;
}
function gChaveHoje() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function gCli(id) { return G.clientes.find(c => c.id === id); }
function gConta(id) { return G.contas.find(c => c.id === id); }
function gLancsDoMes(chave) { return G.lanc.filter(l => l.chave === chave); }
function gLancDe(cliId, chave) { return G.lanc.find(l => l.cliente_id === cliId && l.chave === chave); }
function gDespesasDoMes(chave) { return G.despesas.filter(d => d.chave === chave); }
function gEmModoTeste() { return typeof _modoTeste !== 'undefined' && _modoTeste; }
// true quando nada deve ser salvo no banco (modo teste do Metrik ou demo da gestão)
function gSomenteLocal() { return gEmModoTeste() || G.demo; }
function gEmpresaId() { return (typeof _empresaAtiva !== 'undefined' && _empresaAtiva) ? _empresaAtiva.id : null; }

// ── cálculos por lançamento ──
function gLucroReal(l) { return gNum(l.faturamento) - gNum(l.custo) - gNum(l.horas) * gNum(G.cfg.custo_hora); }
function gMargem(l) {
  const f = gNum(l.faturamento);
  return f > 0 ? (f - gNum(l.custo)) / f * 100 : 0;
}

// ── categoria (tier) ──
function gTierSugerido(fat, custo, recorrencia) {
  const m = fat > 0 ? (fat - custo) / fat * 100 : 0;
  const r = G.cfg.tier_regras || G_CFG_PADRAO().tier_regras;
  const rec = recorrencia === 'Mensal';
  const b = r.black || {}, g = r.gold || {};
  if (m >= gNum(b.margem) && fat >= gNum(b.faturamento) && (!b.recorrente || rec)) return 'Black';
  if (m >= gNum(g.margem) && (!g.recorrente || rec)) return 'Gold';
  return 'Classico';
}
function gTierSugeridoCliente(cli, chave) {
  const l = gLancDe(cli.id, chave || G.mesAtivo);
  if (!l) return cli.tier || 'Classico';
  return gTierSugerido(gNum(l.faturamento), gNum(l.custo), cli.recorrencia);
}
function gTierEfetivo(cli, chave) {
  return cli.tier_modo === 'manual' ? (cli.tier || 'Classico') : gTierSugeridoCliente(cli, chave);
}
function gTierBadge(tier, modo) {
  const cls = tier === 'Black' ? 'gb-black' : tier === 'Gold' ? 'gb-gold' : 'gb-classic';
  const auto = modo === 'auto' ? ' <span class="gbadge-auto" title="Categoria calculada automaticamente">auto</span>' : '';
  return `<span class="gbadge ${cls}"><i></i>${G_TIER_LABEL[tier] || tier}</span>${auto}`;
}

// ── custos / imposto por conta ──
function gCustoMensalConta(contaId, chave) {
  const tot = gDespesasDoMes(chave).filter(d => d.conta_id === contaId)
    .reduce((s, d) => s + gNum(d.valor), 0);
  const conta = gConta(contaId);
  if (conta && conta.tipo === 'PF' && tot === 0) return gNum(G.cfg.pf_custo_padrao);
  return tot;
}
function gFaixaPct(usoPct) {
  const faixas = (G.cfg.imposto_faixas || []).slice()
    .sort((a, b) => (a.ate == null ? Infinity : a.ate) - (b.ate == null ? Infinity : b.ate));
  for (const f of faixas) {
    if (f.ate == null || usoPct <= gNum(f.ate)) return gNum(f.pct);
  }
  return faixas.length ? gNum(faixas[faixas.length - 1].pct) : 0;
}
function gImpostoConta(conta, total, chave) {
  // na PF a base tributável é o que passa do custo mensal (dedutível);
  // a faixa de alíquota acompanha a BASE (como no carnê-leão), não o faturamento bruto
  let base = total;
  if (conta.tipo === 'PF') base = Math.max(0, total - gCustoMensalConta(conta.id, chave));
  const pct = gFaixaPct(conta.teto > 0 ? base / conta.teto * 100 : 0);
  const uso = conta.teto > 0 ? total / conta.teto * 100 : 0; // ocupação do teto (exibição)
  return { pct, base, valor: base * pct / 100, uso };
}

// ═══════════════════════════════════════
//  DB — Supabase (pula tudo no modo teste)
// ═══════════════════════════════════════
async function gdbCarregar(empresaId) {
  const [contas, clientes, lanc, despesas, cfg] = await Promise.all([
    _sb.from('contas').select('*').eq('empresa_id', empresaId).order('ordem'),
    _sb.from('clientes_gestao').select('*').eq('empresa_id', empresaId).order('nome'),
    _sb.from('clientes_lancamentos').select('*').eq('empresa_id', empresaId),
    _sb.from('despesas_contas').select('*').eq('empresa_id', empresaId).order('data'),
    _sb.from('gestao_cfg').select('*').eq('empresa_id', empresaId).maybeSingle(),
  ]);
  const erro = contas.error || clientes.error || lanc.error || despesas.error || cfg.error;
  if (erro) throw erro;
  G.contas = contas.data || [];
  G.clientes = clientes.data || [];
  G.lanc = lanc.data || [];
  G.despesas = despesas.data || [];
  G.cfg = cfg.data ? {
    custo_hora: gNum(cfg.data.custo_hora),
    pf_custo_padrao: gNum(cfg.data.pf_custo_padrao),
    tier_regras: cfg.data.tier_regras || G_CFG_PADRAO().tier_regras,
    imposto_faixas: cfg.data.imposto_faixas || G_CFG_PADRAO().imposto_faixas,
  } : G_CFG_PADRAO();
}

async function gdbUpsert(tabela, registro) {
  if (gSomenteLocal()) return;
  const { error } = await _sb.from(tabela).upsert(registro);
  if (error) { console.error('Erro ao salvar em ' + tabela, error); showToast('Erro ao salvar (' + tabela + ').', true); }
}
async function gdbDelete(tabela, id) {
  if (gSomenteLocal()) return;
  const { error } = await _sb.from(tabela).delete().eq('id', id);
  if (error) { console.error('Erro ao excluir de ' + tabela, error); showToast('Erro ao excluir.', true); }
}
async function gdbSalvarCfg() {
  if (gSomenteLocal()) return;
  const empresaId = gEmpresaId(); if (!empresaId) return;
  const { error } = await _sb.from('gestao_cfg').upsert({
    empresa_id: empresaId,
    custo_hora: gNum(G.cfg.custo_hora),
    pf_custo_padrao: gNum(G.cfg.pf_custo_padrao),
    tier_regras: G.cfg.tier_regras,
    imposto_faixas: G.cfg.imposto_faixas,
    atualizado_em: new Date().toISOString(),
  });
  if (error) { console.error('Erro ao salvar config', error); showToast('Erro ao salvar configurações.', true); }
}

// contas padrão da primeira vez: 2 PJ + 1 PF
async function gCriarContasPadrao() {
  const empresaId = gEmpresaId();
  const padrao = [
    { nome: 'Empresa 1 (PJ)', tipo: 'PJ', teto: 40000, ordem: 0 },
    { nome: 'Empresa 2 (PJ)', tipo: 'PJ', teto: 40000, ordem: 1 },
    { nome: 'Pessoa Física', tipo: 'PF', teto: 23000, ordem: 2 },
  ];
  for (const p of padrao) {
    const conta = { id: gId(), empresa_id: empresaId, ...p };
    G.contas.push(conta);
    await gdbUpsert('contas', conta);
  }
}

// ═══════════════════════════════════════
//  ABRIR / FECHAR / NAVEGAÇÃO
// ═══════════════════════════════════════
async function abrirGestao() {
  const alvo = gEmModoTeste() ? 'teste' : gEmpresaId();
  if (!alvo) { showToast('Entre em uma empresa primeiro.', true); return; }

  G.telaAnterior = (document.getElementById('dashboard').style.display === 'block') ? 'dashboard' : 'upload';

  if (G.loadedFor !== alvo) {
    document.getElementById('loadingDadosWrap').style.display = 'flex';
    try {
      if (alvo === 'teste') {
        G.contas = []; G.clientes = []; G.lanc = []; G.despesas = [];
        G.cfg = G_CFG_PADRAO();
        gGerarDadosTeste();
      } else {
        await gdbCarregar(alvo);
        if (!G.contas.length) await gCriarContasPadrao();
      }
      G.loadedFor = alvo;
      G.mesAtivo = gMesesDisponiveis().slice(-1)[0] || gChaveHoje();
    } catch (err) {
      console.error('Erro ao carregar gestão:', err);
      document.getElementById('loadingDadosWrap').style.display = 'none';
      showToast('Erro ao carregar o módulo de gestão. Rode o gestao.sql no Supabase.', true);
      return;
    }
    document.getElementById('loadingDadosWrap').style.display = 'none';
  }

  document.getElementById('uploadScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('gestaoScreen').style.display = 'block';
  gShowTab(G.tab || 'painel');
  gRenderAll();
  window.scrollTo(0, 0);
}

function voltarDoGestao() {
  document.getElementById('gestaoScreen').style.display = 'none';
  if (G.telaAnterior === 'dashboard') {
    document.getElementById('dashboard').style.display = 'block';
  } else {
    document.getElementById('uploadScreen').style.display = 'flex';
  }
}

function gShowTab(id) {
  G.tab = id;
  document.querySelectorAll('.gtab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.gntab').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('gtab-' + id);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`.gntab[data-gtab="${id === 'detalhe' ? 'clientes' : id}"]`);
  if (btn) btn.classList.add('active');
  gRenderTab();
}

// ── meses ──
function gMesesDisponiveis() {
  const keys = new Set();
  G.lanc.forEach(l => keys.add(l.chave));
  G.despesas.forEach(d => keys.add(d.chave));
  return [...keys].sort();
}
function gSetMes(chave) {
  G.mesAtivo = chave;
  gRenderAll();
}
function gRenderMeses() {
  const meses = gMesesDisponiveis();
  const wrap = document.getElementById('gMonthTabs');
  const demoBadge = G.demo ? `
    <span style="display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;
      color:var(--gold);background:color-mix(in srgb,var(--gold) 10%,transparent);
      border:1px solid color-mix(in srgb,var(--gold) 30%,transparent);border-radius:10px;padding:7px 13px">
      🎲 Dados fictícios — nada é salvo
      <button onclick="gSairDemo()" style="background:none;border:none;color:var(--gold);cursor:pointer;
        font-weight:700;font-size:12px;text-decoration:underline;padding:0">sair</button>
    </span>` : '';
  if (!meses.length) {
    wrap.innerHTML = `<span style="font-size:12px;color:var(--muted);align-self:center">Nenhum mês com dados ainda — importe uma planilha, cadastre um cliente ou</span>
      <button class="gmonth-chip" onclick="gAtivarDemo()">🎲 Testar com dados fictícios</button>`;
  } else {
    wrap.innerHTML = meses.map(m =>
      `<button class="gmonth-chip ${m === G.mesAtivo ? 'active' : ''}" onclick="gSetMes('${m}')">${gChaveLabel(m)}</button>`
    ).join('') + demoBadge;
  }
  document.getElementById('gPeriodBadge').textContent = '🗓 ' + gChaveLabel(G.mesAtivo);
}

// ── modo demo: dados fictícios em memória, sem tocar no banco ──
function gAtivarDemo() {
  G._backup = {
    contas: G.contas, clientes: G.clientes, lanc: G.lanc, despesas: G.despesas,
    cfg: JSON.parse(JSON.stringify(G.cfg)), mesAtivo: G.mesAtivo,
  };
  G.demo = true;
  G.contas = []; G.clientes = []; G.lanc = []; G.despesas = [];
  gGerarDadosTeste();
  G.mesAtivo = gMesesDisponiveis().slice(-1)[0];
  G.tab = 'painel';
  gShowTab('painel');
  gRenderAll();
  showToast('🎲 Dados fictícios carregados — explore à vontade, nada será salvo.');
}

function gSairDemo() {
  if (G._backup) {
    G.contas = G._backup.contas; G.clientes = G._backup.clientes;
    G.lanc = G._backup.lanc; G.despesas = G._backup.despesas;
    G.cfg = G._backup.cfg; G.mesAtivo = G._backup.mesAtivo;
    G._backup = null;
  }
  G.demo = false;
  G.detalheId = null;
  gShowTab('painel');
  gRenderAll();
  showToast('Seus dados reais estão de volta.');
}

// ── render central ──
function gRenderAll() {
  gRenderMeses();
  gRenderTab();
}
function gRenderTab() {
  switch (G.tab) {
    case 'painel': gRenderPainel(); break;
    case 'clientes': gRenderClientes(); break;
    case 'detalhe': gRenderDetalhe(); break;
    case 'dist': gRenderDist(); break;
    case 'custos': gRenderCustos(); break;
    case 'importar': break; // estático
  }
}

// dados fictícios para o modo teste
function gGerarDadosTeste() {
  const empresaId = null;
  G.contas = [
    { id: gId(), empresa_id: empresaId, nome: 'Empresa 1 (PJ)', tipo: 'PJ', teto: 32000, ordem: 0 },
    { id: gId(), empresa_id: empresaId, nome: 'Empresa 2 (PJ)', tipo: 'PJ', teto: 32000, ordem: 1 },
    { id: gId(), empresa_id: empresaId, nome: 'Pessoa Física', tipo: 'PF', teto: 23200, ordem: 2 },
  ];
  const [pj1, pj2, pf] = G.contas;
  const clientes = [
    ['Atlas Engenharia', 'Mensal', true, 'fixa', pj1.id, 9200, 2100, 14],
    ['Verde Paisagismo', 'Mensal', false, 'auto', null, 6400, 1500, 11],
    ['Studio Lumen', 'Mensal', true, 'fixa', pf.id, 7800, 1700, 9],
    ['Padaria Trigo Real', 'Avulso', false, 'auto', null, 2300, 900, 7],
    ['Holtz Advocacia', 'Mensal', false, 'auto', null, 5600, 1400, 8],
    ['NovaClin Saúde', 'Mensal', true, 'auto', null, 8100, 2000, 12],
    ['Bela Têxtil', 'Avulso', false, 'auto', null, 2800, 1100, 6],
    ['Orbita Tech', 'Mensal', false, 'auto', null, 5500, 1300, 10],
    ['Café da Esquina', 'Avulso', true, 'auto', null, 1900, 800, 5],
    ['Ferro & Forma', 'Mensal', false, 'auto', null, 4900, 1200, 9],
    ['Aurora Cosméticos', 'Mensal', false, 'fixa', pj2.id, 7200, 1600, 11],
    ['Mira Arquitetura', 'Avulso', false, 'auto', null, 3000, 1000, 8],
  ];
  const chave = gChaveHoje();
  const [ano, mes] = chave.split('-').map(Number);
  clientes.forEach(([nome, rec, nf, modo, contaId, fat, custo, horas]) => {
    const cli = {
      id: gId(), empresa_id: empresaId, nome, nome_norm: normStr(nome),
      tier: 'Classico', tier_modo: 'auto', conta_id: contaId, conta_modo: modo,
      recorrencia: rec, emite_nf: nf,
    };
    G.clientes.push(cli);
    // 3 meses de histórico
    for (let i = 2; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      const ch = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const fator = 1 - i * 0.06 + (Math.random() * 0.06 - 0.03);
      G.lanc.push({
        id: gId(), empresa_id: empresaId, cliente_id: cli.id, chave: ch,
        mes: d.getMonth() + 1, ano: d.getFullYear(),
        faturamento: Math.round(fat * fator), custo: Math.round(custo * fator),
        horas: horas, conta_id: null, alocacao_manual: false,
      });
    }
  });
  const despesas = [
    ['Software de gestão', pj1.id, 'fixo', 890], ['Pró-labore', pj1.id, 'fixo', 4200],
    ['Contador', pj1.id, 'fixo', 1100], ['Energia / internet', pj2.id, 'fixo', 720],
    ['Anúncios', pj2.id, 'variavel', 1500], ['Fornecedor — insumos', pf.id, 'variavel', 2350],
    ['Deslocamento', pf.id, 'variavel', 640], ['Plano de saúde', pf.id, 'fixo', 980],
  ];
  gMesesDisponiveis().forEach(ch => {
    const [a, m] = ch.split('-').map(Number);
    despesas.forEach(([desc, contaId, tipo, valor]) => {
      G.despesas.push({
        id: gId(), empresa_id: empresaId, conta_id: contaId, chave: ch,
        descricao: desc, tipo, valor, data: ch + '-05',
      });
    });
  });
  gMesesDisponiveis().forEach(ch => gDistribuirMes(ch, true, false));
}

// ═══════════════════════════════════════
//  TELA: CLIENTES
// ═══════════════════════════════════════
function gSetTier(tier, btn) {
  G.filtros.tier = tier;
  document.querySelectorAll('#gSegTier button').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  gRenderClientes();
}

function gPopularFiltroContas() {
  const sel = document.getElementById('gFiltConta');
  const atual = sel.value;
  sel.innerHTML = `<option value="all">Todas as contas</option>` +
    G.contas.map(c => `<option value="${c.id}">${gEsc(c.nome)}</option>`).join('') +
    `<option value="none">A distribuir</option>`;
  if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
}

function gDadosClienteMes(cli, chave) {
  const l = gLancDe(cli.id, chave) || { faturamento: 0, custo: 0, horas: 0, conta_id: null };
  const tier = gTierEfetivo(cli, chave);
  return {
    cli, l, tier,
    nome: cli.nome,
    faturamento: gNum(l.faturamento),
    margem: gMargem(l),
    lucro: gLucroReal(l),
    horas: gNum(l.horas),
    contaId: cli.conta_modo === 'fixa' ? cli.conta_id : l.conta_id,
  };
}

function gRenderClientes() {
  gPopularFiltroContas();
  const chave = G.mesAtivo;
  const fConta = document.getElementById('gFiltConta').value;
  const fRec = document.getElementById('gFiltRec').value;

  let rows = G.clientes.map(c => gDadosClienteMes(c, chave));
  rows = rows.filter(r =>
    (G.filtros.tier === 'all' || r.tier === G.filtros.tier) &&
    (fConta === 'all' || (fConta === 'none' ? !r.contaId : r.contaId === fConta)) &&
    (fRec === 'all' || r.cli.recorrencia === fRec));

  const k = G.sort.key, dir = G.sort.dir;
  const keyFn = {
    nome: r => r.nome.toLowerCase(),
    tier: r => G_TIER_ORDEM[r.tier] || 0,
    conta: r => (gConta(r.contaId) || { nome: 'zzz' }).nome.toLowerCase(),
    faturamento: r => r.faturamento,
    margem: r => r.margem,
    lucro: r => r.lucro,
    horas: r => r.horas,
  }[k] || (r => r.faturamento);
  rows.sort((a, b) => { const x = keyFn(a), y = keyFn(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });

  const body = document.getElementById('gCliBody');
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="gempty">Nenhum cliente aqui ainda.<br>
      Use <b>＋ Novo cliente</b> ou importe uma planilha na aba <b>Importar</b>.</div></td></tr>`;
  } else {
    body.innerHTML = rows.map(r => {
      const conta = gConta(r.contaId);
      const lock = r.cli.conta_modo === 'fixa' ? ' <span class="glock" title="Conta fixa">🔒</span>' : '';
      const nf = r.cli.emite_nf ? ' <span class="gchip-nf" style="font-size:9px;color:var(--green);font-weight:700">NF</span>' : '';
      return `<tr onclick="gAbrirDetalhe('${r.cli.id}')">
        <td class="gcli-nm">${gEsc(r.nome)}${lock}${nf}</td>
        <td>${gTierBadge(r.tier, r.cli.tier_modo)}</td>
        <td class="gacct-tag">${conta ? gEsc(conta.nome) : '<i style="color:var(--muted)">a distribuir</i>'}</td>
        <td class="num">${fmt(r.faturamento)}</td>
        <td class="num">${r.margem.toFixed(0)}%</td>
        <td class="num" style="color:${r.lucro >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(r.lucro)}</td>
        <td class="num">${r.horas}h <span class="grec">· ${r.cli.recorrencia}</span></td>
      </tr>`;
    }).join('');
  }

  document.querySelectorAll('#gCliTable thead th').forEach(th => {
    th.classList.toggle('sorted', th.dataset.gsort === k);
    const arr = th.querySelector('.arr');
    if (arr) arr.textContent = dir === -1 ? '▼' : '▲';
    th.onclick = () => {
      if (G.sort.key === th.dataset.gsort) G.sort.dir *= -1;
      else { G.sort.key = th.dataset.gsort; G.sort.dir = -1; }
      gRenderClientes();
    };
  });
}

// ═══════════════════════════════════════
//  TELA: DETALHE DO CLIENTE
// ═══════════════════════════════════════
function gAbrirDetalhe(id) {
  G.detalheId = id;
  gShowTab('detalhe');
}

function gRenderDetalhe() {
  const cli = gCli(G.detalheId);
  const wrap = document.getElementById('gDetalheWrap');
  if (!cli) { wrap.innerHTML = ''; gShowTab('clientes'); return; }
  const chave = G.mesAtivo;
  const r = gDadosClienteMes(cli, chave);
  const sug = gTierSugeridoCliente(cli, chave);
  const custoTempo = r.horas * gNum(G.cfg.custo_hora);
  const contaFixa = cli.conta_modo === 'fixa';
  const lancs = G.lanc.filter(l => l.cliente_id === cli.id).sort((a, b) => b.chave.localeCompare(a.chave));

  wrap.innerHTML = `
    <button class="gback" onclick="gShowTab('clientes')">← Voltar para clientes</button>
    <div class="gdet-head">
      <div class="nm">${gEsc(cli.nome)} ${gTierBadge(r.tier, cli.tier_modo)}</div>
      <div style="display:flex;gap:8px">
        <button class="gbtn ghost" onclick="gAbrirEditarCliente('${cli.id}')">✏️ Editar</button>
        <button class="gbtn danger" onclick="gConfirmarExcluirCliente('${cli.id}')">🗑️ Excluir</button>
      </div>
    </div>

    <div class="gmetrics">
      <div class="gmetric"><div class="l">Faturamento (${gChaveLabel(chave)})</div><div class="v">${fmt(r.faturamento)}</div></div>
      <div class="gmetric"><div class="l">Margem</div><div class="v">${r.margem.toFixed(0)}%</div></div>
      <div class="gmetric"><div class="l">Lucro real</div><div class="v" style="color:${r.lucro >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(r.lucro)}</div></div>
      <div class="gmetric"><div class="l">Tempo</div><div class="v">${r.horas}h/mês</div></div>
    </div>

    <div class="gdet-grid">
      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--gold)"></span>Classificação</div>
        <div class="gsug">
          <div class="txt">
            <b>Categoria sugerida: ${G_TIER_LABEL[sug]}</b>
            <p>Calculada por margem + faturamento + recorrência (edite as regras em ⚙️).</p>
          </div>
          ${cli.tier_modo === 'manual'
      ? `<button class="gbtn ghost" style="padding:7px 12px" onclick="gSetTierModo('${cli.id}','auto')">Usar automático</button>`
      : `<select class="gfilter" onchange="if(this.value)gSetTierManual('${cli.id}',this.value)">
              <option value="">Sobrescrever…</option>
              <option value="Classico">Clássico</option>
              <option value="Gold">Gold</option>
              <option value="Black">Black</option>
            </select>`}
        </div>

        <div class="gtoggle" style="margin-top:14px">
          <div class="tinfo"><b>Conta fixa</b>
            <p>Trava o cliente em uma conta — a distribuição automática nunca o move.</p></div>
          <div class="gswitch ${contaFixa ? 'on' : ''}" onclick="gToggleContaFixa('${cli.id}')"></div>
        </div>
        ${contaFixa ? `
        <div style="padding:4px 0 12px">
          <select class="gfilter" style="width:100%" onchange="gSetContaFixa('${cli.id}',this.value)">
            ${G.contas.map(c => `<option value="${c.id}" ${cli.conta_id === c.id ? 'selected' : ''}>${gEsc(c.nome)}</option>`).join('')}
          </select>
        </div>` : `
        <div style="padding:4px 0 12px;font-size:12px;color:var(--muted2)">
          Modo <b>automático</b>: o motor escolhe a conta que gera o menor imposto e mantém as contas niveladas.
        </div>`}

        <div class="gtoggle">
          <div class="tinfo"><b>Emite nota fiscal</b>
            <p>Clientes com NF vão para a PF até cobrir o custo mensal dela (imposto zero nessa fatia).</p></div>
          <div class="gswitch ${cli.emite_nf ? 'on' : ''}" onclick="gToggleNF('${cli.id}')"></div>
        </div>

        <div class="gtoggle">
          <div class="tinfo"><b>Recorrência</b>
            <p>Clientes mensais pontuam mais na classificação automática.</p></div>
          <select class="gfilter" onchange="gSetRecorrencia('${cli.id}',this.value)">
            <option value="Mensal" ${cli.recorrencia === 'Mensal' ? 'selected' : ''}>Mensal</option>
            <option value="Avulso" ${cli.recorrencia === 'Avulso' ? 'selected' : ''}>Avulso</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--green)"></span>Composição do lucro — ${gChaveLabel(chave)}</div>
        <div class="gsplit-row"><div class="nm">Faturamento</div><div class="amt">${fmt(r.faturamento)}</div></div>
        <div class="gsplit-row"><div class="nm">(−) Custo direto</div><div class="amt">− ${fmt(gNum(r.l.custo))}</div></div>
        <div class="gsplit-row"><div class="nm">(−) Tempo de trabalho (${r.horas}h × ${fmt(gNum(G.cfg.custo_hora))})</div><div class="amt">− ${fmt(custoTempo)}</div></div>
        <div class="gsplit-row"><div class="nm"><b>Lucro real</b></div><div class="amt"><b style="color:${r.lucro >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(r.lucro)}</b></div></div>
        <div style="margin-top:16px;font-size:11.5px;color:var(--muted);line-height:1.6">
          Conta no mês: <b style="color:var(--muted2)">${(gConta(r.contaId) || { nome: 'a distribuir' }).nome}</b>
        </div>
      </div>
    </div>

    <div class="card full">
      <div class="card-title"><span class="dot" style="background:var(--accent)"></span>Lançamentos mensais
        <button class="gbtn ghost" style="margin-left:auto;padding:6px 12px;font-size:12px" onclick="gAbrirNovoLancamento('${cli.id}')">＋ Novo lançamento</button>
      </div>
      <table class="gtbl">
        <thead><tr><th>Mês</th><th class="num">Faturamento</th><th class="num">Custo</th><th class="num">Horas</th><th>Conta</th><th class="num">Lucro real</th><th></th></tr></thead>
        <tbody>
          ${lancs.length ? lancs.map(l => `
            <tr style="cursor:default">
              <td>${gChaveLabel(l.chave)}</td>
              <td class="num">${fmt(gNum(l.faturamento))}</td>
              <td class="num">${fmt(gNum(l.custo))}</td>
              <td class="num">${gNum(l.horas)}h</td>
              <td class="gacct-tag">${(gConta(l.conta_id) || { nome: '—' }).nome}</td>
              <td class="num" style="color:${gLucroReal(l) >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(gLucroReal(l))}</td>
              <td class="num">
                <button class="gdel" title="Editar" onclick="gAbrirNovoLancamento('${cli.id}','${l.chave}')">✏️</button>
                <button class="gdel" title="Excluir" onclick="gExcluirLancamento('${l.id}')">🗑️</button>
              </td>
            </tr>`).join('') :
      `<tr><td colspan="7"><div class="gempty">Nenhum lançamento — adicione o primeiro mês deste cliente.</div></td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ── ações rápidas do detalhe ──
async function gSetTierManual(id, tier) {
  const cli = gCli(id); if (!cli) return;
  cli.tier = tier; cli.tier_modo = 'manual';
  await gdbUpsert('clientes_gestao', cli);
  gRenderAll();
}
async function gSetTierModo(id, modo) {
  const cli = gCli(id); if (!cli) return;
  cli.tier_modo = modo;
  if (modo === 'auto') cli.tier = gTierSugeridoCliente(cli);
  await gdbUpsert('clientes_gestao', cli);
  gRenderAll();
}
async function gToggleContaFixa(id) {
  const cli = gCli(id); if (!cli) return;
  if (cli.conta_modo === 'fixa') {
    cli.conta_modo = 'auto'; cli.conta_id = null;
  } else {
    cli.conta_modo = 'fixa';
    const l = gLancDe(id, G.mesAtivo);
    cli.conta_id = (l && l.conta_id) || (G.contas[0] && G.contas[0].id) || null;
  }
  await gdbUpsert('clientes_gestao', cli);
  gRedistribuirMesAtivo();
}
async function gSetContaFixa(id, contaId) {
  const cli = gCli(id); if (!cli) return;
  cli.conta_id = contaId; cli.conta_modo = 'fixa';
  await gdbUpsert('clientes_gestao', cli);
  gRedistribuirMesAtivo();
}
async function gToggleNF(id) {
  const cli = gCli(id); if (!cli) return;
  cli.emite_nf = !cli.emite_nf;
  await gdbUpsert('clientes_gestao', cli);
  gRedistribuirMesAtivo();
}
async function gSetRecorrencia(id, rec) {
  const cli = gCli(id); if (!cli) return;
  cli.recorrencia = rec;
  if (cli.tier_modo === 'auto') cli.tier = gTierSugeridoCliente(cli);
  await gdbUpsert('clientes_gestao', cli);
  gRenderAll();
}
async function gExcluirLancamento(id) {
  const idx = G.lanc.findIndex(l => l.id === id);
  if (idx < 0) return;
  G.lanc.splice(idx, 1);
  await gdbDelete('clientes_lancamentos', id);
  gRenderAll();
}
function gConfirmarExcluirCliente(id) {
  const cli = gCli(id); if (!cli) return;
  gModal(`
    <div class="metrik-modal-title">Excluir ${gEsc(cli.nome)}?</div>
    <div class="metrik-modal-sub">Todos os lançamentos mensais deste cliente também serão apagados. Essa ação não pode ser desfeita.</div>
    <div class="metrik-modal-footer">
      <button class="gbtn danger" onclick="gExcluirCliente('${id}')">Sim, excluir</button>
      <button class="metrik-modal-btn-cancel" onclick="gFecharModal()">Cancelar</button>
    </div>`);
}
async function gExcluirCliente(id) {
  gFecharModal();
  G.lanc = G.lanc.filter(l => l.cliente_id !== id);
  G.clientes = G.clientes.filter(c => c.id !== id);
  await gdbDelete('clientes_gestao', id); // lançamentos caem em cascata no banco
  showToast('Cliente excluído.');
  gShowTab('clientes');
  gRenderAll();
}

// ═══════════════════════════════════════
//  MODAIS (novo/editar cliente, lançamento)
// ═══════════════════════════════════════
function gModal(inner, maxw = 540) {
  document.getElementById('gestaoModalWrap').innerHTML = `
    <div class="metrik-modal-overlay" onclick="if(event.target===this)gFecharModal()">
      <div class="metrik-modal" style="max-width:${maxw}px">${inner}</div>
    </div>`;
}
function gFecharModal() { document.getElementById('gestaoModalWrap').innerHTML = ''; }

function gMesOptions(selecionado) {
  const meses = new Set(gMesesDisponiveis());
  meses.add(gChaveHoje());
  if (selecionado) meses.add(selecionado);
  const hoje = new Date();
  for (let i = 1; i <= 2; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.add(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return [...meses].sort().reverse().map(m =>
    `<option value="${m}" ${m === (selecionado || G.mesAtivo) ? 'selected' : ''}>${gChaveLabel(m)}</option>`).join('');
}

function gAbrirNovoCliente() { gAbrirEditarCliente(null); }

function gAbrirEditarCliente(id) {
  const cli = id ? gCli(id) : null;
  const novo = !cli;
  const l = cli ? gLancDe(cli.id, G.mesAtivo) : null;
  gModal(`
    <div class="metrik-modal-title">${novo ? '＋ Novo cliente' : '✏️ Editar cliente'}</div>
    <div class="metrik-modal-sub">${novo ? 'O cliente vira uma regra permanente: nas próximas planilhas ele é reconhecido pelo nome.' : gEsc(cli.nome)}</div>
    <div class="gform">
      <div class="gfield"><label>Nome do cliente</label>
        <input id="gmNome" type="text" value="${cli ? gEsc(cli.nome) : ''}" placeholder="Ex: Atlas Engenharia"></div>
      <div class="gform-row">
        <div class="gfield"><label>Recorrência</label>
          <select id="gmRec">
            <option value="Mensal" ${!cli || cli.recorrencia === 'Mensal' ? 'selected' : ''}>Mensal</option>
            <option value="Avulso" ${cli && cli.recorrencia === 'Avulso' ? 'selected' : ''}>Avulso</option>
          </select></div>
        <div class="gfield"><label>Categoria</label>
          <select id="gmTier">
            <option value="auto" ${!cli || cli.tier_modo === 'auto' ? 'selected' : ''}>Automática (recomendado)</option>
            <option value="Classico" ${cli && cli.tier_modo === 'manual' && cli.tier === 'Classico' ? 'selected' : ''}>Clássico</option>
            <option value="Gold" ${cli && cli.tier_modo === 'manual' && cli.tier === 'Gold' ? 'selected' : ''}>Gold</option>
            <option value="Black" ${cli && cli.tier_modo === 'manual' && cli.tier === 'Black' ? 'selected' : ''}>Black</option>
          </select></div>
      </div>
      <div class="gform-row">
        <div class="gfield"><label>Conta</label>
          <select id="gmConta">
            <option value="auto" ${!cli || cli.conta_modo === 'auto' ? 'selected' : ''}>Automática (menor imposto)</option>
            ${G.contas.map(c => `<option value="${c.id}" ${cli && cli.conta_modo === 'fixa' && cli.conta_id === c.id ? 'selected' : ''}>Fixa: ${gEsc(c.nome)}</option>`).join('')}
          </select></div>
        <div class="gfield"><label>Emite nota fiscal?</label>
          <select id="gmNF">
            <option value="nao" ${!cli || !cli.emite_nf ? 'selected' : ''}>Não</option>
            <option value="sim" ${cli && cli.emite_nf ? 'selected' : ''}>Sim — priorizar PF</option>
          </select></div>
      </div>
      ${novo ? `
      <div class="gcfg-sec">Primeiro lançamento (opcional)</div>
      <div class="gform-row">
        <div class="gfield"><label>Mês</label><select id="gmMes">${gMesOptions()}</select></div>
        <div class="gfield"><label>Faturamento</label><input id="gmFat" type="text" placeholder="R$ 0,00"></div>
      </div>
      <div class="gform-row">
        <div class="gfield"><label>Custo direto</label><input id="gmCusto" type="text" placeholder="R$ 0,00"></div>
        <div class="gfield"><label>Horas/mês</label><input id="gmHoras" type="number" min="0" step="0.5" placeholder="0"></div>
      </div>` : ''}
    </div>
    <div class="metrik-modal-footer">
      <button class="metrik-modal-btn-confirm" onclick="gSalvarCliente(${cli ? `'${cli.id}'` : 'null'})">${novo ? 'Criar cliente' : 'Salvar'}</button>
      <button class="metrik-modal-btn-cancel" onclick="gFecharModal()">Cancelar</button>
    </div>`);
}

async function gSalvarCliente(id) {
  const nome = document.getElementById('gmNome').value.trim();
  if (!nome) { showToast('Informe o nome do cliente.', true); return; }
  const nomeNorm = normStr(nome);
  const jaExiste = G.clientes.find(c => c.nome_norm === nomeNorm && c.id !== id);
  if (jaExiste) { showToast('Já existe um cliente com esse nome.', true); return; }

  const tierSel = document.getElementById('gmTier').value;
  const contaSel = document.getElementById('gmConta').value;

  let cli = id ? gCli(id) : null;
  const novo = !cli;
  if (novo) {
    cli = { id: gId(), empresa_id: gEmpresaId(), tier: 'Classico', tier_modo: 'auto' };
    G.clientes.push(cli);
  }
  cli.nome = nome;
  cli.nome_norm = nomeNorm;
  cli.recorrencia = document.getElementById('gmRec').value;
  cli.emite_nf = document.getElementById('gmNF').value === 'sim';
  if (tierSel === 'auto') { cli.tier_modo = 'auto'; }
  else { cli.tier_modo = 'manual'; cli.tier = tierSel; }
  if (contaSel === 'auto') { cli.conta_modo = 'auto'; cli.conta_id = null; }
  else { cli.conta_modo = 'fixa'; cli.conta_id = contaSel; }

  // primeiro lançamento (se preenchido)
  if (novo) {
    const fat = parseBrNum(document.getElementById('gmFat').value);
    if (fat > 0) {
      const chave = document.getElementById('gmMes').value;
      const [ano, mes] = chave.split('-').map(Number);
      const lanc = {
        id: gId(), empresa_id: gEmpresaId(), cliente_id: cli.id, chave, mes, ano,
        faturamento: fat,
        custo: parseBrNum(document.getElementById('gmCusto').value),
        horas: gNum(document.getElementById('gmHoras').value),
        conta_id: cli.conta_modo === 'fixa' ? cli.conta_id : null,
        alocacao_manual: false,
      };
      G.lanc.push(lanc);
      await gdbUpsert('clientes_lancamentos', lanc);
      if (!G.mesAtivo) G.mesAtivo = chave;
    }
  }
  if (cli.tier_modo === 'auto') cli.tier = gTierSugeridoCliente(cli);
  await gdbUpsert('clientes_gestao', cli);
  gFecharModal();
  showToast(novo ? '✓ Cliente criado.' : '✓ Cliente atualizado.');
  gRedistribuirMesAtivo();
}

function gAbrirNovoLancamento(cliId, chave) {
  const cli = gCli(cliId); if (!cli) return;
  const l = chave ? gLancDe(cliId, chave) : null;
  gModal(`
    <div class="metrik-modal-title">${l ? '✏️ Editar lançamento' : '＋ Novo lançamento'}</div>
    <div class="metrik-modal-sub">${gEsc(cli.nome)}</div>
    <div class="gform">
      <div class="gform-row">
        <div class="gfield"><label>Mês</label>
          ${l ? `<input type="text" value="${gChaveLabel(l.chave)}" disabled><input type="hidden" id="glMes" value="${l.chave}">`
      : `<select id="glMes">${gMesOptions()}</select>`}</div>
        <div class="gfield"><label>Faturamento</label>
          <input id="glFat" type="text" value="${l ? fmt(gNum(l.faturamento)) : ''}" placeholder="R$ 0,00"></div>
      </div>
      <div class="gform-row">
        <div class="gfield"><label>Custo direto</label>
          <input id="glCusto" type="text" value="${l ? fmt(gNum(l.custo)) : ''}" placeholder="R$ 0,00"></div>
        <div class="gfield"><label>Horas no mês</label>
          <input id="glHoras" type="number" min="0" step="0.5" value="${l ? gNum(l.horas) : ''}" placeholder="0"></div>
      </div>
    </div>
    <div class="metrik-modal-footer">
      <button class="metrik-modal-btn-confirm" onclick="gSalvarLancamento('${cliId}')">Salvar</button>
      <button class="metrik-modal-btn-cancel" onclick="gFecharModal()">Cancelar</button>
    </div>`);
}

async function gSalvarLancamento(cliId) {
  const cli = gCli(cliId); if (!cli) return;
  const chave = document.getElementById('glMes').value;
  const fat = parseBrNum(document.getElementById('glFat').value);
  const custo = parseBrNum(document.getElementById('glCusto').value);
  const horas = gNum(document.getElementById('glHoras').value);
  if (!chave) { showToast('Escolha o mês.', true); return; }

  let l = gLancDe(cliId, chave);
  const [ano, mes] = chave.split('-').map(Number);
  if (!l) {
    l = {
      id: gId(), empresa_id: gEmpresaId(), cliente_id: cliId, chave, mes, ano,
      conta_id: cli.conta_modo === 'fixa' ? cli.conta_id : null, alocacao_manual: false,
    };
    G.lanc.push(l);
  }
  l.faturamento = fat; l.custo = custo; l.horas = horas;
  await gdbUpsert('clientes_lancamentos', l);
  if (cli.tier_modo === 'auto') { cli.tier = gTierSugeridoCliente(cli); await gdbUpsert('clientes_gestao', cli); }
  gFecharModal();
  if (!G.mesAtivo) G.mesAtivo = chave;
  await gDistribuirMes(chave, false);
  gRenderAll();
}

// ═══════════════════════════════════════
//  MOTOR DE DISTRIBUIÇÃO INTELIGENTE
//  Objetivo: SEMPRE pagar o menor imposto possível.
//  1. Conta fixa: nunca move.
//  2. Arrastado manualmente: só move com "force".
//  3. Clientes com NF → PF até cobrir o custo mensal (base tributável zero).
//  4. Resto → conta com menor imposto marginal; empate = conta mais vazia (nivelamento).
// ═══════════════════════════════════════
function gImpostoValor(conta, total, chave) {
  return gImpostoConta(conta, total, chave).valor;
}

async function gDistribuirMes(chave, force = false, persist = true) {
  if (!chave || !G.contas.length) return;
  const lancs = gLancsDoMes(chave);
  if (!lancs.length) return;

  const alloc = {};
  G.contas.forEach(c => alloc[c.id] = 0);
  const autos = [];
  const alterados = new Set();

  for (const l of lancs) {
    const cli = gCli(l.cliente_id);
    if (!cli) continue;
    if (cli.conta_modo === 'fixa' && cli.conta_id && gConta(cli.conta_id)) {
      if (l.conta_id !== cli.conta_id || l.alocacao_manual) {
        l.conta_id = cli.conta_id; l.alocacao_manual = false; alterados.add(l.id);
      }
      alloc[cli.conta_id] += gNum(l.faturamento);
    } else if (l.alocacao_manual && !force && l.conta_id && gConta(l.conta_id)) {
      alloc[l.conta_id] += gNum(l.faturamento);
    } else {
      autos.push(l);
    }
  }

  // 1ª fase: clientes com NF → PF até o custo mensal
  const pf = G.contas.find(c => c.tipo === 'PF');
  const restantes = [];
  const nfs = autos.filter(l => (gCli(l.cliente_id) || {}).emite_nf)
    .sort((a, b) => gNum(b.faturamento) - gNum(a.faturamento));
  const naoNf = autos.filter(l => !(gCli(l.cliente_id) || {}).emite_nf);

  if (pf) {
    const alvo = gCustoMensalConta(pf.id, chave);
    for (const l of nfs) {
      if (alloc[pf.id] + gNum(l.faturamento) <= alvo + 0.005) {
        if (l.conta_id !== pf.id || l.alocacao_manual) { l.conta_id = pf.id; l.alocacao_manual = false; alterados.add(l.id); }
        alloc[pf.id] += gNum(l.faturamento);
      } else {
        restantes.push(l);
      }
    }
  } else {
    restantes.push(...nfs);
  }
  restantes.push(...naoNf);

  // 2ª fase: menor imposto marginal; empate → conta mais vazia (nivelamento)
  restantes.sort((a, b) => gNum(b.faturamento) - gNum(a.faturamento));
  for (const l of restantes) {
    const cli = gCli(l.cliente_id) || {};
    let cands = G.contas.filter(c => cli.emite_nf ? true : c.tipo === 'PJ');
    if (!cands.length) cands = G.contas;

    let best = null, bestScore = Infinity;
    for (const c of cands) {
      const fat = gNum(l.faturamento);
      const marginal = gImpostoValor(c, alloc[c.id] + fat, chave) - gImpostoValor(c, alloc[c.id], chave);
      const usoNovo = c.teto > 0 ? (alloc[c.id] + fat) / c.teto : (alloc[c.id] + fat) / 1e7;
      const estouro = (c.teto > 0 && usoNovo > 1) ? (usoNovo - 1) * 1e7 : 0;
      const score = marginal + estouro + usoNovo * 0.5; // nivelamento como critério de desempate
      if (score < bestScore - 1e-9) { bestScore = score; best = c; }
    }
    if (best) {
      if (l.conta_id !== best.id || l.alocacao_manual) { l.conta_id = best.id; l.alocacao_manual = false; alterados.add(l.id); }
      alloc[best.id] += gNum(l.faturamento);
    }
  }

  // 3ª fase: refinamento — move/troca clientes automáticos enquanto o imposto total cair
  const moveis = lancs.filter(l => {
    const cli = gCli(l.cliente_id);
    return cli && cli.conta_modo !== 'fixa' && !(l.alocacao_manual && !force) && l.conta_id;
  });
  const contasPermitidas = (cli) => G.contas.filter(c => cli.emite_nf ? true : c.tipo === 'PJ');
  let melhorou = true, guarda = 0;
  while (melhorou && guarda++ < 40) {
    melhorou = false;
    // movimentos simples
    for (const l of moveis) {
      const cli = gCli(l.cliente_id), fat = gNum(l.faturamento);
      const origem = gConta(l.conta_id);
      for (const destino of contasPermitidas(cli)) {
        if (destino.id === l.conta_id) continue;
        const antes = gImpostoValor(origem, alloc[origem.id], chave) + gImpostoValor(destino, alloc[destino.id], chave);
        const depois = gImpostoValor(origem, alloc[origem.id] - fat, chave) + gImpostoValor(destino, alloc[destino.id] + fat, chave);
        const criaEstouro = destino.teto > 0 && alloc[destino.id] + fat > destino.teto &&
          !(origem.teto > 0 && alloc[origem.id] > origem.teto);
        if (depois < antes - 0.01 && !criaEstouro) {
          alloc[origem.id] -= fat; alloc[destino.id] += fat;
          l.conta_id = destino.id; l.alocacao_manual = false; alterados.add(l.id);
          melhorou = true;
          break;
        }
      }
    }
    // trocas entre pares (resolve casos de clientes "grandes" travando uma conta na faixa alta)
    for (let i = 0; i < moveis.length; i++) {
      for (let j = i + 1; j < moveis.length; j++) {
        const a = moveis[i], b = moveis[j];
        if (!a.conta_id || !b.conta_id || a.conta_id === b.conta_id) continue;
        const ca = gConta(a.conta_id), cb = gConta(b.conta_id);
        const cliA = gCli(a.cliente_id), cliB = gCli(b.cliente_id);
        if (!cliA.emite_nf && cb.tipo === 'PF') continue;
        if (!cliB.emite_nf && ca.tipo === 'PF') continue;
        const fa = gNum(a.faturamento), fb = gNum(b.faturamento);
        const antes = gImpostoValor(ca, alloc[ca.id], chave) + gImpostoValor(cb, alloc[cb.id], chave);
        const depois = gImpostoValor(ca, alloc[ca.id] - fa + fb, chave) + gImpostoValor(cb, alloc[cb.id] - fb + fa, chave);
        if (depois < antes - 0.01) {
          alloc[ca.id] += fb - fa; alloc[cb.id] += fa - fb;
          const tmp = a.conta_id; a.conta_id = b.conta_id; b.conta_id = tmp;
          a.alocacao_manual = false; b.alocacao_manual = false;
          alterados.add(a.id); alterados.add(b.id);
          melhorou = true;
        }
      }
    }
  }

  if (persist && alterados.size && !gSomenteLocal()) {
    const batch = lancs.filter(l => alterados.has(l.id));
    const { error } = await _sb.from('clientes_lancamentos').upsert(batch);
    if (error) { console.error('Erro ao salvar distribuição', error); showToast('Erro ao salvar a distribuição.', true); }
  }
}

async function gRedistribuirMesAtivo() {
  if (G.mesAtivo) await gDistribuirMes(G.mesAtivo, false);
  gRenderAll();
}

function gImpostoTotalMes(chave) {
  const lancs = gLancsDoMes(chave);
  return G.contas.reduce((s, c) => {
    const tot = lancs.filter(l => l.conta_id === c.id).reduce((x, l) => x + gNum(l.faturamento), 0);
    return s + gImpostoConta(c, tot, chave).valor;
  }, 0);
}

async function gDistribuirAuto() {
  if (!G.mesAtivo) return;
  const antes = gImpostoTotalMes(G.mesAtivo);
  await gDistribuirMes(G.mesAtivo, true); // refaz tudo (respeitando só as contas fixas)
  const depois = gImpostoTotalMes(G.mesAtivo);
  if (antes - depois > 0.01) {
    showToast(`🪄 Imposto estimado caiu de ${fmt(antes)} para ${fmt(depois)}.`);
  } else {
    showToast('✓ Esta já é a distribuição de menor imposto possível — clientes com 🔒 (conta fixa) não são movidos.');
  }
  gRenderAll();
}

// ═══════════════════════════════════════
//  TELA: DISTRIBUIÇÃO (drag & drop)
// ═══════════════════════════════════════
function gRenderDist() {
  const chave = G.mesAtivo;
  const cols = document.getElementById('gDistCols');
  const lancs = gLancsDoMes(chave);

  // barra de imposto total
  const bar = document.getElementById('gImpostoBar');
  let impostoTotal = 0, fatTotal = 0;
  const porConta = G.contas.map(conta => {
    const list = lancs.filter(l => l.conta_id === conta.id);
    const total = list.reduce((s, l) => s + gNum(l.faturamento), 0);
    const imp = gImpostoConta(conta, total, chave);
    impostoTotal += imp.valor; fatTotal += total;
    return { conta, list, total, imp };
  });
  const semConta = lancs.filter(l => !l.conta_id || !gConta(l.conta_id));
  bar.innerHTML = `
    <div class="item"><span class="lbl">Imposto estimado total</span><span class="val" style="color:var(--red)">${fmt(impostoTotal)}</span></div>
    <div class="item"><span class="lbl">Faturamento alocado</span><span class="val">${fmt(fatTotal)}</span></div>
    <div class="item"><span class="lbl">Carga efetiva</span><span class="val">${fatTotal > 0 ? (impostoTotal / fatTotal * 100).toFixed(1) : '0'}%</span></div>
    ${semConta.length ? `<div class="item"><span class="lbl">A distribuir</span><span class="val" style="color:var(--yellow)">${semConta.length} cliente${semConta.length > 1 ? 's' : ''}</span></div>` : ''}`;

  const chipHtml = (l) => {
    const cli = gCli(l.cliente_id) || { nome: '?' };
    const fixa = cli.conta_modo === 'fixa';
    return `<div class="gchip ${fixa ? 'fixed' : ''} ${l.alocacao_manual ? 'manual' : ''}"
      draggable="${!fixa}" data-lanc="${l.id}"
      title="${fixa ? 'Conta fixa — gerencie no cliente' : (l.alocacao_manual ? 'Posição manual (arrastada) — o motor não move' : 'Alocação automática')}">
      <div class="ci">${fixa ? '<span class="glock">🔒</span>' : ''}<span class="cn">${gEsc(cli.nome)}</span>
        ${cli.emite_nf ? '<span class="nf">NF</span>' : ''}</div>
      <span class="cv">${fmt(gNum(l.faturamento))}</span>
    </div>`;
  };

  let html = porConta.map(({ conta, list, total, imp }) => {
    const pct = conta.teto > 0 ? Math.min(total / conta.teto * 100, 100) : 0;
    const over = conta.teto > 0 && total > conta.teto;
    const color = over ? 'var(--red)' : (pct > 85 ? 'var(--yellow)' : 'var(--green)');
    const custoMes = gCustoMensalConta(conta.id, chave);

    // PF: barra em 2 fatias — isento (até o custo mensal) + tributável (o que passa)
    let meterHtml;
    if (conta.teto > 0 && conta.tipo === 'PF') {
      const isento = Math.min(total, custoMes);
      const tributavel = Math.max(0, total - custoMes);
      const wIsento = Math.min(isento / conta.teto * 100, 100);
      const wTrib = Math.min(tributavel / conta.teto * 100, 100 - wIsento);
      const markPos = Math.min(custoMes / conta.teto * 100, 100);
      const corTrib = over ? 'var(--red)' : 'var(--yellow)';
      meterHtml = `
      <div class="gmeter">
        <div class="fill" style="width:${wIsento}%;background:var(--green)"></div>
        ${wTrib > 0 ? `<div class="fill" style="width:${wTrib}%;background:${corTrib}"></div>` : ''}
        ${markPos > 0 && markPos < 100 ? `<div class="gmark" style="left:${markPos}%"
          title="Fim da isenção: até ${fmt(custoMes)} (custo mensal) não paga imposto"></div>` : ''}
      </div>
      <div class="gmeter-row"><span>${Math.round(total / conta.teto * 100)}% do teto</span>
        <b style="color:${tributavel > 0 ? corTrib : 'var(--green)'}">
          ${tributavel > 0 ? fmt(tributavel) + ' tributável' : fmt(custoMes - total) + ' ainda isento'}</b></div>
      <div class="gmeter-legenda">
        <span><i style="background:var(--green)"></i>isento (até o custo mensal)</span>
        <span><i style="background:${corTrib}"></i>tributável</span>
      </div>`;
    } else if (conta.teto > 0) {
      meterHtml = `
      <div class="gmeter"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="gmeter-row"><span>${Math.round(total / conta.teto * 100)}% do teto</span>
        <b style="color:${color}">${fmt(conta.teto - total)} livre</b></div>`;
    } else {
      meterHtml = '<div style="margin-bottom:14px"></div>';
    }

    return `<div class="gacct" data-drop="${conta.id}">
      <div class="at"><b>${gEsc(conta.nome)}</b><span class="tp">${conta.tipo}</span></div>
      <div class="tot">${fmt(total)}</div>
      <div class="ceil">${conta.teto > 0 ? 'de ' + fmt(conta.teto) + ' de teto' : 'sem teto definido'}</div>
      ${meterHtml}
      <div class="gchips" data-drop="${conta.id}">
        ${list.map(chipHtml).join('') || '<div class="gempty" style="padding:14px 6px">Solte clientes aqui</div>'}
      </div>
      <div class="gest">
        <span>Imposto estimado${conta.tipo === 'PF' ? `<small>custo mensal: ${fmt(custoMes)} · base: ${fmt(imp.base)}</small>` : ''}</span>
        <span style="text-align:right"><span class="pct" style="color:${color}">${imp.pct}%</span>
          <small>${fmt(imp.valor)}</small></span>
      </div>
    </div>`;
  }).join('');

  if (semConta.length) {
    html += `<div class="gacct gpool" data-drop="">
      <div class="at"><b>A distribuir</b><span class="tp">—</span></div>
      <div class="tot">${fmt(semConta.reduce((s, l) => s + gNum(l.faturamento), 0))}</div>
      <div class="ceil">clientes sem conta neste mês</div>
      <div class="gchips" data-drop="">${semConta.map(chipHtml).join('')}</div>
      <div class="gest"><span>Use 🪄 para o motor alocar</span></div>
    </div>`;
  }

  cols.innerHTML = html || `<div class="gempty">Nenhum lançamento em ${gChaveLabel(chave)}.<br>Importe uma planilha ou crie lançamentos nos clientes.</div>`;

  // drag & drop
  let dragged = null;
  cols.querySelectorAll('.gchip[draggable="true"]').forEach(ch => {
    ch.ondragstart = () => { dragged = ch.dataset.lanc; ch.classList.add('dragging'); };
    ch.ondragend = () => ch.classList.remove('dragging');
  });
  cols.querySelectorAll('.gacct').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('dragover'); };
    col.ondragleave = () => col.classList.remove('dragover');
    col.ondrop = async e => {
      e.preventDefault(); col.classList.remove('dragover');
      if (!dragged) return;
      const l = G.lanc.find(x => x.id === dragged);
      const destino = col.dataset.drop || null;
      if (l && (gCli(l.cliente_id) || {}).conta_modo !== 'fixa') {
        l.conta_id = destino;
        l.alocacao_manual = !!destino;
        await gdbUpsert('clientes_lancamentos', l);
        gRenderDist();
      }
      dragged = null;
    };
  });
}

// ═══════════════════════════════════════
//  TELA: CUSTOS
// ═══════════════════════════════════════
function gRenderCustos() {
  const chave = G.mesAtivo;
  const desp = gDespesasDoMes(chave).sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

  document.getElementById('gCustosTot').innerHTML = G.contas.map(c => {
    const tot = desp.filter(d => d.conta_id === c.id).reduce((s, d) => s + gNum(d.valor), 0);
    return `<div class="gct"><div class="l">${gEsc(c.nome)}</div><div class="v">${fmt(tot)}</div></div>`;
  }).join('') + `<div class="gct"><div class="l">Total do mês</div>
    <div class="v" style="color:var(--yellow)">${fmt(desp.reduce((s, d) => s + gNum(d.valor), 0))}</div></div>`;

  gRenderCustosBanner(chave, desp);

  const body = document.getElementById('gCustosBody');
  if (!desp.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="gempty">Nenhuma despesa em ${gChaveLabel(chave)}.<br>
      Suba a planilha de despesas, lance manualmente, ou traga as despesas já importadas na página inicial.<br>
      As despesas da conta PF definem até quanto os clientes com NF entram lá sem imposto.</div></td></tr>`;
  } else {
    body.innerHTML = desp.map(d => `
      <tr onclick="gAbrirNovaDespesa(null,'${d.id}')" title="Clique para editar">
        <td style="font-weight:600">${gEsc(d.descricao)}
          ${d.origem ? '<span class="gbadge-auto" title="Importada de planilha">planilha</span>' : ''}</td>
        <td class="gacct-tag">${(gConta(d.conta_id) || { nome: '—' }).nome}</td>
        <td><span class="gpill ${d.tipo === 'fixo' ? 'fix' : 'var'}">${d.tipo === 'fixo' ? 'Fixo' : 'Variável'}</span></td>
        <td class="num">${fmt(gNum(d.valor))}</td>
        <td class="num">${d.data ? d.data.split('-').reverse().slice(0, 2).join('/') : '—'}</td>
        <td class="num">
          <button class="gdel" title="Editar" onclick="event.stopPropagation();gAbrirNovaDespesa(null,'${d.id}')">✏️</button>
          <button class="gdel" title="Excluir" onclick="event.stopPropagation();gExcluirDespesa('${d.id}')">🗑️</button>
        </td>
      </tr>`).join('');
  }
}

// banner: despesas subidas na página inicial do Metrik (totais mensais) ainda não trazidas
function gRenderCustosBanner(chave, desp) {
  const el = document.getElementById('gCustosBanner');
  el.innerHTML = '';
  if (G.demo || typeof parsedExpenses === 'undefined') return;
  const totalMetrik = gNum(parsedExpenses[chave]);
  if (!(totalMetrik > 0)) return;
  // se alguma despesa importada de planilha já existe no mês, não oferece de novo
  const jaImportado = desp.some(d => d.origem);
  if (jaImportado) return;
  el.innerHTML = `
    <div class="gdist-note" style="margin-bottom:16px;justify-content:space-between">
      <span>📥 A planilha de despesas da página inicial tem <b>${fmt(totalMetrik)}</b> em ${gChaveLabel(chave)} —
        traga para cá para o motor considerar no cálculo do imposto.</span>
      <button class="gbtn" style="flex-shrink:0" onclick="gImportarDespesasMetrik('${chave}')">Trazer para a gestão</button>
    </div>`;
}

function gImportarDespesasMetrik(chave) {
  const total = gNum(parsedExpenses[chave]);
  gModal(`
    <div class="metrik-modal-title">📥 Trazer despesas de ${gChaveLabel(chave)}</div>
    <div class="metrik-modal-sub">A página inicial guarda só o total do mês (${fmt(total)}).
      Escolha em qual conta ele entra — depois você pode dividir editando ou subindo a planilha detalhada aqui.</div>
    <div class="gform">
      <div class="gform-row">
        <div class="gfield"><label>Conta</label>
          <select id="gimConta">${G.contas.map(c => `<option value="${c.id}" ${c.tipo === 'PF' ? 'selected' : ''}>${gEsc(c.nome)}</option>`).join('')}</select></div>
        <div class="gfield"><label>Tipo</label>
          <select id="gimTipo"><option value="fixo">Fixo</option><option value="variavel" selected>Variável</option></select></div>
      </div>
    </div>
    <div class="metrik-modal-footer">
      <button class="metrik-modal-btn-confirm" onclick="gConfirmarImportDespesasMetrik('${chave}')">Trazer ${fmt(total)}</button>
      <button class="metrik-modal-btn-cancel" onclick="gFecharModal()">Cancelar</button>
    </div>`);
}

async function gConfirmarImportDespesasMetrik(chave) {
  const total = gNum(parsedExpenses[chave]);
  const d = {
    id: gId(), empresa_id: gEmpresaId(),
    conta_id: document.getElementById('gimConta').value,
    chave, descricao: 'Despesas da planilha (' + gChaveLabel(chave) + ')',
    tipo: document.getElementById('gimTipo').value,
    valor: total, data: chave + '-01', origem: 'metrik',
  };
  G.despesas.push(d);
  await gdbUpsert('despesas_contas', d);
  gFecharModal();
  await gDistribuirMes(chave, false);
  showToast('✓ Despesas trazidas — clique nelas para ajustar conta e tipo.');
  gRenderAll();
}

// upload da planilha de despesas (mesmo formato da página inicial: itens nas linhas × meses nas colunas)
function gHandleDespesasFile(e) {
  const file = (e.target.files || [])[0];
  e.target.value = '';
  if (file) gLerPlanilhaDespesas(file);
}

async function gLerPlanilhaDespesas(file) {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (!rows.length) throw new Error('Planilha vazia.');

    // coluna de rótulo (descrição da despesa) — mesma heurística da página inicial
    const keys = Object.keys(rows[0]);
    const LABELS = ['PASSIVO', 'PASSIVOS', 'DESPESA', 'DESPESAS', 'CATEGORIA', 'ITEM', 'DESCRICAO', 'TIPO'];
    let labelCol = keys.find(k => LABELS.includes(normStr(k)) || k === '' || k.startsWith('__EMPTY'));
    if (!labelCol) labelCol = keys[0];

    // colunas de mês
    const anoArquivo = (file.name.match(/\b(20\d{2})\b/) || [])[1];
    const monthCols = [];
    for (const k of keys) {
      if (k === labelCol) continue;
      let chave = gParseMesCell(k);
      // cabeçalho só com o nome do mês assume o ano atual — se o nome do arquivo tem ano, usa ele
      if (chave && anoArquivo && !/\d{4}/.test(String(k)) && !/[\/\-]\s*\d{2}\s*$/.test(String(k))) {
        chave = anoArquivo + chave.slice(4);
      }
      if (chave && !monthCols.find(mc => mc.chave === chave)) monthCols.push({ col: k, chave });
    }
    if (!monthCols.length) throw new Error('Não encontrei colunas de mês (ex: Janeiro, Fev/25, 01/2025).');

    const SKIP = ['TOTAL', 'TOTAIS', 'SOMA', 'SUBTOTAL', 'TOTAL GERAL', 'GRAND TOTAL'];
    const itens = [];
    for (const row of rows) {
      const label = String(row[labelCol] || '').trim();
      if (!label) continue;
      const ln = normStr(label);
      if (SKIP.includes(ln) || ln.startsWith('TOTAL ') || ln.startsWith('GRAND ')) continue;
      for (const mc of monthCols) {
        const v = typeof row[mc.col] === 'number' ? row[mc.col] : parseBrNum(row[mc.col]);
        if (v > 0) itens.push({ descricao: label, chave: mc.chave, valor: v });
      }
    }
    if (!itens.length) throw new Error('Nenhuma despesa com valor encontrada.');

    G._despesasPendentes = itens;
    const meses = [...new Set(itens.map(i => i.chave))].sort();
    gModal(`
      <div class="metrik-modal-title">📂 ${itens.length} despesas encontradas</div>
      <div class="metrik-modal-sub"><b>${gEsc(file.name)}</b> — ${meses.map(gChaveLabel).join(', ')}.
        Escolha a conta padrão; depois clique em cada despesa na lista para ajustar conta e fixo/variável.</div>
      <div class="gform">
        <div class="gform-row">
          <div class="gfield"><label>Conta padrão</label>
            <select id="gpdConta">${G.contas.map(c => `<option value="${c.id}" ${c.tipo === 'PF' ? 'selected' : ''}>${gEsc(c.nome)}</option>`).join('')}</select></div>
          <div class="gfield"><label>Tipo padrão</label>
            <select id="gpdTipo"><option value="fixo">Fixo</option><option value="variavel" selected>Variável</option></select></div>
        </div>
      </div>
      <div class="metrik-modal-footer">
        <button class="metrik-modal-btn-confirm" onclick="gConfirmarPlanilhaDespesas()">Importar despesas</button>
        <button class="metrik-modal-btn-cancel" onclick="gFecharModal()">Cancelar</button>
      </div>`);
  } catch (err) {
    console.error('Erro na planilha de despesas:', err);
    showToast('✕ ' + (err.message || 'Erro ao ler a planilha de despesas.'), true);
  }
}

async function gConfirmarPlanilhaDespesas() {
  const itens = G._despesasPendentes || [];
  G._despesasPendentes = null;
  const contaId = document.getElementById('gpdConta').value;
  const tipo = document.getElementById('gpdTipo').value;
  gFecharModal();

  const chaves = [...new Set(itens.map(i => i.chave))];
  // substitui importações anteriores desses meses (evita duplicar ao re-subir)
  for (const d of G.despesas.filter(d => d.origem && chaves.includes(d.chave))) {
    await gdbDelete('despesas_contas', d.id);
  }
  G.despesas = G.despesas.filter(d => !(d.origem && chaves.includes(d.chave)));

  const novos = itens.map(i => ({
    id: gId(), empresa_id: gEmpresaId(), conta_id: contaId, chave: i.chave,
    descricao: i.descricao, tipo, valor: i.valor, data: i.chave + '-01', origem: 'planilha',
  }));
  G.despesas.push(...novos);
  if (!gSomenteLocal()) {
    const { error } = await _sb.from('despesas_contas').upsert(novos);
    if (error) { console.error(error); showToast('Erro ao salvar despesas.', true); }
  }

  // espelha os totais na página inicial (dashboard financeiro) — mesmo efeito de subir lá
  if (typeof parsedExpenses !== 'undefined') {
    for (const ch of chaves) {
      const tot = novos.filter(n => n.chave === ch).reduce((s, n) => s + gNum(n.valor), 0);
      parsedExpenses[ch] = tot;
      if (!gSomenteLocal() && gEmpresaId()) {
        const [ano, mes] = ch.split('-');
        await _sb.from('despesas').upsert({
          empresa_id: gEmpresaId(), chave: ch, ano: parseInt(ano), mes: parseInt(mes), total: tot,
        }, { onConflict: 'empresa_id,chave' });
      }
    }
  }

  for (const ch of chaves) await gDistribuirMes(ch, false);
  if (!G.mesAtivo || !gMesesDisponiveis().includes(G.mesAtivo)) G.mesAtivo = chaves.sort().pop();
  showToast(`✓ ${novos.length} despesas importadas em ${chaves.length} ${chaves.length > 1 ? 'meses' : 'mês'}.`);
  gRenderAll();
}

function gAbrirNovaDespesa(_, editId) {
  const d = editId ? G.despesas.find(x => x.id === editId) : null;
  const hoje = d ? (d.data || d.chave + '-05') : (G.mesAtivo || gChaveHoje()) + '-05';
  gModal(`
    <div class="metrik-modal-title">${d ? '✏️ Editar despesa' : '＋ Nova despesa'}</div>
    <div class="metrik-modal-sub">Despesas da conta PF aumentam a fatia de clientes com NF que entra sem imposto.</div>
    <div class="gform">
      <div class="gfield"><label>Descrição</label>
        <input id="gdDesc" type="text" value="${d ? gEsc(d.descricao) : ''}" placeholder="Ex: Contador"></div>
      <div class="gform-row">
        <div class="gfield"><label>Conta</label>
          <select id="gdConta">${G.contas.map(c => `<option value="${c.id}" ${d && d.conta_id === c.id ? 'selected' : ''}>${gEsc(c.nome)}</option>`).join('')}</select></div>
        <div class="gfield"><label>Tipo</label>
          <select id="gdTipo">
            <option value="fixo" ${d && d.tipo === 'fixo' ? 'selected' : ''}>Fixo</option>
            <option value="variavel" ${!d || d.tipo === 'variavel' ? 'selected' : ''}>Variável</option>
          </select></div>
      </div>
      <div class="gform-row">
        <div class="gfield"><label>Valor</label>
          <input id="gdValor" type="text" value="${d ? fmt(gNum(d.valor)) : ''}" placeholder="R$ 0,00"></div>
        <div class="gfield"><label>Data</label><input id="gdData" type="date" value="${hoje}"></div>
      </div>
    </div>
    <div class="metrik-modal-footer">
      <button class="metrik-modal-btn-confirm" onclick="gSalvarDespesa(${d ? `'${d.id}'` : 'null'})">Salvar despesa</button>
      <button class="metrik-modal-btn-cancel" onclick="gFecharModal()">Cancelar</button>
    </div>`);
}

async function gSalvarDespesa(editId) {
  const desc = document.getElementById('gdDesc').value.trim();
  const valor = parseBrNum(document.getElementById('gdValor').value);
  const data = document.getElementById('gdData').value;
  if (!desc || !(valor > 0) || !data) { showToast('Preencha descrição, valor e data.', true); return; }

  let d = editId ? G.despesas.find(x => x.id === editId) : null;
  const chaveAnterior = d ? d.chave : null;
  if (!d) {
    d = { id: gId(), empresa_id: gEmpresaId(), origem: null };
    G.despesas.push(d);
  }
  d.conta_id = document.getElementById('gdConta').value;
  d.chave = data.slice(0, 7);
  d.descricao = desc;
  d.tipo = document.getElementById('gdTipo').value;
  d.valor = valor;
  d.data = data;
  await gdbUpsert('despesas_contas', d);
  gFecharModal();
  if (!G.mesAtivo) G.mesAtivo = d.chave;
  if (chaveAnterior && chaveAnterior !== d.chave) await gDistribuirMes(chaveAnterior, false);
  await gDistribuirMes(d.chave, false); // custo da PF mudou → pode abrir espaço p/ clientes NF
  showToast(editId ? '✓ Despesa atualizada.' : '✓ Despesa lançada.');
  gRenderAll();
}

async function gExcluirDespesa(id) {
  const idx = G.despesas.findIndex(d => d.id === id);
  if (idx < 0) return;
  const chave = G.despesas[idx].chave;
  G.despesas.splice(idx, 1);
  await gdbDelete('despesas_contas', id);
  await gDistribuirMes(chave, false);
  gRenderAll();
}

// ═══════════════════════════════════════
//  TELA: PAINEL
// ═══════════════════════════════════════
function gTotaisMes(chave) {
  const lancs = gLancsDoMes(chave);
  const fat = lancs.reduce((s, l) => s + gNum(l.faturamento), 0);
  const custoDireto = lancs.reduce((s, l) => s + gNum(l.custo), 0);
  const despesas = gDespesasDoMes(chave).reduce((s, d) => s + gNum(d.valor), 0);
  let imposto = 0;
  G.contas.forEach(c => {
    const tot = lancs.filter(l => l.conta_id === c.id).reduce((s, l) => s + gNum(l.faturamento), 0);
    imposto += gImpostoConta(c, tot, chave).valor;
  });
  return { fat, custoDireto, despesas, custos: custoDireto + despesas, imposto, lucro: fat - custoDireto - despesas - imposto };
}

function gRenderPainel() {
  const chave = G.mesAtivo;
  const meses = gMesesDisponiveis();
  const t = gTotaisMes(chave);
  const idx = meses.indexOf(chave);
  const prev = idx > 0 ? gTotaisMes(meses[idx - 1]) : null;

  const deltaHtml = (atual, anterior, invert = false) => {
    if (!isFinite(atual) || !isFinite(anterior) || !anterior) return '';
    const d = (atual - anterior) / Math.abs(anterior) * 100;
    const bom = invert ? d <= 0 : d >= 0;
    return `<div class="kpi-delta ${bom ? 'delta-up' : 'delta-down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}% vs. mês anterior</div>`;
  };

  document.getElementById('gKpis').innerHTML = `
    <div class="kpi" style="--kc:var(--accent)"><div class="kpi-lbl">Faturamento</div>
      <div class="kpi-val">${fmt(t.fat)}</div>${prev ? deltaHtml(t.fat, prev.fat) : ''}</div>
    <div class="kpi" style="--kc:var(--yellow)"><div class="kpi-lbl">Custos (diretos + despesas)</div>
      <div class="kpi-val">${fmt(t.custos)}</div>${prev ? deltaHtml(t.custos, prev.custos, true) : ''}</div>
    <div class="kpi" style="--kc:var(--red)"><div class="kpi-lbl">Imposto estimado</div>
      <div class="kpi-val">${fmt(t.imposto)}</div>${prev ? deltaHtml(t.imposto, prev.imposto, true) : ''}</div>
    <div class="kpi" style="--kc:var(--green)"><div class="kpi-lbl">Lucro</div>
      <div class="kpi-val">${fmt(t.lucro)}</div>${prev ? deltaHtml(t.lucro, prev.lucro) : ''}</div>`;

  gRenderTrendGestao();

  // lucro por categoria
  const lancs = gLancsDoMes(chave);
  const porTier = { Black: 0, Gold: 0, Classico: 0 };
  lancs.forEach(l => {
    const cli = gCli(l.cliente_id); if (!cli) return;
    porTier[gTierEfetivo(cli, chave)] += gLucroReal(l);
  });
  const totalTier = Object.values(porTier).reduce((s, v) => s + Math.max(v, 0), 0);
  document.getElementById('gLucroCat').innerHTML = ['Black', 'Gold', 'Classico'].map(tr => `
    <div class="gsplit-row">
      <div class="nm"><span class="gswatch" style="background:${G_TIER_COLOR[tr]}"></span>${G_TIER_LABEL[tr]}</div>
      <div class="amt">${fmt(porTier[tr])}<small>${totalTier > 0 ? Math.round(Math.max(porTier[tr], 0) / totalTier * 100) + '%' : '—'}</small></div>
    </div>`).join('') || '<div class="gempty">Sem dados</div>';

  // resultado por conta
  document.getElementById('gResultConta').innerHTML = G.contas.map(c => {
    const tot = lancs.filter(l => l.conta_id === c.id).reduce((s, l) => s + gNum(l.faturamento), 0);
    const imp = gImpostoConta(c, tot, chave);
    return `<div class="gsplit-row">
      <div class="nm">${gEsc(c.nome)} <span class="tp" style="font-size:10px;color:var(--muted)">${c.tipo}</span></div>
      <div class="amt">${fmt(tot)}<small>imposto ${fmt(imp.valor)}</small></div>
    </div>`;
  }).join('');

  // avisos
  const avisos = [];
  G.contas.forEach(c => {
    if (!(c.teto > 0)) return;
    const tot = lancs.filter(l => l.conta_id === c.id).reduce((s, l) => s + gNum(l.faturamento), 0);
    const uso = tot / c.teto * 100;
    if (uso > 100) avisos.push({ icone: '🚨', cor: 'var(--red)', t: `${c.nome} estourou o teto`, p: `${fmt(tot)} de ${fmt(c.teto)} (${Math.round(uso)}%). Remaneje clientes.` });
    else if (uso >= 85) avisos.push({ icone: '⚠️', cor: 'var(--yellow)', t: `${c.nome} a ${Math.round(uso)}% do teto`, p: `${fmt(tot)} de ${fmt(c.teto)}. Avalie remanejar um cliente.` });
  });
  const upgrades = G.clientes.filter(c => c.tier_modo === 'manual' &&
    G_TIER_ORDEM[gTierSugeridoCliente(c, chave)] > G_TIER_ORDEM[c.tier || 'Classico'] && gLancDe(c.id, chave));
  if (upgrades.length) avisos.push({
    icone: '✅', cor: 'var(--green)',
    t: `${upgrades.length} cliente${upgrades.length > 1 ? 's' : ''} pronto${upgrades.length > 1 ? 's' : ''} para subir de categoria`,
    p: upgrades.slice(0, 3).map(c => c.nome).join(', ') + (upgrades.length > 3 ? '…' : '') + ' — margem e recorrência cruzaram o limite.',
  });
  const semConta = lancs.filter(l => !l.conta_id).length;
  if (semConta) avisos.push({ icone: '📦', cor: 'var(--yellow)', t: `${semConta} cliente${semConta > 1 ? 's' : ''} sem conta`, p: 'Vá em Distribuição e use 🪄 para o motor alocar.' });
  const pf = G.contas.find(c => c.tipo === 'PF');
  if (pf) {
    const totPf = lancs.filter(l => l.conta_id === pf.id).reduce((s, l) => s + gNum(l.faturamento), 0);
    const custoPf = gCustoMensalConta(pf.id, chave);
    if (custoPf > 0 && totPf < custoPf - 0.005) {
      avisos.push({
        icone: '💡', cor: 'var(--accent)', t: `Folga de ${fmt(custoPf - totPf)} na ${pf.nome}`,
        p: 'Dá para alocar mais clientes com NF na PF sem pagar imposto (até cobrir o custo mensal).',
      });
    }
  }
  document.getElementById('gAvisos').innerHTML = avisos.length ? avisos.map(a => `
    <div class="galert">
      <div class="ab" style="background:color-mix(in srgb,${a.cor} 14%,transparent)">${a.icone}</div>
      <div><b>${a.t}</b><p>${a.p}</p></div>
    </div>`).join('') : '<div class="gempty">Tudo em ordem por aqui ✓</div>';
}

function gRenderTrendGestao() {
  const canvas = document.getElementById('gTrendChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const meses = gMesesDisponiveis().filter(m => m <= G.mesAtivo).slice(-6);
  const dados = meses.map(m => ({ m, ...gTotaisMes(m) }));
  if (G.trendChart) { try { G.trendChart.destroy(); } catch (e) { } }
  G.trendChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: dados.map(d => gChaveLabel(d.m).slice(0, 3) + ' ' + d.m.slice(2, 4)),
      datasets: [
        { label: 'Faturamento', data: dados.map(d => d.fat), backgroundColor: themeC('--accent') || '#5b8def', borderRadius: 4 },
        { label: 'Custos', data: dados.map(d => d.custos), backgroundColor: themeC('--chart-grid2') || 'rgba(255,255,255,.12)', borderRadius: 4 },
        { label: 'Imposto', data: dados.map(d => d.imposto), backgroundColor: themeC('--red') || '#e2705c', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: themeC('--muted2'), font: { size: 11 }, usePointStyle: true, pointStyleWidth: 10 } } },
      scales: {
        x: { ticks: { color: themeC('--muted'), font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: themeC('--muted'), font: { size: 10 }, callback: v => fmtK(v) }, grid: { color: themeC('--chart-grid') }, beginAtZero: true },
      },
    },
  });
}

// ═══════════════════════════════════════
//  IMPORTAÇÃO DE PLANILHA
// ═══════════════════════════════════════
function gDownloadTemplate() {
  if (typeof XLSX === 'undefined') { showToast('Abra o Metrik pelo index para baixar o template.', true); return; }
  const hoje = gChaveLabel(gChaveHoje());
  const dados = [
    ['Cliente', 'Faturamento', 'Custo', 'Horas', 'Mês'],
    ['Atlas Engenharia', 9200, 2100, 14, hoje],
    ['Verde Paisagismo', 6400, 1500, 11, hoje],
    ['Padaria Trigo Real', 2300, 900, 7, hoje],
  ];
  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'template-gestao-clientes.xlsx');
}

const G_MESES_NOME = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

function gParseMesCell(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) {
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0');
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) { // serial do Excel
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-\/](\d{1,2})/);                     // 2026-06 | 2026/06
  if (m) return m[1] + '-' + String(+m[2]).padStart(2, '0');
  m = s.match(/^(\d{1,2})[-\/](\d{4})$/);                        // 06/2026
  if (m) return m[2] + '-' + String(+m[1]).padStart(2, '0');
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);          // 15/06/2026
  if (m) return m[3] + '-' + String(+m[2]).padStart(2, '0');
  const norm = normStr(s);                                       // JUNHO 2026 | JUN/26
  m = norm.match(/^([A-Z]+)\s*[\/\-]?\s*(\d{2,4})$/);
  if (m && G_MESES_NOME[m[1]]) {
    let ano = +m[2]; if (ano < 100) ano += 2000;
    return ano + '-' + String(G_MESES_NOME[m[1]]).padStart(2, '0');
  }
  if (G_MESES_NOME[norm]) { // só o nome do mês → assume ano atual
    return new Date().getFullYear() + '-' + String(G_MESES_NOME[norm]).padStart(2, '0');
  }
  return null;
}

function gAchaColuna(headers, candidatos) {
  for (let i = 0; i < headers.length; i++) {
    const h = normStr(headers[i]);
    if (!h) continue;
    for (const c of candidatos) {
      if (h === c || h.startsWith(c + ' ') || h.includes(c)) return i;
    }
  }
  return -1;
}

function gHandleFiles(e) {
  const files = [...(e.target.files || [])];
  e.target.value = '';
  files.forEach(f => gLerArquivo(f));
}

async function gLerArquivo(file) {
  const fb = document.getElementById('gImportFeedback');
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    if (!rows.length) throw new Error('Planilha vazia.');

    // acha a linha de cabeçalho (primeira com "cliente"/"nome")
    let hIdx = -1, cols = null;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const iNome = gAchaColuna(rows[i] || [], ['CLIENTE', 'NOME', 'PACIENTE']);
      const iFat = gAchaColuna(rows[i] || [], ['FATURAMENTO', 'VALOR', 'RECEITA', 'TOTAL']);
      if (iNome >= 0 && iFat >= 0) {
        hIdx = i;
        cols = {
          nome: iNome, fat: iFat,
          custo: gAchaColuna(rows[i], ['CUSTO', 'DESPESA']),
          horas: gAchaColuna(rows[i], ['HORAS', 'TEMPO']),
          mes: gAchaColuna(rows[i], ['MES', 'COMPETENCIA', 'PERIODO', 'DATA']),
        };
        break;
      }
    }
    if (hIdx < 0) throw new Error('Não encontrei as colunas "Cliente" e "Faturamento". Baixe o template para ver o formato.');

    const registros = [];
    let semMes = 0;
    for (let i = hIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const nome = String(r[cols.nome] || '').trim();
      if (!nome) continue;
      const fat = typeof r[cols.fat] === 'number' ? r[cols.fat] : parseBrNum(r[cols.fat]);
      if (!(fat > 0)) continue;
      const chave = cols.mes >= 0 ? gParseMesCell(r[cols.mes]) : null;
      if (!chave) semMes++;
      registros.push({
        nome, chave,
        fat,
        custo: cols.custo >= 0 ? (typeof r[cols.custo] === 'number' ? r[cols.custo] : parseBrNum(r[cols.custo])) : 0,
        horas: cols.horas >= 0 ? gNum(typeof r[cols.horas] === 'number' ? r[cols.horas] : parseBrNum(r[cols.horas])) : 0,
      });
    }
    if (!registros.length) throw new Error('Nenhuma linha válida encontrada (Cliente + Faturamento > 0).');

    if (semMes > 0) {
      // pergunta o mês do arquivo para as linhas sem mês
      gModal(`
        <div class="metrik-modal-title">📅 Qual o mês desta planilha?</div>
        <div class="metrik-modal-sub">${semMes} de ${registros.length} linha${registros.length > 1 ? 's' : ''} de
          <b>${gEsc(file.name)}</b> não têm a coluna "Mês" preenchida.</div>
        <div class="gform"><div class="gfield"><label>Mês de competência</label>
          <select id="gImpMes">${gMesOptions(gChaveHoje())}</select></div></div>
        <div class="metrik-modal-footer">
          <button class="metrik-modal-btn-confirm" onclick="gConfirmarMesImport()">Importar</button>
          <button class="metrik-modal-btn-cancel" onclick="gFecharModal()">Cancelar</button>
        </div>`);
      G._importPendente = registros;
      return;
    }
    await gAplicarImport(registros, file.name);
  } catch (err) {
    console.error('Erro na importação:', err);
    fb.innerHTML = `<div style="margin-top:12px;background:color-mix(in srgb,var(--red) 10%,transparent);
      border:1px solid color-mix(in srgb,var(--red) 30%,transparent);border-radius:10px;padding:12px 16px;
      color:var(--red);font-size:13px">✕ ${gEsc(file.name)}: ${gEsc(err.message || 'erro ao ler o arquivo')}</div>`;
  }
}

async function gConfirmarMesImport() {
  const chave = document.getElementById('gImpMes').value;
  const regs = (G._importPendente || []).map(r => ({ ...r, chave: r.chave || chave }));
  G._importPendente = null;
  gFecharModal();
  await gAplicarImport(regs, 'planilha');
}

async function gAplicarImport(registros, origem) {
  // agrupa por cliente+mês (linhas repetidas somam)
  const grupo = new Map();
  registros.forEach(r => {
    const k = normStr(r.nome) + '|' + r.chave;
    const g = grupo.get(k) || { nome: r.nome, nome_norm: normStr(r.nome), chave: r.chave, fat: 0, custo: 0, horas: 0 };
    g.fat += r.fat; g.custo += r.custo; g.horas += r.horas;
    grupo.set(k, g);
  });

  const novos = [];
  const chaves = new Set();
  let atualizados = 0;

  for (const g of grupo.values()) {
    let cli = G.clientes.find(c => c.nome_norm === g.nome_norm);
    if (!cli) {
      cli = {
        id: gId(), empresa_id: gEmpresaId(), nome: g.nome, nome_norm: g.nome_norm,
        tier: 'Classico', tier_modo: 'auto', conta_id: null, conta_modo: 'auto',
        recorrencia: 'Mensal', emite_nf: false,
      };
      G.clientes.push(cli);
      novos.push(cli);
    }
    const [ano, mes] = g.chave.split('-').map(Number);
    let l = gLancDe(cli.id, g.chave);
    if (!l) {
      l = {
        id: gId(), empresa_id: gEmpresaId(), cliente_id: cli.id, chave: g.chave, mes, ano,
        conta_id: cli.conta_modo === 'fixa' ? cli.conta_id : null, alocacao_manual: false,
      };
      G.lanc.push(l);
    } else { atualizados++; }
    l.faturamento = g.fat; l.custo = g.custo; l.horas = g.horas;
    chaves.add(g.chave);
  }

  // persiste em lote
  if (!gSomenteLocal()) {
    if (novos.length) {
      const { error } = await _sb.from('clientes_gestao').upsert(novos);
      if (error) { console.error(error); showToast('Erro ao salvar clientes novos.', true); }
    }
    const lancsAfetados = G.lanc.filter(l => chaves.has(l.chave));
    const { error: e2 } = await _sb.from('clientes_lancamentos').upsert(lancsAfetados);
    if (e2) { console.error(e2); showToast('Erro ao salvar lançamentos.', true); }
  }

  // categorias automáticas + distribuição inteligente por mês afetado
  for (const ch of chaves) await gDistribuirMes(ch, false);
  for (const cli of G.clientes) {
    if (cli.tier_modo === 'auto') {
      const novoTier = gTierSugeridoCliente(cli, [...chaves].pop());
      if (novoTier !== cli.tier) { cli.tier = novoTier; await gdbUpsert('clientes_gestao', cli); }
    }
  }

  G.mesAtivo = [...chaves].sort().pop() || G.mesAtivo;

  const listaChaves = [...chaves].sort().map(gChaveLabel).join(', ');
  document.getElementById('gImportFeedback').innerHTML = `
    <div style="margin-top:12px;background:color-mix(in srgb,var(--green) 10%,transparent);
      border:1px solid color-mix(in srgb,var(--green) 28%,transparent);border-radius:10px;padding:12px 16px;
      color:var(--green);font-size:13px">
      ✓ ${grupo.size} lançamento${grupo.size > 1 ? 's' : ''} importado${grupo.size > 1 ? 's' : ''} (${listaChaves})
      · ${novos.length} cliente${novos.length !== 1 ? 's' : ''} novo${novos.length !== 1 ? 's' : ''}
      · ${atualizados} atualizado${atualizados !== 1 ? 's' : ''} · distribuição recalculada 🪄
    </div>`;

  if (novos.length) gRenderReviewNovos(novos);
  else document.getElementById('gImportReview').innerHTML = '';
  gRenderAll();
}

function gRenderReviewNovos(novos) {
  const wrap = document.getElementById('gImportReview');
  wrap.innerHTML = `
    <div class="card full">
      <div class="card-title"><span class="dot" style="background:var(--gold)"></span>
        ${novos.length} cliente${novos.length > 1 ? 's' : ''} novo${novos.length > 1 ? 's' : ''} — revise as regras
        <span style="font-size:11px;color:var(--muted);font-weight:400;margin-left:auto">essas escolhas viram permanentes para as próximas planilhas</span>
      </div>
      ${novos.map(c => {
    const sug = gTierSugeridoCliente(c, G.mesAtivo);
    return `<div class="greview-row" data-cli="${c.id}">
        <span class="rn">${gEsc(c.nome)} ${gTierBadge(sug, 'auto')}</span>
        <select class="gfilter rv-conta">
          <option value="auto" selected>Conta automática</option>
          ${G.contas.map(ct => `<option value="${ct.id}">Fixa: ${gEsc(ct.nome)}</option>`).join('')}
        </select>
        <select class="gfilter rv-tier">
          <option value="auto" selected>Categoria automática</option>
          <option value="Classico">Clássico</option><option value="Gold">Gold</option><option value="Black">Black</option>
        </select>
        <select class="gfilter rv-rec">
          <option value="Mensal" selected>Mensal</option><option value="Avulso">Avulso</option>
        </select>
        <label class="greview-chk"><input type="checkbox" class="rv-nf"> Emite NF</label>
      </div>`;
  }).join('')}
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="gbtn" onclick="gSalvarReviewNovos()">Salvar regras</button>
        <button class="gbtn ghost" onclick="document.getElementById('gImportReview').innerHTML=''">Deixar tudo automático</button>
      </div>
    </div>`;
}

async function gSalvarReviewNovos() {
  const rows = document.querySelectorAll('#gImportReview .greview-row');
  for (const row of rows) {
    const cli = gCli(row.dataset.cli);
    if (!cli) continue;
    const conta = row.querySelector('.rv-conta').value;
    const tier = row.querySelector('.rv-tier').value;
    cli.recorrencia = row.querySelector('.rv-rec').value;
    cli.emite_nf = row.querySelector('.rv-nf').checked;
    if (conta === 'auto') { cli.conta_modo = 'auto'; cli.conta_id = null; }
    else { cli.conta_modo = 'fixa'; cli.conta_id = conta; }
    if (tier === 'auto') { cli.tier_modo = 'auto'; cli.tier = gTierSugeridoCliente(cli); }
    else { cli.tier_modo = 'manual'; cli.tier = tier; }
    await gdbUpsert('clientes_gestao', cli);
  }
  document.getElementById('gImportReview').innerHTML = '';
  for (const ch of gMesesDisponiveis()) await gDistribuirMes(ch, false);
  showToast('✓ Regras salvas — próximas planilhas já aplicam tudo sozinhas.');
  gRenderAll();
}

// drag & drop na zona de importação
document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('gDropZone');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag');
    [...(e.dataTransfer.files || [])].forEach(f => {
      if (/\.(xlsx|xls)$/i.test(f.name)) gLerArquivo(f);
    });
  });
});

// ═══════════════════════════════════════
//  CONFIGURAÇÕES (contas, regras, faixas)
// ═══════════════════════════════════════
function gAbrirConfig() {
  G._contasRemovidas = [];
  const r = G.cfg.tier_regras || G_CFG_PADRAO().tier_regras;
  const contaRow = (c) => `
    <div class="gcfg-row gcfg-conta" data-id="${c.id || ''}">
      <input class="cc-nome" type="text" value="${gEsc(c.nome)}" placeholder="Nome da conta" style="flex:2;min-width:140px">
      <select class="cc-tipo">
        <option value="PJ" ${c.tipo === 'PJ' ? 'selected' : ''}>PJ</option>
        <option value="PF" ${c.tipo === 'PF' ? 'selected' : ''}>PF</option>
      </select>
      <input class="cc-teto" type="text" value="${c.teto > 0 ? fmt(c.teto) : ''}" placeholder="Teto mensal" style="width:130px">
      <button class="gdel" title="Remover conta" onclick="gRemoverContaRow(this)">🗑️</button>
    </div>`;
  const faixaRow = (f) => `
    <div class="gcfg-row gcfg-faixa">
      <span style="font-size:12px;color:var(--muted2)">até</span>
      <input class="fx-ate" type="number" min="1" max="999" value="${f.ate == null ? '' : f.ate}" placeholder="acima" style="width:76px">
      <span style="font-size:12px;color:var(--muted2)">% do teto →</span>
      <input class="fx-pct" type="number" min="0" max="60" step="0.5" value="${f.pct}" style="width:76px">
      <span style="font-size:12px;color:var(--muted2)">% de imposto</span>
      <button class="gdel" onclick="this.parentElement.remove()">🗑️</button>
    </div>`;

  gModal(`
    <div class="metrik-modal-title">⚙️ Contas & Regras</div>
    <div class="metrik-modal-sub">Tudo aqui alimenta a distribuição inteligente e a classificação automática.</div>

    <div class="gcfg-sec">Contas (PJ / PF)</div>
    <div id="gcfgContas">${G.contas.map(contaRow).join('')}</div>
    <button class="gbtn ghost" style="padding:7px 12px;font-size:12px" onclick="gAddContaRow()">＋ Adicionar conta</button>

    <div class="gcfg-sec">Custos</div>
    <div class="gform-row">
      <div class="gfield"><label>Custo da sua hora de trabalho</label>
        <input id="gcfgHora" type="text" value="${fmt(gNum(G.cfg.custo_hora))}"></div>
      <div class="gfield"><label>Custo mensal padrão da PF <span style="text-transform:none">(se o mês não tiver despesas)</span></label>
        <input id="gcfgPfPadrao" type="text" value="${fmt(gNum(G.cfg.pf_custo_padrao))}"></div>
    </div>

    <div class="gcfg-sec">Faixas de imposto estimado</div>
    <div style="font-size:11.5px;color:var(--muted2);margin-bottom:10px;line-height:1.5">
      A % é aplicada sobre o faturamento da conta (na PF, sobre o que passar do custo mensal).
      Deixe "até" vazio na última faixa (vale para acima do teto).</div>
    <div id="gcfgFaixas">${(G.cfg.imposto_faixas || []).map(faixaRow).join('')}</div>
    <button class="gbtn ghost" style="padding:7px 12px;font-size:12px" onclick="gAddFaixaRow()">＋ Adicionar faixa</button>

    <div class="gcfg-sec">Classificação automática</div>
    <div class="gcfg-row"><span style="font-size:12.5px;width:64px"><b class="gbadge gb-black" style="font-size:11px"><i></i>Black</b></span>
      <span style="font-size:12px;color:var(--muted2)">margem ≥</span>
      <input id="gcfgBlackMargem" type="number" min="0" max="100" value="${gNum(r.black?.margem)}" style="width:70px">%
      <span style="font-size:12px;color:var(--muted2)">e fatura ≥</span>
      <input id="gcfgBlackFat" type="text" value="${fmt(gNum(r.black?.faturamento))}" style="width:110px">
      <label class="greview-chk"><input id="gcfgBlackRec" type="checkbox" ${r.black?.recorrente ? 'checked' : ''}> só recorrentes</label>
    </div>
    <div class="gcfg-row"><span style="font-size:12.5px;width:64px"><b class="gbadge gb-gold" style="font-size:11px"><i></i>Gold</b></span>
      <span style="font-size:12px;color:var(--muted2)">margem ≥</span>
      <input id="gcfgGoldMargem" type="number" min="0" max="100" value="${gNum(r.gold?.margem)}" style="width:70px">%
      <label class="greview-chk"><input id="gcfgGoldRec" type="checkbox" ${r.gold?.recorrente ? 'checked' : ''}> só recorrentes</label>
    </div>
    <div style="font-size:11.5px;color:var(--muted);margin-top:4px">Quem não atingir Gold é Clássico.</div>

    <div class="metrik-modal-footer">
      <button class="metrik-modal-btn-confirm" onclick="gSalvarConfig()">Salvar tudo</button>
      <button class="metrik-modal-btn-cancel" onclick="gFecharModal()">Cancelar</button>
    </div>`, 640);
}

function gAddContaRow() {
  const div = document.createElement('div');
  div.className = 'gcfg-row gcfg-conta';
  div.dataset.id = '';
  div.innerHTML = `
    <input class="cc-nome" type="text" placeholder="Nome da conta" style="flex:2;min-width:140px">
    <select class="cc-tipo"><option value="PJ">PJ</option><option value="PF">PF</option></select>
    <input class="cc-teto" type="text" placeholder="Teto mensal" style="width:130px">
    <button class="gdel" onclick="gRemoverContaRow(this)">🗑️</button>`;
  document.getElementById('gcfgContas').appendChild(div);
}
function gRemoverContaRow(btn) {
  const row = btn.closest('.gcfg-conta');
  if (row.dataset.id) G._contasRemovidas.push(row.dataset.id);
  row.remove();
}
function gAddFaixaRow() {
  const div = document.createElement('div');
  div.className = 'gcfg-row gcfg-faixa';
  div.innerHTML = `
    <span style="font-size:12px;color:var(--muted2)">até</span>
    <input class="fx-ate" type="number" min="1" max="999" placeholder="acima" style="width:76px">
    <span style="font-size:12px;color:var(--muted2)">% do teto →</span>
    <input class="fx-pct" type="number" min="0" max="60" step="0.5" style="width:76px">
    <span style="font-size:12px;color:var(--muted2)">% de imposto</span>
    <button class="gdel" onclick="this.parentElement.remove()">🗑️</button>`;
  document.getElementById('gcfgFaixas').appendChild(div);
}

async function gSalvarConfig() {
  // contas
  const rows = [...document.querySelectorAll('#gcfgContas .gcfg-conta')];
  const novasContas = [];
  for (let i = 0; i < rows.length; i++) {
    const nome = rows[i].querySelector('.cc-nome').value.trim();
    if (!nome) { showToast('Toda conta precisa de um nome.', true); return; }
    const id = rows[i].dataset.id || gId();
    novasContas.push({
      id, empresa_id: gEmpresaId(), nome,
      tipo: rows[i].querySelector('.cc-tipo').value,
      teto: parseBrNum(rows[i].querySelector('.cc-teto').value),
      ordem: i,
    });
  }
  if (!novasContas.length) { showToast('Cadastre pelo menos uma conta.', true); return; }

  // faixas
  const faixas = [...document.querySelectorAll('#gcfgFaixas .gcfg-faixa')].map(row => {
    const ate = row.querySelector('.fx-ate').value;
    return { ate: ate === '' ? null : gNum(ate), pct: gNum(row.querySelector('.fx-pct').value) };
  }).filter(f => f.pct >= 0);
  if (!faixas.length) { showToast('Cadastre pelo menos uma faixa de imposto.', true); return; }

  // aplica remoções de conta
  for (const id of (G._contasRemovidas || [])) {
    G.despesas = G.despesas.filter(d => d.conta_id !== id);
    G.lanc.forEach(l => { if (l.conta_id === id) { l.conta_id = null; l.alocacao_manual = false; } });
    G.clientes.forEach(c => { if (c.conta_id === id) { c.conta_id = null; c.conta_modo = 'auto'; } });
    await gdbDelete('contas', id);
  }

  G.contas = novasContas;
  if (!gSomenteLocal()) {
    const { error } = await _sb.from('contas').upsert(novasContas);
    if (error) { console.error(error); showToast('Erro ao salvar contas.', true); }
  }

  G.cfg.custo_hora = parseBrNum(document.getElementById('gcfgHora').value) || 90;
  G.cfg.pf_custo_padrao = parseBrNum(document.getElementById('gcfgPfPadrao').value);
  G.cfg.imposto_faixas = faixas;
  G.cfg.tier_regras = {
    black: {
      margem: gNum(document.getElementById('gcfgBlackMargem').value),
      faturamento: parseBrNum(document.getElementById('gcfgBlackFat').value),
      recorrente: document.getElementById('gcfgBlackRec').checked,
    },
    gold: {
      margem: gNum(document.getElementById('gcfgGoldMargem').value),
      recorrente: document.getElementById('gcfgGoldRec').checked,
    },
  };
  await gdbSalvarCfg();

  // recalcula categorias automáticas e redistribui
  for (const cli of G.clientes) {
    if (cli.tier_modo === 'auto') {
      const t = gTierSugeridoCliente(cli);
      if (t !== cli.tier) { cli.tier = t; await gdbUpsert('clientes_gestao', cli); }
    }
  }
  for (const ch of gMesesDisponiveis()) await gDistribuirMes(ch, false);

  gFecharModal();
  showToast('✓ Configurações salvas.');
  gRenderAll();
}

// ═══════════════════════════════════════
//  INTEGRAÇÃO COM O RESTO DO METRIK
// ═══════════════════════════════════════
// chamado por empresas.js ao entrar em empresa / modo teste
function gResetEmpresa() {
  G.loadedFor = undefined;
  G.mesAtivo = null;
  G.tab = 'painel';
  G.detalheId = null;
  G.demo = false;
  G._backup = null;
  const btn = document.getElementById('btnGestaoUpload');
  if (btn) btn.style.display = 'inline-flex';
}

// tema trocou → re-renderiza os gráficos da gestão
window.addEventListener('themechange', () => {
  const g = document.getElementById('gestaoScreen');
  if (g && g.style.display === 'block') gRenderAll();
});
