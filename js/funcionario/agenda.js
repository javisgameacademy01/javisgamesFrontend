// ==========================================
// js/funcionario/agenda.js
// ==========================================
import { API_URL, fetchAdmin, nivelUsuarioLogado } from './config.js';
import { abrirModalUniversal, fecharModalUniversal, aplicarMascaras } from './ui.js';

let calendarInstance = null;
let eventosCacheReposicao = []; // Cache global para filtros laterais rápidos

// ============================================================
// FULLCALENDAR E RENDERIZAÇÃO
// ============================================================

export function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    if (calendarInstance) { calendarInstance.destroy(); }

    // O FullCalendar é carregado via CDN no HTML, então ele está disponível globalmente
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        height: window.innerWidth < 768 ? 'auto' : 600,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
        },
        eventDisplay: 'list-item', 
        dayMaxEvents: 3,           
        
        dateClick: function(info) {
            document.querySelectorAll('.fc-daygrid-day').forEach(el => el.classList.remove('dia-selecionado'));
            info.dayEl.classList.add('dia-selecionado'); 
            mostrarEventosDoDia(info.dateStr);
        },

        events: async function(info, successCallback, failureCallback) {
            try {
                const res = await fetchAdmin(`${API_URL}/admin/agenda-geral`);
                if (!res || !res.ok) throw new Error("Erro ao buscar agenda");
                
                const eventos = await res.json();
                eventosCacheReposicao = eventos; 
                successCallback(eventos);
                
                mostrarEventosDoDia(new Date().toISOString().split('T')[0], true);
            } catch (e) { 
                failureCallback(e); 
            }
        },
        
        eventClick: function(info) {
            abrirModalRepo(encodeURIComponent(JSON.stringify(info.event)));
        }
    });

    calendarInstance.render();
}

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
                    <div class="flex items-center gap-2 text-[#00FFFF] text-[10px] font-mono">
                        <i class="fas fa-layer-group text-gray-600 w-3"></i>
                        <span>Turma: ${ev.codigo_turma || ev.turma || 'AVULSA'} ${ev.nome_curso ? ' - ' + ev.nome_curso : ''}</span>
                    </div>
                </div>
                <div class="mt-3 flex gap-2">
                    <button onclick="abrirModalConcluirReposicao('${ev.id}')" class="flex-1 bg-[#222] hover:bg-[#00FFFF] hover:text-black text-gray-400 text-[10px] font-bold py-2 rounded-lg transition-all">CONCLUIR AULA</button>
                    ${btnWhats}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// TABELA DE HISTÓRICO DE REPOSIÇÕES
// ============================================================

// ============================================================
// TABELA DE HISTÓRICO DE REPOSIÇÕES (COM ORDENAÇÃO)
// ============================================================

// Variáveis para guardar os dados na memória e o estado da ordenação
let listaReposicoesGlobal = [];
let configOrdenacaoRepo = { coluna: 'data', direcao: 'desc' };

export async function carregarReposicoes() {
    try {
        const res = await fetchAdmin(`${API_URL}/admin/agenda-geral`);
        if (!res || !res.ok) return;

        const dados = await res.json();
        
        // Guarda na memória apenas as que são do tipo reposição
        listaReposicoesGlobal = dados.filter(d => d.tipo === 'reposicao');

        // Faz a ordenação inicial (Data mais recente primeiro)
        ordenarTabelaReposicoes('data', true); 
    } catch (e) { 
        console.error("Erro ao carregar histórico de reposições:", e); 
    }
}

export function ordenarTabelaReposicoes(coluna, manterDirecao = false) {
    // Inverte a direção se clicar na mesma coluna, ou volta para ASC se for nova coluna
    if (!manterDirecao) {
        if (configOrdenacaoRepo.coluna === coluna) {
            configOrdenacaoRepo.direcao = configOrdenacaoRepo.direcao === 'asc' ? 'desc' : 'asc';
        } else {
            configOrdenacaoRepo.coluna = coluna;
            configOrdenacaoRepo.direcao = 'asc';
        }
    }

    // Ordena os dados na memória
    listaReposicoesGlobal.sort((a, b) => {
        let valA = '', valB = '';
        
        if (coluna === 'data') {
            valA = new Date(a.start).getTime() || 0;
            valB = new Date(b.start).getTime() || 0;
        } else if (coluna === 'aluno') {
            valA = (a.nome_aluno || '').toLowerCase();
            valB = (b.nome_aluno || '').toLowerCase();
        } else if (coluna === 'professor') {
            valA = (a.nome_prof || '').toLowerCase();
            valB = (b.nome_prof || '').toLowerCase();
        } else if (coluna === 'status') {
            valA = (a.status || '').toLowerCase();
            valB = (b.status || '').toLowerCase();
        }

        if (valA < valB) return configOrdenacaoRepo.direcao === 'asc' ? -1 : 1;
        if (valA > valB) return configOrdenacaoRepo.direcao === 'asc' ? 1 : -1;
        return 0;
    });

    // Pinta a tabela com a nova ordem e atualiza as setinhas
    renderizarTabelaReposicoes();
    atualizarIconesOrdenacaoRepo(coluna, configOrdenacaoRepo.direcao);
}

function atualizarIconesOrdenacaoRepo(colunaAtiva, direcao) {
    const colunas = ['data', 'aluno', 'professor', 'status'];
    colunas.forEach(col => {
        const icon = document.getElementById(`icon-sort-${col}`);
        if (icon) {
            if (col === colunaAtiva) {
                // Fica ciano e aponta para cima (asc) ou baixo (desc)
                icon.className = direcao === 'asc' ? 'fas fa-sort-up text-[#00FFFF] ml-1' : 'fas fa-sort-down text-[#00FFFF] ml-1';
            } else {
                // Fica cinza genérico
                icon.className = 'fas fa-sort text-gray-600 ml-1';
            }
        }
    });
}

function renderizarTabelaReposicoes() {
    const tbody = document.getElementById('tbodyReposicoes');
    if(!tbody) return;

    const reposicoes = listaReposicoesGlobal;

    // Atualiza os cartões de métricas no topo
    if(document.getElementById('stats-repo-pendente')) document.getElementById('stats-repo-pendente').innerText = reposicoes.filter(r => r.status === 'Agendada').length;
    if(document.getElementById('stats-repo-total')) document.getElementById('stats-repo-total').innerText = reposicoes.length;
    if(document.getElementById('stats-repo-mes')) document.getElementById('stats-repo-mes').innerText = reposicoes.filter(r => r.status === 'Concluída').length;

    if (reposicoes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-gray-600 italic">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    // Monta as linhas da tabela
    tbody.innerHTML = reposicoes.map(r => {
        const data = new Date(r.start);
        const dataFmt = data.toLocaleDateString('pt-BR');
        const horaFmt = data.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        
        let statusStyle = r.status === 'Concluída' 
            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';

        const rJson = encodeURIComponent(JSON.stringify(r));

        let botoes = r.status === 'Concluída'
            ? `<button class="p-2 text-gray-600 cursor-not-allowed"><i class="fas fa-check-circle text-lg"></i></button>`
            : `
               <button onclick="abrirModalRepo('${rJson}')" class="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition" title="Editar Agenda"><i class="fas fa-edit text-lg"></i></button>
               <button onclick="abrirModalConcluirReposicao('${r.id}')" class="p-2 text-[#00FFFF] hover:bg-[#00FFFF]/10 rounded-lg transition" title="Concluir Aula"><i class="fas fa-play-circle text-lg"></i></button>
               <button onclick="deletarReposicao('${r.id}')" class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Excluir"><i class="fas fa-trash text-lg"></i></button>`;

        return `
            <tr class="hover:bg-white/[0.02] transition-colors border-b border-[#1a1a1a]">
                <td class="p-4"><div class="text-white font-bold">${dataFmt}</div><div class="text-[10px] text-gray-500">${horaFmt}</div></td>
                <td class="p-4"><div class="text-gray-200 font-bold">${r.nome_aluno}</div><div class="text-[10px] text-[#00FFFF] font-mono">${r.codigo_turma || r.turma || 'AVULSA'}</div></td>
                <td class="p-4 text-gray-400">${r.nome_prof}</td>
                <td class="p-4 max-w-[200px] truncate">${r.conteudo || '-'}</td>
                <td class="p-4 text-center"><span class="px-2 py-1 rounded-full border ${statusStyle} text-[9px] font-black uppercase tracking-tighter">${r.status}</span></td>
                <td class="p-4 text-right flex justify-end gap-1">${botoes}</td>
            </tr>`;
    }).join('');
}

// ============================================================
// SELECTS E AGENDAMENTO
// ============================================================

// Local: js/funcionario/agenda.js
export async function carregarSelectAlunos() {
    const select = document.getElementById('repIdAluno');
    if (!select) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-alunos`);
        const alunos = await res.json();
        
        select.innerHTML = '<option value="" disabled selected>Selecione o Aluno...</option>';
        
        alunos.forEach(aluno => {
            // IMPORTANTE: aluno.id_aluno deve ser o número (ex: 220)
            // Se o seu banco usa outro nome, verifique se é aluno.id
            const option = document.createElement('option');
            option.value = aluno.id_aluno; 
            option.textContent = aluno.nome_completo;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Erro ao carregar lista de alunos:", e);
    }
}

export async function carregarSelectRepTurma() {
    const select = document.getElementById('repTurma');
    if(!select || select.options.length > 1) return; 
    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
        if (!res) return;
        const dados = await res.json();
        select.innerHTML = '<option value="" disabled selected>Selecione a Turma...</option>';
        dados.forEach(t => select.innerHTML += `<option value="${t.codigo_turma}" data-prof="${t.id_professor}">${t.codigo_turma} - ${t.nome_curso || 'Curso'}</option>`);
    } catch(e) { select.innerHTML = '<option>Erro ao carregar</option>'; }
}

export async function carregarSelectProfessores() {
    const select = document.getElementById('repProfessor');
    if(!select || select.options.length > 1) return;
    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-professores`);
        if (!res) return;
        const dados = await res.json();
        select.innerHTML = '<option value="" disabled selected>Selecione a Turma primeiro...</option>';
        dados.forEach(p => select.innerHTML += `<option value="${p.id_colaborador}">${p.nome_completo}</option>`);
    } catch(e) {}
}

export function autoSelecionarProfessor() {
    const selectTurma = document.getElementById('repTurma');
    const selectProf = document.getElementById('repProfessor');
    const optionSelecionada = selectTurma.options[selectTurma.selectedIndex];
    const idProfessorDaTurma = optionSelecionada.getAttribute('data-prof');
    if (idProfessorDaTurma) selectProf.value = idProfessorDaTurma;
}

export async function agendarReposicao(e) {
    e.preventDefault();

    // Captura dos elementos
    const elIdAluno = document.getElementById('repIdAluno');
    const elIdProf = document.getElementById('repProfessor');
    const elData = document.getElementById('repData');
    const elTurma = document.getElementById('repTurma');
    const elConteudo = document.getElementById('repConteudo');

    // Validação antes do envio
    if (!elIdAluno.value || !elIdProf.value || !elData.value) {
        return Swal.fire("Atenção", "Selecione o Aluno, o Professor e a Data.", "warning");
    }

    // O objeto DADOS deve ter as chaves EXATAS que o Pydantic do Python espera
    const dados = {
        id_aluno: parseInt(elIdAluno.value),
        id_professor: parseInt(elIdProf.value),
        turma_codigo: elTurma.value || "AVULSA", 
        data_hora: elData.value,                
        conteudo_aula: elConteudo.value || "Reposição",
        motivo: "Reposição",
        observacoes: ""
    };

    try {
        Swal.fire({ title: 'Agendando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const res = await fetchAdmin(`${API_URL}/admin/agendar-reposicao`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // OBRIGATÓRIO PARA O FASTAPI LER O JSON
            },
            body: JSON.stringify(dados)
        });

        const resultado = await res.json();

        if (res.ok) {
            await Swal.fire("Sucesso!", "Reposição agendada com sucesso.", "success");
            fecharModalAgendarReposicao();
            if (typeof renderCalendar === 'function') renderCalendar();
            if (typeof carregarReposicoes === 'function') carregarReposicoes();
        } else {
            // Desmonta o erro 422 do FastAPI
            let msgErro = resultado.detail;
            if (Array.isArray(resultado.detail)) {
                msgErro = resultado.detail.map(d => `Campo <b>${d.loc[1] || d.loc[0]}</b>: ${d.msg}`).join("<br>");
            }
            throw new Error(msgErro || "Erro ao processar.");
        }
    } catch (err) {
        console.error("Falha:", err);
        Swal.fire({
            icon: 'error',
            title: 'Erro ao Agendar',
            html: `<div class="text-left text-xs">${err.message}</div>`,
            background: '#1a1a1a',
            color: '#fff'
        });
    }
}

// ============================================================
// MODAIS DE REPOSIÇÃO E CONCLUSÃO
// ============================================================

export function abrirModalAgendarReposicao() {
    const modal = document.getElementById('modalAgendarRepo');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    carregarSelectRepTurma();
    carregarSelectProfessores();
    carregarSelectAlunos();
    setTimeout(aplicarMascaras, 50);
}

export function fecharModalAgendarReposicao() {
    const modal = document.getElementById('modalAgendarRepo');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

export function abrirModalRepo(jsonDados) {
    const dados = JSON.parse(decodeURIComponent(jsonDados));
    
    document.getElementById('editRepoId').value = dados.id;
    document.getElementById('editRepoNome').innerText = dados.nome_aluno || dados.title;
    document.getElementById('editRepoConteudo').value = dados.conteudo || dados.extendedProps?.conteudo || "";

    if (dados.start) {
        const dataOriginal = new Date(dados.start);
        const ano = dataOriginal.getFullYear();
        const mes = String(dataOriginal.getMonth() + 1).padStart(2, '0');
        const dia = String(dataOriginal.getDate()).padStart(2, '0');
        const hora = String(dataOriginal.getHours()).padStart(2, '0');
        const min = String(dataOriginal.getMinutes()).padStart(2, '0');
        
        document.getElementById('editRepoData').value = `${ano}-${mes}-${dia}T${hora}:${min}`;
    }

    const temPermissao = (nivelUsuarioLogado >= 8);
    document.getElementById('btnSalvarRepo').disabled = !temPermissao;
    document.getElementById('btnExcluirRepo').classList.toggle('hidden', !temPermissao);

    const modal = document.getElementById('modalEditarRepo');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
}

export async function deletarReposicao(idParaDeletar = null) {
    const id = idParaDeletar || document.getElementById('editRepoId').value;
    if (!id) return;

    const result = await Swal.fire({
        title: 'Excluir Reposição?', text: "Essa ação não pode ser desfeita.", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#333', confirmButtonText: 'Sim', background: '#1a1a1a', color: '#fff'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/reposicao/${id}`, { method: 'DELETE' });
        if (!res || !res.ok) throw new Error("Falha ao excluir.");

        Swal.fire({ icon: 'success', title: 'Excluído!', timer: 1500, showConfirmButton: false, background: '#222', color: '#fff' });
        document.getElementById('modalEditarRepo').style.display = 'none';
        document.getElementById('modalEditarRepo').classList.add('hidden');
        renderCalendar();
        carregarReposicoes();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    }
}

export async function salvarEdicaoRepo(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSalvarRepo');
    const id = document.getElementById('editRepoId').value;
    const arquivo = document.getElementById('editRepoAssinatura').files[0];

    const formData = new FormData();
    formData.append('data_hora', document.getElementById('editRepoData').value);
    formData.append('id_professor', document.getElementById('editRepoProfessor').value);
    formData.append('conteudo_aula', document.getElementById('editRepoConteudo').value);
    if (arquivo) formData.append('arquivo', arquivo);

    btn.disabled = true; btn.innerText = "SALVANDO...";

    try {
        const res = await fetchAdmin(`${API_URL}/admin/reposicao-completa/${id}`, {
            method: 'PUT',
            body: formData
        });

        if (res && res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Dados atualizados.', background: '#111', color: '#fff' });
            document.getElementById('modalEditarRepo').style.display = 'none';
            renderCalendar();
            carregarReposicoes();
        } else {
            throw new Error("Erro ao salvar");
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Falha na atualização.', background: '#111', color: '#fff' });
    } finally {
        btn.disabled = false; btn.innerText = "SALVAR ALTERAÇÕES";
    }
}

export function abrirModalConcluirReposicao(idRepo) {
    const conteudo = `
        <div class="space-y-4">
            <input type="hidden" id="concluirIdRepo" value="${idRepo}">
            <div class="bg-yellow-900/20 border border-yellow-700/30 p-3 rounded-lg">
                <p class="text-xs text-yellow-500 font-bold uppercase mb-1">Atenção Professor</p>
                <p class="text-[10px] text-gray-400">Marque a presença e anexe a foto da ficha assinada para converter a falta automaticamente.</p>
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
                <input type="file" id="repoFoto" accept="image/*" capture="environment" class="w-full bg-[#111] border border-[#333] rounded p-2 text-white mt-1">
            </div>
            <div>
                <label class="text-xs text-gray-400 uppercase font-bold">Observações</label>
                <input type="text" id="repoObs" placeholder="Ex: Aluno concluiu o desafio..." class="w-full bg-[#111] border border-[#333] rounded p-3 text-white mt-1">
            </div>
        </div>
    `;
    abrirModalUniversal("Concluir Reposição", conteudo, enviarBaixaReposicao);
}

export async function enviarBaixaReposicao() {
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

        const res = await fetchAdmin(`${API_URL}/admin/reposicao-completa/${id}`, {
            method: 'PUT',
            body: formData
        });

        if (res && res.ok) {
            await fetchAdmin(`${API_URL}/admin/reposicao/concluir-e-converter?id_repo=${id}`, { method: 'POST' });

            Swal.fire("Sucesso!", "Reposição concluída.", "success");
            fecharModalUniversal();
            renderCalendar();
            carregarReposicoes();
        } else {
            Swal.fire("Erro", "Falha ao salvar reposição.", "error");
        }
    } catch (e) {
        Swal.fire("Erro", "Erro de conexão.", "error");
    }
}