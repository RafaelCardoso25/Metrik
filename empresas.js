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
  if (typeof gResetEmpresa === 'function') gResetEmpresa();

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
  if (typeof gResetEmpresa === 'function') gResetEmpresa();

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
  if (metrikSub) metrikSub.textContent = 'Explore o sistema sem salvar nada na nuvem';
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
    <div style="display:flex;align-items:center;gap:12px;margin:18px 0">
      <span style="flex:1;height:1px;background:var(--border)"></span>
      <span style="font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)">ou</span>
      <span style="flex:1;height:1px;background:var(--border)"></span>
    </div>`;
  const btnTeste = `
    <button onclick="entrarModoTeste()"
      style="width:100%;padding:13px;background:color-mix(in srgb,var(--text) 3%,transparent);border:1px solid var(--border2);
      border-radius:11px;color:var(--muted2);font-size:13px;font-weight:500;cursor:pointer;transition:.16s;
      display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--fb)"
      onmouseover="this.style.borderColor='var(--accent2)';this.style.color='var(--text)'"
      onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--muted2)'">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v4M15 3v4M5 21V8h14v13"/><path d="M9 12h6M9 16h6"/></svg>
      Testar sem salvar
    </button>`;

  const btnEntrar = (txt, click) => `
    <button onclick='${click}'
      style="width:100%;padding:14px;background:var(--accent);border:none;border-radius:11px;
      color:#fff;font-family:var(--fh);font-size:14px;font-weight:600;cursor:pointer;transition:.18s"
      onmouseover="this.style.background='var(--accent-strong)';this.style.transform='translateY(-1px)'"
      onmouseout="this.style.background='var(--accent)';this.style.transform='translateY(0)'">${txt}</button>`;

  wrap.innerHTML = `
    <div class="emp-amb-grid"></div><div class="emp-amb-glow"></div>
    <div class="emp-card" style="
      padding:1px;border-radius:19px;width:100%;max-width:480px;position:relative;
      background:linear-gradient(140deg,color-mix(in srgb,var(--accent) 40%,transparent),color-mix(in srgb,var(--accent2) 16%,transparent) 45%,color-mix(in srgb,var(--text) 5%,transparent) 100%);
      box-shadow:0 40px 90px -45px rgba(0,0,0,.8);
    ">
      <div style="background:var(--surface);border-radius:18px;padding:34px 32px">

        <div style="text-align:center;margin-bottom:26px">
          <div style="width:48px;height:48px;margin:0 auto 12px;border-radius:13px;
            background:var(--accent-dim);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);
            display:flex;align-items:center;justify-content:center;color:var(--accent)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
          </div>
          <div style="font-family:var(--fh);font-weight:600;font-size:21px;letter-spacing:-.01em;color:var(--text)">Metrik</div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:5px;letter-spacing:.03em">
            ${empresa ? 'BEM-VINDO DE VOLTA' : 'CONFIGURE SUA PRIMEIRA EMPRESA'}
          </div>
        </div>

        ${empresa ? `
          <div style="display:flex;align-items:center;gap:13px;background:var(--surface2);
            border:1px solid var(--border2);border-radius:14px;padding:16px 18px;margin-bottom:14px">
            <div style="width:44px;height:44px;border-radius:12px;flex-shrink:0;
              background:linear-gradient(135deg,var(--accent),var(--accent2));
              display:flex;align-items:center;justify-content:center;font-family:var(--fh);
              font-weight:700;color:#fff;font-size:16px">${getInitials(empresa.nome)}</div>
            <div style="flex:1;min-width:0">
              <b style="font-family:var(--fh);font-weight:600;font-size:15px;display:block;color:var(--text)">${empresa.nome}</b>
              <div style="font-family:var(--mono);font-size:10.5px;color:var(--muted);margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">
                <i style="font-style:normal;color:var(--muted2)">${empresa.vendedor || 'Vendedor'}</i> ·
                <i style="font-style:normal;color:var(--muted2)">${empresa.cliente || 'Cliente'}</i> · meta
                <i style="font-style:normal;color:var(--muted2)">R$ ${(empresa.meta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</i>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button onclick="abrirEdicaoEmpresa('${empresa.id}')" title="Editar"
                style="width:32px;height:32px;border-radius:8px;background:color-mix(in srgb,var(--text) 3%,transparent);
                border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;
                color:var(--muted2);cursor:pointer;transition:.16s"
                onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--muted2)'">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button onclick="confirmarDeletarEmpresa('${empresa.id}','${empresa.nome.replace(/'/g, "\\\'")}')" title="Excluir"
                style="width:32px;height:32px;border-radius:8px;background:color-mix(in srgb,var(--text) 3%,transparent);
                border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;
                color:var(--muted2);cursor:pointer;transition:.16s"
                onmouseover="this.style.background='color-mix(in srgb,var(--red) 8%,transparent)';this.style.borderColor='color-mix(in srgb,var(--red) 40%,transparent)';this.style.color='var(--red)'"
                onmouseout="this.style.background='color-mix(in srgb,var(--text) 3%,transparent)';this.style.borderColor='var(--border2)';this.style.color='var(--muted2)'">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
              </button>
            </div>
          </div>

          ${btnEntrar('Entrar →', `entrarEmpresaById("${empresa.id}")`)}

          ${divisor}${btnTeste}
        ` : `
          <div style="font-family:var(--mono);font-size:9.5px;font-weight:600;letter-spacing:.14em;
            text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:12px">Pré-visualização</div>
          <div style="display:flex;align-items:center;gap:13px;
            border:1.5px dashed var(--border2);border-radius:14px;padding:16px 18px;margin-bottom:16px">
            <div style="width:44px;height:44px;border-radius:12px;border:1.5px dashed var(--muted);
              display:flex;align-items:center;justify-content:center;color:var(--muted);flex-shrink:0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="11" height="18" rx="1"/><path d="M15 21v-6h4v6"/></svg>
            </div>
            <div>
              <b style="font-family:var(--fh);font-weight:600;font-size:14px;color:var(--muted2);display:block">Sua empresa aparecerá aqui</b>
              <span style="font-size:11px;color:var(--muted);margin-top:3px;display:block">Nome, vendedor, cliente e meta — você define ao criar</span>
            </div>
          </div>

          <p style="text-align:center;font-size:12px;color:var(--muted2);line-height:1.6;margin-bottom:18px">
            Leva menos de um minuto. Depois é só <b style="color:var(--accent-text);font-weight:600">entrar</b> sempre que quiser ver seus indicadores.
          </p>

          ${btnEntrar('+ Criar empresa', 'abrirCriarEmpresa()')}

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

  const focIn = `onfocus="this.previousElementSibling.style.background='var(--accent)';this.previousElementSibling.style.boxShadow='0 0 0 3px var(--accent-dim)';this.style.borderColor='var(--accent)';this.style.boxShadow='0 0 0 3px var(--accent-dim)'"`;
  const focOut = `onblur="this.previousElementSibling.style.background='var(--raise)';this.previousElementSibling.style.boxShadow='none';this.style.borderColor='var(--border2)';this.style.boxShadow='none'"`;
  const inputBase = `style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:10px;padding:12px 14px 12px 28px;font-size:13.5px;color:var(--text);outline:none;font-family:var(--fb);box-sizing:border-box;transition:.16s"`;
  const dot = `<span style="position:absolute;left:13px;width:6px;height:6px;border-radius:50%;background:var(--raise);transition:.16s;pointer-events:none"></span>`;
  const labelStyle = `style="font-family:var(--mono);font-size:10px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)"`;
  const exStyle = `style="font-size:11px;color:var(--muted);padding-left:2px"`;
  const tag = (id, txt) => `<span id="${id}" style="font-family:var(--mono);font-size:10.5px;font-weight:600;background:var(--accent-dim);border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);color:#BBD2F9;padding:4px 11px;border-radius:7px;flex-shrink:0;min-width:78px;text-align:center">${txt}</span>`;

  wrap.innerHTML = `
    <div class="emp-amb-grid"></div><div class="emp-amb-glow"></div>
    <div class="emp-card" style="
      width:100%;max-width:560px;background:var(--surface);border:1px solid var(--border2);border-radius:18px;
      padding:0;max-height:92vh;overflow:hidden;position:relative;display:flex;flex-direction:column;
      box-shadow:0 40px 90px -45px rgba(0,0,0,.85);
    ">

      <div style="display:flex;align-items:center;gap:15px;padding:28px 34px 22px;
        background:linear-gradient(140deg,color-mix(in srgb,var(--accent) 7%,transparent),transparent 65%);border-bottom:1px solid var(--border)">
        <div style="width:48px;height:48px;border-radius:13px;flex-shrink:0;
          background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 22%,transparent),color-mix(in srgb,var(--accent2) 14%,transparent));
          border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);display:flex;align-items:center;justify-content:center;color:var(--accent-text)">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="11" height="18" rx="1"/><path d="M9 8h1M9 12h1M9 16h1M15 21v-6h4v6"/></svg>
        </div>
        <div>
          <div style="font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.16em;
            text-transform:uppercase;color:var(--accent);display:flex;align-items:center;gap:7px">
            <span style="width:14px;height:1px;background:var(--accent)"></span>Configuração inicial</div>
          <div style="font-family:var(--fh);font-size:22px;font-weight:600;letter-spacing:-.015em;color:var(--text);margin-top:4px">Nova empresa</div>
        </div>
      </div>

      <div style="padding:24px 34px 30px;overflow-y:auto">
        <p style="font-size:12.5px;color:var(--muted2);line-height:1.7;margin-bottom:24px">
          Defina como a Metrik vai se referir aos dados da sua planilha — você pode mudar isso depois.
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
          <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:8px">
            <label ${labelStyle}>Nome da empresa *</label>
            <div style="position:relative;display:flex;align-items:center">${dot}
              <input id="novaNome" type="text" placeholder="Ex: Clínica Sorriso" ${inputBase} ${focIn} ${focOut}></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label ${labelStyle}>Tipo de vendedor</label>
            <div style="position:relative;display:flex;align-items:center">${dot}
              <input id="novaVendedor" type="text" placeholder="Dentista" oninput="atualizarPreviewEmpresa()" ${inputBase} ${focIn} ${focOut}></div>
            <span ${exStyle}>Ex: Dentista, Consultor</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label ${labelStyle}>Tipo de cliente</label>
            <div style="position:relative;display:flex;align-items:center">${dot}
              <input id="novaCliente" type="text" placeholder="Paciente" oninput="atualizarPreviewEmpresa()" ${inputBase} ${focIn} ${focOut}></div>
            <span ${exStyle}>Ex: Paciente, Lead</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label ${labelStyle}>Tipo de proposta</label>
            <div style="position:relative;display:flex;align-items:center">${dot}
              <input id="novaProposta" type="text" placeholder="Orçamento" oninput="atualizarPreviewEmpresa()" ${inputBase} ${focIn} ${focOut}></div>
            <span ${exStyle}>Ex: Orçamento, Contrato</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label ${labelStyle}>Meta global de faturamento</label>
            <div style="position:relative;display:flex;align-items:center">${dot}
              <input id="novaMeta" type="text" placeholder="R$ 0,00" ${inputBase} ${focIn} ${focOut}></div>
          </div>
        </div>

        <div style="position:relative;background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 7%,transparent),color-mix(in srgb,var(--accent2) 3%,transparent));
          border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:13px;padding:18px 20px 18px 22px;margin-bottom:26px;overflow:hidden">
          <span style="position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(var(--accent),var(--accent2))"></span>
          <div style="font-family:var(--mono);font-size:9.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-text);margin-bottom:14px;display:flex;align-items:center;gap:8px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>Como vai aparecer no sistema</div>
          <div style="display:flex;align-items:center;gap:11px;font-size:12px;color:var(--muted2);margin-bottom:11px">${tag('pvVendedor', 'Vendedor')}substitui "vendedor" nos filtros e gráficos</div>
          <div style="display:flex;align-items:center;gap:11px;font-size:12px;color:var(--muted2);margin-bottom:11px">${tag('pvCliente', 'Cliente')}substitui "cliente" em toda a interface</div>
          <div style="display:flex;align-items:center;gap:11px;font-size:12px;color:var(--muted2)">${tag('pvProposta', 'Orçamento')}substitui "proposta" nos KPIs de conversão</div>
        </div>

        <div style="display:flex;gap:11px">
          <button onclick="salvarNovaEmpresa()"
            style="flex:2;padding:14px;background:var(--accent);border:none;border-radius:11px;
            color:#fff;font-family:var(--fh);font-weight:600;font-size:13.5px;cursor:pointer;transition:.18s;
            box-shadow:0 12px 26px -10px color-mix(in srgb,var(--accent) 60%,transparent);display:flex;align-items:center;justify-content:center;gap:8px"
            onmouseover="this.style.background='var(--accent-strong)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.background='var(--accent)';this.style.transform='translateY(0)'">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>Criar empresa
          </button>
          <button onclick="inicializarEmpresas()"
            style="flex:1;padding:14px;background:color-mix(in srgb,var(--text) 3%,transparent);border:1px solid var(--border2);
            border-radius:11px;color:var(--muted2);font-size:13px;font-weight:500;cursor:pointer;transition:.16s;font-family:var(--fb)"
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
    <div style="background:var(--surface);border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:16px;
      padding:36px 40px;width:100%;max-width:560px;box-shadow:var(--modal-shadow);
      max-height:90vh;overflow-y:auto;">
      <div style="color:var(--text);opacity:.5;font-size:13px">Carregando...</div>
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
        <div style="background:var(--surface);border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:16px;
          padding:36px 40px;width:100%;max-width:560px;box-shadow:var(--modal-shadow);
          max-height:90vh;overflow-y:auto;">

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
            <div style="font-size:18px;font-weight:700;color:var(--text)">✏️ Editar Empresa</div>
            <button onclick="fecharEdicao()"
              style="background:transparent;border:none;color:var(--muted);font-size:22px;cursor:pointer;line-height:1">×</button>
          </div>

          <!-- Dados -->
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px">
            <div>
              <label style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.5px;text-transform:uppercase">Nome</label>
              <input id="editNome" type="text" value="${empresa.nome || ''}"
                style="width:100%;margin-top:6px;padding:9px 13px;background:var(--surface2);
                border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:8px;color:var(--text);
                font-size:13px;box-sizing:border-box;outline:none"
                onfocus="this.style.borderColor='color-mix(in srgb,var(--accent) 50%,transparent)'"
                onblur="this.style.borderColor='color-mix(in srgb,var(--text) 10%,transparent)'">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.5px;text-transform:uppercase">
                  Vendedor
                  <span style="color:var(--accent);font-size:10px;text-transform:none;font-weight:400;margin-left:2px">(na planilha)</span>
                </label>
                <input id="editVendedor" type="text" value="${empresa.vendedor || 'Vendedor'}"
                  style="width:100%;margin-top:6px;padding:9px 13px;background:var(--surface2);
                  border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:8px;color:var(--text);
                  font-size:13px;box-sizing:border-box;outline:none">
              </div>
              <div>
                <label style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.5px;text-transform:uppercase">
                  Cliente
                  <span style="color:var(--accent);font-size:10px;text-transform:none;font-weight:400;margin-left:2px">(na planilha)</span>
                </label>
                <input id="editCliente" type="text" value="${empresa.cliente || 'Cliente'}"
                  style="width:100%;margin-top:6px;padding:9px 13px;background:var(--surface2);
                  border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:8px;color:var(--text);
                  font-size:13px;box-sizing:border-box;outline:none">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.5px;text-transform:uppercase">
                  Proposta
                  <span style="color:var(--accent);font-size:10px;text-transform:none;font-weight:400;margin-left:2px">(na planilha)</span>
                </label>
                <input id="editProposta" type="text" value="${empresa.proposta || 'Orçamento'}"
                  style="width:100%;margin-top:6px;padding:9px 13px;background:var(--surface2);
                  border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:8px;color:var(--text);
                  font-size:13px;box-sizing:border-box;outline:none">
              </div>
              <div>
                <label style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.5px;text-transform:uppercase">Meta Global</label>
                <input id="editMeta" type="text"
                  value="${empresa.meta > 0 ? 'R$ ' + empresa.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}"
                  placeholder="R$ 0,00"
                  style="width:100%;margin-top:6px;padding:9px 13px;background:var(--surface2);
                  border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:8px;color:var(--text);
                  font-size:13px;box-sizing:border-box;outline:none">
              </div>
            </div>
          </div>

          <!-- Meses KPIs -->
          <div style="margin-bottom:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                color:var(--muted)">📅 KPIs Carregados (${meses.length})</div>
              ${meses.length > 0 ? `
                <div style="display:flex;align-items:center;gap:10px">
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);cursor:pointer">
                    <input type="checkbox" id="checkTodosMeses" onchange="toggleSelecaoTodosMeses(this.checked)"
                      style="width:14px;height:14px;cursor:pointer">
                    Selecionar todos
                  </label>
                  <button id="btnRemoverMeses" onclick="pedirConfirmacaoMeses()"
                    style="display:none;padding:5px 12px;background:color-mix(in srgb,var(--red) 10%,transparent);
                    border:1px solid color-mix(in srgb,var(--red) 30%,transparent);color:var(--red);border-radius:6px;
                    font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
                    🗑️ Remover selecionados (0)
                  </button>
                </div>
              ` : ''}
            </div>

            <div id="confirmMesesWrap" style="display:none;background:color-mix(in srgb,var(--red) 10%,transparent);
              border:1px solid color-mix(in srgb,var(--red) 40%,transparent);border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div id="confirmMesesTexto" style="color:var(--red);font-size:13px;font-weight:600;margin-bottom:10px"></div>
              <div style="display:flex;gap:8px">
                <button onclick="confirmarRemocaoMeses('${empresaId}')"
                  style="padding:6px 14px;background:var(--red);border:none;border-radius:6px;
                  color:#fff;font-size:12px;font-weight:600;cursor:pointer">
                  Confirmar exclusão
                </button>
                <button onclick="cancelarConfirmacaoMeses()"
                  style="padding:6px 14px;background:transparent;border:1px solid color-mix(in srgb,var(--text) 15%,transparent);
                  border-radius:6px;color:var(--muted2);font-size:12px;cursor:pointer">
                  Cancelar
                </button>
              </div>
            </div>

            ${meses.length === 0
          ? `<div style="color:var(--muted);font-size:12px;font-style:italic;padding:8px 0">Nenhum mês carregado.</div>`
          : meses.sort((a, b) => a.chave.localeCompare(b.chave)).map(m => `
                <div id="row-mes-${m.chave}" style="display:flex;align-items:center;gap:10px;
                  background:var(--surface2);border:1px solid color-mix(in srgb,var(--text) 6%,transparent);border-radius:8px;
                  padding:8px 12px;margin-bottom:6px">
                  <input type="checkbox" class="check-mes" data-chave="${m.chave}"
                    ${_selMeses.has(m.chave) ? 'checked' : ''}
                    onchange="toggleSelecaoMes('${m.chave}', this.checked)"
                    style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
                  <span style="font-size:13px;color:var(--text);flex:1">📅 ${m.periodo}</span>
                </div>`).join('')
        }
          </div>

          <!-- Despesas -->
          <div style="margin-bottom:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                color:var(--muted)">💰 Despesas (${despesas.length})</div>
              ${despesas.length > 0 ? `
                <div style="display:flex;align-items:center;gap:10px">
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);cursor:pointer">
                    <input type="checkbox" id="checkTodosDespesas" onchange="toggleSelecaoTodosDespesas(this.checked)"
                      style="width:14px;height:14px;cursor:pointer">
                    Selecionar todos
                  </label>
                  <button id="btnRemoverDespesas" onclick="pedirConfirmacaoDespesas()"
                    style="display:none;padding:5px 12px;background:color-mix(in srgb,var(--red) 10%,transparent);
                    border:1px solid color-mix(in srgb,var(--red) 30%,transparent);color:var(--red);border-radius:6px;
                    font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
                    🗑️ Remover selecionados (0)
                  </button>
                </div>
              ` : ''}
            </div>

            <div id="confirmDespesasWrap" style="display:none;background:color-mix(in srgb,var(--red) 10%,transparent);
              border:1px solid color-mix(in srgb,var(--red) 40%,transparent);border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div id="confirmDespesasTexto" style="color:var(--red);font-size:13px;font-weight:600;margin-bottom:10px"></div>
              <div style="display:flex;gap:8px">
                <button onclick="confirmarRemocaoDespesas('${empresaId}')"
                  style="padding:6px 14px;background:var(--red);border:none;border-radius:6px;
                  color:#fff;font-size:12px;font-weight:600;cursor:pointer">
                  Confirmar exclusão
                </button>
                <button onclick="cancelarConfirmacaoDespesas()"
                  style="padding:6px 14px;background:transparent;border:1px solid color-mix(in srgb,var(--text) 15%,transparent);
                  border-radius:6px;color:var(--muted2);font-size:12px;cursor:pointer">
                  Cancelar
                </button>
              </div>
            </div>

            ${despesas.length === 0
          ? `<div style="color:var(--muted);font-size:12px;font-style:italic;padding:8px 0">Nenhuma despesa carregada.</div>`
          : despesas.sort((a, b) => a.chave.localeCompare(b.chave)).map(d => `
                <div id="row-desp-${d.chave}" style="display:flex;align-items:center;gap:10px;
                  background:var(--surface2);border:1px solid color-mix(in srgb,var(--text) 6%,transparent);border-radius:8px;
                  padding:8px 12px;margin-bottom:6px">
                  <input type="checkbox" class="check-despesa" data-chave="${d.chave}"
                    ${_selDespesas.has(d.chave) ? 'checked' : ''}
                    onchange="toggleSelecaoDespesa('${d.chave}', this.checked)"
                    style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
                  <span style="font-size:13px;color:var(--text);flex:1">
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
                color:var(--muted)">💵 Faturamento Real (${faturamento.length})</div>
              ${faturamento.length > 0 ? `
                <div style="display:flex;align-items:center;gap:10px">
                  <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);cursor:pointer">
                    <input type="checkbox" id="checkTodosFaturamento" onchange="toggleSelecaoTodosFaturamento(this.checked)"
                      style="width:14px;height:14px;cursor:pointer">
                    Selecionar todos
                  </label>
                  <button id="btnRemoverFaturamento" onclick="pedirConfirmacaoFaturamento()"
                    style="display:none;padding:5px 12px;background:color-mix(in srgb,var(--red) 10%,transparent);
                    border:1px solid color-mix(in srgb,var(--red) 30%,transparent);color:var(--red);border-radius:6px;
                    font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
                    🗑️ Remover selecionados (0)
                  </button>
                </div>
              ` : ''}
            </div>

            <div id="confirmFaturamentoWrap" style="display:none;background:color-mix(in srgb,var(--red) 10%,transparent);
              border:1px solid color-mix(in srgb,var(--red) 40%,transparent);border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div id="confirmFaturamentoTexto" style="color:var(--red);font-size:13px;font-weight:600;margin-bottom:10px"></div>
              <div style="display:flex;gap:8px">
                <button onclick="confirmarRemocaoFaturamento('${empresaId}')"
                  style="padding:6px 14px;background:var(--red);border:none;border-radius:6px;
                  color:#fff;font-size:12px;font-weight:600;cursor:pointer">
                  Confirmar exclusão
                </button>
                <button onclick="cancelarConfirmacaoFaturamento()"
                  style="padding:6px 14px;background:transparent;border:1px solid color-mix(in srgb,var(--text) 15%,transparent);
                  border-radius:6px;color:var(--muted2);font-size:12px;cursor:pointer">
                  Cancelar
                </button>
              </div>
            </div>

            ${faturamento.length === 0
          ? `<div style="color:var(--muted);font-size:12px;font-style:italic;padding:8px 0">Nenhum faturamento carregado.</div>`
          : faturamento.sort((a, b) => a.chave.localeCompare(b.chave)).map(f => `
                <div id="row-fat-${f.chave}" style="display:flex;align-items:center;gap:10px;
                  background:var(--surface2);border:1px solid color-mix(in srgb,var(--accent2) 10%,transparent);border-radius:8px;
                  padding:8px 12px;margin-bottom:6px">
                  <input type="checkbox" class="check-faturamento" data-chave="${f.chave}"
                    ${_selFaturamento.has(f.chave) ? 'checked' : ''}
                    onchange="toggleSelecaoFaturamento('${f.chave}', this.checked)"
                    style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
                  <span style="font-size:13px;color:var(--text);flex:1">
                    💵 ${MONTHS_PT_EMP[f.mes - 1]} ${f.ano} —
                    R$ ${(f.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>`).join('')
        }
          </div>

          <!-- Ações -->
          <div style="display:flex;flex-direction:column;gap:8px">
                        <button onclick="salvarEdicaoEmpresa('${empresaId}')"
              style="width:100%;padding:11px;background:var(--accent);border:none;border-radius:8px;
              color:#fff;font-size:14px;font-weight:600;cursor:pointer"
              onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
              ✓ Salvar Alterações
            </button>
            <button onclick="subirNovaPlanilhaEmpresa('${empresaId}')"
              style="width:100%;padding:10px;background:color-mix(in srgb,var(--green) 10%,transparent);
              border:1px solid color-mix(in srgb,var(--green) 25%,transparent);border-radius:8px;color:var(--green);
              font-size:13px;font-weight:600;cursor:pointer"
              onmouseover="this.style.background='color-mix(in srgb,var(--green) 18%,transparent)'"
              onmouseout="this.style.background='color-mix(in srgb,var(--green) 10%,transparent)'">
              📂 Subir Nova Planilha
            </button>
            <button onclick="fecharEdicao()"
              style="width:100%;padding:10px;background:transparent;
              border:1px solid color-mix(in srgb,var(--text) 8%,transparent);border-radius:8px;
              color:var(--muted);font-size:13px;cursor:pointer"
              onmouseover="this.style.color='var(--muted2)'" onmouseout="this.style.color='var(--muted)'">
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
  const badge = document.getElementById('modotesteBadge');
  if (badge) badge.style.display = 'none';

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
  // Remove overlay anterior se existir
  const old = document.getElementById('deleteEmpresaOverlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'deleteEmpresaOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="
      padding:1px;border-radius:20px;width:100%;max-width:420px;
      background:linear-gradient(135deg,color-mix(in srgb,var(--red) 45%,transparent),color-mix(in srgb,var(--red) 15%,transparent) 55%,color-mix(in srgb,var(--text) 5%,transparent) 100%);
      box-shadow:0 40px 80px -20px rgba(0,0,0,.9);
    ">
      <div style="background:var(--surface);border-radius:19px;padding:38px;text-align:center">
        <div style="width:52px;height:52px;margin:0 auto 18px;border-radius:14px;
          background:color-mix(in srgb,var(--red) 10%,transparent);border:1px solid color-mix(in srgb,var(--red) 35%,transparent);
          display:flex;align-items:center;justify-content:center;color:var(--red)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>
          </svg>
        </div>
        <div style="font-family:var(--fh);font-size:18px;font-weight:800;margin-bottom:8px;color:var(--text)">
          Excluir empresa?
        </div>
        <div style="font-size:13px;color:var(--muted2);line-height:1.6;margin-bottom:6px">
          Você está prestes a excluir permanentemente
        </div>
        <div style="font-family:var(--fh);font-size:15px;font-weight:700;color:var(--red);margin-bottom:10px">
          ${nome}
        </div>
        <div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:28px">
          Todos os meses, despesas e faturamentos serão apagados.<br>
          Essa ação <b style="color:var(--red)">não pode ser desfeita</b>.
        </div>
        <div style="display:flex;gap:10px">
          <button id="btnConfirmarDelete"
            style="flex:1;padding:13px;background:var(--red);border:none;border-radius:11px;
            color:#fff;font-family:var(--fh);font-weight:700;font-size:13px;cursor:pointer;transition:.2s;
            box-shadow:0 8px 20px -8px color-mix(in srgb,var(--red) 50%,transparent)"
            onmouseover="this.style.transform='translateY(-1px)'"
            onmouseout="this.style.transform='translateY(0)'">
            Sim, excluir empresa
          </button>
          <button id="btnCancelarDelete"
            style="flex:1;padding:13px;background:color-mix(in srgb,var(--text) 4%,transparent);border:1px solid color-mix(in srgb,var(--text) 10%,transparent);
            border-radius:11px;color:var(--muted2);font-size:13px;font-weight:600;cursor:pointer;
            transition:.2s;font-family:var(--fb)"
            onmouseover="this.style.color='var(--text)'"
            onmouseout="this.style.color='var(--muted2)'">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btnConfirmarDelete').addEventListener('click', () => {
    overlay.remove();
    deletarEmpresa(empresaId);
  });
  document.getElementById('btnCancelarDelete').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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