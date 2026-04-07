// ==========================================
// js/funcionario/chat.js
// ==========================================
import { API_URL, fetchAdmin, nivelUsuarioLogado, usuarioLogadoId } from './config.js';

// ============================================================
// ESTADO LOCAL DO CHAT
// ============================================================
let chatAdminInterval = null;
export let selecionadoId = null; // ID do Aluno ou Codigo da Turma
let modoChat = 'conversas';      // 'conversas', 'alunos' ou 'grupo'
let listaChatCache = [];         // Cache para pesquisa rápida
let searchTimeout = null;        // Para o debounce da pesquisa

// ============================================================
// NAVEGAÇÃO E LISTAGEM
// ============================================================

export function mudarAbaChat(modo) {
    modoChat = modo;
    
    // Atualiza botões
    ['conversas', 'alunos', 'grupo'].forEach(m => {
        const el = document.getElementById('tab-' + m);
        if(el) el.classList.remove('active');
    });
    const activeTab = document.getElementById('tab-' + modo);
    if(activeTab) activeTab.classList.add('active');
    
    // Reseta área de chat
    const area = document.getElementById('area-chat-admin'); if(area) area.classList.add('hidden');
    const aviso = document.getElementById('aviso-selecao'); if(aviso) aviso.classList.remove('hidden');
    const input = document.getElementById('input-pesquisa-chat'); if(input) input.value = ''; 
    
    // Para o loop de mensagens se trocar de aba
    if(chatAdminInterval) clearInterval(chatAdminInterval);
    
    atualizarListaChat();
}

export async function atualizarListaChat() {
    const list = document.getElementById('lista-conversas');
    if(!list) return;
    
    list.innerHTML = '<p class="text-center text-xs text-gray-500 mt-4"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando...</p>';
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
            
            // Se for professor, mostra só as turmas dele
            if (nivelUsuarioLogado === 5 && usuarioLogadoId) {
                listaChatCache = turmas.filter(t => t.id_professor === usuarioLogadoId);
            } else {
                listaChatCache = turmas;
            }
        }
        renderizarListaFiltrada();
    } catch(e) { 
        console.error(e); 
        list.innerHTML = '<p class="text-center text-xs text-red-500 mt-4">Erro de conexão.</p>';
    }
}

// Debounce para não travar a tela enquanto o usuário digita
export function handleSearchInputChat() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderizarListaFiltrada, 300);
}

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

// ============================================================
// ÁREA DE MENSAGENS (Abertura e Loop)
// ============================================================

export function abrirChatPrivado(idAluno, nome) {
    selecionadoId = idAluno;
    configurarAreaChat(nome, "Chat Privado", "fas fa-user", "text-[#00FFFF]");
    carregarMensagens();
    if(chatAdminInterval) clearInterval(chatAdminInterval);
    chatAdminInterval = setInterval(carregarMensagens, 3000);
}

export function abrirChatGrupo(codigoTurma, nomeCurso) {
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
    if(msgs) msgs.innerHTML = '<div class="w-full h-full flex items-center justify-center"><i class="fas fa-spinner fa-spin text-2xl text-gray-600"></i></div>';
}

async function carregarMensagens() {
    if (!selecionadoId) return;
    const div = document.getElementById('msgs-admin');
    if (!div) return;

    try {
        let msgs = [];
        let ehGrupo = false;

        if (modoChat === 'grupo') ehGrupo = true;
        else if (modoChat === 'conversas') {
            const item = listaChatCache.find(i => i.id == selecionadoId);
            if (item && item.tipo === 'grupo') ehGrupo = true;
        }

        if (!ehGrupo) {
            let url = `${API_URL}/admin/chat/mensagens/${selecionadoId}`;
            if (nivelUsuarioLogado === 5) url += `?filtro_colaborador=meu`; 

            const res = await fetchAdmin(url);
            if (!res) return;
            msgs = await res.json();
            
            let html = '';
            msgs.forEach(m => {
                let souEu = false;
                const ehAdmin = m.enviado_por_admin;
                const idRemetente = m.id_colaborador || m.id_colaborador_remetente; 

                if (ehAdmin) {
                    if (usuarioLogadoId && idRemetente) {
                        souEu = (idRemetente == usuarioLogadoId);
                    } else {
                        souEu = true; 
                    }
                    if (m.cargo_exibicao === 'Suporte' || m.nome_exibicao === 'Suporte') souEu = false;
                }

                let align = 'items-start'; 
                let containerAlign = 'justify-start';
                let bg = 'bg-[#333] text-gray-200 border border-[#444]'; 
                let labelNome = '';

                if (souEu) {
                    align = 'items-end';
                    containerAlign = 'justify-end';
                    bg = 'bg-[#00FFFF]/10 text-[#00FFFF] border border-[#00FFFF]/30';
                } else if (ehAdmin) {
                    if (m.cargo_exibicao === 'Suporte' || m.nome_exibicao === 'Suporte') {
                        bg = 'bg-orange-900/20 text-orange-400 border border-orange-800';
                        labelNome = '<span class="text-[10px] text-orange-500 font-bold mb-1 block"><i class="fas fa-robot mr-1"></i>Suporte Javis</span>';
                    } else {
                        bg = 'bg-purple-900/20 text-purple-300 border border-purple-800';
                        labelNome = `<span class="text-[10px] text-purple-400 font-bold mb-1 block">${m.nome_exibicao || 'Equipe'}</span>`;
                    }
                } else {
                    labelNome = `<span class="text-[10px] text-gray-500 font-bold mb-1 block">${m.nome_exibicao || 'Aluno'}</span>`;
                }

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

            if (div.innerHTML.length !== html.length) { 
                div.innerHTML = html; 
                div.scrollTop = div.scrollHeight; 
            }

        } else {
            const res = await fetchAdmin(`${API_URL}/admin/chat/turma/${selecionadoId}`);
            if (!res) return;
            msgs = await res.json();
            
            let html = '';
            msgs.forEach(m => {
                const isAluno = m.cargo_exibicao === 'Aluno';
                const isSuporte = m.cargo_exibicao === 'Suporte';
                
                let corNome = 'text-purple-400';
                let icone = '';
                
                if (isAluno) {
                    corNome = 'text-green-400';
                } else if (isSuporte) {
                    corNome = 'text-orange-400';
                    icone = '<i class="fas fa-robot mr-1"></i>';
                }

                let bgClass = 'bg-[#222] border border-[#333] text-gray-200';
                
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

export async function enviarMensagemUnified() {
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
        carregarMensagens(); // Força atualização imediata
    } catch(e) { Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao enviar mensagem.', background: '#222', color: '#fff' }); }
}