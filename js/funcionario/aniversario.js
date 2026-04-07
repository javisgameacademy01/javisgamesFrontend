import { API_URL, fetchAdmin } from './config.js';

let calendarAniInstance = null;
let eventosCacheAniversario = [];
let sortConfig = { column: 'data_festa', direction: 'asc' };
let debounceTimer;

// ============================================================
// 1. CARREGAMENTO E FILTRAGEM (O Motor do Sistema)
// ============================================================

export async function carregarFestasAniversario() {
    // 1. Captura os valores dos inputs de filtro no HTML
    const status = document.getElementById('filtroStatusFesta')?.value || '';
    const busca = document.getElementById('buscaFesta')?.value || '';
    const dataIni = document.getElementById('filtroDataIniFesta')?.value || '';
    const dataFim = document.getElementById('filtroDataFimFesta')?.value || '';

    try {
        // 2. Monta a URL dinâmica com os parâmetros de consulta (Query Params)
        let url = `${API_URL}/admin/festas-aniversario?sort_by=${sortConfig.column}&sort_dir=${sortConfig.direction}`;
        
        if (status) url += `&status=${status}`;
        if (busca)  url += `&q=${encodeURIComponent(busca)}`;
        if (dataIni) url += `&data_ini=${dataIni}`;
        if (dataFim) url += `&data_fim=${dataFim}`;

        console.log("🔍 Procurando festas em:", url);

        // 3. Faz a requisição autenticada ao servidor
        const res = await fetchAdmin(url);
        if (!res.ok) throw new Error("Não foi possível carregar os dados das festas.");

        const dados = await res.json();

        // ============================================================
        // 🌟 ADICIONAL: ALIMENTANDO O CACHE GLOBAL
        // ============================================================
        // Guardamos os dados brutos aqui para que as funções do calendário 
        // e dos cards laterais possam filtrar por dia sem nova requisição.
        eventosCacheAniversario = dados;

        // 4. Dispara a atualização visual da tabela de histórico
        if (typeof renderizarTabelaAniversarios === 'function') {
            renderizarTabelaAniversarios(dados);
        }

        // 5. Dispara a atualização das marcações (barrinhas) no calendário
        // Passamos os dados diretamente para evitar dessincronização
        if (typeof atualizarMarcacoesCalendario === 'function') {
            atualizarMarcacoesCalendario(dados);
        }

    } catch (err) {
        console.error("❌ Erro em carregarFestasAniversario:", err);
        
        // Feedback visual de erro na tabela se ela existir
        const tbody = document.getElementById('tbodyAniversarios');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-red-500 font-bold">Erro de conexão com o servidor.</td></tr>`;
        }
    }
}

// ============================================================
// 2. CALENDÁRIO (Design Reposição)
// ============================================================

export function renderCalendarAniversario() {
    const calendarEl = document.getElementById('calendarAniversario');
    if (!calendarEl) return;

    if (calendarAniInstance) calendarAniInstance.destroy();

    calendarAniInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        height: 550,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth' },
        eventDisplay: 'block',
        
        dateClick: function(info) {
            document.querySelectorAll('#calendarAniversario .fc-daygrid-day').forEach(el => el.classList.remove('dia-selecionado'));
            info.dayEl.classList.add('dia-selecionado');
            mostrarEventosAniversarioNoCard(info.dateStr);
        },
        // Os eventos são injetados pela função carregarFestasAniversario para manter sincronia
        events: [] 
    });

    calendarAniInstance.render();
    carregarFestasAniversario(); // Dispara a primeira carga
}

function atualizarMarcacoesCalendario(dados) {
    if (!calendarAniInstance) return;

    const eventosFormatados = dados.map(f => {
        // Verificamos se existem os novos campos, senão usamos um padrão
        const hInicio = f.horario_inicio || "00:00";
        const hFim = f.horario_fim || "00:00";

        return {
            id: f.id,
            // O título agora é SÓ o nome (o horário o calendário já sabe pelas propriedades start/end)
            title: f.aniversariante, 
            
            // A MÁGICA DA SEPARAÇÃO:
            start: `${f.data_festa}T${hInicio}`, 
            end: `${f.data_festa}T${hFim}`,
            
            color: f.status === 'FECHADA' ? '#28a745' : '#00FFFF',
            extendedProps: f 
        };
    });

    calendarAniInstance.removeAllEvents();
    calendarAniInstance.addEventSource(eventosFormatados);
    
    // Mostra as festas de hoje na lateral por padrão
    const hoje = new Date().toISOString().split('T')[0];
    mostrarEventosAniversarioNoCard(hoje);
}

// ============================================================
// 3. LISTA LATERAL (CARDS)
// ============================================================

function mostrarEventosAniversarioNoCard(dataIso) {
    const lista = document.getElementById('listaAgendaAniversario');
    const titulo = document.getElementById('titulo-aniversario-dia');
    if (!lista) return;

    const filtrados = eventosCacheAniversario.filter(f => f.data_festa === dataIso);

    if (filtrados.length === 0) {
        lista.innerHTML = `<div class="flex flex-col items-center justify-center py-10 opacity-20"><i class="fas fa-calendar-minus text-4xl mb-2"></i><p class="text-[10px] uppercase font-bold">Sem festas</p></div>`;
        return;
    }

    lista.innerHTML = filtrados.map(f => `
        <div class="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] hover:border-[#00FFFF]/50 transition-all shadow-lg mb-3">
            <div class="flex justify-between items-center mb-2">
                <span class="bg-[#00FFFF]/10 text-[#00FFFF] text-[10px] font-black px-2 py-0.5 rounded-md border border-[#00FFFF]/20">${f.horario || 'N/D'}</span>
                <span class="text-[9px] font-bold ${f.status === 'FECHADA' ? 'text-green-400' : 'text-cyan-400'} uppercase tracking-widest">${f.status}</span>
            </div>
            <h4 class="text-white font-bold text-sm leading-tight mb-1">${f.aniversariante}</h4>
            <p class="text-gray-500 text-[10px] mb-2">Resp: ${f.contratante}</p>
            <div class="mt-3 flex gap-2">
                <button onclick="abrirModalEditarAniversario('${f.id}')" class="flex-1 bg-[#222] hover:bg-[#00FFFF] hover:text-black text-gray-400 text-[10px] font-bold py-2 rounded-lg transition-all">DETALHES</button>
                <a href="https://wa.me/55${f.telefone?.replace(/\D/g,'')}" target="_blank" class="p-2 bg-green-600/20 text-green-500 rounded-lg"><i class="fab fa-whatsapp"></i></a>
            </div>
        </div>
    `).join('');
}

// ============================================================
// 4. TABELA E UTILITÁRIOS (Pesquisa, Sort, Datas)
// ============================================================
/**
 * Renderiza a tabela de histórico de festas com suporte a Vendedor, Observações e Ações
 * @param {Array} dados - Lista de festas vinda do banco de dados
 */
function renderizarTabelaAniversarios(dados) {
    const tbody = document.getElementById('tbodyAniversarios');
    if (!tbody) return;

    // 1. Tratamento para lista vazia
    if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-600 italic">Nenhum evento encontrado no histórico.</td></tr>`;
        return;
    }

    // 2. Mapeamento dos dados para as linhas da tabela
    tbody.innerHTML = dados.map(f => {
        // Formatação das Datas
        const dataFestaFmt = new Date(f.data_festa + 'T12:00:00').toLocaleDateString('pt-BR');
        
        let pagtoHTML = '<span class="text-red-900/50 italic">Pendente</span>';
        if (f.data_pagamento) {
            const dtPagto = new Date(f.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR');
            pagtoHTML = `<span class="text-green-500 font-bold"><i class="fas fa-check-circle mr-1"></i>${dtPagto}</span>`;
        }

        // Estilo do Badge de Status
        const statusEstilo = f.status === 'FECHADA' 
            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';

        // Preparação para Edição (Passagem de objeto seguro)
        const fJson = encodeURIComponent(JSON.stringify(f));
        
        // Lógica dos Botões de Ação
        let botoesHTML = '';
        if (f.status === 'FECHADA') {
            botoesHTML = `<button class="p-2 text-gray-600 cursor-not-allowed" title="Finalizada"><i class="fas fa-lock text-sm"></i></button>`;
        } else {
            botoesHTML = `
                <div class="flex justify-end gap-1">
                    <button onclick="abrirModalEditarAniversario('${fJson}')" class="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="finalizarFestaAniversario('${f.id}')" class="p-2 text-[#00FFFF] hover:bg-[#00FFFF]/10 rounded-lg transition" title="Fechar Festa">
                        <i class="fas fa-check-double"></i>
                    </button>
                    <button onclick="excluirFestaAniversario('${f.id}')" class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }

        return `
            <tr class="hover:bg-white/[0.02] border-b border-[#1a1a1a] transition-colors">
                <td class="p-4"><div class="text-white font-bold">${dataFestaFmt}</div></td>
                
                <td class="p-4">
                    <div class="text-[#00FFFF] font-mono text-[10px]">
                        ${f.horario_inicio?.substring(0,5) || '--:--'} às ${f.horario_fim?.substring(0,5) || '--:--'}
                    </div>
                </td>
                
                <td class="p-4">
                    <div class="text-gray-200 font-bold uppercase">${f.aniversariante} (${f.idade || '?'} anos)</div>
                </td>
                
                <td class="p-4">
                    <div class="text-gray-300 text-xs">${f.contratante}</div>
                    <div class="text-[10px] text-[#00FFFF] uppercase font-bold mt-1">Vend: ${f.vendedor_nome || 'N/D'}</div>
                    <div class="text-[9px] mt-0.5">${pagtoHTML}</div>
                </td>
                
                <td class="p-4 text-center">
                    ${f.observacoes 
                        ? `<button onclick="Swal.fire({title: 'Observações da Festa', text: '${f.observacoes.replace(/'/g, "\\'")}', icon: 'info', background: '#111', color: '#fff'})" 
                                   class="text-gray-500 hover:text-[#00FFFF] transition-colors">
                                <i class="fas fa-sticky-note text-lg"></i>
                           </button>` 
                        : '<span class="text-gray-800">-</span>'
                    }
                </td>
                
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded-full border ${statusEstilo} text-[9px] font-black uppercase tracking-tighter">
                        ${f.status}
                    </span>
                </td>
                
                <td class="p-4 text-right">
                    ${botoesHTML}
                </td>
            </tr>
        `;
    }).join('');
}

// Funções chamadas pelo HTML (onclick/oninput)
export function debounceCarregarFestasAniversario() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(carregarFestasAniversario, 500);
}

export function limparPeriodoFesta() {
    document.getElementById('filtroDataIniFesta').value = '';
    document.getElementById('filtroDataFimFesta').value = '';
    carregarFestasAniversario();
}

export function toggleSortFestas(el) {
    const column = el.getAttribute('data-sort');
    if (!column) return;

    // 1. Se clicou na mesma coluna, inverte a direção. Se for outra, começa com ASC.
    if (sortConfig.column === column) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.column = column;
        sortConfig.direction = 'asc';
    }

    // 2. Atualiza visualmente os ícones de todos os cabeçalhos
    document.querySelectorAll('#aniversario thead th[data-sort]').forEach(th => {
        const icon = th.querySelector('i');
        if (th === el) {
            th.classList.add('text-[#00FFFF]');
            icon.className = sortConfig.direction === 'asc' ? 'fas fa-sort-up ml-1' : 'fas fa-sort-down ml-1';
            icon.classList.remove('opacity-30');
        } else {
            th.classList.remove('text-[#00FFFF]');
            icon.className = 'fas fa-sort ml-1 opacity-30';
        }
    });

    // 3. Recarrega os dados (a função carregarFestasAniversario já usa o sortConfig)
    carregarFestasAniversario();
}

export function abrirModalAgendarAniversario() {
    const modal = document.getElementById('modalAgendarAniversario');
    if (!modal) return;
    
    // Limpa o formulário para um novo agendamento
    document.getElementById('formAgendarAniversario')?.reset();
    
    // Mostra o modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // (Opcional) Podes carregar os vendedores aqui se necessário
    // if (window.carregarVendedoresFesta) window.carregarVendedoresFesta();
}

export function fecharModalAgendarAniversario() {
    const modal = document.getElementById('modalAgendarAniversario');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

/**
 * Procura todas as festas no servidor e preenche a tabela de histórico
 */
// 2. Atualizar a Tabela com Início/Fim
export async function carregarTabelaAniversarios() {
    const tbody = document.getElementById('tbodyAniversarios');
    if (!tbody) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario`);
        const dados = await res.json();

        tbody.innerHTML = dados.map(f => `
            <tr class="hover:bg-white/[0.02] border-b border-[#1a1a1a]">
                <td class="p-4">
                    <div class="text-white font-bold">${new Date(f.data_festa + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                    <div class="text-[10px] text-[#00FFFF]">${f.horario_inicio || '--'} às ${f.horario_fim || '--'}</div>
                </td>
                <td class="p-4">
                    <div class="text-gray-200 font-bold">${f.aniversariante}</div>
                    <div class="text-[10px] text-gray-500">Resp: ${f.contratante}</div>
                </td>
                <td class="p-4 text-gray-400">${f.tb_colaboradores?.nome_completo || 'N/A'}</td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded-full border ${f.status === 'FECHADA' ? 'text-green-400 border-green-500/20' : 'text-cyan-400 border-cyan-500/20'} text-[9px] font-black uppercase">
                        ${f.status}
                    </span>
                </td>
                <td class="p-4 text-right">
                    <button class="text-orange-400 p-2"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// 1. Função para enviar o agendamento (POST)
export async function agendarAniversario(e) {
    e.preventDefault();
    
    const editId = document.getElementById('aniEditId')?.value;
    
    const dados = {
        aniversariante: document.getElementById('aniNome').value.toUpperCase(),
        idade: parseInt(document.getElementById('aniIdade').value) || null,
        contratante: document.getElementById('aniResponsavel').value.toUpperCase(),
        vendedor_nome: document.getElementById('aniVendedorNome').value.toUpperCase(), // Campo novo
        telefone: document.getElementById('aniTelefone').value.replace(/\D/g, ''),
        data_festa: document.getElementById('aniData').value,
        data_pagamento: document.getElementById('aniDataPagamento').value || null,
        horario_inicio: document.getElementById('aniHoraInicio').value,
        horario_fim: document.getElementById('aniHoraFim').value,
        observacoes: document.getElementById('aniObs').value,
        status: 'PARA_ACONTECER',
        id_unidade: 1 
    };

    try {
        Swal.fire({ title: 'A processar...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        // Se tiver editId, usa PUT (Editar), senão usa POST (Novo)
        const url = editId ? `${API_URL}/admin/festas-aniversario/${editId}` : `${API_URL}/admin/festas-aniversario`;
        const metodo = editId ? 'PUT' : 'POST';

        const res = await fetchAdmin(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            await Swal.fire("Sucesso!", editId ? "Festa atualizada!" : "Festa agendada!", "success");
            fecharModalAgendarAniversario();
            carregarFestasAniversario(); // Recarrega calendário e tabela
        } else {
            throw new Error("Erro na resposta do servidor.");
        }
    } catch (err) {
        Swal.fire("Erro", err.message, "error");
    }
}

// EXCLUIR FESTA
export async function excluirFestaAniversario(id) {
    const result = await Swal.fire({
        title: 'Excluir Festa?',
        text: "Esta ação não pode ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, excluir',
        background: '#1a1a1a', color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario/${id}`, { method: 'DELETE' });
        if (res.ok) {
            Swal.fire("Excluída!", "A festa foi removida.", "success");
            carregarFestasAniversario();
        }
    } catch (e) { Swal.fire("Erro", "Falha na conexão.", "error"); }
}

// FINALIZAR FESTA (Muda status para FECHADA)
export async function finalizarFestaAniversario(id) {
    try {
        const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'FECHADA' })
        });
        if (res.ok) {
            Swal.fire("Sucesso!", "Festa marcada como FECHADA.", "success");
            carregarFestasAniversario();
        }
    } catch (e) { console.error(e); }
}

// ABRIR EDIÇÃO (Preenche o modal com dados existentes)
export function abrirModalEditarAniversario(jsonDados) {
    const f = JSON.parse(decodeURIComponent(jsonDados));
    
    // Abre o mesmo modal de agendamento, mas preenchido
    abrirModalAgendarAniversario();
    
    // Muda o título e o ID para saber que é edição
    document.getElementById('aniNome').value = f.aniversariante;
    document.getElementById('aniIdade').value = f.idade || '';
    document.getElementById('aniResponsavel').value = f.contratante;
    document.getElementById('aniTelefone').value = f.telefone || '';
    document.getElementById('aniData').value = f.data_festa;
    document.getElementById('aniDataPagamento').value = f.data_pagamento || '';
    document.getElementById('aniHoraInicio').value = f.horario_inicio || '';
    document.getElementById('aniHoraFim').value = f.horario_fim || '';
    document.getElementById('aniVendedorNome').value = f.vendedor_nome || '';
    document.getElementById('aniObs').value = f.observacoes || '';
    
    // Adicionamos um campo oculto no form para o ID se não existir
    let inputId = document.getElementById('aniEditId');
    if(!inputId) {
        inputId = document.createElement('input');
        inputId.type = 'hidden';
        inputId.id = 'aniEditId';
        document.getElementById('formAgendarAniversario').appendChild(inputId);
    }
    inputId.value = f.id;
}