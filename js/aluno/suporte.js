// Removemos o /admin da API_BASE pois o aluno tem rotas próprias

// Verifica se as chaves do Supabase foram carregadas do config.js
let supabaseClient = null;
if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_KEY !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let realtimeChannel = null;
let contatoAtualId = null; 
let modoGrupoLocal = false; 
let codigoTurmaAtual = null;
let modoGrupoAtivo = false;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    if(!token) return window.location.href = 'IndexHome.html';
    carregarContatos();
});

// Animação e controle do FAQ
window.toggleFaq = function(id) { 
    const element = document.getElementById(id);
    const icon = document.getElementById(`icon-${id}`);
    
    element.classList.toggle('hidden'); 
    
    if (element.classList.contains('hidden')) {
        icon.style.transform = 'rotate(0deg)';
    } else {
        icon.style.transform = 'rotate(180deg)';
    }
}

async function carregarContatos() {
    const container = document.getElementById('lista-contatos');
    const token = localStorage.getItem('access_token');
    
    try {
        // Aluno busca contatos na rota /aluno
        const res = await fetch(`${API_BASE}/aluno/meus-contatos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Erro na resposta da API");
        
        const contatos = await res.json();
        let html = '';

        contatos.forEach(c => {
            const action = `abrirChat('${c.id}', '${c.nome}', '${c.cargo}', ${c.codigo_turma_grupo ? `'${c.codigo_turma_grupo}'` : 'null'})`;
            
            let icon = c.codigo_turma_grupo ? 'fa-users' : 'fa-chalkboard-user';
            if(c.id === 'geral') icon = 'fa-headset';

            html += `
                <div onclick="${action}" class="bg-[#1a1a1a] p-4 rounded-lg border border-[#333] cursor-pointer contact-card flex items-center gap-3 transition hover:border-[#00FFFF]">
                    <div class="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center text-[#00FFFF]">
                        <i class="fas ${icon} text-xl"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-200">${c.nome}</h4>
                        <p class="text-xs text-gray-500">${c.cargo}</p>
                    </div>
                </div>`;
        });
        container.innerHTML = html;
    } catch(e) { 
        console.error(e);
        container.innerHTML = '<p class="text-gray-500 text-sm">Nenhum contato disponível no momento.</p>'; 
    }
}

window.abrirChatGeral = function() { 
    abrirChat('geral', 'Suporte Javis', 'Secretaria'); 
}

window.abrirGrupo = function(codigo, nome) {
    modoGrupoAtivo = true;
    codigoTurmaAtual = codigo;
    contatoAtualId = null;

    document.getElementById('chat-window').classList.remove('hidden');
    document.getElementById('titulo-chat').innerText = nome;
    document.getElementById('subtitulo-chat').innerText = "Chat do Grupo";
    
    carregarMensagens();
    if (supabaseClient) inscreverRealtime('tb_chat_turma', 'codigo_turma', codigo, carregarMensagens);
}

window.abrirChat = function(id, nome, cargo, codigoTurma = null) {
    if(codigoTurma) {
        return abrirGrupo(codigoTurma, nome);
    }
    
    modoGrupoAtivo = false;
    codigoTurmaAtual = null;
    contatoAtualId = id;
    
    document.getElementById('chat-window').classList.remove('hidden');
    document.getElementById('titulo-chat').innerText = nome;
    document.getElementById('subtitulo-chat').innerText = cargo || "Online";
    
    carregarMensagens();
    if (supabaseClient) inscreverRealtime('tb_chat', 'id_aluno', null, carregarMensagens);
}

window.fecharChat = function() {
    document.getElementById('chat-window').classList.add('hidden');
    if (realtimeChannel && supabaseClient) {
        supabaseClient.removeChannel(realtimeChannel);
    }
}

async function carregarMensagens() {
    if(!contatoAtualId && !codigoTurmaAtual) return;
    const token = localStorage.getItem('access_token');
    
    const endpoint = modoGrupoAtivo 
        ? `/aluno/chat/turma/${codigoTurmaAtual}` 
        : `/aluno/chat/mensagens-com/${contatoAtualId}`;

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const msgs = await res.json();
        renderizarMensagens(msgs);
        
        // NOVO: Se não for grupo, avisa o banco que o aluno leu as mensagens do funcionário
        if (!modoGrupoAtivo && contatoAtualId) {
            avisarQueAlunoLeu(contatoAtualId);
        }

    } catch(e) { console.error("Erro ao carregar mensagens:", e); }
}

window.enviarMensagemDireta = async function() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if(!msg) return;

    const token = localStorage.getItem('access_token');
    
    // Adicionamos o /aluno na frente da rota
    const url = modoGrupoAtivo 
        ? `${API_BASE}/aluno/chat/turma/enviar` 
        : `${API_BASE}/aluno/chat/enviar-direto`;
    
    const payload = modoGrupoAtivo 
        ? { codigo_turma: codigoTurmaAtual, mensagem: msg }
        : { mensagem: msg, id_colaborador: contatoAtualId === 'geral' ? null : parseInt(contatoAtualId) };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        
        if(res.ok) {
            input.value = ''; 
            carregarMensagens(); 
        } else {
            console.error("Erro no servidor ao enviar.");
        }
    } catch(e) { 
        console.error("Erro de conexão ao enviar:", e);
    }
}

function renderizarMensagens(msgs) {
    const div = document.getElementById('chat-messages');
    if(!Array.isArray(msgs) || msgs.length === 0) {
        div.innerHTML = '<p class="text-center text-gray-500 text-xs mt-4">Envie uma mensagem para começar.</p>';
        return;
    }

    div.innerHTML = msgs.map(m => {
        let souEu = false;
        
        if (modoGrupoAtivo) {
            souEu = (m.cargo_exibicao === 'Aluno'); 
        } else {
            souEu = !m.enviado_por_admin;
        }

        return `
            <div class="flex ${souEu ? 'justify-end' : 'justify-start'} mb-2 fade-in">
                <div class="p-2 rounded-lg text-sm max-w-[85%] ${souEu ? 'bg-[#00FFFF]/10 text-[#00FFFF] border border-[#00FFFF]/20' : 'bg-[#333] text-white border border-[#444]'}">
                    ${modoGrupoAtivo && !souEu ? `<b class="text-[10px] block text-[#00FFFF] mb-1">${m.nome_exibicao} (${m.cargo_exibicao})</b>` : ''}
                    <span class="whitespace-pre-wrap">${m.mensagem}</span>
                </div>
            </div>`;
    }).join('');
    
    // Desce a barra de rolagem para a mensagem mais recente
    div.scrollTop = div.scrollHeight;
}

function inscreverRealtime(tabela, coluna, valor, callback) {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = supabaseClient
        .channel('chat-geral')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: tabela }, callback)
        .subscribe();
}

async function avisarQueAlunoLeu(idContato) {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    try {
        await fetch(`${API_BASE}/aluno/chat/marcar-lidas/${idContato}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch(e) { 
        console.error("Erro ao dar o visto:", e); 
    }
}