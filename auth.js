// auth.js
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    storageKey: 'metrik_session',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

// ── Verifica se está logado ao carregar qualquer página ──
async function authGuard() {
  const { data: { session } } = await _sb.auth.getSession();
  const isLoginPage = window.location.pathname.includes('login.html');

  if (!session && !isLoginPage) {
    window.location.href = 'login.html';
    return false;
  }

  if (session && isLoginPage) {
    const aprovado = await _verificarAprovacao(session.user.id);
    if (!aprovado) {
      await _sb.auth.signOut();
      return false;
    }
    window.location.href = 'index.html';
    return false;
  }

  if (session && !isLoginPage) {
    const aprovado = await _verificarAprovacao(session.user.id);
    if (!aprovado) {
      await _sb.auth.signOut();
      window.location.href = 'login.html';
      return false;
    }
    _renderUserBar(session.user.email);
  }

  return true;
}

// ── Verifica se é admin ──
async function authGuardAdmin() {
  const autorizado = await authGuard();
  if (!autorizado) return false;

  const { data: { session } } = await _sb.auth.getSession();

  const { data } = await _sb
    .from('usuarios')
    .select('admin')
    .eq('id', session.user.id)
    .single();

  if (!data?.admin) {
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

// ── Verifica se usuário está aprovado na tabela ──
async function _verificarAprovacao(userId) {
  const { data, error } = await _sb
    .from('usuarios')
    .select('aprovado')
    .eq('id', userId)
    .single();

  if (error || !data) return false;
  return data.aprovado === true;
}

// ── Login ──
async function authLogin(email, password, lembrar = false) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, msg: 'E-mail ou senha incorretos.' };
  }

  const aprovado = await _verificarAprovacao(data.user.id);
  if (!aprovado) {
    await _sb.auth.signOut();
    return { ok: false, msg: 'Sua conta ainda não foi aprovada. Aguarde o administrador liberar o acesso.' };
  }

  // Se "lembrar de mim" estiver marcado, salva expiração por 30 dias
  if (lembrar) {
    const expiracao = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem('metrik_lembrar_exp', String(expiracao));
  } else {
    // Sem lembrar: expira ao fechar o navegador
    localStorage.removeItem('metrik_lembrar_exp');
  }

  return { ok: true };
}

// ── Cadastro ──
async function authCadastro(email, password) {
  const { data, error } = await _sb.auth.signUp({ email, password });

  if (error) {
    if (error.message.includes('already registered')) {
      return { ok: false, msg: 'Este e-mail já possui uma conta.' };
    }
    return { ok: false, msg: 'Erro ao criar conta. Tente novamente.' };
  }

  await _sb
    .from('usuarios')
    .insert({ id: data.user.id, email: email, aprovado: false, admin: false });

  await _sb.auth.signOut();

  return { ok: true };
}

// ── Logout ──
async function authLogout() {
  localStorage.removeItem('metrik_lembrar_exp');
  await _sb.auth.signOut();
  window.location.href = 'login.html';
}

// ── Verifica expiração do "lembrar de mim" ──
function _verificarExpiracao() {
  const exp = localStorage.getItem('metrik_lembrar_exp');

  // Se não tem expiração salva, não faz nada (Supabase controla normalmente)
  if (!exp) return;

  // Se passou dos 30 dias, desloga
  if (Date.now() > +exp) {
    localStorage.removeItem('metrik_lembrar_exp');
    _sb.auth.signOut();
  }
}

// ── Barra do usuário logado ──
function _renderUserBar(email) {
  const bar = document.createElement('div');
  bar.id = 'auth-user-bar';
  bar.style.cssText = `
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 32px;
    background: #0F1320;
    border-top: 1px solid #1E2640;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 16px;
    gap: 12px;
    z-index: 9999;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
  `;
  bar.innerHTML = `
    <span style="color:#64748B;">Logado como</span>
    <span style="color:#94A3B8;font-weight:600;">${email}</span>
    <button onclick="authLogout()" style="
      background:#1E2640;
      color:#F87171;
      border:1px solid #F87171;
      border-radius:4px;
      padding:2px 10px;
      font-size:11px;
      cursor:pointer;
      font-family:inherit;
    ">Sair</button>
  `;
  document.body.appendChild(bar);
}

// ── Escuta mudanças de sessão ──
_sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!isLoginPage) window.location.href = 'login.html';
  }
});

// ── Verifica expiração ao carregar ──
_verificarExpiracao();

if (!window.location.pathname.includes('admin.html')) {
  authGuard();
}