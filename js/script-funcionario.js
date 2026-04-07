
const API_URL = 'https://javisgamesbackend.onrender.com'; 
const token = localStorage.getItem('access_token');
let chatAdminInterval = null;
let selecionadoId = null; // ID do Aluno ou Codigo da Turma
let nivelUsuarioLogado = 0; 
let usuarioLogadoId = null; // Para filtros de professor
let cacheFestasAniversario = new Map(); // id -> objeto festa

// Estado do Chat - Padrão para 'conversas' (Histórico Recente)
let modoChat = 'conversas'; 

// --- TOGGLE SIDEBAR MOBILE ---
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    
    if (sb.classList.contains('-translate-x-full')) {
        sb.classList.remove('-translate-x-full');
        ov.classList.remove('hidden');
    } else {
        sb.classList.add('-translate-x-full');
        ov.classList.add('hidden');
    }
}

// =============================
// Relatórios: Frequência / Faltas
// =============================

async function carregarRelatorioFrequencia() {
    const body = document.getElementById('frequencia-conteudo-body');
    const busca = document.getElementById('busca-frequencia')?.value || '';
    if (!body) return;

    try {
        // Certifique-se que o backend também foi alterado para consultar a VIEW nesta rota
        const url = `${API_URL}/admin/relatorio-frequencia-geral${busca ? `?q=${encodeURIComponent(busca)}` : ''}`;
        const res = await fetchAdmin(url);
        const dados = await res.json();

        body.innerHTML = dados.map(item => {
            const dataFmt = item.data_aula ? new Date(item.data_aula + "T00:00:00").toLocaleDateString('pt-BR') : '-';
            
            // Mapeamento compatível com a VIEW vw_frequencia_dashboard
            const nomeAluno = item.nome_aluno || item.nome || 'Sem Nome';
            const codTurma = item.codigo_turma || item.turma || '---';
            const nomeProf = item.nome_professor_atual || item.professor || '---';

            return `
                <tr class="border-b border-[#333] hover:bg-[#2a2a2a] transition-colors">
                    <td class="p-4 font-mono text-xs">${dataFmt}</td>
                    <td class="p-4 font-bold text-white">${nomeAluno}</td>
                    <td class="p-4 text-xs">${codTurma}</td>
                    <td class="p-4">
                        <input type="text" id="curso-${item.id}" value="${item.curso || ''}" 
                            class="bg-[#111] border border-[#444] rounded px-2 py-1 text-xs text-gray-400 w-full focus:border-[#00FFFF] outline-none"
                            placeholder="Curso...">
                    </td>
                    <td class="p-4">
                        <input type="text" id="prof-${item.id}" value="${nomeProf}" 
                            class="bg-[#111] border border-[#444] rounded px-2 py-1 text-xs text-white w-full focus:border-[#00FFFF] outline-none"
                            placeholder="Professor...">
                    </td>
                    <td class="p-4 text-center">
                        <select id="status-${item.id}" class="bg-[#111] border border-[#444] rounded text-xs p-1 outline-none ${item.status === 'P' ? 'text-green-400' : 'text-red-400'}">
                            <option value="P" ${item.status === 'P' ? 'selected' : ''}>P</option>
                            <option value="F" ${item.status === 'F' ? 'selected' : ''}>F</option>
                        </select>
                    </td>
                    <td class="p-4 text-right">
                        <button onclick="salvarEdicaoFrequencia(${item.id})" class="text-[#00FFFF] hover:text-white transition">
                            <i class="fas fa-save"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) { console.error("Erro ao carregar relatório:", e); }
}

async function salvarEdicaoFrequencia(id) {
    // Captura os três campos editáveis
    const novoCurso = document.getElementById(`curso-${id}`).value;
    const novoProfessor = document.getElementById(`prof-${id}`).value;
    const novoStatus = document.getElementById(`status-${id}`).value;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/frequencia-eventos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                curso: novoCurso,
                professor: novoProfessor,
                status: novoStatus
            })
        });

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Registro Atualizado!',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                background: '#222',
                color: '#fff'
            });
            
            // Se o dashboard estiver aberto em background, atualiza os gráficos
            if (typeof renderizarAnalisesFrequencia === 'function') renderizarAnalisesFrequencia();
        } else {
            Swal.fire("Erro", "Falha ao salvar curso/professor", "error");
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Erro", "Falha na conexão", "error");
    }
}


// =========================
// RESUMO RELATÓRIO DE FALTAS
// =========================


// Listener do botão do resumo (se existir na página)
document.getElementById('btnCarregarResumoFaltas')?.addEventListener('click', carregarResumoFaltas);

document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
        if(window.innerWidth < 768) { toggleSidebar(); }
    });
});

// --- FUNÇÕES GERAIS ---
async function verificarPermissoes() {
    if (!token) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Faça login.', background: '#222', color: '#fff' })
            .then(() => { window.location.href = 'IndexHome.html'; });
        return;
    }
    try {
    const response = await fetchAdmin(`${API_URL}/admin/meus-dados`);
        if (!response) return;

        if (response.status === 403) {
          const err = await response.json().catch(()=> ({}));
          Swal.fire({
            icon: 'error',
            title: 'Sem acesso / vínculo',
            text: err.detail || 'Seu usuário não está vinculado na tb_colaboradores (user_id) ou está inativo.',
            background:'#222', color:'#fff'
          });
          return; // 👈 não desloga aqui
        }
        
        if (!response.ok) throw new Error("Sessão inválida");
        const dados = await response.json();

        console.log("NÍVEL DO USUÁRIO:", dados.nivel);
        nivelUsuarioLogado = dados.nivel;
        usuarioLogadoId = dados.id_colaborador;
        
        document.getElementById('nome-usuario-logado').innerText = dados.nome;
        document.getElementById('email-usuario-logado').innerText = dados.cargo;
        const nomesUnidades = { 1: "CUIABÁ", 2: "TERESINA" };
        const nomeReal = nomesUnidades[dados.unidade] || "MATRIZ";
        document.getElementById('label-cargo').innerText = `${dados.cargo.toUpperCase()} - ${nomeReal}`;
        
        document.getElementById('perfil-card-nome').innerText = dados.nome;
        document.getElementById('perfil-card-cargo').innerText = dados.cargo;
        document.getElementById('perfil-card-id').innerText = "#" + (dados.id_colaborador || '---');
        document.getElementById('perfNome').value = dados.nome || '';
        document.getElementById('perfTel').value = dados.telefone || '';
        document.getElementById('perfEmailContato').value = dados.email_contato || '';
        
        aplicarRegras(dados.nivel);
    } catch (e) {
        console.error(e); localStorage.removeItem('access_token'); window.location.href = 'IndexHome.html';
    }
}

function aplicarRegras(nivel) {
    console.log("Aplicando regras para nível:", nivel);
    const menuInsc = document.getElementById('menu-inscricoes');

    // ✅ inclua menu-aniversario aqui
    const menus = [
      'menu-inscricoes', 'menu-alunos', 'menu-aulas-experimentais', 'menu-agenda', 'menu-atendimento',
      'menu-cadastro', 'menu-novo-usuario',
      'menu-reposicao', 'menu-turmas', 'menu-equipe',
      'menu-chamada', 'menu-aniversario'
    ];




    const menusAcad = ['menu-turmas', 'menu-frequencia', 'menu-chamada', 'menu-reposicao', 'menu-feriados', 'menu-atendimento'];

    // Nível 5 (Professor) e Nível 4 (Coordenador) acessam o Acadêmico
    if (nivel === 5 || nivel >= 4) {
        menusAcad.forEach(m => {
            const el = document.getElementById(m);
            if (el) el.classList.remove('bloqueado');
        });
    }

    // bloqueia tudo
    menus.forEach(m => {
        const el = document.getElementById(m);
        if (el) el.classList.add('bloqueado');
    });

    // Libere para professores e cargos superiores
    if (nivel >= 4 || nivel === 5) {
        const mc = document.getElementById('menu-chamada');
        if (mc) mc.classList.remove('bloqueado');
    }

    const menuAExp = document.getElementById('menu-aulas-experimentais');
    if (menuAExp) menuAExp.classList.remove('bloqueado'); // TODO MUNDO VÊ


    if (nivel >= 4) {
        const mt = document.getElementById('menu-turmas');
        const mr = document.getElementById('menu-reposicao');
        const me = document.getElementById('menu-equipe');
        if (mt) mt.classList.remove('bloqueado');
        if (mr) mr.classList.remove('bloqueado');
        if (me) me.classList.remove('bloqueado');
    }

    // ✅ só 8+ pode ver aniversario e o restante admin
    if (nivel >= 8) {
        menus.forEach(m => {
            const el = document.getElementById(m);
            if (el) el.classList.remove('bloqueado');
        });
        showTab('dashboard');
    }

    if (nivel >= 9) {
        const filtroEq = document.getElementById('filtroCidadeEquipe');
        if (filtroEq) filtroEq.classList.remove('hidden');

        const filtroLeads = document.getElementById('filtroCidadeLeads');
        if (filtroLeads) filtroLeads.classList.remove('hidden');
    } else if (nivel === 5) {
        ['menu-alunos', 'menu-agenda', 'menu-atendimento'].forEach(m => {
            const el = document.getElementById(m);
            if (el) el.classList.remove('bloqueado');
        });
        showTab('agenda');
    } else if (nivel === 3) {
        ['menu-inscricoes', 'menu-cadastro', 'menu-agenda'].forEach(m => {
            const el = document.getElementById(m);
            if (el) el.classList.remove('bloqueado');
        });
        showTab('inscricoes');
    } else if (nivel === 2) {
        ['menu-agenda', 'menu-atendimento'].forEach(m => {
            const el = document.getElementById(m);
            if (el) el.classList.remove('bloqueado');
        });
        showTab('atendimento');
    }
}


async function showTab(tabId) {
  const targetTab = document.getElementById(tabId);
  if (!targetTab) return;

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  targetTab.classList.remove('hidden');

  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.remove('active', 'border-r-4', 'border-[#00FFFF]', 'bg-white/5', 'text-[#00FFFF]');
    if (el.id === 'menu-perfil') el.classList.remove('bg-white/5');
  });

  const link = document.getElementById('menu-' + tabId);
  if (link) {
    link.classList.add('active');
    if (tabId === 'perfil') link.classList.add('bg-white/5');
  }

  if (tabId === 'reposicao') {
    carregarSelectRepTurma();
    carregarSelectProfessores();
    carregarSelectAlunos();
    renderCalendar(); // ✅ agora o calendário é aqui
    carregarReposicoes(); // 🚀 ESSA É A LINHA QUE FALTAVA PARA A TABELA FUNCIONAR!
  }

  if (tabId === 'dashboard') carregarDashboard();
  if (tabId === 'cadastro') carregarOpcoesTurmas();
  if (tabId === 'inscricoes') carregarInscricoes();
  if (tabId === 'alunos') carregarAlunos();
  if (tabId === 'aulas-experimentais') carregarAulasExperimentais();
  if (tabId === 'novo-usuario') carregarAlunosParaNovoUsuario();
  if (tabId === 'atendimento') atualizarListaChat();
  if (tabId === 'turmas') carregarListaTurmas();
  if (tabId === 'chamada') carregarTurmasParaChamada();
  if (tabId === 'equipe') { carregarCargosSelect(); carregarListaEquipe(); }
  if (tabId === 'dashboard') {
      carregarDashboard();
      carregarDashboardFrequenciaCompleto(); // 👈 Nome da nova função unificada
  }
  if (tabId === 'frequencia') {
      popularSelectTurmasFrequencia(); 
  }
  if (tabId === 'relatorio-faltas') carregarRelatorioFaltas();
  if (tabId === 'feriados') carregarListaFeriados();

  if (tabId === 'aniversario') {
    await carregarFiltrosFestasAniversario();
    carregarFestasAniversario();
  }

  setTimeout(aplicarMascaras, 100);
}

// --- DASHBOARD ---
let chartLeads = null;
let chartCursos = null;

async function carregarDashboard() {
    try {
        const res = await fetchAdmin(`${API_URL}/admin/dashboard-stats`);
        if (!res || !res.ok) {
            console.warn("Falha na resposta do dashboard. Verifique o CORS ou o Token.");
            return;
        }
        
        const dados = await res.json();

        // Verificação de segurança para cada elemento antes de tentar escrever
        const atualizarElemento = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.innerText = valor ?? 0;
        };

        if (dados && dados.escola) {
            const elAlunos = document.getElementById('dash-total-alunos');
            const elTurmas = document.getElementById('dash-total-turmas');
            
            // Verificação de segurança (Anti-Null)
            if (elAlunos) elAlunos.innerText = dados.escola.total_alunos ?? 0;
            if (elTurmas) elTurmas.innerText = dados.escola.turmas_ativas ?? 0;
        }

        if (dados && dados.leads) {
            atualizarElemento('dash-conversao', dados.leads.conversao + '%');
            atualizarElemento('dash-pendentes', dados.leads.pendentes);
            atualizarElemento('dash-atendimento', dados.leads.atendimento);
            atualizarElemento('dash-vendas', dados.leads.matriculados);
        }

        // Atualiza os gráficos se eles existirem
        if (dados.grafico_cursos) renderizarGraficoCursos(dados.grafico_cursos);
        
    } catch(e) { 
        console.error("Erro dashboard:", e); 
    }
}

/* ============================================================
   GESTÃO DE TURMAS
   ============================================================ */

// 1. CARREGAR LISTA
async function carregarListaTurmas() {
    const tbody = document.getElementById('listaTurmasBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-600 italic">Sincronizando...</td></tr>';
    try {
        const res = await fetchAdmin(`${API_URL}/admin/gerenciar-turmas`);
        const turmas = await res.json();
        tbody.innerHTML = '';
        if(turmas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-500 italic">Nenhuma turma.</td></tr>';
            return;
        }
        turmas.forEach(t => {
            let badgeClass = 'bg-gray-500/10 text-gray-500 border-gray-500/20';
            if(t.status === 'Planejada') badgeClass = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            else if(t.status === 'Em Andamento') badgeClass = 'bg-green-500/10 text-green-400 border-green-500/20';
            else if(t.status === 'Fechada') badgeClass = 'bg-red-500/10 text-red-400 border-red-500/20';

            tbody.innerHTML += `
                <tr class="hover:bg-white/[0.02] transition-colors border-b border-[#1a1a1a]">
                    <td class="p-4">
                        <div class="text-[#00FFFF] font-mono font-bold">${t.codigo_turma}</div>
                        <div class="text-white text-[11px] font-bold uppercase">${t.nome_curso}</div>
                    </td>
                    <td class="p-4">
                        <div class="text-gray-300 font-medium">${t.dia_semana} (${t.horario})</div>
                        <div class="text-[10px] text-gray-500 uppercase font-bold">Prof: ${t.tb_colaboradores?.nome_completo || '---'}</div>
                    </td>
                    <td class="p-4 text-center">
                        <span class="px-2 py-1 rounded-full border ${badgeClass} text-[9px] font-black uppercase tracking-tighter">${t.status}</span>
                    </td>
                    <td class="p-4 text-right">
                        <button onclick="prepararEdicaoTurma('${encodeURIComponent(JSON.stringify(t))}')" class="p-2 text-gray-400 hover:text-[#00FFFF] transition-all"><i class="fas fa-edit text-lg"></i></button>
                    </td>
                </tr>`;
        });
    } catch(e) { tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-red-500">Erro ao carregar.</td></tr>'; }
}

// 4. SALVAR (FIM DO ERRO 400)
async function salvarTurmaModal(codigoExistente = null) {
    const btn = document.getElementById('modalConfirmBtn');
    
    // MAPEAMENTO: O HTML usa 'tmCodigo', mas a API (Python) exige 'codigo' e 'curso'
    const dados = {
        codigo: document.getElementById('tmCodigo').value.trim(),
        curso: document.getElementById('tmCurso').value,
        id_professor: document.getElementById('tmProfessor').value || null,
        dia_semana: document.getElementById('tmDia').value,
        horario: document.getElementById('tmHorario').value,
        status: document.getElementById('tmStatus').value,
        sala: document.getElementById('tmSala')?.value || "Lab 1",
        tipo: document.getElementById('tmTipo')?.value || "PARTICULAR"
    };

    // FIM DO ERRO PGRST204: Garantimos que data_termino_real NUNCA seja enviado
    delete dados.data_termino_real;

    const url = codigoExistente ? `${API_URL}/admin/editar-turma/${codigoExistente}` : `${API_URL}/admin/salvar-turma`;
    const method = codigoExistente ? 'PUT' : 'POST';

    if (btn) { btn.innerText = "PROCESSANDO..."; btn.disabled = true; }

    try {
        const res = await fetchAdmin(url, { 
            method, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(dados) 
        });

        if (res && res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', timer: 1500, showConfirmButton: false, background: '#111', color: '#fff' });
            fecharModalUniversal();
            carregarListaTurmas();
        } else {
            const erroJson = await res.json();
            // Formata o erro da API para ser legível (evita o [object Object])
            const msg = Array.isArray(erroJson.detail) 
                ? erroJson.detail.map(e => `${e.loc[1]}: ${e.msg}`).join('<br>') 
                : erroJson.detail;
                
            Swal.fire({ icon: 'error', title: 'Erro de Validação', html: msg, background: '#111', color: '#fff' });
        }
    } catch(err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: 'Falha ao comunicar com o servidor.', background: '#111', color: '#fff' });
    } finally {
        if (btn) { btn.innerText = "SALVAR"; btn.disabled = false; }
    }
}

async function salvarTurma(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarTurma');
    const originalText = btn.innerText; btn.innerText = "SALVANDO..."; btn.disabled = true;
    
    const tipoEl = document.getElementById('tmTipo');
    const tipoValor = tipoEl ? tipoEl.value : 'PARTICULAR';

    const dados = {
        codigo: document.getElementById('tmCodigo').value,
        curso: document.getElementById('tmCurso').value,
        id_professor: document.getElementById('tmProfessor').value || null,
        dia_semana: document.getElementById('tmDia').value,
        horario: document.getElementById('tmHorario').value,
        sala: document.getElementById('tmSala').value,
        status: document.getElementById('tmStatus').value,
        tipo: tipoValor, 
        data_inicio: document.getElementById('tmDataInicio').value || null,
        qtd_aulas: document.getElementById('tmQtdAulas').value || 0,
        data_termino_real: document.getElementById('tmDataFinal').value || null
    };
    
    let editandoTurmaCodigo = document.getElementById('tmCodigo').disabled ? document.getElementById('tmCodigo').value : null;
    let url = `${API_URL}/admin/salvar-turma`; let method = 'POST';
    if(editandoTurmaCodigo) { url = `${API_URL}/admin/editar-turma/${editandoTurmaCodigo}`; method = 'PUT'; }
    
    try {
    const res = await fetchAdmin(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    if (!res) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        if(res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: editandoTurmaCodigo ? 'Turma editada!' : 'Turma criada!', timer: 2000, showConfirmButton: false, background: '#222', color: '#fff' });
            limparFormTurma(); carregarListaTurmas();
        } else {
            const erro = await res.json();
            Swal.fire({ icon: 'error', title: 'Erro', text: erro.detail || 'Falha ao salvar turma.', background: '#222', color: '#fff' });
        }
    } catch(err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão', background: '#222', color: '#fff' });
    } finally { btn.innerText = originalText; btn.disabled = false; }
}

function limparFormTurma() {
    document.getElementById('formTurma').reset();
    document.getElementById('tituloFormTurma').innerText = "Nova Turma";
    document.getElementById('tmCodigo').disabled = false;
    document.getElementById('btnSalvarTurma').innerText = "SALVAR";
}

async function carregarSelectProfessorTurma() {
    const select = document.getElementById('tmProfessor');
    
    // VERIFICAÇÃO DE SEGURANÇA: Se o elemento não existir na página 
    // (ex: modal fechado), a função para aqui e evita o erro TypeError.
    if (!select) return;

    // Evita recarregar a lista se ela já possuir dados (mais do que a opção padrão)
    if (select.options && select.options.length > 1) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-professores`);
        if (!res) return;

        const profs = await res.json();
        
        // Limpa e define a opção inicial
        select.innerHTML = '<option value="">Sem Professor</option>';
        
        // Preenche o seletor com os professores vindos da API
        profs.forEach(p => { 
            select.innerHTML += `<option value="${p.id_colaborador}">${p.nome_completo}</option>`; 
        });
    } catch (e) {
        console.error("Erro ao carregar lista de professores:", e);
    }
}


// --- LEADS ---
async function carregarInscricoes() {
    const tbody = document.getElementById('listaInscricoesBody');
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Carregando...</td></tr>';
    
    const filtroSelect = document.getElementById('filtroCidadeLeads');
    const idUnidade = filtroSelect ? filtroSelect.value : "";

    try {
        let url = `${API_URL}/admin/leads-crm`;
        if (idUnidade) url += `?filtro_unidade=${idUnidade}`;

    const res = await fetchAdmin(url);
    if (!res) { tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar.</td></tr>'; return; }
        if (!res.ok) throw new Error("Erro API");
        const leads = await res.json();
        
        tbody.innerHTML = '';
        if(leads.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhum lead encontrado.</td></tr>'; 
            return; 
        }

        let pendentes=0, emAtend=0, vendas=0;
        const podeEditar = [3, 4, 8, 9, 10].includes(nivelUsuarioLogado);
        const disabledAttr = podeEditar ? '' : 'disabled style="opacity: 0.5; cursor: not-allowed;"';

        leads.forEach(lead => {
            if(lead.status === 'Pendente') pendentes++;
            if(lead.status === 'Em Atendimento') emAtend++;
            if(lead.status === 'Matriculado') vendas++;
            
            let badgeTipo = lead.ja_e_aluno 
                ? '<span class="bg-green-900 text-green-300 px-2 py-1 text-xs rounded border border-green-700 font-bold">ALUNO</span>' 
                : '<span class="bg-blue-900 text-blue-300 px-2 py-1 text-xs rounded border border-blue-700 font-bold">LEAD</span>';
            
            let badgeEspera = "";
            if (lead.status_vagas === 'lista_espera') {
                badgeEspera = '<div class="mt-1"><span class="bg-orange-900 text-orange-200 px-2 py-0.5 rounded text-[10px] border border-orange-700 font-bold"><i class="fas fa-clock mr-1"></i>LISTA DE ESPERA</span></div>';
            }

            let color = lead.status === 'Matriculado' ? 'text-green-400 font-bold' : 'text-white';
            
            let badgeCidade = "";
            if (idUnidade === "" && lead.id_unidade) { 
                const nomeCid = lead.id_unidade === 1 ? "CBA" : (lead.id_unidade === 2 ? "THE" : "");
                if(nomeCid) badgeCidade = `<span class="ml-2 text-[9px] bg-gray-700 text-gray-300 px-1 rounded border border-gray-600">${nomeCid}</span>`;
            }

            const wppLink = lead.whatsapp ? `https://wa.me/55${lead.whatsapp.replace(/\D/g,'')}` : '#';

            tbody.innerHTML += `
                <tr class="border-b border-[#333] hover:bg-[#2a2a2a] transition">
                    <td class="p-4 align-middle">${badgeTipo}</td>
                    <td class="p-4 align-middle">
                        <div class="font-bold text-white flex items-center">
                            ${lead.nome || 'Sem Nome'} ${badgeCidade}
                        </div>
                        <div class="text-xs text-gray-500 font-mono mt-1">${lead.cpf || '-'}</div>
                        ${badgeEspera}
                    </td>
                    <td class="p-4 align-middle">
                        <div class="text-xs text-gray-300 font-bold">${lead.workshop || '-'}</div>
                        <div class="text-[#00FFFF] text-xs mt-1"><i class="far fa-calendar mr-1"></i>${lead.data_agendada || '-'}</div>
                    </td>
                    <td class="p-4 align-middle">
                        <select onchange="atualizarStatus(${lead.id}, this.value)" class="status-select ${color} w-full" ${disabledAttr}>
                            <option value="Pendente" ${lead.status==='Pendente'?'selected':''}>🔴 Pendente</option>
                            <option value="Em Atendimento" ${lead.status==='Em Atendimento'?'selected':''}>🟡 Atendimento</option>
                            <option value="Matriculado" ${lead.status==='Matriculado'?'selected':''}>🟢 Matriculado</option>
                            <option value="Perdido" ${lead.status==='Perdido'?'selected':''}>⚫ Perdido</option>
                        </select>
                        <div class="text-[10px] text-gray-500 mt-1">Resp: ${lead.vendedor || '-'}</div>
                    </td>
                    <td class="p-4 align-middle">
                        <a href="${wppLink}" target="_blank" class="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-xs font-bold flex items-center justify-center w-fit transition">
                            <i class="fab fa-whatsapp mr-1"></i> Chamar
                        </a>
                    </td>
                </tr>`;
        });
        
        if(document.getElementById('dash-pendentes')) document.getElementById('dash-pendentes').innerText = pendentes;
        if(document.getElementById('dash-atendimento')) document.getElementById('dash-atendimento').innerText = emAtend;
        if(document.getElementById('dash-vendas')) document.getElementById('dash-vendas').innerText = vendas;

    } catch(e) { 
        console.error("Erro leads:", e); 
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-400">Erro ao carregar leads. Verifique o console.</td></tr>'; 
    }
}

async function atualizarStatus(id, novoStatus) {
    try {
    const statusRes = await fetchAdmin(`${API_URL}/admin/leads-crm/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: novoStatus }) });
    if (!statusRes) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        carregarInscricoes();
    } catch(e) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao atualizar', background: '#222', color: '#fff' }); }
}

async function carregarSelectAlunos() {
        const select = document.getElementById('repIdAluno');
    if (select.options.length > 1) return; 
    try {
    const res = await fetchAdmin(`${API_URL}/admin/listar-alunos`);
    if (!res) { select.innerHTML = '<option>Erro ao carregar lista</option>'; return; }
        const alunos = await res.json();
        select.innerHTML = '<option value="" disabled selected>Selecione o Aluno...</option>';
        alunos.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
        alunos.forEach(a => { select.innerHTML += `<option value="${a.id_aluno}">${a.nome_completo}</option>`; });
    } catch (e) { select.innerHTML = '<option>Erro ao carregar lista</option>'; }
}

async function carregarSelectRepTurma() {
        const select = document.getElementById('repTurma');
    if(select.options.length > 1) return; 
    try {
    const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
    if (!res) { select.innerHTML = '<option>Erro ao carregar</option>'; return; }
        const dados = await res.json();
        select.innerHTML = '<option value="" disabled selected>Selecione a Turma...</option>';
        dados.forEach(t => { select.innerHTML += `<option value="${t.codigo_turma}" data-prof="${t.id_professor}">${t.codigo_turma} - ${t.nome_curso || 'Curso'}</option>`; });
    } catch(e) { select.innerHTML = '<option>Erro ao carregar</option>'; }
}

async function carregarSelectProfessores() {
        const select = document.getElementById('repProfessor');
    if(select.options.length > 1) return;
    try {
    const res = await fetchAdmin(`${API_URL}/admin/listar-professores`);
    if (!res) { select.innerHTML = '<option>Erro ao carregar</option>'; return; }
        const dados = await res.json();
        select.innerHTML = '<option value="" disabled selected>Selecione a Turma primeiro...</option>';
        dados.forEach(p => select.innerHTML += `<option value="${p.id_colaborador}">${p.nome_completo}</option>`);
    } catch(e) {}
}

function autoSelecionarProfessor() {
    const selectTurma = document.getElementById('repTurma');
    const selectProf = document.getElementById('repProfessor');
    const optionSelecionada = selectTurma.options[selectTurma.selectedIndex];
    const idProfessorDaTurma = optionSelecionada.getAttribute('data-prof');
    if (idProfessorDaTurma) selectProf.value = idProfessorDaTurma;
}

async function carregarOpcoesTurmas() {
        const select = document.getElementById('cadTurma');
    if (select.options.length > 1) return;
    try {
    const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
    if (!res) { select.innerHTML = '<option value="" disabled>Nenhuma turma encontrada</option>'; return; }
        const turmas = await res.json();
        select.innerHTML = '<option value="" disabled selected>Selecione uma turma...</option>';
        if (turmas.length === 0) { select.innerHTML += '<option value="" disabled>Nenhuma turma encontrada</option>'; return; }
        turmas.forEach(t => {
            const texto = `${t.codigo_turma} - ${t.nome_curso || 'Curso'} (${t.horario || ''})`;
            select.innerHTML += `<option value="${t.codigo_turma}">${texto}</option>`;
        });
    } catch (err) {}
}

async function salvarPerfil(event) {
        event.preventDefault();
    const btn = document.getElementById('btnSalvarPerfil');
    const originalText = btn.innerText;
    btn.innerText = "SALVANDO..."; btn.disabled = true;
    const dados = {
        nome: document.getElementById('perfNome').value,
        telefone: document.getElementById('perfTel').value,
        email_contato: document.getElementById('perfEmailContato').value,
        email_login: document.getElementById('perfEmailLogin').value || null,
        nova_senha: document.getElementById('perfSenha').value || null 
    };
    try {
        const res = await fetchAdmin(`${API_URL}/admin/meus-dados`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (!res) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Perfil atualizado!', text: 'Alterações salvas.', timer: 1500, showConfirmButton: false, background: '#222', color: '#fff' })
                .then(() => location.reload());
        } else {
            const err = await res.json();
            Swal.fire({ icon: 'error', title: 'Erro', text: err.detail || 'Falha ao atualizar perfil.', background: '#222', color: '#fff' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    }
    finally { btn.innerText = originalText; btn.disabled = false; }
}

async function carregarAlunos() {
    const tbody = document.getElementById('listaAlunosBody');
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center">Carregando...</td></tr>';
    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-alunos`);
        if (!res) { tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-red-500">Erro ao carregar alunos.</td></tr>'; return; }
        
        const alunos = await res.json();
        tbody.innerHTML = '';
        
        if (alunos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center">Nenhum aluno encontrado.</td></tr>';
            return;
        }

        alunos.forEach(a => {
            const t = a.tb_matriculas && a.tb_matriculas.length > 0 ? a.tb_matriculas[0] : null;
            
            // Pega o dia da semana da turma vinculada à matrícula
            const diaSemana = (t && t.tb_turmas && t.tb_turmas.dia_semana) ? t.tb_turmas.dia_semana : '-';

            let tipoBadge = '';
            if (t && t.tb_turmas && t.tb_turmas.tipo_turma) {
                if (t.tb_turmas.tipo_turma === 'PROJETO') {
                    tipoBadge = '<span class="bg-purple-900 text-purple-200 px-2 py-1 rounded text-xs border border-purple-700">PROJETO</span>';
                } else {
                    tipoBadge = '<span class="bg-blue-900 text-blue-200 px-2 py-1 rounded text-xs border border-blue-700">PARTICULAR</span>';
                }
            } else {
                tipoBadge = '<span class="text-gray-500 text-xs">-</span>';
            }

            // Botão WhatsApp
            let btnZap = '';
            if (a.celular) {
                const nums = a.celular.replace(/\D/g, '');
                btnZap = `<a href="https://wa.me/55${nums}" target="_blank" class="text-green-500 hover:text-green-400 mr-3 transition" title="Chamar no WhatsApp"><i class="fab fa-whatsapp text-lg"></i></a>`;
            }

            // Preparar dados para o modal de edição (codifica para não quebrar HTML)
            const jsonAluno = encodeURIComponent(JSON.stringify(a));

            tbody.innerHTML += `
                <tr class="border-b border-[#333] hover:bg-[#2a2a2a]">
                    <td class="p-4 font-bold text-white">${a.nome_completo}</td>
                    <td class="p-4 text-xs">${a.cpf || '-'}</td>
                    <td class="p-4 text-xs text-gray-300">${a.celular || '-'}</td>
                    <td class="p-4 text-xs text-gray-400">${a.telefone || '-'}</td>
                    <td class="p-4 text-[#00FFFF] font-mono text-xs">${t ? t.codigo_turma : '-'}</td>
                    <td class="p-4 text-xs text-gray-300 font-bold">${diaSemana}</td> <td class="p-4">${tipoBadge}</td> 
                    <td class="p-4 text-green-400 font-bold text-xs">${t ? t.status_financeiro : '-'}</td>
                    <td class="p-4 flex items-center">
                        ${btnZap}
                        <button onclick="abrirModalEditarAluno('${jsonAluno}')" class="text-gray-400 hover:text-white transition" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch(e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-red-500">Erro ao carregar alunos.</td></tr>';
    }
}

async function carregarListaEquipe() {
        const tbody = document.getElementById('listaEquipeBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Atualizando...</td></tr>';
    const filtroSelect = document.getElementById('filtroCidadeEquipe');
    const idUnidade = filtroSelect ? filtroSelect.value : "";

    try {
        let url = `${API_URL}/admin/listar-equipe`;
        if (idUnidade) { url += `?filtro_unidade=${idUnidade}`; }
        const res = await fetchAdmin(url);
        if (!res) { tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Erro.</td></tr>'; return; }
        if(res.status === 403) { tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Acesso Negado.</td></tr>'; return; }
        
        const equipe = await res.json();
        tbody.innerHTML = '';
        if(equipe.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Ninguém encontrado.</td></tr>'; return; }

        equipe.forEach(f => {
            const status = f.ativo ? 
                '<span class="text-green-400 text-xs border border-green-800 px-2 py-1 rounded">Ativo</span>' : 
                '<span class="text-red-400 text-xs border border-red-800 px-2 py-1 rounded">Inativo</span>';
            
            // Transformamos o objeto em string para passar via onclick de forma segura
            const jsonFunc = encodeURIComponent(JSON.stringify(f));
            const unidadeLabel = f.id_unidade === 1 ? "CBA" : (f.id_unidade === 2 ? "THE" : "???");
            const badgeUnidade = `<span class="text-[10px] bg-gray-700 px-1 rounded ml-2 text-gray-300">${unidadeLabel}</span>`;

            tbody.innerHTML += `
                <tr class="border-b border-[#333] hover:bg-[#2a2a2a]">
                    <td class="p-3">
                        <div class="font-bold text-white flex items-center">
                            ${f.nome_completo} ${idUnidade === "" ? badgeUnidade : ""}
                        </div>
                    </td>
                    <td class="p-3 text-[#00FFFF]">${f.tb_cargos ? f.tb_cargos.nome_cargo : '-'}</td>
                    <td class="p-3">
                        <div class="text-xs">${f.email || '-'}</div>
                        <div class="text-[10px] text-gray-500">${f.telefone || ''}</div>
                    </td>
                    <td class="p-3">${status}</td>
                    <td class="p-3 text-center">
                        <button onclick="abrirModalEditarEquipe('${jsonFunc}')" class="text-gray-400 hover:text-[#00FFFF] transition">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch(e) { tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Erro.</td></tr>'; }
}

async function abrirModalEditarEquipe(jsonDados) {
    const dados = JSON.parse(decodeURIComponent(jsonDados));
    // escape values for safe insertion into HTML
    const nomeEsc = (dados.nome_completo || '').replace(/\"/g, '&amp;quot;');
    const telEsc = (dados.telefone || '').replace(/\"/g, '&amp;quot;');

    const content = `
        <input type="hidden" id="editEqId" value="${dados.id_colaborador}">
        <div class="grid gap-3">
            <div><label class="text-xs text-gray-400">Nome</label><input type="text" id="editEqNome" value="${nomeEsc}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white"></div>
            <div><label class="text-xs text-gray-400">Cargo</label><select id="editEqCargo" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white"><option>Carregando...</option></select></div>
            <div><label class="text-xs text-gray-400">Telefone</label><input type="text" id="editEqTel" value="${telEsc}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white"></div>
            <div><label class="text-xs text-gray-400">Ativo</label>
                <select id="editEqAtivo" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white">
                    <option value="true" ${dados.ativo ? 'selected' : ''}>Ativo</option>
                    <option value="false" ${dados.ativo ? '' : 'selected'}>Inativo</option>
                </select>
            </div>
        </div>
    `;

    abrirModalUniversal('Editar Colaborador', content, async () => {
        await salvarEdicaoEquipeModal();
    });

    // popular cargos no select recém-criado
    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-cargos`);
        if (!res) return;
        const cargos = await res.json();
        const select = document.getElementById('editEqCargo');
        select.innerHTML = '';
        cargos.forEach(c => {
            const selected = c.id_cargo === dados.id_cargo ? 'selected' : '';
            select.innerHTML += `<option value="${c.id_cargo}" ${selected}>${c.nome_cargo}</option>`;
        });
    } catch (e) {
        // ignore
    }
    setTimeout(aplicarMascaras, 50);
}

async function salvarEdicaoEquipeModal() {
    const btn = document.getElementById('modalConfirmBtn');
    const originalText = btn.innerText;
    btn.innerText = 'SALVANDO...'; btn.disabled = true;
    const id = document.getElementById('editEqId').value;
    const dados = {
        nome: document.getElementById('editEqNome').value,
        telefone: document.getElementById('editEqTel').value,
        id_cargo: parseInt(document.getElementById('editEqCargo').value),
        ativo: document.getElementById('editEqAtivo').value === 'true'
    };
    try {
        const res = await fetchAdmin(`${API_URL}/admin/editar-funcionario/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
        });
        if (!res) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Atualizado!', text: 'Dados salvos.', timer: 1400, showConfirmButton: false, background: '#222', color: '#fff' });
            fecharModalUniversal(); carregarListaEquipe();
        } else {
            let errText = 'Erro ao atualizar.';
            try { const err = await res.json(); errText = err.detail || err.message || JSON.stringify(err); } catch(_) { errText = await res.text().catch(()=> errText); }
            Swal.fire({ icon: 'error', title: 'Erro', text: errText, background: '#222', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    } finally { btn.innerText = originalText; btn.disabled = false; }
}

function fecharModalEquipe() {
    document.getElementById('modalEditarEquipe').classList.add('hidden');
    document.getElementById('modalEditarEquipe').classList.remove('flex');
}

async function salvarEdicaoEquipe(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarEditEquipe');
    btn.innerText = "SALVANDO..."; btn.disabled = true;
    const id = document.getElementById('editEqId').value;
    const dados = {
        nome: document.getElementById('editEqNome').value,
        telefone: document.getElementById('editEqTel').value,
        id_cargo: parseInt(document.getElementById('editEqCargo').value),
        ativo: document.getElementById('editEqAtivo').value === "true"
    };
    try {
        const res = await fetchAdmin(`${API_URL}/admin/editar-funcionario/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
        });
        if (!res) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        if(res.ok) {
            Swal.fire({ icon: 'success', title: 'Atualizado!', text: 'Dados salvos.', timer: 1400, showConfirmButton: false, background: '#222', color: '#fff' });
            fecharModalEquipe(); carregarListaEquipe();
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao atualizar.', background: '#222', color: '#fff' });
        }
    } catch(err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    }
    finally { btn.innerText = "SALVAR"; btn.disabled = false; }
}

async function salvarFuncionario(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarEquipe');
    btn.innerText = "CADASTRANDO..."; btn.disabled = true;
    const dados = {
        nome: document.getElementById('eqNome').value,
        email: document.getElementById('eqEmail').value,
        senha: document.getElementById('eqSenha').value,
        telefone: document.getElementById('eqTelefone').value,
        id_cargo: document.getElementById('eqCargo').value
    };
    try {
        const res = await fetchAdmin(`${API_URL}/admin/cadastrar-funcionario`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
        });
        if (!res) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        if(res.ok) {
            Swal.fire({ icon: 'success', title: 'Cadastrado!', text: 'Funcionário cadastrado com sucesso.', timer: 1400, showConfirmButton: false, background: '#222', color: '#fff' });
            document.getElementById('formEquipe').reset(); carregarListaEquipe();
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao cadastrar.', background: '#222', color: '#fff' });
        }
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    }
    finally { btn.innerText = "CADASTRAR"; btn.disabled = false; }
}

// --- CHAT & REPO ---
const formReposicaoEl = document.getElementById('formReposicao');

if (formReposicaoEl) {
  formReposicaoEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]') || document.getElementById('btnAgendarReposicao');
    const textoOriginal = btn ? btn.innerText : null;
    if (btn) { btn.innerText = "AGENDANDO..."; btn.disabled = true; }

    const idAlunoVal = document.getElementById('repIdAluno')?.value;
    const idProfVal = document.getElementById('repProfessor')?.value;
    const dataHoraVal = document.getElementById('repData')?.value;
    const turmaVal = document.getElementById('repTurma')?.value;
    const conteudoVal = document.getElementById('repConteudo')?.value;

    if (!idAlunoVal || !idProfVal || !dataHoraVal || !turmaVal) {
      Swal.fire({
        icon: 'warning',
        title: 'Atenção',
        text: 'Preencha Aluno, Professor, Data e Turma.',
        background: '#222',
        color: '#fff'
      });
      if (btn) { btn.innerText = textoOriginal; btn.disabled = false; }
      return;
    }

    const dados = {
      id_aluno: parseInt(idAlunoVal),
      data_hora: dataHoraVal,
      turma_codigo: turmaVal,
      id_professor: parseInt(idProfVal),
      conteudo_aula: conteudoVal
    };

    try {
      const res = await fetchAdmin(`${API_URL}/admin/agendar-reposicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });

      if (!res) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' });
        return;
      }

      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Agendada!', text: 'Reposição agendada com sucesso.', timer: 1200, showConfirmButton: false, background: '#222', color: '#fff' });

        e.target.reset();
        fecharModalAgendarReposicao();
        renderCalendar();
      } else {
        const erroApi = await res.json().catch(() => ({ detail: 'Erro ao agendar.' }));
        Swal.fire({ icon: 'error', title: 'Erro', text: erroApi.detail || 'Erro ao agendar reposição.', background: '#222', color: '#fff' });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão', background: '#222', color: '#fff' });
    } finally {
      if (btn) { btn.innerText = textoOriginal; btn.disabled = false; }
    }
  });
}

let calendarInstance = null;
let eventosCacheReposicao = []; // Variável global para busca rápida

function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    if (calendarInstance) { calendarInstance.destroy(); }

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        height: window.innerWidth < 768 ? 'auto' : 600, // No mobile ele ajusta ao conteúdo, no PC tem altura fixa.
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
        },
        // --- ESTILO LIMPO ---
        eventDisplay: 'list-item', // Transforma em um ponto com texto pequeno
        dayMaxEvents: 3,           // Agrupa após 3 eventos para não esticar o quadrado
        
        // Procure por esta parte dentro de renderCalendar no script-funcionario.js
        dateClick: function(info) {
            // 1. Remove o destaque de qualquer outro dia que tenha sido clicado antes
            document.querySelectorAll('.fc-daygrid-day').forEach(el => {
                el.classList.remove('dia-selecionado');
            });

            // 2. Adiciona a classe de destaque ao quadrado do dia que você acabou de clicar
            info.dayEl.classList.add('dia-selecionado'); 

            // 3. Chama a função que já existe para filtrar os cards na lateral
            mostrarEventosDoDia(info.dateStr);
        },

        events: async function(info, successCallback, failureCallback) {
            try {
                const res = await fetchAdmin(`${API_URL}/admin/agenda-geral`);
                const eventos = await res.json();
                eventosCacheReposicao = eventos; // Salva para o filtro lateral
                successCallback(eventos);
                
                // Na primeira carga, mostra o que tem hoje ou nas próximas 48h
                mostrarEventosDoDia(new Date().toISOString().split('T')[0], true);
            } catch (e) { failureCallback(e); }
        },
        
        eventClick: function(info) {
            // Se clicar direto no nome do aluno no calendário, também abre o detalhe
            abrirModalRepo(encodeURIComponent(JSON.stringify(info.event)));
        }
    });

    calendarInstance.render();
}

// FUNÇÃO PARA FILTRAR E MOSTRAR NA LATERAL
function mostrarEventosDoDia(dataIso, isInitial = false) {
    const lista = document.getElementById('listaAgendaRapida');
    const titulo = document.getElementById('titulo-agenda-dia');
    if (!lista) return;

    const dataDisplay = new Date(dataIso + "T12:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    titulo.innerText = isInitial ? "Próximas 48h" : `Agenda: ${dataDisplay}`;

    const eventosDia = eventosCacheReposicao.filter(ev => {
        const dataEv = ev.start.split('T')[0];
        if (isInitial) {
            const hoje = new Date().toISOString().split('T')[0];
            const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
            return dataEv === hoje || dataEv === amanha;
        }
        return dataEv === dataIso;
    });

    if (eventosDia.length === 0) {
        lista.innerHTML = `<div class="flex flex-col items-center justify-center py-10 opacity-30"><i class="fas fa-calendar-minus text-4xl mb-2"></i><p class="text-xs">Vazio para este dia.</p></div>`;
        return;
    }

    lista.innerHTML = eventosDia.map(ev => {
        const hora = new Date(ev.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const statusCor = ev.status === 'Concluída' ? 'text-green-400' : 'text-yellow-500';
        
        // --- LÓGICA DO WHATSAPP ---
        // Se o seu backend não enviar o telefone direto no ev, o JS busca pelo ID do aluno (opcional)
        const telefoneLimpo = ev.telefone ? ev.telefone.replace(/\D/g, '') : '';
        const btnWhats = telefoneLimpo 
            ? `<a href="https://wa.me/55${telefoneLimpo}?text=Olá, confirmando sua reposição hoje às ${hora}" target="_blank" class="p-2 bg-green-600/20 text-green-500 rounded-lg hover:bg-green-600 hover:text-white transition-all"><i class="fab fa-whatsapp"></i></a>`
            : '';

        return `
            <div class="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] hover:border-[#00FFFF]/50 transition-all shadow-lg mb-3">
                <div class="flex justify-between items-center mb-2">
                    <span class="bg-[#00FFFF]/10 text-[#00FFFF] text-[10px] font-black px-2 py-0.5 rounded-md border border-[#00FFFF]/20">${hora}</span>
                    <span class="text-[9px] font-bold ${statusCor} uppercase tracking-widest">${ev.status}</span>
                </div>
                <h4 class="text-white font-bold text-sm leading-tight mb-2">${ev.nome_aluno}</h4>
                
                <div class="grid grid-cols-1 gap-1 border-t border-[#222] pt-2 mt-2">
                    <div class="flex items-center gap-2 text-gray-500 text-[10px]">
                        <i class="fas fa-chalkboard-teacher text-[#00FFFF] w-3"></i>
                        <span>${ev.nome_prof}</span>
                    </div>
                    <div class="flex items-center gap-2 text-gray-500 text-[10px]">
                        <i class="fas fa-layer-group text-gray-600 w-3"></i>
                        <span>Turma: ${ev.turma || 'N/D'}</span>
                    </div>
                </div>
                
                <div class="mt-3 flex gap-2">
                    <button onclick="abrirModalConcluirReposicao('${ev.id}')" class="flex-1 bg-[#222] hover:bg-[#00FFFF] hover:text-black text-gray-400 text-[10px] font-bold py-2 rounded-lg transition-all">
                        CONCLUIR AULA
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function atualizarListaAgenda(eventos) {
    const tbody = document.getElementById('listaAgendaBody');
    tbody.innerHTML = '';
    if (eventos.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Nada agendado.</td></tr>'; return; }
    eventos.sort((a, b) => new Date(a.start) - new Date(b.start));
    eventos.forEach(ev => {
        const dataObj = new Date(ev.start);
        let statusBadge = ev.tipo === 'reposicao' ? '<span class="text-yellow-400 text-xs">Repo</span>' : '<span class="text-blue-400 text-xs">Aula</span>';
        if (ev.presenca === true) statusBadge = '<span class="text-green-400 text-xs">✔</span>';
        else if (ev.presenca === false) statusBadge = '<span class="text-red-400 text-xs">✖</span>';
        
        const btnEditar = ev.tipo === 'reposicao' ? `<button onclick="abrirModalRepo('${encodeURIComponent(JSON.stringify(ev))}')" class="text-gray-400 hover:text-[#00FFFF]"><i class="fas fa-edit"></i></button>` : '';

        tbody.innerHTML += `<tr class="hover:bg-[#2a2a2a] border-b border-[#333]"><td class="p-4 text-[#00FFFF]">${dataObj.toLocaleDateString()} ${dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td><td class="p-4 text-white">${ev.title}</td><td class="p-4 text-center">${statusBadge}</td><td class="p-4 text-center">${btnEditar}</td></tr>`;
    });
}

function abrirModalRepo(jsonDados) {
    const dados = JSON.parse(decodeURIComponent(jsonDados));
    
    document.getElementById('editRepoId').value = dados.id;
    document.getElementById('editRepoNome').innerText = dados.nome_aluno || dados.title;
    document.getElementById('editRepoConteudo').value = dados.conteudo || dados.extendedProps?.conteudo || "";

    // Formatação da data para o input datetime-local
    if (dados.start) {
        const dataOriginal = new Date(dados.start);
        // Ajuste para o fuso horário local e formatação ISO
        const ano = dataOriginal.getFullYear();
        const mes = String(dataOriginal.getMonth() + 1).padStart(2, '0');
        const dia = String(dataOriginal.getDate()).padStart(2, '0');
        const hora = String(dataOriginal.getHours()).padStart(2, '0');
        const min = String(dataOriginal.getMinutes()).padStart(2, '0');
        
        document.getElementById('editRepoData').value = `${ano}-${mes}-${dia}T${hora}:${min}`;
    }

    // Regra de permissão: Nível 8+ (Diretor/TI) ou o próprio criador
    const temPermissao = (nivelUsuarioLogado >= 8);
    
    document.getElementById('btnSalvarRepo').disabled = !temPermissao;
    document.getElementById('btnExcluirRepo').classList.toggle('hidden', !temPermissao);

    const modal = document.getElementById('modalEditarRepo');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
}

// Função que faltava para o botão da lixeira funcionar
async function deletarReposicao() {
    const id = document.getElementById('editRepoId').value;
    if (!id) return;

    // Confirmação
    const result = await Swal.fire({
        title: 'Excluir Reposição?',
        text: "Essa ação não pode ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#333',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
        background: '#1a1a1a',
        color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/reposicao/${id}`, { 
            method: 'DELETE' 
        });

        if (!res) throw new Error('Sem resposta');

        if (res.ok) {
            Swal.fire({
                icon: 'success', title: 'Excluído!', text: 'Reposição removida.',
                timer: 1500, showConfirmButton: false, background: '#222', color: '#fff'
            });
            document.getElementById('modalEditarRepo').style.display = 'none';
            document.getElementById('modalEditarRepo').classList.add('hidden'); // Garante que fecha visualmente
            renderCalendar(); // Atualiza a agenda
        } else {
            const erro = await res.json();
            Swal.fire({ icon: 'error', title: 'Erro', text: erro.detail || 'Não foi possível excluir.', background: '#222', color: '#fff' });
        }
    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    }
}

function fecharModalRepo() {
    document.getElementById('modalEditarRepo').classList.add('hidden');
    document.getElementById('modalEditarRepo').classList.remove('flex');
}

async function salvarEdicaoRepo(event) {
  event.preventDefault();

  const btn = event.target.querySelector('button[type="submit"]');
  const textoOriginal = btn ? btn.innerText : "SALVAR";
  if (btn) { btn.innerText = "SALVANDO..."; btn.disabled = true; }

  const id = document.getElementById('editRepoId').value;

  const dadosParaEnvio = {
    data_hora: document.getElementById('editRepoData').value,
    conteudo_aula: document.getElementById('editRepoConteudo').value
  };

  try {
    const res = await fetchAdmin(`${API_URL}/admin/editar-reposicao/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosParaEnvio)
    });

    if (!res) throw new Error('Sem resposta do servidor');

    if (res.ok) {
      Swal.fire({ icon: 'success', title: 'Atualizado!', timer: 1500, showConfirmButton: false, background: '#222', color: '#fff' });
      document.getElementById('modalEditarRepo').classList.add('hidden');
      document.getElementById('modalEditarRepo').classList.remove('flex');
      renderCalendar();
    } else {
      const erro = await res.json().catch(() => ({}));
      Swal.fire({ icon: 'error', title: 'Erro', text: erro.detail || 'Falha ao salvar.', background: '#222', color: '#fff' });
    }
  } catch (e) {
    console.error(e);
    Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão ou rota inválida.', background: '#222', color: '#fff' });
  } finally {
    if (btn) { btn.innerText = textoOriginal; btn.disabled = false; }
  }
}

// --- LÓGICA DO CHAT COM 3 ABAS ---
let listaChatCache = []; // Variável global para guardar os dados e permitir pesquisa

function mudarAbaChat(modo) {
    modoChat = modo;
    ['conversas', 'alunos', 'grupo'].forEach(m => {
        const el = document.getElementById('tab-' + m);
        if(el) el.classList.remove('active');
    });
    const activeTab = document.getElementById('tab-' + modo);
    if(activeTab) activeTab.classList.add('active');
    
    const area = document.getElementById('area-chat-admin'); if(area) area.classList.add('hidden');
    const aviso = document.getElementById('aviso-selecao'); if(aviso) aviso.classList.remove('hidden');
    const input = document.getElementById('input-pesquisa-chat'); if(input) input.value = ''; 
    
    if(chatAdminInterval) clearInterval(chatAdminInterval);
    atualizarListaChat();
}

// Variável para controlar o tempo de digitação (Debounce)
let searchTimeout = null;

function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderizarListaFiltrada, 300);
}

async function atualizarListaChat() {
    const list = document.getElementById('lista-conversas');
    if(!list) return;
    list.innerHTML = '<p class="text-center text-xs text-gray-500 mt-4">Carregando...</p>';
    listaChatCache = []; 

    try {
        if (modoChat === 'conversas') {
            const title = document.getElementById('titulo-lista-chat'); if(title) title.innerText = "Histórico";
            const res = await fetchAdmin(`${API_URL}/admin/chat/historico-unificado`);
            if (!res) { list.innerHTML = '<p class="text-center text-xs text-red-500 mt-4">Erro ao carregar.</p>'; return; }
            listaChatCache = await res.json();

        } else if (modoChat === 'alunos') {
            const title = document.getElementById('titulo-lista-chat'); if(title) title.innerText = "Todos os Alunos";
            const res = await fetchAdmin(`${API_URL}/admin/listar-alunos`);
            if (!res) { list.innerHTML = '<p class="text-center text-xs text-red-500 mt-4">Erro ao carregar.</p>'; return; }
            listaChatCache = await res.json();
            listaChatCache.sort((a,b) => a.nome_completo.localeCompare(b.nome_completo));

        } else {
            const title = document.getElementById('titulo-lista-chat'); if(title) title.innerText = "Grupos das Turmas";
            const res = await fetchAdmin(`${API_URL}/admin/gerenciar-turmas`);
            if (!res) { list.innerHTML = '<p class="text-center text-xs text-red-500 mt-4">Erro ao carregar.</p>'; return; }
            const turmas = await res.json();
            if (nivelUsuarioLogado === 5 && usuarioLogadoId) {
                listaChatCache = turmas.filter(t => t.id_professor === usuarioLogadoId);
            } else {
                listaChatCache = turmas;
            }
        }
        renderizarListaFiltrada();
    } catch(e) { 
        console.error(e); 
        list.innerHTML = '<p class="text-center text-xs text-red-500 mt-4">Erro ao carregar.</p>';
    }
}

// // Nova função para desenhar a lista baseada no Input de Pesquisa
// // Variável para controlar o tempo de digitação
// let searchTimeout = null;

// OTIMIZAÇÃO 1: Debounce (Espera o usuário parar de digitar)
function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderizarListaFiltrada, 300);
}

// OTIMIZAÇÃO 2: Renderização em Memória (Buffer)
function renderizarListaFiltrada() {
    const input = document.getElementById('input-pesquisa-chat');
    const list = document.getElementById('lista-conversas');
    if(!list) return;
    
    const termo = input ? input.value.toLowerCase() : "";
    let htmlBuffer = '';

    const filtrados = listaChatCache.filter(item => {
        if (modoChat === 'conversas') {
            return item.nome.toLowerCase().includes(termo) || (item.ultima_msg && item.ultima_msg.toLowerCase().includes(termo));
        } else if (modoChat === 'alunos') {
            return item.nome_completo.toLowerCase().includes(termo);
        } else { 
            return (item.codigo_turma && item.codigo_turma.toLowerCase().includes(termo)) || 
                    (item.nome_curso && item.nome_curso.toLowerCase().includes(termo));
        }
    });

    if (filtrados.length === 0) {
        list.innerHTML = '<p class="text-center text-xs text-gray-600 mt-4">Nenhum resultado.</p>';
        return;
    }

    filtrados.forEach(item => {
        if (modoChat === 'conversas') {
            if (item.tipo === 'grupo') {
                htmlBuffer += `
                    <div onclick="abrirChatGrupo('${item.id}', '${item.nome}')" class="p-3 border-b border-[#333] cursor-pointer hover:bg-[#222] flex items-center gap-3 transition group">
                        <div class="w-8 h-8 rounded-full bg-green-900/20 border border-green-800 flex items-center justify-center text-green-400 shrink-0 group-hover:border-green-500"><i class="fas fa-users text-xs"></i></div>
                        <div class="overflow-hidden w-full">
                            <div class="flex justify-between items-center"><div class="font-bold text-gray-200 truncate text-xs">${item.nome}</div><div class="text-[9px] text-gray-600">${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>
                            <div class="text-[10px] text-gray-500 truncate italic">${item.ultima_msg}</div>
                        </div>
                    </div>`;
            } else {
                htmlBuffer += `
                    <div onclick="abrirChatPrivado(${item.id}, '${item.nome}')" class="p-3 border-b border-[#333] cursor-pointer hover:bg-[#222] flex items-center gap-3 transition group">
                        <div class="w-8 h-8 rounded-full bg-[#222] border border-[#444] flex items-center justify-center text-[#00FFFF] shrink-0 group-hover:border-[#00FFFF]"><i class="fas fa-user text-xs"></i></div>
                        <div class="overflow-hidden w-full">
                            <div class="flex justify-between items-center"><div class="font-bold text-gray-200 truncate text-xs">${item.nome}</div><div class="text-[9px] text-gray-600">${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>
                            <div class="text-[10px] text-gray-500 truncate">${item.ultima_msg}</div>
                        </div>
                    </div>`;
            }
        } else if (modoChat === 'alunos') {
            htmlBuffer += `
                <div onclick="abrirChatPrivado(${item.id_aluno}, '${item.nome_completo}')" class="p-3 border-b border-[#333] cursor-pointer hover:bg-[#222] flex items-center gap-3 transition">
                    <div class="w-8 h-8 rounded-full bg-[#222] border border-[#444] flex items-center justify-center text-gray-400 shrink-0"><i class="fas fa-user text-xs"></i></div>
                    <div class="overflow-hidden w-full"><div class="font-bold text-gray-200 truncate text-sm">${item.nome_completo}</div><div class="text-[10px] text-gray-500 truncate">Clique para iniciar</div></div>
                </div>`;
        } else { 
            htmlBuffer += `
                <div onclick="abrirChatGrupo('${item.codigo_turma}', '${item.nome_curso}')" class="p-3 border-b border-[#333] cursor-pointer hover:bg-[#222] flex items-center gap-3 transition">
                    <div class="w-8 h-8 rounded-full bg-green-900/20 border border-green-800 flex items-center justify-center text-green-400 shrink-0"><i class="fas fa-users text-xs"></i></div>
                    <div class="overflow-hidden w-full"><div class="font-bold text-gray-200 text-sm">Turma ${item.codigo_turma}</div><div class="text-[10px] text-gray-500 truncate">${item.nome_curso}</div></div>
                </div>`;
        }
    });
    list.innerHTML = htmlBuffer;
}

function abrirChatPrivado(idAluno, nome) {
    selecionadoId = idAluno;
    // Se eu estava na aba 'alunos' ou 'conversas', continuo no modo privado
    // Mas visualmente o chat é o mesmo
    configurarAreaChat(nome, "Chat Privado", "fas fa-user", "text-[#00FFFF]");
    
    // Força modo privado para o carregamento de mensagens funcionar
    // Nota: Se eu cliquei na aba 'conversas' ou 'alunos', o modoChat já está definido, mas o carregarMensagens precisa saber se é Grupo ou Privado.
    // O modoChat define a LISTA lateral. Vamos usar uma variável auxiliar para saber o TIPO de chat aberto.
    // Simplificação: Se modoChat for 'grupo', é grupo. Se for 'conversas' ou 'alunos', é privado.
    
    carregarMensagens();
    if(chatAdminInterval) clearInterval(chatAdminInterval);
    chatAdminInterval = setInterval(carregarMensagens, 3000);
}

function abrirChatPrivado(idAluno, nome) {
    selecionadoId = idAluno;
    configurarAreaChat(nome, "Chat Privado", "fas fa-user", "text-[#00FFFF]");
    carregarMensagens();
    if(chatAdminInterval) clearInterval(chatAdminInterval);
    chatAdminInterval = setInterval(carregarMensagens, 3000);
}

function abrirChatGrupo(codigoTurma, nomeCurso) {
    selecionadoId = codigoTurma;
    configurarAreaChat(`Grupo ${codigoTurma}`, nomeCurso, "fas fa-users", "text-green-400");
    carregarMensagens();
    if(chatAdminInterval) clearInterval(chatAdminInterval);
    chatAdminInterval = setInterval(carregarMensagens, 3000);
}

function configurarAreaChat(titulo, subtitulo, iconeClass, corClass) {
    const aviso = document.getElementById('aviso-selecao'); if(aviso) aviso.classList.add('hidden');
    const area = document.getElementById('area-chat-admin'); if(area) area.classList.remove('hidden');
    
    const elTitulo = document.getElementById('chat-admin-nome'); if(elTitulo) elTitulo.innerText = titulo;
    const elSub = document.getElementById('chat-admin-desc'); if(elSub) elSub.innerText = subtitulo;
    
    const iconContainer = document.getElementById('chat-header-icon');
    if(iconContainer) {
        iconContainer.className = `w-10 h-10 rounded-full bg-[#333] flex items-center justify-center border border-gray-600 ${corClass}`;
        iconContainer.innerHTML = `<i class="${iconeClass} text-lg"></i>`;
    }
    const msgs = document.getElementById('msgs-admin');
    if(msgs) msgs.innerHTML = '<p class="text-center text-xs text-gray-600 mt-10">Carregando...</p>';
}

async function carregarMensagens() {
    if (!selecionadoId) return;
    
    const div = document.getElementById('msgs-admin');
    if (!div) return;

    try {
        let msgs = [];
        let ehGrupo = false;

        // 1. Detectar se é Grupo ou Privado baseado no modo atual
        if (modoChat === 'grupo') ehGrupo = true;
        else if (modoChat === 'conversas') {
            const item = listaChatCache.find(i => i.id == selecionadoId);
            if (item && item.tipo === 'grupo') ehGrupo = true;
        }

        // --- LÓGICA DO CHAT PRIVADO (1x1) ---
        if (!ehGrupo) {
            let url = `${API_URL}/admin/chat/mensagens/${selecionadoId}`;
            // Se for professor, pode ter filtro específico (opcional, mantendo compatibilidade)
            if (nivelUsuarioLogado === 5) url += `?filtro_colaborador=meu`; 

            const res = await fetchAdmin(url);
            if (!res) return;
            msgs = await res.json();
            
            let html = '';
            
            msgs.forEach(m => {
                // Tenta identificar quem mandou usando ID (se disponível) ou fallback para flag boolean
                // Nota: O backend precisa enviar 'id_colaborador' ou 'id_remetente' para precisão 100%
                let souEu = false;
                const ehAdmin = m.enviado_por_admin;
                const idRemetente = m.id_colaborador || m.id_colaborador_remetente; // Adapte conforme seu backend retornar

                if (ehAdmin) {
                    if (usuarioLogadoId && idRemetente) {
                        souEu = (idRemetente == usuarioLogadoId);
                    } else {
                        // Fallback: Se não tem ID, assume que admin sou eu (comportamento antigo),
                        // EXCETO se o cargo for explicitamente Suporte
                        souEu = true; 
                    }
                    // Se for mensagem automática de Suporte, NUNCA é "souEu" visualmente (queremos destaque)
                    if (m.cargo_exibicao === 'Suporte' || m.nome_exibicao === 'Suporte') {
                        souEu = false;
                    }
                }

                // Configuração Visual
                let align = 'items-start'; // Esquerda
                let containerAlign = 'justify-start';
                let bg = 'bg-[#333] text-gray-200 border border-[#444]'; // Padrão Aluno (Cinza)
                let labelNome = '';

                if (souEu) {
                    // MINHA MENSAGEM -> Direita (Azul)
                    align = 'items-end';
                    containerAlign = 'justify-end';
                    bg = 'bg-[#00FFFF]/10 text-[#00FFFF] border border-[#00FFFF]/30';
                } else if (ehAdmin) {
                    // OUTRO FUNCIONÁRIO ou SUPORTE -> Esquerda
                    if (m.cargo_exibicao === 'Suporte' || m.nome_exibicao === 'Suporte') {
                        // Bot/Suporte (Laranja)
                        bg = 'bg-orange-900/20 text-orange-400 border border-orange-800';
                        labelNome = '<span class="text-[10px] text-orange-500 font-bold mb-1 block"><i class="fas fa-robot mr-1"></i>Suporte Javis</span>';
                    } else {
                        // Outro Humano (Roxo)
                        bg = 'bg-purple-900/20 text-purple-300 border border-purple-800';
                        labelNome = `<span class="text-[10px] text-purple-400 font-bold mb-1 block">${m.nome_exibicao || 'Equipe'}</span>`;
                    }
                } else {
                    // ALUNO -> Esquerda (Cinza Padrão)
                    labelNome = `<span class="text-[10px] text-gray-500 font-bold mb-1 block">${m.nome_exibicao || 'Aluno'}</span>`;
                }

                // Montagem do HTML
                html += `
                <div class="flex ${containerAlign} w-full mb-2 fade-in">
                    <div class="flex flex-col ${align} max-w-[85%] md:max-w-[70%]">
                        ${!souEu ? labelNome : ''}
                        <div class="${bg} p-3 rounded-lg text-sm shadow-sm break-words relative">
                            ${m.mensagem}
                        </div>
                        <span class="text-[9px] text-gray-600 mt-1 select-none">
                            ${new Date(m.data_hora || m.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                </div>`;
            });

            // Só atualiza o DOM se houve mudança no conteúdo (evita flicker no setInterval)
            if (div.innerHTML.length !== html.length) { 
                div.innerHTML = html; 
                div.scrollTop = div.scrollHeight; 
            }

        } else {
            // --- LÓGICA DO CHAT DE GRUPO ---
            const res = await fetchAdmin(`${API_URL}/admin/chat/turma/${selecionadoId}`);
            if (!res) return;
            msgs = await res.json();
            
            let html = '';
            msgs.forEach(m => {
                const isAluno = m.cargo_exibicao === 'Aluno';
                const isSuporte = m.cargo_exibicao === 'Suporte';
                
                let corNome = 'text-purple-400'; // Professor/Admin
                let icone = '';
                
                if (isAluno) {
                    corNome = 'text-green-400';
                } else if (isSuporte) {
                    corNome = 'text-orange-400';
                    icone = '<i class="fas fa-robot mr-1"></i>';
                }

                // No grupo, mantemos tudo à esquerda por padrão para facilitar leitura linear,
                // mas destacamos o background do usuário logado se necessário.
                let bgClass = 'bg-[#222] border border-[#333] text-gray-200';
                
                // Se quiser destacar suas mensagens no grupo também:
                // if (m.id_colaborador == usuarioLogadoId) bgClass = 'bg-[#00FFFF]/5 border border-[#00FFFF]/20 text-gray-200';

                html += `
                <div class="flex flex-col items-start mb-2 fade-in w-full">
                    <span class="text-[10px] ${corNome} font-bold ml-1 mb-0.5">
                        ${icone}${m.nome_exibicao} <span class="text-gray-600 font-normal">(${m.cargo_exibicao})</span>
                    </span>
                    <div class="${bgClass} p-2 rounded-lg max-w-[90%] text-sm shadow-sm break-words">
                        ${m.mensagem}
                    </div>
                    <span class="text-[9px] text-gray-700 ml-1">${new Date(m.data_hora || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>`;
            });

            if (div.innerHTML.length !== html.length) { 
                div.innerHTML = html; 
                div.scrollTop = div.scrollHeight; 
            }
        }
    } catch (e) { 
        console.error("Erro no chat:", e); 
    }
}

async function enviarMensagemUnified() {
    const inp = document.getElementById('admin-input');
    const txt = inp.value.trim();
    if(!txt || !selecionadoId) return;
    inp.value = ''; 

    try {
        let ehGrupo = false;
        if (modoChat === 'grupo') ehGrupo = true;
        else if (modoChat === 'conversas') {
            const item = listaChatCache.find(i => i.id == selecionadoId);
            if (item && item.tipo === 'grupo') ehGrupo = true;
        }

        if (!ehGrupo) {
            const sendRes = await fetchAdmin(`${API_URL}/admin/chat/responder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_aluno: selecionadoId, mensagem: txt }) });
            if (!sendRes) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        } else {
            const sendRes = await fetchAdmin(`${API_URL}/admin/chat/turma/enviar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo_turma: selecionadoId, mensagem: txt }) });
            if (!sendRes) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        }
        carregarMensagens();
    } catch(e) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao enviar mensagem.', background: '#222', color: '#fff' }); }
}

async function carregarCargosSelect(idSelecionado = null) {
    const select = document.getElementById('eqCargo');
    if (!select) return;

    try {
        // ALTERAÇÃO: use /listar-cargos
        const res = await fetchAdmin(`${API_URL}/admin/listar-cargos`); 
        if (!res) return;
        
        const cargos = await res.json(); // Lembre-se de converter para JSON
        
        let html = '<option value="" disabled selected>Selecione um cargo</option>';
        cargos.forEach(c => {
            // No seu banco a coluna é 'id_cargo' e não 'id'
            const selected = (idSelecionado == c.id_cargo) ? 'selected' : '';
            html += `<option value="${c.id_cargo}" ${selected}>${c.nome_cargo}</option>`;
        });
        select.innerHTML = html;
    } catch (e) {
        console.error("Erro ao carregar cargos:", e);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function aplicarMascaras() {
    const elementos = [
        { id: 'cadCpf', mask: '000.000.000-00' },
        { id: 'cadCelular', mask: '(00) 00000-0000' },
        { id: 'perfTel', mask: '(00) 00000-0000' },
        { id: 'eqTelefone', mask: '(00) 00000-0000' }
    ];

    elementos.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) IMask(el, { mask: item.mask });
    });
}

async function fetchAdmin(url, options = {}) {
    const tokenAtual = localStorage.getItem('access_token');
    const defaultHeaders = { 'Authorization': `Bearer ${tokenAtual}` };
    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);
        
        if (response.status === 401) {
            console.warn("401 em:", url)
            localStorage.removeItem('access_token');
            Swal.fire({ icon: 'warning', title: 'Sessão Expirada', text: 'Por favor, faça login novamente.', background: '#222', color: '#fff' })
                .then(() => window.location.href = 'IndexHome.html');
            return null;
        }
        return response;
    } catch (error) {
        console.error("Erro na requisição:", error);
        return null;
    }
}

// js/script-funcionario.js

/**
 * Função genérica para filtrar qualquer tabela em tempo real
 * @param {string} inputId - ID do campo de texto
 * @param {string} bodyId - ID do tbody da tabela
 */
function filtrarTabelaGeneric(inputId, bodyId) {
    const termo = document.getElementById(inputId).value.toLowerCase();
    const linhas = document.querySelectorAll(`#${bodyId} tr`);

    linhas.forEach(linha => {
        const textoLinha = linha.innerText.toLowerCase();
        // Se a linha contém o termo ou se o termo está vazio, mostra. Caso contrário, esconde.
        linha.style.display = textoLinha.includes(termo) ? "" : "none";
    });
}


function logout() { localStorage.removeItem('access_token'); window.location.href = 'IndexHome.html'; }

window.onload = async () => {
    await verificarPermissoes(); // Valida o acesso
    aplicarMascaras();   
    document.getElementById('dataChamada').valueAsDate = new Date();       // Ativa o IMask nos campos de CPF/Telefone
};

/* === Universal Modal Helpers ===
   abrirModalUniversal(title, contentHTML, onConfirm)
   fecharModalUniversal()
   These control the #modalUniversal element present in portal-funcionario.html
*/
// ====== CANVA (por LINK) - helpers ======
function cursoUsaCanva(tituloCurso) {
  const t = (tituloCurso || '').toLowerCase();
  return t.includes('game pro') || t.includes('designer start');
}

function extractFirstCanvaUrl(text) {
  const m = (text || "").match(/https?:\/\/(?:www\.)?canva\.com\/design\/[^\s"'<]+/i);
  return m ? m[0] : null;
}

function parseCanvaUrl(anyTextOrUrl) {
  const url = extractFirstCanvaUrl(anyTextOrUrl) || (anyTextOrUrl || "").trim();
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("design");
    if (idx === -1 || !parts[idx + 1]) return null;

    const designId = parts[idx + 1];

    // token opcional: /design/{id}/{token}/edit
    let token = null;
    const maybeToken = parts[idx + 2];
    if (maybeToken && !["view", "edit"].includes(maybeToken)) token = maybeToken;

    return { designId, token };
  } catch {
    return null;
  }
}

function buildCanvaEditUrl(anyTextOrUrl) {
  const p = parseCanvaUrl(anyTextOrUrl);
  if (!p) return null;
  const base = `https://www.canva.com/design/${p.designId}/${p.token ? p.token + "/" : ""}`;
  return `${base}edit`;
}

// Abre Canva para editar (e salva link se necessário)
async function editarAulaCanvaPorLink(idAula, tituloAula) {
  // 1) busca conteúdo atual da aula (pra ver se já tem link salvo)
  let conteudoAtual = "";
  try {
    const res = await fetchAdmin(`${API_URL}/admin/aula/${idAula}/conteudo`);
    if (res && res.ok) {
      const dados = await res.json();
      conteudoAtual = (dados.conteudo || dados.html || "").trim();
    }
  } catch (_) {}

  // 2) se já tem link do Canva, abre direto (e normaliza pra /edit preservando token)
  const linkExistente = extractFirstCanvaUrl(conteudoAtual);
  if (linkExistente) {
    const editUrl = buildCanvaEditUrl(linkExistente) || linkExistente;
    window.open(editUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // 3) se não tem link salvo, pede pra colar e salva
  const resp = await Swal.fire({
    icon: 'info',
    title: `Vincular Canva: ${tituloAula || 'Aula'}`,
    html: `
      <p style="font-size:12px;color:#aaa;margin-bottom:10px">
        Cole aqui o link do Canva (o de <b>editar</b> /edit).<br>
        Ex.: https://www.canva.com/design/ID/TOKEN/edit
      </p>
    `,
    input: 'text',
    inputPlaceholder: 'Cole o link do Canva aqui...',
    showCancelButton: true,
    confirmButtonText: 'Salvar e abrir',
    cancelButtonText: 'Cancelar',
    background: '#1a1a1a',
    color: '#fff',
    inputValidator: (v) => {
      const url = (v || '').trim();
      if (!url) return 'Cole um link do Canva.';
      if (!/canva\.com\/design\//i.test(url)) return 'Esse link não parece ser do Canva (/design/...).';
      return null;
    }
  });

  if (!resp.isConfirmed) return;

  const linkColado = resp.value.trim();
  const editUrlFinal = buildCanvaEditUrl(linkColado) || linkColado;

  // salva no backend
  try {
    const saveRes = await fetchAdmin(`${API_URL}/admin/aula/${idAula}/salvar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo: editUrlFinal })
    });

    if (saveRes && saveRes.ok) {
      Swal.fire({
        icon: 'success',
        title: 'Vinculado!',
        text: 'Link do Canva salvo. Abrindo no Canva...',
        timer: 1200,
        showConfirmButton: false,
        background: '#222',
        color: '#fff'
      });

      // abre Canva pra editar
      window.open(editUrlFinal, "_blank", "noopener,noreferrer");

      // recarrega visualizador à direita (se existir)
      const iframe = document.getElementById('frame-aula-prof');
      if (iframe) iframe.src = `visualizador.html?id=${idAula}&t=${Date.now()}`;
    } else {
      let errText = 'Falha ao salvar link.';
      try { const e = await saveRes.json(); errText = e.detail || e.message || errText; } catch(_) {}
      Swal.fire({ icon: 'error', title: 'Erro', text: errText, background: '#222', color: '#fff' });
    }
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão ao salvar link.', background: '#222', color: '#fff' });
  }
}

function abrirModalUniversal(title, contentHTML, onConfirm) {
    const modal = document.getElementById('modalUniversal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    if (!modal || !modalTitle || !modalBody || !modalConfirmBtn) return;

    modalTitle.innerText = title || 'Modal';
    modalBody.innerHTML = contentHTML || '';

    // Remove any previous handler and attach the new one
    modalConfirmBtn.onclick = null;
    if (typeof onConfirm === 'function') {
        modalConfirmBtn.onclick = async () => {
            try { await onConfirm(); } catch (err) { console.error(err); }
        };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalUniversal() {
    const modal = document.getElementById('modalUniversal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

/* === Novo Colaborador: abrir modal + salvar via fetchAdmin === */
/**
 * Abre o modal para Cadastro ou Edição de Colaborador
 * @param {string|null} jsonDados - Dados do funcionário em JSON (opcional)
 */
function abrirModalColaborador(jsonDados = null) {
    const dados = jsonDados ? JSON.parse(decodeURIComponent(jsonDados)) : null;
    const isEdit = !!dados;

    const conteudo = `
        <form id="formEquipeModal" class="space-y-4">
            <div>
                <label class="text-xs text-gray-400">Nome Completo</label>
                <input type="text" id="eqNome" value="${isEdit ? dados.nome_completo : ''}" 
                    class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white uppercase outline-none focus:border-[#00FFFF]" required>
            </div>
            <div>
                <label class="text-xs text-gray-400">Cargo</label>
                <select id="eqCargo" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]">
                    <option value="" disabled selected>Carregando cargos...</option>
                </select>
            </div>
            <div>
                <label class="text-xs text-gray-400">Telefone / WhatsApp</label>
                <input type="text" id="eqTelefone" value="${isEdit ? (dados.telefone || '') : ''}" 
                    class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none">
            </div>
            <hr class="border-[#333]">
            <div>
                <label class="text-xs text-gray-400">Email de Login</label>
                <input type="email" id="eqEmail" value="${isEdit ? dados.email : ''}" 
                    class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none" required>
            </div>
            <div>
                <label class="text-xs text-gray-400">${isEdit ? 'Nova Senha (deixe em branco para manter)' : 'Senha Inicial'}</label>
                <input type="text" id="eqSenha" value="${isEdit ? '' : 'javis123'}" 
                    class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none">
            </div>
        </form>
    `;

    const titulo = isEdit ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador';

    abrirModalUniversal(titulo, conteudo, async () => {
        await salvarDadosColaborador(isEdit, isEdit ? dados.id_colaborador : null);
    });

    // Popula cargos e aplica máscaras
    setTimeout(() => {
        carregarCargosSelect(isEdit ? dados.id_cargo : null);
        aplicarMascaras();
    }, 100);
}

async function executarSalvamentoEquipe() {
    // Collect values from the universal modal inputs
    const eqNome = document.getElementById('eqNome');
    const eqEmail = document.getElementById('eqEmail');
    const eqSenha = document.getElementById('eqSenha');
    const eqTelefone = document.getElementById('eqTelefone');
    const eqCargo = document.getElementById('eqCargo');

    if (!eqNome || !eqEmail || !eqSenha || !eqCargo) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Campos do formulário não encontrados.', background: '#222', color: '#fff' });
        return;
    }

    const dados = {
        nome: eqNome.value,
        email: eqEmail.value,
        senha: eqSenha.value,
        telefone: eqTelefone ? eqTelefone.value : '',
        id_cargo: eqCargo.value
    };

    const btn = document.getElementById('modalConfirmBtn');
    const original = btn ? btn.innerText : null;
    if (btn) { btn.innerText = 'CADASTRANDO...'; btn.disabled = true; }

    try {
        const res = await fetchAdmin(`${API_URL}/admin/cadastrar-funcionario`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
        });
        if (!res) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); return; }
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Cadastrado!', text: 'Funcionário cadastrado com sucesso.', timer: 1400, showConfirmButton: false, background: '#222', color: '#fff' });
            fecharModalUniversal();
            carregarListaEquipe();
        } else {
            const err = await res.json();
            Swal.fire({ icon: 'error', title: 'Erro', text: err.detail || 'Erro ao cadastrar.', background: '#222', color: '#fff' });
        }
    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    } finally {
        if (btn) { btn.innerText = original || 'SALVAR'; btn.disabled = false; }
    }
}

/**
 * Abre o modal para editar um colaborador existente
 */
async function abrirModalEditarColaborador(funcionarioId) {
    try {
        // 1. Opcional: Buscar dados atualizados do funcionário via API
        // Se você já tiver os dados na linha da tabela, pode passar o objeto direto
        const res = await fetchAdmin(`${API_URL}/admin/funcionario/${funcionarioId}`);
        const f = await res.json();

        const conteudo = `
            <form id="formEquipeModal" class="space-y-4">
                <input type="hidden" id="eqId" value="${f.id}">
                <div>
                    <label class="text-xs text-gray-400">Nome Completo</label>
                    <input type="text" id="eqNome" value="${f.nome}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white uppercase outline-none focus:border-[#00FFFF]" required>
                </div>
                <div>
                    <label class="text-xs text-gray-400">Cargo</label>
                    <select id="eqCargo" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]">
                        </select>
                </div>
                <div>
                    <label class="text-xs text-gray-400">Telefone / WhatsApp</label>
                    <input type="text" id="eqTelefone" value="${f.telefone || ''}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none">
                </div>
                <hr class="border-[#333]">
                <div>
                    <label class="text-xs text-gray-400">Email (Login)</label>
                    <input type="email" id="eqEmail" value="${f.email}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none" required>
                </div>
                <div class="bg-yellow-900/20 p-2 rounded border border-yellow-700/30">
                    <p class="text-[10px] text-yellow-500 italic text-center">Deixe a senha em branco para manter a atual</p>
                    <label class="text-xs text-gray-400">Nova Senha</label>
                    <input type="password" id="eqSenha" placeholder="********" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none">
                </div>
            </form>
        `;

        // Abre o modal com título de Edição
        abrirModalUniversal("Editar Colaborador", conteudo, async () => {
            await executarEdicaoEquipe(funcionarioId);
        });

        // Preenche o select de cargos e seleciona o atual
        await carregarCargosSelect(f.id_cargo);
        
    } catch (error) {
        console.error("Erro ao carregar dados para edição:", error);
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível carregar os dados do colaborador.', background: '#222', color: '#fff' });
    }
}

async function executarEdicaoEquipe(id) {
    const dados = {
        nome: document.getElementById('eqNome').value,
        email: document.getElementById('eqEmail').value,
        telefone: document.getElementById('eqTelefone').value,
        id_cargo: document.getElementById('eqCargo').value
    };

    const novaSenha = document.getElementById('eqSenha').value;
    if (novaSenha) dados.senha = novaSenha;

    const btn = document.getElementById('modalConfirmBtn');
    btn.innerText = "SALVANDO...";
    btn.disabled = true;

    try {
        // Altere para a sua rota de edição (ex: /editar-funcionario/{id})
        const res = await fetchAdmin(`${API_URL}/admin/editar-funcionario/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (res && res.ok) {
            Swal.fire({ icon: 'success', title: 'Atualizado!', text: 'Dados salvos com sucesso.', timer: 1400, showConfirmButton: false, background: '#222', color: '#fff' });
            fecharModalUniversal();
            carregarListaEquipe();
        } else {
            const erro = await res.json();
            Swal.fire({ icon: 'error', title: 'Erro', text: erro.detail || 'Erro ao atualizar.', background: '#222', color: '#fff' });
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    } finally {
        btn.innerText = "SALVAR ALTERAÇÕES";
        btn.disabled = false;
    }
}

async function salvarDadosColaborador(isEdit, id = null) {
  const btn = document.getElementById('modalConfirmBtn');
  const originalText = btn.innerText;

  const payload = {
    nome: document.getElementById('eqNome').value,
    email: document.getElementById('eqEmail').value,
    telefone: document.getElementById('eqTelefone').value,
    id_cargo: document.getElementById('eqCargo').value
  };

  const senha = document.getElementById('eqSenha').value;
  if (!isEdit && !senha) {
    Swal.fire({ icon: 'warning', title: 'Senha obrigatória', text: 'Informe uma senha inicial.', background: '#222', color: '#fff' });
    return;
  }
  if (senha) payload.senha = senha;

  // ✅ CORREÇÃO: endpoints com /admin
  const url = isEdit
    ? `${API_URL}/admin/editar-funcionario/${id}`
    : `${API_URL}/admin/cadastrar-funcionario`;

  const method = isEdit ? 'PUT' : 'POST';

  btn.innerText = "PROCESSANDO...";
  btn.disabled = true;

  try {
    const res = await fetchAdmin(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res) return; // fetchAdmin já trata 401

    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: isEdit ? 'Dados atualizados.' : 'Colaborador cadastrado.',
        timer: 1400,
        showConfirmButton: false,
        background: '#222',
        color: '#fff'
      });
      fecharModalUniversal();
      carregarListaEquipe();
      return;
    }

    // fallback robusto (às vezes não vem JSON)
    let msg = `Erro (${res.status})`;
    try {
      const err = await res.json();
      msg = err.detail || msg;
    } catch {
      const t = await res.text().catch(() => "");
      if (t) msg = t;
    }

    Swal.fire({ icon: 'error', title: 'Erro', text: msg, background: '#222', color: '#fff' });

  } catch (e) {
    console.error(e);
    Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function carregarAulaProfessor(url) {
    const iframe = document.getElementById('frame-aula-prof');
    const placeholder = document.getElementById('placeholder-aula');
    
    // Carrega a URL
    iframe.src = url;
    
    // Esconde o placeholder e garante que o iframe fique visível (z-index)
    if(placeholder) {
        placeholder.style.display = 'none';
    }
}

async function carregarConteudoDidatico() {
  const container = document.getElementById('lista-conteudo-dinamico');

  container.innerHTML = '<p class="text-gray-500 text-center text-xs mt-4"><i class="fas fa-spinner fa-spin"></i> Carregando biblioteca...</p>';

  try {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error("Sem token de autenticação");

    const response = await fetch(`${API_URL}/admin/conteudo-didatico/cursos`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Erro na API');
    const cursos = await response.json();

    if (!cursos || cursos.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center text-xs mt-4">Nenhum conteúdo disponível.</p>';
      return;
    }

    let htmlFinal = '';

    cursos.forEach(curso => {
      const esteCursoUsaCanva = cursoUsaCanva(curso.titulo);

      htmlFinal += `
        <div class="curso-section mb-4">
          <h4 class="text-[#00FFFF] font-bold text-xs uppercase mb-2 border-b border-[#333] pb-1 sticky top-0 bg-[#222] z-10 flex items-center">
            <i class="${curso.icone || 'fas fa-book'} mr-2"></i> ${curso.titulo}
          </h4>
          <div class="space-y-1">
      `;

      const modulos = curso.modulos || [];
      modulos.forEach(modulo => {
        htmlFinal += `
          <details class="group">
            <summary class="summary-btn">
              <span class="text-gray-300">${modulo.titulo}</span>
              <i class="fas fa-chevron-down arrow-icon"></i>
            </summary>
            <div class="aula-list">
        `;

        const aulas = modulo.aulas || [];
        if (aulas.length > 0) {
          aulas.forEach(aula => {
            const iconClass = esteCursoUsaCanva
              ? 'fas fa-file-pres text-blue-400'
              : 'fas fa-play-circle text-gray-500';

            const podeEditar =
              (nivelUsuarioLogado >= 8) ||
              (nivelUsuarioLogado === 5 && (aula.id_professor || curso.id_professor) == usuarioLogadoId);

            const tituloEsc = (aula.titulo || '').replace(/'/g, "\\'");

            const botaoEditarHTML = podeEditar
              ? (esteCursoUsaCanva
                  ? `<button onclick="gerenciarAulaCanva(${aula.id}, '${tituloEsc}')" class="text-gray-500 hover:text-[#00FFFF] p-2 opacity-0 group-hover/item:opacity-100 transition" title="Vincular / Alterar link do Canva">
                       <i class="fas fa-pencil-alt text-xs"></i>
                     </button>`
                  : `<button onclick="abrirEditorAula(${aula.id}, '${tituloEsc}')" class="text-gray-500 hover:text-[#00FFFF] p-2 opacity-0 group-hover/item:opacity-100 transition" title="Editar Conteúdo (TinyMCE)">
                       <i class="fas fa-pencil-alt text-xs"></i>
                     </button>`
                )
              : '';

            htmlFinal += `
              <div class="flex items-center gap-1 group/item mb-1 hover:bg-white/5 rounded px-1 transition">
                <i class="${iconClass} text-[10px] ml-2"></i>
                <button onclick="carregarAulaProfessor('visualizador.html?id=${aula.id}')" class="btn-aula flex-1 text-left truncate py-1.5 text-xs text-gray-400 group-hover/item:text-white">
                  ${aula.titulo}
                </button>
                ${botaoEditarHTML}
              </div>
            `;
          });
        } else {
          htmlFinal += `<span class="text-gray-600 text-[10px] p-2">Sem aulas.</span>`;
        }

        htmlFinal += `</div></details>`;
      });

      htmlFinal += `</div></div>`;
    });

    container.innerHTML = htmlFinal;

  } catch (err) {
    console.error('Erro ao carregar cursos:', err);
    container.innerHTML = '<p class="text-red-500 text-center text-xs mt-4">Erro ao carregar os cursos.</p>';
  }
}



// Toggle da Biblioteca no mobile (mostra/oculta o painel lateral de aulas)
document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('btn-toggle-biblioteca');
    var bib = document.getElementById('bibliotecaContainer');
    var vis = document.getElementById('visualizadorContainer');
    if (!btn || !bib) return;
    btn.addEventListener('click', function() {
        bib.classList.toggle('hidden');
        if (bib.classList.contains('hidden')) {
            btn.textContent = 'Biblioteca';
        } else {
            btn.textContent = 'Fechar Biblioteca';
        }
        // garante que o visualizador fique visível após toggle
        setTimeout(function(){ if (vis) vis.scrollIntoView({behavior: 'smooth', block: 'start'}); }, 120);
    });
    renderizarGraficoFrequencia();
});

// --- LÓGICA DO EDITOR DE AULAS (ATUALIZADA COM PLUGINS PREMIUM) ---
let editorInicializado = false;
let aulaEmEdicaoId = null;

// Exemplo: No botão de atualizar do dashboard
async function atualizarTudo() {
    await carregarDashboard();
    await renderizarGraficoFrequencia();
}

async function abrirEditorAula(idAula, tituloAula) {
    aulaEmEdicaoId = idAula;
    document.getElementById('tituloAulaEditor').innerText = `Editando: ${tituloAula}`;

    const modal = document.getElementById('modalEditorAula');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (!editorInicializado) {
        await tinymce.init({
            selector: '#editorTexto',
            height: '100%',
            skin: "oxide-dark",
            content_css: "dark",
            plugins: 'link media table code lists emoticons codesample',
            toolbar: 'undo redo | bold italic underline | link media | numlist bullist | code emoticons',
            setup: function (editor) {
                editor.on('init', () => { editorInicializado = true; });
            }
        });
    }

    try {
        const res = await fetchAdmin(`${API_URL}/admin/aula/${idAula}/conteudo`);
        if (res && res.ok) {
            const dados = await res.json();
            const conteudoParaEditor = conteudoSalvoParaEdicao(dados.conteudo || '');
            tinymce.get('editorTexto').setContent(conteudoParaEditor);
        }
    } catch (error) {
        Swal.fire('Erro', 'Não foi possível carregar a aula.', 'error');
        fecharEditorAula();
    }
}



function fecharEditorAula() {
    document.getElementById('modalEditorAula').classList.add('hidden');
    document.getElementById('modalEditorAula').classList.remove('flex');
    aulaEmEdicaoId = null;
}

function extractFirstCanvaUrl(text) {
  const m = (text || "").match(/https?:\/\/(?:www\.)?canva\.com\/design\/[^\s"'<]+/i);
  return m ? m[0] : null;
}

async function salvarConteudoAula() {
  if (!aulaEmEdicaoId) return;

  const editor = tinymce.get('editorTexto');
  const texto = editor?.getContent({ format: 'text' })?.trim() || "";
  const html = editor?.getContent()?.trim() || "";

  let conteudoParaSalvar = html;

  // Se for Canva, salva SEMPRE um link /edit (preserva token)
  if (isCanvaDesignLink(texto)) {
    const canvaUrl = extractFirstCanvaUrl(texto);
    conteudoParaSalvar = buildCanvaEditUrl(canvaUrl) || canvaUrl;
  }

  const btn = document.querySelector('#modalEditorAula button.bg-green-600');
  btn.disabled = true;

  try {
    const res = await fetchAdmin(`${API_URL}/admin/aula/${aulaEmEdicaoId}/salvar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo: conteudoParaSalvar })
    });

    if (res && res.ok) {
      Swal.fire({ icon: 'success', title: 'Salvo!', timer: 1000, showConfirmButton: false });
      fecharEditorAula();
      const iframe = document.getElementById('frame-aula-prof');
      if (iframe) iframe.src = `visualizador.html?id=${aulaEmEdicaoId}&t=${Date.now()}`;
    }
  } catch (error) {
    Swal.fire('Erro', 'Falha ao salvar.', 'error');
  } finally {
    btn.disabled = false;
  }
}





// (Opcional) Função para Upload de Imagem no TinyMCE
// Para funcionar 100%, você precisaria de uma rota no Python para upload
// Por enquanto, o TinyMCE converte em Base64 (funciona, mas deixa o banco pesado)
function uploadImagemHandler (blobInfo, progress) {
    return new Promise((resolve, reject) => {
        // AQUI VOCÊ PODE IMPLEMENTAR O UPLOAD PARA O SUPABASE STORAGE NO FUTURO
        // Por enquanto, vamos usar base64 local (simples)
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve('data:' + blobInfo.blob().type + ';base64,' + base64);
        };
        reader.readAsDataURL(blobInfo.blob());
    });
}

/* ==========================================================
   FUNÇÕES DE EDIÇÃO DE ALUNO
   ========================================================== */

async function abrirModalEditarAluno(jsonAluno) {
    const aluno = JSON.parse(decodeURIComponent(jsonAluno));
    
    // Tenta pegar a turma atual do array de matrículas
    const matricula = (aluno.tb_matriculas && aluno.tb_matriculas.length > 0) ? aluno.tb_matriculas[0] : null;
    const turmaAtual = matricula ? matricula.codigo_turma : "";

    // HTML do Formulário
    const conteudo = `
        <form id="formEditAluno" class="space-y-4">
            <input type="hidden" id="editAlunoId" value="${aluno.id_aluno}">
            
            <div>
                <label class="text-xs text-gray-400">Nome Completo</label>
                <input type="text" id="editAlunoNome" value="${aluno.nome_completo}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white uppercase outline-none focus:border-[#00FFFF]">
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs text-gray-400">CPF</label>
                    <input type="text" id="editAlunoCpf" value="${aluno.cpf || ''}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none">
                </div>
                <div>
                    <label class="text-xs text-gray-400">Turma Atual</label>
                    <select id="editAlunoTurma" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]">
                        <option value="${turmaAtual}" selected>${turmaAtual || 'Sem Turma'}</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs text-gray-400">Celular (WhatsApp)</label>
                    <input type="text" id="editAlunoCel" value="${aluno.celular || ''}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none">
                </div>
                <div>
                    <label class="text-xs text-gray-400">Telefone Fixo</label>
                    <input type="text" id="editAlunoTel" value="${aluno.telefone || ''}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none">
                </div>
            </div>

            <div>
                <label class="text-xs text-gray-400">Email (Login)</label>
                <input type="email" id="editAlunoEmail" value="${aluno.email || ''}" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none">
            </div>
        </form>
    `;

    // Abre o Modal Universal
    abrirModalUniversal("Editar Aluno", conteudo, salvarEdicaoAluno);

    // Aplica máscaras e carrega as turmas no select
    setTimeout(async () => {
        // Máscaras
        const elCel = document.getElementById('editAlunoCel');
        const elTel = document.getElementById('editAlunoTel');
        const elCpf = document.getElementById('editAlunoCpf');
        if(elCel) IMask(elCel, { mask: '(00) 00000-0000' });
        if(elTel) IMask(elTel, { mask: '(00) 00000-0000' });
        if(elCpf) IMask(elCpf, { mask: '000.000.000-00' });

        // Carregar lista de turmas para trocar
        try {
            const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
            if(res.ok) {
                const turmas = await res.json();
                const select = document.getElementById('editAlunoTurma');
                // Mantém a atual e adiciona as outras
                turmas.forEach(t => {
                    if (t.codigo_turma !== turmaAtual) {
                        select.innerHTML += `<option value="${t.codigo_turma}">${t.codigo_turma} (${t.horario})</option>`;
                    }
                });
            }
        } catch(e) {}
    }, 100);
}

async function salvarEdicaoAluno() {
    const btn = document.getElementById('modalConfirmBtn');
    const originalText = btn.innerText;
    btn.innerText = "SALVANDO..."; btn.disabled = true;

    const id = document.getElementById('editAlunoId').value;
    const dados = {
        nome: document.getElementById('editAlunoNome').value,
        cpf: document.getElementById('editAlunoCpf').value,
        turma_codigo: document.getElementById('editAlunoTurma').value,
        celular: document.getElementById('editAlunoCel').value,
        telefone: document.getElementById('editAlunoTel').value,
        email: document.getElementById('editAlunoEmail').value
    };

    try {
        const res = await fetchAdmin(`${API_URL}/admin/editar-aluno/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Aluno atualizado!', timer: 1500, showConfirmButton: false, background: '#222', color: '#fff' });
            fecharModalUniversal();
            carregarAlunos(); // Atualiza a tabela
        } else {
            const erro = await res.json();
            Swal.fire({ icon: 'error', title: 'Erro', text: erro.detail || 'Falha ao salvar.', background: '#222', color: '#fff' });
        }
    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    } finally {
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    }
}
async function carregarAlunosParaNovoUsuario() {
  const select = document.getElementById('novoUsuarioAluno');
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Carregando...</option>';

  try {
    const res = await fetchAdmin(`${API_URL}/admin/listar-alunos`);
    if (!res) throw new Error('Falha ao buscar alunos');

    const alunos = await res.json();

    // Opcional: filtrar só quem NÃO tem user_id (se sua API devolver isso)
    // const filtrados = alunos.filter(a => !a.user_id);

    select.innerHTML = '<option value="" disabled selected>Selecione um aluno...</option>';

    alunos.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id_aluno;
      const turma = (a.tb_matriculas && a.tb_matriculas[0]) ? a.tb_matriculas[0].codigo_turma : '';
      opt.textContent = `${a.nome_completo}${turma ? ' - ' + turma : ''}`;
      select.appendChild(opt);
    });

  } catch (err) {
    console.error(err);
    select.innerHTML = '<option value="" disabled selected>Erro ao carregar alunos</option>';
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formNovoUsuario');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id_aluno = Number(document.getElementById('novoUsuarioAluno')?.value);
    const email = document.getElementById('novoUsuarioEmail')?.value?.trim();
    const senha = document.getElementById('novoUsuarioSenha')?.value;

    if (!id_aluno || !email || !senha) {
      Swal.fire('Atenção', 'Preencha aluno, e-mail e senha.', 'warning');
      return;
    }

    const btn = document.getElementById('btnCriarNovoUsuario');
    const original = btn?.innerText;
    if (btn) { btn.disabled = true; btn.innerText = 'Criando...'; }

    try {
      const res = await fetchAdmin(`${API_URL}/admin/criar-login-aluno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_aluno, email, senha })
      });

      if (!res) throw new Error('Sem resposta do servidor');

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Erro ao criar login');
      }

      Swal.fire('Sucesso!', data.message || 'Login criado com sucesso!', 'success');
      form.reset();
      carregarAlunosParaNovoUsuario();

    } catch (err) {
      Swal.fire('Erro', err.message || 'Erro ao criar login', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = original; }
    }
  });
});

function adicionarBotaoCanvaNoEditor() {
  const footer = document.querySelector('#modalEditorAula div.flex.gap-3');
  if (!footer) return;

  // Botão: abrir no canva
  if (!document.getElementById('btn-canva-open')) {
    const btn = document.createElement('button');
    btn.id = 'btn-canva-open';
    btn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition flex items-center gap-2";
    btn.innerHTML = `<i class="fas fa-up-right-from-square"></i> ABRIR NO CANVA`;
    btn.onclick = (e) => {
      e.preventDefault();
      const texto = tinymce.get('editorTexto')?.getContent({ format: 'text' })?.trim() || '';
      if (!isCanvaDesignLink(texto)) {
        Swal.fire("Cole o link do Canva", "Cole no editor o link compartilhado do Canva e tente novamente.", "info");
        return;
      }
      const editUrl = buildCanvaEditUrl(texto) || texto;
      window.open(editUrl, "_blank", "noopener");
    };
    footer.prepend(btn);
  }
}




function extrairCanvaDesignId(texto) {
  const t = (texto || "");
  const m = t.match(/canva\.com\/design\/([^\/?#]+)/i);
  return m ? m[1] : null;
}
function normalizarCanvaEmbedUrl(texto) {
  const id = extrairCanvaDesignId(texto);
  return id ? `https://www.canva.com/design/${id}/view?embed` : null;
}

function canvaParaEmbed(urlOuTexto) {
  const designId = extrairCanvaDesignId(urlOuTexto);
  if (!designId) return null;
  return `https://www.canva.com/design/${designId}/view?embed`;
}



function normalizarCanvaViewUrl(urlOuTexto) {
    const designId = extrairCanvaDesignId(urlOuTexto);
    if (!designId) return null;
    return `https://www.canva.com/design/${designId}/view?embed`;
}

// Pega designId de:
// - links /design/ID/...
// - embed div: data-design-id="ID"
function extrairCanvaDesignId(textoOuHtml) {
    const t = (textoOuHtml || "");

    // 1) data-design-id="ID"
    let m = t.match(/data-design-id\s*=\s*["']([^"']+)["']/i);
    if (m && m[1]) return m[1];

    // 2) canva.com/design/ID
    m = t.match(/canva\.com\/design\/([^\/?#]+)/i);
    if (m && m[1]) return m[1];

    return null;
}

// Converte o conteúdo salvo (embed div) em algo amigável pra editar (um link view)
function conteudoSalvoParaEdicao(conteudoSalvo) {
    const id = extrairCanvaDesignId(conteudoSalvo);
    if (id) return `https://www.canva.com/design/${id}/view?embed`;
    return conteudoSalvo || '';
}

// Converte o que está no editor em HTML para salvar no banco
function conteudoEditorParaSalvar() {
    const editor = tinymce.get('editorTexto');
    if (!editor) return '';

    const texto = editor.getContent({ format: 'text' }).trim();
    const html = editor.getContent().trim();

    const id = extrairCanvaDesignId(texto) || extrairCanvaDesignId(html);

    if (id) {
        return `<div class="canva-embed" data-design-id="${id}" data-height="540"></div>`;
    }

    // Caso normal: salva o HTML do TinyMCE
    return html;
}

function canvaToEmbedUrl(url) {
  if (!url) return null;

  // remove querystring
  const clean = url.split('?')[0];

  // se for link /edit, vira /view?embed
  // se já for /view, garante ?embed
  const m = clean.match(/https?:\/\/(www\.)?canva\.com\/design\/([^\/?#]+)/i);
  if (!m) return url;

  const designId = m[2];
  return `https://www.canva.com/design/${designId}/view?embed`;
}

function extrairCanvaDesignId(texto) {
  const t = (texto || "").trim();

  // pega /design/ID
  let m = t.match(/canva\.com\/design\/([^\/?#]+)/i);
  if (m && m[1]) return m[1];

  return null;
}

function normalizarCanvaViewEmbedUrl(texto) {
  const designId = extrairCanvaDesignId(texto);
  if (!designId) return null;
  return `https://www.canva.com/design/${designId}/view?embed`;
}

function parseCanvaUrl(anyTextOrUrl) {
  const url = extractFirstCanvaUrl(anyTextOrUrl) || (anyTextOrUrl || "").trim();
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("design");
    if (idx === -1 || !parts[idx + 1]) return null;

    const designId = parts[idx + 1];
    let token = null;
    const maybeToken = parts[idx + 2];
    if (maybeToken && !["view", "edit"].includes(maybeToken)) token = maybeToken;

    return { designId, token };
  } catch {
    return null;
  }
}

function buildCanvaViewEmbedUrl(anyCanvaLink) {
  const p = parseCanvaUrl(anyCanvaLink);
  if (!p) return null;
  const base = `https://www.canva.com/design/${p.designId}/${p.token ? p.token + "/" : ""}`;
  return `${base}view?embed`;
}

function buildCanvaEditUrl(anyTextOrUrl) {
  const p = parseCanvaUrl(anyTextOrUrl);
  if (!p) return null;
  const base = `https://www.canva.com/design/${p.designId}/${p.token ? p.token + "/" : ""}`;
  return `${base}edit`;
}

function isCanvaDesignLink(text) {
  return !!extractFirstCanvaUrl(text);
}


/* ===== CANVA POR LINK (SEM SDK) ===== */

function cursoUsaCanva(tituloCurso) {
  const t = (tituloCurso || "").toLowerCase();
  return t.includes("game pro") || t.includes("designer start");
}

function extractFirstCanvaUrl(text) {
  const m = (text || "").match(/https?:\/\/(?:www\.)?canva\.com\/design\/[^\s"'<]+/i);
  return m ? m[0] : null;
}

function parseCanvaUrl(anyTextOrUrl) {
  const url = extractFirstCanvaUrl(anyTextOrUrl) || (anyTextOrUrl || "").trim();
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("design");
    if (idx === -1 || !parts[idx + 1]) return null;

    const designId = parts[idx + 1];

    // token opcional: /design/{designId}/{token}/edit
    let token = null;
    const maybeToken = parts[idx + 2];
    if (maybeToken && !["view", "edit"].includes(maybeToken)) token = maybeToken;

    return { designId, token };
  } catch {
    return null;
  }
}

function buildCanvaEditUrl(anyTextOrUrl) {
  const p = parseCanvaUrl(anyTextOrUrl);
  if (!p) return null;
  const base = `https://www.canva.com/design/${p.designId}/${p.token ? p.token + "/" : ""}`;
  return `${base}edit`;
}

function buildCanvaViewEmbedUrl(anyTextOrUrl) {
  const p = parseCanvaUrl(anyTextOrUrl);
  if (!p) return null;
  const base = `https://www.canva.com/design/${p.designId}/${p.token ? p.token + "/" : ""}`;
  return `${base}view?embed`;
}

async function gerenciarAulaCanva(idAula, tituloAula) {
  // 1) Pega o link atual salvo no banco (se existir)
  let conteudoAtual = "";
  try {
    const res = await fetchAdmin(`${API_URL}/admin/aula/${idAula}/conteudo`);
    if (res && res.ok) {
      const dados = await res.json();
      conteudoAtual = (dados.conteudo || dados.html || "").trim();
    }
  } catch (_) {}

  const linkAtual = extractFirstCanvaUrl(conteudoAtual) || "";

  // 2) Modal pra alterar/remover
  const resp = await Swal.fire({
    icon: "info",
    title: `Canva • ${tituloAula || "Aula"}`,
    html: `
      <p style="font-size:12px;color:#aaa;margin:0 0 10px 0">
        Cole o <b>link de edição</b> do Canva (termina em <b>/edit</b>).<br>
        Se o Canva gerar outro link depois, é só colar o novo aqui e salvar.
      </p>
    `,
    input: "text",
    inputValue: linkAtual,
    inputPlaceholder: "https://www.canva.com/design/ID/TOKEN/edit",
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    confirmButtonText: "Salvar",
    showDenyButton: !!linkAtual,
    denyButtonText: "Remover link",
    background: "#1a1a1a",
    color: "#fff",
    preConfirm: (v) => {
      const url = (v || "").trim();
      if (!url) return ""; // permite salvar vazio se quiser “limpar”
      if (!/canva\.com\/design\//i.test(url)) {
        Swal.showValidationMessage("Esse link não parece ser do Canva (/design/...).");
        return false;
      }
      return url;
    }
  });

  // Remover link
  if (resp.isDenied) {
    try {
      const saveRes = await fetchAdmin(`${API_URL}/admin/aula/${idAula}/salvar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: "" })
      });

      if (saveRes && saveRes.ok) {
        Swal.fire({ icon: "success", title: "Removido!", timer: 900, showConfirmButton: false, background: "#222", color: "#fff" });
        const iframe = document.getElementById("frame-aula-prof");
        if (iframe) iframe.src = `visualizador.html?id=${idAula}&t=${Date.now()}`;
      } else {
        Swal.fire({ icon: "error", title: "Erro", text: "Não consegui remover o link.", background: "#222", color: "#fff" });
      }
    } catch (_) {
      Swal.fire({ icon: "error", title: "Erro", text: "Erro de conexão ao remover.", background: "#222", color: "#fff" });
    }
    return;
  }

  if (!resp.isConfirmed) return;

  const linkColado = (resp.value || "").trim();
  const editUrlFinal = linkColado ? (buildCanvaEditUrl(linkColado) || linkColado) : "";

  // 3) Salva no banco (o portal sempre guarda o /edit)
  try {
    const saveRes = await fetchAdmin(`${API_URL}/admin/aula/${idAula}/salvar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo: editUrlFinal })
    });

    if (saveRes && saveRes.ok) {
      Swal.fire({ icon: "success", title: "Salvo!", timer: 900, showConfirmButton: false, background: "#222", color: "#fff" });

      // Recarrega visualizador (vai mostrar /view?embed)
      const iframe = document.getElementById("frame-aula-prof");
      if (iframe) iframe.src = `visualizador.html?id=${idAula}&t=${Date.now()}`;

      // Se tiver link, abre pra editar em nova aba (opcional, mas ajuda o professor)
      if (editUrlFinal) window.open(editUrlFinal, "_blank", "noopener,noreferrer");
    } else {
      Swal.fire({ icon: "error", title: "Erro", text: "Falha ao salvar o link.", background: "#222", color: "#fff" });
    }
  } catch (_) {
    Swal.fire({ icon: "error", title: "Erro", text: "Erro de conexão ao salvar o link.", background: "#222", color: "#fff" });
  }
}
async function carregarListaChamada() {
    const codTurma = document.getElementById('selectTurmaChamada').value;
    // CORREÇÃO: Usando o ID que existe no seu HTML
    const container = document.getElementById('lista-chamada-corpo'); 
    
    if(!codTurma || !container) return;
    
    container.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-gray-500">Carregando alunos...</td></tr>';

    try {
        const res = await fetchAdmin(`${API_URL}/admin/chamada/turma/${codTurma}`);
        if (!res || !res.ok) throw new Error("Erro ao buscar dados");
        
        const matriculas = await res.json();
        
        // Limpa o container para inserir as linhas
        container.innerHTML = "";
        
        if (matriculas.length === 0) {
            container.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-gray-500">Nenhum aluno nesta turma.</td></tr>';
            return;
        }
        
        // CORREÇÃO: Gerando apenas os <tr> para não quebrar o tema do portal
        matriculas.forEach(m => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-[#222] hover:bg-white/[0.02] transition-colors";
            tr.innerHTML = `
                <td class="p-4 text-white font-medium">${m.tb_alunos.nome_completo}</td>
                <td class="p-4 text-center">
                    <input type="checkbox" class="presenca-check w-6 h-6 accent-[#00FFFF] cursor-pointer" data-id="${m.id_aluno}" checked>
                </td>
            `;
            container.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-red-500">Erro ao carregar lista de alunos.</td></tr>';
    }
}

async function enviarChamadaEstruturada() {
    const codTurma = document.getElementById('selectTurmaChamada').value;
    const dataAula = document.getElementById('dataChamada').value;
    const checks = document.querySelectorAll('.presenca-check');
    
    if (!codTurma || !dataAula) {
        return Swal.fire("Atenção", "Seleciona a turma e a data da aula.", "warning");
    }

    const listaChamada = Array.from(checks).map(c => ({
        id_aluno: parseInt(c.getAttribute('data-id')),
        codigo_turma: codTurma,
        data_aula: dataAula,
        presenca: c.checked
    }));

    try {
        const res = await fetchAdmin(`${API_URL}/admin/chamada/salvar-v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(listaChamada)
        });

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Chamada registada na base de dados oficial.', timer: 1500, showConfirmButton: false });
            // Opcional: recarrega o dashboard se estiver aberto para atualizar os gráficos
            if (typeof carregarDashboardFrequenciaCompleto === 'function') carregarDashboardFrequenciaCompleto();
        } else {
            Swal.fire("Erro", "Falha ao gravar chamada.", "error");
        }
    } catch (e) {
        Swal.fire("Erro", "Erro de conexão com o servidor.", "error");
    }
}

let debounceFestasTimer = null;

function debounceCarregarFestasAniversario() {
  clearTimeout(debounceFestasTimer);
  debounceFestasTimer = setTimeout(() => carregarFestasAniversario(), 300);
}

function formatarDataBR(isoOrDateString) {
  if (!isoOrDateString) return '-';
  // se vier "2026-02-01"
  if (/^\d{4}-\d{2}-\d{2}/.test(isoOrDateString)) {
    const d = new Date(isoOrDateString + "T00:00:00");
    return d.toLocaleDateString('pt-BR');
  }
  // fallback
  try { return new Date(isoOrDateString).toLocaleDateString('pt-BR'); } catch { return isoOrDateString; }
}

function badgeStatus(status) {
  if (status === 'FECHADA') {
    return `<span class="text-[10px] px-2 py-1 rounded bg-red-900/40 border border-red-700 text-red-200 font-bold">FECHADA</span>`;
  }
  if (status === 'PARA_ACONTECER') {
    return `<span class="text-[10px] px-2 py-1 rounded bg-yellow-900/40 border border-yellow-700 text-yellow-200 font-bold">PARA ACONTECER</span>`;
  }
  return `<span class="text-[10px] px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-200 font-bold">${status || '-'}</span>`;
}

function badgeBool(v) {
  if (v === true) return `<span class="text-[10px] px-2 py-1 rounded bg-green-900/40 border border-green-700 text-green-200 font-bold">SIM</span>`;
  if (v === false) return `<span class="text-[10px] px-2 py-1 rounded bg-gray-900/40 border border-gray-700 text-gray-300 font-bold">NÃO</span>`;
  return `-`;
}

async function carregarFestasAniversario() {
  const tbody = document.getElementById('listaFestasBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-gray-500">Carregando.</td></tr>`;

  const status = document.getElementById('filtroStatusFesta')?.value || '';
  const q = (document.getElementById('buscaFesta')?.value || '').trim();

  // ✅ novos filtros
  const dataIni = document.getElementById('filtroDataIniFesta')?.value || '';
  const dataFim = document.getElementById('filtroDataFimFesta')?.value || '';
  const vendedorId = document.getElementById('filtroVendedorFesta')?.value || '';
  const unidadeId = document.getElementById('filtroUnidadeFesta')?.value || '';

  try {
    let url = `${API_URL}/admin/festas-aniversario`;
    const params = new URLSearchParams();

    if (status) params.set('status', status);
    if (q) params.set('q', q);

    if (dataIni) params.set('data_ini', dataIni);
    if (dataFim) params.set('data_fim', dataFim);
    if (vendedorId) params.set('id_vendedor', vendedorId);
    if (unidadeId) params.set('id_unidade', unidadeId);



    // sort
    params.set('sort_by', festasSort.by);
    params.set('sort_dir', festasSort.dir);


    // ✅ bugfix aqui
    if ([...params.keys()].length) url += `?${params.toString()}`;

    const res = await fetchAdmin(url);
    if (!res) {
      tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-red-400">Sem resposta do servidor.</td></tr>`;
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-red-400">${err.detail || 'Erro ao carregar festas.'}</td></tr>`;
      return;
    }

    const festas = await res.json();
    if (!Array.isArray(festas) || festas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-gray-500">Nenhuma festa encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    festas.forEach(f => {
        cacheFestasAniversario.set(f.id, f);
        const valor = (f.valor !== null && f.valor !== undefined)
            ? `R$ ${Number(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '-';

        const unidadeNome =
            (f.tb_unidades && f.tb_unidades.nome_unidade) ? f.tb_unidades.nome_unidade :
            (f.nome_unidade ? f.nome_unidade : '-');

        const vendedorNome =
            (f.tb_colaboradores && f.tb_colaboradores.nome_completo) ? f.tb_colaboradores.nome_completo :
            (f.quem_vendeu || '-');

        const btnEditar = `
            <button onclick="abrirModalEditarFestaAniversario(${f.id})"
                class="text-gray-300 hover:text-[#00FFFF] transition" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
        `;

        tbody.innerHTML += `
            <tr class="border-b border-[#222] hover:bg-[#2a2a2a] transition">
                <td class="p-3 text-[#00FFFF] font-mono">${formatarDataBR(f.data_festa)}</td>
                <td class="p-3">${f.horario || '-'}</td>
                <td class="p-3 font-bold text-white">${f.contratante || '-'}</td>
                <td class="p-3 text-gray-300">${f.telefone || '-'}</td>
                <td class="p-3">${f.aniversariante || '-'}</td>
                <td class="p-3">${f.idade ?? '-'}</td>
                <td class="p-3">${formatarDataBR(f.data_pagamento)}</td>
                <td class="p-3">${badgeBool(f.kit_festa)}</td>
                <td class="p-3">${valor}</td>
                <td class="p-3">${vendedorNome}</td>
                <td class="p-3">${unidadeNome}</td>
                <td class="p-3">${badgeStatus(f.status)}</td>
                <td class="p-3">${f.observacoes || '-'}</td>
                <td class="p-3 text-center">${btnEditar}</td>
            </tr>`;
    });

  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-red-400">Erro ao carregar. Veja o console.</td></tr>`;
  }
}

function escapeHtml(s) {
  return (s ?? '').toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function montarFormFestaAniversario(dados) {
  const f = dados || {};

  // valores seguros para HTML
  const contratante = escapeHtml(f.contratante);
  const telefone = escapeHtml(f.telefone);
  const aniversariante = escapeHtml(f.aniversariante);
  const horario = escapeHtml(f.horario);
  const obs = escapeHtml(f.observacoes);

  const idade = (f.idade ?? '');
  const valor = (f.valor ?? '');

  const kitVal = (f.kit_festa === true) ? 'true' : (f.kit_festa === false ? 'false' : '');
  const status = f.status || 'PARA_ACONTECER';

  // datas já vêm "YYYY-MM-DD" do Supabase
  const dataFesta = f.data_festa || '';
  const dataPgto = f.data_pagamento || '';

  return `
    <div class="space-y-3 text-sm">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-gray-300 font-semibold mb-1">Status</label>
          <select id="faStatus" class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white">
            <option value="PARA_ACONTECER" ${status === 'PARA_ACONTECER' ? 'selected' : ''}>Para acontecer</option>
            <option value="FECHADA" ${status === 'FECHADA' ? 'selected' : ''}>Fechada</option>
          </select>
        </div>
        <div>
          <label class="block text-gray-300 font-semibold mb-1">Data da festa</label>
          <input id="faDataFesta" type="date" value="${dataFesta}"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-gray-300 font-semibold mb-1">Horário</label>
          <input id="faHorario" value="${horario}"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white" />
        </div>
        <div>
          <label class="block text-gray-300 font-semibold mb-1">Telefone</label>
          <input id="faTelefone" value="${telefone}"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-gray-300 font-semibold mb-1">Contratante</label>
          <input id="faContratante" value="${contratante}"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white" />
        </div>
        <div>
          <label class="block text-gray-300 font-semibold mb-1">Aniversariante</label>
          <input id="faAniversariante" value="${aniversariante}"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-gray-300 font-semibold mb-1">Idade</label>
          <input id="faIdade" type="number" min="0" value="${idade}"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white" />
        </div>

        <div>
          <label class="block text-gray-300 font-semibold mb-1">Data pagamento</label>
          <input id="faDataPgto" type="date" value="${dataPgto}"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white" />
        </div>

        <div>
          <label class="block text-gray-300 font-semibold mb-1">Valor</label>
          <input id="faValor" type="number" step="0.01" value="${valor}"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-gray-300 font-semibold mb-1">Vendedor</label>
          <select id="faVendedor"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white">
            <option value="">Carregando...</option>
          </select>
        </div>

        <div>
          <label class="block text-gray-300 font-semibold mb-1">Kit festa</label>
          <select id="faKit"
            class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white">
            <option value="" ${kitVal === '' ? 'selected' : ''}>Não informado</option>
            <option value="true" ${kitVal === 'true' ? 'selected' : ''}>Sim</option>
            <option value="false" ${kitVal === 'false' ? 'selected' : ''}>Não</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-gray-300 font-semibold mb-1">Observações</label>
        <textarea id="faObs" rows="3"
          class="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white">${obs}</textarea>
      </div>
    </div>
  `;
}

async function preencherSelectVendedores(selectId, selecionadoId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  sel.innerHTML = `<option value="">Selecione</option>`;

  const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario/vendedores`);
  if (!res || !res.ok) {
    sel.innerHTML = `<option value="">(erro ao carregar)</option>`;
    return;
  }

  const vendedores = await res.json().catch(() => []);
  vendedores.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id_colaborador;
    opt.textContent = v.nome_completo;
    if (selecionadoId && Number(selecionadoId) === Number(v.id_colaborador)) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function abrirModalEditarFestaAniversario(id) {
  const f = cacheFestasAniversario.get(Number(id));
  if (!f) {
    Swal.fire({ icon: 'error', title: 'Erro', text: 'Não encontrei os dados dessa festa no cache.', background: '#222', color: '#fff' });
    return;
  }

  const conteudo = montarFormFestaAniversario(f);

  abrirModalUniversal(`Editar Evento #${id}`, conteudo, async () => {
    await salvarEdicaoFestaAniversario(id);
  });

  // carrega vendedores e seleciona o atual
  await preencherSelectVendedores('faVendedor', f.id_vendedor);
}

async function salvarEdicaoFestaAniversario(id) {
  const payload = {
    tipo: "ANIVERSARIO_GAMER",
    status: document.getElementById('faStatus')?.value || 'PARA_ACONTECER',
    data_festa: document.getElementById('faDataFesta')?.value || null,
    horario: document.getElementById('faHorario')?.value || null,
    contratante: document.getElementById('faContratante')?.value || null,
    telefone: document.getElementById('faTelefone')?.value || null,
    aniversariante: document.getElementById('faAniversariante')?.value || null,
    idade: (() => {
      const v = document.getElementById('faIdade')?.value;
      return v === '' || v == null ? null : Number(v);
    })(),
    data_pagamento: document.getElementById('faDataPgto')?.value || null,
    valor: (() => {
      const v = document.getElementById('faValor')?.value;
      return v === '' || v == null ? null : Number(v);
    })(),
    kit_festa: (() => {
      const v = document.getElementById('faKit')?.value ?? '';
      if (v === '') return null;
      return v === 'true';
    })(),
    id_vendedor: (() => {
      const v = document.getElementById('faVendedor')?.value ?? '';
      return v === '' ? null : Number(v);
    })(),
    observacoes: document.getElementById('faObs')?.value || null
  };

  const btn = document.getElementById('modalConfirmBtn');
  const original = btn?.innerText;
  if (btn) { btn.disabled = true; btn.innerText = 'SALVANDO...'; }

  try {
    const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res) throw new Error('Sem resposta do servidor.');

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Falha ao atualizar.');
    }

    Swal.fire({ icon: 'success', title: 'Atualizado!', timer: 1200, showConfirmButton: false, background: '#222', color: '#fff' });

    fecharModalUniversal();
    await carregarFestasAniversario();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Erro', text: e.message || 'Erro ao atualizar.', background: '#222', color: '#fff' });
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = original || 'SALVAR'; }
  }
}


async function carregarFiltrosFestasAniversario() {
  await Promise.all([
    carregarSelectVendedoresFesta(),
    carregarSelectUnidadesFesta()
  ]);
}

async function carregarSelectVendedoresFesta() {
  const sel = document.getElementById('filtroVendedorFesta');
  if (!sel) return;

  sel.innerHTML = `<option value="">Todos os vendedores</option>`;

  try {
    const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario/vendedores`);
    if (!res || !res.ok) return;

    const dados = await res.json();
    if (!Array.isArray(dados)) return;

    dados.forEach(v => {
      sel.innerHTML += `<option value="${v.id_colaborador}">${v.nome_completo}</option>`;
    });
  } catch (e) {
    console.error(e);
  }
}

async function carregarSelectUnidadesFesta() {
  const sel = document.getElementById('filtroUnidadeFesta');
  if (!sel) return;

  sel.innerHTML = `<option value="">Todas as unidades</option>`;

  try {
    const res = await fetchAdmin(`${API_URL}/admin/unidades`);
    if (!res || !res.ok) return;

    const unidades = await res.json();
    if (!Array.isArray(unidades)) return;

    unidades.forEach(u => {
      sel.innerHTML += `<option value="${u.id_unidade}">${u.nome_unidade}</option>`;
    });
  } catch (e) {
    console.error(e);
  }
}
function abrirModalFestaAniversario(modo, festaEncodedJson = null) {
  // modo: 'create' | 'edit'
  const festa = festaEncodedJson ? JSON.parse(decodeURIComponent(festaEncodedJson)) : null;

  document.getElementById('modalFestaTitulo').innerText =
    (modo === 'edit') ? 'Editar Festa' : 'Adicionar Festa';

  document.getElementById('festaModo').value = modo;
  document.getElementById('festaId').value = festa?.id_festa || festa?.id || '';

  // campos
  document.getElementById('festaData').value = festa?.data_festa || '';
  document.getElementById('festaHorario').value = festa?.horario || '';
  document.getElementById('festaContratante').value = festa?.contratante || '';
  document.getElementById('festaTelefone').value = festa?.telefone || '';
  document.getElementById('festaAniversariante').value = festa?.aniversariante || '';
  document.getElementById('festaIdade').value = festa?.idade ?? '';
  document.getElementById('festaDataPagamento').value = festa?.data_pagamento || '';
  document.getElementById('festaKit').value = (festa?.kit_festa === true) ? 'true' : (festa?.kit_festa === false ? 'false' : '');
  document.getElementById('festaValor').value = (festa?.valor ?? '');
  document.getElementById('festaStatus').value = festa?.status || 'PARA_ACONTECER';

  // vendedor/unidade (se já existir no registro)
  if (document.getElementById('festaVendedor')) {
    document.getElementById('festaVendedor').value = festa?.id_vendedor ?? '';
  }
  if (document.getElementById('festaUnidade')) {
    document.getElementById('festaUnidade').value = festa?.id_unidade ?? '1'; // ✅ default Cuiabá
  }

  const modal = document.getElementById('modalFesta');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function fecharModalFestaAniversario() {
  const modal = document.getElementById('modalFesta');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function salvarFestaAniversario(e) {
  e.preventDefault();

  const modo = document.getElementById('festaModo').value;
  const id = document.getElementById('festaId').value;

  const btn = document.getElementById('btnSalvarFesta');
  const original = btn.innerText;
  btn.innerText = "SALVANDO...";
  btn.disabled = true;

  const payload = {
    data_festa: document.getElementById('festaData').value || null,
    horario: document.getElementById('festaHorario').value || null,
    contratante: document.getElementById('festaContratante').value || null,
    telefone: document.getElementById('festaTelefone').value || null,
    aniversariante: document.getElementById('festaAniversariante').value || null,
    idade: document.getElementById('festaIdade').value ? parseInt(document.getElementById('festaIdade').value) : null,
    data_pagamento: document.getElementById('festaDataPagamento').value || null,
    kit_festa: document.getElementById('festaKit').value === '' ? null : (document.getElementById('festaKit').value === 'true'),
    valor: document.getElementById('festaValor').value === '' ? null : parseFloat(document.getElementById('festaValor').value),
    status: document.getElementById('festaStatus').value || 'PARA_ACONTECER',

    // ✅ novos campos
    id_vendedor: document.getElementById('festaVendedor')?.value ? parseInt(document.getElementById('festaVendedor').value) : null,
    id_unidade: document.getElementById('festaUnidade')?.value ? parseInt(document.getElementById('festaUnidade').value) : 1 // default Cuiabá
  };

  try {
    const url =
      (modo === 'edit')
        ? `${API_URL}/admin/festas-aniversario/${id}`
        : `${API_URL}/admin/festas-aniversario`;

    const method = (modo === 'edit') ? 'PUT' : 'POST';

    const res = await fetchAdmin(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res) {
      Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' });
      return;
    }

    if (res.ok) {
      Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Festa salva.', timer: 1400, showConfirmButton: false, background: '#222', color: '#fff' });
      fecharModalFestaAniversario();
      carregarFestasAniversario();
    } else {
      const err = await res.json().catch(() => ({}));
      Swal.fire({ icon: 'error', title: 'Erro', text: err.detail || 'Erro ao salvar.', background: '#222', color: '#fff' });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
  } finally {
    btn.innerText = original;
    btn.disabled = false;
  }
}

async function abrirModalNovaFestaAniversario() {
  const conteudo = `
    <form id="formNovaFesta" class="space-y-4 text-sm">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-400">Status</label>
          <select id="nfStatus" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]">
            <option value="PARA_ACONTECER">Para acontecer</option>
            <option value="FECHADA">Fechada</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-400">Data da festa</label>
          <input type="date" id="nfDataFesta"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-400">Horário</label>
          <input type="text" id="nfHorario" placeholder="Ex: 17 AS 20"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]" />
        </div>
        <div>
          <label class="text-xs text-gray-400">Telefone</label>
          <input type="text" id="nfTelefone"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-400">Contratante</label>
          <input type="text" id="nfContratante"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white uppercase outline-none focus:border-[#00FFFF]" />
        </div>
        <div>
          <label class="text-xs text-gray-400">Aniversariante</label>
          <input type="text" id="nfAniversariante"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white uppercase outline-none focus:border-[#00FFFF]" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="text-xs text-gray-400">Idade</label>
          <input type="number" id="nfIdade" min="0"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]" />
        </div>

        <div>
          <label class="text-xs text-gray-400">Data pagamento</label>
          <input type="date" id="nfDataPagamento"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]" />
        </div>

        <div>
          <label class="text-xs text-gray-400">Valor</label>
          <input type="number" id="nfValor" step="0.01"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-400">Kit festa</label>
          <select id="nfKit" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]">
            <option value="">Não informado</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>

        <div>
          <label class="text-xs text-gray-400">Vendedor</label>
          <select id="nfVendedor" class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]">
            <option value="">Carregando vendedores...</option>
          </select>
          <p class="text-[11px] text-gray-500 mt-1">Selecione para gravar o id_vendedor (join).</p>
        </div>
      </div>

      <div>
        <label class="text-xs text-gray-400">Observações</label>
        <textarea id="nfObs" rows="3"
          class="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-white outline-none focus:border-[#00FFFF]"></textarea>
      </div>
    </form>
  `;

  abrirModalUniversal("Novo Evento - Aniversário Gamer", conteudo, salvarNovaFestaAniversario);

  // carrega vendedores no select
  await carregarVendedoresNoSelect("nfVendedor");
}

async function carregarVendedoresNoSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  sel.innerHTML = `<option value="">Selecione</option>`;

  try {
    const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario/vendedores`);
    if (!res || !res.ok) {
      sel.innerHTML = `<option value="">(erro ao carregar)</option>`;
      return;
    }

    const vendedores = await res.json().catch(() => []);
    if (!Array.isArray(vendedores) || vendedores.length === 0) {
      sel.innerHTML = `<option value="">(nenhum vendedor)</option>`;
      return;
    }

    vendedores.forEach(v => {
      sel.innerHTML += `<option value="${v.id_colaborador}">${v.nome_completo}</option>`;
    });
  } catch (e) {
    console.error(e);
    sel.innerHTML = `<option value="">(erro)</option>`;
  }
}

async function salvarNovaFestaAniversario() {
  // pega campos do modal
  const status = document.getElementById("nfStatus")?.value || "PARA_ACONTECER";
  const data_festa = document.getElementById("nfDataFesta")?.value || null;
  const horario = document.getElementById("nfHorario")?.value || null;
  const telefone = document.getElementById("nfTelefone")?.value || null;
  const contratante = document.getElementById("nfContratante")?.value || null;
  const aniversariante = document.getElementById("nfAniversariante")?.value || null;
  const idade = document.getElementById("nfIdade")?.value ? parseInt(document.getElementById("nfIdade").value) : null;
  const data_pagamento = document.getElementById("nfDataPagamento")?.value || null;
  const valor = document.getElementById("nfValor")?.value ? parseFloat(document.getElementById("nfValor").value) : null;

  const kitRaw = document.getElementById("nfKit")?.value ?? "";
  const kit_festa = kitRaw === "" ? null : (kitRaw === "true");

  const id_vendedor = document.getElementById("nfVendedor")?.value ? parseInt(document.getElementById("nfVendedor").value) : null;

  const observacoes = document.getElementById("nfObs")?.value || null;

  // payload para sua tb_festas_aniversario
  const payload = {
    tipo: "ANIVERSARIO_GAMER",
    status,
    data_festa,
    horario,
    telefone,
    contratante,
    aniversariante,
    idade,
    data_pagamento,
    kit_festa,
    valor,
    id_vendedor,
    observacoes,
    // se o backend já força unidade por ctx, pode remover.
    id_unidade: 1
  };

  const btn = document.getElementById("modalConfirmBtn");
  const original = btn?.innerText;
  if (btn) { btn.disabled = true; btn.innerText = "SALVANDO..."; }

  try {
    const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res) {
      Swal.fire({ icon: "error", title: "Erro", text: "Sem resposta do servidor.", background: "#222", color: "#fff" });
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      Swal.fire({ icon: "error", title: "Erro", text: err.detail || "Falha ao salvar evento.", background: "#222", color: "#fff" });
      return;
    }

    Swal.fire({ icon: "success", title: "Salvo!", text: "Novo evento cadastrado.", timer: 1400, showConfirmButton: false, background: "#222", color: "#fff" });

    fecharModalUniversal();
    carregarFestasAniversario();
  } catch (e) {
    console.error(e);
    Swal.fire({ icon: "error", title: "Erro", text: "Erro de conexão.", background: "#222", color: "#fff" });
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = original || "SALVAR"; }
  }
}

// estado global da ordenação da tabela de festas
let festasSort = { by: 'data_festa', dir: 'asc' };

// colunas que o backend permite ordenar (segurança)
const allowedSortColsFestas = new Set([
  'data_festa', 'horario', 'contratante', 'telefone', 'aniversariante',
  'idade', 'data_pagamento', 'kit_festa', 'valor',
  'id_vendedor', 'id_unidade', 'status', 'created_at'
]);

function toggleSortFestas(th) {
  const col = th.getAttribute('data-sort');
  if (!allowedSortColsFestas.has(col)) {
    console.warn('Coluna não permitida para ordenação:', col);
    return;
  }

  // ciclo: none -> asc -> desc -> none
  if (festasSort.by !== col) {
    festasSort.by = col;
    festasSort.dir = 'asc';
  } else {
    if (festasSort.dir === 'asc') festasSort.dir = 'desc';
    else if (festasSort.dir === 'desc') festasSort = { by: 'data_festa', dir: 'asc' }; // "limpa"
    else festasSort.dir = 'asc';
  }

  atualizarSetasOrdenacaoFestas();
  carregarFestasAniversario();
}

function atualizarSetasOrdenacaoFestas() {
  // reseta todas
  document.querySelectorAll('#aniversario thead th[data-sort]').forEach(th => {
    const arrow = th.querySelector('[data-arrow]');
    if (arrow) {
      arrow.textContent = '↕';
      arrow.classList.remove('text-[#00FFFF]');
      arrow.classList.add('text-gray-500');
    }
  });

  // marca a ativa
  const thAtivo = document.querySelector(`#aniversario thead th[data-sort="${festasSort.by}"]`);
  if (!thAtivo) return;

  const arrow = thAtivo.querySelector('[data-arrow]');
  if (!arrow) return;

  arrow.textContent = (festasSort.dir === 'desc') ? '↓' : '↑';
  arrow.classList.remove('text-gray-500');
  arrow.classList.add('text-[#00FFFF]');
}


function onSortChange(selectEl) {
  const col = selectEl.getAttribute('data-sort');
  const dir = selectEl.value; // '', 'asc', 'desc'

  // se limpou (—), volta pro padrão
  if (!dir) {
    festasSort = { by: 'data_festa', dir: 'asc' };
    // limpa todos os selects
    document.querySelectorAll('#aniversario thead select[data-sort]').forEach(s => {
      if (s !== selectEl) s.value = '';
    });
    carregarFestasAniversario();
    return;
  }

  // valida coluna
  if (!allowedSortColsFestas.has(col)) {
    console.warn('Coluna de ordenação não permitida:', col);
    selectEl.value = '';
    return;
  }

  // deixa apenas UM select ativo por vez
  document.querySelectorAll('#aniversario thead select[data-sort]').forEach(s => {
    if (s !== selectEl) s.value = '';
  });

  festasSort = { by: col, dir };
  carregarFestasAniversario();
}
function limparPeriodoFesta() {
  document.getElementById('filtroDataIniFesta').value = '';
  document.getElementById('filtroDataFimFesta').value = '';
  carregarFestasAniversario();
}
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formCadastroAluno');
  if (form) form.addEventListener('submit', cadastrarAluno);
});

async function cadastrarAluno(e) {
  e.preventDefault();

  const form = e.target;
  const btn = e.submitter || form.querySelector('button[type="submit"]');

  // Lê os campos do HTML
  const nome = document.getElementById('cadNome')?.value?.trim() || '';
  const email = document.getElementById('cadEmail')?.value?.trim() || '';
  const cpfRaw = document.getElementById('cadCpf')?.value?.trim() || '';
  const dataNascimento = document.getElementById('cadNascimento')?.value || null;
  const celularRaw = document.getElementById('cadCelular')?.value?.trim() || '';
  const telefoneRaw = document.getElementById('cadTelefone')?.value?.trim() || '';
  const senha = document.getElementById('cadSenha')?.value || '';
  const turmaCodigo = document.getElementById('cadTurma')?.value || '';

  // (Opcional) Normaliza CPF/telefones (remove máscara)
  const cpf = cpfRaw.replace(/\D/g, '');
  const celular = celularRaw.replace(/\D/g, '');
  const telefone = telefoneRaw.replace(/\D/g, '');

  // Validações básicas
  if (!nome || !email || !senha || !turmaCodigo) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos obrigatórios',
      text: 'Preencha Nome, Email, Senha e Turma.',
      background: '#222',
      color: '#fff'
    });
    return;
  }

  // CPF pode ser opcional, mas se veio preenchido, valida tamanho
  if (cpf && cpf.length !== 11) {
    Swal.fire({
      icon: 'warning',
      title: 'CPF inválido',
      text: 'O CPF precisa ter 11 dígitos.',
      background: '#222',
      color: '#fff'
    });
    return;
  }

  const payload = {
    nome,
    email,
    cpf: cpfRaw,              // se você preferir salvar com máscara no banco, mantém cpfRaw
    data_nascimento: dataNascimento,
    celular: celularRaw,      // idem: mantém com máscara (ou troque por "celular" para salvar só dígitos)
    telefone: telefoneRaw,    // idem: mantém com máscara (ou troque por "telefone")
    senha,
    turma_codigo: turmaCodigo
  };

  try {
    if (btn) btn.disabled = true;

    Swal.fire({
      title: 'Cadastrando...',
      allowOutsideClick: false,
      background: '#222',
      color: '#fff',
      didOpen: () => Swal.showLoading()
    });

    const res = await fetchAdmin(`${API_URL}/admin/cadastrar-aluno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res) return; // fetchAdmin já trata 401 e redireciona

    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: 'Aluno cadastrado!',
        timer: 1400,
        showConfirmButton: false,
        background: '#222',
        color: '#fff'
      });

      form.reset();

      // Se você tiver essas funções, ajuda a atualizar a tela:
      if (typeof carregarAlunos === 'function') carregarAlunos();
      if (typeof carregarSelectAlunos === 'function') carregarSelectAlunos();
    } else {
      const err = await res.json().catch(() => ({}));
      Swal.fire({
        icon: 'error',
        title: 'Erro ao cadastrar',
        text: err.detail || 'Falha ao cadastrar aluno.',
        background: '#222',
        color: '#fff'
      });
    }
  } catch (error) {
    console.error(error);
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'Erro de conexão.',
      background: '#222',
      color: '#fff'
    });
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirModalAgendarReposicao() {
  const modal = document.getElementById('modalAgendarRepo');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // garante selects carregados
  carregarSelectRepTurma();
  carregarSelectProfessores();
  carregarSelectAlunos();

  setTimeout(aplicarMascaras, 50);
}

function fecharModalAgendarReposicao() {
  const modal = document.getElementById('modalAgendarRepo');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
}
// ===============================
// AULAS EXPERIMENTAIS (HTML IDs do seu portal)
// ===============================
let cacheAulasExp = [];
let cacheEquipeAExp = [];

function podeEditarAulaExp() {
  return (nivelUsuarioLogado === 3 || nivelUsuarioLogado >= 8);
}



function formatarDataBR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

function formatarDataHoraBR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

async function carregarVendedoresAExp() {
  // Você já usa esse endpoint no portal:
  // carregarListaEquipe() chama /admin/listar-equipe :contentReference[oaicite:3]{index=3}
  const res = await fetchAdmin(`${API_URL}/admin/listar-equipe`);
  if (!res) return;

  const equipe = await res.json();
  cacheEquipeAExp = Array.isArray(equipe) ? equipe : [];

  const sel = document.getElementById('aexpVendedor');
  if (!sel) return;

  sel.innerHTML = `<option value="">Selecione...</option>`;

  // Se quiser filtrar só vendedores/gerente, você pode filtrar aqui pelo cargo/nivel
  // mas por enquanto vou listar todos (pra não “sumir” ninguém por regra errada).
  cacheEquipeAExp.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id_colaborador;
    opt.textContent = p.nome_completo || `#${p.id_colaborador}`;
    sel.appendChild(opt);
  });
}

function nomeVendedorPorId(id_vendedor) {
  if (!id_vendedor) return '-';
  const v = cacheEquipeAExp.find(x => String(x.id_colaborador) === String(id_vendedor));
  return v?.nome_completo || `#${id_vendedor}`;
}

// Abre modal (novo ou edição)
// Abre modal (novo ou edição)
function abrirModalAulaExp(id = null) {
  if (!podeEditarAulaExp()) return;

  const modal = document.getElementById('modalAulaExp');
  if (!modal) return;

  const titulo = document.getElementById('tituloModalAulaExp');
  const r = id ? cacheAulasExp.find(x => x.id === id) : null;

  document.getElementById('aexpId').value = r?.id || '';
  document.getElementById('aexpResponsavel').value = r?.responsavel || '';
  document.getElementById('aexpContato1').value = r?.contato1 || '';
  document.getElementById('aexpContato2').value = r?.contato2 || '';
  document.getElementById('aexpAluno').value = r?.aluno || '';

  // ==========================================================
  // CORREÇÃO DEFINITIVA DE DATA (FIM DO PULO DE DIA)
  // ==========================================================
  if (r && r.data_aula) {
      // r.data_aula vindo do banco como "2026-03-06"
      // Pegamos apenas os primeiros 10 caracteres (YYYY-MM-DD) 
      // Ignoramos qualquer conversão para "Date" que causaria erro de fuso
      const dataStringPura = r.data_aula.substring(0, 10);
      document.getElementById('aexpData').value = dataStringPura;
  } else {
      document.getElementById('aexpData').value = '';
  }
  // ==========================================================

  document.getElementById('aexpHorario').value = r?.horario || '';
  document.getElementById('aexpCurso').value = r?.curso || '';
  document.getElementById('aexpOrigem').value = r?.origem || '';
  document.getElementById('aexpVendedor').value = r?.id_vendedor || '';
  document.getElementById('aexpStatusAtend').value = r?.status_atendimento || '';
  document.getElementById('aexpObs').value = r?.observacao || '';

  if (titulo) titulo.innerText = r ? 'Editar Aula Experimental' : 'Nova Aula Experimental';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function fecharModalAulaExp() {
  const modal = document.getElementById('modalAulaExp');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// =========================================================
// FUNÇÃO PRINCIPAL: Busca dados, preenche filtros e renderiza
// =========================================================
async function carregarAulasExperimentais() {
  const tbody = document.getElementById('tbody-aulas-experimentais');
  const btnNova = document.getElementById('btnNovaAulaExp');
  
  // Controla se o botão de "Nova Aula" aparece ou não de acordo com o nível
  if (btnNova) btnNova.classList.toggle('hidden', !podeEditarAulaExp());

  // Carrega os vendedores caso necessário para o modal de cadastro
  if (typeof carregarVendedoresAExp === 'function') {
      await carregarVendedoresAExp();
  }

  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-gray-500">Carregando...</td></tr>`;

  // Se você ainda tiver o input de busca global, ele continua funcionando
  const filtroGlobal = document.getElementById('filtroAulasExp');
  const q = (filtroGlobal?.value || '').trim();
  const params = new URLSearchParams();
  if (q) params.set('q', q);

  // Consulta o Back-end
  const res = await fetchAdmin(`${API_URL}/admin/aulas-experimentais?${params.toString()}`);
  if (!res) return;

  // Tratamento visual de erros do banco de dados na própria tabela
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    tbody.innerHTML = `<tr><td colspan="14" class="p-6 text-center text-red-500 font-bold bg-red-900/20 border border-red-800 rounded">ERRO DO SERVIDOR: ${err.detail || 'Falha ao buscar dados.'}</td></tr>`;
    return;
  }

  // Salva os dados no cache global
  const rows = await res.json();
  cacheAulasExp = Array.isArray(rows) ? rows : [];

  // =====================================================
  // CHAMADA DAS NOVAS FUNÇÕES DE FILTRO E ORDENAÇÃO
  // =====================================================
  
  // 1. Preenche as opções dos selects automaticamente com os dados que vieram
  if (typeof preencherSelectsAulasExp === 'function') {
      preencherSelectsAulasExp();
  }

  // 2. Coloca o ícone de setinha na coluna padrão de ordenação
  if (typeof atualizarIconesOrdemAulasExp === 'function') {
      atualizarIconesOrdemAulasExp();
  }

  // 3. Filtra, ordena e desenha a tabela na tela
  if (typeof filtrarAulasExpLocal === 'function') {
      filtrarAulasExpLocal(); 
  }
}


// 2. Função de Renderização: Desenha o HTML com as cores certas
function renderizarTabelaAulasExp(dados) {
  const tbody = document.getElementById('tbody-aulas-experimentais');
  if (!tbody) return;

  if (!dados || dados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-gray-500">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  const podeEditar = podeEditarAulaExp();

  tbody.innerHTML = dados.map(r => {
    const idCurto = String(r.id || '').slice(0, 8);
    const vendedorNome = r.tb_colaboradores ? r.tb_colaboradores.nome_completo : '---';
    const statusRaw = r.status_atendimento || '';
    const statusUpper = statusRaw.toUpperCase();

    // Cores e Estilos Padrão (Tema Escuro)
    let rowClass = "border-b border-[#333] hover:bg-[#2a2a2a] transition-colors";
    let statusBadgeClass = "text-gray-300";

    // Regras de Cores por Status
    if (statusUpper.includes('MATRICULOU') && !statusUpper.includes('NÃO')) {
        rowClass = "border-b border-green-800/50 bg-green-900/10 hover:bg-green-900/20 transition-colors";
        statusBadgeClass = "text-green-400 font-bold";
    } else if (statusUpper.includes('FALTOU') || statusUpper.includes('CANCELOU')) {
        rowClass = "border-b border-red-800/50 bg-red-900/10 hover:bg-red-900/20 transition-colors";
        statusBadgeClass = "text-red-400 font-bold";
    } else if (statusUpper.includes('REAGENDOU')) {
        rowClass = "border-b border-blue-800/50 bg-blue-900/10 hover:bg-blue-900/20 transition-colors";
        statusBadgeClass = "text-blue-400 font-bold";
    } else if (statusUpper.includes('PRESENTE')) {
        rowClass = "border-b border-yellow-800/50 bg-yellow-900/10 hover:bg-yellow-900/20 transition-colors";
        statusBadgeClass = "text-yellow-400 font-bold";
    }

    const acoes = podeEditar
      ? `
        <button onclick="abrirModalAulaExp('${r.id}')" class="text-[#00FFFF] hover:underline mr-3" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="excluirAulaExp('${r.id}')" class="text-red-400 hover:underline" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      `
      : `<span class="text-gray-600">—</span>`;

    return `
      <tr class="${rowClass}">
        <td class="p-3 font-mono text-[#00FFFF]">${idCurto}...</td>
        <td class="p-3">${r.responsavel || ''}</td>
        <td class="p-3">${r.contato1 || ''}</td>
        <td class="p-3">${r.contato2 || ''}</td>
        <td class="p-3 font-bold text-white">${r.aluno || ''}</td>
        <td class="p-3">${formatarDataBR(r.data_aula)}</td>
        <td class="p-3">${r.horario || ''}</td>
        <td class="p-3">${r.curso || ''}</td>
        <td class="p-3">${r.origem || ''}</td>
        <td class="p-3 truncate max-w-[120px]" title="${vendedorNome}">${vendedorNome}</td>
        <td class="p-3 ${statusBadgeClass}">${statusRaw}</td>
        <td class="p-3 max-w-[150px] truncate text-xs text-gray-400" title="${r.observacao || ''}">${r.observacao || ''}</td>
        <td class="p-3 text-gray-500 text-xs">${formatarDataHoraBR(r.created_at)}</td>
        <td class="p-3 text-right">${acoes}</td>
      </tr>
    `;
  }).join('');
}


// =========================================================
// 1. Função que preenche os selects automaticamente
// =========================================================
function preencherSelectsAulasExp() {
    // Helper para extrair valores únicos de uma coluna
    const getUnicos = (chavePai, chaveFilho) => {
        const valores = cacheAulasExp.map(r => {
            if (chaveFilho) return r[chavePai] ? r[chavePai][chaveFilho] : '';
            return r[chavePai] || '';
        }).filter(v => v && v.trim() !== '');
        
        return [...new Set(valores)].sort(); // Remove duplicados e põe em ordem alfabética
    };

    // Helper para preencher o HTML do select
    const popular = (id, valores, padrao = "Todos") => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const valorAtual = sel.value; // Guarda o que você selecionou pra não sumir
        sel.innerHTML = `<option value="">${padrao}</option>` + 
            valores.map(v => `<option value="${v}">${v}</option>`).join('');
        sel.value = valorAtual;
    };

    popular('f-resp', getUnicos('responsavel'));
    popular('f-aluno', getUnicos('aluno'));
    popular('f-curso', getUnicos('curso'));
    popular('f-origem', getUnicos('origem'));
    popular('f-vend', getUnicos('tb_colaboradores', 'nome_completo'));
    popular('f-status', getUnicos('status_atendimento'));

    // A data recebe um tratamento especial para aparecer em formato BR (DD/MM/AAAA)
    const datas = getUnicos('data_aula');
    const selData = document.getElementById('f-data');
    if (selData) {
        const atual = selData.value;
        selData.innerHTML = `<option value="">Todas</option>` + 
            datas.map(d => `<option value="${d}">${formatarDataBR(d)}</option>`).join('');
        selData.value = atual;
    }
}

// =========================================================
// 2. A função do filtro (Ajustada para Selects exatos)
// =========================================================
// =========================================================
// VARIÁVEL GLOBAL DE ORDENAÇÃO (Coloque fora das funções)
// =========================================================
let configOrdemAulasExp = {
    coluna: 'data_aula',
    crescente: false // false = mais recente primeiro
};

// =========================================================
// 1. Função chamada ao clicar no título da coluna
// =========================================================
function ordenarAulasExp(coluna) {
    if (configOrdemAulasExp.coluna === coluna) {
        // Se clicou na mesma coluna, inverte a ordem
        configOrdemAulasExp.crescente = !configOrdemAulasExp.crescente;
    } else {
        // Se clicou numa coluna nova, começa como crescente
        configOrdemAulasExp.coluna = coluna;
        configOrdemAulasExp.crescente = true;
    }
    
    // Atualiza os ícones no HTML
    atualizarIconesOrdemAulasExp();
    
    // Roda o filtro, que agora também faz a ordenação final
    filtrarAulasExpLocal();
}

// =========================================================
// 2. Função para alterar as setinhas visuais (FontAwesome)
// =========================================================
function atualizarIconesOrdemAulasExp() {
    // Reseta todos os ícones para o padrão (duas setinhas cinzas)
    const icones = document.querySelectorAll('th i.fas');
    icones.forEach(i => {
        i.className = 'fas fa-sort text-gray-600 ml-1';
    });

    // Coloca a seta certa na coluna ativa
    const iconeAtivo = document.getElementById(`sort-${configOrdemAulasExp.coluna}`);
    if (iconeAtivo) {
        if (configOrdemAulasExp.crescente) {
            iconeAtivo.className = 'fas fa-sort-up text-[#00FFFF] ml-1';
        } else {
            iconeAtivo.className = 'fas fa-sort-down text-[#00FFFF] ml-1';
        }
    }
}

// =========================================================
// 3. O Filtro Atualizado (Agora com Ordenação)
// =========================================================
function filtrarAulasExpLocal() {
    const fResp = document.getElementById('f-resp')?.value || '';
    const fAluno = document.getElementById('f-aluno')?.value || '';
    const fData = document.getElementById('f-data')?.value || ''; 
    const fCurso = document.getElementById('f-curso')?.value || '';
    const fOrigem = document.getElementById('f-origem')?.value || '';
    const fVend = document.getElementById('f-vend')?.value || '';
    const fStatus = document.getElementById('f-status')?.value || '';

    // PASSO A: Filtrar os dados
    let dadosProcessados = cacheAulasExp.filter(r => {
        const resp = r.responsavel || '';
        const aluno = r.aluno || '';
        const data = r.data_aula || '';
        const curso = r.curso || '';
        const origem = r.origem || '';
        const vendedor = r.tb_colaboradores ? r.tb_colaboradores.nome_completo : '';
        const status = r.status_atendimento || '';

        return (fResp === '' || resp === fResp) &&
               (fAluno === '' || aluno === fAluno) &&
               (fData === '' || data === fData) &&
               (fCurso === '' || curso === fCurso) &&
               (fOrigem === '' || origem === fOrigem) &&
               (fVend === '' || vendedor === fVend) &&
               (fStatus === '' || status === fStatus);
    });

    // PASSO B: Ordenar os dados filtrados
    const col = configOrdemAulasExp.coluna;
    const direcao = configOrdemAulasExp.crescente ? 1 : -1;

    dadosProcessados.sort((a, b) => {
        let valA = a[col] || '';
        let valB = b[col] || '';

        // Tratamento especial para nome do vendedor (que está aninhado no JSON)
        if (col === 'vendedor_nome') {
            valA = a.tb_colaboradores ? a.tb_colaboradores.nome_completo : '';
            valB = b.tb_colaboradores ? b.tb_colaboradores.nome_completo : '';
        }

        // Deixa tudo em minúsculo para a ordem alfabética não se confundir
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return -1 * direcao;
        if (valA > valB) return 1 * direcao;
        return 0;
    });

    // PASSO C: Renderizar
    renderizarTabelaAulasExp(dadosProcessados);
}

// =========================================================
// 3. Função do botão "Limpar"
// =========================================================
function limparFiltrosAulasExp() {
    document.getElementById('f-resp').value = '';
    document.getElementById('f-aluno').value = '';
    document.getElementById('f-data').value = '';
    document.getElementById('f-curso').value = '';
    document.getElementById('f-origem').value = '';
    document.getElementById('f-vend').value = '';
    document.getElementById('f-status').value = '';
    filtrarAulasExpLocal(); // Recarrega a tabela completa
}

async function salvarAulaExp(event) {
  event.preventDefault();
  if (!podeEditarAulaExp()) return;

  const id = document.getElementById('aexpId').value || null;

  const payload = {
    responsavel: (document.getElementById('aexpResponsavel').value || '').trim() || null,
    contato1: (document.getElementById('aexpContato1').value || '').trim() || null,
    contato2: (document.getElementById('aexpContato2').value || '').trim() || null,
    aluno: (document.getElementById('aexpAluno').value || '').trim(),
    data_aula: document.getElementById('aexpData').value,
    horario: (document.getElementById('aexpHorario').value || '').trim() || null,
    curso: (document.getElementById('aexpCurso').value || '').trim() || null,
    origem: (document.getElementById('aexpOrigem').value || '').trim() || null,
    id_vendedor: document.getElementById('aexpVendedor').value || null, // FK
    status_atendimento: (document.getElementById('aexpStatusAtend').value || '').trim() || null,
    observacao: (document.getElementById('aexpObs').value || '').trim() || null
  };

  if (!payload.aluno || !payload.data_aula) {
    Swal.fire({ icon: 'warning', title: 'Preencha os obrigatórios', text: 'ALUNO(A) e DATA DA AULA são obrigatórios.', background:'#222', color:'#fff' });
    return;
  }

  const url = id
    ? `${API_URL}/admin/aulas-experimentais/${id}`
    : `${API_URL}/admin/aulas-experimentais`;

  const method = id ? 'PATCH' : 'POST';

  const res = await fetchAdmin(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res) return;

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    Swal.fire({ icon: 'error', title: 'Erro ao salvar', text: txt || 'Falha ao salvar.', background:'#222', color:'#fff' });
    return;
  }

  fecharModalAulaExp();
  await carregarAulasExperimentais();
  Swal.fire({ icon: 'success', title: 'Salvo!', timer: 1200, showConfirmButton: false, background:'#222', color:'#fff' });
}

async function excluirAulaExp(id) {
  if (!podeEditarAulaExp()) return;

  const conf = await Swal.fire({
    icon: 'warning',
    title: 'Excluir aula experimental?',
    text: 'Isso não pode ser desfeito.',
    showCancelButton: true,
    confirmButtonText: 'Excluir',
    cancelButtonText: 'Cancelar',
    background:'#222', color:'#fff'
  });
  if (!conf.isConfirmed) return;

  const res = await fetchAdmin(`${API_URL}/admin/aulas-experimentais/${id}`, { method: 'DELETE' });
  if (!res) return;

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    Swal.fire({ icon: 'error', title: 'Erro ao excluir', text: txt || 'Falha ao excluir.', background:'#222', color:'#fff' });
    return;
  }

  await carregarAulasExperimentais();
  Swal.fire({ icon: 'success', title: 'Excluído!', timer: 1200, showConfirmButton: false, background:'#222', color:'#fff' });
}

// Busca “ao digitar” no filtro do HTML :contentReference[oaicite:5]{index=5}
document.addEventListener('DOMContentLoaded', () => {
  const filtro = document.getElementById('filtroAulasExp');
  if (!filtro) return;

  let t = null;
  filtro.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => carregarAulasExperimentais(), 300);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formAulaExp');
  if (form) form.addEventListener('submit', salvarAulaExp);
});


// 2. Função extraída que desenha o HTML da tabela (É a mesma lógica que já tínhamos feito)
function renderizarTabelaAulasExp(dados) {
  const tbody = document.getElementById('tbody-aulas-experimentais');
  if (!tbody) return;

  if (!dados || dados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-gray-500">Nenhum registro encontrado nos filtros.</td></tr>`;
    return;
  }

  const podeEditar = podeEditarAulaExp();

  tbody.innerHTML = dados.map(r => {
    const idCurto = String(r.id || '').slice(0, 8);
    const vendedorNome = r.tb_colaboradores ? r.tb_colaboradores.nome_completo : '---';
    const statusRaw = r.status_atendimento || '';
    const statusUpper = statusRaw.toUpperCase();

    // CORREÇÃO DEFINITIVA DE FUSO HORÁRIO:
    // Não usamos 'new Date()'. Tratamos a string "YYYY-MM-DD" diretamente.
    const dataExibicao = r.data_aula ? (() => {
        const partes = r.data_aula.split('T')[0].split('-');
        if (partes.length !== 3) return r.data_aula;
        const [ano, mes, dia] = partes;
        return `${dia}/${mes}/${ano}`; // Retorna DD/MM/YYYY puro
    })() : '---';

    let rowClass = "border-b border-[#333] hover:bg-[#2a2a2a] transition-colors";
    let statusBadgeClass = "text-gray-300";

    if (statusUpper.includes('MATRICULOU') && !statusUpper.includes('NÃO')) {
        rowClass = "border-b border-green-800/50 bg-green-900/10 hover:bg-green-900/20 transition-colors";
        statusBadgeClass = "text-green-400 font-bold";
    } else if (statusUpper.includes('FALTOU') || statusUpper.includes('CANCELOU')) {
        rowClass = "border-b border-red-800/50 bg-red-900/10 hover:bg-red-900/20 transition-colors";
        statusBadgeClass = "text-red-400 font-bold";
    } else if (statusUpper.includes('REAGENDOU')) {
        rowClass = "border-b border-blue-800/50 bg-blue-900/10 hover:bg-blue-900/20 transition-colors";
        statusBadgeClass = "text-blue-400 font-bold";
    } else if (statusUpper.includes('PRESENTE')) {
        rowClass = "border-b border-yellow-800/50 bg-yellow-900/10 hover:bg-yellow-900/20 transition-colors";
        statusBadgeClass = "text-yellow-400 font-bold";
    }

    const acoes = podeEditar
      ? `
        <button onclick="abrirModalAulaExp('${r.id}')" class="text-[#00FFFF] hover:underline mr-3" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="excluirAulaExp('${r.id}')" class="text-red-400 hover:underline" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      `
      : `<span class="text-gray-600">—</span>`;

    return `
      <tr class="${rowClass}">
        <td class="p-3 font-mono text-[#00FFFF]">${idCurto}...</td>
        <td class="p-3 text-xs uppercase">${r.responsavel || ''}</td>
        <td class="p-3 text-xs">${r.contato1 || ''}</td>
        <td class="p-3 text-xs">${r.contato2 || ''}</td>
        <td class="p-3 font-bold text-white uppercase">${r.aluno || ''}</td>
        <td class="p-3 font-mono text-xs text-[#00FFFF]">${dataExibicao}</td>
        <td class="p-3 text-xs">${r.horario || ''}</td>
        <td class="p-3 text-xs uppercase">${r.curso || ''}</td>
        <td class="p-3 text-[10px] uppercase">${r.origem || ''}</td>
        <td class="p-3 truncate max-w-[120px] text-xs" title="${vendedorNome}">${vendedorNome}</td>
        <td class="p-3 text-xs ${statusBadgeClass}">${statusRaw}</td>
        <td class="p-3 max-w-[150px] truncate text-[10px] text-gray-400" title="${r.observacao || ''}">${r.observacao || ''}</td>
        <td class="p-3 text-gray-500 text-[9px]">${formatarDataHoraBR(r.created_at)}</td>
        <td class="p-3 text-right">${acoes}</td>
      </tr>
    `;
  }).join('');
}

let meuChartFrequencia = null;

// Registre o plugin globalmente no topo do arquivo
Chart.register(ChartDataLabels);

let chartsFrequencia = {};

// Variável global para gerenciar as instâncias dos gráficos
let chartsFrequenciaDetalhada = {};



/**
 * Renderiza TODO o Dashboard de Frequência em uma única chamada.
 * Resolve problemas de lentidão, dessincronia de filtros e restaura o gráfico mensal.
 */

/**
 * Renderiza TODO o Dashboard de Frequência em uma única chamada.
 * Resolve problemas de lentidão, dessincronia de filtros e restaura o gráfico mensal.
 */
async function carregarDashboardFrequenciaCompleto() {
    // 1. CAPTURA DE FILTROS E PREPARAÇÃO DA URL
    const dataInicio = document.getElementById('filtro-data-inicio')?.value;
    const dataFim = document.getElementById('filtro-data-fim')?.value;

    let url = `${API_URL}/admin/dashboard-frequencia-unificado?`;
    if (dataInicio) url += `data_inicio=${dataInicio}&`;
    if (dataFim) url += `data_fim=${dataFim}`;

    try {
        // 2. CHAMADA À API (BACKEND RENDER)
        const res = await fetchAdmin(url);
        if (!res || !res.ok) return;
        const dados = await res.json();

        // 3. ATUALIZAÇÃO DOS KPIs NO TOPO (ASSIDUIDADE REAL)
        // A assiduidade considera apenas P / (P + F), ignorando o R para não mascarar faltas.
        const g = dados.global;
        const totalEventos = (g.presencas || 0) + (g.faltas || 0) + (g.reposicoes || 0);
        
        if (document.getElementById('dash-assiduidade')) {
            document.getElementById('dash-assiduidade').innerText = `${g.assiduidade}%`;
        }
        if (document.getElementById('barra-assiduidade')) {
            document.getElementById('barra-assiduidade').style.width = `${g.assiduidade}%`;
        }

        // 4. GRÁFICO DOUGHNUT CENTRAL (DISTRIBUIÇÃO GERAL)
        const ctxGeral = document.getElementById('chartFrequencia')?.getContext('2d');
        if (ctxGeral) {
            if (window.meuChartFrequencia) window.meuChartFrequencia.destroy();
            window.meuChartFrequencia = new Chart(ctxGeral, {
                type: 'doughnut',
                data: {
                    labels: ['Presenças', 'Faltas', 'Reposições'],
                    datasets: [{
                        data: [g.presencas, g.faltas, g.reposicoes],
                        backgroundColor: ['#00FF88', '#FF3131', '#00DDEE'], // Verde, Vermelho, Ciano
                        borderColor: '#111', borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'bottom', labels: { color: '#fff', font: { size: 10 } } },
                        datalabels: {
                            color: '#000', font: { weight: 'bold', size: 10 },
                            formatter: (val) => val > 0 ? `${val}\n(${((val/totalEventos)*100).toFixed(1)}%)` : ''
                        }
                    },
                    cutout: '70%'
                }
            });
        }

        // 5. GRÁFICO DE EVOLUÇÃO MENSAL (LINHA)
        const ctxMes = document.getElementById('chartFrequenciaMes')?.getContext('2d');
        if (ctxMes && dados.por_mes) {
            const meses = Object.keys(dados.por_mes).sort();
            if (chartsFrequenciaDetalhada.mes) chartsFrequenciaDetalhada.mes.destroy();
            chartsFrequenciaDetalhada.mes = new Chart(ctxMes, {
                type: 'line',
                data: {
                    labels: meses,
                    datasets: [
                        { label: 'Presenças', data: meses.map(m => dados.por_mes[m].P), borderColor: '#00FF88', backgroundColor: '#00FF8822', fill: true, tension: 0.3 },
                        { label: 'Reposições', data: meses.map(m => dados.por_mes[m].R || 0), borderColor: '#00DDEE', backgroundColor: '#00DDEE22', fill: true, tension: 0.3 },
                        { label: 'Faltas', data: meses.map(m => dados.por_mes[m].F), borderColor: '#FF3131', backgroundColor: '#FF313122', fill: true, tension: 0.3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#888' } }, datalabels: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#666' } },
                        x: { grid: { display: false }, ticks: { color: '#666' } }
                    }
                }
            });
        }

        // 6. HELPER PARA GRÁFICOS DE BARRAS EMPILHADAS (TURMA, CURSO, PROFESSOR)
        const renderStackedBar = (id, key, chartKey) => {
            if (!dados[key]) return;
            const labels = Object.keys(dados[key]);
            const ctx = document.getElementById(id)?.getContext('2d');
            if (ctx) {
                if (chartsFrequenciaDetalhada[chartKey]) chartsFrequenciaDetalhada[chartKey].destroy();
                chartsFrequenciaDetalhada[chartKey] = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [
                            { label: 'Presenças', data: labels.map(l => dados[key][l].P), backgroundColor: '#00FF88' },
                            { label: 'Faltas', data: labels.map(l => dados[key][l].F), backgroundColor: '#FF3131' },
                            { label: 'Reposições', data: labels.map(l => dados[key][l].R || 0), backgroundColor: '#00DDEE' }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                        plugins: {
                            legend: { display: false },
                            datalabels: {
                                color: '#000', font: { weight: 'bold', size: 9 },
                                formatter: (val, context) => {
                                    if (val === 0) return '';
                                    let tLocal = 0;
                                    context.chart.data.datasets.forEach(d => tLocal += d.data[context.dataIndex]);
                                    return `${val}\n(${((val/tLocal)*100).toFixed(0)}%)`;
                                }
                            }
                        }
                    }
                });
            }
        };

        renderStackedBar('chartFrequenciaTurma', 'por_turma', 'turma');
        renderStackedBar('chartFrequenciaCurso', 'por_curso', 'curso');
        renderStackedBar('chartFrequenciaProfessor', 'por_professor', 'professor');

        // 7. TABELA DE ALERTA: ALUNOS CRÍTICOS
        const tbody = document.getElementById('lista-alunos-criticos');
        if (tbody && dados.alunos_criticos) {
            tbody.innerHTML = dados.alunos_criticos.map(a => `
                <tr class="border-b border-[#333] hover:bg-white/[0.02] transition-colors">
                    <td class="p-3 text-white font-bold text-xs uppercase">${a.nome}</td>
                    <td class="p-3 text-gray-400 text-xs font-mono">${a.turma}</td>
                    <td class="p-3 text-center">
                        <span class="bg-red-900/20 text-red-400 px-2 py-1 rounded border border-red-800/30 font-black text-[10px]">
                            ${a.faltas} FALTAS
                        </span>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="3" class="p-4 text-center text-gray-600">Nenhum alerta crítico.</td></tr>';
        }

    } catch (e) { 
        console.error("Erro crítico na renderização do dashboard:", e); 
    }
}

/**
 * Lógica para liberar os campos de upload e o botão de salvar 
 * apenas após a seleção da turma.
 */
function liberarUploadChamada() {
    const turma = document.getElementById('selectTurmaChamada').value;
    const areaFinalizar = document.getElementById('area-finalizar-chamada');
    
    if (turma) {
        areaFinalizar.classList.remove('opacity-50', 'pointer-events-none');
        areaFinalizar.classList.add('border-[#00FFFF]');
        carregarListaChamada(); 
    } else {
        areaFinalizar.classList.add('opacity-50', 'pointer-events-none');
        areaFinalizar.classList.remove('border-[#00FFFF]');
    }
}

/**
 * Envia a chamada estruturada acompanhada do arquivo de imagem.
 */
async function enviarChamadaComFoto() {
    const codTurma = document.getElementById('selectTurmaChamada').value;
    const dataAula = document.getElementById('dataChamada').value;
    const fotoArquivo = document.getElementById('fotoChamada').files[0];
    const checks = document.querySelectorAll('.presenca-check');
    
    if (!dataAula) return Swal.fire("Erro", "Selecione a data da aula.", "error");
    if (!fotoArquivo) return Swal.fire("Foto Obrigatória", "Anexe a foto da lista assinada.", "warning");

    try {
        Swal.fire({ title: 'Comprimindo e Enviando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // --- LÓGICA DE COMPRESSÃO ---
        const comprimirImagem = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 1280; // Redimensiona para HD para poupar espaço
                        let width = img.width;
                        let height = img.height;

                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Converte para JPEG com 60% de qualidade
                        canvas.toBlob((blob) => {
                            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                        }, 'image/jpeg', 0.6); 
                    };
                };
            });
        };

        const fotoComprimida = await comprimirImagem(fotoArquivo);

        // --- PREPARAÇÃO DO ENVIO ---
        const listaPresenca = Array.from(checks).map(c => ({
            id_aluno: parseInt(c.getAttribute('data-id')),
            status_presenca: c.checked ? 'P' : 'F' 
        }));

        const formData = new FormData();
        formData.append('codigo_turma', codTurma);
        formData.append('data_aula', dataAula);
        formData.append('lista_alunos', JSON.stringify(listaPresenca));
        // O nome aqui DEVE ser exatamente 'arquivo_foto', que é o que o Python espera
        formData.append('arquivo_foto', fotoComprimida); 

        const res = await fetch(`${API_URL}/admin/chamada/salvar-v3`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                // ⚠️ ATENÇÃO: NUNCA coloque 'Content-Type': 'multipart/form-data' aqui! 
                // O próprio navegador precisa gerar o cabeçalho com os boundaries do arquivo.
            },
            body: formData
        });

        if (res.ok) {
            Swal.fire("Sucesso!", "Chamada salva com foto otimizada.", "success");
            document.getElementById('fotoChamada').value = '';
            liberarUploadChamada(); 
        } else {
            // CORREÇÃO DO ERRO DO SWEETALERT2 PARA ERROS 422
            const erro = await res.json();
            console.error("Detalhes do erro FastAPI:", erro); // Mostra no F12 do navegador
            
            let mensagemErro = "Falha ao salvar.";
            
            if (erro.detail) {
                if (Array.isArray(erro.detail)) {
                    // Pega a explicação exata de qual campo do formulário faltou (Erro 422)
                    mensagemErro = "Faltam campos: " + erro.detail.map(e => e.loc[e.loc.length-1]).join(', ');
                } else if (typeof erro.detail === 'string') {
                    // Erros 500 ou 404 que nós escrevemos no Python
                    mensagemErro = erro.detail;
                } else {
                    // Força virar string para não quebrar o SweetAlert
                    mensagemErro = JSON.stringify(erro.detail); 
                }
            }
            
            Swal.fire("Erro de Validação", mensagemErro, "error");
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Erro", "Erro ao processar a chamada.", "error");
    }
}

function formatarStatus(status) {
    switch(status) {
        case 'P': return '<span class="text-green-400 font-bold">P</span>';
        case 'R': return '<span class="text-blue-400 font-bold">R</span>'; // Azul para Reposição
        case 'F': return '<span class="text-red-400 font-bold">F</span>';
        default: return status;
    }
}

function renderizarGraficoCursos(dadosCursos) {
    const ctx = document.getElementById('graficoCursos')?.getContext('2d');
    if (!ctx) return;
    if (window.chartCursos) window.chartCursos.destroy();
    window.chartCursos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dadosCursos),
            datasets: [{ label: 'Turmas', data: Object.values(dadosCursos), backgroundColor: '#00FFFF', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// Funções de carregamento de dados que estavam faltando
async function carregarTurmasParaChamada() {
    const select = document.getElementById('selectTurmaChamada');
    if (!select) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
        if (res && res.ok) {
            const turmas = await res.json();
            
            select.innerHTML = '<option value="">Selecione a Turma...</option>';
            
            turmas.forEach(t => {
                // Pega as 3 primeiras letras do dia (ex: Quarta-feira -> Qua)
                const diaAbrev = t.dia_semana ? t.dia_semana.substring(0, 3) : "";
                
                // Monta o texto: Código Dia (Horário)
                const textoFinal = `${t.codigo_turma} ${diaAbrev} (${t.horario})`;
                
                const option = document.createElement('option');
                option.value = t.codigo_turma;
                option.textContent = textoFinal;
                select.appendChild(option);
            });
        }
    } catch (e) {
        console.error("Erro ao popular seletor de turmas:", e);
    }
}

/**
 * Gera o modelo de chamada para impressão capturando o professor automaticamente.
 */
async function imprimirModeloChamada() {
    const selectTurma = document.getElementById('selectTurmaChamada');
    const codTurma = selectTurma.value;
    
    if (!codTurma) return Swal.fire("Erro", "Selecione uma turma primeiro.", "error");

    // 1. Busca os detalhes da turma para pegar o nome do professor 
    let nomeProfessor = "Não atribuído";
    try {
        const res = await fetchAdmin(`${API_URL}/admin/gerenciar-turmas`); // Rota que traz turmas com nomes de professores
        const turmas = await res.json();
        const turmaDados = turmas.find(t => t.codigo_turma === codTurma);
        
        if (turmaDados && turmaDados.tb_colaboradores) {
            nomeProfessor = turmaDados.tb_colaboradores.nome_completo;
        }
    } catch (e) {
        console.error("Erro ao buscar professor:", e);
    }

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const checks = document.querySelectorAll('.presenca-check'); // Alunos carregados na tela 
    
    if (checks.length === 0) return Swal.fire("Atenção", "Carregue a lista de alunos antes de imprimir.", "warning");

    let linhasAlunos = "";
    checks.forEach(check => {
        const nomeAluno = check.closest('tr').querySelector('td:first-child').innerText;
        const matricula = check.getAttribute('data-id').padStart(6, '0');
        
        linhasAlunos += `
            <tr style="border-bottom: 1px solid #000;">
                <td style="padding: 10px; border: 1px solid #000; text-align: center;">${matricula}</td>
                <td style="padding: 10px; border: 1px solid #000;">${nomeAluno}</td>
                <td style="padding: 10px; border: 1px solid #000; width: 300px;"></td>
            </tr>`;
    });

    const conteudoPrint = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10px; color: #000;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                <tr>
                    <td style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 15%;">Data: ${dataAtual}</td>
                    <td style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 10%;">Aula: ____</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center; background: #eee;">
                        <span style="font-size: 16px;"><b>${codTurma}</b></span><br>
                        <span style="font-size: 12px;">Prof. ${nomeProfessor}</span>
                    </td>
                    <td style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 20%;">Resumo: _________</td>
                </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #eee;">
                    <tr>
                        <th style="border: 1px solid #000; padding: 8px; width: 10%;">Matr.</th>
                        <th style="border: 1px solid #000; padding: 8px; text-align: left;">Aluno</th>
                        <th style="border: 1px solid #000; padding: 8px; text-align: left;">Assinaturas</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasAlunos}
                </tbody>
            </table>
            <div style="margin-top: 20px; text-align: right; font-size: 10px; border-top: 1px solid #eee; padding-top: 5px;">
                Javis Game Academy - Sistema de Gestão Escolar
            </div>
        </div>
    `;

    const win = window.open('', '', 'height=800,width=1000');
    win.document.write('<html><head><title>Modelo de Chamada - ' + codTurma + '</title></head><body>');
    win.document.write(conteudoPrint);
    win.document.write('</body></html>');
    win.document.close();
    
    setTimeout(() => {
        win.print();
        win.close();
    }, 500);
}

async function carregarReposicoes() {
    try {
        const res = await fetch(`${API_URL}/admin/agenda-geral`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (res.ok) {
            const dados = await res.json();
            const tbody = document.getElementById('tbodyReposicoes');
            if(!tbody) return;

            tbody.innerHTML = '';
            const reposicoes = dados.filter(d => d.tipo === 'reposicao');

            // Atualiza métricas
            document.getElementById('stats-repo-pendente').innerText = reposicoes.filter(r => r.status === 'Agendada').length;
            document.getElementById('stats-repo-total').innerText = reposicoes.length;
            document.getElementById('stats-repo-mes').innerText = reposicoes.filter(r => r.status === 'Concluída').length;

            if (reposicoes.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-gray-600 italic">Nenhum registro encontrado.</td></tr>`;
                return;
            }

            reposicoes.forEach(r => {
                const data = new Date(r.start);
                const dataFmt = data.toLocaleDateString('pt-BR');
                const horaFmt = data.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                
                let statusStyle = r.status === 'Concluída' 
                    ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                    : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';

                // --- O PULO DO GATO: Codifica o objeto para o botão de editar ---
                const rJson = encodeURIComponent(JSON.stringify(r));

                let botoes = r.status === 'Concluída'
                    ? `<button class="p-2 text-gray-600 cursor-not-allowed"><i class="fas fa-check-circle text-lg"></i></button>`
                    : `
                       <button onclick="abrirModalRepo('${rJson}')" class="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition" title="Editar Agenda">
                           <i class="fas fa-edit text-lg"></i>
                       </button>
                       <button onclick="abrirModalConcluirReposicao('${r.id}')" class="p-2 text-[#00FFFF] hover:bg-[#00FFFF]/10 rounded-lg transition" title="Concluir Aula">
                           <i class="fas fa-play-circle text-lg"></i>
                       </button>
                       <button onclick="deletarReposicao('${r.id}')" class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Excluir">
                           <i class="fas fa-trash text-lg"></i>
                       </button>`;

                const tr = document.createElement('tr');
                tr.className = "hover:bg-white/[0.02] transition-colors border-b border-[#1a1a1a]";
                tr.innerHTML = `
                    <td class="p-4">
                        <div class="text-white font-bold">${dataFmt}</div>
                        <div class="text-[10px] text-gray-500">${horaFmt}</div>
                    </td>
                    <td class="p-4">
                        <div class="text-gray-200 font-bold">${r.nome_aluno}</div>
                        <div class="text-[10px] text-[#00FFFF] font-mono">${r.turma || 'AVULSA'}</div>
                    </td>
                    <td class="p-4 text-gray-400">${r.nome_prof}</td>
                    <td class="p-4 max-w-[200px] truncate">${r.conteudo || '-'}</td>
                    <td class="p-4 text-center">
                        <span class="px-2 py-1 rounded-full border ${statusStyle} text-[9px] font-black uppercase tracking-tighter">
                            ${r.status}
                        </span>
                    </td>
                    <td class="p-4 text-right flex justify-end gap-1">${botoes}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { console.error("Erro renderização:", e); }
}
async function abrirModalConcluirReposicao(idRepo) {
    const conteudo = `
        <div class="space-y-4">
            <input type="hidden" id="concluirIdRepo" value="${idRepo}">
            <div class="bg-yellow-900/20 border border-yellow-700/30 p-3 rounded-lg">
                <p class="text-xs text-yellow-500 font-bold uppercase mb-1">Atenção Professor</p>
                <p class="text-[10px] text-gray-400">Marque a presença e anexe a foto da ficha de reposição assinada para converter a falta automaticamente.</p>
            </div>
            
            <div>
                <label class="text-xs text-gray-400 uppercase font-bold">O Aluno compareceu?</label>
                <select id="repoPresenca" class="w-full bg-[#111] border border-[#333] rounded p-3 text-white mt-1">
                    <option value="true">✅ SIM, ESTEVE PRESENTE</option>
                    <option value="false">❌ NÃO, FALTOU NOVAMENTE</option>
                </select>
            </div>

            <div>
                <label class="text-xs text-gray-400 uppercase font-bold">Foto da Assinatura (Obrigatório)</label>
                <input type="file" id="foto-chamada" accept="image/*" capture="environment" class="hidden">
            </div>

            <div>
                <label class="text-xs text-gray-400 uppercase font-bold">Observações Curtas</label>
                <input type="text" id="repoObs" placeholder="Ex: Aluno concluiu o desafio..." class="w-full bg-[#111] border border-[#333] rounded p-3 text-white mt-1">
            </div>
        </div>
    `;

    abrirModalUniversal("Concluir Reposição", conteudo, enviarBaixaReposicao);
}

async function enviarBaixaReposicao() {
    const id = document.getElementById('concluirIdRepo').value;
    const presenca = document.getElementById('repoPresenca').value;
    const obs = document.getElementById('repoObs').value;
    const foto = document.getElementById('repoFoto').files[0];

    if (!foto) return Swal.fire("Erro", "A foto da ficha assinada é obrigatória.", "warning");

    try {
        Swal.fire({ title: 'Salvando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const formData = new FormData();
        formData.append('presenca', presenca);
        formData.append('observacoes', obs);
        formData.append('arquivo', foto);

        const res = await fetch(`${API_URL}/admin/reposicao-completa/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            body: formData
        });

        if (res.ok) {
            // Agora chama a rota de conversão automática para 'R'
            await fetch(`${API_URL}/admin/reposicao/concluir-e-converter?id_repo=${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            Swal.fire("Sucesso!", "Reposição concluída e falta convertida.", "success");
            fecharModalUniversal();
            renderCalendar(); // Recarrega tudo
            carregarReposicoes();
        } else {
            Swal.fire("Erro", "Falha ao salvar reposição.", "error");
        }
    } catch (e) {
        Swal.fire("Erro", "Erro de conexão.", "error");
    }
}

// 2. ABRIR MODAL NOVA
function abrirModalNovaTurma() {
    const conteudo = montarFormularioTurma();
    abrirModalUniversal("Cadastrar Nova Turma", conteudo, () => salvarTurmaModal());
    carregarSelectProfessorTurmaModal();
}

// 3. ABRIR MODAL EDIÇÃO
function prepararEdicaoTurma(jsonString) {
    const t = JSON.parse(decodeURIComponent(jsonString));
    
    // Mapeamos o que vem do banco (codigo_turma) para o que o formulário usa (tmCodigo)
    const dadosParaForm = {
        codigo_turma: t.codigo_turma,
        nome_curso: t.nome_curso,
        id_professor: t.id_professor,
        dia_semana: t.dia_semana,
        horario: t.horario,
        status: t.status,
        sala: t.sala,
        tipo_turma: t.tipo_turma
    };

    const conteudo = montarFormularioTurma(dadosParaForm);
    abrirModalUniversal(`Editando Turma: ${t.codigo_turma}`, conteudo, () => salvarTurmaModal(t.codigo_turma));
    carregarSelectProfessorTurmaModal(t.id_professor);
}

// 1. GERA O HTML DO FORMULÁRIO COM OS CAMPOS CORRETOS
function montarFormularioTurma(dados = null) {
    const isEdit = !!dados;
    return `
        <div class="space-y-4 text-left">
            <div>
                <label class="text-[10px] text-gray-500 font-bold uppercase">Código da Turma</label>
                <input type="text" id="tmCodigo" value="${dados?.codigo_turma || ''}" ${isEdit ? 'disabled' : ''} 
                    class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white uppercase focus:border-[#00FFFF] outline-none ${isEdit ? 'opacity-50' : ''}" required>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Curso</label>
                    <select id="tmCurso" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white">
                        <option value="GAME PRO" ${dados?.nome_curso === 'GAME PRO' ? 'selected' : ''}>GAME PRO</option>
                        <option value="DESIGNER START" ${dados?.nome_curso === 'DESIGNER START' ? 'selected' : ''}>DESIGNER START</option>
                        <option value="GAME DEV" ${dados?.nome_curso === 'GAME DEV' ? 'selected' : ''}>GAME DEV</option>
                        <option value="YOUTUBER" ${dados?.nome_curso === 'YOUTUBER' ? 'selected' : ''}>YOUTUBER</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Tipo</label>
                    <select id="tmTipo" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white">
                        <option value="PARTICULAR" ${dados?.tipo_turma === 'PARTICULAR' ? 'selected' : ''}>PARTICULAR</option>
                        <option value="PROJETO" ${dados?.tipo_turma === 'PROJETO' ? 'selected' : ''}>PROJETO</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="text-[10px] text-gray-500 font-bold uppercase">Professor Responsável</label>
                <select id="tmProfessor" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white">
                    <option value="">Carregando professores...</option>
                </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Dia</label>
                    <select id="tmDia" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white">
                        ${['Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map(d => `<option ${dados?.dia_semana === d ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Horário</label>
                    <input type="text" id="tmHorario" value="${dados?.horario || ''}" placeholder="Ex: 14:00" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Status</label>
                    <select id="tmStatus" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white">
                        <option value="Planejada" ${dados?.status === 'Planejada' ? 'selected' : ''}>Planejada</option>
                        <option value="Em Andamento" ${dados?.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                        <option value="Fechada" ${dados?.status === 'Fechada' ? 'selected' : ''}>Fechada</option>
                        <option value="Concluída" ${dados?.status === 'Concluída' ? 'selected' : ''}>Concluída</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Sala</label>
                    <input type="text" id="tmSala" value="${dados?.sala || 'Lab 1'}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none">
                </div>
            </div>
        </div>
    `;
}

// 5. CARREGAR PROFESSORES (FIM DO ERRO NULL)
async function carregarSelectProfessorTurmaModal(idSelecionado = null) {
    const select = document.getElementById('tmProfessor');
    if (!select) return; // Segurança: Se o elemento não existir, não faz nada e evita erro.

    select.innerHTML = '<option value="" disabled selected>Carregando...</option>';
    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-professores`);
        const profs = await res.json();
        select.innerHTML = '<option value="">Sem Professor</option>';
        profs.forEach(p => {
            const selected = (idSelecionado && String(idSelecionado) === String(p.id_colaborador)) ? 'selected' : '';
            select.innerHTML += `<option value="${p.id_colaborador}" ${selected}>${p.nome_completo}</option>`;
        });
    } catch (e) { select.innerHTML = '<option value="">Erro ao carregar</option>'; }
}

document.getElementById('formEditarRepo').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editRepoId').value;
    const btn = document.getElementById('btnSalvarRepo');
    const arquivo = document.getElementById('editRepoAssinatura').files[0];

    // Criamos o FormData para permitir envio de imagem
    const formData = new FormData();
    formData.append('data_hora', document.getElementById('editRepoData').value);
    formData.append('id_professor', document.getElementById('editRepoProfessor').value);
    formData.append('conteudo_aula', document.getElementById('editRepoConteudo').value);
    
    if (arquivo) {
        formData.append('arquivo', arquivo);
    }

    btn.disabled = true;
    btn.innerText = "SALVANDO E SINCRONIZANDO...";

    try {
        // Usamos PUT para a rota de edição completa que aceita arquivo
        const res = await fetch(`${API_URL}/admin/reposicao-completa/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Dados e assinatura sincronizados com o Drive.', background: '#111', color: '#fff' });
            document.getElementById('modalEditarRepo').style.display = 'none';
            carregarReposicoes();
        } else {
            throw new Error("Erro ao salvar");
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível atualizar a reposição.', background: '#111', color: '#fff' });
    } finally {
        btn.disabled = false;
        btn.innerText = "SALVAR ALTERAÇÕES";
    }
});

async function carregarMapaFrequencia() {
    const codTurma = document.getElementById('select-turma-frequencia').value;
    if (!codTurma) return;

    const body = document.getElementById('corpo-frequencia');
    body.innerHTML = '<tr><td colspan="100%" class="p-10 text-center text-gray-500 italic">Sincronizando mapa pedagógico...</td></tr>';

    try {
        // 1. Busca os dados da turma para saber qual curso carregar
        const resTurma = await fetchAdmin(`${API_URL}/admin/gerenciar-turmas`);
        const turmas = await resTurma.json();
        const dadosTurma = turmas.find(t => t.codigo_turma === codTurma);

        if (!dadosTurma) throw new Error("Turma não encontrada");

        // 2. Busca os módulos e aulas do curso dessa turma (Utilizando a estrutura que criamos)
        // Nota: Certifique-se que o endpoint /admin/conteudo-didatico/cursos retorna os IDs que batem
        const resConteudo = await fetchAdmin(`${API_URL}/admin/conteudo-didatico/cursos`);
        const cursos = await resConteudo.json();
        const cursoAtual = cursos.find(c => c.titulo === dadosTurma.nome_curso);

        // 3. Busca os eventos de presença registrados
        const resEventos = await fetchAdmin(`${API_URL}/admin/relatorio-frequencia-geral?q=${codTurma}`);
        const eventos = await resEventos.json();

        if (!cursoAtual || !cursoAtual.modulos) {
            body.innerHTML = '<tr><td colspan="100%" class="p-10 text-center text-red-500">Módulos não configurados para este curso.</td></tr>';
            return;
        }

        renderizarCabecalhoDinamico(cursoAtual.modulos);
        renderizarCorpoMapa(eventos, cursoAtual.modulos);

    } catch (e) {
        console.error("Erro no mapa:", e);
        body.innerHTML = '<tr><td colspan="100%" class="p-10 text-center text-red-500">Erro ao processar dados da turma.</td></tr>';
    }
}

function renderizarCabecalhoMapa(modulos) {
    const trModulos = document.getElementById('header-modulos');
    const trAulas = document.getElementById('header-aulas');
    if (!trModulos || !trAulas) return;
    
    trModulos.innerHTML = '<th rowspan="2" class="p-4 border-r border-[#222] text-[#00FFFF]">ID</th><th rowspan="2" class="p-4 border-r border-[#222] text-[#00FFFF]">Aluno</th>';
    trAulas.innerHTML = '';

    modulos.forEach(mod => {
        const qtdAulas = mod.aulas ? mod.aulas.length : 0;
        if (qtdAulas > 0) {
            const thMod = document.createElement('th');
            thMod.className = 'p-2 text-center border-b border-r border-[#222] bg-[#161616] text-gray-300 text-[10px]';
            thMod.colSpan = qtdAulas;
            // Limpa o título do módulo para o cabeçalho (remove números e emojis extras)
            thMod.innerText = mod.titulo.replace(/[0-9]️⃣|Módulo — |🕹️|🟢|🐍|🤖|🚀/g, '').trim(); 
            trModulos.appendChild(thMod);

            mod.aulas.forEach((_, idx) => {
                const thAula = document.createElement('th');
                thAula.className = 'p-2 text-center border-r border-[#222] text-[9px] text-gray-500';
                thAula.innerText = idx + 1;
                trAulas.appendChild(thAula);
            });
        }
    });

    const thFreq = document.createElement('th');
    thFreq.rowSpan = 2;
    thFreq.className = 'p-4 text-center text-[#00FFFF]';
    thFreq.innerText = '%';
    trModulos.appendChild(thFreq);
}

function renderizarCorpoMapa(eventos, modulos) {
    const tbody = document.getElementById('corpo-frequencia');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Agrupa frequências por Aluno
    const mapaAlunos = {};
    eventos.forEach(ev => {
        const id = ev.id_aluno;
        if (!mapaAlunos[id]) mapaAlunos[id] = { nome: ev.nome_aluno || ev.nome, aulas: {} };
        mapaAlunos[id].aulas[ev.numero_aula] = ev.status;
    });

    Object.keys(mapaAlunos).forEach(id => {
        const aluno = mapaAlunos[id];
        let totalP = 0;
        let totalValid = 0;
        let html = `<tr class="hover:bg-white/[0.02] border-b border-[#1a1a1a]">
            <td class="p-3 border-r border-[#222] text-gray-600 font-mono text-[10px]">${id}</td>
            <td class="p-3 border-r border-[#222] font-bold text-white whitespace-nowrap text-xs uppercase">${aluno.nome}</td>`;

        let contadorAula = 1;
        modulos.forEach(mod => {
            mod.aulas.forEach(() => {
                const status = aluno.aulas[contadorAula] || '-';
                let css = 'text-gray-800';
                
                if (status === 'P') { 
                    css = 'text-blue-400 bg-blue-500/5'; 
                    totalP++; totalValid++;
                } else if (status === 'F') { 
                    css = 'text-red-500 bg-red-500/10 font-black'; 
                    totalValid++;
                } else if (status === 'R') { 
                    css = 'text-cyan-400 bg-cyan-500/5'; 
                    totalP++; totalValid++; // Reposição conta como presença na %
                }

                html += `<td class="p-2 text-center border-r border-[#1a1a1a] text-[10px] ${css}">${status}</td>`;
                contadorAula++;
            });
        });

        const porcentagem = totalValid > 0 ? ((totalP / totalValid) * 100).toFixed(0) : 0;
        const corPorc = porcentagem < 75 ? 'text-red-500' : 'text-green-400';

        html += `<td class="p-3 text-center font-bold ${corPorc}">${porcentagem}%</td></tr>`;
        tbody.innerHTML += html;
    });
}

function renderizarCabecalhoDinamico(modulos) {
    const trModulos = document.getElementById('header-modulos');
    const trAulas = document.getElementById('header-aulas');
    
    // Mantém ID e Aluno fixos
    trModulos.innerHTML = '<th rowspan="2" class="p-4 border-r border-[#222] text-[#00FFFF]">ID</th><th rowspan="2" class="p-4 border-r border-[#222] text-[#00FFFF]">Aluno</th>';
    trAulas.innerHTML = '';

    modulos.forEach(mod => {
        const qtdAulas = mod.aulas ? mod.aulas.length : 0;
        if (qtdAulas > 0) {
            // Cabeçalho do Módulo
            const thMod = document.createElement('th');
            thMod.className = 'p-2 text-center border-b border-r border-[#222] bg-[#161616] text-gray-300 text-[10px]';
            thMod.colSpan = qtdAulas;
            thMod.innerText = mod.titulo.replace(/[0-9]️⃣|Módulo — /g, '').trim(); 
            trModulos.appendChild(thMod);

            // Números das aulas
            mod.aulas.forEach((_, idx) => {
                const thAula = document.createElement('th');
                thAula.className = 'p-2 text-center border-r border-[#222] text-[9px] text-gray-500';
                thAula.innerText = idx + 1;
                trAulas.appendChild(thAula);
            });
        }
    });

    const thFreq = document.createElement('th');
    thFreq.rowSpan = 2;
    thFreq.className = 'p-4 text-center text-[#00FFFF]';
    thFreq.innerText = '%';
    trModulos.appendChild(thFreq);
}

function renderizarCabecalho(modulos) {
    const trModulos = document.getElementById('header-modulos');
    const trAulas = document.getElementById('header-aulas');
    
    // Limpa colunas anteriores (mantendo as 2 primeiras fixas)
    trModulos.innerHTML = '<th rowspan="2">ID</th><th rowspan="2">Aluno</th>';
    trAulas.innerHTML = '';

    modulos.forEach(mod => {
        const qtdAulas = mod.aulas.length;
        if (qtdAulas > 0) {
            // Cria o cabeçalho do módulo (colspan)
            const thMod = document.createElement('th');
            thMod.className = 'module-header';
            thMod.colSpan = qtdAulas;
            thMod.innerText = mod.titulo.split('—')[1] || mod.titulo; // Pega só o nome pós "-"
            trModulos.appendChild(thMod);

            // Cria as colunas das aulas (1, 2, 3...)
            for (let i = 1; i <= qtdAulas; i++) {
                const thAula = document.createElement('th');
                thAula.innerText = i;
                trAulas.appendChild(thAula);
            }
        }
    });
    
    // Coluna final de %
    const thFreq = document.createElement('th');
    thFreq.rowSpan = 2;
    thFreq.innerText = 'Freq (%)';
    trModulos.appendChild(thFreq);
}

function renderizarCorpo(frequencias, modulos) {
    const tbody = document.getElementById('corpo-frequencia');
    tbody.innerHTML = '';

    // Agrupar dados por aluno
    const alunosMap = {};
    frequencias.forEach(f => {
        if (!alunosMap[f.id_aluno]) {
            alunosMap[f.id_aluno] = { nome: f.nome, aulas: {} };
        }
        alunosMap[f.id_aluno].aulas[f.numero_aula] = f.status;
    });

    // Montar linhas
    for (const id_aluno in alunosMap) {
        const aluno = alunosMap[id_aluno];
        let html = `<tr><td>${id_aluno}</td><td class="text-nowrap">${aluno.nome}</td>`;
        
        let totalP = 0;
        let totalAulas = 0;

        modulos.forEach(mod => {
            mod.aulas.forEach((_, idx) => {
                const numAulaGlobal = idx + 1; // Ajustar conforme sua lógica de numeração
                const status = aluno.aulas[numAulaGlobal] || '-';
                const classe = status === 'F' ? 'status-f text-center' : 'status-p text-center';
                
                html += `<td class="${classe}">${status}</td>`;
                
                if (status === 'P') totalP++;
                if (status !== '-') totalAulas++;
            });
        });

        const porcentagem = totalAulas > 0 ? ((totalP / totalAulas) * 100).toFixed(1) : 0;
        const corFreq = porcentagem < 75 ? 'text-danger fw-bold' : 'text-success';

        html += `<td class="${corFreq} text-center">${porcentagem}%</td></tr>`;
        tbody.innerHTML += html;
    }
}
async function popularSelectTurmasFrequencia() {
    const select = document.getElementById('select-turma-frequencia');
    if (!select || select.options.length > 1) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
        const turmas = await res.json();
        turmas.forEach(t => {
            const opt = new Option(`${t.codigo_turma} - ${t.nome_curso}`, t.codigo_turma);
            select.add(opt);
        });
    } catch (e) {
        console.error("Erro ao popular select de frequências:", e);
    }
}