// ═══════════════════════════════════════
//  PLURAL INTELIGENTE EM PORTUGUÊS
// ═══════════════════════════════════════
function pluralizar(palavra) {
  if (!palavra) return palavra;
  const p = palavra.trim();
  const lower = p.toLowerCase();
  if (/ns$|is$|es$/.test(lower)) return p;
  if (/s$/.test(lower) && !/[aeiou]s$/.test(lower)) return p;
  if (/al$/.test(lower)) return p.slice(0, -2) + 'ais';
  if (/el$/.test(lower)) return p.slice(0, -2) + 'éis';
  if (/il$/.test(lower)) return p.slice(0, -2) + 'is';
  if (/ol$/.test(lower)) return p.slice(0, -2) + 'óis';
  if (/ul$/.test(lower)) return p.slice(0, -2) + 'uis';
  if (/ão$/.test(lower)) return p.slice(0, -2) + 'ões';
  if (/m$/.test(lower)) return p.slice(0, -1) + 'ns';
  if (/r$|z$|n$/.test(lower)) return p + 'es';
  if (/s$/.test(lower)) return p;
  return p + 's';
}

// ═══════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════
let MONTHS = [], YEARS = {};
let activeMonth = 0, activeYear = null;
let cmpItems = [];
let dentSort = 'taxa', activeDentFilter = 'all';
let parsedExpenses = {}, parsedMonths = {};
let parsedFaturamento = {};
let _finModoReceita = 'aprovados';
let clinicGoal = 0;
let _despChartInst = null, _trendChartInst = null;
let _finYearGrowthChart = null, _finYearLucroChart = null;
let _dentChartInstance = null, _dentChartMetric = 'faturamento', _dentChartData = null;
let _rangeFilter = null, _rangeFilteredData = null;
let _finView = null;
let _vendedoresSelecionados = new Set();
let _detectionLogs = [];
let _canalDonutChart = null;
let _vendedorTrendChart = null;
let _vendedorMetric = 'conversao';
let _notas = {};
let _metasMensais = {};
let _benchmarks = {
  conversaoIdeal: 75,
  conversaoCritica: 60,
  margemIdeal: 20,
  margemBaixa: 10,
  cancelamentosAlerta: 10,
  ticketMinimo: 0,
};
let _apresentacaoAtivo = false;
let _apresentacaoInterval = 8000;
let _apresentacaoTimer = null;
let _apresentacaoProgressTimer = null;
let _apresentacaoTabIdx = 0;
let _finMesesSelecionados = new Set();
const _apresentacaoTabs = ['visao', 'vendedores-detalhe', 'vendedores', 'canais', 'recuperar', 'comparativo', 'financeiro', 'acoes'];

// ═══════════════════════════════════════
//  LOCAL STORAGE
// ═══════════════════════════════════════
function saveLocalState() {
  try {
    localStorage.setItem('dash_goal', String(clinicGoal));
    localStorage.setItem('dash_cmpItems', JSON.stringify(cmpItems));
    localStorage.setItem('dash_benchmarks', JSON.stringify(_benchmarks));
  } catch (e) { }
}
function loadLocalState() {
  try {
    const g = localStorage.getItem('dash_goal');
    if (g) { clinicGoal = parseFloat(g) || 0; }
    const gi = document.getElementById('goalInput');
    if (gi && clinicGoal > 0) gi.value = 'R$ ' + clinicGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const c = localStorage.getItem('dash_cmpItems');
    if (c) {
      const parsed = JSON.parse(c) || [];
      cmpItems = parsed.filter(item => {
        if (item.type === 'year') return YEARS[item.idx] !== undefined;
        if (item.type === 'month') return MONTHS[item.idx] !== undefined;
        return false;
      });
    }
    const b = localStorage.getItem('dash_benchmarks');
    if (b) _benchmarks = { ..._benchmarks, ...JSON.parse(b) };
  } catch (e) { }
}

// ═══════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════
const fmt = v => "R$ " + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = v => {
  const n = +v || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  return sign + (abs >= 1000 ? "R$ " + (abs / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k" : "R$ " + abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
};
const pct = (a, b) => b > 0 ? +(a / b * 100).toFixed(1) : 0;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function parseBrNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v).trim().replace(/\s/g, '').replace(/R\$/gi, '').replace(/\$/g, '').trim();
  if (!s || s === '-' || s === '—' || s === '0' || s === '0,00' || s === '0.00') return 0;
  const neg = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'));
  s = s.replace(/^-/, '').replace(/^\(/, '').replace(/\)$/, '').trim();
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let n;
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) { n = parseFloat(s.replace(/\./g, '').replace(',', '.')) }
    else { n = parseFloat(s.replace(/,/g, '')) }
  } else if (hasComma && !hasDot) {
    const partes = s.split(',');
    if (partes[1] && partes[1].length <= 2) { n = parseFloat(s.replace(',', '.')) }
    else { n = parseFloat(s.replace(/,/g, '')) }
  } else if (hasDot && !hasComma) {
    const partes = s.split('.');
    if (partes.length === 2 && partes[1].length <= 2) { n = parseFloat(s) }
    else { n = parseFloat(s.replace(/\./g, '')) }
  } else { n = parseFloat(s); }
  const result = isNaN(n) ? 0 : n;
  return neg ? -result : result;
}

function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (!isNaN(local)) return local;
  }
  const s = String(v).trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  const m3 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m3) return new Date(+m3[3], +m3[2] - 1, +m3[1]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function diffDays(d1, d2) {
  if (!d1 || !d2) return null;
  const diff = (d2 - d1) / 86400000;
  return diff >= 0 ? diff : null;
}

function taxaBadge(t) {
  const ideal = _benchmarks.conversaoIdeal || 75;
  const critica = _benchmarks.conversaoCritica || 60;
  if (t >= ideal) return `<span class="badge green">${t}% <small>▲ Ótimo</small></span>`;
  if (t >= critica) return `<span class="badge warn">${t}% <small>▼ Atenção</small></span>`;
  return `<span class="badge bad">${t}% <small>✕ Crítico</small></span>`;
}

function taxaColor(t) {
  const ideal = _benchmarks.conversaoIdeal || 75;
  const critica = _benchmarks.conversaoCritica || 60;
  if (t >= ideal) return 'var(--green)';
  if (t >= critica) return 'var(--yellow)';
  return 'var(--red)';
}

const CANAL_COLORS = {
  'RETORNO': '#5b8def', 'CAMPANHA INTERNA': '#7c5cf0', 'INDICACAO': '#46c08a',
  'GOOGLE': '#d7a33f', 'LOCALIZACAO': '#e2705c', 'NAO INFORMADO': '#565e6d'
};
const CANAL_DISPLAY = {
  'RETORNO': 'Retorno', 'CAMPANHA INTERNA': 'Campanha Interna', 'INDICACAO': 'Indicação',
  'GOOGLE': 'Google', 'LOCALIZACAO': 'Localização', 'NAO INFORMADO': 'Não Informado'
};

function normStr(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, '').trim();
}
function canonCanal(raw) {
  const n = normStr(raw);
  if (!n || n === '-' || n === 'NAO INFORMADO' || n === 'NI' || n === 'INDEFINIDO' || n === 'N/A' || n === 'NENHUM' || n === '') return 'NAO INFORMADO';
  const variants = {
    'INDICACAO': ['INDICACAO', 'INDICACOES', 'INDICADO', 'INDICADOS', 'INDICACAO DE PACIENTE', 'INDICA'],
    'RETORNO': ['RETORNO', 'RETORNOS', 'RETORNO DE PACIENTE', 'PACIENTE RETORNO'],
    'GOOGLE': ['GOOGLE', 'GOOGLE ADS', 'GOOGLE AD', 'GOOGLE ADWORDS', 'GOOGLE SEARCH', 'GOOGLE MY BUSINESS', 'GOOGLE MAPS'],
    'LOCALIZACAO': ['LOCALIZACAO', 'LOCALIZACOES', 'LOCALIZACAO GEOGRAFICA', 'PASSAGEM', 'PASSOU NA FRENTE', 'FACHADA'],
    'CAMPANHA INTERNA': ['CAMPANHA INTERNA', 'CAMPANHA', 'CAMPANHAS', 'MIDIA SOCIAL', 'INSTAGRAM', 'FACEBOOK', 'REDE SOCIAL', 'REDES SOCIAIS', 'SOCIAL MEDIA'],
  };
  for (const [canon, list] of Object.entries(variants)) {
    for (const vv of list) { if (n === vv || n.startsWith(vv + ' ')) return canon; }
  }
  return n.split(' ')[0] || 'NAO INFORMADO';
}
function canalDisplay(k) { return CANAL_DISPLAY[k] || k; }
function canalColor(c) { return CANAL_COLORS[c] || '#5b8def'; }

function delta(novo, antigo) {
  if (!antigo) return { html: '', val: 0 };
  const d = novo - antigo, pct_ = antigo > 0 ? (d / antigo * 100) : 0;
  if (Math.abs(pct_) < 0.5) return { html: `<span class="delta-eq">= igual</span>`, val: 0 };
  const arrow = d > 0 ? '▲' : '▼', cls = d > 0 ? 'delta-up' : 'delta-down';
  return { html: `<span class="${cls}">${arrow} ${Math.abs(pct_).toFixed(1)}%</span>`, val: d };
}
function arrowCmp(novo, antigo, higherGood = true) {
  if (antigo === undefined || antigo === null) return '—';
  const d = novo - antigo;
  if (Math.abs(d) < 0.01) return `<span class="arrow-eq">= sem mudança</span>`;
  const up = higherGood ? d > 0 : d < 0;
  return `<span class="${up ? 'arrow-up' : 'arrow-down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}</span>`;
}
function diasParado(emissao) {
  if (!emissao) return null;
  return Math.floor((Date.now() - emissao.getTime()) / 86400000);
}
function diasBadge(dias) {
  if (dias === null) return '';
  if (dias >= 60) return `<span class="vdays vdays-hot">🔥 há ${dias} dias</span>`;
  if (dias >= 30) return `<span class="vdays vdays-warm">⏳ há ${dias} dias</span>`;
  return `<span class="vdays vdays-cold">há ${dias} dias</span>`;
}

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const KPI_TOOLTIPS = {
  'Taxa de Conversão': 'Percentual de orçamentos emitidos que foram aprovados. Fórmula: (Aprovados ÷ Total) × 100.',
  'Receita Faturada': 'Soma do valor total líquido de todos os orçamentos aprovados no período.',
  'Meta de Faturamento': 'Percentual atingido da meta definida por você. Salva automaticamente.',
  'Receita Perdida': 'Soma dos orçamentos vencidos — pacientes que não fecharam e o prazo expirou.',
  'Ticket Médio': 'Valor médio por orçamento aprovado. Fórmula: Receita ÷ Aprovações.',
  'Margem Líquida': 'Percentual de lucro após deduzir despesas. Fórmula: ((Receita − Despesas) ÷ Receita) × 100.',
  'Potencial Recuperável': 'Estimativa de 30% da receita perdida recuperável com follow-up estruturado.',
  'Total Orçamentos': 'Quantidade total de orçamentos emitidos no período.',
  'Cancelamentos': 'Orçamentos onde o paciente desistiu ativamente do tratamento.',
  'Score de Saúde': 'Índice de 0 a 100 baseado em conversão, margem, crescimento de faturamento e ticket médio, redução de despesas, canais e recuperação de receita. Veja o detalhamento no resumo executivo.',
};

// ═══════════════════════════════════════
//  MÊS PARCIAL
// ═══════════════════════════════════════
function isPartialMonth(mes, ano) {
  const hoje = new Date();
  return (ano === hoje.getFullYear() && mes === hoje.getMonth());
}
function getPartialMonthInfo(mes, ano) {
  if (!isPartialMonth(mes, ano)) return null;
  const hoje = new Date();
  const dia = hoje.getDate();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const pctMes = Math.round((dia / totalDias) * 100);
  return { dia, totalDias, pctMes };
}

// ═══════════════════════════════════════
//  DADOS SUSPEITOS
// ═══════════════════════════════════════
function detectSuspiciousData(obj) {
  const warnings = [];
  const vLabel = CFG.vendedor || 'vendedor';
  Object.values(obj).forEach(m => {
    if (!m || !m.records || m.records.length < 3) return;
    const recs = m.records, total = recs.length;
    const aprovados = recs.filter(r => r.situacao === 'Aprovado').length;
    if (aprovados === total)
      warnings.push(`⚠️ <strong>${m.periodo}:</strong> 100% dos ${total} registros estão como "Aprovado" — planilha pode estar filtrada.`);
    const dents = [...new Set(recs.map(r => r.dentista).filter(Boolean))];
    if (dents.length === 1 && total > 10)
      warnings.push(`⚠️ <strong>${m.periodo}:</strong> Apenas 1 ${vLabel} encontrado ("${dents[0]}") com ${total} registros — verifique se a planilha não está filtrada.`);
    const semCanal = recs.filter(r => !r.campanha || r.campanha === 'NAO INFORMADO').length;
    if (semCanal === total)
      warnings.push(`⚠️ <strong>${m.periodo}:</strong> Nenhum registro possui canal de marketing — análise de captação comprometida.`);
    const valores = [...new Set(recs.map(r => r.total).filter(v => v > 0))];
    if (valores.length === 1 && total >= 5)
      warnings.push(`⚠️ <strong>${m.periodo}:</strong> Todos os ${total} orçamentos têm o mesmo valor (${fmtK(valores[0])}) — pode indicar erro de importação.`);
  });
  return warnings;
}
function showSuspectWarnings(warnings) {
  const banner = document.getElementById('suspectBanner');
  if (!banner) return;
  if (!warnings || warnings.length === 0) { banner.style.display = 'none'; return; }
  banner.style.display = 'block';
  banner.innerHTML = `<strong>⚠️ Dados possivelmente suspeitos:</strong><ul style="margin-top:8px;padding-left:18px;line-height:2">${warnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
}

// ═══════════════════════════════════════
//  CONFIGURAÇÃO DA EMPRESA
// ═══════════════════════════════════════
let CFG = { empresa: '', vendedor: 'Vendedor', cliente: 'Cliente', proposta: 'Orçamento', meta: 0 };

function handleSelectOther(sel, customId) {
  const customEl = document.getElementById(customId);
  if (!customEl) return;
  if (sel.value === 'outro') { customEl.classList.add('show'); customEl.focus(); }
  else { customEl.classList.remove('show'); customEl.value = ''; }
}
function getSelectValue(selId, customId) {
  const sel = document.getElementById(selId);
  if (!sel) return '';
  if (sel.value === 'outro') {
    const custom = document.getElementById(customId);
    return (custom && custom.value.trim()) || 'Outro';
  }
  return sel.value;
}
function saveConfig() {
  CFG.empresa = document.getElementById('cfgEmpresa')?.value?.trim() || '';
  CFG.vendedor = getSelectValue('cfgVendedor', 'cfgVendedorCustom') || 'Vendedor';
  CFG.cliente = getSelectValue('cfgCliente', 'cfgClienteCustom') || 'Cliente';
  CFG.proposta = getSelectValue('cfgProposta', 'cfgPropostaCustom') || 'Orçamento';
  const metaRaw = document.getElementById('cfgMeta')?.value || '';
  CFG.meta = parseBrNum(metaRaw.replace(/[^\d.,]/g, '')) || 0;
  if (CFG.meta > 0) {
    clinicGoal = CFG.meta;
    const gi = document.getElementById('goalInput');
    if (gi) gi.value = 'R$ ' + CFG.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }
  try { localStorage.setItem('metrik_cfg', JSON.stringify(CFG)); } catch (e) { }
  updateColumnHints();
}
function loadConfig() {
  try {
    const saved = localStorage.getItem('metrik_cfg');
    if (saved) CFG = { ...CFG, ...JSON.parse(saved) };
  } catch (e) { }
  const emp = document.getElementById('cfgEmpresa');
  if (emp && CFG.empresa) emp.value = CFG.empresa;
  const meta = document.getElementById('cfgMeta');
  if (meta && CFG.meta > 0) meta.value = 'R$ ' + CFG.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  ['cfgVendedor', 'cfgCliente', 'cfgProposta'].forEach(id => {
    const cfgKey = id.replace('cfg', '').toLowerCase();
    const val = CFG[cfgKey];
    if (!val) return;
    const sel = document.getElementById(id);
    if (!sel) return;
    const opt = [...sel.options].find(o => o.value === val);
    if (opt) sel.value = val;
    else {
      sel.value = 'outro';
      const customId = id + 'Custom';
      const customEl = document.getElementById(customId);
      if (customEl) { customEl.value = val; customEl.classList.add('show'); }
    }
  });
  updateColumnHints();
}
function updateColumnHints() {
  const v = CFG.vendedor, c = CFG.cliente;
  const colV = document.getElementById('colVendedor');
  if (colV) colV.textContent = `${v} (obrigatório)`;
  const colC = document.getElementById('colCliente');
  if (colC) colC.textContent = `${c} (opcional)`;
}

function applyConfigToUI() {
  const v = CFG.vendedor || 'Vendedor';
  const vP = pluralizar(v);
  const c = CFG.cliente || 'Cliente';
  const cP = pluralizar(c);
  const p = CFG.proposta || 'Orçamento';
  const pP = pluralizar(p);
  const emp = CFG.empresa || 'Metrik';
  const dt = document.getElementById('dashTitle');
  if (dt) dt.innerHTML = emp;
  const tabV = document.getElementById('tabVendedoresBtn');
  if (tabV) tabV.textContent = vP;
  const ids = {
    'lblFatVend': `Faturamento por ${v}`,
    'lblPorVendedor': `Por ${v}`,
    'lblPorVendedor2': `Cancelamentos por ${v}`,
    'lblTopVencidos': `Top ${pP} Vencidos`,
    'secVendedores': `Filtrar por ${v}`,
    'secRecuperar': `${pP} Vencidos — Foco em Follow-up`,
    'lblCanaisPorVendedor': `Canais por ${v}`,
    'secEvolucaoVendedor': `Evolução por ${v}`,
    'seletorVendedorTitulo': `Selecionar ${vP}`,
    'lblEvolucaoMensal': `Evolução Mensal por ${v}`,
    'lblRankingAcumulado': `Ranking Acumulado de ${vP}`,
    'lblAnaliseIndividual': `Análise Individual por ${v}`,
  };
  Object.entries(ids).forEach(([id, txt]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  });
  const thV = document.getElementById('thVendedor');
  if (thV) thV.textContent = v;
  const nc = document.getElementById('cancNote');
  if (nc) nc.textContent = `⚠️ Cancelamentos diferem de vencidos: o ${c.toLowerCase()} ativamente desistiu.`;
  const btnPac = document.getElementById('btnMetricPacientes');
  if (btnPac) btnPac.textContent = `${cP} Fechados`;
  if (CFG.meta > 0 && clinicGoal === 0) {
    clinicGoal = CFG.meta;
    const gi = document.getElementById('goalInput');
    if (gi && !gi.value) gi.value = 'R$ ' + CFG.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }
}

function loadSessionJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const sessao = JSON.parse(e.target.result);
      if (!sessao.meses || !sessao.versao) { showToast('❌ Arquivo inválido.', true); return; }
      if (sessao.cfg) CFG = { ...CFG, ...sessao.cfg };
      if (sessao.benchmarks) _benchmarks = { ..._benchmarks, ...sessao.benchmarks };
      if (sessao.metas) _metasMensais = { ..._metasMensais, ...sessao.metas };
      if (sessao.notas) _notas = { ..._notas, ...sessao.notas };
      if (sessao.despesas) {
        Object.entries(sessao.despesas).forEach(([k, v]) => {
          parsedExpenses[k] = (parsedExpenses[k] || 0) + v;
        });
      }
      if (sessao.faturamento) {
        Object.entries(sessao.faturamento).forEach(([k, v]) => {
          parsedFaturamento[k] = (parsedFaturamento[k] || 0) + v;
        });
      }
      let mesesCarregados = 0;
      Object.entries(sessao.meses).forEach(([key, m]) => {
        if (parsedMonths[key]) { showToast(`⚠️ ${m.periodo} já carregado — mantendo planilha.`); return; }
        parsedMonths[key] = {
          key: m.key, periodo: m.periodo, mes: m.mes, ano: m.ano,
          records: m.records.map(r => ({
            ...r,
            emissao: r.emissao ? new Date(r.emissao + 'T00:00:00') : null,
            aprovacao: r.aprovacao ? new Date(r.aprovacao + 'T00:00:00') : null,
          }))
        };
        mesesCarregados++;
      });
      loadConfig(); updateChips();
      showSuspectWarnings(detectSuspiciousData(parsedMonths));
      const total = Object.keys(parsedMonths).length;
      const btnAnalyze = document.getElementById('btnAnalyze');
      if (btnAnalyze && total > 0) btnAnalyze.style.display = 'flex';
      const badge = document.getElementById('sessionLoadedBadge');
      if (badge) { badge.style.display = 'inline-flex'; badge.textContent = `📁 Sessão carregada: ${total} meses`; }
      showToast(`✅ Sessão carregada! ${mesesCarregados} meses + ${Object.keys(parsedExpenses).length} meses de despesas.`);
    } catch (err) { showToast('❌ Erro ao ler JSON: ' + err.message, true); }
  };
  reader.readAsText(file);
}

// ─── TOAST ───
function showToast(msg, isError = false) {
  let toast = document.getElementById('metrikToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'metrikToast';
    document.body.appendChild(toast);
  }
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:99999;
    background:${isError ? 'rgba(226,112,92,.15)' : 'rgba(70,192,138,.15)'};
    border:1px solid ${isError ? 'rgba(226,112,92,.4)' : 'rgba(70,192,138,.4)'};
    color:${isError ? '#e2705c' : '#46c08a'};
    padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;
    max-width:380px;line-height:1.5;
    box-shadow:0 8px 32px rgba(0,0,0,.4);
    transition:opacity .3s;opacity:1;
  `;
  toast.textContent = msg;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 4000);
}

// ═══════════════════════════════════════
//  FILE UPLOAD
// ═══════════════════════════════════════
function handleFiles(e) {
  const files = [...e.target.files];
  if (!files.length) return;

  const xlsFiles = files.filter(f => !f.name.endsWith('.json'));
  if (!xlsFiles.length) {
    if (e.target) e.target.value = '';
    return;
  }

  document.getElementById('errBanner').style.display = 'none';
  document.getElementById('suspectBanner').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'flex';
  _detectionLogs = [];

  // Erros são acumulados por arquivo: um arquivo problemático NÃO descarta os demais
  const errosArquivos = [];

  const processNext = (idx) => {
    if (idx >= xlsFiles.length) {
      document.getElementById('loadingScreen').style.display = 'none';
      updateChips();
      showSuspectWarnings(detectSuspiciousData(parsedMonths));

      // Habilita botão se tem meses (banco + novos) ou empresa ativa com extras
      const temMeses = Object.keys(parsedMonths).length > 0;
      const temExtras = Object.keys(parsedExpenses).length > 0
        || Object.keys(parsedFaturamento).length > 0;
      const hasData = temMeses || (_empresaAtiva && temExtras);
      document.getElementById('btnAnalyze').style.display = hasData ? 'flex' : 'none';

      if (errosArquivos.length) {
        showErr(errosArquivos.join('<br>') +
          (hasData ? '<br><span style="opacity:.8">Os demais arquivos foram carregados normalmente.</span>' : ''));
      }

      if (e.target) e.target.value = '';
      return;
    }
    document.getElementById('loadingMsg').textContent =
      `Lendo arquivo ${idx + 1} de ${xlsFiles.length}: ${xlsFiles[idx].name}`;
    readFile(xlsFiles[idx])
      .then(() => processNext(idx + 1))
      .catch(err => {
        errosArquivos.push(`<b>${xlsFiles[idx].name}</b>: ${err.message}`);
        processNext(idx + 1);
      });
  };
  processNext(0);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellNF: true, cellText: true, cellDates: true });
        const months = [];
        let foundExpense = false;
        wb.SheetNames.forEach(name => {
          const ws = wb.Sheets[name];
          const rows = sheetToRows(ws);
          if (!rows || rows.length < 1) return;
          const parsed = parseSheet(rows, name, file.name);
          console.log('parseSheet retornou:', parsed, 'aba:', name);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => {
              if (p._detectionLog) { _detectionLogs.push({ ...p._detectionLog, fileName: file.name }); delete p._detectionLog; }
              months.push(p);
            });
          } else if (parsed && !parsed._invalid) {
            months.push(parsed);
          } else {
            // Tenta faturamento real ANTES de qualquer outra coisa
            const fatData = parseFaturamentoFile(rows, name, file.name);
            if (fatData && fatData.length > 0) {
              foundExpense = true;
              fatData.forEach(fd => {
                parsedFaturamento[fd.key] = (parsedFaturamento[fd.key] || 0) + fd.total;
              });
              _detectionLogs.push({
                _isFaturamento: true,
                fileName: file.name,
                mesesCount: fatData.length
              });
            } else {
              // Tenta despesas
              const expData = parseExpenseFile(rows, name, file.name);
              if (expData && expData.length > 0) {
                foundExpense = true;
                expData.forEach(ed => {
                  parsedExpenses[ed.key] = (parsedExpenses[ed.key] || 0) + ed.total;
                });
                _detectionLogs.push({
                  _isExpense: true,
                  fileName: file.name,
                  mesesCount: expData.length
                });
              } else if (parsed && parsed._invalid && parsed.detectionLog) {
                // Não bateu com nenhum formato: sinaliza como NÃO RECONHECIDO
                // (antes aparecia como "Orçamentos detectados", o que confundia)
                _detectionLogs.push({ ...parsed.detectionLog, _naoReconhecido: true, fileName: file.name });
              }
            }
          }
        });
        months.forEach(m => { parsedMonths[m.key] = m; });
        const temFatCarregado = Object.keys(parsedFaturamento).length > 0;
        if (months.length === 0 && !foundExpense && !temFatCarregado) {
          reject(new Error(`Nenhuma aba válida em "${file.name}". Verifique se contém orçamentos ou despesas.`));
        } else { resolve(); }
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// ═══════════════════════════════════════
//  LEITURA DE ABA COM CABEÇALHO INTELIGENTE
//  Planilhas exportadas costumam ter título e linhas em branco no topo
//  (ex: "Orçamentos Emitidos" na linha 1 e o cabeçalho real na linha 3).
// ═══════════════════════════════════════
const HEADER_HINTS = [
  'EMISSAO', 'APROVACAO', 'VENDEDOR', 'DENTISTA', 'CONSULTOR', 'MEDICO', 'CORRETOR',
  'CLIENTE', 'PACIENTE', 'LEAD', 'TOTAL', 'VALOR', 'SITUACAO', 'STATUS', 'CAMPANHA',
  'MARKETING', 'CANAL', 'ORIGEM', 'TELEFONE', 'DESPESA', 'PASSIVO', 'CATEGORIA',
  'ITEM', 'DESCRICAO', 'FATURAMENTO', 'RECEITA', 'CAIXA', 'HORAS',
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
  'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
];

function detectHeaderRow(ws) {
  let aoa;
  try {
    aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false, blankrows: true });
  } catch (e) { return 0; }
  const limit = Math.min(aoa.length, 15);
  let best = -1, bestScore = 0;
  for (let i = 0; i < limit; i++) {
    const cells = (aoa[i] || []).map(c => normStr(String(c == null ? '' : c))).filter(Boolean);
    if (cells.length < 2) continue;
    let score = 0;
    for (const c of cells) {
      if (HEADER_HINTS.some(h => c === h || c.startsWith(h))) score++;
    }
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (bestScore >= 2 && best >= 0) return best;
  // fallback: primeira linha com pelo menos 2 células preenchidas
  for (let i = 0; i < limit; i++) {
    const row = aoa[i] || [];
    if (row.filter(c => String(c == null ? '' : c).trim() !== '').length >= 2) return i;
  }
  return 0;
}

function sheetToRows(ws, opts) {
  const hdr = detectHeaderRow(ws);
  const base = { defval: '', raw: false };
  return XLSX.utils.sheet_to_json(ws, Object.assign(base, opts || {}, { range: hdr }));
}

function findCol(keys, candidates) {
  for (const c of candidates) {
    const norm = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const f = keys.find(k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(norm));
    if (f) return f;
  }
  return null;
}

function parseSheet(rows, sheetName, fileName) {
  if (!rows || rows.length < 2) return null;
  const keys = Object.keys(rows[0]);
  const COL = {
    emissao: findCol(keys, ['emiss']),
    aprovacao: findCol(keys, ['aprov']),
    dentista: findCol(keys, ['dentista', 'dent', 'vendedor', 'consultor', 'medico', 'corretor']),
    paciente: findCol(keys, ['paciente', 'nome', 'patient', 'cliente', 'lead']),
    total: findCol(keys, ['total liquido', 'total liquid', 'totalliq', 'vlrtotal', 'valorliq', 'total']),
    situacao: findCol(keys, ['situac', 'status', 'situ']),
    campanha: findCol(keys, ['campanha', 'marketing', 'canal', 'origem']),
    telefone: findCol(keys, ['telefone', 'tel', 'fone', 'celular', 'contato']),
    despesas: findCol(keys, ['despesas', 'passivos']),
  };
  const detectionLog = { emissao: !!COL.emissao, dentista: !!COL.dentista, situacao: !!COL.situacao, total: !!COL.total, campanha: !!COL.campanha };
  if (!COL.situacao || !COL.dentista || !COL.total) return { _invalid: true, detectionLog, fileName, sheetName };
  const records = [];
  for (const row of rows) {
    const sit = String(row[COL.situacao] || '').trim();
    if (!sit) continue;
    records.push({
      emissao: parseDate(row[COL.emissao]),
      aprovacao: parseDate(row[COL.aprovacao]),
      dentista: String(row[COL.dentista] || '').trim(),
      paciente: String(row[COL.paciente] || '').trim(),
      total: parseBrNum(row[COL.total]),
      situacao: sit,
      campanha: canonCanal(String(row[COL.campanha] || '').trim()),
      telefone: String(row[COL.telefone] || '').trim(),
      despesas: COL.despesas ? parseBrNum(row[COL.despesas]) : 0,
    });
  }
  if (records.length < 2) return null;
  const datas = records.map(r => r.emissao).filter(Boolean);
  if (datas.length > 0) {
    const byMonth = {};
    for (const r of records) {
      let mes, ano;
      if (r.emissao) { mes = r.emissao.getMonth(); ano = r.emissao.getFullYear(); }
      else {
        const mn = MONTHS_PT.findIndex(m =>
          sheetName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ||
          fileName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
        );
        mes = mn >= 0 ? mn : 0;
        const ym = sheetName.match(/\d{4}/) || fileName.match(/\d{4}/);
        ano = ym ? +ym[0] : new Date().getFullYear();
      }
      const key = `${ano}-${String(mes + 1).padStart(2, '0')}`;
      const periodo = MONTHS_PT[mes] + ' ' + ano;
      if (!byMonth[key]) byMonth[key] = { key, periodo, mes, ano, records: [] };
      byMonth[key].records.push(r);
    }
    const result = Object.values(byMonth).filter(m => m.records.length >= 2);
    if (result.length > 0) result[0]._detectionLog = { ...detectionLog, fileName, sheetName };
    return result.length > 0 ? result : null;
  } else {
    const mn = MONTHS_PT.findIndex(m =>
      sheetName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ||
      fileName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    );
    const mes = mn >= 0 ? mn : 0;
    const ym = sheetName.match(/\d{4}/) || fileName.match(/\d{4}/);
    const ano = ym ? +ym[0] : new Date().getFullYear();
    const key = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    return [{ key, periodo: MONTHS_PT[mes] + ' ' + ano, mes, ano, records, _detectionLog: { ...detectionLog, fileName, sheetName } }];
  }
}

function parseExpenseFile(rows, sheetName, fileName) {
  if (!rows || rows.length < 2) return null;
  let keys = Object.keys(rows[0]);
  const LABEL_CANDIDATES = ['PASSIVO', 'PASSIVOS', 'DESPESA', 'DESPESAS', 'CATEGORIA', 'ITEM', 'DESCRICAO', 'DESCRICAO DA DESPESA', 'TIPO'];
  let labelCol = keys.find(k => {
    const n = normStr(k);
    return LABEL_CANDIDATES.includes(n) || k === '' || k === '__EMPTY' || k === '__EMPTY_1';
  });
  if (!labelCol) labelCol = keys[0];
  const fileYearMatch = fileName.match(/\b(20\d{2})\b/) || sheetName.match(/\b(20\d{2})\b/);
  const inferredAno = fileYearMatch ? +fileYearMatch[0] : new Date().getFullYear();
  const MES_MAP = {
    'JANEIRO': 0, 'FEVEREIRO': 1, 'MARCO': 2, 'ABRIL': 3, 'MAIO': 4, 'JUNHO': 5,
    'JULHO': 6, 'AGOSTO': 7, 'SETEMBRO': 8, 'OUTUBRO': 9, 'NOVEMBRO': 10, 'DEZEMBRO': 11,
    'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11,
    'FEB': 1, 'APR': 3, 'MAY': 4, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'DEC': 11,
  };
  const TOTAL_SKIP = ['GRANDTOTAL', 'GRAND TOTAL', 'TOTAL ANUAL', 'TOTAL GERAL', 'TOTAL', 'TOTAIS', 'SOMA', 'SUBTOTAL', 'ANUAL'];
  function parseMesAno(rawKey) {
    const s = String(rawKey).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const sn = s.replace(/[\s\/\-]/g, '');
    if (TOTAL_SKIP.some(t => sn === t.replace(/[\s\/\-]/g, ''))) return null;
    if (s.startsWith('TOTAL') || s.startsWith('GRAND')) return null;
    let ano = null;
    const m4 = s.match(/(?:^|[\/\-\s])(20\d{2})(?:$|[\/\-\s])/);
    if (m4) ano = +m4[1];
    if (!ano) { const m4b = s.match(/(20\d{2})/); if (m4b) ano = +m4b[1]; }
    if (!ano) { const m2 = s.match(/[\/\-](\d{2})$/); if (m2) ano = 2000 + (+m2[1]); }
    if (!ano) ano = inferredAno;
    let mesIdx = -1;
    for (const [alias, idx] of Object.entries(MES_MAP)) {
      if (s === alias || s.startsWith(alias + '/') || s.startsWith(alias + '-') || s.startsWith(alias + ' ') || s.endsWith('/' + alias) || s.endsWith('-' + alias)) {
        mesIdx = idx; break;
      }
    }
    if (mesIdx < 0) {
      const numM = s.match(/^0?(\d{1,2})[\/\-](20\d{2}|\d{2})$/);
      if (numM) { const m = +numM[1]; if (m >= 1 && m <= 12) mesIdx = m - 1; }
    }
    if (mesIdx < 0) return null;
    return { mes: mesIdx, ano, key: `${ano}-${String(mesIdx + 1).padStart(2, '0')}` };
  }
  const monthCols = [];
  for (const k of keys) {
    if (k === labelCol) continue;
    const parsed = parseMesAno(k);
    if (!parsed) continue;
    if (!monthCols.find(mc => mc.key === parsed.key)) {
      monthCols.push({ colName: k, ...parsed });
    }
  }
  if (monthCols.length === 0) return null;
  const totals = {};
  for (const mc of monthCols) totals[mc.key] = { ...mc, total: 0 };
  const LABEL_SKIP = ['TOTAL', 'TOTAIS', 'SOMA', 'SUBTOTAL', 'TOTAL GERAL', 'GRAND TOTAL'];

  // Detecta o formato da planilha:
  // - "com sinal" (DRE): receitas positivas + despesas NEGATIVAS na mesma coluna.
  //   Nesse caso as despesas são os valores negativos (em módulo); positivos = receita, ignorados.
  // - "positivo" (formato antigo): despesas lançadas como valores positivos.
  let temNegativo = false;
  for (const row of rows) {
    const labelNorm = normStr(String(row[labelCol] || ''));
    if (LABEL_SKIP.some(t => labelNorm === t) || labelNorm.startsWith('TOTAL ') || labelNorm.startsWith('GRAND ')) continue;
    for (const mc of monthCols) {
      if (parseBrNum(String(row[mc.colName] ?? '')) < 0) { temNegativo = true; break; }
    }
    if (temNegativo) break;
  }

  for (const row of rows) {
    const labelRaw = String(row[labelCol] || '').trim();
    if (!labelRaw) continue;
    const labelNorm = normStr(labelRaw);
    if (LABEL_SKIP.some(t => labelNorm === t)) continue;
    if (labelNorm.startsWith('TOTAL ') || labelNorm.startsWith('GRAND ')) continue;
    for (const mc of monthCols) {
      const raw = row[mc.colName];
      if (raw === null || raw === undefined || raw === '') continue;
      const vv = parseBrNum(String(raw));
      if (temNegativo) {
        if (vv < 0) totals[mc.key].total += -vv; // despesa = valor negativo, somado em módulo
      } else {
        if (vv > 0) totals[mc.key].total += vv;
      }
    }
  }
  const results = Object.values(totals).filter(m => m.total > 0);
  return results.length > 0 ? results : null;
}

function parseFaturamentoFile(rows, sheetName, fileName) {
  if (!rows || rows.length < 1) return null;
  const keys = Object.keys(rows[0]);
  if (keys.length < 2) return null;
  console.log('parseFat keys:', keys);
  console.log('parseFat row0:', rows[0]);
  console.log('parseFat row1:', rows[1]);

  const FATURAMENTO_CANDIDATES = [
    'FATURAMENTO', 'RECEITA REAL', 'RECEITA', 'CAIXA',
    'RECEBIDO', 'RECEBIMENTOS', 'FATURADO', 'RECEITA FATURADA'
  ];

  const MES_MAP = {
    'JANEIRO': 0, 'FEVEREIRO': 1, 'MARCO': 2, 'ABRIL': 3, 'MAIO': 4, 'JUNHO': 5,
    'JULHO': 6, 'AGOSTO': 7, 'SETEMBRO': 8, 'OUTUBRO': 9, 'NOVEMBRO': 10, 'DEZEMBRO': 11,
    'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11,
    'FEB': 1, 'APR': 3, 'MAY': 4, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'DEC': 11,
  };

  const fileYearMatch = fileName.match(/\b(20\d{2})\b/) || sheetName.match(/\b(20\d{2})\b/);
  const inferredAno = fileYearMatch ? +fileYearMatch[0] : new Date().getFullYear();

  // Verifica se é arquivo de faturamento pelo nome do arquivo, aba ou primeira coluna
  const nomeArquivoN = normStr(fileName);
  const nomeAbaN = normStr(sheetName);
  const primeiraColN = normStr(keys[0]);

  const isFaturamentoFile = FATURAMENTO_CANDIDATES.some(c =>
    nomeArquivoN.includes(c) || nomeAbaN.includes(c) || primeiraColN === c || primeiraColN.includes(c)
  );

  // Verifica também se alguma linha tem label de faturamento
  const labelCol = keys[0];
  const temLinhaFat = rows.some(row => {
    const n = normStr(String(row[labelCol] || ''));
    return FATURAMENTO_CANDIDATES.some(c => n === c || n.includes(c));
  });

  if (!isFaturamentoFile && !temLinhaFat) return null;

  // Detecta colunas de mês
  function parseMesAno(rawKey) {
    const s = String(rawKey).toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const sn = s.replace(/[\s\/\-]/g, '');

    const SKIP = ['TOTAL', 'TOTAIS', 'SOMA', 'SUBTOTAL', 'TOTALGERAL', 'GRANDTOTAL', 'ANUAL',
                  'FATURAMENTO', 'RECEITA', 'DESPESA', 'CATEGORIA', 'ITEM', 'DESCRICAO'];
    if (SKIP.some(t => sn === t)) return null;
    if (s.startsWith('TOTAL') || s.startsWith('GRAND')) return null;

    let ano = inferredAno;
    const m4 = s.match(/(20\d{2})/);
    if (m4) ano = +m4[1];
    const m2 = s.match(/[\/\-](\d{2})$/);
    if (m2 && !m4) ano = 2000 + (+m2[1]);

    let mesIdx = -1;
    for (const [alias, idx] of Object.entries(MES_MAP)) {
      if (s === alias || s.startsWith(alias + '/') || s.startsWith(alias + '-') ||
          s.startsWith(alias + ' ') || s.endsWith('/' + alias) || s.endsWith('-' + alias)) {
        mesIdx = idx; break;
      }
    }

    // Tenta MM/AAAA ou MM-AAAA
    if (mesIdx < 0) {
      const numM = s.match(/^0?(\d{1,2})[\/\-](20\d{2}|\d{2})$/);
      if (numM) { const m = +numM[1]; if (m >= 1 && m <= 12) mesIdx = m - 1; }
    }

    if (mesIdx < 0) return null;
    return { mes: mesIdx, ano, key: `${ano}-${String(mesIdx + 1).padStart(2, '0')}` };
  }

  const monthCols = [];
  for (const k of keys) {
    if (k === labelCol) continue;
    const parsed = parseMesAno(k);
    if (!parsed) continue;
    if (!monthCols.find(mc => mc.key === parsed.key)) {
      monthCols.push({ colName: k, ...parsed });
    }
  }

  if (monthCols.length === 0) return null;

  const LABEL_SKIP = ['TOTAL', 'TOTAIS', 'SOMA', 'SUBTOTAL', 'TOTAL GERAL', 'GRAND TOTAL'];
  const totals = {};
  for (const mc of monthCols) totals[mc.key] = { ...mc, total: 0 };

  for (const row of rows) {
    const labelRaw = String(row[labelCol] || '').trim();
    if (!labelRaw) continue;
    const labelNorm = normStr(labelRaw);
    if (LABEL_SKIP.some(t => labelNorm === t)) continue;
    if (labelNorm.startsWith('TOTAL ') || labelNorm.startsWith('GRAND ')) continue;

    for (const mc of monthCols) {
      const raw = row[mc.colName];
      if (raw === null || raw === undefined || raw === '') continue;
      const vv = parseBrNum(String(raw));
      if (vv > 0) totals[mc.key].total += vv;
    }
  }

  const results = Object.values(totals).filter(m => m.total > 0);
  return results.length > 0 ? results : null;
}

function updateChips() {
  const chips = document.getElementById('monthChips');
  const bc = Object.values(parsedMonths).sort((a, b) => a.key.localeCompare(b.key)).map(m => {
    const partial = getPartialMonthInfo(m.mes, m.ano);
    const partialTag = partial ? ` <span style="color:var(--yellow);font-size:10px">⚠️ parcial</span>` : '';
    return `<div class="month-chip">📅 ${m.periodo}${partialTag} <span class="chip-rm" onclick="removeMonth('${m.key}')">✕</span></div>`;
  }).join('');
  const ec = Object.entries(parsedExpenses).sort((a, b) => a[0].localeCompare(b[0])).map(([k]) => {
    const [ano, mes] = k.split('-');
    return `<div class="chip-expense">💰 Despesas ${MONTHS_PT[+mes - 1]} ${ano} <span class="chip-rm" onclick="removeExpense('${k}')">✕</span></div>`;
  }).join('');
  const fc = Object.entries(parsedFaturamento).sort((a, b) => a[0].localeCompare(b[0])).map(([k]) => {
    const [ano, mes] = k.split('-');
    return `<div class="chip-expense" style="border-color:color-mix(in srgb,var(--accent2) 40%,transparent);background:color-mix(in srgb,var(--accent2) 8%,transparent)">
      💵 Faturamento Real ${MONTHS_PT[+mes - 1]} ${ano}
      <span class="chip-rm" onclick="removeFaturamento('${k}')">✕</span>
    </div>`;
  }).join('');

  chips.innerHTML = bc + ec + fc;
  const fb = document.getElementById('detectionFeedback');
  if (fb) fb.innerHTML = _detectionLogs.map(log => {
    const isExp = log._isExpense;
    const isFat = log._isFaturamento;
    const vLabel = CFG.vendedor || 'Vendedor';
    const cols = isFat
      ? [{ k: 'Faturamento Real', ok: true }, { k: 'Meses: ' + log.mesesCount, ok: true }]
      : isExp
        ? [{ k: 'Despesas/Passivos', ok: true }, { k: 'Meses: ' + log.mesesCount, ok: true }]
        : [{ k: 'Emissão', ok: log.emissao }, { k: vLabel, ok: log.dentista }, { k: 'Situação', ok: log.situacao }, { k: 'Total', ok: log.total }, { k: 'Campanha', ok: log.campanha, opt: true }];
    const isBad = log._naoReconhecido;
    const icon = isFat ? '💵' : isExp ? '💰' : isBad ? '⚠️' : '📋';
    const label = isFat ? 'Faturamento real detectado'
      : isExp ? 'Despesas detectadas'
        : isBad ? 'Formato não reconhecido' : 'Orçamentos detectados';
    const dica = isBad
      ? `<div style="font-size:11px;color:var(--muted2);margin-top:7px;line-height:1.6">
           Este arquivo não bateu com nenhum formato. Confira se ele é:
           <b>orçamentos</b> (precisa das colunas ${vLabel}, Situação e Total),
           <b>despesas</b> (itens nas linhas e meses nas colunas) ou
           <b>faturamento real</b> (linha "Receita Real" com o mês na coluna).
         </div>`
      : '';
    return `<div class="det-file"><div class="det-file-name">${icon} <strong>${log.fileName}</strong> — ${label}</div><div class="det-cols">${cols.map(cc => `<span class="det-col ${cc.ok ? 'det-ok' : cc.opt ? 'det-info' : 'det-miss'}">${cc.ok ? '✓' : '✗'} ${cc.k}</span>`).join('')}</div>${dica}</div>`;
  }).join('');
}

async function removeMonth(key) {
  if (_empresaAtiva) {
    try {
      await dbDeletarMes(_empresaAtiva.id, key);
    } catch (err) {
      showToast('Erro ao remover mês da nuvem: ' + err.message, true);
      return;
    }
  }
  delete parsedMonths[key]; updateChips();
  showSuspectWarnings(detectSuspiciousData(parsedMonths));
  if (Object.keys(parsedMonths).length === 0 && Object.keys(parsedExpenses).length === 0)
    document.getElementById('btnAnalyze').style.display = 'none';
}

async function removeExpense(key) {
  if (_empresaAtiva) {
    try {
      await dbDeletarDespesa(_empresaAtiva.id, key);
    } catch (err) {
      showToast('Erro ao remover despesa da nuvem: ' + err.message, true);
      return;
    }
  }
  delete parsedExpenses[key]; updateChips();
  if (Object.keys(parsedMonths).length === 0 && Object.keys(parsedExpenses).length === 0)
    document.getElementById('btnAnalyze').style.display = 'none';
}

async function removeFaturamento(key) {
  if (_empresaAtiva) {
    try {
      await dbDeletarFaturamento(_empresaAtiva.id, key);
    } catch (err) {
      showToast('Erro ao remover faturamento da nuvem: ' + err.message, true);
      return;
    }
  }
  delete parsedFaturamento[key];
  updateChips();
  if (
    Object.keys(parsedMonths).length === 0 &&
    Object.keys(parsedExpenses).length === 0 &&
    Object.keys(parsedFaturamento).length === 0
  ) {
    document.getElementById('btnAnalyze').style.display = 'none';
  }
}
function showErr(msg) {
  const b = document.getElementById('errBanner');
  b.style.display = 'block'; b.innerHTML = '⚠️ ' + msg;
}

// ═══════════════════════════════════════
//  COMPUTE
// ═══════════════════════════════════════
function computeMonth(data, prev) {
  const { records, periodo, mes, ano, key } = data;
  const active = records.filter(r => r.situacao !== 'Cancelado');
  const cancelados = records.filter(r => r.situacao === 'Cancelado');
  const aprovados = active.filter(r => r.situacao === 'Aprovado');
  const vencidos = active.filter(r => r.situacao === 'Vencido');
  const sumVal = arr => arr.reduce((s, r) => s + r.total, 0);
  const colDesp = records.reduce((s, r) => s + (r.despesas || 0), 0);
  let extDesp = 0;
  if (key && key.startsWith('year-')) {
    const yr = key.replace('year-', '');
    extDesp = Object.entries(parsedExpenses).filter(([k]) => k.startsWith(yr + '-')).reduce((s, [, v]) => s + v, 0);
  } else {
    extDesp = parsedExpenses[key] || 0;
  }
  const totalDespesas = colDesp + extDesp;
  const hasDespesas = totalDespesas > 0;
  const receitaAprovada = sumVal(aprovados);
  let margem = null;
  if (hasDespesas) {
    margem = receitaAprovada > 0 ? +((1 - totalDespesas / receitaAprovada) * 100).toFixed(1) : -100;
  }
  const geral = {
    total: active.length, aprovados: aprovados.length, vencidos: vencidos.length, cancelados: cancelados.length,
    taxa: pct(aprovados.length, active.length), orcado: sumVal(active), aprovado: receitaAprovada,
    perdido: sumVal(vencidos), canceladoVal: sumVal(cancelados),
    despesas: totalDespesas, hasDespesas, margem,
  };
  const dentMap = {};
  for (const r of records) {
    if (!r.dentista) continue;
    if (!dentMap[r.dentista]) dentMap[r.dentista] = { nome: r.dentista, total: 0, aprovados: 0, vencidos: 0, cancelados: 0, vAprov: 0, vPerd: 0, vCanc: 0, tempos: [], canais: {} };
    const d = dentMap[r.dentista];
    if (r.situacao === 'Cancelado') { d.cancelados++; d.vCanc += r.total; }
    else {
      d.total++;
      if (r.situacao === 'Aprovado') {
        d.aprovados++; d.vAprov += r.total;
        const t = diffDays(r.emissao, r.aprovacao);
        if (t !== null) d.tempos.push(t);
        const c = r.campanha || 'NAO INFORMADO';
        d.canais[c] = (d.canais[c] || 0) + 1;
      } else { d.vencidos++; d.vPerd += r.total; }
    }
  }
  const dentistas = Object.values(dentMap).map(d => {
    const bc = Object.entries(d.canais).sort((a, b) => b[1] - a[1])[0];
    const tc = Object.values(d.canais).reduce((s, v) => s + v, 0);
    return {
      nome: d.nome, total: d.total, aprovados: d.aprovados, vencidos: d.vencidos, cancelados: d.cancelados,
      taxa: pct(d.aprovados, d.total), valor_aprovado: d.vAprov, valor_perdido: d.vPerd, valor_cancelado: d.vCanc,
      ticket_medio: d.aprovados > 0 ? d.vAprov / d.aprovados : 0,
      tempo_medio: d.tempos.length > 0 ? +(d.tempos.reduce((s, t) => s + t, 0) / d.tempos.length).toFixed(1) : 0,
      melhor_canal: bc ? bc[0] : '—', captacao_taxa: bc ? pct(bc[1], tc) : 0, canais: d.canais
    };
  });
  const canalMap = {};
  for (const r of active) {
    const c = r.campanha || 'NAO INFORMADO';
    if (!canalMap[c]) canalMap[c] = { canal: c, total: 0, aprovados: 0, valor: 0 };
    canalMap[c].total++;
    if (r.situacao === 'Aprovado') { canalMap[c].aprovados++; canalMap[c].valor += r.total; }
  }
  const canais = Object.values(canalMap).map(c => ({
    ...c, taxa: pct(c.aprovados, c.total), ticket: c.aprovados > 0 ? c.valor / c.aprovados : 0
  }));
  const cancByDent = {};
  for (const r of cancelados) {
    if (!cancByDent[r.dentista]) cancByDent[r.dentista] = { nome: r.dentista, count: 0, valor: 0 };
    cancByDent[r.dentista].count++; cancByDent[r.dentista].valor += r.total;
  }
  const topVencidos = [...vencidos].sort((a, b) => b.total - a.total).slice(0, 8);
  const sc = calcScore({ geral, dentistas, canais, prevGeral: prev ? prev.geral : null });
  return { key, periodo, mes, ano, geral, dentistas, canais, cancelados, cancByDent: Object.values(cancByDent), topVencidos, score: sc.score, scoreParts: sc.parts };
}

function calcScore({ geral, dentistas, canais, prevGeral }) {
  const hm = geral.margem !== null;
  const parts = [];
  const add = (label, pts, max, hint) => parts.push({ label, pts: clamp(+pts.toFixed(1), 0, max), max, hint });

  // Crescimento → fator [0..1]: neutro (0.5) quando estável, cheio a +20%, zero a -20%.
  // Sem período anterior, retorna neutro para não punir o primeiro período.
  const growthFactor = (cur, prev) => {
    if (prev == null || prev <= 0) return 0.5;
    return clamp(0.5 + ((cur - prev) / prev / 0.20) * 0.5, 0, 1);
  };
  // Redução de despesas → invertido: cair é bom.
  const reductionFactor = (cur, prev) => {
    if (prev == null || prev <= 0) return 0.5;
    return clamp(0.5 + ((prev - cur) / prev / 0.20) * 0.5, 0, 1);
  };

  // ── Componentes operacionais ──
  const convMax = hm ? 22 : 30;
  add('Conversão', (geral.taxa / 100) * convMax, convMax, `${geral.taxa}% dos orçamentos aprovados.`);

  if (hm) add('Margem líquida', (geral.margem / 20) * 13, 13, `Margem de ${geral.margem}% (meta: 20%+).`);

  const concMax = 5;
  const vals = dentistas.map(d => d.valor_aprovado).filter(v => v > 0);
  let concPts = concMax / 2;
  if (vals.length > 1) {
    const mx = Math.max(...vals);
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    concPts = (1 - mx / total) * concMax;
  }
  add('Distribuição da receita', concPts, concMax, 'Quanto mais distribuída entre os vendedores, melhor.');

  const canMax = hm ? 10 : 15;
  const canaisValidos = canais.filter(c => c.taxa >= 70 && c.canal !== 'NAO INFORMADO');
  add('Qualidade dos canais', canaisValidos.length / Math.max(canais.length, 1) * canMax, canMax, 'Proporção de canais com conversão ≥ 70%.');

  const perdaMax = hm ? 15 : 20;
  add('Recuperação de receita', (1 - (geral.orcado > 0 ? geral.perdido / geral.orcado : 0)) * perdaMax, perdaMax, 'Quanto menos orçamentos vencidos, melhor.');

  // ── Componentes de crescimento (vs período anterior) ──
  const temPrev = !!prevGeral;
  const fatMax = hm ? 15 : 18;
  add('Crescimento do faturamento', growthFactor(geral.aprovado, prevGeral && prevGeral.aprovado) * fatMax, fatMax,
    temPrev ? 'Receita faturada vs período anterior.' : 'Sem período anterior para comparar — pontuação neutra.');

  const curTicket = geral.aprovados > 0 ? geral.aprovado / geral.aprovados : 0;
  const prevTicket = prevGeral && prevGeral.aprovados > 0 ? prevGeral.aprovado / prevGeral.aprovados : null;
  const tkMax = hm ? 8 : 12;
  add('Crescimento do ticket médio', growthFactor(curTicket, prevTicket) * tkMax, tkMax,
    temPrev ? 'Ticket médio vs período anterior.' : 'Sem período anterior para comparar — pontuação neutra.');

  if (hm) {
    const prevDesp = prevGeral && prevGeral.margem !== null ? prevGeral.despesas : null;
    add('Redução de despesas', reductionFactor(geral.despesas, prevDesp) * 12, 12,
      (temPrev && prevDesp != null) ? 'Despesas vs período anterior (cair é melhor).' : 'Sem base de comparação — pontuação neutra.');
  }

  const total = parts.reduce((s, p) => s + p.pts, 0);
  return { score: Math.round(clamp(total, 0, 100)), parts };
}

function computeYear(ano) {
  const months = MONTHS.filter(m => m.ano === ano);
  if (!months.length) return null;
  const allRecords = months.flatMap(m => (parsedMonths[m.key] && parsedMonths[m.key].records) || []);
  if (!allRecords.length) return null;
  const data = computeMonth({ records: allRecords, periodo: String(ano), mes: null, ano, key: 'year-' + ano });
  data.periodo = String(ano); data.key = 'year-' + ano; data.isYear = true; data.months = months;
  const scYear = calcScore({ geral: data.geral, dentistas: data.dentistas, canais: data.canais, prevGeral: null });
  data.score = scYear.score; data.scoreParts = scYear.parts;
  return data;
}
function buildYears() {
  YEARS = {};
  for (const m of MONTHS) {
    if (!YEARS[m.ano]) YEARS[m.ano] = { ano: m.ano, monthIndices: [] };
    YEARS[m.ano].monthIndices.push(MONTHS.indexOf(m));
  }
  for (const ano of Object.keys(YEARS)) YEARS[ano].data = computeYear(+ano);
}

// ─── GETTERS ───
function getActiveData() {
  if (_rangeFilter) return _rangeFilteredData || getActiveDataRaw();
  return getActiveDataRaw();
}
function getActiveDataRaw() {
  if (activeYear !== null) return YEARS[activeYear].data;
  return MONTHS[activeMonth];
}
function getPrev() {
  if (activeYear !== null) {
    const anos = Object.keys(YEARS).map(Number).sort((a, b) => a - b);
    const idx = anos.indexOf(+activeYear);
    return idx > 0 ? YEARS[anos[idx - 1]].data : null;
  }
  return activeMonth > 0 ? MONTHS[activeMonth - 1] : null;
}
function getActivePeriodLabel() {
  if (_rangeFilter) return _rangeFilter.from + ' → ' + _rangeFilter.to;
  if (activeYear !== null) return String(activeYear);
  return MONTHS[activeMonth].periodo;
}

function getGoalForActivePeriod() {
  // Meta mensal individual definida pelo botão Metas
  if (activeYear === null && activeMonth >= 0) {
    const key = MONTHS[activeMonth]?.key;
    if (key && _metasMensais[key] && _metasMensais[key] > 0) return _metasMensais[key];
  }

  // Meta anual — só aplica quando está na visão de ano
  if (activeYear !== null) {
    const key = 'year-' + activeYear;
    if (_metasMensais[key] && _metasMensais[key] > 0) return _metasMensais[key];
    // Usa meta da empresa como meta anual
    if (CFG.meta > 0) return CFG.meta;
  }

  // Na visão mensal sem meta individual — não mostra meta
  return 0;
}

// ─── RANGE FILTER ───
function buildRangeFilteredData(fromKey, toKey) {
  const filtered = MONTHS.filter(m => m.key >= fromKey && m.key <= toKey);
  if (!filtered.length) return null;
  const allRecords = filtered.flatMap(m => (parsedMonths[m.key] && parsedMonths[m.key].records) || []);
  if (!allRecords.length) return null;
  const data = computeMonth({
    records: allRecords,
    periodo: `${filtered[0].periodo} → ${filtered[filtered.length - 1].periodo}`,
    mes: null, ano: filtered[0].ano, key: 'range'
  });
  data.isRange = true;
  return data;
}
function populateRangeSelects() {
  const from = document.getElementById('rangeFrom'), to = document.getElementById('rangeTo');
  if (!from || !to) return;
  const opts = MONTHS.map(m => `<option value="${m.key}">${m.periodo}</option>`).join('');
  from.innerHTML = '<option value="">De...</option>' + opts;
  to.innerHTML = '<option value="">Até...</option>' + opts;
  if (_rangeFilter) { from.value = _rangeFilter.from; to.value = _rangeFilter.to; }
}
function applyRangeFilter() {
  const from = document.getElementById('rangeFrom').value;
  const to = document.getElementById('rangeTo').value;
  if (!from || !to) { alert('Selecione os dois períodos.'); return; }
  if (from > to) { alert('"De" deve ser anterior a "Até".'); return; }
  _rangeFilter = { from, to };
  _rangeFilteredData = buildRangeFilteredData(from, to);
  const badge = document.getElementById('rangeActiveBadge');
  const fl = MONTHS.find(m => m.key === from)?.periodo || from;
  const tl = MONTHS.find(m => m.key === to)?.periodo || to;
  if (badge) { badge.style.display = 'inline-block'; badge.textContent = `Intervalo: ${fl} → ${tl}`; }
  render();
}
function clearRangeFilter() {
  _rangeFilter = null; _rangeFilteredData = null;
  const badge = document.getElementById('rangeActiveBadge');
  if (badge) badge.style.display = 'none';
  const rf = document.getElementById('rangeFrom');
  const rt = document.getElementById('rangeTo');
  if (rf) rf.value = ''; if (rt) rt.value = '';
  render();
}

// ─── RUN ANALYSIS ───
function runAnalysis() {
  // Se não tem meses em memória mas tem empresa ativa, tenta carregar do banco
  if (!Object.keys(parsedMonths).length && _empresaAtiva) {
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('loadingMsg').textContent = 'Carregando dados da empresa...';
    dbCarregarTudo(_empresaAtiva.id).then(() => {
      if (!Object.keys(parsedMonths).length) {
        document.getElementById('loadingScreen').style.display = 'none';
        showErr('Nenhuma planilha de KPIs encontrada. Suba a planilha de orçamentos primeiro.');
        return;
      }
      _executarAnalise();
    }).catch(() => {
      document.getElementById('loadingScreen').style.display = 'none';
      showErr('Erro ao carregar dados da empresa.');
    });
    return;
  }

  if (!Object.keys(parsedMonths).length) {
    showErr('Nenhuma planilha válida carregada.');
    return;
  }

  _executarAnalise();
}

function _executarAnalise() {
  // Não chama saveConfig se empresa ativa (preserva meta)
  if (!_empresaAtiva) saveConfig();

  document.getElementById('loadingScreen').style.display = 'flex';

  setTimeout(() => {
    const _sortedRaw = Object.values(parsedMonths).sort((a, b) => a.key.localeCompare(b.key));
    MONTHS = [];
    let _prevM = null;
    for (const m of _sortedRaw) {
      document.getElementById('loadingMsg').textContent = `Calculando ${m.periodo}...`;
      const _cm = computeMonth(m, _prevM);
      MONTHS.push(_cm);
      _prevM = _cm;
    }

    buildYears();
    const anos = Object.keys(YEARS).map(Number).sort((a, b) => a - b);
    activeYear = String(anos[anos.length - 1]);
    activeMonth = MONTHS.length - 1;

    if (anos.length >= 2) {
      cmpItems = [
        { type: 'year', idx: String(anos[anos.length - 2]) },
        { type: 'year', idx: String(anos[anos.length - 1]) }
      ];
    } else {
      cmpItems = MONTHS.length >= 2
        ? [{ type: 'month', idx: MONTHS.length - 2 }, { type: 'month', idx: MONTHS.length - 1 }]
        : [];
    }

    loadLocalState();

    // Restaura meta — empresa ativa tem prioridade
    if (_empresaAtiva && _empresaAtiva.meta > 0) {
      clinicGoal = _empresaAtiva.meta;
      CFG.meta = _empresaAtiva.meta;
    } else if (CFG.meta > 0 && clinicGoal === 0) {
      clinicGoal = CFG.meta;
    }

    render();
    applyConfigToUI();

    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('uploadScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('tabCmpBtn').style.display = 'inline-flex';

    const tfb = document.getElementById('tabFinBtn');
    if (tfb) tfb.style.display = 'inline-flex';

    const hasFin = MONTHS.some(m => m.geral.hasDespesas)
      || Object.keys(parsedExpenses).length > 0;
    if (hasFin) _finView = 'year:' + anos[anos.length - 1];

    window.scrollTo(0, 0);

    // Salva na nuvem se empresa ativa
    if (_empresaAtiva) {
      dbSalvarTudo(_empresaAtiva.id)
        .then(() => showToast('✅ Dados salvos na nuvem!'))
        .catch(() => showToast('⚠️ Erro ao salvar na nuvem.', true));
    }
  }, 100);
}

// ═══════════════════════════════════════
//  RENDER PRINCIPAL
// ═══════════════════════════════════════
function render() {
  const M = getActiveData();
  const prev = (_rangeFilter === null && activeYear === null && activeMonth > 0) ? MONTHS[activeMonth - 1] : null;
  document.getElementById('periodBadge').textContent = '🗓 ' + getActivePeriodLabel();
  document.getElementById('headerSub').textContent = 'Painel de performance comercial · ' + getActivePeriodLabel();
  renderPeriodSelector();
  populateRangeSelects();
  renderGoalProgress();
  renderExec(M, prev);
  renderKPIs(M, prev);
  renderFatBars(M);
  renderCanaisGrid(M);
  renderInsights(M);
  renderDentistas(M);
  renderCanais(M);
  renderRecuperar(M);
  renderAcoes(M, prev);
  renderCancelados(M);
  renderComparativo();
  renderDespesas();
  renderTrendChart();
  renderPartialMonthBanner(M);
  renderNotasPeriodo(M);
  syncGoalInput();
  if (document.getElementById('tab-vendedores').classList.contains('active')) renderVendedores();
}

function syncGoalInput() {
  const gi = document.getElementById('goalInput');
  if (!gi) return;
  const goalAtivo = getGoalForActivePeriod();
  if (goalAtivo > 0) {
    gi.value = 'R$ ' + goalAtivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  } else {
    gi.value = '';
    gi.placeholder = 'R$ 0,00';
  }
}

function renderPartialMonthBanner(M) {
  const existing = document.getElementById('partialMonthBanner');
  if (existing) existing.remove();
  if (activeYear !== null || _rangeFilter) return;
  if (M.mes === null || M.mes === undefined) return;
  const partial = getPartialMonthInfo(M.mes, M.ano);
  if (!partial) return;
  const banner = document.createElement('div');
  banner.id = 'partialMonthBanner';
  banner.innerHTML = `
    <span style="font-size:18px">⚠️</span>
    <div>
      <strong>${M.periodo} — mês em andamento</strong>
      <span style="color:var(--muted);margin-left:8px">
        Dados parciais até dia ${partial.dia} de ${partial.totalDias}
        (${partial.pctMes}% do mês). Os números ainda vão mudar.
      </span>
    </div>`;
  const kpiGrid = document.getElementById('kpiGrid');
  if (kpiGrid && kpiGrid.parentNode) kpiGrid.parentNode.insertBefore(banner, kpiGrid);
}

function renderGoalProgress() {
  const bar = document.getElementById('goalProgressBar');
  const fill = document.getElementById('goalProgressFill');
  const lbl = document.getElementById('goalProgressLabel');
  if (!bar || !fill || !lbl) return;
  const goalAtivo = getGoalForActivePeriod();
  if (goalAtivo <= 0) { bar.style.display = 'none'; lbl.style.display = 'none'; return; }
  const M = getActiveData();
  const pctVal = Math.min(+(M.geral.aprovado / goalAtivo * 100).toFixed(1), 100);
  const color = pctVal >= 100 ? 'var(--green)' : pctVal >= 75 ? 'var(--yellow)' : 'var(--red)';
  bar.style.display = 'block'; lbl.style.display = 'block';
  fill.style.width = pctVal + '%'; fill.style.background = color;
  lbl.style.color = color; lbl.textContent = pctVal + '% da meta (' + fmtK(goalAtivo) + ')';
}

function renderPeriodSelector() {
  const anos = Object.keys(YEARS).map(Number).sort((a, b) => a - b);
  document.getElementById('monthTabsKPI').innerHTML = anos.map(ano => {
    const y = YEARS[ano];
    const miy = y.monthIndices.map(i => MONTHS[i]);
    const isActive = activeYear === String(ano) && !_rangeFilter;
    return `<div class="period-group"><button class="year-chip ${isActive ? 'active' : ''}" onclick="setActiveYearView('${ano}')">${ano}${miy.length > 1 ? `<span class="year-arrow" onclick="event.stopPropagation();openPortalDropdown(this,'yd-${ano}')">▾</span>` : ''}</button></div>`;
  }).join('');
}

let _portalTarget = null;
function openPortalDropdown(arrowEl, id) {
  const portal = document.getElementById('dropPortal');
  if (_portalTarget === id) { closePortalDropdown(); return; }
  _portalTarget = id;
  const ano = id.replace('yd-', '');
  const y = YEARS[ano];
  if (!y) return;
  const miy = y.monthIndices.map(i => MONTHS[i]);
  portal.innerHTML = miy.map(m => {
    const idx = MONTHS.indexOf(m);
    const isA = activeYear === null && activeMonth === idx && !_rangeFilter;
    return `<button class="ydrop-item ${isA ? 'active' : ''}" onclick="setActiveMonthView(${idx});closePortalDropdown()">${MONTHS_PT[m.mes]}</button>`;
  }).join('');
  const rect = arrowEl.getBoundingClientRect();
  portal.style.display = 'flex';
  portal.style.top = (rect.bottom + window.scrollY + 6) + 'px';
  portal.style.left = (rect.left + window.scrollX - 100) + 'px';
}
function closePortalDropdown() {
  _portalTarget = null;
  const p = document.getElementById('dropPortal');
  if (p) { p.style.display = 'none'; p.innerHTML = ''; }
}
document.addEventListener('click', e => {
  if (!e.target.closest('.period-group') && !e.target.closest('#dropPortal'))
    closePortalDropdown();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePortalDropdown();
    if (_apresentacaoAtivo) sairApresentacao();
  }
  if (_apresentacaoAtivo) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') apresentacaoNext();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') apresentacaoPrev();
  }
});
function setActiveYearView(ano) {
  activeYear = String(ano); activeMonth = MONTHS.length - 1;
  _rangeFilter = null; _rangeFilteredData = null;
  const b = document.getElementById('rangeActiveBadge');
  if (b) b.style.display = 'none';
  closePortalDropdown(); render();
}
function setActiveMonthView(idx) {
  activeYear = null; activeMonth = idx;
  _rangeFilter = null; _rangeFilteredData = null;
  const b = document.getElementById('rangeActiveBadge');
  if (b) b.style.display = 'none';
  closePortalDropdown(); render();
}

function renderExec(M, prev) {
  const g = M.geral;
  const topDent = [...M.dentistas].sort((a, b) => b.valor_aprovado - a.valor_aprovado)[0];
  const piorDent = [...M.dentistas].filter(d => d.total >= 5).sort((a, b) => a.taxa - b.taxa)[0];
  const totalVencVal = M.topVencidos.reduce((s, v) => s + v.total, 0);
  const scoreColor = M.score >= 80 ? 'var(--green)' : M.score >= 65 ? 'var(--yellow)' : M.score >= 50 ? 'var(--orange)' : 'var(--red)';
  const scoreGrade = M.score >= 80 ? 'Saudável' : M.score >= 65 ? 'Atenção' : M.score >= 50 ? 'Regular' : 'Crítico';
  const vLabel = CFG.vendedor || 'Vendedor';
  let prevTxt = '';
  if (prev) {
    const diff = g.aprovado - prev.geral.aprovado;
    prevTxt = ` Em comparação a ${prev.periodo}, a receita ${diff >= 0 ? '<span class="good">cresceu ' + fmtK(Math.abs(diff)) + '</span>' : '<span class="bad">caiu ' + fmtK(Math.abs(diff)) + '</span>'}. `;
  }
  const _r = 44, _C = 2 * Math.PI * _r, _len = (M.score / 100) * _C;
  document.getElementById('execSummary').innerHTML = `
    <div class="exec-main">
      <div class="exec-title">Resumo executivo — ${M.periodo}</div>
      <div class="exec-text">
        A empresa fechou o período com <strong>${fmtK(g.aprovado)}</strong> em receita aprovada
        e taxa de conversão de <span class="${g.taxa >= (_benchmarks.conversaoIdeal || 75) ? 'good' : g.taxa >= (_benchmarks.conversaoCritica || 60) ? 'warn' : 'bad'}">${g.taxa}%</span>.
        ${prevTxt}
        ${topDent ? ` <strong>${topDent.nome}</strong> liderou com ${fmtK(topDent.valor_aprovado)}.` : ''}
        ${piorDent && piorDent.taxa < 70 ? ` <span class="bad">⚠ ${piorDent.nome} com ${piorDent.taxa}% de conversão.</span>` : ''}
        ${totalVencVal > 0 ? ` Há <span class="bad">${fmtK(totalVencVal)}</span> em vencidos recuperáveis.` : ''}
      </div>
    </div>
    <div class="exec-score">
      <div class="exec-ring">
        <svg width="104" height="104" viewBox="0 0 104 104">
          <circle cx="52" cy="52" r="${_r}" fill="none" stroke="var(--raise)" stroke-width="8"/>
          <circle cx="52" cy="52" r="${_r}" fill="none" stroke="${scoreColor}" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${_len.toFixed(1)} ${_C.toFixed(1)}" transform="rotate(-90 52 52)"/>
        </svg>
        <div class="exec-ring-v"><b style="color:${scoreColor}">${M.score}</b><span>/100</span></div>
      </div>
      <div class="exec-grade" style="color:${scoreColor}">${scoreGrade}</div>
      ${(M.scoreParts && M.scoreParts.length) ? `<button type="button" class="score-toggle" onclick="toggleScoreBreakdown()" style="margin-top:8px;background:none;border:none;cursor:pointer;font-family:var(--fh);font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);display:inline-flex;align-items:center;gap:4px">Detalhes <span class="score-toggle-caret">${_scoreBreakdownOpen ? '▴' : '▾'}</span></button>` : ''}
    </div>`;
  renderScoreBreakdown(M);
}

let _scoreBreakdownOpen = false;
function toggleScoreBreakdown() {
  _scoreBreakdownOpen = !_scoreBreakdownOpen;
  const el = document.getElementById('scoreBreakdown');
  if (el) el.style.display = _scoreBreakdownOpen ? 'block' : 'none';
  document.querySelectorAll('.score-toggle-caret').forEach(c => c.textContent = _scoreBreakdownOpen ? '▴' : '▾');
}

function renderScoreBreakdown(M) {
  const el = document.getElementById('scoreBreakdown');
  if (!el) return;
  const parts = M.scoreParts || [];
  if (!parts.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  const rows = parts.map(p => {
    const pctv = p.max > 0 ? Math.round(p.pts / p.max * 100) : 0;
    const col = pctv >= 75 ? 'var(--green)' : pctv >= 45 ? 'var(--yellow)' : 'var(--red)';
    return `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:5px">
          <span style="color:var(--text)">${p.label}</span>
          <span style="font-family:var(--mono);font-size:12px;color:${col}">${p.pts.toFixed(1)}<span style="color:var(--muted)">/${p.max}</span></span>
        </div>
        <div style="height:6px;background:var(--raise);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pctv}%;background:${col};border-radius:4px"></div>
        </div>
        ${p.hint ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${p.hint}</div>` : ''}
      </div>`;
  }).join('');
  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px 20px">
      <div style="font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:14px">📊 Detalhamento do Score — ${M.score}/100</div>
      ${rows}
    </div>`;
  el.style.display = _scoreBreakdownOpen ? 'block' : 'none';
}

function setGoal(raw) {
  const val = parseBrNum(raw.replace(/[^\d.,]/g, '')) || 0;
  if (activeYear === null && MONTHS[activeMonth]) {
    const key = MONTHS[activeMonth].key;
    if (val > 0) _metasMensais[key] = val;
    else { delete _metasMensais[key]; clinicGoal = 0; }
  } else if (activeYear !== null) {
    const key = 'year-' + activeYear;
    if (val > 0) _metasMensais[key] = val;
    else delete _metasMensais[key];
  }
  if (val > 0) clinicGoal = val;
  saveLocalState();
  const M = getActiveData();
  if (M) { renderKPIs(M, getPrev()); renderGoalProgress(); }
}

function renderKPIs(M, prev) {
  const g = M.geral, pg = prev?.geral;
  const d1 = pg ? delta(g.aprovado, pg.aprovado) : { html: '' };
  const d2 = pg ? delta(g.taxa, pg.taxa) : { html: '' };
  const d3 = pg ? delta(g.perdido, pg.perdido) : { html: '', val: 0 };
  const ticketMedio = g.aprovados > 0 ? g.aprovado / g.aprovados : 0;
  const goalAtivo = getGoalForActivePeriod();
  const goalPct = goalAtivo > 0 ? Math.min(+(g.aprovado / goalAtivo * 100).toFixed(1), 999) : null;
  const goalColor = goalPct === null ? 'var(--muted)' : goalPct >= 100 ? 'var(--green)' : goalPct >= 75 ? 'var(--yellow)' : 'var(--red)';
  const margemVal = g.margem !== null && g.margem !== undefined ? g.margem : null;
  const margemKpi = g.hasDespesas && margemVal !== null ? {
    l: 'Margem Líquida', tt: 'Margem Líquida', v: margemVal + '%',
    s: margemVal >= 20 ? 'saudável' : margemVal >= 10 ? 'atenção' : margemVal >= 0 ? 'baixa' : 'negativa',
    c: margemVal >= 20 ? 'var(--green)' : margemVal >= 10 ? 'var(--yellow)' : margemVal >= 0 ? 'var(--orange)' : 'var(--red)', d: ''
  } : null;
  const kpis = [
    { l: 'Taxa de Conversão', tt: 'Taxa de Conversão', v: g.taxa + '%', s: `${g.aprovados} de ${g.total}`, c: 'var(--accent)', d: d2.html ? `${d2.html} vs ${prev.periodo}` : '' },
    { l: 'Receita Faturada', tt: 'Receita Faturada', v: fmtK(g.aprovado), s: `de ${fmtK(g.orcado)} orçados`, c: 'var(--green)', d: d1.html ? `${d1.html} vs ${prev.periodo}` : '' },
    goalPct !== null ? { l: 'Meta de Faturamento', tt: 'Meta de Faturamento', v: goalPct + '%', s: `${fmtK(g.aprovado)} de ${fmtK(goalAtivo)}`, c: goalColor, d: '' } : null,
    { l: 'Receita Perdida', tt: 'Receita Perdida', v: fmtK(g.perdido), s: `${g.vencidos} vencidos`, c: 'var(--red)', d: d3.html ? `${d3.html} vs ${prev.periodo}` : '' },
    { l: 'Ticket Médio', tt: 'Ticket Médio', v: fmtK(ticketMedio), s: 'por aprovação', c: 'var(--yellow)', d: '' },
    margemKpi,
    { l: 'Potencial Recuperável', tt: 'Potencial Recuperável', v: fmtK(g.perdido * .3), s: 'estimativa 30% follow-up', c: 'var(--orange)', d: '' },
    { l: 'Total Orçamentos', tt: 'Total Orçamentos', v: g.total, s: 'no período', c: 'var(--accent2)', d: '' },
    { l: 'Cancelamentos', tt: 'Cancelamentos', v: g.cancelados, s: `${fmtK(g.canceladoVal)} perdidos`, c: 'var(--orange)', d: '' },
    { l: 'Score de Saúde', tt: 'Score de Saúde', v: M.score + '/100', s: M.score >= 80 ? 'Saudável' : M.score >= 65 ? 'Atenção' : 'Crítico', c: M.score >= 80 ? 'var(--green)' : M.score >= 65 ? 'var(--yellow)' : 'var(--red)', d: '' },
  ].filter(Boolean);
  document.getElementById('kpiGrid').innerHTML = kpis.map(k => {
    const tt = KPI_TOOLTIPS[k.tt] || '';
    const info = tt ? `<span class="kpi-info" tabindex="0">ⓘ<span class="kpi-tooltip">${tt}</span></span>` : '';
    return `<div class="kpi" style="--kc:${k.c}"><div class="kpi-lbl">${k.l}${info}</div><div class="kpi-val">${k.v}</div><div class="kpi-sub">${k.s}</div>${k.d ? `<div class="kpi-delta">${k.d}</div>` : ''}</div>`;
  }).join('');
}

function renderFatBars(M) {
  const sorted = [...M.dentistas].sort((a, b) => b.valor_aprovado - a.valor_aprovado);
  const maxV = Math.max(...sorted.map(d => d.valor_aprovado), 1);
  document.getElementById('fatBars').innerHTML = sorted.map(d =>
    `<div class="bar-item">
      <div class="bar-lbl"><span>${d.nome}</span><span>${fmtK(d.valor_aprovado)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.valor_aprovado / maxV * 100).toFixed(1)}%"></div></div>
    </div>`
  ).join('');
}

function renderCanaisGrid(M) {
  const arr = [...M.canais].sort((a, b) => b.valor - a.valor);
  const maxV = Math.max(...arr.map(c => c.valor), 1);
  document.getElementById('canaisGrid').innerHTML = arr.map(c =>
    `<div class="seg-row">
      <span class="seg-name">${canalDisplay(c.canal)}</span>
      <span class="seg-bar"><i style="width:${(c.valor / maxV * 100).toFixed(0)}%;background:${canalColor(c.canal)}"></i></span>
      <span class="seg-val">${fmtK(c.valor)}</span>
    </div>`
  ).join('');
}

function renderInsights(M) {
  const ins = generateInsights(M);
  ins.sort((a, b) => ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[a.t] || 9) - ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[b.t] || 9));
  document.getElementById('insGrid').innerHTML = ins.map(i =>
    `<div class="ins">
      <div class="ins-ico ico-${i.t}">${i.i}</div>
      <div>
        <div class="ins-type tp-${i.t}">${i.l}</div>
        <div class="ins-txt">${i.txt}</div>
        <div class="ins-sub">${i.sub}</div>
      </div>
    </div>`
  ).join('');
}

function generateInsights(M) {
  const g = M.geral, ins = [];
  const tC = g.aprovados > 0 ? g.aprovado / g.aprovados : 0;
  const vLabel = CFG.vendedor || 'Vendedor';
  const vLabelP = pluralizar(vLabel);
  const cLabel = CFG.cliente || 'Cliente';
  const piorTaxa = [...M.dentistas].filter(d => d.total >= 5).sort((a, b) => a.taxa - b.taxa)[0];
  const maiorPerda = [...M.dentistas].sort((a, b) => b.valor_perdido - a.valor_perdido)[0];
  const upsell = [...M.dentistas].filter(d => d.taxa >= 85 && d.ticket_medio < tC * .6 && d.total >= 5);
  const ni = M.canais.find(c => c.canal === 'NAO INFORMADO');
  const canalRuim = [...M.canais].filter(c => c.total >= 5 && c.taxa < 50 && c.canal !== 'NAO INFORMADO').sort((a, b) => a.taxa - b.taxa)[0];
  const melhorCanal = [...M.canais].filter(c => c.total >= 5).sort((a, b) => b.taxa - a.taxa)[0];
  const lento = [...M.dentistas].filter(d => d.tempo_medio > 7 && d.total >= 5).sort((a, b) => b.tempo_medio - a.tempo_medio)[0];
  const percPerd = pct(g.perdido, g.orcado);
  const ideal = _benchmarks.conversaoIdeal || 75;
  const critica = _benchmarks.conversaoCritica || 60;
  const cancAlerta = _benchmarks.cancelamentosAlerta || 10;
  if (g.taxa >= ideal) ins.push({ t: 'g', i: '✅', l: 'Excelente Conversão', txt: `Taxa de ${g.taxa}% acima da meta de ${ideal}%.`, sub: 'Manter processo e focar em volume de novos clientes.' });
  else if (g.taxa >= critica) ins.push({ t: 'w', i: '📊', l: 'Conversão Melhorável', txt: `Taxa de ${g.taxa}% aceitável, mas ajustes podem chegar a ${ideal}%+.`, sub: 'Revisar roteiro de apresentação e resposta a objeções.' });
  else ins.push({ t: 'a', i: '🚨', l: 'Taxa de Conversão Crítica', txt: `Taxa de ${g.taxa}% abaixo do mínimo esperado (${critica}%).`, sub: 'Reunião urgente para mapear motivos de recusa.' });
  if (percPerd > 35) ins.push({ t: 'a', i: '💸', l: `${percPerd.toFixed(0)}% da Receita Perdida`, txt: `${fmtK(g.perdido)} em vencidos — ${percPerd.toFixed(0)}% do total orçado.`, sub: `Recuperar 30% = +${fmtK(g.perdido * .3)}.` });
  if (maiorPerda && maiorPerda.valor_perdido > g.perdido * .25) ins.push({ t: 'a', i: '⚠️', l: `Atenção: ${maiorPerda.nome}`, txt: `${pct(maiorPerda.valor_perdido, g.perdido).toFixed(0)}% da receita perdida — ${fmtK(maiorPerda.valor_perdido)}.`, sub: `Investigar motivos de recusa.` });
  if (piorTaxa && piorTaxa.taxa < critica && piorTaxa !== maiorPerda) ins.push({ t: 'w', i: '🎯', l: `Conversão Baixa: ${piorTaxa.nome}`, txt: `${piorTaxa.taxa}% com ${piorTaxa.total} orçamentos.`, sub: `${fmtK(piorTaxa.valor_perdido)} perdidos.` });
  if (upsell.length > 0) { const u = upsell[0]; ins.push({ t: 'i', i: '💡', l: `Upsell: ${u.nome}`, txt: `${u.taxa}% conversão mas ticket ${fmtK(u.ticket_medio)} vs média ${fmtK(tC)}.`, sub: `${cLabel}s engajados são receptivos a serviços complementares.` }); }
  if (ni && ni.total > 8) ins.push({ t: 'w', i: '📋', l: 'Dados de Marketing Incompletos', txt: `${ni.total} orçamentos sem canal (${pct(ni.total, g.total).toFixed(0)}%).`, sub: 'Tornar campo obrigatório.' });
  if (canalRuim) ins.push({ t: 'a', i: '📍', l: `Canal Ineficiente: ${canalDisplay(canalRuim.canal)}`, txt: `${canalRuim.taxa}% de conversão com ${canalRuim.total} orçamentos.`, sub: 'Revisar abordagem e qualificação.' });
  if (melhorCanal && melhorCanal.taxa >= 80) ins.push({ t: 'g', i: '🔄', l: `Melhor Canal: ${canalDisplay(melhorCanal.canal)}`, txt: `${melhorCanal.taxa}% conversão e ${fmtK(melhorCanal.valor)}.`, sub: 'Ampliar foco nesse canal.' });
  if (lento) ins.push({ t: 'w', i: '⏱️', l: `Lento em Fechar: ${lento.nome}`, txt: `Média de ${lento.tempo_medio} dias (ideal: até 3).`, sub: 'Mais tempo aumenta chance de desistência.' });
  if (g.cancelados > g.total * (cancAlerta / 100)) ins.push({ t: 'o', i: '🔴', l: 'Alto Índice de Cancelamentos', txt: `${g.cancelados} cancelamentos (${pct(g.cancelados, g.total + g.cancelados).toFixed(0)}% do total).`, sub: `Investigar por ${vLabel.toLowerCase()}.` });
  return ins;
}

// ═══════════════════════════════════════
//  NOTAS POR PERÍODO
// ═══════════════════════════════════════
function renderNotasPeriodo(M) {
  const existing = document.getElementById('notasPeriodoWrap');
  if (existing) existing.remove();
  if (_rangeFilter) return;
  const key = activeYear !== null ? 'year-' + activeYear : M.key;
  const nota = _notas[key] || '';
  const wrap = document.createElement('div');
  wrap.id = 'notasPeriodoWrap';
  wrap.style.cssText = 'margin-bottom:24px;';
  wrap.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px 20px;">
      <div style="font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;display:flex;align-items:center;gap:8px;justify-content:space-between;">
        <span>📝 Anotações — ${M.periodo}</span>
        <span id="notaSavedIndicator" style="font-size:10px;color:var(--green);opacity:0;transition:opacity .3s;letter-spacing:.5px;">✓ Salvo</span>
      </div>
      <textarea id="notaTextarea"
        placeholder="Adicione observações sobre este período..."
        style="width:100%;min-height:72px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:var(--fb);font-size:13px;padding:10px 14px;resize:vertical;outline:none;box-sizing:border-box;line-height:1.6;"
        onfocus="this.style.borderColor='rgba(91,141,239,.6)'"
        onblur="this.style.borderColor=''"
        oninput="saveNota('${key}',this.value)"
      >${nota}</textarea>
    </div>`;
  const insGrid = document.getElementById('insGrid');
  if (insGrid && insGrid.parentNode) {
    insGrid.parentNode.insertBefore(wrap, insGrid.parentNode.querySelector('.sec:last-of-type') || insGrid);
  }
}
function saveNota(key, texto) {
  _notas[key] = texto;
  const ind = document.getElementById('notaSavedIndicator');
  if (ind) {
    ind.style.opacity = '1';
    clearTimeout(ind._t);
    ind._t = setTimeout(() => { ind.style.opacity = '0'; }, 2000);
  }
}

// ═══════════════════════════════════════
//  BENCHMARKS
// ═══════════════════════════════════════
function openBenchmarksModal() {
  const existing = document.getElementById('benchmarksModal');
  if (existing) { existing.remove(); return; }
  const modal = document.createElement('div');
  modal.id = 'benchmarksModal';
  modal.className = 'metrik-modal-overlay';
  modal.innerHTML = `
    <div class="metrik-modal">
      <div class="metrik-modal-title">⚙️ Benchmarks de Performance</div>
      <div class="metrik-modal-sub">
        Esses valores definem as cores dos indicadores no dashboard.<br>
        <span style="color:var(--green)">●</span> Verde = acima do ideal &nbsp;
        <span style="color:var(--yellow)">●</span> Amarelo = entre crítico e ideal &nbsp;
        <span style="color:var(--red)">●</span> Vermelho = abaixo do crítico
      </div>
      <div class="benchmark-field">
        <label class="benchmark-label">Conversão Ideal (%)</label>
        <input type="number" id="bm_convIdeal" class="benchmark-input" value="${_benchmarks.conversaoIdeal}">
        <div class="benchmark-hint">Acima disso = <span style="color:var(--green)">verde</span>. Ex: 75</div>
      </div>
      <div class="benchmark-field">
        <label class="benchmark-label">Conversão Crítica (%)</label>
        <input type="number" id="bm_convCritica" class="benchmark-input" value="${_benchmarks.conversaoCritica}">
        <div class="benchmark-hint">Abaixo disso = <span style="color:var(--red)">vermelho</span>. Ex: 60</div>
      </div>
      <div class="benchmark-field">
        <label class="benchmark-label">Margem Líquida Ideal (%)</label>
        <input type="number" id="bm_margemIdeal" class="benchmark-input" value="${_benchmarks.margemIdeal}">
      </div>
      <div class="benchmark-field">
        <label class="benchmark-label">Margem Líquida Mínima (%)</label>
        <input type="number" id="bm_margemBaixa" class="benchmark-input" value="${_benchmarks.margemBaixa}">
      </div>
      <div class="benchmark-field">
        <label class="benchmark-label">Alerta de Cancelamentos (%)</label>
        <input type="number" id="bm_cancAlerta" class="benchmark-input" value="${_benchmarks.cancelamentosAlerta}">
      </div>
      <div class="benchmark-field">
        <label class="benchmark-label">Ticket Mínimo Esperado (R$)</label>
        <input type="number" id="bm_ticketMin" class="benchmark-input" value="${_benchmarks.ticketMinimo}">
      </div>
      <div class="metrik-modal-footer">
        <button class="metrik-modal-btn-confirm" onclick="saveBenchmarks()">✓ Salvar e Atualizar Dashboard</button>
        <button class="metrik-modal-btn-cancel" onclick="document.getElementById('benchmarksModal').remove()">Cancelar</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
function saveBenchmarks() {
  _benchmarks.conversaoIdeal = +document.getElementById('bm_convIdeal').value || 75;
  _benchmarks.conversaoCritica = +document.getElementById('bm_convCritica').value || 60;
  _benchmarks.margemIdeal = +document.getElementById('bm_margemIdeal').value || 20;
  _benchmarks.margemBaixa = +document.getElementById('bm_margemBaixa').value || 10;
  _benchmarks.cancelamentosAlerta = +document.getElementById('bm_cancAlerta').value || 10;
  _benchmarks.ticketMinimo = +document.getElementById('bm_ticketMin').value || 0;
  saveLocalState();
  document.getElementById('benchmarksModal').remove();
  render();
  showToast('✅ Benchmarks atualizados!');
}

// ═══════════════════════════════════════
//  METAS MENSAIS
// ═══════════════════════════════════════
function openMetasMensaisModal() {
  const existing = document.getElementById('metasMensaisModal');
  if (existing) { existing.remove(); return; }
  const modal = document.createElement('div');
  modal.id = 'metasMensaisModal';
  modal.className = 'metrik-modal-overlay';
  const mesesHtml = MONTHS.map(m => {
    const metaAtual = _metasMensais[m.key] || '';
    return `<div class="meta-mensal-row">
      <div class="meta-mensal-label">${m.periodo}</div>
      <input type="text" data-key="${m.key}"
        value="${metaAtual ? 'R$ ' + metaAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}"
        placeholder="R$ 0,00" class="meta-mensal-input">
    </div>`;
  }).join('');
  modal.innerHTML = `
    <div class="metrik-modal" style="max-width:500px">
      <div class="metrik-modal-title">🎯 Metas por Mês</div>
      <div class="metrik-modal-sub">Defina metas individuais. Deixe em branco para usar a meta global.</div>
      <div>${mesesHtml || '<div style="color:var(--muted);font-size:13px">Nenhum mês carregado ainda.</div>'}</div>
      <div class="metrik-modal-footer">
        <button class="metrik-modal-btn-confirm" onclick="saveMetasMensais()">✓ Salvar Metas</button>
        <button class="metrik-modal-btn-cancel" onclick="document.getElementById('metasMensaisModal').remove()">Cancelar</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
function saveMetasMensais() {
  document.querySelectorAll('.meta-mensal-input').forEach(input => {
    const key = input.getAttribute('data-key');
    const val = parseBrNum(input.value.replace(/[^\d.,]/g, '')) || 0;
    if (val > 0) _metasMensais[key] = val;
    else delete _metasMensais[key];
  });
  document.getElementById('metasMensaisModal').remove();
  render();
  showToast('✅ Metas mensais salvas!');
}

// ═══════════════════════════════════════
//  EXPORT EXCEL
// ═══════════════════════════════════════
function exportExcel() {
  const M = getActiveData();
  if (!M) { showToast('❌ Nenhum dado disponível.', true); return; }
  let records = [];
  if (activeYear !== null) {
    MONTHS.filter(m => m.ano === +activeYear).forEach(m => {
      const raw = parsedMonths[m.key];
      if (raw) records = records.concat(raw.records.map(r => ({ ...r, _periodo: m.periodo })));
    });
  } else if (_rangeFilter) {
    MONTHS.filter(m => m.key >= _rangeFilter.from && m.key <= _rangeFilter.to).forEach(m => {
      const raw = parsedMonths[m.key];
      if (raw) records = records.concat(raw.records.map(r => ({ ...r, _periodo: m.periodo })));
    });
  } else {
    const raw = parsedMonths[MONTHS[activeMonth].key];
    if (raw) records = raw.records.map(r => ({ ...r, _periodo: MONTHS[activeMonth].periodo }));
  }
  if (!records.length) { showToast('❌ Nenhum registro para exportar.', true); return; }
  const formatDate = d => {
    if (!d) return '';
    if (d instanceof Date) return d.toLocaleDateString('pt-BR');
    return String(d);
  };
  const vLabel = CFG.vendedor || 'Vendedor';
  const cLabel = CFG.cliente || 'Cliente';
  const wsData = records.map(r => ({
    'Período': r._periodo || '',
    'Emissão': formatDate(r.emissao),
    'Aprovação': formatDate(r.aprovacao),
    [vLabel]: r.dentista || '',
    [cLabel]: r.paciente || '',
    'Total Líquido': r.total || 0,
    'Situação': r.situacao || '',
    'Canal': canalDisplay(r.campanha || ''),
    'Telefone': r.telefone || '',
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 28 },
    { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const g = M.geral;
  const goalAtivo = getGoalForActivePeriod();
  const resumoData = [
    { Indicador: 'Período', Valor: getActivePeriodLabel() },
    { Indicador: 'Total de Orçamentos', Valor: g.total },
    { Indicador: 'Aprovados', Valor: g.aprovados },
    { Indicador: 'Vencidos', Valor: g.vencidos },
    { Indicador: 'Cancelados', Valor: g.cancelados },
    { Indicador: 'Taxa de Conversão (%)', Valor: g.taxa },
    { Indicador: 'Receita Faturada (R$)', Valor: g.aprovado },
    { Indicador: 'Receita Perdida (R$)', Valor: g.perdido },
    { Indicador: 'Ticket Médio (R$)', Valor: g.aprovados > 0 ? +(g.aprovado / g.aprovados).toFixed(2) : 0 },
    { Indicador: 'Meta (R$)', Valor: goalAtivo || 'Não definida' },
    { Indicador: '% da Meta', Valor: goalAtivo > 0 ? +(g.aprovado / goalAtivo * 100).toFixed(1) + '%' : '—' },
    { Indicador: 'Score de Saúde', Valor: M.score + '/100' },
    ...(g.hasDespesas ? [
      { Indicador: 'Despesas Totais (R$)', Valor: g.despesas },
      { Indicador: 'Lucro Líquido (R$)', Valor: g.aprovado - g.despesas },
      { Indicador: 'Margem Líquida (%)', Valor: g.margem },
    ] : []),
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  wsResumo['!cols'] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  const vData = [...M.dentistas].sort((a, b) => b.valor_aprovado - a.valor_aprovado).map((d, i) => ({
    '#': i + 1,
    [vLabel]: d.nome,
    'Orçamentos': d.total,
    'Aprovados': d.aprovados,
    'Conversão (%)': d.taxa,
    'Receita (R$)': +d.valor_aprovado.toFixed(2),
    'Ticket Médio (R$)': +d.ticket_medio.toFixed(2),
    'Tempo Médio (dias)': d.tempo_medio,
    'Cancelados': d.cancelados,
    'Perdido (R$)': +d.valor_perdido.toFixed(2),
    'Melhor Canal': canalDisplay(d.melhor_canal || ''),
  }));
  const wsVend = XLSX.utils.json_to_sheet(vData);
  wsVend['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsVend, pluralizar(vLabel));
  const nomeArq = (CFG.empresa || 'Metrik').replace(/[^a-zA-Z0-9]/g, '_');
  const periodo = getActivePeriodLabel().replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(wb, `Metrik_${nomeArq}_${periodo}.xlsx`);
  showToast(`✅ Excel exportado com ${records.length} registros em 3 abas.`);
}

// ═══════════════════════════════════════
//  DENTISTAS / VENDEDORES
// ═══════════════════════════════════════
function renderDentistas(M) {
  const vLabel = CFG.vendedor || 'Vendedor';
  document.getElementById('dentFilterBtns').innerHTML =
    `<button class="dfilter-btn active" onclick="setDentFilter('all',this)">Todas</button>` +
    M.dentistas.map(d => `<button class="dfilter-btn" onclick="setDentFilter('${d.nome}',this)">${d.nome}</button>`).join('');
  activeDentFilter = 'all';
  renderDentDetail(M);
  renderDentTable(M);
}

function setDentFilter(nome, btn) {
  activeDentFilter = nome;
  document.querySelectorAll('#dentFilterBtns .dfilter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDentDetail(getActiveData());
}

function renderDentDetail(M) {
  const view = document.getElementById('dentDetailView');
  if (activeDentFilter === 'all') { view.innerHTML = ''; return; }
  const d = M.dentistas.find(x => x.nome === activeDentFilter);
  if (!d) { view.innerHTML = ''; return; }
  const sc = taxaColor(d.taxa);
  const vLabel = CFG.vendedor || 'Vendedor';
  const cLabel = CFG.cliente || 'Cliente';
  view.innerHTML = `
    <div class="dent-detail">
      <div class="dent-detail-header">
        <div class="dent-avatar" style="background:${dentColor(d.nome)}">${dentInitials(d.nome)}</div>
        <div>
          <div class="dent-name-big">${d.nome}</div>
          <div style="color:var(--muted);font-size:13px;margin-top:4px">
            Melhor canal: <strong>${canalDisplay(d.melhor_canal)}</strong> (${d.captacao_taxa.toFixed(0)}%)
          </div>
        </div>
      </div>
      <div class="dent-kpis">
        <div class="dent-kpi"><div class="kpi-lbl">Conversão</div><div class="kpi-val" style="color:${sc}">${d.taxa}%</div></div>
        <div class="dent-kpi"><div class="kpi-lbl">Faturado</div><div class="kpi-val" style="color:var(--green)">${fmtK(d.valor_aprovado)}</div></div>
        <div class="dent-kpi"><div class="kpi-lbl">Ticket Médio</div><div class="kpi-val">${fmtK(d.ticket_medio)}</div></div>
        <div class="dent-kpi"><div class="kpi-lbl">Tempo p/ Fechar</div><div class="kpi-val" style="color:${d.tempo_medio > 5 ? 'var(--yellow)' : 'var(--text)'}">${d.tempo_medio}d</div></div>
        <div class="dent-kpi"><div class="kpi-lbl">Receita Perdida</div><div class="kpi-val" style="color:var(--red)">${fmtK(d.valor_perdido)}</div></div>
        <div class="dent-kpi"><div class="kpi-lbl">Cancelamentos</div><div class="kpi-val" style="color:var(--orange)">${d.cancelados}</div></div>
      </div>
      <div style="font-size:12px;color:var(--muted2);margin-top:8px">
        <strong style="color:var(--text)">Canais:</strong>
        ${Object.entries(d.canais).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `<span style="margin-left:10px">${canalDisplay(c)}: <strong>${n}</strong></span>`).join('')}
      </div>
    </div>`;
}

function sortDent(type, btn) {
  dentSort = type;
  document.querySelectorAll('#sortBar .dfilter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDentTable(getActiveData());
}

// ── selo do dentista: iniciais + cor estável (mesma na tabela e no detalhe) ──
const DENT_PAL = ['#5B8DEF', '#7c5cf0', '#46C08A', '#D7A33F', '#E2705C', '#38BDF8', '#F472B6', '#e0915a'];
function dentInitials(nome) {
  const w = (nome || '').replace(/\b(dra?\.?|dr\.?)\b/gi, '').trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase();
}
function dentColor(nome) {
  let h = 0; for (let i = 0; i < (nome || '').length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return DENT_PAL[h % DENT_PAL.length];
}

function renderDentTable(M) {
  const vLabel = CFG.vendedor || 'Vendedor';
  const sorted = [...M.dentistas].sort((a, b) => {
    if (dentSort === 'taxa') return b.taxa - a.taxa;
    if (dentSort === 'valor') return b.valor_aprovado - a.valor_aprovado;
    if (dentSort === 'ticket') return b.ticket_medio - a.ticket_medio;
    if (dentSort === 'tempo') return a.tempo_medio - b.tempo_medio;
    if (dentSort === 'perdido') return b.valor_perdido - a.valor_perdido;
    if (dentSort === 'cancelados') return b.cancelados - a.cancelados;
    return 0;
  });
  document.getElementById('dentBody').innerHTML = sorted.map((d, i) => `
    <tr class="expandable" onclick="toggleDetail(this,'${d.nome.replace(/'/g, "\\'")}')">
      <td class="rk">${String(i + 1).padStart(2, '0')}</td>
      <td><div class="who"><div class="av" style="background:${dentColor(d.nome)}">${dentInitials(d.nome)}</div><div><b>${d.nome}</b><span>${d.taxa}% conv · ${canalDisplay(d.melhor_canal)}</span></div></div></td>
      <td class="r">${d.total}</td>
      <td class="r"><span class="conv-cell">${d.taxa}%<span class="mini"><i style="width:${Math.min(d.taxa, 100)}%;background:${taxaColor(d.taxa)}"></i></span></span></td>
      <td><span class="chip">${canalDisplay(d.melhor_canal)}</span></td>
      <td class="r" style="font-weight:600;color:var(--green)">${fmtK(d.valor_aprovado)}</td>
      <td class="r">${fmtK(d.ticket_medio)}</td>
      <td class="r" style="color:${d.tempo_medio > 5 ? 'var(--yellow)' : 'var(--muted)'}">${d.tempo_medio}d</td>
      <td class="r" style="color:var(--orange)">${d.cancelados}</td>
      <td class="r" style="color:var(--red)">${fmtK(d.valor_perdido)}</td>
    </tr>
    <tr class="detail-row"><td colspan="10">
      <div class="detail-inner" id="detail-${d.nome.replace(/\s/g, '_')}">
        <strong>Canais:</strong> ${Object.entries(d.canais).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${canalDisplay(c)}: ${n}`).join(' · ')}<br>
        <strong>Aprovados:</strong> ${d.aprovados} · <strong>Vencidos:</strong> ${d.vencidos} · <strong>Cancelados:</strong> ${d.cancelados}<br>
        <strong>Receita perdida:</strong> ${fmtK(d.valor_perdido)} · <strong>Cancelado:</strong> ${fmtK(d.valor_cancelado || 0)}
      </div>
    </td></tr>`
  ).join('');
}

function toggleDetail(row, nome) {
  const el = document.getElementById('detail-' + nome.replace(/\s/g, '_'));
  if (el) el.classList.toggle('open');
}

// ═══════════════════════════════════════
//  CANAIS TAB
// ═══════════════════════════════════════
function renderCanais(M) {
  const vLabel = CFG.vendedor || 'Vendedor';
  const sorted = [...M.canais].sort((a, b) => b.valor - a.valor);
  const PALETTE = ['#5b8def', '#46c08a', '#d7a33f', '#e2705c', '#7c5cf0', '#e0915a', '#38BDF8', '#F472B6', '#4ADE80', '#FCD34D'];
  if (_canalDonutChart) { _canalDonutChart.destroy(); _canalDonutChart = null; }
  const canvas = document.getElementById('canalDonutChart');
  if (canvas && sorted.length > 0) {
    _canalDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: sorted.map(c => canalDisplay(c.canal)),
        datasets: [{
          data: sorted.map(c => c.valor),
          backgroundColor: sorted.map((_, i) => PALETTE[i % PALETTE.length] + 'CC'),
          borderColor: sorted.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 2, hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, cutout: '65%',
        plugins: {
          legend: { position: 'right', labels: { color: themeC('--muted2'), font: { size: 11 }, padding: 14, usePointStyle: true, pointStyleWidth: 10 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const p = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
                return ` ${fmtK(ctx.raw)} (${p}%)`;
              }
            }
          }
        }
      }
    });
  }
  const totalReceita = sorted.reduce((s, c) => s + c.valor, 0);
  const legendEl = document.getElementById('canalDonutLegend');
  if (legendEl) {
    legendEl.innerHTML = sorted.map((c, i) => {
      const p = totalReceita > 0 ? (c.valor / totalReceita * 100).toFixed(1) : 0;
      const cor = PALETTE[i % PALETTE.length];
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:12px;height:12px;border-radius:50%;background:${cor};flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${canalDisplay(c.canal)}</div>
          <div style="font-size:11px;color:var(--muted)">${fmtK(c.valor)} · ${p}% · Conv. ${c.taxa}%</div>
        </div>
      </div>`;
    }).join('');
  }
  const maxConv = Math.max(...sorted.map(c => c.taxa), 1);
  const convEl = document.getElementById('canalConvBars');
  if (convEl) {
    convEl.innerHTML = sorted.map(c => `
      <div class="bar-item">
        <div class="bar-lbl"><span>${canalDisplay(c.canal)}</span><span>${c.taxa}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${(c.taxa / maxConv * 100).toFixed(1)}%;background:${taxaColor(c.taxa)}"></div></div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${c.aprovados} aprovados de ${c.total}</div>
      </div>`
    ).join('');
  }
  const maxVal = Math.max(...sorted.map(c => c.valor), 1);
  const fatEl = document.getElementById('canalFatBars');
  if (fatEl) {
    fatEl.innerHTML = sorted.map((c, i) => `
      <div class="bar-item">
        <div class="bar-lbl"><span>${canalDisplay(c.canal)}</span><span style="color:var(--green)">${fmtK(c.valor)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${(c.valor / maxVal * 100).toFixed(1)}%;background:${PALETTE[i % PALETTE.length]}"></div></div>
      </div>`
    ).join('');
  }
  const tblEl = document.getElementById('canalTable');
  if (tblEl) {
    tblEl.innerHTML = `
      <thead>
        <tr>
          <th>Canal</th><th>Total</th><th>Aprovados</th>
          <th>Conversão</th><th>Receita</th><th>Ticket Médio</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(c => `
          <tr>
            <td><strong>${canalDisplay(c.canal)}</strong></td>
            <td>${c.total}</td>
            <td>${c.aprovados}</td>
            <td>${taxaBadge(c.taxa)}</td>
            <td style="color:var(--green)">${fmtK(c.valor)}</td>
            <td>${fmtK(c.ticket)}</td>
          </tr>`).join('')}
      </tbody>`;
  }
  const dentTableEl = document.getElementById('canalDentTable');
  if (dentTableEl && M.dentistas.length > 0) {
    const todosCanais = [...new Set(M.canais.map(c => c.canal))];
    dentTableEl.innerHTML = `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>${vLabel}</th>
              ${todosCanais.map(c => `<th>${canalDisplay(c)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${M.dentistas.map(d => `
              <tr>
                <td><strong>${d.nome}</strong></td>
                ${todosCanais.map(c => `<td style="text-align:center">${d.canais[c] || '—'}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

// ═══════════════════════════════════════
//  RECUPERAR / VENCIDOS
// ═══════════════════════════════════════
function renderRecuperar(M) {
  const cLabel = CFG.cliente || 'Cliente';
  document.getElementById('vencList').innerHTML = M.topVencidos.map(v => {
    const dias = diasParado(v.emissao);
    return `<div class="vrow">
      <div>
        <div class="vnom">${v.paciente || '—'}</div>
        <div class="vmeta">📣 ${canalDisplay(v.campanha || '')}${v.emissao ? ' · 📅 ' + v.emissao.toLocaleDateString('pt-BR') : ''}</div>
        <div>${diasBadge(dias)}</div>
        <div class="vtel">${v.telefone ? `<a href="tel:${v.telefone.replace(/\D/g, '')}">📞 ${v.telefone}</a>` : ''}</div>
      </div>
      <div>
        <div class="vval">${fmtK(v.total)}</div>
        <div class="vdent">${v.dentista || '—'}</div>
      </div>
    </div>`;
  }).join('') || `<div style="color:var(--muted);padding:12px 0">Nenhum vencido.</div>`;
}

// ═══════════════════════════════════════
//  CANCELADOS
// ═══════════════════════════════════════
function renderCancelados(M) {
  const vLabel = CFG.vendedor || 'Vendedor';
  const list = document.getElementById('cancList');
  if (list) {
    list.innerHTML = M.cancelados.slice(0, 6).map(r =>
      `<div class="canc-row">
        <div>
          <div class="canc-info">${r.paciente || '—'}</div>
          <div class="canc-meta">${r.dentista || '—'} · ${r.emissao ? r.emissao.toLocaleDateString('pt-BR') : ''}</div>
        </div>
        <div class="canc-val">${fmtK(r.total)}</div>
      </div>`
    ).join('') || '<div style="color:var(--muted);font-size:13px;padding:12px 0">Nenhum cancelamento.</div>';
  }
  const byDent = document.getElementById('cancByDent');
  if (byDent && M.cancByDent.length > 0) {
    const maxC = Math.max(...M.cancByDent.map(d => d.count), 1);
    byDent.innerHTML = [...M.cancByDent].sort((a, b) => b.count - a.count).map(d =>
      `<div class="bar-item">
        <div class="bar-lbl"><span>${d.nome}</span><span>${d.count} · ${fmtK(d.valor)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${(d.count / maxC * 100).toFixed(1)}%;background:var(--orange)"></div></div>
      </div>`
    ).join('');
  } else if (byDent) {
    byDent.innerHTML = `<div style="color:var(--muted);font-size:13px">Nenhum cancelamento.</div>`;
  }
}

// ═══════════════════════════════════════
//  TREND CHART
// ═══════════════════════════════════════
function renderTrendChart() {
  if (_trendChartInst) { _trendChartInst.destroy(); _trendChartInst = null; }
  const canvas = document.getElementById('trendChart');
  if (!canvas || MONTHS.length < 2) return;
  _trendChartInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels: MONTHS.map(m => m.periodo),
      datasets: [
        { label: 'Conversão (%)', data: MONTHS.map(m => m.geral.taxa), borderColor: '#5B8DEF', backgroundColor: 'rgba(91,141,239,.10)', borderWidth: 2.4, pointBackgroundColor: '#5B8DEF', pointBorderColor: '#10131A', pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .4, fill: true, yAxisID: 'yConv' },
        { label: 'Receita (R$k)', data: MONTHS.map(m => +(m.geral.aprovado / 1000).toFixed(1)), borderColor: '#46C08A', backgroundColor: 'rgba(70,192,138,.08)', borderWidth: 2.2, pointBackgroundColor: '#46C08A', pointBorderColor: '#10131A', pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .4, fill: true, yAxisID: 'yRec' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: themeC('--muted2'), font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ctx.datasetIndex === 0 ? ` Conversão: ${ctx.raw}%` : ` Receita: R$${ctx.raw}k` } }
      },
      scales: {
        x: { ticks: { color: themeC('--muted'), font: { size: 10 } }, grid: { color: themeC('--chart-grid') } },
        yConv: { position: 'left', ticks: { color: '#5B8DEF', font: { size: 10 }, callback: v => v + '%' }, grid: { color: themeC('--chart-grid') }, title: { display: true, text: 'Conversão', color: '#5B8DEF', font: { size: 10 } } },
        yRec: { position: 'right', ticks: { color: '#46C08A', font: { size: 10 }, callback: v => 'R$' + v + 'k' }, grid: { display: false }, title: { display: true, text: 'Receita', color: '#46C08A', font: { size: 10 } } }
      }
    }
  });
}

// ═══════════════════════════════════════
//  EVOLUÇÃO VENDEDORES
// ═══════════════════════════════════════
function setVendedorMetric(metric, btn) {
  _vendedorMetric = metric;
  document.querySelectorAll('#tab-vendedores .dfilter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGraficoVendedores();
}
function selecionarTodosVendedores() {
  const meses = [...MONTHS].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
  const todos = [...new Set(meses.flatMap(m => m.dentistas.map(d => d.nome)))].sort();
  _vendedoresSelecionados = new Set(todos);
  renderSeletorVendedores();
  renderGraficoVendedores();
}
function limparVendedores() {
  _vendedoresSelecionados.clear();
  renderSeletorVendedores();
  renderGraficoVendedores();
}
function toggleVendedorSelecionado(nome) {
  if (_vendedoresSelecionados.has(nome)) _vendedoresSelecionados.delete(nome);
  else _vendedoresSelecionados.add(nome);
  renderSeletorVendedores();
  renderGraficoVendedores();
}
function renderSeletorVendedores() {
  const meses = [...MONTHS].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
  const todos = [...new Set(meses.flatMap(m => m.dentistas.map(d => d.nome)))].sort();
  const PALETTE = ['#5b8def', '#46c08a', '#d7a33f', '#e2705c', '#7c5cf0', '#e0915a', '#38BDF8', '#F472B6'];
  const el = document.getElementById('vendedorSeletorBtns');
  if (!el) return;
  el.innerHTML = todos.map((nome, i) => {
    const cor = PALETTE[i % PALETTE.length];
    const ativo = _vendedoresSelecionados.has(nome);
    return `<button
      onclick="toggleVendedorSelecionado('${nome.replace(/'/g, "\\'")}')"
      style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;
        border:1px solid ${ativo ? cor : 'var(--border)'};
        background:${ativo ? cor + '22' : 'var(--surface2)'};
        color:${ativo ? cor : 'var(--muted)'};
        font-size:12px;font-weight:600;transition:.15s;text-align:left;width:100%;">
      <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0;opacity:${ativo ? 1 : .4}"></div>
      ${nome}
    </button>`;
  }).join('');
}
function renderVendedores() {
  if (!MONTHS || MONTHS.length === 0) return;
  const meses = [...MONTHS].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
  const todos = [...new Set(meses.flatMap(m => m.dentistas.map(d => d.nome)))].sort();
  if (_vendedoresSelecionados.size === 0) {
    todos.slice(0, 3).forEach(n => _vendedoresSelecionados.add(n));
  }
  renderSeletorVendedores();
  renderGraficoVendedores();
  renderRankingVendedores(meses, todos);
}
function renderGraficoVendedores() {
  if (!MONTHS || MONTHS.length === 0) return;
  const meses = [...MONTHS].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
  const todos = [...new Set(meses.flatMap(m => m.dentistas.map(d => d.nome)))].sort();
  const PALETTE = ['#5b8def', '#46c08a', '#d7a33f', '#e2705c', '#7c5cf0', '#e0915a', '#38BDF8', '#F472B6'];
  const cfgs = {
    conversao: { getValue: d => d && d.total > 0 ? +(d.taxa || 0) : null, fmt: v => v + '%' },
    faturamento: { getValue: d => d && d.total > 0 ? +(d.valor_aprovado || 0) : null, fmt: v => fmtK(v) },
    ticket: { getValue: d => d && d.total > 0 ? +(d.ticket_medio || 0) : null, fmt: v => fmtK(v) },
    pacientes: { getValue: d => d && d.total > 0 ? +(d.aprovados || 0) : null, fmt: v => String(Math.round(v)) },
  };
  const cfg = cfgs[_vendedorMetric] || cfgs.conversao;
  const selecionados = todos.filter(n => _vendedoresSelecionados.has(n));
  if (_vendedorTrendChart) { _vendedorTrendChart.destroy(); _vendedorTrendChart = null; }
  const canvas = document.getElementById('vendedorTrendChart');
  if (!canvas) return;
  const msgAnt = canvas.parentElement?.querySelector('.vend-empty-msg');
  if (msgAnt) msgAnt.remove();
  if (selecionados.length === 0) {
    const wrap = canvas.parentElement;
    if (wrap) {
      const d = document.createElement('div');
      d.className = 'vend-empty-msg';
      d.style.cssText = 'color:var(--muted);font-size:13px;text-align:center;padding:60px 0;';
      d.textContent = 'Selecione ao menos um vendedor à esquerda para ver o gráfico.';
      wrap.appendChild(d);
    }
    return;
  }
  const datasets = selecionados.map(nome => {
    const i = todos.indexOf(nome);
    const cor = PALETTE[i % PALETTE.length];
    return {
      label: nome,
      data: meses.map(m => {
        const d = m.dentistas.find(x => x.nome === nome);
        return cfg.getValue(d);
      }),
      borderColor: cor, backgroundColor: cor + '33', borderWidth: 2.5,
      pointRadius: 5, pointHoverRadius: 8, pointBackgroundColor: cor,
      tension: .35, fill: false, spanGaps: false,
    };
  });
  _vendedorTrendChart = new Chart(canvas, {
    type: 'line',
    data: { labels: meses.map(m => m.periodo), datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: themeC('--muted2'), font: { size: 11 }, usePointStyle: true, pointStyleWidth: 10, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.raw === null) return ` ${ctx.dataset.label}: sem dados neste mês`;
              return ` ${ctx.dataset.label}: ${cfg.fmt(ctx.raw)}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: themeC('--muted'), font: { size: 10 } }, grid: { color: themeC('--chart-grid') } },
        y: { ticks: { color: themeC('--muted'), font: { size: 10 }, callback: v => cfg.fmt(v) }, grid: { color: themeC('--chart-grid2') }, beginAtZero: true }
      }
    }
  });
}
function renderRankingVendedores(meses, todos) {
  const vLabel = CFG.vendedor || 'Vendedor';
  const PALETTE = ['#5b8def', '#46c08a', '#d7a33f', '#e2705c', '#7c5cf0', '#e0915a', '#38BDF8', '#F472B6'];
  const cfgs = {
    conversao: { getValue: d => d && d.total > 0 ? +(d.taxa || 0) : null, fmt: v => v + '%' },
    faturamento: { getValue: d => d && d.total > 0 ? +(d.valor_aprovado || 0) : null, fmt: v => fmtK(v) },
    ticket: { getValue: d => d && d.total > 0 ? +(d.ticket_medio || 0) : null, fmt: v => fmtK(v) },
    pacientes: { getValue: d => d && d.total > 0 ? +(d.aprovados || 0) : null, fmt: v => String(Math.round(v)) },
  };
  const cfg = cfgs[_vendedorMetric] || cfgs.conversao;
  const rankingData = todos.map(nome => {
    const aparicoes = meses.filter(m => m.dentistas.find(d => d.nome === nome && d.total > 0));
    const totalFat = aparicoes.reduce((s, m) => { const d = m.dentistas.find(x => x.nome === nome); return s + (d ? d.valor_aprovado : 0); }, 0);
    const totalAprov = aparicoes.reduce((s, m) => { const d = m.dentistas.find(x => x.nome === nome); return s + (d ? d.aprovados : 0); }, 0);
    const totalOrcs = aparicoes.reduce((s, m) => { const d = m.dentistas.find(x => x.nome === nome); return s + (d ? d.total : 0); }, 0);
    const mediaConv = totalOrcs > 0 ? +(totalAprov / totalOrcs * 100).toFixed(1) : 0;
    const ticketMedio = totalAprov > 0 ? +(totalFat / totalAprov) : 0;
    const melhorMes = aparicoes.reduce((best, m) => {
      const d = m.dentistas.find(x => x.nome === nome);
      if (!d) return best;
      const val = cfg.getValue(d) || 0;
      const bestVal = best.d ? cfg.getValue(best.d) || 0 : 0;
      return val > bestVal ? { m, d } : best;
    }, { m: null, d: null });
    return { nome, totalFat, totalAprov, totalOrcs, mediaConv, ticketMedio, meses: aparicoes.length, melhorMes };
  }).sort((a, b) => b.totalFat - a.totalFat);

  const tbl = document.getElementById('vendedorRankingTable');
  if (tbl) {
    tbl.innerHTML = `
      <thead>
        <tr>
          <th>#</th><th>${vLabel}</th><th>Meses Ativos</th>
          <th>Conv. Média</th><th>Fat. Total</th><th>Ticket Médio</th><th>Melhor Mês</th>
        </tr>
      </thead>
      <tbody>
        ${rankingData.map((r, i) => {
      const cor = PALETTE[todos.indexOf(r.nome) % PALETTE.length];
      return `<tr>
            <td><strong style="color:${cor}">${i + 1}</strong></td>
            <td><div style="display:flex;align-items:center;gap:8px">
              <div style="width:10px;height:10px;border-radius:50%;background:${cor}"></div>
              <strong>${r.nome}</strong>
            </div></td>
            <td>${r.meses} mês${r.meses !== 1 ? 'es' : ''}</td>
            <td>${taxaBadge(r.mediaConv)}</td>
            <td style="color:var(--green)">${fmtK(r.totalFat)}</td>
            <td>${fmtK(r.ticketMedio)}</td>
            <td style="color:var(--muted2);font-size:12px">${r.melhorMes && r.melhorMes.m ? r.melhorMes.m.periodo : '—'}</td>
          </tr>`;
    }).join('')}
      </tbody>`;
  }

  const analise = document.getElementById('vendedorAnalise');
  if (analise) {
    analise.innerHTML = rankingData.map(r => {
      const cor = PALETTE[todos.indexOf(r.nome) % PALETTE.length];
      const ultimos = meses.filter(m => m.dentistas.find(d => d.nome === r.nome && d.total > 0)).slice(-3);
      let tendencia = '';
      if (ultimos.length >= 2) {
        const vals = ultimos.map(m => { const d = m.dentistas.find(x => x.nome === r.nome); return cfg.getValue(d) || 0; });
        const diff = vals[vals.length - 1] - vals[0];
        const p = vals[0] > 0 ? Math.abs((diff / vals[0] * 100)).toFixed(0) : 0;
        if (diff > 0) tendencia = `<span style="color:var(--green)">↑ +${p}% nos últimos ${ultimos.length} meses</span>`;
        else if (diff < 0) tendencia = `<span style="color:var(--red)">↓ -${p}% nos últimos ${ultimos.length} meses</span>`;
        else tendencia = `<span style="color:var(--muted)">→ Estável</span>`;
      }
      return `
        <div style="background:var(--surface2);border:1px solid var(--border2);border-left:4px solid ${cor};border-radius:10px;padding:14px 18px;margin-bottom:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <div style="font-weight:700;font-size:14px;color:var(--text)">${r.nome}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${r.meses} meses ativos · ${r.totalOrcs} orçamentos</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:13px;font-weight:600;color:var(--green)">${fmtK(r.totalFat)}</div>
              <div style="font-size:11px;color:var(--muted)">${r.mediaConv}% conversão média</div>
            </div>
          </div>
          ${tendencia ? `<div style="margin-top:10px;font-size:12px">${tendencia}</div>` : ''}
        </div>`;
    }).join('') || `<div style="color:var(--muted)">Nenhum dado.</div>`;
  }
}

// ═══════════════════════════════════════
//  COMPARATIVO
// ═══════════════════════════════════════
function renderComparativo() { renderCmpSelector(); renderCmpContent(); }

function renderCmpSelector() {
  const anos = Object.keys(YEARS).map(Number).sort((a, b) => a - b);
  let html = '<div style="font-size:11px;color:var(--muted2);margin-bottom:8px;font-weight:600;letter-spacing:.5px">SELECIONAR PERÍODOS:</div>';
  anos.forEach(ano => {
    const y = YEARS[ano], miy = y.monthIndices.map(i => MONTHS[i]);
    const ySel = cmpItems.some(c => c.type === 'year' && c.idx === String(ano));
    html += `<div class="period-group"><button class="year-chip ${ySel ? 'active' : ''}" onclick="toggleCmpItem('year','${ano}')">${ano}${miy.length > 1 ? `<span class="year-arrow" onclick="event.stopPropagation();openCmpPortal(this,'${ano}')">▾</span>` : ''}</button></div>`;
  });
  document.getElementById('cmpMonthTabs').innerHTML = html;
}

function openCmpPortal(arrowEl, ano) {
  const portalId = 'cyd-' + ano;
  if (_portalTarget === portalId) { closePortalDropdown(); return; }
  _portalTarget = portalId;
  const y = YEARS[ano]; if (!y) return;
  const miy = y.monthIndices.map(i => MONTHS[i]);
  const portal = document.getElementById('dropPortal');
  portal.innerHTML = miy.map(m => {
    const mi = MONTHS.indexOf(m);
    const mSel = cmpItems.some(c => c.type === 'month' && c.idx === mi);
    return `<button class="ydrop-item ${mSel ? 'active' : ''}" onclick="toggleCmpItem('month',${mi});closePortalDropdown()">${MONTHS_PT[m.mes]}</button>`;
  }).join('');
  const rect = arrowEl.getBoundingClientRect();
  portal.style.display = 'flex';
  portal.style.top = (rect.bottom + window.scrollY + 6) + 'px';
  portal.style.left = (rect.left + window.scrollX - 100) + 'px';
}

function toggleCmpItem(type, idx) {
  const existing = cmpItems.findIndex(c => c.type === type && String(c.idx) === String(idx));
  if (existing >= 0) { if (cmpItems.length > 1) cmpItems.splice(existing, 1); }
  else cmpItems.push({ type, idx: type === 'month' ? +idx : String(idx) });
  saveLocalState(); renderComparativo();
}

function getCmpData(item) {
  if (item.type === 'year') {
    return YEARS[item.idx] && YEARS[item.idx].data;
  }
  return MONTHS[item.idx];
}
function getCmpLabel(item) { return item.type === 'year' ? String(item.idx) : MONTHS[item.idx].periodo; }

// ═══════════════════════════════════════
//  COMPARATIVO — FUNÇÕES AUXILIARES
// ═══════════════════════════════════════
function getPeriodosJustosComparativo(ano1, ano2) {
  const meses1 = MONTHS.filter(m => m.ano === ano1).map(m => m.key).sort();
  const meses2 = MONTHS.filter(m => m.ano === ano2).map(m => m.key).sort();
  if (!meses1.length || !meses2.length) return null;
  const ultimoMes1 = parseInt(meses1[meses1.length - 1].split('-')[1]);
  const ultimoMes2 = parseInt(meses2[meses2.length - 1].split('-')[1]);
  const corte = Math.min(ultimoMes1, ultimoMes2);
  const precisaCorte = ultimoMes1 !== ultimoMes2;
  const meses1Cortados = meses1.filter(k => parseInt(k.split('-')[1]) <= corte);
  const meses2Cortados = meses2.filter(k => parseInt(k.split('-')[1]) <= corte);
  return {
    corte, precisaCorte,
    meses1: meses1Cortados, meses2: meses2Cortados,
    labelCorte: MONTHS_PT[corte - 1], ano1, ano2
  };
}

function computeMesesAgregados(chavesMeses, labelPeriodo) {
  const mesesData = chavesMeses.map(k => MONTHS.find(m => m.key === k)).filter(Boolean);
  if (!mesesData.length) return null;
  const allRecords = mesesData.flatMap(m => (parsedMonths[m.key] && parsedMonths[m.key].records) || []);
  if (!allRecords.length) return null;
  const data = computeMonth({
    records: allRecords,
    periodo: labelPeriodo,
    mes: null,
    ano: mesesData[0].ano,
    key: 'range-' + chavesMeses.join('-')
  });
  data.periodo = labelPeriodo;
  data.isRange = true;
  return data;
}

function renderCmpContent() {
  const vLabel = CFG.vendedor || 'Vendedor';
  const vLabelP = pluralizar(vLabel);

  if (cmpItems.length < 2) {
    document.getElementById('cmpContent').innerHTML =
      '<div style="color:var(--muted);text-align:center;padding:40px">Selecione pelo menos 2 períodos para comparar.</div>';
    return;
  }

  const anosInteiros = cmpItems.filter(c => c.type === 'year').map(c => +c.idx);
  let periodoJusto = null;
  let avisoCorteHtml = '';

  if (anosInteiros.length >= 2) {
    const ano1 = Math.min(...anosInteiros);
    const ano2 = Math.max(...anosInteiros);
    periodoJusto = getPeriodosJustosComparativo(ano1, ano2);
    if (periodoJusto && periodoJusto.precisaCorte) {
      avisoCorteHtml = `
        <div style="background:color-mix(in srgb,var(--yellow) 8%,transparent);border:1px solid color-mix(in srgb,var(--yellow) 25%,transparent);
          border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;
          color:var(--yellow);display:flex;align-items:center;gap:10px">
          <span style="font-size:16px">⚠️</span>
          <span>Comparação justa ativada: exibindo
          <strong>${ano1} Jan→${periodoJusto.labelCorte}</strong>
          vs <strong>${ano2} Jan→${periodoJusto.labelCorte}</strong>
          (${ano2} tem dados até ${periodoJusto.labelCorte}).</span>
        </div>`;
    }
  }

  let pairs;
  if (periodoJusto && periodoJusto.precisaCorte) {
    const ano1 = Math.min(...anosInteiros);
    const ano2 = Math.max(...anosInteiros);
    pairs = cmpItems.map(item => {
      if (item.type === 'year') {
        const ano = +item.idx;
        const chaves = ano === ano1 ? periodoJusto.meses1 : periodoJusto.meses2;
        const label = `${ano} Jan→${periodoJusto.labelCorte}`;
        const data = computeMesesAgregados(chaves, label);
        return { data, label };
      }
      return { data: getCmpData(item), label: getCmpLabel(item) };
    }).filter(p => p.data);
  } else {
    pairs = cmpItems.map(item => ({
      data: getCmpData(item),
      label: getCmpLabel(item),
      fonte: (() => {
        if (item.type === 'year') {
          const ano = item.idx;
          const chaves = getMesesFinanceirosPorAno(+ano);
          const temFat = chaves.some(k => parsedFaturamento[k] !== undefined);
          const temOrc = chaves.some(k => MONTHS.find(m => m.key === k));
          return temFat ? 'faturamento' : temOrc ? 'aprovados' : null;
        } else {
          const m = MONTHS[item.idx];
          if (!m) return null;
          const temFat = parsedFaturamento[m.key] !== undefined;
          return temFat ? 'faturamento' : 'aprovados';
        }
      })()
    })).filter(p => p.data);
  }

  if (pairs.length < 2) {
    document.getElementById('cmpContent').innerHTML =
      '<div style="color:var(--muted);text-align:center;padding:40px">Dados insuficientes.</div>';
    return;
  }

  // detecta fontes mistas entre os períodos comparados
  const fontesCmp = pairs.map(p => p.fonte).filter(Boolean);
  const fontesMistasCmp = [...new Set(fontesCmp)].length > 1;
  const avisoFontesCmpHtml = fontesMistasCmp ? `
    <div style="background:color-mix(in srgb,var(--yellow) 8%,transparent);border:1px solid color-mix(in srgb,var(--yellow) 30%,transparent);
      border-radius:10px;padding:12px 16px;margin-bottom:16px;
      display:flex;align-items:flex-start;gap:10px">
      <span style="font-size:18px">⚠️</span>
      <div style="font-size:12px;color:var(--yellow);line-height:1.6">
        <strong>Atenção: fontes de dados diferentes entre os períodos comparados.</strong><br>
        ${pairs.map(p => `<strong>${p.label}</strong>: ${p.fonte === 'faturamento' ? 'faturamento real (caixa)' : 'orçamentos aprovados'}`).join(' · ')}<br>
        A comparação pode não ser precisa pois as fontes são distintas.
      </div>
    </div>` : '';

  const selected = pairs.map(p => p.data);
  const labels = pairs.map(p => p.label);
  const last = selected[selected.length - 1];
  const first_ = selected[0];

  document.getElementById('cmpContent').innerHTML = `
    ${avisoFontesCmpHtml}
    ${avisoCorteHtml}
    <div class="fu d1">
      <div class="sec">KPIs Comparativos</div>
      <div class="kpi-grid" id="cmpKpis"></div>
    </div>
    <div class="grid-2 fu d2">
      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--accent)"></span>Evolução da Receita</div>
        <div id="cmpRecBars"></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--green)"></span>Evolução da Conversão</div>
        <div id="cmpConvBars"></div>
      </div>
    </div>
    <div class="card full fu d3">
      <div class="card-title"><span class="dot" style="background:var(--accent2)"></span>${vLabelP} — Comparativo</div>
      <div class="dent-chart-tabs" id="dentChartTabs">
        <button class="dfilter-btn active" onclick="setDentChartMetric('faturamento',this)">Faturamento</button>
        <button class="dfilter-btn" onclick="setDentChartMetric('ticket',this)">Ticket</button>
        <button class="dfilter-btn" onclick="setDentChartMetric('conversao',this)">Conversão</button>
        <button class="dfilter-btn" onclick="setDentChartMetric('pacientes',this)">${pluralizar(CFG.cliente || 'Cliente')} Fechados</button>
      </div>
      <div id="dentChartWrap" style="overflow-x:auto;height:340px"><canvas id="dentCmpChart"></canvas></div>
      <div class="tbl-wrap" style="margin-top:18px"><table class="cmp-table" id="cmpDentTable"></table></div>
    </div>
    <div class="card full fu d4">
      <div class="card-title"><span class="dot" style="background:var(--yellow)"></span>Canais — Comparativo</div>
      <div class="tbl-wrap"><table class="cmp-table" id="cmpCanalTable"></table></div>
    </div>
    <div class="fu d5">
      <div class="sec">Alertas Comparativos</div>
      <div style="background:color-mix(in srgb,var(--accent2) 5%,transparent);border:1px solid color-mix(in srgb,var(--accent2) 15%,transparent);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--accent2)">
        📈 Comparando ${selected.length} períodos.
      </div>
      <div class="cmp-ins-grid" id="cmpInsGrid"></div>
    </div>`;

  const kpis = [
    { l: 'Receita', vals: selected.map(m => fmtK(m.geral.aprovado)), d: arrowCmp(last.geral.aprovado, first_.geral.aprovado) },
    { l: 'Conversão', vals: selected.map(m => m.geral.taxa + '%'), d: arrowCmp(last.geral.taxa, first_.geral.taxa) },
    { l: 'Ticket Médio', vals: selected.map(m => fmtK(m.geral.aprovados > 0 ? m.geral.aprovado / m.geral.aprovados : 0)), d: '' },
    { l: 'Receita Perdida', vals: selected.map(m => fmtK(m.geral.perdido)), d: arrowCmp(last.geral.perdido, first_.geral.perdido, false) },
    { l: 'Score', vals: selected.map(m => m.score + '/100'), d: arrowCmp(last.score, first_.score) },
    { l: 'Cancelamentos', vals: selected.map(m => String(m.geral.cancelados)), d: arrowCmp(last.geral.cancelados, first_.geral.cancelados, false) },
  ];

  document.getElementById('cmpKpis').innerHTML = kpis.map(k =>
    `<div class="kpi">
      <div class="kpi-lbl">${k.l}</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">
        ${selected.map((m, i) => `
          <div style="font-size:12px;color:var(--muted2)">
            <span style="font-size:10px;color:var(--muted)">${labels[i]}:</span>
            <strong style="color:var(--text)">${k.vals[i]}</strong>
          </div>`).join('')}
      </div>
      ${k.d ? `<div class="kpi-delta" style="margin-top:8px">${k.d} vs ${labels[0]}</div>` : ''}
    </div>`
  ).join('');

  const maxRec = Math.max(...selected.map(m => m.geral.aprovado), 1);
  const maxConv = Math.max(...selected.map(m => m.geral.taxa), 1);

  document.getElementById('cmpRecBars').innerHTML = selected.map((m, i) =>
    `<div class="bar-item">
      <div class="bar-lbl"><span>${labels[i]}</span><span>${fmtK(m.geral.aprovado)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(m.geral.aprovado / maxRec * 100).toFixed(1)}%;background:var(--accent)"></div></div>
    </div>`
  ).join('');

  document.getElementById('cmpConvBars').innerHTML = selected.map((m, i) =>
    `<div class="bar-item">
      <div class="bar-lbl"><span>${labels[i]}</span><span>${m.geral.taxa}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(m.geral.taxa / maxConv * 100).toFixed(1)}%;background:${taxaColor(m.geral.taxa)}"></div></div>
    </div>`
  ).join('');

  const allDents = [...new Set(selected.flatMap(m => m.dentistas.map(d => d.nome)))];
  document.getElementById('cmpDentTable').innerHTML = `
    <thead>
      <tr>
        <th>${vLabel}</th>
        ${selected.map((m, i) => `<th colspan="3" style="text-align:center;color:var(--accent)">${labels[i]}</th>`).join('')}
      </tr>
      <tr><th></th>${selected.map(() => '<th>Conv.</th><th>Faturado</th><th>Ticket</th>').join('')}</tr>
    </thead>
    <tbody>
      ${allDents.map(nome => `
        <tr>
          <td><strong>${nome}</strong></td>
          ${selected.map(m => {
    const d = m.dentistas.find(x => x.nome === nome);
    return d
      ? `<td>${taxaBadge(d.taxa)}</td><td style="color:var(--green)">${fmtK(d.valor_aprovado)}</td><td>${fmtK(d.ticket_medio)}</td>`
      : '<td colspan="3" style="color:var(--muted);text-align:center">—</td>';
  }).join('')}
        </tr>`).join('')}
    </tbody>`;

  const allCanais = [...new Set(selected.flatMap(m => m.canais.map(c => c.canal)))];
  document.getElementById('cmpCanalTable').innerHTML = `
    <thead>
      <tr>
        <th>Canal</th>
        ${selected.map((m, i) => `<th>Conv. ${labels[i]}</th><th>Receita ${labels[i]}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${allCanais.map(canal => `
        <tr>
          <td><strong>${canalDisplay(canal)}</strong></td>
          ${selected.map(m => {
    const c = m.canais.find(x => x.canal === canal);
    return c ? `<td>${c.taxa}%</td><td style="color:var(--green)">${fmtK(c.valor)}</td>` : '<td>—</td><td>—</td>';
  }).join('')}
        </tr>`).join('')}
    </tbody>`;

  _dentChartData = { selected, labels, allDents };
  renderDentChart();

  const cmpIns = generateCmpInsights(selected);
  cmpIns.sort((a, b) =>
    ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[a.t] || 9) -
    ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[b.t] || 9)
  );
  document.getElementById('cmpInsGrid').innerHTML = cmpIns.length > 0
    ? cmpIns.map(i =>
      `<div class="cmp-ins">
          <div class="ins-ico" style="background:color-mix(in srgb,var(--accent2) 10%,transparent)">📈</div>
          <div>
            <div class="ins-type" style="color:var(--accent2)">${i.l}</div>
            <div class="ins-txt">${i.txt}</div>
            <div class="ins-sub">${i.sub}</div>
          </div>
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px">Nenhum alerta gerado.</div>';
}

const CHART_PALETTE = ['#5b8def', '#46c08a', '#d7a33f', '#e2705c', '#7c5cf0', '#e0915a'];

function setDentChartMetric(metric, btn) {
  document.querySelectorAll('#dentChartTabs .dfilter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _dentChartMetric = metric;
  renderDentChart();
}

function renderDentChart() {
  if (!_dentChartData) return;
  const { selected, labels, allDents } = _dentChartData;
  if (_dentChartInstance) { _dentChartInstance.destroy(); _dentChartInstance = null; }
  const wrap = document.getElementById('dentChartWrap');
  if (!wrap) return;
  wrap.innerHTML = '<canvas id="dentCmpChart" style="height:340px"></canvas>';
  const canvas = document.getElementById('dentCmpChart');
  const cfgs = {
    faturamento: { fmt: v => 'R$' + Math.round(v / 1000) + 'k', getValue: d => d ? +(d.valor_aprovado || 0) : 0 },
    ticket: { fmt: v => 'R$' + Math.round(v / 1000) + 'k', getValue: d => d ? +(d.ticket_medio || 0) : 0 },
    conversao: { fmt: v => v + '%', getValue: d => d ? +(d.taxa || 0) : 0 },
    pacientes: { fmt: v => String(Math.round(v)), getValue: d => d ? +(d.aprovados || 0) : 0 }
  };
  const cfg = cfgs[_dentChartMetric] || cfgs.faturamento;
  const datasets = selected.map((m, pi) => ({
    label: labels[pi],
    data: allDents.map(nome => { const d = m.dentistas.find(x => x.nome === nome); return cfg.getValue(d); }),
    backgroundColor: CHART_PALETTE[pi % CHART_PALETTE.length] + 'BB',
    borderColor: CHART_PALETTE[pi % CHART_PALETTE.length],
    borderWidth: 1.5, borderRadius: 5
  }));
  canvas.style.minWidth = Math.max(allDents.length * (selected.length * 44 + 16) + 60, 400) + 'px';
  canvas.style.width = '100%';
  _dentChartInstance = new Chart(canvas, {
    type: 'bar', data: { labels: allDents, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: {
        legend: { display: selected.length > 1, labels: { color: themeC('--muted2'), font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => labels[ctx.datasetIndex] + ': ' + cfg.fmt(ctx.raw) } }
      },
      scales: {
        x: { ticks: { color: themeC('--muted2'), font: { size: 11 } }, grid: { color: themeC('--chart-grid') } },
        y: { ticks: { color: themeC('--muted'), font: { size: 10 }, callback: v => cfg.fmt(v) }, grid: { color: themeC('--chart-grid2') }, beginAtZero: true }
      }
    }
  });
}

function generateCmpInsights(selected) {
  const vLabel = CFG.vendedor || 'Vendedor';
  const vLabelP = pluralizar(vLabel);
  const ins = []; if (selected.length < 2) return ins;
  const first_ = selected[0], last = selected[selected.length - 1], fg = first_.geral, lg = last.geral;
  const recDiff = lg.aprovado - fg.aprovado, recPct = fg.aprovado > 0 ? (recDiff / fg.aprovado * 100) : 0;
  if (Math.abs(recPct) > 5) {
    const up = recDiff > 0;
    ins.push({ t: up ? 'g' : 'a', l: `Receita ${up ? 'Cresceu' : 'Caiu'} ${Math.abs(recPct).toFixed(1)}%`, txt: `De ${fmtK(fg.aprovado)} para ${fmtK(lg.aprovado)} — ${up ? '+' : ''}${fmtK(recDiff)}.`, sub: up ? 'Tendência positiva.' : 'Queda preocupante — revisar processo.' });
  }
  const convDiff = +(lg.taxa - fg.taxa).toFixed(1);
  if (Math.abs(convDiff) > 2) ins.push({ t: convDiff > 0 ? 'g' : 'a', l: `Conversão ${convDiff > 0 ? 'Melhorou' : 'Caiu'} ${Math.abs(convDiff)} %`, txt: `De ${fg.taxa}% para ${lg.taxa}%.`, sub: convDiff > 0 ? 'Fechamento evoluindo.' : 'Investigar mudanças no processo.' });
  const perdDiff = lg.perdido - fg.perdido, perdPct = fg.perdido > 0 ? ((perdDiff / fg.perdido) * 100) : 0;
  if (Math.abs(perdPct) > 10) ins.push({ t: perdDiff > 0 ? 'a' : 'g', l: `Receita Perdida ${perdDiff > 0 ? 'Aumentou' : 'Reduziu'} ${Math.abs(perdPct).toFixed(0)}%`, txt: `De ${fmtK(fg.perdido)} para ${fmtK(lg.perdido)}.`, sub: perdDiff > 0 ? 'Reforçar follow-up.' : 'Follow-up funcionando.' });
  const ft = fg.aprovados > 0 ? fg.aprovado / fg.aprovados : 0, lt = lg.aprovados > 0 ? lg.aprovado / lg.aprovados : 0, tickPct = ft > 0 ? ((lt - ft) / ft * 100) : 0;
  if (Math.abs(tickPct) > 8) ins.push({ t: tickPct > 0 ? 'g' : 'w', l: `Ticket ${tickPct > 0 ? 'Crescendo' : 'em Queda'}`, txt: `De ${fmtK(ft)} para ${fmtK(lt)} (${tickPct > 0 ? '+' : ''}${tickPct.toFixed(0)}%).`, sub: tickPct < 0 ? 'Revisar política comercial.' : 'Fechando negócios de maior valor.' });
  const scoreDiff = last.score - first_.score;
  if (Math.abs(scoreDiff) >= 5) ins.push({ t: scoreDiff > 0 ? 'g' : 'a', l: `Score ${scoreDiff > 0 ? 'Subiu' : 'Caiu'} ${Math.abs(scoreDiff)} pts`, txt: `De ${first_.score}/100 para ${last.score}/100.`, sub: scoreDiff > 0 ? 'Saúde melhorando.' : 'Analisar KPIs que caíram.' });
  const cancDiff = lg.cancelados - fg.cancelados;
  if (cancDiff >= 3) ins.push({ t: 'a', l: `Cancelamentos +${cancDiff}`, txt: `De ${fg.cancelados} para ${lg.cancelados}.`, sub: `Investigar por ${vLabel.toLowerCase()}.` });
  else if (cancDiff <= -2) ins.push({ t: 'g', l: 'Cancelamentos em Queda', txt: `De ${fg.cancelados} para ${lg.cancelados}.`, sub: 'Retenção melhorando.' });
  const allDents = [...new Set(selected.flatMap(m => m.dentistas.map(d => d.nome)))];
  allDents.forEach(nome => {
    const fd = first_.dentistas.find(d => d.nome === nome), ld = last.dentistas.find(d => d.nome === nome);
    if (!fd || !ld || ld.total < 4) return;
    const td = +(ld.taxa - fd.taxa).toFixed(1);
    if (td <= -15) ins.push({ t: 'a', l: `Queda: ${nome}`, txt: `Conversão de ${fd.taxa}% → ${ld.taxa}% (${td} %).`, sub: 'Acompanhamento necessário.' });
    else if (td >= 15) ins.push({ t: 'g', l: `Melhora: ${nome}`, txt: `Conversão de ${fd.taxa}% → ${ld.taxa}% (+${td} %).`, sub: `Replicar para os ${vLabelP.toLowerCase()}.` });
  });
  if (ins.length === 0) ins.push({ t: 'i', l: 'Desempenho Estável', txt: 'Sem variação significativa.', sub: 'Adicione mais períodos para identificar tendências.' });
  return ins;
}

// ═══════════════════════════════════════
//  FINANCEIRO
// ═══════════════════════════════════════
function setFinView(view, btn) {
  _finView = view;
  document.querySelectorAll('#finPeriodTabs .year-chip').forEach(b => {
    const bView = b.getAttribute('data-view');
    if (bView) b.classList.toggle('active', bView === view);
  });
  renderDespesas();
}

function openFinPortal(arrowEl, ano) {
  const portalId = 'finportal-' + ano;
  if (_portalTarget === portalId) { closePortalDropdown(); return; }
  _portalTarget = portalId;

  const mesesDoAno = getMesesFinanceirosPorAno(+ano);
  const portal = document.getElementById('dropPortal');

  portal.innerHTML = mesesDoAno.map(key => {
    const m = getFinMesData(key);
    const label = m ? MONTHS_PT[m.mes] : key;
    const isActive = _finView === 'month:' + key;
    return `<button class="ydrop-item ${isActive ? 'active' : ''}"
      onclick="setFinView('month:${key}',null);closePortalDropdown()">
      ${label}
    </button>`;
  }).join('');

  const rect = arrowEl.getBoundingClientRect();
  portal.style.display = 'flex';
  portal.style.top = (rect.bottom + window.scrollY + 6) + 'px';
  portal.style.left = (rect.left + window.scrollX - 60) + 'px';
}

function openFinMesesPortal(arrowEl, ano) {
  const portalId = 'finmes-' + ano;
  if (_portalTarget === portalId) { closePortalDropdown(); return; }
  _portalTarget = portalId;

  const portal = document.getElementById('dropPortal');

  function renderPortalMeses() {
    const mesesDoAno = getMesesFinanceirosPorAno(+ano);
    portal.innerHTML = mesesDoAno.map(key => {
      const m = getFinMesData(key);
      const label = m ? MONTHS_PT[m.mes] : key;
      const ativo = _finMesesSelecionados.has(key);
      return `<button class="ydrop-item ${ativo ? 'active' : ''}"
        onclick="toggleFinMes('${key}');renderFinMesesSeletor();renderPortalMeses_${ano}()">
        ${label}
      </button>`;
    }).join('');
  }

  // Expõe a função de re-render no escopo global para o onclick inline conseguir chamar
  window['renderPortalMeses_' + ano] = renderPortalMeses;

  const rect = arrowEl.getBoundingClientRect();
  portal.style.display = 'flex';
  portal.style.top = (rect.bottom + window.scrollY + 6) + 'px';
  portal.style.left = (rect.left + window.scrollX - 60) + 'px';

  renderPortalMeses();
}

// ═══════════════════════════════════════
//  FINANCEIRO — HELPERS DE PERÍODO JUSTO
// ═══════════════════════════════════════
function getAnosComDadosFinanceiros() {
  const anosSet = new Set();
  MONTHS.forEach(m => anosSet.add(m.ano));
  Object.keys(parsedExpenses).forEach(key => {
    const ano = parseInt(key.split('-')[0]);
    if (!isNaN(ano)) anosSet.add(ano);
  });
  return [...anosSet].sort((a, b) => a - b);
}

function getMesesFinanceirosPorAno(ano) {
  const mesesSet = new Set();
  MONTHS.filter(m => m.ano === ano).forEach(m => mesesSet.add(m.key));
  Object.keys(parsedExpenses).forEach(key => {
    if (key.startsWith(ano + '-')) mesesSet.add(key);
  });
  return [...mesesSet].sort();
}

function getFinMesData(key) {
  const m = MONTHS.find(x => x.key === key);
  if (m) return m;
  const [ano, mes] = key.split('-');
  return {
    key,
    periodo: MONTHS_PT[parseInt(mes) - 1] + ' ' + ano,
    mes: parseInt(mes) - 1,
    ano: parseInt(ano),
    geral: {
      aprovado: 0, despesas: parsedExpenses[key] || 0,
      hasDespesas: true, margem: -100,
      total: 0, aprovados: 0, vencidos: 0, cancelados: 0,
      taxa: 0, orcado: 0, perdido: 0, canceladoVal: 0
    },
    dentistas: [], canais: [], cancelados: [], cancByDent: [], topVencidos: [], score: 0
  };
}

function temFaturamentoReal() {
  return Object.keys(parsedFaturamento).length > 0;
}

function getReceitaFinanceira(key) {
  if (_finModoReceita === 'faturamento') {
    if (parsedFaturamento[key] !== undefined) return parsedFaturamento[key];
    return null; // sem dados de faturamento real para esta chave
  }
  // modo aprovados
  const m = MONTHS.find(x => x.key === key);
  if (m) return m.geral.aprovado;
  return null; // sem dados de orçamentos para esta chave
}

function getFinMesDataComReceita(key) {
  const m = getFinMesData(key);
  if (!m) return null;

  const clone = { ...m, geral: { ...m.geral } };
  const receita = getReceitaFinanceira(key);

  if (receita === null) {
    // fonte selecionada não tem dados para este período
    clone.geral.aprovado = 0;
    clone.geral.margem = 0;
    clone._semDados = true;
    clone._fonteAusente = _finModoReceita === 'faturamento' ? 'faturamento real' : 'orçamentos aprovados';
    return clone;
  }

  clone.geral.aprovado = receita;
  const lucro = receita - clone.geral.despesas;
  clone.geral.margem = receita > 0
    ? +((lucro / receita) * 100).toFixed(1)
    : (clone.geral.despesas > 0 ? -100 : 0);

  return clone;
}

function getUltimoMesDoAno(ano) {
  const meses = getMesesFinanceirosPorAno(ano);
  if (!meses.length) return null;
  const ultimo = meses[meses.length - 1];
  return parseInt(ultimo.split('-')[1]);
}

function getMesesAnoAteMes(ano, atesMes) {
  return getMesesFinanceirosPorAno(ano).filter(key => {
    const mes = parseInt(key.split('-')[1]);
    return mes <= atesMes;
  });
}

function getPeriodosJustos(ano1, ano2) {
  const ultimoMes1 = getUltimoMesDoAno(ano1);
  const ultimoMes2 = getUltimoMesDoAno(ano2);
  if (ultimoMes1 === null || ultimoMes2 === null) return null;
  const corte = Math.min(ultimoMes1, ultimoMes2);
  const precisaCorte = ultimoMes1 !== ultimoMes2;
  const meses1 = getMesesAnoAteMes(ano1, corte);
  const meses2 = getMesesAnoAteMes(ano2, corte);
  return { corte, precisaCorte, meses1, meses2, labelCorte: MONTHS_PT[corte - 1], ano1, ano2 };
}

function agregaDadosFinanceiros(chavesMeses) {
  // detecta melhor fonte disponível para o conjunto de meses
  const temFaturamento = chavesMeses.some(k => parsedFaturamento[k] !== undefined);
  const temOrcamentos = chavesMeses.some(k => MONTHS.find(m => m.key === k));

  let fonte;
  if (temFaturamento) fonte = 'faturamento';
  else if (temOrcamentos) fonte = 'aprovados';
  else fonte = null;

  const fat = chavesMeses.reduce((s, key) => {
    if (fonte === 'faturamento') return s + (parsedFaturamento[key] || 0);
    const m = MONTHS.find(x => x.key === key);
    return s + (m ? m.geral.aprovado : 0);
  }, 0);

  const desp = chavesMeses.reduce((s, key) => {
    const m = getFinMesData(key);
    return s + (m ? m.geral.despesas : 0);
  }, 0);

  const lucro = fat - desp;
  const margem = fat > 0 ? +((lucro / fat) * 100).toFixed(1) : (desp > 0 ? -100 : 0);
  const ratio = fat > 0 ? +((desp / fat) * 100).toFixed(1) : 0;
  return { fat, desp, lucro, margem, ratio, fonte };
}

function renderDespesas() {
  const container = document.getElementById('finContent');
  if (!container) return;

  const anosDisponiveis = getAnosComDadosFinanceiros();
  const temQualquerDesp = anosDisponiveis.some(ano => getMesesFinanceirosPorAno(ano).length > 0);

  if (!temQualquerDesp) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center">
        <div style="font-size:48px;margin-bottom:20px">💰</div>
        <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:10px">Nenhuma planilha de despesas carregada</div>
        <div style="font-size:14px;color:var(--muted);max-width:480px;line-height:1.7;margin-bottom:24px">
          Para visualizar a análise financeira completa, faça upload de uma planilha de despesas na tela inicial.
        </div>
        <button onclick="novoPeriodo()" style="margin-top:24px;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
  ← Subir planilha de despesas
</button>
      </div>`;
    return;
  }

  if (!_finView && anosDisponiveis.length > 0) {
    _finView = 'year:' + anosDisponiveis[anosDisponiveis.length - 1];
  }

  const tabsHtml = anosDisponiveis.map(ano => {
    const mesesDoAno = getMesesFinanceirosPorAno(ano);
    if (!mesesDoAno.length) return '';
    const isActive = _finView === 'year:' + ano;
    return `<div class="period-group">
      <button class="year-chip ${isActive ? 'active' : ''}" data-view="year:${ano}" onclick="setFinView('year:${ano}',this)">${ano}
        ${mesesDoAno.length > 1
        ? `<span class="year-arrow" onclick="event.stopPropagation();openFinPortal(this,'${ano}')">▾</span>`
        : ''}
      </button>
    </div>`;
  }).join('');

  let mesesViewKeys = [];
  let tituloView = '';
  let isYearView = false;
  let anoAtivo = null;

  if (_finView && _finView.startsWith('year:')) {
    anoAtivo = +_finView.replace('year:', '');
    isYearView = true;
    // SEM corte — mostra o ano completo na visão geral
    mesesViewKeys = getMesesFinanceirosPorAno(anoAtivo);
    tituloView = String(anoAtivo);
  } else if (_finView && _finView.startsWith('month:')) {
    const key = _finView.replace('month:', '');
    mesesViewKeys = [key];
    const m = getFinMesData(key);
    tituloView = m ? m.periodo : key;
  }

  const mesesView = mesesViewKeys.map(k => getFinMesDataComReceita(k)).filter(Boolean);

  if (mesesView.length === 0) {
    container.innerHTML = `
      <div id="finPeriodTabs" class="month-tabs" style="margin-bottom:20px">${tabsHtml}</div>
      <div style="color:var(--muted);text-align:center;padding:40px">Nenhum dado de despesas neste período.</div>`;
    return;
  }

  const todosSemDados = mesesView.every(m => m._semDados);
  const algunsSemDados = !todosSemDados && mesesView.some(m => m._semDados);
  const fonteAusente = mesesView.find(m => m._semDados)?._fonteAusente || '';

  const alertaSemDadosHtml = todosSemDados ? `
    <div style="background:color-mix(in srgb,var(--red) 8%,transparent);border:1px solid color-mix(in srgb,var(--red) 30%,transparent);
      border-radius:10px;padding:16px 20px;margin-bottom:20px;
      display:flex;align-items:flex-start;gap:12px">
      <span style="font-size:20px">⚠️</span>
      <div>
        <div style="font-weight:700;color:var(--red);margin-bottom:4px">
          Nenhum dado de ${fonteAusente} carregado para este período
        </div>
        <div style="font-size:12px;color:var(--muted);line-height:1.6">
          ${_finModoReceita === 'faturamento'
            ? 'Você está visualizando <strong style="color:var(--text)">Faturamento Real</strong> mas não carregou nenhuma planilha de faturamento para este período. Faça upload da planilha de faturamento ou mude para <strong style="color:var(--text)">Orçamentos Aprovados</strong>.'
            : 'Você está visualizando <strong style="color:var(--text)">Orçamentos Aprovados</strong> mas não há planilha de orçamentos carregada para este período. Faça upload da planilha de orçamentos ou mude para <strong style="color:var(--text)">Faturamento Real</strong>.'}
        </div>
      </div>
    </div>` : algunsSemDados ? `
    <div style="background:color-mix(in srgb,var(--yellow) 8%,transparent);border:1px solid color-mix(in srgb,var(--yellow) 30%,transparent);
      border-radius:10px;padding:12px 16px;margin-bottom:20px;
      display:flex;align-items:center;gap:10px">
      <span style="font-size:16px">⚠️</span>
      <div style="font-size:12px;color:var(--yellow);line-height:1.6">
        Alguns meses não possuem dados de <strong>${fonteAusente}</strong> e aparecem zerados.
        Faça upload das planilhas faltantes para completar a análise.
      </div>
    </div>` : '';

  const fatTotal = mesesView.reduce((s, m) => s + m.geral.aprovado, 0);
  const despTotal = mesesView.reduce((s, m) => s + m.geral.despesas, 0);
  const lucroTotal = fatTotal - despTotal;
  const margemTotal = fatTotal > 0 ? +((lucroTotal / fatTotal) * 100).toFixed(1) : (despTotal > 0 ? -100 : 0);
  const ratioDespFat = fatTotal > 0 ? +((despTotal / fatTotal) * 100).toFixed(1) : 0;
  const marColor = margemTotal >= (_benchmarks.margemIdeal || 20) ? 'var(--green)'
    : margemTotal >= (_benchmarks.margemBaixa || 10) ? 'var(--yellow)'
      : margemTotal >= 0 ? 'var(--orange)' : 'var(--red)';

  let avisoCorteHtml = '';

  const pLabel = CFG.proposta || 'Orçamento';
  const temFat = temFaturamentoReal();

  // Toggle só aparece se o usuário carregou planilha de faturamento real
  const toggleReceitaHtml = temFat ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--muted);font-weight:600">Fonte da receita:</span>
      <div style="display:flex;gap:4px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:3px">
        <button
          onclick="setFinModoReceita('aprovados')"
          style="padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:600;transition:.15s;
            background:${_finModoReceita === 'aprovados' ? 'var(--accent)' : 'transparent'};
            color:${_finModoReceita === 'aprovados' ? '#fff' : 'var(--muted)'}">
          ${pLabel}s Aprovados
        </button>
        <button
          onclick="setFinModoReceita('faturamento')"
          style="padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:600;transition:.15s;
            background:${_finModoReceita === 'faturamento' ? 'var(--accent)' : 'transparent'};
            color:${_finModoReceita === 'faturamento' ? '#fff' : 'var(--muted)'}">
          Faturamento Real
        </button>
      </div>
    </div>` : '';

  // detecta se a fonte selecionada tem dados no período atual
  const temDadosFonteAtual = _finModoReceita === 'faturamento'
    ? mesesViewKeys.some(k => parsedFaturamento[k] !== undefined)
    : mesesViewKeys.some(k => MONTHS.find(m => m.key === k));

  const alertaFonteHtml = !temDadosFonteAtual ? `
    <div style="background:color-mix(in srgb,var(--red) 8%,transparent);border:1px solid color-mix(in srgb,var(--red) 30%,transparent);
      border-radius:10px;padding:14px 18px;margin-bottom:16px;
      display:flex;align-items:flex-start;gap:12px">
      <span style="font-size:20px">⚠️</span>
      <div>
        <div style="font-weight:700;color:var(--red);margin-bottom:4px">
          Nenhum dado de ${_finModoReceita === 'faturamento' ? 'faturamento real' : 'orçamentos aprovados'} para este período
        </div>
        <div style="font-size:12px;color:var(--muted);line-height:1.7">
          ${_finModoReceita === 'faturamento'
            ? `Você selecionou <strong style="color:var(--text)">Faturamento Real</strong> mas não carregou nenhuma planilha de faturamento para <strong style="color:var(--text)">${tituloView}</strong>.<br>
               Faça upload da planilha de faturamento ou mude para <strong style="color:var(--text)">Total Líquidos Aprovados</strong>.`
            : `Você selecionou <strong style="color:var(--text)">Total Líquidos Aprovados</strong> mas não há planilha de orçamentos carregada para <strong style="color:var(--text)">${tituloView}</strong>.<br>
               Faça upload da planilha de orçamentos ou mude para <strong style="color:var(--text)">Faturamento Real</strong>.`}
        </div>
      </div>
    </div>` : '';

  // Badge mostra sempre qual fonte está sendo usada
  const badgeReceitaHtml = !temDadosFonteAtual ? '' : `
    <div style="font-size:11px;color:var(--muted2);margin-bottom:16px;display:flex;align-items:center;gap:6px">
      <span>📊</span>
      <span>Receita baseada em
        <strong style="color:var(--text)">
          ${_finModoReceita === 'faturamento' && temFat
            ? 'faturamento real (caixa)'
            : `${pLabel.toLowerCase()}s aprovados`}
        </strong>
      </span>
    </div>`;

  const kpisFinHtml = `
    <div class="kpi-grid" style="margin-bottom:24px">
      <div class="kpi" style="--kc:var(--green)">
        <div class="kpi-lbl">Receita Total</div>
        <div class="kpi-val">${fmtK(fatTotal)}</div>
        <div class="kpi-sub">${tituloView}</div>
      </div>
      <div class="kpi" style="--kc:var(--red)">
        <div class="kpi-lbl">Despesas Totais</div>
        <div class="kpi-val">${fmtK(despTotal)}</div>
        <div class="kpi-sub">${ratioDespFat}% da receita</div>
      </div>
      <div class="kpi" style="--kc:${lucroTotal >= 0 ? 'var(--green)' : 'var(--red)'}">
        <div class="kpi-lbl">Lucro Líquido</div>
        <div class="kpi-val">${fmtK(lucroTotal)}</div>
        <div class="kpi-sub">${lucroTotal >= 0 ? 'positivo' : 'prejuízo'}</div>
      </div>
      <div class="kpi" style="--kc:${marColor}">
        <div class="kpi-lbl">Margem Líquida</div>
        <div class="kpi-val" style="color:${marColor}">${margemTotal}%</div>
        <div class="kpi-sub">${margemTotal >= (_benchmarks.margemIdeal || 20) ? 'excelente'
      : margemTotal >= (_benchmarks.margemBaixa || 10) ? 'saudável'
        : margemTotal >= 0 ? 'baixa' : 'negativa'}</div>
      </div>
    </div>`;

  let barrasHtml = '';
  if (mesesView.length > 1) {
    const maxFat = Math.max(...mesesView.map(m => m.geral.aprovado), 1);
    barrasHtml = `
      <div class="card" style="margin-bottom:20px">
        <div class="card-title"><span class="dot" style="background:var(--green)"></span>Receita vs Despesas por Mês</div>
        ${mesesView.map(m => {
      const fat = m.geral.aprovado, desp = m.geral.despesas, lucro = fat - desp;
      const mar = fat > 0 ? +((lucro / fat) * 100).toFixed(1) : (desp > 0 ? -100 : 0);
      const mc = mar >= (_benchmarks.margemIdeal || 20) ? 'var(--green)'
        : mar >= (_benchmarks.margemBaixa || 10) ? 'var(--yellow)'
          : mar >= 0 ? 'var(--orange)' : 'var(--red)';
      return `<div class="bar-item" style="margin-bottom:10px">
            <div class="bar-lbl"><span>${m.periodo}</span><span style="color:${mc}">Margem: ${mar}%</span></div>
            <div style="display:flex;gap:4px;margin-top:4px">
              <div style="flex:1">
                <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Receita: ${fmtK(fat)}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${(fat / maxFat * 100).toFixed(1)}%;background:var(--green)"></div></div>
              </div>
              <div style="flex:1">
                <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Despesas: ${fmtK(desp)}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${(desp / maxFat * 100).toFixed(1)}%;background:var(--red)"></div></div>
              </div>
            </div>
          </div>`;
    }).join('')}
      </div>`;
  }

  const insFinanceiros = generateFinancialInsights(mesesView);
  insFinanceiros.sort((a, b) =>
    ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[a.t] || 9) -
    ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[b.t] || 9)
  );
  const insHtml = insFinanceiros.length > 0
    ? insFinanceiros.map(i =>
      `<div class="ins">
          <div class="ins-ico ico-${i.t}">${i.i}</div>
          <div>
            <div class="ins-type tp-${i.t}">${i.l}</div>
            <div class="ins-txt">${i.txt}</div>
            <div class="ins-sub">${i.sub}</div>
          </div>
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px">Carregue mais meses para gerar insights.</div>';

  const yearCompareHtml = anosDisponiveis.length >= 2 ? `
    <div id="finYearCompareWrap" style="margin-top:24px">
      <div class="sec" style="margin-bottom:12px">Comparativo Entre Anos</div>
      <div class="kpi-grid" id="finYearCompareKpis" style="margin-bottom:20px"></div>
      <div class="grid-2" style="margin-bottom:20px">
        <div class="card">
          <div class="card-title">Crescimento % por Categoria</div>
          <div style="height:220px"><canvas id="finYearGrowthChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Receita, Despesas e Lucro por Ano</div>
          <div style="height:220px"><canvas id="finYearLucroChart"></canvas></div>
        </div>
      </div>
      <div id="finYearCompareIns"></div>
    </div>` : '';

  container.innerHTML = `
    <div id="finPeriodTabs" class="month-tabs" style="margin-bottom:20px">${tabsHtml}</div>
    ${avisoCorteHtml}
    <div class="sec" style="margin-bottom:12px">Visão Financeira — ${tituloView}</div>
    ${toggleReceitaHtml}
    ${alertaFonteHtml}
    ${badgeReceitaHtml}
    ${kpisFinHtml}
    ${barrasHtml}
    <div class="card" style="margin-bottom:20px">
      <div class="card-title"><span class="dot" style="background:var(--accent)"></span>Evolução Financeira</div>
      <div style="height:280px"><canvas id="despChart"></canvas></div>
    </div>
    <div class="card full" style="margin-bottom:20px">
      <div class="card-title"><span class="dot" style="background:var(--accent)"></span>Comparação entre Meses</div>
      <div style="margin-bottom:14px;font-size:12px;color:var(--muted)">Selecione meses para comparar (use os dropdowns por ano):</div>
      <div id="finMesesSeletor" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px"></div>
      <div id="finComparativoResultado"></div>
    </div>
    <div class="sec" style="margin-bottom:12px;margin-top:4px">Análise Financeira</div>
    <div class="ins-grid" style="margin-bottom:24px">${insHtml}</div>
    ${yearCompareHtml}`;

  if (_despChartInst) { _despChartInst.destroy(); _despChartInst = null; }
  const despCanvas = document.getElementById('despChart');
  if (despCanvas && mesesView.length >= 1) {
    const isMonthView = mesesView.length === 1;
    if (isMonthView) {
      const fat = mesesView[0].geral.aprovado;
      const desp = mesesView[0].geral.despesas;
      const lucro = fat - desp;
      _despChartInst = new Chart(despCanvas, {
        type: 'bar',
        data: {
          labels: ['Receita', 'Despesas', 'Lucro'],
          datasets: [{
            label: 'Valor',
            data: [fat, desp, lucro],
            backgroundColor: ['rgba(70,192,138,.75)', 'rgba(226,112,92,.7)', lucro >= 0 ? 'rgba(91,141,239,.75)' : 'rgba(224,145,90,.75)'],
            borderColor: ['#46c08a', '#e2705c', lucro >= 0 ? '#5b8def' : '#e0915a'],
            borderWidth: 1.5, borderRadius: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ` ${fmtK(ctx.raw)}` } }
          },
          scales: {
            x: { ticks: { color: themeC('--muted2'), font: { size: 12, weight: '600' } }, grid: { display: false } },
            y: { ticks: { color: themeC('--muted'), font: { size: 10 }, callback: v => fmtK(v) }, grid: { color: themeC('--chart-grid2') } }
          }
        }
      });
    } else {
      _despChartInst = new Chart(despCanvas, {
        type: 'bar',
        data: {
          labels: mesesView.map(m => m.periodo),
          datasets: [
            { label: 'Receita', data: mesesView.map(m => m.geral.aprovado), backgroundColor: 'rgba(70,192,138,.7)', borderColor: '#46c08a', borderWidth: 1.5, borderRadius: 5 },
            { label: 'Despesas', data: mesesView.map(m => m.geral.despesas), backgroundColor: 'rgba(226,112,92,.65)', borderColor: '#e2705c', borderWidth: 1.5, borderRadius: 5 },
            { label: 'Lucro', data: mesesView.map(m => m.geral.aprovado - m.geral.despesas), backgroundColor: 'rgba(91,141,239,.65)', borderColor: '#5b8def', borderWidth: 1.5, borderRadius: 5 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: themeC('--muted2'), font: { size: 11 } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtK(ctx.raw)}` } }
          },
          scales: {
            x: { ticks: { color: themeC('--muted'), font: { size: 10 } }, grid: { color: themeC('--chart-grid') } },
            y: { ticks: { color: themeC('--muted'), font: { size: 10 }, callback: v => fmtK(v) }, grid: { color: themeC('--chart-grid2') } }
          }
        }
      });
    }
  }

  renderFinMesesSeletor();
  renderFinComparativo();
  if (anosDisponiveis.length >= 2) renderFinYearCompare(anosDisponiveis, marColor);
}

function setFinModoReceita(modo) {
  _finModoReceita = modo;
  renderDespesas();
}

function renderFinMesesSeletor() {
  const el = document.getElementById('finMesesSeletor');
  if (!el) return;

  const anosDisponiveis = getAnosComDadosFinanceiros();

  el.innerHTML = anosDisponiveis.map(ano => {
    const mesesDoAno = getMesesFinanceirosPorAno(+ano);
    if (!mesesDoAno.length) return '';
    const todosSelecionados = mesesDoAno.every(k => _finMesesSelecionados.has(k));
    const algumSelecionado = mesesDoAno.some(k => _finMesesSelecionados.has(k));

    return `<div class="period-group">
      <button class="year-chip ${todosSelecionados ? 'active' : algumSelecionado ? 'active' : ''}"
        onclick="toggleFinAnoCompleto('${ano}')">
        ${ano}
        <span class="year-arrow"
          onclick="event.stopPropagation();openFinMesesPortal(this,'${ano}')">▾</span>
      </button>
    </div>`;
  }).join('');
}

function toggleFinAnoCompleto(ano) {
  const mesesDoAno = getMesesFinanceirosPorAno(+ano);
  const todosSelecionados = mesesDoAno.every(k => _finMesesSelecionados.has(k));
  if (todosSelecionados) {
    mesesDoAno.forEach(k => _finMesesSelecionados.delete(k));
  } else {
    mesesDoAno.forEach(k => _finMesesSelecionados.add(k));
  }
  renderFinMesesSeletor();
  renderFinComparativo();
}

function toggleFinMes(key) {
  if (_finMesesSelecionados.has(key)) _finMesesSelecionados.delete(key);
  else _finMesesSelecionados.add(key);
  renderFinMesesSeletor();
  renderFinComparativo();
}

function renderFinComparativo() {
  const el = document.getElementById('finComparativoResultado');
  if (!el) return;

  const selecionados = [..._finMesesSelecionados].sort();

  if (selecionados.length === 0) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px 0">Selecione anos ou meses acima para comparar.</div>`;
    return;
  }

  if (selecionados.length === 1) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px 0">Selecione ao menos 2 períodos para ver a comparação.</div>`;
    return;
  }

  const anosDisponiveis = getAnosComDadosFinanceiros();
  let avisoCorte = '';
  let dadosParaComparar = selecionados;

  if (anosDisponiveis.length >= 2) {
    const anosComTodosOsMeses = anosDisponiveis.filter(ano => {
      const mesesDoAno = getMesesFinanceirosPorAno(ano);
      return mesesDoAno.every(k => _finMesesSelecionados.has(k)) && mesesDoAno.length > 0;
    });

    if (anosComTodosOsMeses.length >= 2) {
      const ano1 = Math.min(...anosComTodosOsMeses);
      const ano2 = Math.max(...anosComTodosOsMeses);
      const periodos = getPeriodosJustos(ano1, ano2);

      if (periodos && periodos.precisaCorte) {
        dadosParaComparar = [...periodos.meses1, ...periodos.meses2].sort();
        avisoCorte = `
          <div style="background:color-mix(in srgb,var(--yellow) 8%,transparent);border:1px solid color-mix(in srgb,var(--yellow) 25%,transparent);
            border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;
            color:var(--yellow);display:flex;align-items:center;gap:10px">
            <span style="font-size:16px">⚠️</span>
            <span>Comparação justa: exibindo <strong>${ano1} Jan→${periodos.labelCorte}</strong>
            vs <strong>${ano2} Jan→${periodos.labelCorte}</strong>
            (${ano2} tem dados até ${periodos.labelCorte}).</span>
          </div>`;
      }
    }
  }

  const dados = dadosParaComparar.map(key => {
    const m = getFinMesData(key);
    const temFat = parsedFaturamento[key] !== undefined;
    const temOrc = !!MONTHS.find(x => x.key === key);
    const fonte = temFat ? 'faturamento' : temOrc ? 'aprovados' : null;
    const fat = temFat ? parsedFaturamento[key] : (temOrc ? (MONTHS.find(x => x.key === key)?.geral.aprovado || 0) : 0);
    const desp = m ? m.geral.despesas : 0;
    const lucro = fat - desp;
    const margem = fat > 0 ? +(lucro / fat * 100).toFixed(1) : (desp > 0 ? -100 : 0);
    const label = m ? m.periodo : key;
    return { key, label, fat, desp, lucro, margem, fonte };
  });

  // alerta fontes mistas
  const fontesUsadasComp = [...new Set(dados.map(d => d.fonte).filter(Boolean))];
  const fontesMistasComp = fontesUsadasComp.length > 1;
  if (fontesMistasComp) {
    avisoCorte += `
      <div style="background:color-mix(in srgb,var(--yellow) 8%,transparent);border:1px solid color-mix(in srgb,var(--yellow) 30%,transparent);
        border-radius:10px;padding:12px 16px;margin-bottom:16px;
        display:flex;align-items:flex-start;gap:10px">
        <span style="font-size:18px">⚠️</span>
        <div style="font-size:12px;color:var(--yellow);line-height:1.6">
          <strong>Atenção: fontes de dados diferentes entre os períodos.</strong><br>
          ${dados.map(d => `<strong>${d.label}</strong>: ${d.fonte === 'faturamento' ? 'faturamento real (caixa)' : d.fonte === 'aprovados' ? 'orçamentos aprovados' : 'sem dados'}`).join(' · ')}<br>
          A comparação pode não ser precisa pois as fontes são distintas.
        </div>
      </div>`;
  }

  let html = avisoCorte;

  html += `
    <div style="overflow-x:auto;margin-bottom:20px">
      <table class="tbl" style="min-width:500px">
        <thead>
          <tr>
            <th>Período</th><th>Faturamento</th><th>Despesas</th><th>Lucro Líquido</th><th>Margem</th>
          </tr>
        </thead>
        <tbody>
          ${dados.map(d => `
            <tr>
              <td><strong>${d.label}</strong></td>
              <td style="color:var(--green)">${fmtK(d.fat)}</td>
              <td style="color:var(--red)">${fmtK(d.desp)}</td>
              <td style="color:${d.lucro >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtK(d.lucro)}</td>
              <td>
                <span class="badge ${d.margem >= (_benchmarks.margemIdeal || 20) ? 'green'
      : d.margem >= (_benchmarks.margemBaixa || 10) ? 'warn' : 'bad'}">
                  ${d.margem}%
                </span>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  if (dados.length >= 2) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:4px">`;
    for (let i = 1; i < dados.length; i++) {
      const ant = dados[i - 1], atual = dados[i];
      const varFat = ant.fat > 0 ? +((atual.fat - ant.fat) / ant.fat * 100).toFixed(1) : null;
      const varDesp = ant.desp > 0 ? +((atual.desp - ant.desp) / ant.desp * 100).toFixed(1) : null;
      const varMarg = +(atual.margem - ant.margem).toFixed(1);
      const seta = (v, inverso = false) => {
        if (v === null) return '—';
        const positivo = inverso ? (v < 0) : (v > 0);
        const cor = positivo ? 'var(--green)' : 'var(--red)';
        const icon = v > 0 ? '↑' : '↓';
        return `<span style="color:${cor};font-weight:700">${icon} ${Math.abs(v)}%</span>`;
      };
      html += `
        <div style="flex:1;min-width:220px;background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:14px 18px">
          <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:10px;letter-spacing:.5px">${ant.label} → ${atual.label}</div>
          <div style="display:flex;flex-direction:column;gap:7px">
            <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted2)">Faturamento</span>${seta(varFat)}</div>
            <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted2)">Despesas</span>${seta(varDesp, true)}</div>
            <div style="display:flex;justify-content:space-between;font-size:13px">
              <span style="color:var(--muted2)">Margem</span>
              <span style="font-weight:700;color:${varMarg >= 0 ? 'var(--green)' : 'var(--red)'}">
                ${varMarg >= 0 ? '↑ +' : '↓ '}${Math.abs(varMarg)}%
              </span>
            </div>
          </div>
        </div>`;
    }
    html += `</div>`;
  }

  el.innerHTML = html;
}

// ═══════════════════════════════════════
//  FINANCEIRO — YEAR COMPARE
// ═══════════════════════════════════════
function renderFinYearCompare(anos, marColor) {
  const wrap = document.getElementById('finYearCompareWrap');
  if (!wrap) return;
  const anosComDesp = anos.filter(ano => getMesesFinanceirosPorAno(ano).length > 0);
  if (anosComDesp.length < 2) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const ano1 = anosComDesp[anosComDesp.length - 2];
  const ano2 = anosComDesp[anosComDesp.length - 1];
  const periodos = getPeriodosJustos(ano1, ano2);

  const dadosPorAno = anosComDesp.map(ano => {
    let chaves;
    if (periodos && periodos.precisaCorte) {
      chaves = ano === ano1 ? periodos.meses1 : ano === ano2 ? periodos.meses2 : getMesesFinanceirosPorAno(ano);
    } else {
      chaves = getMesesFinanceirosPorAno(ano);
    }
    const { fat, desp, lucro, margem, fonte } = agregaDadosFinanceiros(chaves);
    return { ano, fat, desp, lucro, mar: margem, meses: chaves.length, fonte };
  });

  // detecta se anos usam fontes diferentes
  const fontesUsadas = [...new Set(dadosPorAno.map(d => d.fonte).filter(Boolean))];
  const fontesMistas = fontesUsadas.length > 1;
  const avisoFontesMistasHtml = fontesMistas ? `
    <div style="background:color-mix(in srgb,var(--yellow) 8%,transparent);border:1px solid color-mix(in srgb,var(--yellow) 30%,transparent);
      border-radius:10px;padding:12px 16px;margin-bottom:16px;
      display:flex;align-items:flex-start;gap:10px">
      <span style="font-size:18px">⚠️</span>
      <div style="font-size:12px;color:var(--yellow);line-height:1.6">
        <strong>Atenção: fontes de dados diferentes entre os anos.</strong><br>
        ${dadosPorAno.map(d => `<strong>${d.ano}</strong>: ${d.fonte === 'faturamento' ? 'faturamento real (caixa)' : 'orçamentos aprovados'}`).join(' · ')}<br>
        A comparação pode não ser precisa pois as fontes são distintas.
      </div>
    </div>` : '';

    const wrapAviso = document.getElementById('finYearCompareWrap');
    if (wrapAviso && fontesMistas) {
      const avisoEl = document.createElement('div');
      avisoEl.innerHTML = avisoFontesMistasHtml;
      const primeiro = wrapAviso.querySelector('#finYearCompareKpis');
      if (primeiro) wrapAviso.insertBefore(avisoEl.firstElementChild, primeiro);
    }

  if (periodos && periodos.precisaCorte) {
    const avisoEl = document.createElement('div');
    avisoEl.style.cssText = `background:color-mix(in srgb,var(--yellow) 8%,transparent);border:1px solid color-mix(in srgb,var(--yellow) 25%,transparent);
      border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:var(--yellow);
      display:flex;align-items:center;gap:10px`;
    avisoEl.innerHTML = `<span style="font-size:16px">⚠️</span>
      <span>Comparação justa: <strong>${ano1}</strong> e <strong>${ano2}</strong>
      comparados de <strong>Janeiro a ${periodos.labelCorte}</strong>
      (${ano2} tem dados até ${periodos.labelCorte}).</span>`;
    wrap.insertBefore(avisoEl, wrap.firstChild);
  }

  const kpisComp = [];
  for (let i = 1; i < dadosPorAno.length; i++) {
    const prev = dadosPorAno[i - 1], curr = dadosPorAno[i];
    const fatPct = prev.fat > 0 ? +((curr.fat - prev.fat) / prev.fat * 100).toFixed(1) : 0;
    const despPct = prev.desp > 0 ? +((curr.desp - prev.desp) / prev.desp * 100).toFixed(1) : 0;
    const lucroPct = prev.lucro !== 0
      ? +((curr.lucro - prev.lucro) / Math.abs(prev.lucro) * 100).toFixed(1)
      : (curr.lucro > 0 ? 100 : -100);
    const difEfic = +(fatPct - despPct).toFixed(1);
    kpisComp.push(
      { l: `Receita ${prev.ano}→${curr.ano}`, v: (fatPct > 0 ? '+' : '') + fatPct + '%', s: `${fmtK(prev.fat)} → ${fmtK(curr.fat)}`, c: fatPct > 0 ? 'var(--green)' : 'var(--red)' },
      { l: `Despesas ${prev.ano}→${curr.ano}`, v: (despPct > 0 ? '+' : '') + despPct + '%', s: `${fmtK(prev.desp)} → ${fmtK(curr.desp)}`, c: despPct < fatPct ? 'var(--green)' : despPct < 20 ? 'var(--yellow)' : 'var(--red)' },
      { l: `Lucro ${prev.ano}→${curr.ano}`, v: (lucroPct > 0 ? '+' : '') + lucroPct + '%', s: `${fmtK(prev.lucro)} → ${fmtK(curr.lucro)}`, c: lucroPct > 0 ? 'var(--green)' : 'var(--red)' },
      { l: `Eficiência ${prev.ano}→${curr.ano}`, v: (difEfic > 0 ? '+' : '') + difEfic + '%', s: 'receita cresceu ' + (difEfic > 0 ? 'mais' : 'menos') + ' que despesas', c: difEfic > 0 ? 'var(--green)' : difEfic > -5 ? 'var(--yellow)' : 'var(--red)' },
    );
  }

  document.getElementById('finYearCompareKpis').innerHTML = kpisComp.map(k =>
    `<div class="kpi" style="--kc:${k.c}">
      <div class="kpi-lbl">${k.l}</div>
      <div class="kpi-val">${k.v}</div>
      <div class="kpi-sub">${k.s}</div>
    </div>`
  ).join('');

  if (_finYearGrowthChart) { _finYearGrowthChart.destroy(); _finYearGrowthChart = null; }
  const gc = document.getElementById('finYearGrowthChart');
  if (gc && dadosPorAno.length >= 2) {
    const prev = dadosPorAno[dadosPorAno.length - 2];
    const curr = dadosPorAno[dadosPorAno.length - 1];
    const fatPct = prev.fat > 0 ? +((curr.fat - prev.fat) / prev.fat * 100).toFixed(1) : 0;
    const despPct = prev.desp > 0 ? +((curr.desp - prev.desp) / prev.desp * 100).toFixed(1) : 0;
    const lucroPct = prev.lucro !== 0 ? +((curr.lucro - prev.lucro) / Math.abs(prev.lucro) * 100).toFixed(1) : 0;
    const marPct = +(curr.mar - prev.mar).toFixed(1);
    _finYearGrowthChart = new Chart(gc, {
      type: 'bar',
      data: {
        labels: ['Receita', 'Despesas', 'Lucro', 'Margem (%)'],
        datasets: [{
          label: `${prev.ano}→${curr.ano}`,
          data: [fatPct, despPct, lucroPct, marPct],
          backgroundColor: [
            fatPct >= 0 ? 'rgba(70,192,138,.7)' : 'rgba(226,112,92,.7)',
            despPct <= fatPct ? 'rgba(70,192,138,.7)' : 'rgba(226,112,92,.7)',
            lucroPct >= 0 ? 'rgba(91,141,239,.7)' : 'rgba(226,112,92,.7)',
            marPct >= 0 ? 'rgba(124,92,240,.7)' : 'rgba(226,112,92,.7)',
          ],
          borderWidth: 1.5, borderRadius: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.raw > 0 ? '+' : ''}${ctx.raw}%` } }
        },
        scales: {
          x: { ticks: { color: themeC('--muted2'), font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: themeC('--muted'), font: { size: 10 }, callback: v => v + '%' }, grid: { color: themeC('--chart-grid2') } }
        }
      }
    });
  }

  if (_finYearLucroChart) { _finYearLucroChart.destroy(); _finYearLucroChart = null; }
  const lc = document.getElementById('finYearLucroChart');
  if (lc) {
    _finYearLucroChart = new Chart(lc, {
      type: 'bar',
      data: {
        labels: dadosPorAno.map(d => String(d.ano)),
        datasets: [
          { label: 'Receita', data: dadosPorAno.map(d => d.fat), backgroundColor: 'rgba(70,192,138,.7)', borderColor: '#46c08a', borderWidth: 1.5, borderRadius: 5 },
          { label: 'Despesas', data: dadosPorAno.map(d => d.desp), backgroundColor: 'rgba(226,112,92,.65)', borderColor: '#e2705c', borderWidth: 1.5, borderRadius: 5 },
          { label: 'Lucro', data: dadosPorAno.map(d => d.lucro), backgroundColor: 'rgba(91,141,239,.65)', borderColor: '#5b8def', borderWidth: 1.5, borderRadius: 5 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: themeC('--muted2'), font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtK(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { color: themeC('--muted'), font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: themeC('--muted'), font: { size: 10 }, callback: v => fmtK(v) }, grid: { color: themeC('--chart-grid2') } }
        }
      }
    });
  }

  const insWrap = document.getElementById('finYearCompareIns');
  if (insWrap && dadosPorAno.length >= 2) {
    const c = dadosPorAno[dadosPorAno.length - 1];
    // usa apenas meses que têm receita real na fonte selecionada
    const mesesParaInsights = getMesesFinanceirosPorAno(c.ano)
      .map(k => getFinMesDataComReceita(k))
      .filter(m => m && !m._semDados);
    const ins = generateFinancialInsights(mesesParaInsights);
    ins.sort((a, b) =>
      ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[a.t] || 9) -
      ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[b.t] || 9)
    );
    insWrap.innerHTML = ins.length > 0
      ? `<div class="ins-grid">${ins.map(i =>
        `<div class="ins">
            <div class="ins-ico ico-${i.t}">${i.i}</div>
            <div>
              <div class="ins-type tp-${i.t}">${i.l}</div>
              <div class="ins-txt">${i.txt}</div>
              <div class="ins-sub">${i.sub}</div>
            </div>
          </div>`).join('')}</div>`
      : '';
  }
}

function generateFinancialInsights(mesesView) {
  const ins = [];
  if (!mesesView || mesesView.length === 0) return ins;
  const fatTotal = mesesView.reduce((s, m) => s + m.geral.aprovado, 0);
  const despTotal = mesesView.reduce((s, m) => s + m.geral.despesas, 0);
  const lucroTotal = fatTotal - despTotal;
  const margemTotal = fatTotal > 0 ? +((lucroTotal / fatTotal) * 100).toFixed(1) : 0;
  const ratioDespFat = fatTotal > 0 ? +((despTotal / fatTotal) * 100).toFixed(1) : 0;
  const margemIdeal = _benchmarks.margemIdeal || 20;
  const margemBaixa = _benchmarks.margemBaixa || 10;

  // só analisa meses que realmente têm receita carregada
  const mesesComReceita = mesesView.filter(m => m.geral.aprovado > 0 && !m._semDados);

  // análise geral de lucro/margem
  if (fatTotal === 0 && despTotal > 0) {
    ins.push({ t: 'a', i: '⚠️', l: 'Sem Receita para Análise', txt: `Despesas de ${fmtK(despTotal)} sem receita carregada.`, sub: 'Verifique a fonte de receita selecionada ou faça upload da planilha correspondente.' });
    return ins;
  }

  if (lucroTotal >= 0) {
    if (margemTotal >= margemIdeal) {
      ins.push({ t: 'g', i: '✅', l: 'Margem Saudável', txt: `Lucro de ${fmtK(lucroTotal)} com margem de ${margemTotal}%.`, sub: `Despesas representam ${ratioDespFat}% da receita. Continue assim.` });
    } else if (margemTotal >= margemBaixa) {
      ins.push({ t: 'w', i: '📊', l: 'Margem Baixa mas Positiva', txt: `Lucro de ${fmtK(lucroTotal)} — margem de ${margemTotal}%.`, sub: `Meta recomendada: acima de ${margemIdeal}%. Reduzir despesas variáveis.` });
    } else {
      ins.push({ t: 'o', i: '⚠️', l: 'Margem Muito Baixa', txt: `Lucro de apenas ${fmtK(lucroTotal)} — margem de ${margemTotal}%.`, sub: `Despesas em ${ratioDespFat}% da receita. Revisar custos com urgência.` });
    }
  } else {
    ins.push({ t: 'a', i: '🔴', l: 'Empresa no Prejuízo', txt: `Prejuízo de ${fmtK(Math.abs(lucroTotal))} — despesas superam receita.`, sub: `Despesas em ${ratioDespFat}% da receita. Corte imediato necessário.` });
  }

  if (ratioDespFat > 90 && lucroTotal >= 0) {
    ins.push({ t: 'w', i: '📈', l: `Despesas em ${ratioDespFat}% da Receita`, txt: `R$${ratioDespFat} de cada R$100 consumidos em despesas.`, sub: 'Meta recomendada: abaixo de 80%. Renegociar contratos de custo fixo.' });
  }

  // análise de tendência — só quando há pelo menos 2 meses com receita real
  if (mesesComReceita.length >= 2) {
    const primeiro = mesesComReceita[0];
    const ultimo = mesesComReceita[mesesComReceita.length - 1];
    const fatPrimeiro = primeiro.geral.aprovado;
    const fatUltimo = ultimo.geral.aprovado;
    const despPrimeiro = primeiro.geral.despesas;
    const despUltimo = ultimo.geral.despesas;
    const varFat = fatPrimeiro > 0 ? +((fatUltimo - fatPrimeiro) / fatPrimeiro * 100).toFixed(1) : null;
    const varDesp = despPrimeiro > 0 ? +((despUltimo - despPrimeiro) / despPrimeiro * 100).toFixed(1) : null;
    if (varFat !== null && varDesp !== null && Math.abs(varFat) > 3) {
      const crescendoMaisQueDesp = varFat > varDesp;
      ins.push({
        t: crescendoMaisQueDesp ? 'g' : 'w',
        i: crescendoMaisQueDesp ? '📈' : '📉',
        l: crescendoMaisQueDesp ? 'Receita Crescendo Mais que Despesas' : 'Despesas Crescendo Mais que Receita',
        txt: `Receita ${varFat >= 0 ? '+' : ''}${varFat}% vs Despesas ${varDesp >= 0 ? '+' : ''}${varDesp}% (${primeiro.periodo} → ${ultimo.periodo}).`,
        sub: crescendoMaisQueDesp ? 'Eficiência financeira melhorando.' : 'Identificar quais despesas cresceram e conter o avanço.'
      });
    }
    const margPrimeiro = fatPrimeiro > 0 ? +((fatPrimeiro - despPrimeiro) / fatPrimeiro * 100).toFixed(1) : 0;
    const margUltimo = fatUltimo > 0 ? +((fatUltimo - despUltimo) / fatUltimo * 100).toFixed(1) : 0;
    const varMarg = +(margUltimo - margPrimeiro).toFixed(1);
    if (Math.abs(varMarg) >= 2) {
      ins.push({
        t: varMarg > 0 ? 'g' : 'w',
        i: varMarg > 0 ? '✅' : '📉',
        l: varMarg > 0 ? 'Margem em Alta' : 'Margem em Queda',
        txt: `Saiu de ${margPrimeiro}% para ${margUltimo}% (variação de ${varMarg > 0 ? '+' : ''}${varMarg}%).`,
        sub: varMarg > 0 ? 'Tendência positiva — manter controle de custos.' : 'Analisar quais meses puxaram a margem para baixo.'
      });
    }
  }

  // variação entre meses — só quando há pelo menos 3 meses com receita
  if (mesesComReceita.length >= 3) {
    const comMargem = mesesComReceita.filter(m => m.geral.aprovado > 0);
    if (comMargem.length >= 2) {
      const melhor = comMargem.reduce((a, b) => {
        const ma = (a.geral.aprovado - a.geral.despesas) / a.geral.aprovado;
        const mb = (b.geral.aprovado - b.geral.despesas) / b.geral.aprovado;
        return ma > mb ? a : b;
      });
      const pior = comMargem.reduce((a, b) => {
        const ma = (a.geral.aprovado - a.geral.despesas) / a.geral.aprovado;
        const mb = (b.geral.aprovado - b.geral.despesas) / b.geral.aprovado;
        return ma < mb ? a : b;
      });
      const margMelhor = +((melhor.geral.aprovado - melhor.geral.despesas) / melhor.geral.aprovado * 100).toFixed(1);
      const margPior = +((pior.geral.aprovado - pior.geral.despesas) / pior.geral.aprovado * 100).toFixed(1);
      if (melhor.periodo !== pior.periodo) {
        ins.push({ t: 'i', i: '📊', l: 'Variação entre Meses', txt: `Melhor: ${melhor.periodo} (${margMelhor}%) · Pior: ${pior.periodo} (${margPior}%).`, sub: 'Analisar o que diferenciou os meses extremos.' });
      }
    }
  }

  return ins;
}

// ═══════════════════════════════════════
//  AÇÕES
// ═══════════════════════════════════════
function renderAcoes(M, prev) {
  const acoes = getAcoesList(M, prev);
  const labels = { ph: 'URGENTE', pm: 'ESTA SEMANA', pl: 'ESTE MÊS' };
  document.getElementById('acaoList').innerHTML = acoes.map((a, i) =>
    `<div class="acao">
      <div class="acao-n">${i + 1}</div>
      <div style="flex:1">
        <div class="acao-t">${a.t}</div>
        <div class="acao-d">${a.d}</div>
      </div>
      <div class="acao-pri ${a.p}">${labels[a.p]}</div>
    </div>`
  ).join('');
}

function getAcoesList(M, prev_) {
  const g = M.geral;
  const vLabel = CFG.vendedor || 'Vendedor';
  const vLabelP = pluralizar(vLabel);
  const cLabel = CFG.cliente || 'Cliente';
  const cLabelP = pluralizar(cLabel);
  const pLabel = CFG.proposta || 'Orçamento';
  const pLabelP = pluralizar(pLabel);
  const piorTaxa = [...M.dentistas].filter(d => d.total >= 5).sort((a, b) => a.taxa - b.taxa)[0];
  const upsell = [...M.dentistas].filter(d => d.taxa >= 85 && d.total >= 5).sort((a, b) => a.ticket_medio - b.ticket_medio)[0];
  const top5 = M.topVencidos.slice(0, 5);
  const melhorCanal = [...M.canais].filter(c => c.total >= 5).sort((a, b) => b.taxa - a.taxa)[0];
  const ni = M.canais.find(c => c.canal === 'NAO INFORMADO');
  const acoes = [];
  if (top5.length > 0)
    acoes.push({ t: `Ligar para os ${top5.length} maiores ${pLabelP.toLowerCase()} vencidos`, d: `Prioridade: ${top5.slice(0, 3).map(v => v.paciente.split(' ')[0]).join(', ')}. Total em jogo: ${fmtK(top5.reduce((s, v) => s + v.total, 0))}. Oferecer condição especial.`, p: 'ph' });
  if (piorTaxa)
    acoes.push({ t: `Reunião com ${piorTaxa.nome} — análise de ${pLabelP.toLowerCase()} perdidos`, d: `${piorTaxa.vencidos} vencidos (${fmtK(piorTaxa.valor_perdido)}). Mapear objeções e criar roteiro de resposta.`, p: 'ph' });
  if (g.cancelados > g.total * (_benchmarks.cancelamentosAlerta / 100 || 0.08))
    acoes.push({ t: 'Investigar motivos dos cancelamentos', d: `${g.cancelados} cancelamentos. Verificar padrão por ${vLabel.toLowerCase()}, canal ou período.`, p: 'ph' });
  if (ni && ni.total > 5)
    acoes.push({ t: `Tornar obrigatório o campo Canal de Marketing`, d: `${ni.total} ${pLabelP.toLowerCase()} sem canal. Campo obrigatório para garantir análise de ROI.`, p: 'pm' });
  if (upsell)
    acoes.push({ t: `Capacitar ${upsell.nome} em upsell`, d: `${upsell.taxa}% de conversão mas ticket médio de ${fmtK(upsell.ticket_medio)}. ${cLabelP} engajados são receptivos a serviços complementares.`, p: 'pm' });
  if (melhorCanal)
    acoes.push({ t: `Ampliar foco no canal "${canalDisplay(melhorCanal.canal)}"`, d: `${melhorCanal.taxa}% de conversão e ${fmtK(melhorCanal.valor)} — melhor ROI.`, p: 'pm' });
  if (prev_ && M.geral.aprovado < prev_.geral.aprovado)
    acoes.push({ t: `Recuperar queda de ${fmtK(prev_.geral.aprovado - M.geral.aprovado)} vs ${prev_.periodo}`, d: `Receita caiu ${pct(prev_.geral.aprovado - M.geral.aprovado, prev_.geral.aprovado).toFixed(0)}% em relação ao período anterior.`, p: 'ph' });
  return acoes;
}

// ═══════════════════════════════════════
//  TABS
// ═══════════════════════════════════════
function showTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ntab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
  if (id === 'financeiro') renderDespesas();
  if (id === 'comparativo') renderTrendChart();
  if (id === 'vendedores') renderVendedores();
}

// ═══════════════════════════════════════
//  RESET
// ═══════════════════════════════════════
function resetDash() {
  MONTHS = []; YEARS = {}; parsedMonths = {}; parsedExpenses = {}; parsedFaturamento = {}; _detectionLogs = [];
  _finModoReceita = 'aprovados';
  activeMonth = 0; activeYear = null; cmpItems = []; _finView = null;
  dentSort = 'taxa'; activeDentFilter = 'all'; clinicGoal = 0;
  _rangeFilter = null; _rangeFilteredData = null;
  _notas = {}; _metasMensais = {}; _finMesesSelecionados = new Set();

  [_dentChartInstance, _despChartInst, _trendChartInst, _finYearGrowthChart, _finYearLucroChart, _canalDonutChart, _vendedorTrendChart].forEach(c => {
    try { if (c) c.destroy(); } catch (e) { }
  });
  _dentChartInstance = null; _despChartInst = null; _trendChartInst = null;
  _finYearGrowthChart = null; _finYearLucroChart = null; _canalDonutChart = null; _vendedorTrendChart = null;

  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('uploadScreen').style.display = 'flex';
  document.getElementById('fileInput').value = '';
  document.getElementById('errBanner').style.display = 'none';
  document.getElementById('suspectBanner').style.display = 'none';
  document.getElementById('monthChips').innerHTML = '';
  document.getElementById('detectionFeedback').innerHTML = '';
  document.getElementById('btnAnalyze').style.display = 'none';
  document.getElementById('tabCmpBtn').style.display = 'none';

  const tfb = document.getElementById('tabFinBtn');
  if (tfb) tfb.style.display = 'none';
  const gi = document.getElementById('goalInput');
  if (gi) gi.value = '';
  const gpb = document.getElementById('goalProgressBar');
  if (gpb) gpb.style.display = 'none';
  const gpl = document.getElementById('goalProgressLabel');
  if (gpl) gpl.style.display = 'none';
  const badge = document.getElementById('rangeActiveBadge');
  if (badge) badge.style.display = 'none';
  const slb = document.getElementById('sessionLoadedBadge');
  if (slb) slb.style.display = 'none';

  const partial = document.getElementById('partialMonthBanner');
  if (partial) partial.remove();
  const notas = document.getElementById('notasPeriodoWrap');
  if (notas) notas.remove();

  try { localStorage.removeItem('dash_goal'); localStorage.removeItem('dash_cmpItems'); } catch (e) { }
}

function novoPeriodo() {
  // Se empresa ativa: NÃO zera parsedMonths/Expenses/Faturamento
  // Eles serão reaproveitados junto com o que for subido agora
  if (!_empresaAtiva) {
    parsedMonths = {};
    parsedExpenses = {};
    parsedFaturamento = {};
  }

  MONTHS = []; YEARS = {};
  _detectionLogs = [];
  _finModoReceita = 'aprovados';
  activeMonth = 0; activeYear = null; cmpItems = []; _finView = null;
  dentSort = 'taxa'; activeDentFilter = 'all'; clinicGoal = 0;
  _rangeFilter = null; _rangeFilteredData = null;
  _notas = {}; _metasMensais = {}; _finMesesSelecionados = new Set();

  [_dentChartInstance, _despChartInst, _trendChartInst,
   _finYearGrowthChart, _finYearLucroChart, _canalDonutChart,
   _vendedorTrendChart].forEach(c => {
    try { if (c) c.destroy(); } catch (e) {}
  });
  _dentChartInstance = null; _despChartInst = null; _trendChartInst = null;
  _finYearGrowthChart = null; _finYearLucroChart = null;
  _canalDonutChart = null; _vendedorTrendChart = null;

  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('uploadScreen').style.display = 'flex';
  document.getElementById('fileInput').value = '';
  document.getElementById('errBanner').style.display = 'none';
  document.getElementById('suspectBanner').style.display = 'none';
  document.getElementById('detectionFeedback').innerHTML = '';
  document.getElementById('tabCmpBtn').style.display = 'none';

  const tfb = document.getElementById('tabFinBtn');
  if (tfb) tfb.style.display = 'none';
  const gi = document.getElementById('goalInput');
  if (gi) gi.value = '';
  const gpb = document.getElementById('goalProgressBar');
  if (gpb) gpb.style.display = 'none';
  const gpl = document.getElementById('goalProgressLabel');
  if (gpl) gpl.style.display = 'none';
  const badge = document.getElementById('rangeActiveBadge');
  if (badge) badge.style.display = 'none';
  const slb = document.getElementById('sessionLoadedBadge');
  if (slb) slb.style.display = 'none';
  const partial = document.getElementById('partialMonthBanner');
  if (partial) partial.remove();
  const notas = document.getElementById('notasPeriodoWrap');
  if (notas) notas.remove();

  try {
    localStorage.removeItem('dash_goal');
    localStorage.removeItem('dash_cmpItems');
  } catch (e) {}

  // Config card e subtítulo
  const configCard = document.getElementById('configCard');
  if (configCard) configCard.style.display = _empresaAtiva ? 'none' : 'block';

  const metrikSub = document.getElementById('metrikSub');
  if (metrikSub) {
    metrikSub.textContent = _empresaAtiva
      ? `📂 Subindo novos dados para: ${_empresaAtiva.nome}`
      : 'Configure sua clínica e importe os dados para começar';
  }

  // Restaura meta da empresa ativa
  if (_empresaAtiva && _empresaAtiva.meta > 0) {
    clinicGoal = _empresaAtiva.meta;
    CFG.meta = _empresaAtiva.meta;
  }

  // Mostra chips e botão se já tem dados em memória
  if (_empresaAtiva) {
    updateChips();
    const temMeses = Object.keys(parsedMonths).length > 0;
    document.getElementById('btnAnalyze').style.display = temMeses ? 'flex' : 'none';
    showToast(`📂 Subindo novos dados para: ${_empresaAtiva.nome}`);
  } else {
    document.getElementById('monthChips').innerHTML = '';
    document.getElementById('btnAnalyze').style.display = 'none';
  }
}


// ═══════════════════════════════════════
//  TEMPLATES
// ═══════════════════════════════════════
function downloadTemplate(tipo) {
  if (tipo === 'orcamentos') downloadTemplateOrcamentos();
  else if (tipo === 'despesas') downloadTemplateDespesas();
  else if (tipo === 'faturamento') downloadTemplateFaturamento();
}

function downloadTemplateFaturamento() {
  const wb = XLSX.utils.book_new();
  const rows = [
    ['Faturamento', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    ['Receita Real', 45000, 52000, 48000, 51000, 55000, 49000,
      53000, 58000, 47000, 61000, 56000, 63000],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, ...Array(12).fill({ wch: 14 })];
  XLSX.utils.book_append_sheet(wb, ws, 'Faturamento 2026');
  XLSX.writeFile(wb, 'Template_Faturamento_Real.xlsx');
}
function downloadTemplateOrcamentos() {
  const wb = XLSX.utils.book_new();
  const v = CFG.vendedor || 'Dentista';
  const c = CFG.cliente || 'Paciente';
  const rows = [
    [v, c, 'Total Líquido', 'Situação', 'Emissão', 'Aprovação', 'Campanha de Marketing', 'Telefone'],
    ['Dra. Ana Silva', 'João Santos', '2500', 'Aprovado', '01/01/2025', '05/01/2025', 'Indicação', '(11) 99999-1111'],
    ['Dra. Ana Silva', 'Maria Oliveira', '1800', 'Vencido', '03/01/2025', '', 'Google', '(11) 99999-2222'],
    ['Dra. Carla Melo', 'Pedro Costa', '3200', 'Vencido', '05/01/2025', '', 'Retorno', '(11) 99999-3333'],
    ['Dra. Carla Melo', 'Lucia Ferreira', '4100', 'Aprovado', '07/01/2025', '10/01/2025', 'Campanha Interna', '(11) 99999-4444'],
    ['Dra. Ana Silva', 'Carlos Lima', '900', 'Cancelado', '10/01/2025', '', 'Localização', '(11) 99999-5555'],
    ['Dra. Ana Silva', 'Fernanda Rocha', '2750', 'Aprovado', '12/01/2025', '15/01/2025', 'Google', '(11) 99999-6666'],
    ['Dra. Carla Melo', 'Roberto Alves', '5000', 'Vencido', '15/01/2025', '', 'Indicação', '(11) 99999-7777'],
    ['Dra. Carla Melo', 'Patricia Souza', '1500', 'Aprovado', '18/01/2025', '20/01/2025', 'Retorno', '(11) 99999-8888'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Janeiro 2025');
  XLSX.writeFile(wb, 'Template_Orcamentos.xlsx');
}
function downloadTemplateDespesas() {
  const wb = XLSX.utils.book_new();
  const rows = [
    ['Despesas', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    ['Aluguel', 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
    ['Salários', 12000, 12000, 12000, 12500, 12500, 12500, 12500, 12500, 13000, 13000, 13000, 13000],
    ['Materiais', 2300, 1800, 2100, 2400, 1950, 2200, 2050, 1900, 2300, 2100, 2400, 1800],
    ['Marketing', 1500, 1500, 2000, 2000, 1500, 1500, 2000, 2000, 1500, 1500, 2000, 2000],
    ['Energia', 800, 750, 820, 780, 810, 900, 950, 930, 870, 800, 780, 760],
    ['Manutenção', 400, 0, 1200, 300, 0, 500, 200, 0, 800, 300, 0, 600],
    ['Contador', 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600],
    ['Outros', 350, 200, 450, 300, 250, 400, 180, 320, 290, 410, 360, 270],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, ...Array(12).fill({ wch: 14 })];
  XLSX.utils.book_append_sheet(wb, ws, 'Despesas 2025');
  XLSX.writeFile(wb, 'Template_Despesas.xlsx');
}

// ═══════════════════════════════════════
//  MODO APRESENTAÇÃO
// ═══════════════════════════════════════
function toggleApresentacao() {
  if (_apresentacaoAtivo) sairApresentacao();
  else entrarApresentacao();
}
function entrarApresentacao() {
  _apresentacaoAtivo = true;
  _apresentacaoTabIdx = 0;
  document.body.classList.add('modo-apresentacao');
  document.getElementById('apresentacaoControls').style.display = 'flex';
  const btn = document.getElementById('btnApresentacao');
  btn.style.background = 'rgba(226,112,92,.15)';
  btn.style.borderColor = 'rgba(226,112,92,.4)';
  btn.style.color = 'var(--red)';
  btn.textContent = '✕ Apresentação';
  aplicarTabApresentacao();
  if (_apresentacaoInterval > 0) iniciarTimerApresentacao();
  showToast('🖥️ Modo apresentação ativado — ESC para sair');
}
function sairApresentacao() {
  _apresentacaoAtivo = false;
  document.body.classList.remove('modo-apresentacao');
  document.getElementById('apresentacaoControls').style.display = 'none';
  const btn = document.getElementById('btnApresentacao');
  btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = '';
  btn.textContent = '🖥️ Apresentação';
  clearInterval(_apresentacaoTimer); clearInterval(_apresentacaoProgressTimer);
  _apresentacaoTimer = null; _apresentacaoProgressTimer = null;
  const bar = document.getElementById('apresentacaoProgress');
  if (bar) bar.style.width = '0%';
  showToast('Modo apresentação encerrado');
}
function aplicarTabApresentacao() {
  const tabId = _apresentacaoTabs[_apresentacaoTabIdx];
  const btn = document.querySelector(`.ntab[onclick*="'${tabId}'"]`);
  if (btn) showTab(tabId, btn);
  const vLabel = CFG.vendedor || 'Vendedor';
  const vLabelP = pluralizar(vLabel);
  const tabLabels = {
    'visao': 'Visão Geral',
    'vendedores-detalhe': vLabelP,
    'vendedores': 'Evolução por ' + vLabel,
    'canais': 'Canais',
    'recuperar': 'Recuperar',
    'comparativo': 'Comparativo',
    'financeiro': 'Financeiro',
    'acoes': 'Ações'
  };
  const label = document.getElementById('apresentacaoTabLabel');
  if (label) label.textContent = `${_apresentacaoTabIdx + 1}/${_apresentacaoTabs.length} — ${tabLabels[tabId] || tabId}`;
}
function apresentacaoNext() {
  _apresentacaoTabIdx = (_apresentacaoTabIdx + 1) % _apresentacaoTabs.length;
  aplicarTabApresentacao();
  if (_apresentacaoInterval > 0) {
    clearInterval(_apresentacaoTimer); clearInterval(_apresentacaoProgressTimer);
    iniciarTimerApresentacao();
  }
}
function apresentacaoPrev() {
  _apresentacaoTabIdx = (_apresentacaoTabIdx - 1 + _apresentacaoTabs.length) % _apresentacaoTabs.length;
  aplicarTabApresentacao();
  if (_apresentacaoInterval > 0) {
    clearInterval(_apresentacaoTimer); clearInterval(_apresentacaoProgressTimer);
    iniciarTimerApresentacao();
  }
}
function setApresInterval(ms, btn) {
  _apresentacaoInterval = ms;
  document.querySelectorAll('.apres-interval-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  clearInterval(_apresentacaoTimer); clearInterval(_apresentacaoProgressTimer);
  const bar = document.getElementById('apresentacaoProgress');
  if (bar) bar.style.width = '0%';
  if (ms > 0) iniciarTimerApresentacao();
}
function iniciarTimerApresentacao() {
  const bar = document.getElementById('apresentacaoProgress');
  const dur = _apresentacaoInterval;
  let elapsed = 0;
  const step = 100;
  if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; }
  setTimeout(() => { if (bar) bar.style.transition = `width ${step}ms linear`; }, 50);
  _apresentacaoProgressTimer = setInterval(() => {
    elapsed += step;
    const p = Math.min(elapsed / dur * 100, 100);
    if (bar) bar.style.width = p + '%';
    if (elapsed >= dur) clearInterval(_apresentacaoProgressTimer);
  }, step);
  _apresentacaoTimer = setInterval(() => { apresentacaoNext(); }, dur);
}

// ═══════════════════════════════════════
//  EXPORT PDF
// ═══════════════════════════════════════
// ═══════════════════════════════════════
//  EXPORT PDF
// ═══════════════════════════════════════
function exportPDF() {
  const overlay = document.getElementById('exportOverlay');
  document.getElementById('exportMsg').textContent = 'Gerando relatorio PDF...';
  overlay.classList.add('show');
  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const M = getActiveData();
      const g = M.geral;
      const prev_ = getPrev();
      const nomeEmpresa = CFG.empresa || 'Dashboard Comercial';
      const vLabel = CFG.vendedor || 'Vendedor';
      const vLabelP = pluralizar(vLabel);
      const cLabel = CFG.cliente || 'Cliente';
      const pLabel = CFG.proposta || 'Orcamento';
      const pLabelP = pluralizar(pLabel);
      const W = 210, mg = 14;

      const cDark   = [10, 13, 20];
      const cSurf   = [22, 28, 45];
      const cSurf2  = [30, 37, 58];
      const cAccent = [79, 156, 249];
      const cGreen  = [52, 211, 153];
      const cRed    = [248, 113, 113];
      const cYellow = [251, 191, 36];
      const cOrange = [251, 146, 60];
      const cText   = [226, 232, 240];
      const cMuted  = [100, 116, 139];

      const clean = s => {
        if (!s) return '';
        return String(s)
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\x20-\x7E]/g, '')
          .replace(/\s+/g, ' ').trim();
      };

      // ── Determina ano ativo e meses equivalentes do ano anterior ──
      const anoAtivo = activeYear !== null ? +activeYear
        : (activeMonth >= 0 && MONTHS[activeMonth] ? +MONTHS[activeMonth].ano || null : null);
      const anoAnterior = anoAtivo !== null ? anoAtivo - 1 : null;

      const mesesDoAno = anoAtivo !== null
        ? MONTHS.filter(m => +m.ano === +anoAtivo)
        : MONTHS;
      const mesesAnoAnterior = anoAnterior !== null
        ? MONTHS.filter(m => +m.ano === +anoAnterior)
        : [];

      // ── Helper: obtém faturamento real de um mês pela chave ──
      // Retorna o valor da planilha de faturamento se existir, senão null
      const getFatReal = key => {
        if (!key) return null;
        const fat = parsedFaturamento[key];
        if (fat === undefined || fat === null) return null;
        return typeof fat === 'object' ? (fat.total || fat.valor || 0) : +fat;
      };

      // ── Verifica se ambos os anos têm planilha de faturamento ──
      // Para usar faturamento real nos blocos financeiros,
      // AMBOS os anos precisam ter dados de faturamento
      const chavesMesesAtivo    = mesesDoAno.map(m => m.key).filter(Boolean);
      const chavesMesesAnterior = mesesAnoAnterior.map(m => m.key).filter(Boolean);
      const temFatAtivo    = chavesMesesAtivo.some(k    => getFatReal(k) !== null);
      const temFatAnterior = chavesMesesAnterior.length === 0 || chavesMesesAnterior.some(k => getFatReal(k) !== null);
      // usaFatReal = true apenas se o ano ativo TEM faturamento real
      // Para o comparativo anual, exige que ambos tenham
      const usaFatRealAtivo    = temFatAtivo;
      const usaFatRealAmbos    = temFatAtivo && (mesesAnoAnterior.length === 0 || chavesMesesAnterior.some(k => getFatReal(k) !== null));

      // ── Helper: receita de um mês (faturamento real se disponível, senão aprovado) ──
      const getReceitaMes = (m, usaFat) => {
        if (!usaFat) return m.geral.aprovado;
        const fat = getFatReal(m.key);
        return fat !== null ? fat : m.geral.aprovado;
      };

      // ── Comparativo com período anterior (usa apenas receita de orçamentos) ──
      let prevReceitaAdj    = prev_ ? prev_.geral.aprovado   : 0;
      let prevTaxaAdj       = prev_ ? prev_.geral.taxa       : 0;
      let prevPerdidoAdj    = prev_ ? prev_.geral.perdido    : 0;
      let prevCanceladosAdj = prev_ ? prev_.geral.cancelados : 0;
      let prevTicketAdj     = prev_ && prev_.geral.aprovados > 0
        ? prev_.geral.aprovado / prev_.geral.aprovados : 0;

      if (anoAtivo !== null && mesesAnoAnterior.length > 0) {
        const mesesAtivosIdx = mesesDoAno.map(m => +m.mes);
        const mesesAntEquiv  = mesesAnoAnterior.filter(m => mesesAtivosIdx.includes(+m.mes));
        if (mesesAntEquiv.length > 0) {
          prevReceitaAdj    = mesesAntEquiv.reduce((a, m) => a + m.geral.aprovado,   0);
          prevPerdidoAdj    = mesesAntEquiv.reduce((a, m) => a + m.geral.perdido,    0);
          prevCanceladosAdj = mesesAntEquiv.reduce((a, m) => a + m.geral.cancelados, 0);
          const totAnt  = mesesAntEquiv.reduce((a, m) => a + m.geral.total,    0);
          const aprvAnt = mesesAntEquiv.reduce((a, m) => a + m.geral.aprovados, 0);
          prevTaxaAdj   = totAnt  > 0 ? +(aprvAnt / totAnt * 100).toFixed(1) : 0;
          prevTicketAdj = aprvAnt > 0 ? prevReceitaAdj / aprvAnt : 0;
        }
      }

      const pageBg = () => {
        doc.setFillColor(...cDark);
        doc.rect(0, 0, 210, 297, 'F');
      };

      const secTitle = (txt, y) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...cAccent);
        doc.text(clean(txt).toUpperCase(), mg, y);
        doc.setDrawColor(...cAccent);
        doc.setLineWidth(.3);
        doc.line(mg, y + 1.5, W - mg, y + 1.5);
        return y + 5;
      };

      const addFooter = (pagNum, pagTotal) => {
        doc.setFillColor(...cSurf2);
        doc.rect(0, 285, 210, 12, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...cMuted);
        doc.text(clean(nomeEmpresa) + ' | ' + clean(M.periodo), mg, 291);
        doc.text('Pagina ' + pagNum + (pagTotal ? ' de ' + pagTotal : ''), W - mg, 291, { align: 'right' });
        doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), W / 2, 291, { align: 'center' });
      };

      const progressBar = (x, y, w, h, pct, cor) => {
        doc.setFillColor(...cSurf2);
        doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
        const fill = Math.min(Math.max(pct / 100, 0), 1) * w;
        if (fill > 0) {
          doc.setFillColor(...cor);
          doc.roundedRect(x, y, fill, h, h / 2, h / 2, 'F');
        }
      };

      const hasFin = g.hasDespesas || Object.keys(parsedExpenses).length > 0 || Object.keys(parsedFaturamento).length > 0;
      const totalPags = hasFin ? 6 : 5;
      let pagNum = 1;

      // ══════════════════════════════════════
      // PÁGINA 1 — CAPA + KPIs
      // ══════════════════════════════════════
      pageBg();
      doc.setFillColor(...cSurf);
      doc.roundedRect(mg, 8, W - mg * 2, 38, 3, 3, 'F');
      doc.setFillColor(...cAccent);
      doc.rect(mg, 8, 5, 38, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...cAccent);
      doc.text(clean(nomeEmpresa), mg + 9, 22);
      doc.setFontSize(10);
      doc.setTextColor(...cText);
      doc.text('Dashboard Comercial | ' + clean(M.periodo), mg + 9, 30);
      doc.setFontSize(8);
      doc.setTextColor(...cMuted);
      doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), mg + 9, 37);
      doc.text('Relatorio de Performance', mg + 9, 42);

      const sc = M.score >= 80 ? cGreen : M.score >= 65 ? cYellow : cRed;
      doc.setFillColor(...cSurf2);
      doc.roundedRect(W - mg - 32, 10, 32, 34, 3, 3, 'F');
      doc.setFillColor(...sc);
      doc.rect(W - mg - 32, 10, 32, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...sc);
      doc.text(String(M.score), W - mg - 16, 28, { align: 'center' });
      doc.setFontSize(7);
      doc.setTextColor(...cMuted);
      doc.text('SCORE /100', W - mg - 16, 34, { align: 'center' });
      const scoreLabel = M.score >= 80 ? 'Saudavel' : M.score >= 65 ? 'Atencao' : M.score >= 50 ? 'Regular' : 'Critico';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...sc);
      doc.text(scoreLabel, W - mg - 16, 40, { align: 'center' });

      let y = 54;
      y = secTitle('Indicadores Principais', y);
      const ticketMedio = g.aprovados > 0 ? g.aprovado / g.aprovados : 0;
      const goalAtivo = getGoalForActivePeriod();
      const goalPct = goalAtivo > 0 ? Math.min(+(g.aprovado / goalAtivo * 100).toFixed(1), 999) : null;
      const kpis = [
        { l: 'Taxa de Conversao',    v: g.taxa + '%',         s: g.aprovados + '/' + g.total + ' orcamentos',        c: cAccent  },
        { l: 'Receita Faturada',     v: fmtK(g.aprovado),     s: 'de ' + fmtK(g.orcado) + ' orcados',               c: cGreen   },
        { l: 'Receita Perdida',      v: fmtK(g.perdido),      s: g.vencidos + ' vencidos',                           c: cRed     },
        { l: 'Ticket Medio',         v: fmtK(ticketMedio),    s: 'por aprovacao',                                    c: cYellow  },
        { l: goalPct !== null ? 'Meta Atingida' : 'Recuperavel',
          v: goalPct !== null ? goalPct + '%' : fmtK(g.perdido * .3),
          s: goalPct !== null ? fmtK(g.aprovado) + ' de ' + fmtK(goalAtivo) : 'estimativa 30% follow-up',
          c: goalPct !== null ? (goalPct >= 100 ? cGreen : goalPct >= 75 ? cYellow : cRed) : cOrange },
        { l: 'Cancelamentos',        v: String(g.cancelados), s: fmtK(g.canceladoVal) + ' em valor',                 c: cOrange  },
      ];
      const kw = (W - mg * 2 - 8) / 3;
      kpis.forEach(({ l, v, s, c }, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = mg + col * (kw + 4), ky = y + row * 22;
        doc.setFillColor(...cSurf);
        doc.roundedRect(x, ky, kw, 20, 2, 2, 'F');
        doc.setFillColor(...c);
        doc.rect(x, ky, kw, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...cMuted);
        doc.text(clean(l).toUpperCase(), x + 3, ky + 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...c);
        doc.text(clean(v), x + 3, ky + 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...cMuted);
        doc.text(clean(s), x + 3, ky + 18);
      });
      y += 50;

      if (goalAtivo > 0 && goalPct !== null) {
        y = secTitle('Resumo de Metas', y);
        doc.setFillColor(...cSurf);
        doc.roundedRect(mg, y, W - mg * 2, 24, 2, 2, 'F');
        const gc = goalPct >= 100 ? cGreen : goalPct >= 75 ? cYellow : cRed;
        doc.setFillColor(...gc);
        doc.rect(mg, y, W - mg * 2, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...gc);
        doc.text('Meta: ' + clean(fmtK(goalAtivo)) + '   |   Realizado: ' + clean(fmtK(g.aprovado)) + '   |   ' + goalPct + '% atingido', mg + 4, y + 7);
        progressBar(mg + 4, y + 10, W - mg * 2 - 8, 4, goalPct, gc);
        const gapVal = goalAtivo - g.aprovado;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...cMuted);
        doc.text(gapVal > 0 ? 'Faltam ' + clean(fmtK(gapVal)) + ' para atingir a meta.' : 'Meta superada em ' + clean(fmtK(Math.abs(gapVal))) + '!', mg + 4, y + 19);
        y += 28;
      }

      if (M.scoreParts && M.scoreParts.length) {
        y = secTitle('Detalhamento do Score de Saude', y);
        M.scoreParts.forEach(p => {
          const pctv = p.max > 0 ? Math.round(p.pts / p.max * 100) : 0;
          const pc = pctv >= 75 ? cGreen : pctv >= 45 ? cYellow : cRed;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...cText);
          doc.text(clean(p.label), mg, y + 3);
          doc.setTextColor(...pc);
          doc.text(p.pts.toFixed(1) + '/' + p.max, W - mg, y + 3, { align: 'right' });
          progressBar(mg, y + 5, W - mg * 2, 2.5, pctv, pc);
          y += 8;
        });
        y += 2;
      }

      addFooter(pagNum, totalPags);

      // ══════════════════════════════════════
      // PÁGINA 2 — VENDEDORES
      // ══════════════════════════════════════
      doc.addPage(); pagNum++; pageBg();
      y = 14;

      y = secTitle('Comparativo com Periodo Anterior', y);
      if (prev_) {
        // ── Se ambos os anos tiverem faturamento real, usa faturamento real ──
        let recAtualComp = g.aprovado;
        let recAntComp   = prevReceitaAdj;

        if (anoAtivo !== null && mesesDoAno.length > 0) {
          const fatRealAtivo = mesesDoAno.reduce((acc, m) => {
            const fat = getFatReal(m.key);
            return fat !== null ? acc + fat : acc + m.geral.aprovado;
          }, 0);
          if (temFatAtivo) recAtualComp = fatRealAtivo;
        }

        if (usaFatRealAmbos && anoAnterior !== null && mesesAnoAnterior.length > 0) {
          const mesesAtivosIdx = mesesDoAno.map(m => +m.mes);
          const mesesAntEquiv  = mesesAnoAnterior.filter(m => mesesAtivosIdx.includes(+m.mes));
          if (mesesAntEquiv.length > 0) {
            const fatRealAnt = mesesAntEquiv.reduce((acc, m) => {
              const fat = getFatReal(m.key);
              return fat !== null ? acc + fat : acc + m.geral.aprovado;
            }, 0);
            recAntComp = fatRealAnt;
          }
        }

        const diffRec  = recAtualComp - recAntComp;
        const diffTaxa = +(g.taxa - prevTaxaAdj).toFixed(1);
        const fonteComp = usaFatRealAmbos ? ' | faturamento real (caixa)' : '';
        const notaPeriodo = anoAtivo !== null && mesesAnoAnterior.length > 0
          ? ' (mesmo periodo: ' + mesesDoAno.length + ' meses)'
          : '';

        doc.setFillColor(...cSurf);
        doc.roundedRect(mg, y, W - mg * 2, 18, 2, 2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...cText);
        const recTxt  = 'Receita: ' + clean(fmtK(recAntComp)) + ' -> ' + clean(fmtK(recAtualComp)) +
                        '  (' + (diffRec >= 0 ? '+' : '') + clean(fmtK(diffRec)) + ')';
        const taxaTxt = '   |   Conversao: ' + prevTaxaAdj + '% -> ' + g.taxa + '%  (' + (diffTaxa >= 0 ? '+' : '') + diffTaxa + '%)';
        doc.text(recTxt + taxaTxt, mg + 4, y + 8);
        if (notaPeriodo) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(...cMuted);
          doc.text(
            clean('Comparativo limitado ao mesmo periodo: ' + anoAnterior + ' vs ' + anoAtivo + notaPeriodo + fonteComp),
            mg + 4, y + 14
          );
        }
        y += notaPeriodo ? 22 : 18;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...cMuted);
        doc.text('Comparativo nao disponivel - carregue mais de um periodo.', mg, y + 4);
        y += 12;
      }

      y = secTitle('Performance por ' + clean(vLabel), y);
      const sortedD = [...M.dentistas].sort((a, b) => b.valor_aprovado - a.valor_aprovado);
      const thD = ['#', clean(vLabel), 'Orcamentos', 'Conversao', 'Faturado', 'Ticket', 'Tempo', 'Cancel.', 'Perdido'];
      const cwD = [8, 34, 20, 20, 26, 20, 16, 16, 22];
      let xd = mg;
      doc.setFillColor(...cSurf2);
      doc.roundedRect(mg, y, W - mg * 2, 8, 1, 1, 'F');
      thD.forEach((h, i) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...cAccent);
        doc.text(h, xd + 1, y + 5); xd += cwD[i];
      });
      y += 10;
      sortedD.forEach((d, ri) => {
        if (y > 270) { addFooter(pagNum, totalPags); doc.addPage(); pagNum++; pageBg(); y = 14; }
        if (ri % 2 === 0) { doc.setFillColor(...cSurf); doc.roundedRect(mg, y - 1, W - mg * 2, 8, 1, 1, 'F'); }
        const cols = [
          String(ri + 1), clean(d.nome), String(d.total), d.taxa + '%',
          clean(fmtK(d.valor_aprovado)), clean(fmtK(d.ticket_medio)),
          d.tempo_medio + 'd', String(d.cancelados), clean(fmtK(d.valor_perdido))
        ];
        const tcs = [cMuted, cText, cMuted,
          d.taxa >= (_benchmarks.conversaoIdeal || 75) ? cGreen : d.taxa >= (_benchmarks.conversaoCritica || 60) ? cYellow : cRed,
          cGreen, cText, cMuted, cOrange, cRed];
        xd = mg;
        cols.forEach((col, i) => {
          doc.setFont('helvetica', i === 1 ? 'bold' : 'normal');
          doc.setFontSize(6.5); doc.setTextColor(...tcs[i]);
          doc.text(col, xd + 1, y + 5); xd += cwD[i];
        });
        y += 8;
      });
      y += 4;

      y = secTitle('Faturamento por ' + clean(vLabel), y);
      const maxFB = Math.max(...sortedD.map(d => d.valor_aprovado), 1);
      sortedD.slice(0, 8).forEach(d => {
        if (y > 272) return;
        const bw = (d.valor_aprovado / maxFB) * (W - mg * 2 - 50);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...cText);
        doc.text(clean(d.nome), mg, y + 4);
        doc.setFillColor(...cSurf2);
        doc.roundedRect(mg + 40, y, W - mg * 2 - 50, 5, 1, 1, 'F');
        doc.setFillColor(...cAccent);
        doc.roundedRect(mg + 40, y, Math.max(bw, 1), 5, 1, 1, 'F');
        doc.setTextColor(...cGreen); doc.setFontSize(6.5);
        doc.text(clean(fmtK(d.valor_aprovado)), W - mg - 2, y + 4, { align: 'right' });
        y += 8;
      });

      addFooter(pagNum, totalPags);

      // ══════════════════════════════════════
      // PÁGINA 3 — CANAIS
      // ══════════════════════════════════════
      doc.addPage(); pagNum++; pageBg();
      y = 14;
      y = secTitle('Canais de Marketing', y);
      const sortedC = [...M.canais].sort((a, b) => b.valor - a.valor);
      const thC = ['Canal', 'Total', 'Aprovados', 'Conversao', 'Receita', 'Ticket Medio'];
      const cwC = [36, 18, 22, 22, 36, 28];
      let xc = mg;
      doc.setFillColor(...cSurf2);
      doc.roundedRect(mg, y, W - mg * 2, 8, 1, 1, 'F');
      thC.forEach((h, i) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...cAccent);
        doc.text(h, xc + 1, y + 5); xc += cwC[i];
      });
      y += 10;
      sortedC.forEach((c, ri) => {
        if (ri % 2 === 0) { doc.setFillColor(...cSurf); doc.roundedRect(mg, y - 1, W - mg * 2, 8, 1, 1, 'F'); }
        const colsC = [clean(canalDisplay(c.canal)), String(c.total), String(c.aprovados), c.taxa + '%', clean(fmtK(c.valor)), clean(fmtK(c.ticket))];
        const tcsC = [cText, cMuted, cMuted,
          taxaColor(c.taxa) === 'var(--green)' ? cGreen : taxaColor(c.taxa) === 'var(--yellow)' ? cYellow : cRed,
          cGreen, cText];
        xc = mg;
        colsC.forEach((col, i) => {
          doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
          doc.setFontSize(6.5); doc.setTextColor(...tcsC[i]);
          doc.text(col, xc + 1, y + 5); xc += cwC[i];
        });
        y += 8;
      });
      y += 6;

      y = secTitle('Conversao e Receita por Canal', y);
      const maxCV = Math.max(...sortedC.map(c => c.valor), 1);
      sortedC.forEach(c => {
        if (y > 265) return;
        const bw = (c.valor / maxCV) * (W - mg * 2 - 60);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...cText);
        doc.text(clean(canalDisplay(c.canal)), mg, y + 4);
        doc.setTextColor(...cAccent);
        doc.text(c.taxa + '%', mg + 38, y + 4);
        doc.setFillColor(...cSurf2);
        doc.roundedRect(mg + 50, y, W - mg * 2 - 60, 5, 1, 1, 'F');
        doc.setFillColor(79, 156, 249);
        doc.roundedRect(mg + 50, y, Math.max(bw, 1), 5, 1, 1, 'F');
        doc.setTextColor(...cGreen); doc.setFontSize(6.5);
        doc.text(clean(fmtK(c.valor)), W - mg - 2, y + 4, { align: 'right' });
        y += 8;
      });

      addFooter(pagNum, totalPags);

      // ══════════════════════════════════════
      // PÁGINA 4 — VENCIDOS + INSIGHTS
      // ══════════════════════════════════════
      doc.addPage(); pagNum++; pageBg();
      y = 14;

      const topVenc = M.topVencidos.slice(0, 8);
      if (topVenc.length > 0) {
        y = secTitle(pLabelP + ' Vencidos — Prioridade de Follow-up', y);
        const thV = [clean(cLabel), clean(vLabel), 'Canal', 'Valor', 'Emissao', 'Dias'];
        const cwV = [46, 32, 26, 26, 22, 14];
        let xv = mg;
        doc.setFillColor(...cSurf2);
        doc.roundedRect(mg, y, W - mg * 2, 8, 1, 1, 'F');
        thV.forEach((h, i) => {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...cAccent);
          doc.text(h, xv + 1, y + 5); xv += cwV[i];
        });
        y += 10;
        topVenc.forEach((v, ri) => {
          if (ri % 2 === 0) { doc.setFillColor(...cSurf); doc.roundedRect(mg, y - 1, W - mg * 2, 8, 1, 1, 'F'); }
          const dias = v.emissao ? Math.floor((Date.now() - v.emissao.getTime()) / 86400000) : null;
          const colsV = [
            clean(v.paciente || '—').substring(0, 24),
            clean(v.dentista || '—').substring(0, 18),
            clean(canalDisplay(v.campanha || '')),
            clean(fmtK(v.total)),
            v.emissao ? v.emissao.toLocaleDateString('pt-BR') : '—',
            dias !== null ? String(dias) : '—'
          ];
          xv = mg;
          colsV.forEach((col, i) => {
            doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(i === 3 ? cRed[0] : cText[0], i === 3 ? cRed[1] : cText[1], i === 3 ? cRed[2] : cText[2]);
            doc.text(col, xv + 1, y + 5); xv += cwV[i];
          });
          y += 8;
        });
        y += 6;
      }

      y = secTitle('Insights e Alertas Automaticos', y);
      const ins = generateInsights(M);
      ins.sort((a, b) => ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[a.t] || 9) - ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[b.t] || 9));
      const insColorMap = { a: cRed, o: cOrange, w: cYellow, i: cAccent, g: cGreen };
      ins.forEach(i => {
        if (y > 265) return;
        const ic = insColorMap[i.t] || cAccent;
        doc.setFillColor(...cSurf);
        doc.roundedRect(mg, y, W - mg * 2, 16, 2, 2, 'F');
        doc.setFillColor(...ic);
        doc.rect(mg, y, 2, 16, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...ic);
        doc.text(clean(i.l), mg + 5, y + 6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...cText);
        doc.text(clean(i.txt), mg + 5, y + 11);
        doc.setTextColor(...cMuted); doc.setFontSize(6.5);
        doc.text(clean(i.sub), mg + 5, y + 15);
        y += 19;
      });

      addFooter(pagNum, totalPags);

      // ══════════════════════════════════════
      // PÁGINA 5 — AÇÕES
      // ══════════════════════════════════════
      doc.addPage(); pagNum++; pageBg();
      y = 14;
      y = secTitle('Plano de Acao — Proximos Passos', y);

      const prevAjustado = prev_ ? {
        ...prev_,
        geral: {
          ...prev_.geral,
          aprovado:   prevReceitaAdj,
          taxa:       prevTaxaAdj,
          perdido:    prevPerdidoAdj,
          cancelados: prevCanceladosAdj,
        }
      } : null;

      const acoes = getAcoesList(M, prevAjustado);
      const priC = { ph: cRed, pm: cYellow, pl: cGreen };
      const priL = { ph: 'URGENTE', pm: 'ESTA SEMANA', pl: 'ESTE MES' };
      acoes.forEach((a, i) => {
        if (y > 265) return;
        const pc = priC[a.p] || cAccent;
        doc.setFillColor(...cSurf);
        doc.roundedRect(mg, y, W - mg * 2, 20, 2, 2, 'F');
        doc.setFillColor(...pc);
        doc.rect(mg, y, 2, 20, 'F');
        doc.setFillColor(...pc);
        doc.roundedRect(W - mg - 30, y + 3, 30, 7, 1, 1, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...cDark);
        doc.text(priL[a.p] || '', W - mg - 15, y + 8, { align: 'center' });
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...cText);
        doc.text((i + 1) + '. ' + clean(a.t), mg + 5, y + 8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...cMuted);
        const dLines = doc.splitTextToSize(clean(a.d), W - mg * 2 - 40);
        doc.text(dLines[0] || '', mg + 5, y + 14);
        y += 23;
      });

      addFooter(pagNum, totalPags);

      // ══════════════════════════════════════
      // PÁGINA 6 — ANÁLISE FINANCEIRA
      // ══════════════════════════════════════
      if (hasFin) {
        doc.addPage(); pagNum++; pageBg();
        y = 14;

        const anoAtivoFin = M.ano || (activeYear !== null ? +activeYear : null);
        const chavesMeses = anoAtivoFin
          ? getMesesFinanceirosPorAno(anoAtivoFin)
          : (M.key && !M.isYear && !M.isRange ? [M.key] : []);

        // ── Decide se usa faturamento real ──
        // Usa faturamento real SE o ano ativo tiver planilha de faturamento
        const temFatRealPag6 = chavesMeses.some(k => getFatReal(k) !== null);
        const fonteLabel = temFatRealPag6 ? 'faturamento real (caixa)' : 'orcamentos aprovados';

        let fatTotalFin = 0, despTotalFin = 0;
        const mesesFinData = chavesMeses.map(k => {
          const mfin = getFinMesDataComReceita(k);
          if (!mfin || mfin._semDados) return null;
          // Substitui receita pelo faturamento real se disponível
          const fatRealK = getFatReal(k);
          const receitaFinal = temFatRealPag6 && fatRealK !== null ? fatRealK : mfin.geral.aprovado;
          fatTotalFin  += receitaFinal;
          despTotalFin += mfin.geral.despesas;
          return { ...mfin, geral: { ...mfin.geral, aprovado: receitaFinal } };
        }).filter(Boolean);

        const lucroTotalFin  = fatTotalFin - despTotalFin;
        const margemTotalFin = fatTotalFin > 0 ? +((lucroTotalFin / fatTotalFin) * 100).toFixed(1) : 0;
        const ratioFin       = fatTotalFin > 0 ? +((despTotalFin / fatTotalFin) * 100).toFixed(1) : 0;
        const marColorFin    = margemTotalFin >= (_benchmarks.margemIdeal || 20) ? cGreen
          : margemTotalFin >= (_benchmarks.margemBaixa || 10) ? cYellow
          : margemTotalFin >= 0 ? cOrange : cRed;
        const marLabelFin    = margemTotalFin >= (_benchmarks.margemIdeal || 20) ? 'excelente'
          : margemTotalFin >= (_benchmarks.margemBaixa || 10) ? 'saudavel'
          : margemTotalFin >= 0 ? 'baixa' : 'negativa';

        y = secTitle('Analise Financeira | ' + clean(M.periodo), y);

        doc.setFillColor(...cSurf2);
        doc.roundedRect(mg, y, W - mg * 2, 9, 1, 1, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...cMuted);
        doc.text('Receita baseada em: ', mg + 3, y + 6);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...cAccent);
        doc.text(fonteLabel, mg + 38, y + 6);
        y += 13;

        const kfin = [
          { l: 'Receita Total',   v: fmtK(fatTotalFin),    s: fonteLabel,                                              c: cGreen },
          { l: 'Despesas Totais', v: fmtK(despTotalFin),   s: ratioFin + '% da receita',                               c: cRed   },
          { l: 'Lucro Liquido',   v: fmtK(lucroTotalFin),  s: lucroTotalFin >= 0 ? 'resultado positivo' : 'prejuizo',  c: lucroTotalFin >= 0 ? cGreen : cRed },
          { l: 'Margem Liquida',  v: margemTotalFin + '%', s: marLabelFin,                                             c: marColorFin },
        ];
        const kfw = (W - mg * 2 - 6) / 4;
        kfin.forEach(({ l, v, s, c }, i) => {
          const x = mg + i * (kfw + 2);
          doc.setFillColor(...cSurf);
          doc.roundedRect(x, y, kfw, 20, 2, 2, 'F');
          doc.setFillColor(...c);
          doc.rect(x, y, kfw, 1.5, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...cMuted);
          doc.text(clean(l).toUpperCase(), x + 2, y + 6);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...c);
          doc.text(clean(v), x + 2, y + 13);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...cMuted);
          doc.text(clean(s), x + 2, y + 18);
        });
        y += 24;

        y = secTitle('Receita vs Despesas vs Lucro', y);
        const maxBarFin = Math.max(fatTotalFin, despTotalFin, Math.abs(lucroTotalFin), 1);
        const barItems = [
          { l: 'Receita',       v: fatTotalFin,   c: cGreen },
          { l: 'Despesas',      v: despTotalFin,  c: cRed   },
          { l: 'Lucro Liquido', v: lucroTotalFin, c: lucroTotalFin >= 0 ? [79, 156, 249] : cOrange },
        ];
        barItems.forEach(b => {
          const bw = (Math.abs(b.v) / maxBarFin) * (W - mg * 2 - 50);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...cText);
          doc.text(clean(b.l), mg, y + 4);
          doc.setFillColor(...cSurf2);
          doc.roundedRect(mg + 36, y, W - mg * 2 - 46, 5, 1, 1, 'F');
          doc.setFillColor(...b.c);
          doc.roundedRect(mg + 36, y, Math.max(bw, 1), 5, 1, 1, 'F');
          doc.setTextColor(...b.c); doc.setFontSize(6.5);
          doc.text(clean(fmtK(b.v)), W - mg - 2, y + 4, { align: 'right' });
          y += 8;
        });
        y += 4;

        if (mesesFinData.length > 0) {
          y = secTitle('Evolucao Financeira por Mes', y);
          const thFin = ['Mes', 'Receita', 'Despesas', 'Lucro', 'Margem'];
          const cwFin = [46, 34, 34, 34, 24];
          let xf = mg;
          doc.setFillColor(...cSurf2);
          doc.roundedRect(mg, y, W - mg * 2, 8, 1, 1, 'F');
          thFin.forEach((h, i) => {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...cAccent);
            doc.text(h, xf + 1, y + 5); xf += cwFin[i];
          });
          y += 10;
          mesesFinData.forEach((mf, ri) => {
            if (y > 270) return;
            const fat  = mf.geral.aprovado;
            const desp = mf.geral.despesas;
            const luc  = fat - desp;
            const mar  = fat > 0 ? +((luc / fat) * 100).toFixed(1) : 0;
            const mc2  = mar >= (_benchmarks.margemIdeal || 20) ? cGreen
              : mar >= (_benchmarks.margemBaixa || 10) ? cYellow
              : mar >= 0 ? cOrange : cRed;
            if (ri % 2 === 0) { doc.setFillColor(...cSurf); doc.roundedRect(mg, y - 1, W - mg * 2, 8, 1, 1, 'F'); }
            const rowCols   = [clean(mf.periodo), clean(fmtK(fat)), clean(fmtK(desp)), clean(fmtK(luc)), mar + '%'];
            const rowColors = [cText, cGreen, cRed, luc >= 0 ? cGreen : cRed, mc2];
            xf = mg;
            rowCols.forEach((col, i) => {
              doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
              doc.setFontSize(6.5); doc.setTextColor(...rowColors[i]);
              doc.text(col, xf + 1, y + 5); xf += cwFin[i];
            });
            y += 8;
          });
          y += 6;
        }

        const insFinPDF = generateFinancialInsights(mesesFinData);
        insFinPDF.sort((a, b) => ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[a.t] || 9) - ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[b.t] || 9));
        if (insFinPDF.length > 0 && y < 260) {
          y = secTitle('Analise Financeira Automatica', y);
          insFinPDF.slice(0, 4).forEach(i => {
            if (y > 268) return;
            const ic = insColorMap[i.t] || cAccent;
            doc.setFillColor(...cSurf);
            doc.roundedRect(mg, y, W - mg * 2, 16, 2, 2, 'F');
            doc.setFillColor(...ic);
            doc.rect(mg, y, 2, 16, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...ic);
            doc.text(clean(i.l), mg + 5, y + 6);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...cText);
            doc.text(clean(i.txt), mg + 5, y + 11);
            doc.setTextColor(...cMuted); doc.setFontSize(6.5);
            doc.text(clean(i.sub), mg + 5, y + 15);
            y += 19;
          });
        }

        doc.setFillColor(...cSurf);
        doc.roundedRect(mg, y + 4, W - mg * 2, 18, 2, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...cAccent);
        doc.text('Metrik — Dashboard Comercial', W / 2, y + 13, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...cMuted);
        doc.text('Relatorio gerado automaticamente. Os dados refletem o periodo: ' + clean(M.periodo), W / 2, y + 18, { align: 'center' });
        doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR') + ' — Confidencial', W / 2, y + 22, { align: 'center' });

        addFooter(pagNum, totalPags);
      }

      const nomeArq = (CFG.empresa || 'Metrik').replace(/[^a-zA-Z0-9]/g, '_');
      const periodoArq = M.periodo.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save('Metrik_' + nomeArq + '_' + periodoArq + '.pdf');
      overlay.classList.remove('show');
      showToast('PDF exportado com ' + pagNum + ' paginas.');
    } catch (err) {
      overlay.classList.remove('show');
      showToast('Erro ao gerar PDF: ' + err.message, true);
      console.error(err);
    }
  }, 100);
}

// ═══════════════════════════════════════
//  EXPORT PPTX
// ═══════════════════════════════════════
function exportPPTX() {
  const overlay = document.getElementById('exportOverlay');
  document.getElementById('exportMsg').textContent = 'Gerando apresentacao PPTX...';
  overlay.classList.add('show');
  setTimeout(() => {
    let _pptxWatchdog = null;
    try {
      const PptxCtor = typeof PptxGenJS !== 'undefined' ? PptxGenJS : (typeof pptxgen !== 'undefined' ? pptxgen : null);
      if (!PptxCtor) { overlay.classList.remove('show'); alert('Biblioteca PPTX nao carregou.'); return; }
      const pptx = new PptxCtor();
      pptx.layout = 'LAYOUT_16x9';

      // Watchdog: se a geração travar, libera o overlay em vez de ficar carregando pra sempre.
      _pptxWatchdog = setTimeout(() => {
        overlay.classList.remove('show');
        showToast('A geracao do PPTX demorou demais e foi interrompida. Tente novamente.', true);
      }, 60000);

      const M = getActiveData();
      const g = M.geral;
      const prev_ = getPrev();
      const nomeEmpresa = CFG.empresa || 'Dashboard Comercial';
      const vLabel = CFG.vendedor || 'Vendedor';
      const vLabelP = pluralizar(vLabel);
      const cLabel = CFG.cliente || 'Cliente';
      const cLabelP = pluralizar(cLabel);
      const pLabel = CFG.proposta || 'Orcamento';
      const pLabelP = pluralizar(pLabel);
      const temDespesas = M.geral.hasDespesas;

      const BG = '0A0D14', SURF = '10131a', SURF2 = '161a22', SURF3 = '1E2640';
      const ACCENT = '5b8def', GREEN = '46c08a', RED = 'e2705c', YELLOW = 'd7a33f', ORANGE = 'e0915a';
      const MUTED = '565e6d', MUTED2 = '878f9e', TEXT = 'e7eaf0', WHITE = 'FFFFFF';

      // ── Determina o ano ativo ──
      const anoAtivo = activeYear !== null ? +activeYear
                     : (activeMonth >= 0 && MONTHS[activeMonth] ? +MONTHS[activeMonth].ano || null : null);

      const mesesDoAno = anoAtivo !== null
        ? MONTHS.filter(m => +m.ano === anoAtivo)
        : MONTHS;

      const anoAnterior = anoAtivo !== null ? anoAtivo - 1 : null;
      const mesesAnoAnterior = anoAnterior !== null
        ? MONTHS.filter(m => +m.ano === anoAnterior)
        : [];

      // ── Helper: faturamento real de um mês pela chave ──
      const getFatReal = key => {
        if (!key) return null;
        const fat = parsedFaturamento[key];
        if (fat === undefined || fat === null) return null;
        return typeof fat === 'object' ? (fat.total || fat.valor || 0) : +fat;
      };

      // ── Verifica disponibilidade de faturamento real ──
      const chavesMesesAtivo    = mesesDoAno.map(m => m.key).filter(Boolean);
      const chavesMesesAnterior = mesesAnoAnterior.map(m => m.key).filter(Boolean);
      const temFatAtivo    = chavesMesesAtivo.some(k => getFatReal(k) !== null);
      const temFatAnterior = chavesMesesAnterior.length === 0 || chavesMesesAnterior.some(k => getFatReal(k) !== null);
      // usaFatRealAmbos = true só se AMBOS os anos tiverem faturamento real
      // (usado nos slides de comparativo entre anos)
      const usaFatRealAmbos = temFatAtivo && temFatAnterior && mesesAnoAnterior.length > 0;

      // ── Helper: receita de um mês (faturamento real se disponível, senão aprovado) ──
      const getRecMes = (m, usaFat) => {
        if (!usaFat) return m.geral.aprovado;
        const fat = getFatReal(m.key);
        return fat !== null ? fat : m.geral.aprovado;
      };

      const se = s => {
        if (!s) return '';
        return String(s)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\x20-\x7E]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const convHex = t => t >= (_benchmarks.conversaoIdeal || 75) ? GREEN : t >= (_benchmarks.conversaoCritica || 60) ? YELLOW : RED;

      const makeSlide = (title, sub) => {
        const s = pptx.addSlide();
        s.background = { color: BG };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: .08, fill: { color: ACCENT } });
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 5.42, w: '100%', h: .08, fill: { color: SURF2 } });
        s.addText(se(nomeEmpresa) + ' | ' + se(M.periodo), {
          x: .2, y: 5.45, w: 5, h: .12, fontSize: 7, color: MUTED, fontFace: 'Calibri'
        });
        s.addText('Gerado em ' + new Date().toLocaleDateString('pt-BR'), {
          x: 5, y: 5.45, w: 4.8, h: .12, fontSize: 7, color: MUTED, fontFace: 'Calibri', align: 'right'
        });
        if (title) {
          s.addText(se(title), {
            x: .3, y: .15, w: 9.4, h: .45, fontSize: 22, bold: true, color: TEXT, fontFace: 'Calibri'
          });
        }
        if (sub) {
          s.addText(se(sub), {
            x: .3, y: .62, w: 9.4, h: .22, fontSize: 11, color: MUTED2, italic: true, fontFace: 'Calibri'
          });
        }
        return s;
      };

      const addKpiCard = (s, x, y, w, h, label, value, sub, hexColor) => {
        s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: SURF }, line: { color: hexColor, pt: 1 }, rectRadius: .05 });
        s.addShape(pptx.ShapeType.rect, { x, y, w, h: .06, fill: { color: hexColor } });
        s.addText(se(label), { x, y: y + .1, w, h: .22, fontSize: 9, bold: true, color: MUTED, fontFace: 'Calibri', align: 'center' });
        s.addText(se(value), { x, y: y + .35, w, h: .55, fontSize: 22, bold: true, color: hexColor, fontFace: 'Calibri', align: 'center' });
        if (sub) s.addText(se(sub), { x, y: y + .9, w, h: .2, fontSize: 8, color: MUTED2, fontFace: 'Calibri', align: 'center' });
      };

      // ════════════════════
      //  SLIDE 1 — CAPA
      // ════════════════════
      {
        const s = pptx.addSlide();
        s.background = { color: BG };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: .08, fill: { color: ACCENT } });
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 5.42, w: '100%', h: .08, fill: { color: SURF2 } });
        s.addShape(pptx.ShapeType.roundRect, {
          x: 1.2, y: .7, w: 7.6, h: 4.4,
          fill: { color: SURF },
          line: { color: SURF, pt: 0, transparency: 100 },
          rectRadius: .1
        });
        s.addText(se(nomeEmpresa), {
          x: 1.4, y: 1.0, w: 7.2, h: .6,
          fontSize: 22, color: ACCENT, bold: true, fontFace: 'Calibri', align: 'center'
        });
        s.addText('Dashboard Comercial', {
          x: 1.4, y: 1.65, w: 7.2, h: .7,
          fontSize: 32, bold: true, color: TEXT, fontFace: 'Calibri', align: 'center'
        });
        s.addText(se(M.periodo), {
          x: 1.4, y: 2.4, w: 7.2, h: .45,
          fontSize: 22, bold: true, color: ACCENT, fontFace: 'Calibri', align: 'center'
        });
        s.addText('Relatorio de Performance Comercial', {
          x: 1.4, y: 2.9, w: 7.2, h: .28,
          fontSize: 12, color: MUTED2, italic: true, fontFace: 'Calibri', align: 'center'
        });
        const sc = M.score >= 80 ? GREEN : M.score >= 65 ? YELLOW : RED;
        s.addShape(pptx.ShapeType.roundRect, {
          x: 3.9, y: 3.35, w: 2.2, h: 1.0,
          fill: { color: SURF2 }, line: { color: sc, pt: 2 }, rectRadius: .06
        });
        s.addText('Score de Saude', { x: 3.9, y: 3.42, w: 2.2, h: .22, fontSize: 9, color: MUTED, fontFace: 'Calibri', align: 'center' });
        s.addText(M.score + '/100', { x: 3.9, y: 3.65, w: 2.2, h: .4, fontSize: 20, bold: true, color: sc, fontFace: 'Calibri', align: 'center' });
        const sl = M.score >= 80 ? 'Saudavel' : M.score >= 65 ? 'Atencao' : M.score >= 50 ? 'Regular' : 'Critico';
        s.addText(sl, { x: 3.9, y: 4.07, w: 2.2, h: .2, fontSize: 10, bold: true, color: sc, fontFace: 'Calibri', align: 'center' });
        s.addText('Gerado em ' + new Date().toLocaleDateString('pt-BR'), {
          x: 1.4, y: 4.95, w: 7.2, h: .22, fontSize: 9, color: MUTED, fontFace: 'Calibri', align: 'center'
        });
      }

      // ════════════════════
      //  SLIDE 2 — DIAGNÓSTICO EXECUTIVO
      // ════════════════════
      {
        const s = makeSlide('Diagnostico Executivo', 'Resumo do periodo e principais pontos de atencao');
        const topDent = [...M.dentistas].sort((a, b)=> b.valor_aprovado - a.valor_aprovado)[0];
const piorDent = [...M.dentistas].filter(d => d.total >= 5).sort((a, b) => a.taxa - b.taxa)[0];
const totalVencVal = M.topVencidos.reduce((s2, v) => s2 + v.total, 0);
const goalAtivo = getGoalForActivePeriod();
const goalPct = goalAtivo > 0 ? +(g.aprovado / goalAtivo * 100).toFixed(1) : null;
const resumoTxt = 'Receita aprovada: ' + se(fmtK(g.aprovado)) +
  '   |   Taxa de conversao: ' + g.taxa + '%' +
  '   |   Score de saude: ' + M.score + '/100';
s.addText(resumoTxt, { x: .3, y: .88, w: 9.4, h: .38, fontSize: 13, bold: true, color: TEXT, fontFace: 'Calibri' });
s.addShape(pptx.ShapeType.rect, { x: .3, y: 1.3, w: 9.4, h: .02, fill: { color: SURF2 } });
const bullets = [];
if (topDent) bullets.push({ icon: '\u2B50', txt: 'Melhor ' + se(vLabel) + ': ' + se(topDent.nome) + ' — ' + se(fmtK(topDent.valor_aprovado)) + ' faturados', color: YELLOW });
if (piorDent && piorDent.taxa < (_benchmarks.conversaoCritica || 60)) {
  bullets.push({ icon: '\u26A0', txt: 'Atencao: ' + se(piorDent.nome) + ' com apenas ' + piorDent.taxa + '% de conversao', color: YELLOW });
} else if (piorDent) {
  bullets.push({ icon: '\u26A0', txt: se(vLabel) + ' com menor conversao: ' + se(piorDent.nome) + ' (' + piorDent.taxa + '%)', color: MUTED2 });
}
if (totalVencVal > 0) bullets.push({ icon: '\uD83D\uDCB8', txt: se(fmtK(totalVencVal)) + ' em orcamentos vencidos — potencial de +' + se(fmtK(totalVencVal * .3)) + ' via follow-up', color: GREEN });
if (g.cancelados > 0) bullets.push({ icon: '\uD83D\uDD34', txt: g.cancelados + ' ' + se(pLabel.toLowerCase()) + (g.cancelados > 1 ? 's' : '') + ' cancelado' + (g.cancelados > 1 ? 's' : '') + ' no periodo', color: RED });
if (goalAtivo > 0 && goalPct !== null) {
  const metaBatida = goalPct >= 100;
  const corMeta = metaBatida ? GREEN : goalPct >= 75 ? YELLOW : RED;
  const iconeMeta = metaBatida ? '\u2705' : '\uD83C\uDFAF';
  const txMeta = metaBatida
    ? 'Meta batida! ' + goalPct + '% atingido (' + se(fmtK(g.aprovado)) + ' de ' + se(fmtK(goalAtivo)) + ')'
    : 'Meta: ' + goalPct + '% atingido — faltam ' + se(fmtK(goalAtivo - g.aprovado)) + ' para bater a meta';
  bullets.push({ icon: iconeMeta, txt: txMeta, color: corMeta });
}
if (g.taxa >= (_benchmarks.conversaoIdeal || 75)) bullets.push({ icon: '\u2705', txt: 'Taxa de conversao acima da meta (' + (_benchmarks.conversaoIdeal || 75) + '%) — desempenho excelente', color: GREEN });
bullets.slice(0, 5).forEach((b, i) => {
  s.addText(b.icon + '  ' + b.txt, { x: .3, y: 1.42 + i * .62, w: 9.4, h: .52, fontSize: 13, color: b.color, fontFace: 'Calibri', bold: false });
});
}

// ════════════════════
//  SLIDE 3 — KPIs
// ════════════════════
{
const s = makeSlide('KPIs — ' + se(M.periodo), 'Indicadores-chave do periodo');
const ticketMedio = g.aprovados > 0 ? g.aprovado / g.aprovados : 0;
const goalAtivo = getGoalForActivePeriod();
const goalPct = goalAtivo > 0 ? Math.min(+(g.aprovado / goalAtivo * 100).toFixed(1), 999) : null;
const kpis = [
  { l: 'Taxa de Conversao', v: g.taxa + '%', s: g.aprovados + '/' + g.total + ' orcamentos', c: ACCENT },
  { l: 'Receita Faturada', v: se(fmtK(g.aprovado)), s: 'de ' + se(fmtK(g.orcado)), c: GREEN },
  { l: 'Receita Perdida', v: se(fmtK(g.perdido)), s: g.vencidos + ' vencidos', c: RED },
  { l: 'Ticket Medio', v: se(fmtK(ticketMedio)), s: 'por aprovacao', c: YELLOW },
  { l: goalPct !== null ? 'Meta Atingida' : 'Recuperavel', v: goalPct !== null ? goalPct + '%' : se(fmtK(g.perdido * .3)), s: goalPct !== null ? se(fmtK(g.aprovado)) + ' de ' + se(fmtK(goalAtivo)) : 'estimativa follow-up', c: goalPct !== null ? (goalPct >= 100 ? GREEN : goalPct >= 75 ? YELLOW : RED) : ORANGE },
  { l: 'Score de Saude', v: M.score + '/100', s: M.score >= 80 ? 'Saudavel' : M.score >= 65 ? 'Atencao' : 'Critico', c: M.score >= 80 ? GREEN : M.score >= 65 ? YELLOW : RED },
];
kpis.forEach((k, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  addKpiCard(s, .25 + col * 3.27, 1.0 + row * 2.18, 3.1, 1.9, k.l, k.v, k.s, k.c);
});
}

// ════════════════════
//  SLIDE — DETALHAMENTO DO SCORE
// ════════════════════
if (M.scoreParts && M.scoreParts.length) {
  const s = makeSlide('Detalhamento do Score de Saude', 'Como o score ' + M.score + '/100 e composto');
  M.scoreParts.forEach((p, i) => {
    const rowY = 1.05 + i * .52;
    const pctv = p.max > 0 ? Math.round(p.pts / p.max * 100) : 0;
    const pc = pctv >= 75 ? GREEN : pctv >= 45 ? YELLOW : RED;
    s.addText(se(p.label), { x: .4, y: rowY, w: 4.4, h: .32, fontSize: 12, color: TEXT, fontFace: 'Calibri' });
    s.addText(p.pts.toFixed(1) + '/' + p.max, { x: 4.85, y: rowY, w: 1.25, h: .32, fontSize: 12, bold: true, color: pc, fontFace: 'Calibri', align: 'right' });
    s.addShape(pptx.ShapeType.roundRect, { x: 6.3, y: rowY + .07, w: 3.3, h: .18, fill: { color: SURF2 }, line: { type: 'none' }, rectRadius: .03 });
    if (pctv > 0) s.addShape(pptx.ShapeType.roundRect, { x: 6.3, y: rowY + .07, w: Math.max(3.3 * pctv / 100, .05), h: .18, fill: { color: pc }, line: { type: 'none' }, rectRadius: .03 });
  });
}

// ════════════════════
//  SLIDE 4 — GRÁFICO PERFORMANCE VENDEDORES
// ════════════════════
{
const s = makeSlide('Performance por ' + se(vLabelP), 'Faturamento e conversao por ' + se(vLabel).toLowerCase());
const dentSorted = [...M.dentistas].sort((a, b) => b.valor_aprovado - a.valor_aprovado).slice(0, 8);
const chartData = [{ name: 'Faturamento', labels: dentSorted.map(d => se(d.nome)), values: dentSorted.map(d => +d.valor_aprovado.toFixed(0)) }];
try {
  s.addChart(pptx.ChartType.bar, chartData, {
    x: .25, y: .9, w: 5.5, h: 4.3, barDir: 'bar', barGrouping: 'clustered',
    chartColors: [ACCENT], showValue: true, dataLabelFontSize: 9, dataLabelColor: TEXT,
    dataLabelFormatCode: '"R$"#,##0', catAxisLabelColor: TEXT, catAxisLabelFontSize: 9,
    valAxisLabelColor: MUTED, valAxisLabelFontSize: 8, valAxisLineShow: false,
    plotAreaBkgndColor: SURF, chartAreaBkgndColor: BG, legendPos: 'n', showLegend: false,
    border: { pt: 0 }, valAxisFormatCode: '"R$"#,##0', valGridLine: { style: 'none' },
  });
} catch (e) { console.warn('Chart falhou', e); }
s.addText('Conversao por ' + se(vLabel), { x: 6.0, y: .88, w: 3.7, h: .28, fontSize: 10, bold: true, color: ACCENT, fontFace: 'Calibri' });
dentSorted.forEach((d, i) => {
  const y = 1.22 + i * .46;
  if (y > 5.2) return;
  const cor = convHex(d.taxa);
  s.addShape(pptx.ShapeType.roundRect, { x: 6.0, y, w: 3.7, h: .38, fill: { color: SURF }, line: { color: cor, pt: .8 }, rectRadius: .03 });
  s.addText(se(d.nome).substring(0, 18), { x: 6.08, y: y + .06, w: 2.0, h: .26, fontSize: 9, color: TEXT, fontFace: 'Calibri' });
  s.addText(d.taxa + '%', { x: 8.0, y: y + .06, w: 1.6, h: .26, fontSize: 11, bold: true, color: cor, fontFace: 'Calibri', align: 'right' });
});
}

// ════════════════════
//  SLIDE 5 — TABELA DETALHADA VENDEDORES
// ════════════════════
{
const s = makeSlide('Ranking — ' + se(vLabelP), 'Detalhamento completo por ' + se(vLabel).toLowerCase());
const dentSorted = [...M.dentistas].sort((a, b) => b.valor_aprovado - a.valor_aprovado).slice(0, 9);
const rows = dentSorted.map((d, i) => {
  const tc = convHex(d.taxa);
  return [
    { text: String(i + 1), options: { color: MUTED2, fontFace: 'Calibri', fontSize: 9 } },
    { text: se(d.nome), options: { bold: true, color: TEXT, fontFace: 'Calibri', fontSize: 9 } },
    { text: String(d.total), options: { color: MUTED2, fontFace: 'Calibri', align: 'center', fontSize: 9 } },
    { text: d.taxa + '%', options: { bold: true, color: tc, fontFace: 'Calibri', align: 'center', fontSize: 9 } },
    { text: se(fmtK(d.valor_aprovado)), options: { bold: true, color: GREEN, fontFace: 'Calibri', fontSize: 9 } },
    { text: se(fmtK(d.ticket_medio)), options: { color: TEXT, fontFace: 'Calibri', fontSize: 9 } },
    { text: d.tempo_medio + 'd', options: { color: d.tempo_medio > 5 ? YELLOW : MUTED2, fontFace: 'Calibri', align: 'center', fontSize: 9 } },
    { text: String(d.cancelados), options: { color: d.cancelados > 2 ? ORANGE : MUTED2, fontFace: 'Calibri', align: 'center', fontSize: 9 } },
    { text: se(fmtK(d.valor_perdido)), options: { color: RED, fontFace: 'Calibri', fontSize: 9 } },
  ];
});
s.addTable([
  [
    { text: '#', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: 9 } },
    { text: se(vLabel), options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: 9 } },
    { text: 'Orcam.', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', align: 'center', fontSize: 9 } },
    { text: 'Conv.', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', align: 'center', fontSize: 9 } },
    { text: 'Faturado', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: 9 } },
    { text: 'Ticket', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: 9 } },
    { text: 'Tempo', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', align: 'center', fontSize: 9 } },
    { text: 'Canc.', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', align: 'center', fontSize: 9 } },
    { text: 'Perdido', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: 9 } },
  ],
  ...rows
], {
  x: .2, y: .88, w: 9.6, colW: [.35, 1.75, .85, .85, 1.55, 1.35, .85, .75, 1.3],
  border: { type: 'none' }, fill: { color: SURF }, fontFace: 'Calibri', fontSize: 9, rowH: .38, autoPage: false,
});
}

// ════════════════════
//  SLIDE 6 — CANAIS
// ════════════════════
{
const s = makeSlide('Canais de Marketing', 'Taxa de conversao e receita por canal');
const canaisSorted = [...M.canais].sort((a, b) => b.valor - a.valor).slice(0, 7);
const pieData = [{ name: 'Receita', labels: canaisSorted.map(c => se(canalDisplay(c.canal))), values: canaisSorted.map(c => +c.valor.toFixed(0)) }];
const PIE_COLORS = ['5b8def', '46c08a', 'd7a33f', 'e2705c', '7c5cf0', 'e0915a', '38BDF8'];
try {
  s.addChart(pptx.ChartType.pie, pieData, {
    x: .25, y: .88, w: 4.6, h: 4.4, chartColors: PIE_COLORS, showValue: false, showPercent: true,
    dataLabelFontSize: 10, dataLabelColor: TEXT, legendPos: 'b', legendColor: MUTED2, legendFontSize: 9,
    showLegend: true, plotAreaBkgndColor: BG, chartAreaBkgndColor: BG, border: { pt: 0 }, holeSize: 0,
  });
} catch (e) { console.warn('Pie chart falhou', e); }
s.addText('Conversao por Canal', { x: 5.1, y: .88, w: 4.7, h: .28, fontSize: 11, bold: true, color: ACCENT, fontFace: 'Calibri' });
canaisSorted.forEach((c, i) => {
  const y = 1.22 + i * .54;
  if (y > 5.1) return;
  const cor = convHex(c.taxa);
  const nom = se(canalDisplay(c.canal));
  s.addText(nom.substring(0, 14), { x: 5.1, y: y + .04, w: 1.8, h: .3, fontSize: 9, color: MUTED2, fontFace: 'Calibri' });
  const bx = 6.95, bw = 1.9;
  s.addShape(pptx.ShapeType.roundRect, { x: bx, y: y + .06, w: bw, h: .24, fill: { color: SURF2 }, rectRadius: .03 });
  s.addShape(pptx.ShapeType.roundRect, { x: bx, y: y + .06, w: Math.max(c.taxa / 100 * bw, .02), h: .24, fill: { color: cor }, rectRadius: .03 });
  s.addText(c.taxa + '%', { x: 8.92, y: y + .04, w: .9, h: .3, fontSize: 10, bold: true, color: cor, fontFace: 'Calibri', align: 'right' });
  s.addText(se(fmtK(c.valor)), { x: 5.1, y: y + .3, w: 4.7, h: .18, fontSize: 8, color: MUTED, fontFace: 'Calibri' });
});
}

// ════════════════════
//  SLIDE 7 — EVOLUÇÃO MENSAL
//  Usa faturamento real se o ano ativo tiver planilha
// ════════════════════
if (mesesDoAno.length >= 2) {
const s = makeSlide('Evolucao Mensal', 'Comparativo de receita e conversao ao longo dos meses');
const fonteSlide7 = temFatAtivo ? 'faturamento real' : 'orcamentos aprovados';
const valoresSlide7 = mesesDoAno.map(m => {
  const fat = getFatReal(m.key);
  return temFatAtivo && fat !== null ? +fat.toFixed(0) : +m.geral.aprovado.toFixed(0);
});
const chartData = [{
  name: 'Receita',
  labels: mesesDoAno.map(m => se(m.periodo)),
  values: valoresSlide7,
}];
try {
  s.addChart(pptx.ChartType.bar, chartData, {
    x: .25, y: .88, w: 9.5, h: 3.8, barDir: 'col', barGrouping: 'clustered',
    chartColors: [ACCENT], showValue: true, dataLabelFontSize: 9, dataLabelColor: TEXT,
    dataLabelFormatCode: '[>=10000]#,##0,"k";[<=-10000]-#,##0,"k";0',
    catAxisLabelColor: MUTED2, catAxisLabelFontSize: 8, valAxisLabelColor: MUTED, valAxisLabelFontSize: 8,
    valAxisLineShow: false, plotAreaBkgndColor: SURF, chartAreaBkgndColor: BG,
    legendPos: 'n', showLegend: false, border: { pt: 0 },
    valAxisFormatCode: '[>=10000]#,##0,"k";[<=-10000]-#,##0,"k";0',
    valGridLine: { color: SURF2, pt: .5 },
  });
} catch (e) { console.warn('Bar chart evolucao falhou', e); }
const colW = 9.5 / mesesDoAno.length;
mesesDoAno.forEach((m, i) => {
  const x = .25 + i * colW;
  const cor = convHex(m.geral.taxa);
  s.addText(m.geral.taxa + '% conv.', {
    x, y: 4.74, w: colW, h: .28, fontSize: 8, bold: true, color: cor, fontFace: 'Calibri', align: 'center'
  });
});
// Nota da fonte
s.addText('Fonte: ' + fonteSlide7, {
  x: .25, y: 5.22, w: 9.5, h: .15, fontSize: 7, color: MUTED, fontFace: 'Calibri', italic: true
});
}

      // ════════════════════
      //  SLIDE 8 — COMPARATIVO ANUAL
      //  Receita: usa faturamento real se AMBOS os anos tiverem planilha
      // ════════════════════
      if (prev_) {
        const s = makeSlide('Comparativo — ' + se(M.periodo) + ' vs ' + se(prev_.periodo), 'Evolucao periodo a periodo');
        const ticketMedio = g.aprovados > 0 ? g.aprovado / g.aprovados : 0;
        const ticketPrev  = prev_.geral.aprovados > 0 ? prev_.geral.aprovado / prev_.geral.aprovados : 0;

        // ── Receita atual: faturamento real se disponível, senão aprovado ──
        let recAtual = g.aprovado;
        if (temFatAtivo) {
          const fatRealAtivo = mesesDoAno.reduce((acc, m) => {
            const fat = getFatReal(m.key);
            return fat !== null ? acc + fat : acc + m.geral.aprovado;
          }, 0);
          recAtual = fatRealAtivo;
        }

        // ── Valores do período anterior ──
        let prevReceita    = prev_.geral.aprovado;
        let prevPerdido    = prev_.geral.perdido;
        let prevTaxa       = prev_.geral.taxa;
        let prevTicket     = ticketPrev;
        let prevCancelados = prev_.geral.cancelados;

        if (anoAtivo !== null && mesesAnoAnterior.length > 0) {
          const mesesAtivosIdx = mesesDoAno.map(m => +m.mes);
          const mesesAntEquiv  = mesesAnoAnterior.filter(m => mesesAtivosIdx.includes(+m.mes));
          if (mesesAntEquiv.length > 0) {
            // Receita anterior: faturamento real se ambos tiverem, senão aprovado
            prevReceita = usaFatRealAmbos
              ? mesesAntEquiv.reduce((acc, m) => {
                  const fat = getFatReal(m.key);
                  return fat !== null ? acc + fat : acc + m.geral.aprovado;
                }, 0)
              : mesesAntEquiv.reduce((a, m) => a + m.geral.aprovado, 0);

            prevPerdido    = mesesAntEquiv.reduce((a, m) => a + m.geral.perdido,    0);
            prevCancelados = mesesAntEquiv.reduce((a, m) => a + m.geral.cancelados, 0);
            const totAnt   = mesesAntEquiv.reduce((a, m) => a + m.geral.total,      0);
            const aprvAnt  = mesesAntEquiv.reduce((a, m) => a + m.geral.aprovados,  0);
            prevTaxa       = totAnt  > 0 ? +(aprvAnt / totAnt * 100).toFixed(1) : 0;
            prevTicket     = aprvAnt > 0 ? prevReceita / aprvAnt : 0;
          }
        }

        const compItens = [
          { l: 'Receita',       curr: se(fmtK(recAtual)),     prev: se(fmtK(prevReceita)),   diff: recAtual - prevReceita,        base: prevReceita    },
          { l: 'Conversao',     curr: g.taxa + '%',            prev: prevTaxa + '%',          diff: g.taxa - prevTaxa,             base: prevTaxa       },
          { l: 'Ticket Medio',  curr: se(fmtK(ticketMedio)),  prev: se(fmtK(prevTicket)),    diff: ticketMedio - prevTicket,      base: prevTicket     },
          { l: 'Perdido',       curr: se(fmtK(g.perdido)),    prev: se(fmtK(prevPerdido)),   diff: g.perdido - prevPerdido,       base: prevPerdido,   inv: true },
          { l: 'Score',         curr: M.score + '/100',        prev: prev_.score + '/100',    diff: M.score - prev_.score,         base: prev_.score    },
          { l: 'Cancelamentos', curr: String(g.cancelados),   prev: String(prevCancelados),  diff: g.cancelados - prevCancelados, base: prevCancelados, inv: true },
        ];

        compItens.forEach((ci, i) => {
          const col = i % 3, row = Math.floor(i / 3);
          const x = .25 + col * 3.27, y = 1.0 + row * 2.2;
          const pctD = ci.base !== 0 ? (Math.abs(ci.diff) / Math.abs(ci.base) * 100) : 0;
          const up   = ci.inv ? ci.diff < 0 : ci.diff > 0;
          const cor  = Math.abs(ci.diff) < 0.01 ? MUTED : up ? GREEN : RED;
          s.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.1, h: 2.0, fill: { color: SURF }, line: { color: cor, pt: 1 }, rectRadius: .05 });
          s.addShape(pptx.ShapeType.rect,      { x, y, w: 3.1, h: .06, fill: { color: cor } });
          s.addText(se(ci.l),    { x, y: y + .12, w: 3.1, h: .26, fontSize: 9,  bold: true, color: MUTED,  fontFace: 'Calibri', align: 'center' });
          s.addText(se(ci.curr), { x, y: y + .42, w: 3.1, h: .58, fontSize: 22, bold: true, color: cor,    fontFace: 'Calibri', align: 'center' });
          s.addText('antes: ' + se(ci.prev), { x, y: y + 1.05, w: 3.1, h: .26, fontSize: 9, color: MUTED2, fontFace: 'Calibri', align: 'center' });
          const arrow = Math.abs(pctD) < 0.5 ? '= igual' : (up ? '+ ' : '- ') + pctD.toFixed(1) + '%';
          s.addText(arrow, { x, y: y + 1.35, w: 3.1, h: .35, fontSize: 13, bold: true, color: cor, fontFace: 'Calibri', align: 'center' });
        });

        // Nota de fonte no rodapé do slide
        const fonteSlide8 = usaFatRealAmbos ? 'Receita: faturamento real (caixa)' : 'Receita: orcamentos aprovados';
        s.addText(fonteSlide8, {
          x: .25, y: 5.22, w: 9.5, h: .15, fontSize: 7, color: MUTED, fontFace: 'Calibri', italic: true
        });
      }

// ════════════════════
//  SLIDES 9A, 9B, 9C — FINANCEIRO
//  Usa faturamento real se ambos os anos tiverem planilha
// ════════════════════
if (temDespesas) {
const mesesFin = mesesDoAno.filter(m => m.geral.hasDespesas || parsedExpenses[m.key]);

// ── Receita de cada mês: faturamento real se temFatAtivo, senão aprovado ──
const fatFin  = mesesFin.reduce((a, m) => {
  const fat = getFatReal(m.key);
  return a + (temFatAtivo && fat !== null ? fat : m.geral.aprovado);
}, 0) || g.aprovado;
const despFin  = mesesFin.reduce((a, m) => a + m.geral.despesas, 0) || g.despesas;
const lucroFin = fatFin - despFin;
const margemFin = fatFin > 0 ? +((lucroFin / fatFin) * 100).toFixed(1) : 0;
const ratioFin  = fatFin > 0 ? +((despFin / fatFin) * 100).toFixed(1) : 0;
const marColor  = margemFin >= (_benchmarks.margemIdeal || 20) ? GREEN
                : margemFin >= (_benchmarks.margemBaixa || 10) ? YELLOW
                : margemFin >= 0 ? ORANGE : RED;
const fonteLabel9 = temFatAtivo ? 'faturamento real (caixa)' : 'orcamentos aprovados';

// ── SLIDE 9A — KPIs + GRÁFICO ──
{
  const s = makeSlide('Analise Financeira — ' + se(M.periodo), 'Receita, despesas, lucro e margem liquida');
  const kpiCards = [
    { l: 'Receita Total',   v: se(fmtK(fatFin)),   s: fonteLabel9,                                                                                          c: GREEN   },
    { l: 'Despesas Totais', v: se(fmtK(despFin)),  s: ratioFin + '% da receita',                                                                            c: RED     },
    { l: 'Lucro Liquido',   v: se(fmtK(lucroFin)), s: lucroFin >= 0 ? 'resultado positivo' : 'resultado negativo',                                          c: lucroFin >= 0 ? GREEN : RED },
    { l: 'Margem Liquida',  v: margemFin + '%',    s: margemFin >= 20 ? 'excelente' : margemFin >= 10 ? 'saudavel' : margemFin >= 0 ? 'baixa' : 'negativa', c: marColor },
  ];
  kpiCards.forEach((k, i) => {
    const x = .25 + i * 2.42;
    s.addShape(pptx.ShapeType.roundRect, { x, y: .85, w: 2.3, h: 1.1, fill: { color: SURF }, line: { color: k.c, pt: 1 }, rectRadius: .05 });
    s.addShape(pptx.ShapeType.rect,      { x, y: .85, w: 2.3, h: .05, fill: { color: k.c } });
    s.addText(se(k.l), { x, y: .92,  w: 2.3, h: .2,  fontSize: 8,   bold: true, color: MUTED,  fontFace: 'Calibri', align: 'center' });
    s.addText(se(k.v), { x, y: 1.14, w: 2.3, h: .42, fontSize: 17,  bold: true, color: k.c,    fontFace: 'Calibri', align: 'center' });
    s.addText(se(k.s), { x, y: 1.58, w: 2.3, h: .18, fontSize: 7.5,             color: MUTED2, fontFace: 'Calibri', align: 'center' });
  });
  if (mesesFin.length > 0) {
    const barData = [
      { name: 'Receita',  labels: mesesFin.map(m => se(m.periodo)), values: mesesFin.map(m => {
        const fat = getFatReal(m.key);
        return +(temFatAtivo && fat !== null ? fat : m.geral.aprovado).toFixed(0);
      })},
      { name: 'Despesas', labels: mesesFin.map(m => se(m.periodo)), values: mesesFin.map(m => +m.geral.despesas.toFixed(0)) },
      { name: 'Lucro',    labels: mesesFin.map(m => se(m.periodo)), values: mesesFin.map(m => {
        const fat = getFatReal(m.key);
        const rec = temFatAtivo && fat !== null ? fat : m.geral.aprovado;
        return +(rec - m.geral.despesas).toFixed(0);
      })},
    ];
    try {
      s.addChart(pptx.ChartType.bar, barData, {
        x: .25, y: 2.05, w: 9.5, h: 3.0, barDir: 'col', barGrouping: 'clustered',
        chartColors: [GREEN, RED, ACCENT], showValue: true, dataLabelFontSize: 7, dataLabelColor: TEXT,
        dataLabelFormatCode: '[>=10000]#,##0,"k";[<=-10000]-#,##0,"k";0',
        catAxisLabelColor: MUTED2, catAxisLabelFontSize: 7, valAxisLabelColor: MUTED, valAxisLabelFontSize: 7,
        valAxisLineShow: false, valAxisFormatCode: '[>=10000]#,##0,"k";[<=-10000]-#,##0,"k";0',
        plotAreaBkgndColor: SURF, chartAreaBkgndColor: BG, legendPos: 'b', legendColor: MUTED2,
        legendFontSize: 8, showLegend: true, border: { pt: 0 }, valGridLine: { color: SURF2, pt: .5 },
      });
    } catch (e) { console.warn('Bar chart financeiro falhou', e); }
  }
  s.addText('Fonte: ' + fonteLabel9, {
    x: .25, y: 5.22, w: 9.5, h: .15, fontSize: 7, color: MUTED, fontFace: 'Calibri', italic: true
  });
}

// ── SLIDE 9B — RESUMO MENSAL ──
{
  const s = makeSlide('Resumo Mensal Financeiro — ' + se(M.periodo), 'Detalhamento mes a mes: receita, despesas, lucro e margem');
  const mesesFinComFat = mesesFin.map(m => {
    const fat = getFatReal(m.key);
    const rec = temFatAtivo && fat !== null ? fat : m.geral.aprovado;
    return { ...m, geral: { ...m.geral, aprovado: rec } };
  });
  const insFinanceiros = generateFinancialInsights(mesesFinComFat.length > 0 ? mesesFinComFat : [M]);
  if (insFinanceiros.length > 0) {
    const ins = insFinanceiros[0];
    const cor = ins.t === 'a' ? RED : ins.t === 'w' ? YELLOW : ins.t === 'g' ? GREEN : ACCENT;
    s.addShape(pptx.ShapeType.roundRect, { x: 6.6, y: .82, w: 3.1, h: 1.0, fill: { color: SURF }, line: { color: cor, pt: 1 }, rectRadius: .04 });
    s.addShape(pptx.ShapeType.rect,      { x: 6.6, y: .82, w: .06, h: 1.0, fill: { color: cor } });
    s.addText(se(ins.l),                     { x: 6.72, y: .88,  w: 2.9, h: .24, fontSize: 9, bold: true, color: cor,  fontFace: 'Calibri' });
    s.addText(se(ins.txt).substring(0, 100), { x: 6.72, y: 1.14, w: 2.9, h: .6,  fontSize: 8,            color: TEXT, fontFace: 'Calibri', wrap: true });
  }
  const rowH   = mesesFin.length <= 8 ? .38 : mesesFin.length <= 12 ? .32 : .27;
  const fszTab = mesesFin.length <= 8 ? 9  : mesesFin.length <= 12 ? 8  : 7;
  s.addTable([
    [
      { text: 'Mes',      options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: fszTab } },
      { text: 'Receita',  options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: fszTab } },
      { text: 'Despesas', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: fszTab } },
      { text: 'Lucro',    options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', fontSize: fszTab } },
      { text: 'Margem',   options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', align: 'center', fontSize: fszTab } },
    ],
    ...mesesFinComFat.map(m => {
      const ml = m.geral.aprovado - m.geral.despesas;
      const mm = m.geral.aprovado > 0 ? +((ml / m.geral.aprovado) * 100).toFixed(1) : 0;
      const mc = mm >= 20 ? GREEN : mm >= 10 ? YELLOW : mm >= 0 ? ORANGE : RED;
      return [
        { text: se(m.periodo),              options: { color: TEXT,                               fontFace: 'Calibri', fontSize: fszTab } },
        { text: se(fmtK(m.geral.aprovado)), options: { color: GREEN,    bold: true,               fontFace: 'Calibri', fontSize: fszTab } },
        { text: se(fmtK(m.geral.despesas)), options: { color: RED,      bold: true,               fontFace: 'Calibri', fontSize: fszTab } },
        { text: se(fmtK(ml)),               options: { color: ml >= 0 ? GREEN : RED, bold: true,  fontFace: 'Calibri', fontSize: fszTab } },
        { text: mm + '%',                   options: { color: mc,       bold: true,               fontFace: 'Calibri', align: 'center', fontSize: fszTab } },
      ];
    })
  ], {
    x: .25, y: .88, w: 6.2, colW: [1.9, 1.15, 1.15, 1.15, .85],
    border: { type: 'none' }, fill: { color: SURF }, fontFace: 'Calibri',
    fontSize: fszTab, rowH: rowH, autoPage: false,
  });
  s.addText('Fonte: ' + fonteLabel9, {
    x: .25, y: 5.22, w: 6.2, h: .15, fontSize: 7, color: MUTED, fontFace: 'Calibri', italic: true
  });
}

// ── SLIDE 9C — COMPARATIVO ANUAL FINANCEIRO ──
// Usa faturamento real apenas se AMBOS os anos tiverem planilha
if (anoAnterior !== null && mesesAnoAnterior.length > 0) {
  const mesesAtivosIdx = mesesFin.map(m => +m.mes);
  const mesesFinAnt = mesesAnoAnterior.filter(m =>
    (m.geral.hasDespesas || parsedExpenses[m.key]) && mesesAtivosIdx.includes(+m.mes)
  );

  if (mesesFinAnt.length > 0) {
    const fonteComp = usaFatRealAmbos ? 'faturamento real (caixa)' : 'orcamentos aprovados';
    const s = makeSlide(
      'Comparativo Financeiro — ' + anoAtivo + ' vs ' + anoAnterior,
      'Receita, despesas e lucro: mesmo periodo dos dois anos | Fonte: ' + fonteComp
    );

    // Totais do ano atual (com faturamento real se disponível para ambos)
    const fatFinComp  = mesesFin.reduce((a, m) => {
      const fat = getFatReal(m.key);
      return a + (usaFatRealAmbos && fat !== null ? fat : m.geral.aprovado);
    }, 0);
    const despFinComp = mesesFin.reduce((a, m) => a + m.geral.despesas, 0);
    const lucroFinComp = fatFinComp - despFinComp;
    const margemFinComp = fatFinComp > 0 ? +((lucroFinComp / fatFinComp) * 100).toFixed(1) : 0;

    // Totais do ano anterior (com faturamento real se disponível para ambos)
    const fatAnt   = mesesFinAnt.reduce((a, m) => {
      const fat = getFatReal(m.key);
      return a + (usaFatRealAmbos && fat !== null ? fat : m.geral.aprovado);
    }, 0);
    const despAnt  = mesesFinAnt.reduce((a, m) => a + m.geral.despesas, 0);
    const lucroAnt  = fatAnt - despAnt;
    const margemAnt = fatAnt > 0 ? +((lucroAnt / fatAnt) * 100).toFixed(1) : 0;

    const varFat   = fatAnt   > 0 ? +(((fatFinComp   - fatAnt)   / fatAnt)   * 100).toFixed(1) : null;
    const varDesp  = despAnt  > 0 ? +(((despFinComp  - despAnt)  / despAnt)  * 100).toFixed(1) : null;
    const varLucro = lucroAnt !== 0 ? +(((lucroFinComp - lucroAnt) / Math.abs(lucroAnt)) * 100).toFixed(1) : null;
    const varMar   = (margemFinComp - margemAnt).toFixed(1);

    const cards = [
      { l: 'Receita',        vAtual: se(fmtK(fatFinComp)),    vAnt: se(fmtK(fatAnt)),    var: varFat,             inv: false          },
      { l: 'Despesas',       vAtual: se(fmtK(despFinComp)),   vAnt: se(fmtK(despAnt)),   var: varDesp,            inv: true           },
      { l: 'Lucro Liquido',  vAtual: se(fmtK(lucroFinComp)),  vAnt: se(fmtK(lucroAnt)),  var: varLucro,           inv: false          },
      { l: 'Margem Liquida', vAtual: margemFinComp + '%',     vAnt: margemAnt + '%',      var: parseFloat(varMar), inv: false, isMargem: true },
    ];
    cards.forEach((c, i) => {
      const x = .25 + i * 2.42;
      const up = c.inv ? (c.var !== null && c.var < 0) : (c.var !== null && c.var > 0);
      const cor = c.var === null || Math.abs(c.var) < 0.5 ? MUTED : up ? GREEN : RED;
      s.addShape(pptx.ShapeType.roundRect, { x, y: .85, w: 2.3, h: 1.3, fill: { color: SURF }, line: { color: cor, pt: 1 }, rectRadius: .05 });
      s.addShape(pptx.ShapeType.rect,      { x, y: .85, w: 2.3, h: .05, fill: { color: cor } });
      s.addText(se(c.l),      { x, y: .92,  w: 2.3, h: .2,  fontSize: 8,  bold: true, color: MUTED,  fontFace: 'Calibri', align: 'center' });
      s.addText(se(c.vAtual), { x, y: 1.14, w: 2.3, h: .38, fontSize: 15, bold: true, color: cor,    fontFace: 'Calibri', align: 'center' });
      s.addText('antes: ' + se(c.vAnt), { x, y: 1.54, w: 2.3, h: .2, fontSize: 8, color: MUTED2, fontFace: 'Calibri', align: 'center' });
      const varTxt = c.var === null ? '—'
        : c.isMargem ? (parseFloat(varMar) >= 0 ? '+' : '') + varMar + 'pp'
        : (Math.abs(c.var) < 0.5 ? '= igual' : (up ? '+ ' : '- ') + Math.abs(c.var) + '%');
      s.addText(varTxt, { x, y: 1.76, w: 2.3, h: .28, fontSize: 12, bold: true, color: cor, fontFace: 'Calibri', align: 'center' });
    });

    const nomesMeses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesesLabel = mesesFin.map(m => nomesMeses[(+m.mes - 1)]);

    // Valores do gráfico com faturamento real se ambos tiverem
    const recAtual = mesesFin.map(m => {
      const fat = getFatReal(m.key);
      return +(usaFatRealAmbos && fat !== null ? fat : m.geral.aprovado).toFixed(0);
    });
    const recAnt = mesesFin.map(m => {
      const eq = mesesAnoAnterior.find(ma => +ma.mes === +m.mes);
      if (!eq) return 0;
      const fat = getFatReal(eq.key);
      return +(usaFatRealAmbos && fat !== null ? fat : eq.geral.aprovado).toFixed(0);
    });
    const lucAtual = mesesFin.map(m => {
      const fat = getFatReal(m.key);
      const rec = usaFatRealAmbos && fat !== null ? fat : m.geral.aprovado;
      return +(rec - m.geral.despesas).toFixed(0);
    });
    const lucAnt = mesesFin.map(m => {
      const eq = mesesAnoAnterior.find(ma => +ma.mes === +m.mes);
      if (!eq) return 0;
      const fat = getFatReal(eq.key);
      const rec = usaFatRealAmbos && fat !== null ? fat : eq.geral.aprovado;
      return +(rec - eq.geral.despesas).toFixed(0);
    });

    const barDataComp = [
      { name: 'Receita ' + anoAtivo,    labels: mesesLabel, values: recAtual },
      { name: 'Receita ' + anoAnterior, labels: mesesLabel, values: recAnt   },
      { name: 'Lucro '  + anoAtivo,     labels: mesesLabel, values: lucAtual },
      { name: 'Lucro '  + anoAnterior,  labels: mesesLabel, values: lucAnt   },
    ];
    try {
      s.addChart(pptx.ChartType.bar, barDataComp, {
        x: .25, y: 2.3, w: 9.5, h: 2.9, barDir: 'col', barGrouping: 'clustered',
        chartColors: [GREEN, '1a6644', ACCENT, '1a3a6b'],
        showValue: true, dataLabelFontSize: 6, dataLabelColor: TEXT,
        dataLabelFormatCode: '[>=10000]#,##0,"k";[<=-10000]-#,##0,"k";0',
        catAxisLabelColor: MUTED2, catAxisLabelFontSize: 8,
        valAxisLabelColor: MUTED, valAxisLabelFontSize: 7, valAxisLineShow: false,
        valAxisFormatCode: '[>=10000]#,##0,"k";[<=-10000]-#,##0,"k";0',
        plotAreaBkgndColor: SURF, chartAreaBkgndColor: BG,
        legendPos: 'b', legendColor: MUTED2, legendFontSize: 8, showLegend: true,
        border: { pt: 0 }, valGridLine: { color: SURF2, pt: .5 },
      });
    } catch (e) { console.warn('Bar chart comparativo financeiro falhou', e); }

    const periodoNota = mesesLabel[0] + '–' + mesesLabel[mesesLabel.length - 1];
    s.addText(
      'Periodo: ' + periodoNota + ' (' + mesesFin.length + ' meses) | Fonte: ' + fonteComp,
      { x: .25, y: 5.22, w: 9.5, h: .18, fontSize: 7, color: MUTED, fontFace: 'Calibri', italic: true }
    );
  }
}
}

// ════════════════════
//  SLIDE 10 — OPORTUNIDADES A RECUPERAR
// ════════════════════
{
const s = makeSlide('Oportunidades a Recuperar', se(pLabelP) + ' vencidos — follow-up imediato');
const top = M.topVencidos.slice(0, 7);
const tv = top.reduce((a, v) => a + v.total, 0);
s.addText('Total em risco: ' + se(fmtK(tv)) + '   |   Recuperavel via follow-up (30%): ' + se(fmtK(tv * .3)), {
  x: .3, y: .88, w: 9.4, h: .28, fontSize: 11, color: YELLOW, bold: true, fontFace: 'Calibri'
});
if (top.length > 0) {
  s.addTable([
    [
      { text: se(cLabel),    options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri' } },
      { text: se(vLabel),    options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri' } },
      { text: 'Canal',       options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri' } },
      { text: 'Valor',       options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri' } },
      { text: 'Telefone',    options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri' } },
      { text: 'Dias Parado', options: { bold: true, color: ACCENT, fill: { color: SURF2 }, fontFace: 'Calibri', align: 'center' } },
    ],
    ...top.map(v => {
      const dias = v.emissao ? Math.floor((Date.now() - v.emissao.getTime()) / 86400000) : null;
      const corDias = dias === null ? MUTED : dias >= 60 ? RED : dias >= 30 ? YELLOW : MUTED2;
      return [
        { text: se(v.paciente || '—'),              options: { color: TEXT,   fontFace: 'Calibri' } },
        { text: se(v.dentista || '—'),              options: { color: MUTED2, fontFace: 'Calibri' } },
        { text: se(canalDisplay(v.campanha || '')), options: { color: MUTED2, fontFace: 'Calibri' } },
        { text: se(fmtK(v.total)),                  options: { color: RED, bold: true, fontFace: 'Calibri' } },
        { text: se(v.telefone || '—'),              options: { color: ACCENT, fontFace: 'Calibri' } },
        { text: dias !== null ? String(dias) + 'd' : '—', options: { color: corDias, bold: dias !== null && dias >= 30, fontFace: 'Calibri', align: 'center' } },
      ];
    })
  ], {
    x: .25, y: 1.22, w: 9.5, colW: [2.3, 1.5, 1.4, 1.5, 2.0, 1.0],
    border: { type: 'none' }, fill: { color: SURF }, fontFace: 'Calibri', fontSize: 10, rowH: .44, autoPage: false,
  });
} else {
  s.addText('Nenhum vencido encontrado neste periodo.', { x: .3, y: 1.5, w: 9.4, h: .4, fontSize: 13, color: MUTED, italic: true, fontFace: 'Calibri' });
}
}

// ════════════════════
//  SLIDE 11 — ALERTAS
// ════════════════════
{
const insights = generateInsights(M);
insights.sort((a, b) => ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[a.t] || 9) - ({ 'a': 0, 'o': 1, 'w': 2, 'i': 3, 'g': 4 }[b.t] || 9));
for (let ci = 0; ci < insights.length; ci += 6) {
  const chunk = insights.slice(ci, ci + 6);
  const s = makeSlide('Alertas & Analise Inteligente' + (ci > 0 ? ' (cont.)' : ''), 'Gerados automaticamente a partir dos dados');
  chunk.forEach((ins, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = .25 + col * 4.9, y = 1.0 + row * 1.55;
    const c = ins.t === 'a' ? RED : ins.t === 'w' ? YELLOW : ins.t === 'g' ? GREEN : ins.t === 'o' ? ORANGE : ACCENT;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 4.65, h: 1.42, fill: { color: SURF }, line: { color: c, pt: 1 }, rectRadius: .05 });
    s.addShape(pptx.ShapeType.rect, { x, y, w: .07, h: 1.42, fill: { color: c } });
    s.addText(se(ins.l), { x: x + .15, y: y + .12, w: 4.35, h: .3, fontSize: 10, bold: true, color: c, fontFace: 'Calibri' });
    s.addText(se(ins.txt), { x: x + .15, y: y + .46, w: 4.35, h: .55, fontSize: 9, color: TEXT, fontFace: 'Calibri', wrap: true });
    s.addText(se(ins.sub), { x: x + .15, y: y + 1.06, w: 4.35, h: .28, fontSize: 8, color: MUTED, italic: true, fontFace: 'Calibri', wrap: true });
  });
}
}

// ════════════════════
//  SLIDE 12 — AÇÕES
// ════════════════════
{
const s = makeSlide('Acoes Prioritarias', 'Priorize nessa ordem para maximizar resultado');
const prev2_ = (activeYear === null && activeMonth > 0) ? MONTHS[activeMonth - 1] : null;
getAcoesList(M, prev2_).slice(0, 7).forEach((a, i) => {
  const y = 1.02 + i * .64;
  if (y > 5.2) return;
  const c = a.p === 'ph' ? RED : a.p === 'pm' ? YELLOW : GREEN;
  const lbl = { ph: 'URGENTE', pm: 'ESTA SEMANA', pl: 'ESTE MES' };
  s.addShape(pptx.ShapeType.roundRect, { x: .25, y, w: 9.5, h: .58, fill: { color: SURF }, line: { color: c, pt: 1 }, rectRadius: .04 });
  s.addShape(pptx.ShapeType.rect, { x: .25, y, w: .07, h: .58, fill: { color: c } });
  s.addText(String(i + 1), { x: .32, y: y + .1, w: .38, h: .38, fontSize: 13, bold: true, color: c, fontFace: 'Calibri', align: 'center' });
  s.addText(se(a.t), { x: .78, y: y + .07, w: 7.0, h: .26, fontSize: 10, bold: true, color: TEXT, fontFace: 'Calibri' });
  s.addText(se(a.d).substring(0, 120) + (a.d.length > 120 ? '...' : ''), { x: .78, y: y + .34, w: 7.0, h: .2, fontSize: 8, color: MUTED, fontFace: 'Calibri' });
  s.addShape(pptx.ShapeType.roundRect, { x: 8.0, y: y + .12, w: 1.65, h: .3, fill: { color: c + '22' }, line: { color: c, pt: 1 }, rectRadius: .03 });
  s.addText(lbl[a.p], { x: 8.0, y: y + .12, w: 1.65, h: .3, fontSize: 8, bold: true, color: c, fontFace: 'Calibri', align: 'center', valign: 'middle' });
});
}

// ── SALVAR ──
const nomeArq = (CFG.empresa || 'Dashboard')
.normalize('NFD')
.replace(/[\u0300-\u036f]/g, '')
.replace(/[^a-zA-Z0-9_\-]/g, '_');
const periodoArq = M.periodo
.normalize('NFD')
.replace(/[\u0300-\u036f]/g, '')
.replace(/[^a-zA-Z0-9_\-]/g, '_');
const fileName = nomeArq + '_' + periodoArq + '.pptx';

pptx.write({ outputType: 'blob' }).then(blob => {
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = fileName;
document.body.appendChild(a); a.click();
setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
overlay.classList.remove('show');
showToast('Apresentacao gerada com sucesso!');
}).catch(e => {
console.error(e);
try {
  pptx.writeFile({ fileName })
    .then(() => overlay.classList.remove('show'))
    .catch(() => overlay.classList.remove('show'));
} catch (e2) {
  console.error(e2);
  overlay.classList.remove('show');
}
}).finally(() => clearTimeout(_pptxWatchdog));

} catch (e) {
clearTimeout(_pptxWatchdog);
console.error('Erro PPTX:', e);
overlay.classList.remove('show');
alert('Erro ao gerar apresentacao: ' + e.message);
}
}, 300);
}

// ═══════════════════════════════════════
//  PROCESSAR DADOS CARREGADOS DO BANCO
// ═══════════════════════════════════════
function processarDadosCarregados() {
  try {
    const chaves = Object.keys(parsedMonths).sort();
    if (chaves.length === 0) return;

    chaves.forEach(chave => {
      const m = parsedMonths[chave];
      const resultado = computeMonth(m);
      if (resultado) {
        const jaExiste = MONTHS.find(x => x.key === chave);
        if (!jaExiste) MONTHS.push(resultado);
      }
    });

    if (MONTHS.length === 0) return;

    buildYears();

    const anos = Object.keys(YEARS).map(Number).sort((a, b) => a - b);
    activeYear = String(anos[anos.length - 1]);
    activeMonth = MONTHS.length - 1;

    if (anos.length >= 2) {
      cmpItems = [
        { type: 'year', idx: String(anos[anos.length - 2]) },
        { type: 'year', idx: String(anos[anos.length - 1]) }
      ];
    } else {
      cmpItems = MONTHS.length >= 2
        ? [{ type: 'month', idx: MONTHS.length - 2 }, { type: 'month', idx: MONTHS.length - 1 }]
        : [];
    }

    loadLocalState();
    if (CFG.meta > 0 && clinicGoal === 0) clinicGoal = CFG.meta;

    // Mostra badge de dados carregados
    const slb = document.getElementById('sessionLoadedBadge');
    if (slb) {
      slb.style.display = 'flex';
      slb.textContent = `✅ ${MONTHS.length} ${MONTHS.length === 1 ? 'mês carregado' : 'meses carregados'} — ${_empresaAtiva ? _empresaAtiva.nome : ''}`;
    }

    // Mostra botão de análise
    const btnAnalyze = document.getElementById('btnAnalyze');
    if (btnAnalyze) btnAnalyze.style.display = 'inline-flex';

    // Mostra aba financeiro se tiver despesas
    const temDesp = Object.keys(parsedExpenses).length > 0;
    const temFat = Object.keys(parsedFaturamento).length > 0;
    if (temDesp || temFat) {
      const tfb = document.getElementById('tabFinBtn');
      if (tfb) tfb.style.display = 'inline-flex';
    }

    // Roda análise e mostra dashboard
    applyConfigToUI();
    render();

    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('uploadScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('tabCmpBtn').style.display = 'inline-flex';

    const hasFin = MONTHS.some(m => m.geral.hasDespesas) || temDesp;
    if (hasFin) _finView = 'year:' + anos[anos.length - 1];

    window.scrollTo(0, 0);

  } catch (err) {
    console.error('Erro ao processar dados carregados:', err);
    showToast('Erro ao processar dados salvos.', true);
  }
}

// ═══════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════
(async function init() {
  loadConfig();
  applyConfigToUI();

  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (session) {
      await inicializarEmpresas();
    }
  } catch (err) {
    console.error('Erro na inicialização:', err);
  }
})();
// ═══════════════════════════════════════
//  TEMA — re-renderiza gráficos ao trocar
// ═══════════════════════════════════════
window.addEventListener('themechange', () => {
  const dash = document.getElementById('dashboard');
  if (dash && dash.style.display !== 'none' && MONTHS.length) render();
});
