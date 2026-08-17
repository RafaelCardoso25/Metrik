// ═══════════════════════════════════════
//  DB — Supabase CRUD
// ═══════════════════════════════════════

// ── Salvar tudo de uma empresa ──
async function dbSalvarTudo(empresaId) {
  if (!empresaId) return;

  // Salva meses
  for (const [key, m] of Object.entries(parsedMonths)) {
    const records = m.records.map(r => ({
      ...r,
      emissao: r.emissao instanceof Date ? r.emissao.toISOString().split('T')[0] : (r.emissao || null),
      aprovacao: r.aprovacao instanceof Date ? r.aprovacao.toISOString().split('T')[0] : (r.aprovacao || null),
    }));

    const { error } = await _sb.from('meses').upsert({
      empresa_id: empresaId,
      chave: key,
      periodo: m.periodo,
      mes: m.mes,
      ano: m.ano,
      registros: records,
    }, { onConflict: 'empresa_id,chave' });

    if (error) console.error('Erro ao salvar mês', key, error);
  }

  // Salva despesas
  for (const [key, total] of Object.entries(parsedExpenses)) {
    const [ano, mes] = key.split('-');
    const { error } = await _sb.from('despesas').upsert({
      empresa_id: empresaId,
      chave: key,
      ano: parseInt(ano),
      mes: parseInt(mes),
      total: total,
    }, { onConflict: 'empresa_id,chave' });

    if (error) console.error('Erro ao salvar despesa', key, error);
  }

  // Salva faturamento real
  for (const [key, total] of Object.entries(parsedFaturamento)) {
    const [ano, mes] = key.split('-');
    const { error } = await _sb.from('faturamento').upsert({
      empresa_id: empresaId,
      chave: key,
      ano: parseInt(ano),
      mes: parseInt(mes),
      total: total,
    }, { onConflict: 'empresa_id,chave' });

    if (error) console.error('Erro ao salvar faturamento', key, error);
  }
}

// ── Carregar tudo de uma empresa ──
async function dbCarregarTudo(empresaId) {
  if (!empresaId) return;

  // Carrega meses
  const { data: meses, error: eMeses } = await _sb
    .from('meses')
    .select('*')
    .eq('empresa_id', empresaId);

  if (eMeses) { console.error('Erro ao carregar meses', eMeses); }
  else if (meses) {
    meses.forEach(m => {
      parsedMonths[m.chave] = {
        key: m.chave,
        periodo: m.periodo,
        mes: m.mes,
        ano: m.ano,
        records: (m.registros || []).map(r => ({
          ...r,
          emissao: r.emissao ? new Date(r.emissao + 'T00:00:00') : null,
          aprovacao: r.aprovacao ? new Date(r.aprovacao + 'T00:00:00') : null,
        }))
      };
    });
  }

  // Carrega despesas
  const { data: despesas, error: eDesp } = await _sb
    .from('despesas')
    .select('*')
    .eq('empresa_id', empresaId);

  if (eDesp) { console.error('Erro ao carregar despesas', eDesp); }
  else if (despesas) {
    despesas.forEach(d => {
      parsedExpenses[d.chave] = d.total;
    });
  }

  // Carrega faturamento
  const { data: faturamento, error: eFat } = await _sb
    .from('faturamento')
    .select('*')
    .eq('empresa_id', empresaId);

  if (eFat) { console.error('Erro ao carregar faturamento', eFat); }
  else if (faturamento) {
    faturamento.forEach(f => {
      parsedFaturamento[f.chave] = f.total;
    });
  }
}

// ── Deletar mês específico ──
async function dbDeletarMes(empresaId, chave) {
  const { error } = await _sb
    .from('meses')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('chave', chave);
  if (error) throw error;
}

// ── Deletar despesa específica ──
async function dbDeletarDespesa(empresaId, chave) {
  const { error } = await _sb
    .from('despesas')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('chave', chave);
  if (error) throw error;
}

// ── Deletar faturamento específico ──
async function dbDeletarFaturamento(empresaId, chave) {
  const { error } = await _sb
    .from('faturamento')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('chave', chave);
  if (error) throw error;
}

// ── Deletar empresa inteira ──
async function dbDeletarEmpresa(empresaId) {
  // Deleta em cascata (meses, despesas, faturamento, depois empresa)
  await _sb.from('meses').delete().eq('empresa_id', empresaId);
  await _sb.from('despesas').delete().eq('empresa_id', empresaId);
  await _sb.from('faturamento').delete().eq('empresa_id', empresaId);

  const { error } = await _sb
    .from('empresas')
    .delete()
    .eq('id', empresaId);

  if (error) throw error;
}

// ── Criar empresa ──
async function dbCriarEmpresa(dados) {
  const { data: { user } } = await _sb.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await _sb
    .from('empresas')
    .insert({
      usuario_id: user.id,
      nome: dados.nome,
      vendedor: dados.vendedor,
      cliente: dados.cliente,
      proposta: dados.proposta,
      meta: dados.meta || 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Atualizar empresa ──
async function dbAtualizarEmpresa(empresaId, dados) {
  const { error } = await _sb
    .from('empresas')
    .update({
      nome: dados.nome,
      vendedor: dados.vendedor,
      cliente: dados.cliente,
      proposta: dados.proposta,
      meta: dados.meta || 0,
    })
    .eq('id', empresaId);

  if (error) throw error;
}

// ── Listar empresas do usuário ──
async function dbListarEmpresas() {
  const { data, error } = await _sb
    .from('empresas')
    .select('*')
    .order('criado_em', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ── Carregar dados de edição (meses, despesas, faturamento) ──
async function dbCarregarDadosEdicao(empresaId) {
  const [
    { data: meses },
    { data: despesas },
    { data: faturamento }
  ] = await Promise.all([
    _sb.from('meses').select('chave,periodo,mes,ano').eq('empresa_id', empresaId),
    _sb.from('despesas').select('chave,mes,ano,total').eq('empresa_id', empresaId),
    _sb.from('faturamento').select('chave,mes,ano,total').eq('empresa_id', empresaId),
  ]);

  return {
    meses: meses || [],
    despesas: despesas || [],
    faturamento: faturamento || [],
  };
}
// ═══════════════════════════════════════
//  EXCLUÍDOS DA ABA RECUPERAR
// ═══════════════════════════════════════
async function dbListarRecExcluidos(empresaId) {
  const { data, error } = await _sb
    .from('recuperar_excluidos')
    .select('nome_norm,nome')
    .eq('empresa_id', empresaId);
  if (error) throw error;
  return data || [];
}

async function dbSalvarRecExcluido(empresaId, nomeNorm, nome) {
  const { error } = await _sb
    .from('recuperar_excluidos')
    .upsert({ empresa_id: empresaId, nome_norm: nomeNorm, nome: nome },
            { onConflict: 'empresa_id,nome_norm' });
  if (error) throw error;
}

async function dbRemoverRecExcluido(empresaId, nomeNorm) {
  const { error } = await _sb
    .from('recuperar_excluidos')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('nome_norm', nomeNorm);
  if (error) throw error;
}
