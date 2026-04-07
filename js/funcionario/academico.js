// ==========================================
// js/funcionario/academico.js
// ==========================================
import { API_URL, fetchAdmin } from './config.js';
import { abrirModalUniversal, fecharModalUniversal } from './ui.js';

/* ============================================================
   GESTÃO DE TURMAS
   ============================================================ */

export async function carregarListaTurmas() {
    const tbody = document.getElementById('listaTurmasBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-600 italic"><i class="fas fa-spinner fa-spin mr-2"></i>Sincronizando...</td></tr>';
    
    try {
        const res = await fetchAdmin(`${API_URL}/admin/gerenciar-turmas`);
        const turmas = await res.json();
        tbody.innerHTML = '';
        
        if(turmas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-500 italic">Nenhuma turma encontrada.</td></tr>';
            return;
        }
        
        // ORDENAÇÃO DINÂMICA PELO BANCO: "Em Andamento" e "Fechada" vão para o topo
        turmas.sort((a, b) => {
            const aDestaque = (a.status === 'Em Andamento' || a.status === 'Fechada');
            const bDestaque = (b.status === 'Em Andamento' || b.status === 'Fechada');
            if (aDestaque && !bDestaque) return -1;
            if (!aDestaque && bDestaque) return 1;
            return 0;
        });

        turmas.forEach(t => {
            let badgeClass = 'bg-gray-500/10 text-gray-500 border-gray-500/20';
            if(t.status === 'Planejada') badgeClass = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            else if(t.status === 'Em Andamento') badgeClass = 'bg-green-500/10 text-green-400 border-green-500/20';
            else if(t.status === 'Fechada') badgeClass = 'bg-red-500/10 text-red-400 border-red-500/20';

            const tJson = encodeURIComponent(JSON.stringify(t));
            
            // VERIFICAÇÃO DINÂMICA
            const isDestaque = (t.status === 'Em Andamento' || t.status === 'Fechada');

            // Se for destaque, muda a cor do código da turma e fundo leve
            const corCodigo = isDestaque ? 'text-[#00FFFF] drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]' : 'text-gray-400';
            const fundoLinha = isDestaque ? 'bg-[#00FFFF]/5 border-l-2 border-[#00FFFF]' : 'hover:bg-white/[0.02] border-l-2 border-transparent';
            const iconeAtiva = isDestaque ? '<i class="fas fa-star text-[#00FFFF] text-[10px] ml-1" title="Turma Ativa"></i>' : '';

            tbody.innerHTML += `
                <tr class="${fundoLinha} transition-colors border-b border-[#1a1a1a]">
                    <td class="p-4">
                        <div class="${corCodigo} font-mono font-bold text-sm">${t.codigo_turma} ${iconeAtiva}</div>
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
                        <button onclick="prepararEdicaoTurma('${tJson}')" class="p-2 text-gray-400 hover:text-[#00FFFF] transition-all"><i class="fas fa-edit text-lg"></i></button>
                    </td>
                </tr>`;
        });
    } catch(e) { 
        tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-red-500">Erro ao carregar as turmas.</td></tr>'; 
    }
}

export function abrirModalNovaTurma() {
    const conteudo = montarFormularioTurma();
    abrirModalUniversal("Cadastrar Nova Turma", conteudo, () => salvarTurmaModal());
    carregarSelectProfessorTurmaModal();
}

export function prepararEdicaoTurma(jsonString) {
    const t = JSON.parse(decodeURIComponent(jsonString));
    const conteudo = montarFormularioTurma(t);
    abrirModalUniversal(`Editando Turma: ${t.codigo_turma}`, conteudo, () => salvarTurmaModal(t.codigo_turma));
    carregarSelectProfessorTurmaModal(t.id_professor);
}

function montarFormularioTurma(dados = null) {
    const isEdit = !!dados;
    return `
        <div class="space-y-4 text-left">
            <div>
                <label class="text-[10px] text-gray-500 font-bold uppercase">Código da Turma</label>
                <input type="text" id="tmCodigo" value="${dados?.codigo_turma || ''}" ${isEdit ? 'disabled' : ''} 
                    class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white uppercase focus:border-[#00FFFF] outline-none ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}" required>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Curso</label>
                    <select id="tmCurso" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                        <option value="GAME PRO" ${dados?.nome_curso === 'GAME PRO' ? 'selected' : ''}>GAME PRO</option>
                        <option value="DESIGNER START" ${dados?.nome_curso === 'DESIGNER START' ? 'selected' : ''}>DESIGNER START</option>
                        <option value="GAME DEV" ${dados?.nome_curso === 'GAME DEV' ? 'selected' : ''}>GAME DEV</option>
                        <option value="YOUTUBER" ${dados?.nome_curso === 'YOUTUBER' ? 'selected' : ''}>YOUTUBER</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Tipo</label>
                    <select id="tmTipo" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                        <option value="PARTICULAR" ${dados?.tipo_turma === 'PARTICULAR' ? 'selected' : ''}>PARTICULAR</option>
                        <option value="PROJETO" ${dados?.tipo_turma === 'PROJETO' ? 'selected' : ''}>PROJETO</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="text-[10px] text-gray-500 font-bold uppercase">Professor Responsável</label>
                <select id="tmProfessor" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                    <option value="">Carregando professores...</option>
                </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Dia</label>
                    <select id="tmDia" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                        ${['Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map(d => `<option ${dados?.dia_semana === d ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Horário</label>
                    <input type="text" id="tmHorario" value="${dados?.horario || ''}" placeholder="Ex: 14:00" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Status</label>
                    <select id="tmStatus" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                        <option value="Planejada" ${dados?.status === 'Planejada' ? 'selected' : ''}>Planejada</option>
                        <option value="Em Andamento" ${dados?.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                        <option value="Fechada" ${dados?.status === 'Fechada' ? 'selected' : ''}>Fechada</option>
                        <option value="Concluída" ${dados?.status === 'Concluída' ? 'selected' : ''}>Concluída</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Sala</label>
                    <input type="text" id="tmSala" value="${dados?.sala || 'Lab 1'}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                </div>
            </div>
        </div>
    `;
}

async function carregarSelectProfessorTurmaModal(idSelecionado = null) {
    const select = document.getElementById('tmProfessor');
    if (!select) return; 

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

async function salvarTurmaModal(codigoExistente = null) {
    const btn = document.getElementById('modalConfirmBtn');
    
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
            const msg = Array.isArray(erroJson.detail) ? erroJson.detail.map(e => `${e.loc[1]}: ${e.msg}`).join('<br>') : erroJson.detail;
            Swal.fire({ icon: 'error', title: 'Erro de Validação', html: msg, background: '#111', color: '#fff' });
        }
    } catch(err) {
        Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: 'Falha ao comunicar com o servidor.', background: '#111', color: '#fff' });
    } finally {
        if (btn) { btn.innerText = "SALVAR"; btn.disabled = false; }
    }
}

/* ============================================================
   CHAMADAS E FOTOS DA LISTA
   ============================================================ */

export async function carregarTurmasParaChamada() {
    const select = document.getElementById('selectTurmaChamada');
    if (!select) return;

    try {
        // Alterado de /listar-turmas para /gerenciar-turmas para termos acesso ao status
        const res = await fetchAdmin(`${API_URL}/admin/gerenciar-turmas`);
        if (res && res.ok) {
            const turmas = await res.json();
            select.innerHTML = '<option value="">Selecione a Turma...</option>';
            
            // ORDENAR DINAMICAMENTE: Turmas Ativas primeiro e depois por Curso
            turmas.sort((a, b) => {
                const aDestaque = (a.status === 'Em Andamento' || a.status === 'Fechada');
                const bDestaque = (b.status === 'Em Andamento' || b.status === 'Fechada');
                
                if (aDestaque && !bDestaque) return -1;
                if (!aDestaque && bDestaque) return 1;
                
                // Se empatar, ordena em ordem alfabética pelo NOME DO CURSO
                return (a.nome_curso || '').localeCompare(b.nome_curso || '');
            });

            turmas.forEach(t => {
                // LÓGICA DINÂMICA PUXANDO DO BANCO
                const isDestaque = (t.status === 'Em Andamento' || t.status === 'Fechada');
                const diaAbrev = t.dia_semana ? t.dia_semana.substring(0, 3) : "";
                
                const nomeCurso = t.nome_curso ? t.nome_curso.toUpperCase() : 'CURSO INDEFINIDO';
                const textoFinal = isDestaque 
                    ? `🟢 ${nomeCurso} | Turma: ${t.codigo_turma} - ${diaAbrev} (${t.horario}) [ATIVA]` 
                    : `⬛ ${nomeCurso} | Turma: ${t.codigo_turma} - ${diaAbrev} (${t.horario})`;
                
                const option = new Option(textoFinal, t.codigo_turma);
                
                // Destaca a cor apenas das ativas
                if(isDestaque) {
                    option.style.color = '#00FFFF';
                    option.style.fontWeight = 'bold';
                    option.style.backgroundColor = '#111';
                }

                select.appendChild(option);
            });
        }
    } catch (e) { console.error("Erro ao popular seletor de turmas:", e); }
}

export function liberarUploadChamada() {
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

async function carregarListaChamada() {
    const codTurma = document.getElementById('selectTurmaChamada').value;
    const container = document.getElementById('lista-chamada-corpo'); 
    if(!codTurma || !container) return;
    
    container.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando alunos...</td></tr>';

    try {
        const res = await fetchAdmin(`${API_URL}/admin/chamada/turma/${codTurma}`);
        const matriculas = await res.json();
        
        container.innerHTML = "";
        if (matriculas.length === 0) {
            container.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-gray-500">Nenhum aluno matriculado nesta turma.</td></tr>';
            return;
        }
        
        matriculas.forEach(m => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-[#222] hover:bg-white/[0.02] transition-colors";
            tr.innerHTML = `
                <td class="p-4 text-white font-medium uppercase">${m.tb_alunos.nome_completo}</td>
                <td class="p-4 text-center">
                    <input type="checkbox" class="presenca-check w-6 h-6 accent-[#00FFFF] cursor-pointer" data-id="${m.id_aluno}" checked>
                </td>
            `;
            container.appendChild(tr);
        });
    } catch (e) {
        container.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-red-500">Erro ao carregar lista de alunos.</td></tr>';
    }
}

export async function enviarChamadaComFoto() {
    const codTurma = document.getElementById('selectTurmaChamada').value;
    const dataAula = document.getElementById('dataChamada').value;
    const fotoArquivo = document.getElementById('fotoChamada').files[0];
    const checks = document.querySelectorAll('.presenca-check');
    
    if (!dataAula) return Swal.fire("Erro", "Selecione a data da aula.", "error");
    if (!fotoArquivo) return Swal.fire("Foto Obrigatória", "Anexe a foto da lista assinada pelo professor.", "warning");

    try {
        Swal.fire({ title: 'Comprimindo Foto e Enviando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#222', color: '#fff' });

        // --- LÓGICA DE COMPRESSÃO DA IMAGEM ---
        const comprimirImagem = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 1280; // Reduz a imagem para HD (evita travar o servidor)
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

        // --- PREPARAÇÃO DOS DADOS ---
        const listaPresenca = Array.from(checks).map(c => ({
            id_aluno: parseInt(c.getAttribute('data-id')),
            status_presenca: c.checked ? 'P' : 'F' 
        }));

        const formData = new FormData();
        formData.append('codigo_turma', codTurma);
        formData.append('data_aula', dataAula);
        formData.append('lista_alunos', JSON.stringify(listaPresenca));
        formData.append('arquivo_foto', fotoComprimida); 

        const res = await fetch(`${API_URL}/admin/chamada/salvar-v3`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('access_token')}` 
                // O Content-Type NÃO é definido aqui propositalmente quando se usa FormData
            },
            body: formData
        });

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Chamada registrada no banco e foto salva no Drive.', background: '#222', color: '#fff'});
            document.getElementById('fotoChamada').value = '';
            liberarUploadChamada(); // Recarrega os checkboxes
        } else {
            const erro = await res.json();
            let mensagemErro = "Falha ao salvar.";
            if (erro.detail) {
                if (Array.isArray(erro.detail)) mensagemErro = "Faltam campos: " + erro.detail.map(e => e.loc[e.loc.length-1]).join(', ');
                else if (typeof erro.detail === 'string') mensagemErro = erro.detail;
                else mensagemErro = JSON.stringify(erro.detail); 
            }
            Swal.fire({ icon: 'error', title: 'Erro de Validação', text: mensagemErro, background: '#222', color: '#fff'});
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Falha na comunicação com o servidor.', background: '#222', color: '#fff'});
    }
}

export async function imprimirModeloChamada() {
    const selectTurma = document.getElementById('selectTurmaChamada');
    const codTurma = selectTurma.value;
    if (!codTurma) return Swal.fire("Atenção", "Selecione uma turma primeiro.", "warning");

    let nomeProfessor = "Não atribuído";
    try {
        const res = await fetchAdmin(`${API_URL}/admin/gerenciar-turmas`);
        const turmas = await res.json();
        const turmaDados = turmas.find(t => t.codigo_turma === codTurma);
        if (turmaDados && turmaDados.tb_colaboradores) nomeProfessor = turmaDados.tb_colaboradores.nome_completo;
    } catch (e) {}

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const checks = document.querySelectorAll('.presenca-check'); 
    
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
        <div style="font-family: 'Segoe UI', sans-serif; padding: 10px; color: #000;">
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
                <tbody>${linhasAlunos}</tbody>
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
    
    setTimeout(() => { win.print(); win.close(); }, 500);
}