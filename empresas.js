// ═══════════════════════════════════════
//  EMPRESAS — UI e fluxo
// ═══════════════════════════════════════

let _empresaAtiva = null;
let _modoTeste = false;

const MONTHS_PT_EMP = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ── Inicializar ──
async function inicializarEmpresas() {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('uploadScreen').style.display = 'none';

  const wrap = document.getElementById('empresasWrap');
  wrap.style.display = 'flex';
  wrap.innerHTML = `
    <div style="color:#fff;font-size:14px;opacity:.6">Carregando...</div>
  `;

  const empresas = await dbListarEmpresas().catch(() => []);
  renderTelaEmpresas(empresas);
}

// ── Entrar em uma empresa ──
async function entrarEmpresa(empresa) {
  _empresaAtiva = empresa;
  _modoTeste = false;

  // Reseta parsed antes de carregar do banco
  parsedMonths = {};
  parsedExpenses = {};
  parsedFaturamento = {};
  MONTHS = [];
  YEARS = {};

  // Aplica config
  CFG.empresa = empresa.nome || '';
  CFG.vendedor = empresa.vendedor || 'Vendedor';
  CFG.cliente = empresa.cliente || 'Cliente';
  CFG.proposta = empresa.proposta || 'Orçamento';
  CFG.meta = empresa.meta || 0;
  if (CFG.meta > 0) clinicGoal = CFG.meta;

  // Mostra loading
  document.getElementById('loadingDadosWrap').style.display = 'flex';
  document.getElementById('empresasWrap').style.display = 'none';

  try {
    await dbCarregarTudo(empresa.id);
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    showToast('Erro ao carregar dados da empresa.', true);
  }

  document.getElementById('loadingDadosWrap').style.display = 'none';

  const temDados = Object.keys(parsedMonths).length > 0;

  if (temDados) {
    processarDadosCarregados();
  } else {
    // Vai para upload sem config-card
    document.getElementById('uploadScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';

    const configCard = document.getElementById('configCard');
    if (configCard) configCard.style.display = 'none';

    const metrikSub = document.getElementById('metrikSub');
    if (metrikSub) metrikSub.textContent = `📂 Subindo dados para: ${empresa.nome}`;
    const badge = document.getElementById('modotesteBadge');
    if (badge) badge.style.display = 'none';
    const mc = document.getElementById('monthChips');
    if (mc) mc.innerHTML = '';
    document.getElementById('btnAnalyze').style.display = 'none';

    applyConfigToUI();
  }
}

// ── Modo teste ──
function entrarModoTeste() {
  _empresaAtiva = null;
  _modoTeste = true;

  parsedMonths = {};
  parsedExpenses = {};
  parsedFaturamento = {};
  MONTHS = [];
  YEARS = {};

  CFG = { empresa: 'Teste', vendedor: 'Vendedor', cliente: 'Cliente', proposta: 'Orçamento', meta: 0 };

  document.getElementById('empresasWrap').style.display = 'none';
  document.getElementById('uploadScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';

  const configCard = document.getElementById('configCard');
  if (configCard) configCard.style.display = 'block';

  const metrikSub = document.getElementById('metrikSub');
  if (metrikSub) metrikSub.textContent = 'Modo teste — dados não serão salvos';
  const badge = document.getElementById('modotesteBadge');
  if (badge) badge.style.display = 'inline-flex';

  // Limpa chips visuais
  const mc = document.getElementById('monthChips');
  if (mc) mc.innerHTML = '';
  document.getElementById('btnAnalyze').style.display = 'none';
  document.getElementById('errBanner').style.display = 'none';
  document.getElementById('suspectBanner').style.display = 'none';

  applyConfigToUI();
  showToast('🧪 Modo teste ativado — dados não serão salvos na nuvem');
}

// ── Renderizar tela de empresas ──
// ── Calcula iniciais do nome da empresa pro selo ──
function getInitials(nome) {
  if (!nome) return '?';
  const palavras = nome.trim().split(/\s+/);
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

function renderTelaEmpresas(empresas) {
  const wrap = document.getElementById('empresasWrap');
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';

  const empresa = empresas.length > 0 ? empresas[0] : null;
  const divisor = `
    <div style="display:flex;align-items:center;gap:12px;margin:16px 0;font-size:10px;
      color:var(--muted);letter-spacing:1px;text-transform:uppercase">
      <div style="flex:1;height:1px;background:rgba(255,255,255,.06)"></div>ou<div style="flex:1;height:1px;background:rgba(255,255,255,.06)"></div>
    </div>`;
  const btnTeste = `
    <button onclick="entrarModoTeste()"
      style="width:100%;padding:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
      border-radius:11px;color:var(--muted2);font-size:13px;font-weight:600;cursor:pointer;transition:.2s;
      display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--fb)"
      onmouseover="this.style.borderColor='var(--accent2)';this.style.color='var(--text)'"
      onmouseout="this.style.borderColor='rgba(255,255,255,.1)';this.style.color='var(--muted2)'">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v4M15 3v4M5 21V8h14v13"/><path d="M9 12h6M9 16h6"/></svg>
      Testar sem salvar
    </button>`;

  wrap.innerHTML = `
    <div style="
      padding:1px;border-radius:21px;width:100%;max-width:480px;
      background:linear-gradient(135deg, rgba(79,156,249,.32), rgba(167,139,250,.14) 45%, rgba(255,255,255,.05) 100%);
      box-shadow:0 40px 100px -40px rgba(0,0,0,.7);
    ">
      <div style="background:var(--surface);border-radius:20px;padding:38px 36px">

        <div style="text-align:center;margin-bottom:28px">
          <div style="width:50px;height:50px;margin:0 auto 12px;border-radius:14px;
            background:linear-gradient(135deg, rgba(79,156,249,.18), rgba(167,139,250,.1));
            border:1px solid rgba(79,156,249,.3);display:flex;align-items:center;justify-content:center;color:var(--accent)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
          </div>
          <div style="font-size:22px;font-weight:800;color:var(--text);font-family:var(--fh)">Metrik</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">
            ${empresa ? 'Bem-vindo de volta' : 'Configure sua primeira empresa'}
          </div>
        </div>

        ${empresa ? `
          <div style="display:flex;align-items:center;gap:14px;background:var(--surface2);
            border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:18px 20px;margin-bottom:16px">
            <div style="width:44px;height:44px;border-radius:12px;flex-shrink:0;
              background:linear-gradient(135deg,var(--accent),var(--accent2));
              display:flex;align-items:center;justify-content:center;font-family:var(--fh);
              font-weight:800;color:#fff;font-size:16px">${getInitials(empresa.nome)}</div>
            <div style="flex:1;min-width:0">
              <div style="font-family:var(--fh);font-weight:700;font-size:15px;color:var(--text)">${empresa.nome}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">
                ${empresa.vendedor || 'Vendedor'} · ${empresa.cliente || 'Cliente'} ·
                Meta R$ ${(empresa.meta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button onclick="abrirEdicaoEmpresa('${empresa.id}')"
                style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.04);
                border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;
                color:var(--muted2);cursor:pointer;transition:.2s"
                onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                onmouseout="this.style.borderColor='rgba(255,255,255,.1)';this.style.color='var(--muted2)'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button onclick="confirmarDeletarEmpresa('${empresa.id}','${empresa.nome.replace(/'/g, "\\\'")}')"
                style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.04);
                border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;
                color:var(--muted2);cursor:pointer;transition:.2s"
                onmouseover="this.style.background='rgba(248,113,113,.1)';this.style.borderColor='rgba(248,113,113,.3)';this.style.color='var(--red)'"
                onmouseout="this.style.background='rgba(255,255,255,.04)';this.style.borderColor='rgba(255,255,255,.1)';this.style.color='var(--muted2)'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
              </button>
            </div>
          </div>

          <button onclick='entrarEmpresaById("${empresa.id}")'
            style="width:100%;padding:14px;background:var(--accent);border:none;border-radius:11px;
            color:#fff;font-family:var(--fh);font-size:14px;font-weight:700;cursor:pointer;transition:.2s;
            box-shadow:0 10px 24px -8px rgba(79,156,249,.4)"
            onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            Entrar →
          </button>

          ${divisor}${btnTeste}
        ` : `
          <div style="font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:1.5px;
            text-transform:uppercase;color:var(--muted);margin-bottom:12px;text-align:center">Pré-visualização</div>
          <div style="display:flex;align-items:center;gap:14px;background:transparent;
            border:1.5px dashed rgba(255,255,255,.14);border-radius:14px;padding:18px 20px;margin-bottom:16px">
            <div style="width:44px;height:44px;border-radius:12px;border:1.5px dashed var(--muted);
              display:flex;align-items:center;justify-content:center;color:var(--muted);flex-shrink:0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="11" height="18" rx="1"/><path d="M15 21v-6h4v6"/></svg>
            </div>
            <div>
              <div style="font-family:var(--fh);font-weight:700;font-size:14px;color:var(--muted2)">Sua empresa aparecerá aqui</div>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">Nome, vendedor, cliente e meta — você define ao criar</div>
            </div>
          </div>

          <p style="text-align:center;font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:20px">
            Leva menos de um minuto. Depois é só <b style="color:var(--accent2);font-weight:600">entrar</b> sempre que quiser ver seus indicadores.
          </p>

          <button onclick="abrirCriarEmpresa()"
            style="width:100%;padding:14px;background:var(--accent);border:none;border-radius:11px;
            color:#fff;font-family:var(--fh);font-size:14px;font-weight:700;cursor:pointer;transition:.2s;
            box-shadow:0 10px 24px -8px rgba(79,156,249,.4)"
            onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            + Criar empresa
          </button>

          ${divisor}${btnTeste}
        `}

      </div>
    </div>
  `;
}

// ── Entrar por ID (usado no botão inline) ──
async function entrarEmpresaById(id) {
  const empresas = await dbListarEmpresas().catch(() => []);
  const empresa = empresas.find(e => e.id === id);
  if (empresa) await entrarEmpresa(empresa);
}

// ── Abrir formulário de criação ──
function abrirCriarEmpresa() {
  const wrap = document.getElementById('empresasWrap');
  wrap.innerHTML = `
    <div style="
      padding:1px;border-radius:21px;width:100%;max-width:560px;
      background:linear-gradient(135deg, rgba(79,156,249,.32), rgba(167,139,250,.14) 45%, rgba(255,255,255,.05) 100%);
      box-shadow:0 40px 100px -40px rgba(0,0,0,.7);
    ">
      <div style="background:var(--surface);border-radius:20px;padding:38px 40px;max-height:90vh;overflow-y:auto">

        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
          <div style="width:46px;height:46px;border-radius:13px;flex-shrink:0;
            background:linear-gradient(135deg, rgba(79,156,249,.18), rgba(167,139,250,.1));
            border:1px solid rgba(79,156,249,.3);display:flex;align-items:center;justify-content:center;color:var(--accent)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="11" height="18" rx="1"/><path d="M9 8h1M9 12h1M9 16h1M15 21v-6h4v6"/></svg>
          </div>
          <div>
            <div style="font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:2px;
              text-transform:uppercase;color:var(--accent)">Configuração inicial</div>
            <div style="font-family:var(--fh);font-size:22px;font-weight:800;letter-spacing:-.3px;color:var(--text);margin-top:2px">Nova empresa</div>
          </div>
        </div>
        <p style="font-size:13px;color:var(--muted2);line-height:1.7;margin-bottom:28px">
          Defina como a Metrik vai se referir aos dados da sua planilha — você pode mudar isso depois.
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:26px">
          <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:7px">
            <label style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted2)">Nome da Empresa *</label>
            <input id="novaNome" type="text" placeholder="Ex: Clínica Sorriso"
              style="background:var(--surface2);border:1px solid rgba(255,255,255,.1);border-radius:10px;
              padding:11px 14px;font-size:14px;color:var(--text);outline:none;font-family:var(--fb);box-sizing:border-box"
              onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='rgba(255,255,255,.1)'">
          </div>
          <div style="display:flex;flex-direction:column;gap:7px">
            <label style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted2)">Tipo de Vendedor</label>
            <input id="novaVendedor" type="text" placeholder="Dentista" oninput="atualizarPreviewEmpresa()"
              style="background:var(--surface2);border:1px solid rgba(255,255,255,.1);border-radius:10px;
              padding:11px 14px;font-size:14px;color:var(--text);outline:none;font-family:var(--fb);box-sizing:border-box"
              onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='rgba(255,255,255,.1)'">
            <span style="font-size:11px;color:var(--muted)">Ex: Dentista, Consultor</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px">
            <label style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted2)">Tipo de Cliente</label>
            <input id="novaCliente" type="text" placeholder="Paciente" oninput="atualizarPreviewEmpresa()"
              style="background:var(--surface2);border:1px solid rgba(255,255,255,.1);border-radius:10px;
              padding:11px 14px;font-size:14px;color:var(--text);outline:none;font-family:var(--fb);box-sizing:border-box"
              onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='rgba(255,255,255,.1)'">
            <span style="font-size:11px;color:var(--muted)">Ex: Paciente, Lead</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px">
            <label style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted2)">Tipo de Proposta</label>
            <input id="novaProposta" type="text" placeholder="Orçamento" oninput="atualizarPreviewEmpresa()"
              style="background:var(--surface2);border:1px solid rgba(255,255,255,.1);border-radius:10px;
              padding:11px 14px;font-size:14px;color:var(--text);outline:none;font-family:var(--fb);box-sizing:border-box"
              onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='rgba(255,255,255,.1)'">
            <span style="font-size:11px;color:var(--muted)">Ex: Orçamento, Contrato</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px">
            <label style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted2)">Meta Global de Faturamento</label>
            <input id="novaMeta" type="text" placeholder="R$ 0,00"
              style="background:var(--surface2);border:1px solid rgba(255,255,255,.1);border-radius:10px;
              padding:11px 14px;font-size:14px;color:var(--text);outline:none;font-family:var(--fb);box-sizing:border-box"
              onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='rgba(255,255,255,.1)'">
          </div>
        </div>

        <div style="background:rgba(79,156,249,.05);border:1px solid rgba(79,156,249,.18);
          border-radius:14px;padding:18px 20px;margin-bottom:26px">
          <div style="font-family:var(--fh);font-size:10px;font-weight:700;letter-spacing:1.5px;
            text-transform:uppercase;color:var(--accent);margin-bottom:14px">Como vai aparecer no sistema</div>
          <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted2);margin-bottom:9px">
            <span id="pvVendedor" style="font-family:var(--fh);font-size:11px;font-weight:700;
              background:rgba(79,156,249,.14);border:1px solid rgba(79,156,249,.3);color:var(--accent);
              padding:3px 10px;border-radius:20px;flex-shrink:0">Vendedor</span>
            substitui "vendedor" nos filtros e gráficos
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted2);margin-bottom:9px">
            <span id="pvCliente" style="font-family:var(--fh);font-size:11px;font-weight:700;
              background:rgba(79,156,249,.14);border:1px solid rgba(79,156,249,.3);color:var(--accent);
              padding:3px 10px;border-radius:20px;flex-shrink:0">Cliente</span>
            substitui "cliente" em toda a interface
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted2)">
            <span id="pvProposta" style="font-family:var(--fh);font-size:11px;font-weight:700;
              background:rgba(79,156,249,.14);border:1px solid rgba(79,156,249,.3);color:var(--accent);
              padding:3px 10px;border-radius:20px;flex-shrink:0">Orçamento</span>
            substitui "proposta" nos KPIs de conversão
          </div>
        </div>

        <div style="display:flex;gap:10px">
          <button onclick="salvarNovaEmpresa()"
            style="flex:2;padding:14px;background:var(--accent);border:none;border-radius:11px;
            color:#fff;font-family:var(--fh);font-weight:700;font-size:13px;cursor:pointer;transition:.2s;
            box-shadow:0 10px 24px -8px rgba(79,156,249,.4)"
            onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            ✓ Criar Empresa
          </button>
          <button onclick="inicializarEmpresas()"
            style="flex:1;padding:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
            border-radius:11px;color:var(--muted2);font-size:13px;font-weight:600;cursor:pointer;transition:.2s;font-family:var(--fb)"
            onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted2)'">
            Cancelar
          </button>
        </div>

      </div>
    </div>
  `;
  atualizarPreviewEmpresa();
}

// ── Atualiza o preview ao vivo conforme o usuário digita ──
function atualizarPreviewEmpresa() {
  const v = document.getElementById('novaVendedor')?.value?.trim() || 'Vendedor';
  const c = document.getElementById('novaCliente')?.value?.trim() || 'Cliente';
  const p = document.getElementById('novaProposta')?.value?.trim() || 'Orçamento';
  const pv = document.getElementById('pvVendedor'); if (pv) pv.textContent = v;
  const pc = document.getElementById('pvCliente'); if (pc) pc.textContent = c;
  const pp = document.getElementById('pvProposta'); if (pp) pp.textContent = p;
}

// ── Salvar nova empresa ──
async function salvarNovaEmpresa() {
  const nome = document.getElementById('novaNome')?.value?.trim();
  if (!nome) { showToast('Informe o nome da empresa.', true); return; }

  const metaRaw = document.getElementById('novaMeta')?.value || '';
  const meta = parseBrNum(metaRaw.replace(/[^\d.,]/g, '')) || 0;

  const dados = {
    nome,
    vendedor: document.getElementById('novaVendedor')?.value?.trim() || 'Vendedor',
    cliente: document.getElementById('novaCliente')?.value?.trim() || 'Cliente',
    proposta: document.getElementById('novaProposta')?.value?.trim() || 'Orçamento',
    meta,
  };

  try {
    const empresa = await dbCriarEmpresa(dados);
    showToast('✅ Empresa criada com sucesso!');
    await entrarEmpresa(empresa);
  } catch (err) {
    showToast('Erro ao criar empresa: ' + err.message, true);
  }
}

// ── Abrir edição pelo dashboard ──
function abrirEdicaoEmpresaDash() {
  if (!_empresaAtiva) {
    inicializarEmpresas();
    return;
  }
  document.getElementById('empresasWrap').style.display = 'flex';
  abrirEdicaoEmpresa(_empresaAtiva.id);
}

// ── Abrir tela de edição ──
async function abrirEdicaoEmpresa(empresaId) {
  const wrap = document.getElementById('empresasWrap');
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.innerHTML = `
    <div style="background:#0f1320;border:1px solid rgba(255,255,255,.1);border-radius:16px;
      padding:36px 40px;width:100%;max-width:560px;box-shadow:0 24px 64px rgba(0,0,0,.6);
      max-height:90vh;overflow-y:auto;">
      <div style="color:#fff;opacity:.5;font-size:13px">Carregando...</div>
    </div>
  `;

  try {
    const empresas = await dbListarEmpresas();
    const empresa = empresas.find(e => e.id === empresaId);
    if (!empresa) { showToast('Empresa não encontrada.', true); return; }

    const { meses, despesas, faturamento } = await dbCarregarDadosEdicao(empresaId);

    // Seleção múltipla para exclusão em lote — reseta toda vez que a tela abre
    let _selMeses = new Set();
    let _selDespesas = new Set();
    let _selFaturamento = new Set();

    // ── Atualiza visual da barra de ação (sem re-renderizar a tela toda,
    //    pra não perder o que o usuário já digitou nos campos de cima) ──
    function atualizarBarraMeses() {
      const btn = document.getElementById('btnRemoverMeses');
      if (btn) {
        btn.style.display = _selMeses.size > 0 ? 'inline-flex' : 'none';
        btn.textContent = `🗑️ Remover selecionados (${_selMeses.size})`;
      }
      const todos = document.getElementById('checkTodosMeses');
      if (todos) todos.checked = meses.length > 0 && _selMeses.size === meses.length;
    }
    function atualizarBarraDespesas() {
      const btn = document.getElementById('btnRemoverDespesas');
      if (btn) {
        btn.style.display = _selDespesas.size > 0 ? 'inline-flex' : 'none';
        btn.textContent = `🗑️ Remover selecionados (${_selDespesas.size})`;
      }
      const todos = document.getElementById('checkTodosDespesas');
      if (todos) todos.checked = despesas.length > 0 && _selDespesas.size === despesas.length;
    }
    function atualizarBarraFaturamento() {
      const btn = document.getElementById('btnRemoverFaturamento');
      if (btn) {
        btn.style.display = _selFaturamento.size > 0 ? 'inline-flex' : 'none';
        btn.textContent = `🗑️ Remover selecionados (${_selFaturamento.size})`;
      }
      const todos = document.getElementById('checkTodosFaturamento');
      if (todos) todos.checked = faturamento.length > 0 && _selFaturamento.size === faturamento.length;
    }

    const renderEdicao = () => {
      wrap.innerHTML = `
        <div style="background:#0f1320;border:1px solid rgba(255,255,255,.1);border-radius:16px;
          padding:36px 40px;width:100%;max-width:560px;box-shadow:0 24px 64px rgba(0,0,0,.6);
          max-height:90vh;overflow-y:auto;">

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
            <div style="font-size:18px;font-weight:700;color:#e2e8f0">✏️ Editar Empresa</div>
            <button onclick="fecharEdicao()"
              style="background:transparent;border:none;color:#64748b;font-size:22px;cursor:pointer;line-height:1">×</button>
          </div>

          <!-- Dados -->
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px">
            <div>
              <label style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Nome</label>
              <input id="editNome" type="text" value="${empresa.nome || ''}"
                style="width:100%;margin-top:6px;padding:9px 13px;background:#151a2a;
                border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;
                font-size:13px;box-sizing:border-box;outline:none"
                onfocus="this.style.borderColor='rgba(79,156,249,.5)'"
                onblur="this.style.borderColor='rgba(255,255,255,.1)'">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:.5px;text-transform:uppercase">
                  Vendedor
                  <span style="color:#4f9cf9;font-size:10px;text-transform:none;font-weight:400;margin-left:2px">(na planilha)</span>
                </label>
                <input id="editVendedor" type="text" value="${empresa.vendedor || 'Vendedor'}"
                  style="width:100%;margin-top:6px;padding:9px 13px;background:#151a2a;
                  border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;
                  font-size:13px;box-sizing:border-box;outline:none">
              </div>
              <div>
                <label style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:.5px;text-transform:uppercase">
                  Cliente
                  <span style="color:#4f9cf9;font-size:10px;text-transform:none;font-weight:400;margin-left:2px">(na planilha)</span>
                </label>
                <input id="editCliente" type="text" value="${empresa.cliente || 'Cliente'}"
                  style="width:100%;margin-top:6px;padding:9px 13px;background:#151a2a;
                  border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;
                  font-size:13px;box-sizing:border-box;outline:none">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:.5px;text-transform:uppercase">
                  Proposta
                  <span style="color:#4f9cf9;font-size:10px;text-transform:none;font-weight:400;margin-left:2px">(na planilha)</span>
                </label>
                <input id="editProposta" type="text" value="${empresa.proposta || 'Orçamento'}"
                  style="width:100%;margin-top:6px;padding:9px 13px;background:#151a2a;
                  border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;
                  font-size:13px;box-sizing:border-box;outline:none">
              </div>
              <div>
                <label style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Meta Global</label>
                <input id="editMeta" type="text"
                  value="${empresa.meta > 0 ? 'R$ ' + empresa.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}"
                  placeholder="R$ 0,00"
                  style="width:100%;margin-top:6px;padding:9px 13px;background:#151a2a;
                  border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;
                  font-size:13px;box-sizing:border-box;outline:none">
              </div>
            </div>
          </div>

          <!-- Meses KPIs -->
          <div style="margin-bottom:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                color:#64748b">📅 KPIs Carregados (${meses.length})</div>
              ${meses.length > 0 ? `
                <div style="display:flex;align-items:center;gap:10px">
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b;cursor:pointer">
                    <input type="checkbox" id="checkTodosMeses" onchange="toggleSelecaoTodosMeses(this.checked)"
                      style="width:14px;height:14px;cursor:pointer">
                    Selecionar todos
                  </label>
                  <button id="btnRemoverMeses" onclick="pedirConfirmacaoMeses()"
                    style="display:none;padding:5px 12px;background:rgba(248,113,113,.1);
                    border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:6px;
                    font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
                    🗑️ Remover selecionados (0)
                  </button>
                </div>
              ` : ''}
            </div>

            <div id="confirmMesesWrap" style="display:none;background:rgba(248,113,113,.1);
              border:1px solid rgba(248,113,113,.4);border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div id="confirmMesesTexto" style="color:#f87171;font-size:13px;font-weight:600;margin-bottom:10px"></div>
              <div style="display:flex;gap:8px">
                <button onclick="confirmarRemocaoMeses('${empresaId}')"
                  style="padding:6px 14px;background:#f87171;border:none;border-radius:6px;
                  color:#fff;font-size:12px;font-weight:600;cursor:pointer">
                  Confirmar exclusão
                </button>
                <button onclick="cancelarConfirmacaoMeses()"
                  style="padding:6px 14px;background:transparent;border:1px solid rgba(255,255,255,.15);
                  border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer">
                  Cancelar
                </button>
              </div>
            </div>

            ${meses.length === 0
          ? `<div style="color:#64748b;font-size:12px;font-style:italic;padding:8px 0">Nenhum mês carregado.</div>`
          : meses.sort((a, b) => a.chave.localeCompare(b.chave)).map(m => `
                <div id="row-mes-${m.chave}" style="display:flex;align-items:center;gap:10px;
                  background:#151a2a;border:1px solid rgba(255,255,255,.06);border-radius:8px;
                  padding:8px 12px;margin-bottom:6px">
                  <input type="checkbox" class="check-mes" data-chave="${m.chave}"
                    ${_selMeses.has(m.chave) ? 'checked' : ''}
                    onchange="toggleSelecaoMes('${m.chave}', this.checked)"
                    style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
                  <span style="font-size:13px;color:#e2e8f0;flex:1">📅 ${m.periodo}</span>
                </div>`).join('')
        }
          </div>

          <!-- Despesas -->
          <div style="margin-bottom:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                color:#64748b">💰 Despesas (${despesas.length})</div>
              ${despesas.length > 0 ? `
                <div style="display:flex;align-items:center;gap:10px">
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b;cursor:pointer">
                    <input type="checkbox" id="checkTodosDespesas" onchange="toggleSelecaoTodosDespesas(this.checked)"
                      style="width:14px;height:14px;cursor:pointer">
                    Selecionar todos
                  </label>
                  <button id="btnRemoverDespesas" onclick="pedirConfirmacaoDespesas()"
                    style="display:none;padding:5px 12px;background:rgba(248,113,113,.1);
                    border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:6px;
                    font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
                    🗑️ Remover selecionados (0)
                  </button>
                </div>
              ` : ''}
            </div>

            <div id="confirmDespesasWrap" style="display:none;background:rgba(248,113,113,.1);
              border:1px solid rgba(248,113,113,.4);border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div id="confirmDespesasTexto" style="color:#f87171;font-size:13px;font-weight:600;margin-bottom:10px"></div>
              <div style="display:flex;gap:8px">
                <button onclick="confirmarRemocaoDespesas('${empresaId}')"
                  style="padding:6px 14px;background:#f87171;border:none;border-radius:6px;
                  color:#fff;font-size:12px;font-weight:600;cursor:pointer">
                  Confirmar exclusão
                </button>
                <button onclick="cancelarConfirmacaoDespesas()"
                  style="padding:6px 14px;background:transparent;border:1px solid rgba(255,255,255,.15);
                  border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer">
                  Cancelar
                </button>
              </div>
            </div>

            ${despesas.length === 0
          ? `<div style="color:#64748b;font-size:12px;font-style:italic;padding:8px 0">Nenhuma despesa carregada.</div>`
          : despesas.sort((a, b) => a.chave.localeCompare(b.chave)).map(d => `
                <div id="row-desp-${d.chave}" style="display:flex;align-items:center;gap:10px;
                  background:#151a2a;border:1px solid rgba(255,255,255,.06);border-radius:8px;
                  padding:8px 12px;margin-bottom:6px">
                  <input type="checkbox" class="check-despesa" data-chave="${d.chave}"
                    ${_selDespesas.has(d.chave) ? 'checked' : ''}
                    onchange="toggleSelecaoDespesa('${d.chave}', this.checked)"
                    style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
                  <span style="font-size:13px;color:#e2e8f0;flex:1">
                    💰 ${MONTHS_PT_EMP[d.mes - 1]} ${d.ano} —
                    R$ ${(d.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>`).join('')
        }
          </div>

          <!-- Faturamento -->
          <div style="margin-bottom:24px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                color:#64748b">💵 Faturamento Real (${faturamento.length})</div>
              ${faturamento.length > 0 ? `
                <div style="display:flex;align-items:center;gap:10px">
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b;cursor:pointer">
                    <input type="checkbox" id="checkTodosFaturamento" onchange="toggleSelecaoTodosFaturamento(this.checked)"
                      style="width:14px;height:14px;cursor:pointer">
                    Selecionar todos
                  </label>
                  <button id="btnRemoverFaturamento" onclick="pedirConfirmacaoFaturamento()"
                    style="display:none;padding:5px 12px;background:rgba(248,113,113,.1);
                    border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:6px;
                    font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
                    🗑️ Remover selecionados (0)
                  </button>
                </div>
              ` : ''}
            </div>

            <div id="confirmFaturamentoWrap" style="display:none;background:rgba(248,113,113,.1);
              border:1px solid rgba(248,113,113,.4);border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div id="confirmFaturamentoTexto" style="color:#f87171;font-size:13px;font-weight:600;margin-bottom:10px"></div>
              <div style="display:flex;gap:8px">
                <button onclick="confirmarRemocaoFaturamento('${empresaId}')"
                  style="padding:6px 14px;background:#f87171;border:none;border-radius:6px;
                  color:#fff;font-size:12px;font-weight:600;cursor:pointer">
                  Confirmar exclusão
                </button>
                <button onclick="cancelarConfirmacaoFaturamento()"
                  style="padding:6px 14px;background:transparent;border:1px solid rgba(255,255,255,.15);
                  border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer">
                  Cancelar
                </button>
              </div>
            </div>

            ${faturamento.length === 0
          ? `<div style="color:#64748b;font-size:12px;font-style:italic;padding:8px 0">Nenhum faturamento carregado.</div>`
          : faturamento.sort((a, b) => a.chave.localeCompare(b.chave)).map(f => `
                <div id="row-fat-${f.chave}" style="display:flex;align-items:center;gap:10px;
                  background:#151a2a;border:1px solid rgba(167,139,250,.1);border-radius:8px;
                  padding:8px 12px;margin-bottom:6px">
                  <input type="checkbox" class="check-faturamento" data-chave="${f.chave}"
                    ${_selFaturamento.has(f.chave) ? 'checked' : ''}
                    onchange="toggleSelecaoFaturamento('${f.chave}', this.checked)"
                    style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
                  <span style="font-size:13px;color:#e2e8f0;flex:1">
                    💵 ${MONTHS_PT_EMP[f.mes - 1]} ${f.ano} —
                    R$ ${(f.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>`).join('')
        }
          </div>

          <!-- Ações -->
          <div style="display:flex;flex-direction:column;gap:8px">
                        <button onclick="salvarEdicaoEmpresa('${empresaId}')"
              style="width:100%;padding:11px;background:#4f9cf9;border:none;border-radius:8px;
              color:#fff;font-size:14px;font-weight:600;cursor:pointer"
              onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
              ✓ Salvar Alterações
            </button>
            <button onclick="subirNovaPlanilhaEmpresa('${empresaId}')"
              style="width:100%;padding:10px;background:rgba(52,211,153,.1);
              border:1px solid rgba(52,211,153,.25);border-radius:8px;color:#34d399;
              font-size:13px;font-weight:600;cursor:pointer"
              onmouseover="this.style.background='rgba(52,211,153,.18)'"
              onmouseout="this.style.background='rgba(52,211,153,.1)'">
              📂 Subir Nova Planilha
            </button>
            <button onclick="fecharEdicao()"
              style="width:100%;padding:10px;background:transparent;
              border:1px solid rgba(255,255,255,.08);border-radius:8px;
              color:#64748b;font-size:13px;cursor:pointer"
              onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#64748b'">
              ← Voltar
            </button>
          </div>
        </div>
      `;
      // Restaura visual da barra de ação após o re-render (ex: depois de excluir)
      atualizarBarraMeses();
      atualizarBarraDespesas();
      atualizarBarraFaturamento();
    };

    // ── Seleção: Meses ──
    window.toggleSelecaoMes = (chave, checked) => {
      if (checked) _selMeses.add(chave); else _selMeses.delete(chave);
      atualizarBarraMeses();
    };
    window.toggleSelecaoTodosMeses = (checked) => {
      _selMeses = checked ? new Set(meses.map(m => m.chave)) : new Set();
      document.querySelectorAll('.check-mes').forEach(cb => cb.checked = checked);
      atualizarBarraMeses();
    };
    window.pedirConfirmacaoMeses = () => {
      if (_selMeses.size === 0) return;
      document.getElementById('confirmMesesTexto').textContent =
        `⚠️ Confirma a remoção de ${_selMeses.size} mês(es)? Essa ação não pode ser desfeita.`;
      document.getElementById('confirmMesesWrap').style.display = 'block';
    };
    window.cancelarConfirmacaoMeses = () => {
      document.getElementById('confirmMesesWrap').style.display = 'none';
    };
    window.confirmarRemocaoMeses = async (empId) => {
      const chaves = [..._selMeses];
      document.getElementById('confirmMesesWrap').style.display = 'none';
      try {
        for (const chave of chaves) {
          await dbDeletarMes(empId, chave);
          const idx = meses.findIndex(m => m.chave === chave);
          if (idx >= 0) meses.splice(idx, 1);
          if (_empresaAtiva && _empresaAtiva.id === empId) delete parsedMonths[chave];
        }
        _selMeses.clear();
        showToast(`✅ ${chaves.length} mês(es) removido(s).`);
      } catch (err) {
        showToast('Erro ao remover: ' + err.message, true);
      }
      renderEdicao();
    };

    // ── Seleção: Despesas ──
    window.toggleSelecaoDespesa = (chave, checked) => {
      if (checked) _selDespesas.add(chave); else _selDespesas.delete(chave);
      atualizarBarraDespesas();
    };
    window.toggleSelecaoTodosDespesas = (checked) => {
      _selDespesas = checked ? new Set(despesas.map(d => d.chave)) : new Set();
      document.querySelectorAll('.check-despesa').forEach(cb => cb.checked = checked);
      atualizarBarraDespesas();
    };
    window.pedirConfirmacaoDespesas = () => {
      if (_selDespesas.size === 0) return;
      document.getElementById('confirmDespesasTexto').textContent =
        `⚠️ Confirma a remoção de ${_selDespesas.size} despesa(s)? Essa ação não pode ser desfeita.`;
      document.getElementById('confirmDespesasWrap').style.display = 'block';
    };
    window.cancelarConfirmacaoDespesas = () => {
      document.getElementById('confirmDespesasWrap').style.display = 'none';
    };
    window.confirmarRemocaoDespesas = async (empId) => {
      const chaves = [..._selDespesas];
      document.getElementById('confirmDespesasWrap').style.display = 'none';
      try {
        for (const chave of chaves) {
          await dbDeletarDespesa(empId, chave);
          const idx = despesas.findIndex(d => d.chave === chave);
          if (idx >= 0) despesas.splice(idx, 1);
          if (_empresaAtiva && _empresaAtiva.id === empId) delete parsedExpenses[chave];
        }
        _selDespesas.clear();
        showToast(`✅ ${chaves.length} despesa(s) removida(s).`);
      } catch (err) {
        showToast('Erro ao remover: ' + err.message, true);
      }
      renderEdicao();
    };

    // ── Seleção: Faturamento ──
    window.toggleSelecaoFaturamento = (chave, checked) => {
      if (checked) _selFaturamento.add(chave); else _selFaturamento.delete(chave);
      atualizarBarraFaturamento();
    };
    window.toggleSelecaoTodosFaturamento = (checked) => {
      _selFaturamento = checked ? new Set(faturamento.map(f => f.chave)) : new Set();
      document.querySelectorAll('.check-faturamento').forEach(cb => cb.checked = checked);
      atualizarBarraFaturamento();
    };
    window.pedirConfirmacaoFaturamento = () => {
      if (_selFaturamento.size === 0) return;
      document.getElementById('confirmFaturamentoTexto').textContent =
        `⚠️ Confirma a remoção de ${_selFaturamento.size} registro(s) de faturamento? Essa ação não pode ser desfeita.`;
      document.getElementById('confirmFaturamentoWrap').style.display = 'block';
    };
    window.cancelarConfirmacaoFaturamento = () => {
      document.getElementById('confirmFaturamentoWrap').style.display = 'none';
    };
    window.confirmarRemocaoFaturamento = async (empId) => {
      const chaves = [..._selFaturamento];
      document.getElementById('confirmFaturamentoWrap').style.display = 'none';
      try {
        for (const chave of chaves) {
          await dbDeletarFaturamento(empId, chave);
          const idx = faturamento.findIndex(f => f.chave === chave);
          if (idx >= 0) faturamento.splice(idx, 1);
          if (_empresaAtiva && _empresaAtiva.id === empId) delete parsedFaturamento[chave];
        }
        _selFaturamento.clear();
        showToast(`✅ ${chaves.length} registro(s) de faturamento removido(s).`);
      } catch (err) {
        showToast('Erro ao remover: ' + err.message, true);
      }
      renderEdicao();
    };

    renderEdicao();

  } catch (err) {
    showToast('Erro ao carregar edição: ' + err.message, true);
  }
}

// ── Fechar edição ──
function fecharEdicao() {
  // Se veio do dashboard, fecha o overlay e volta ao dash
  if (_empresaAtiva && document.getElementById('dashboard').style.display !== 'none') {
    document.getElementById('empresasWrap').style.display = 'none';
    return;
  }
  inicializarEmpresas();
}

// ── Salvar edição ──
async function salvarEdicaoEmpresa(empresaId) {
  const nome = document.getElementById('editNome')?.value?.trim();
  if (!nome) { showToast('Informe o nome.', true); return; }

  const metaRaw = document.getElementById('editMeta')?.value || '';
  const meta = parseBrNum(metaRaw.replace(/[^\d.,]/g, '')) || 0;

  const dados = {
    nome,
    vendedor: document.getElementById('editVendedor')?.value?.trim() || 'Vendedor',
    cliente: document.getElementById('editCliente')?.value?.trim() || 'Cliente',
    proposta: document.getElementById('editProposta')?.value?.trim() || 'Orçamento',
    meta,
  };

  try {
    await dbAtualizarEmpresa(empresaId, dados);

    // Atualiza empresa ativa se for a mesma
    if (_empresaAtiva && _empresaAtiva.id === empresaId) {
      _empresaAtiva = { ..._empresaAtiva, ...dados };
      CFG.empresa = dados.nome;
      CFG.vendedor = dados.vendedor;
      CFG.cliente = dados.cliente;
      CFG.proposta = dados.proposta;
      CFG.meta = dados.meta;
      if (dados.meta > 0) {
        clinicGoal = dados.meta;
        // Atualiza input de meta no dashboard
        const gi = document.getElementById('goalInput');
        if (gi) gi.value = 'R$ ' + dados.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      }
      applyConfigToUI();
    }

    showToast('✅ Empresa atualizada!');
    fecharEdicao();
  } catch (err) {
    showToast('Erro ao salvar: ' + err.message, true);
  }
}

// ── Subir nova planilha pela edição ──
async function subirNovaPlanilhaEmpresa(empresaId) {
  const empresas = await dbListarEmpresas().catch(() => []);
  const empresa = empresas.find(e => e.id === empresaId);
  if (!empresa) return;

  // Garante empresa ativa
  _empresaAtiva = empresa;
  CFG.empresa = empresa.nome;
  CFG.vendedor = empresa.vendedor;
  CFG.cliente = empresa.cliente;
  CFG.proposta = empresa.proposta;
  CFG.meta = empresa.meta || 0;
  if (CFG.meta > 0) clinicGoal = CFG.meta;

  // Carrega dados existentes do banco para memória
  await dbCarregarTudo(empresaId).catch(() => { });

  document.getElementById('empresasWrap').style.display = 'none';
  document.getElementById('uploadScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';

  const configCard = document.getElementById('configCard');
  if (configCard) configCard.style.display = 'none';

  const metrikSub = document.getElementById('metrikSub');
  if (metrikSub) metrikSub.textContent = `📂 Subindo novos dados para: ${empresa.nome}`;

  // Mostra chips dos meses já carregados
  updateChips();

  // Se já tem meses no banco, habilita botão analisar
  const temMeses = Object.keys(parsedMonths).length > 0;
  document.getElementById('btnAnalyze').style.display = temMeses ? 'flex' : 'none';

  // Limpa banners
  document.getElementById('errBanner').style.display = 'none';
  document.getElementById('suspectBanner').style.display = 'none';

  applyConfigToUI();
}

// ── Confirmar deleção ──
function confirmarDeletarEmpresa(empresaId, nome) {
  if (!confirm(`Tem certeza que deseja excluir "${nome}"?\n\nTodos os dados serão apagados permanentemente.`)) return;
  deletarEmpresa(empresaId);
}

async function deletarEmpresa(empresaId) {
  try {
    await dbDeletarEmpresa(empresaId);
    showToast('✅ Empresa excluída.');
    _empresaAtiva = null;
    _modoTeste = false;
    parsedMonths = {};
    parsedExpenses = {};
    parsedFaturamento = {};
    MONTHS = [];
    YEARS = {};
    await inicializarEmpresas();
  } catch (err) {
    showToast('Erro ao excluir: ' + err.message, true);
  }
}