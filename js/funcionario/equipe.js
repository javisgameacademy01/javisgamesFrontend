// ==========================================
// js/funcionario/equipe.js
// ==========================================
import { API_URL, fetchAdmin } from './config.js';
import { abrirModalUniversal, fecharModalUniversal, aplicarMascaras } from './ui.js';

// ============================================================
// 1. GESTÃO DE ALUNOS E MATRÍCULAS
// ============================================================

export async function carregarAlunos() {
    const tbody = document.getElementById('listaAlunosBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando alunos...</td></tr>';
    
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
            const diaSemana = (t && t.tb_turmas && t.tb_turmas.dia_semana) ? t.tb_turmas.dia_semana : '-';

            let tipoBadge = '<span class="text-gray-500 text-xs">-</span>';
            if (t && t.tb_turmas && t.tb_turmas.tipo_turma) {
                if (t.tb_turmas.tipo_turma === 'PROJETO') {
                    tipoBadge = '<span class="bg-purple-900 text-purple-200 px-2 py-1 rounded text-xs border border-purple-700 font-bold tracking-wider">PROJETO</span>';
                } else {
                    tipoBadge = '<span class="bg-blue-900 text-blue-200 px-2 py-1 rounded text-xs border border-blue-700 font-bold tracking-wider">PARTICULAR</span>';
                }
            }

            let btnZap = '';
            if (a.celular) {
                const nums = a.celular.replace(/\D/g, '');
                btnZap = `<a href="https://wa.me/55${nums}" target="_blank" class="text-green-500 hover:text-green-400 mr-3 transition" title="Chamar no WhatsApp"><i class="fab fa-whatsapp text-lg"></i></a>`;
            }

            // Codifica o JSON para não quebrar o HTML na injeção do botão Editar
            const jsonAluno = encodeURIComponent(JSON.stringify(a));

            tbody.innerHTML += `
                <tr class="border-b border-[#333] hover:bg-[#2a2a2a] transition-colors">
                    <td class="p-4 font-bold text-white uppercase">${a.nome_completo}</td>
                    <td class="p-4 text-xs font-mono">${a.cpf || '-'}</td>
                    <td class="p-4 text-xs text-gray-300 font-mono">${a.celular || '-'}</td>
                    <td class="p-4 text-xs text-gray-400 font-mono">${a.telefone || '-'}</td>
                    <td class="p-4 text-[#00FFFF] font-black tracking-widest text-xs">${t ? t.codigo_turma : '-'}</td>
                    <td class="p-4 text-xs text-gray-300 font-bold">${diaSemana}</td> 
                    <td class="p-4">${tipoBadge}</td> 
                    <td class="p-4 text-green-400 font-bold text-xs uppercase">${t ? t.status_financeiro : '-'}</td>
                    <td class="p-4 flex items-center">
                        ${btnZap}
                        <button onclick="abrirModalEditarAluno('${jsonAluno}')" class="text-gray-400 hover:text-white transition" title="Editar Dados">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch(e) {
        console.error("Erro alunos:", e);
        tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-red-500">Erro de conexão.</td></tr>';
    }
}

export async function cadastrarAluno(e) {
    e.preventDefault();
    const btn = document.querySelector('#formCadastroAluno button[type="submit"]');

    const cpfRaw = document.getElementById('cadCpf')?.value?.trim() || '';
    const celularRaw = document.getElementById('cadCelular')?.value?.trim() || '';
    const telefoneRaw = document.getElementById('cadTelefone')?.value?.trim() || '';
    
    // Limpeza das máscaras para verificação
    const cpf = cpfRaw.replace(/\D/g, '');

    const payload = {
        nome: document.getElementById('cadNome')?.value?.trim() || '',
        email: document.getElementById('cadEmail')?.value?.trim() || '',
        cpf: cpfRaw, 
        data_nascimento: document.getElementById('cadNascimento')?.value || null,
        celular: celularRaw, 
        telefone: telefoneRaw,
        senha: document.getElementById('cadSenha')?.value || '',
        turma_codigo: document.getElementById('cadTurma')?.value || ''
    };

    if (!payload.nome || !payload.email || !payload.senha || !payload.turma_codigo) {
        return Swal.fire({ icon: 'warning', title: 'Campos obrigatórios', text: 'Preencha Nome, Email, Senha e Turma.', background: '#222', color: '#fff' });
    }

    if (cpf && cpf.length !== 11) {
        return Swal.fire({ icon: 'warning', title: 'CPF inválido', text: 'O CPF precisa ter 11 dígitos.', background: '#222', color: '#fff' });
    }

    try {
        if (btn) { btn.disabled = true; btn.innerText = "PROCESSANDO..."; }
        Swal.fire({ title: 'Cadastrando Aluno...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#222', color: '#fff' });

        const res = await fetchAdmin(`${API_URL}/admin/cadastrar-aluno`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res) return;

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Aluno cadastrado!', timer: 1400, showConfirmButton: false, background: '#222', color: '#fff' });
            document.getElementById('formCadastroAluno').reset();
            // Atualiza tabelas caso estejam em background
            if (typeof carregarAlunos === 'function') carregarAlunos();
        } else {
            const err = await res.json().catch(() => ({}));
            let msg = err.detail || 'Falha ao cadastrar aluno.';
            if (Array.isArray(err.detail)) msg = "Dados inválidos: Verifique CPF e Email.";
            Swal.fire({ icon: 'error', title: 'Erro de Validação', text: msg, background: '#222', color: '#fff' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro de conexão.', background: '#222', color: '#fff' });
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "CADASTRAR ALUNO"; }
    }
}

export async function carregarOpcoesTurmas() {
    const select = document.getElementById('cadTurma');
    if (!select || select.options.length > 1) return;
    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
        if (!res) { select.innerHTML = '<option value="" disabled>Erro de rede</option>'; return; }
        
        const turmas = await res.json();
        select.innerHTML = '<option value="" disabled selected>Selecione uma turma...</option>';
        if (turmas.length === 0) return select.innerHTML += '<option value="" disabled>Nenhuma turma encontrada</option>';
        
        turmas.forEach(t => {
            select.innerHTML += `<option value="${t.codigo_turma}">${t.codigo_turma} - ${t.nome_curso || 'Curso'} (${t.horario || ''})</option>`;
        });
    } catch (err) {}
}

export async function abrirModalEditarAluno(jsonAluno) {
    const aluno = JSON.parse(decodeURIComponent(jsonAluno));
    const matricula = (aluno.tb_matriculas && aluno.tb_matriculas.length > 0) ? aluno.tb_matriculas[0] : null;
    const turmaAtual = matricula ? matricula.codigo_turma : "";

    const conteudo = `
        <div class="space-y-4">
            <input type="hidden" id="editAlunoId" value="${aluno.id_aluno}">
            <div>
                <label class="text-xs text-gray-400 font-bold uppercase tracking-widest">Nome Completo</label>
                <input type="text" id="editAlunoNome" value="${aluno.nome_completo}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white uppercase outline-none focus:border-[#00FFFF]">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs text-gray-400 font-bold uppercase tracking-widest">CPF</label>
                    <input type="text" id="editAlunoCpf" value="${aluno.cpf || ''}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white font-mono outline-none">
                </div>
                <div>
                    <label class="text-xs text-gray-400 font-bold uppercase tracking-widest">Turma Atual</label>
                    <select id="editAlunoTurma" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                        <option value="${turmaAtual}" selected>${turmaAtual || 'Sem Turma'}</option>
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs text-gray-400 font-bold uppercase tracking-widest">Celular (WhatsApp)</label>
                    <input type="text" id="editAlunoCel" value="${aluno.celular || ''}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white font-mono outline-none">
                </div>
                <div>
                    <label class="text-xs text-gray-400 font-bold uppercase tracking-widest">Telefone Fixo</label>
                    <input type="text" id="editAlunoTel" value="${aluno.telefone || ''}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white font-mono outline-none">
                </div>
            </div>
            <div>
                <label class="text-xs text-gray-400 font-bold uppercase tracking-widest">Email (Login)</label>
                <input type="email" id="editAlunoEmail" value="${aluno.email || ''}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none">
            </div>
        </div>
    `;

    abrirModalUniversal("Editar Aluno", conteudo, salvarEdicaoAluno);

    setTimeout(async () => {
        // Aplica as máscaras diretamente nos campos recém-criados
        const elCel = document.getElementById('editAlunoCel');
        const elTel = document.getElementById('editAlunoTel');
        const elCpf = document.getElementById('editAlunoCpf');
        if(elCel) IMask(elCel, { mask: '(00) 00000-0000' });
        if(elTel) IMask(elTel, { mask: '(00) 00000-0000' });
        if(elCpf) IMask(elCpf, { mask: '000.000.000-00' });

        try {
            const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
            if(res.ok) {
                const turmas = await res.json();
                const select = document.getElementById('editAlunoTurma');
                turmas.forEach(t => {
                    if (t.codigo_turma !== turmaAtual) {
                        select.innerHTML += `<option value="${t.codigo_turma}">${t.codigo_turma} (${t.horario})</option>`;
                    }
                });
            }
        } catch(e) {}
    }, 100);
}

export async function salvarEdicaoAluno() {
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

        if (res && res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Dados atualizados!', timer: 1500, showConfirmButton: false, background: '#222', color: '#fff' });
            fecharModalUniversal();
            carregarAlunos(); 
        } else {
            const erro = await res.json();
            Swal.fire({ icon: 'error', title: 'Erro de Validação', text: erro.detail || 'Falha ao salvar. Verifique dados duplicados.', background: '#222', color: '#fff' });
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro de Conexão', background: '#222', color: '#fff' });
    } finally {
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    }
}

// ============================================================
// 2. GESTÃO DE EQUIPE (FUNCIONÁRIOS)
// ============================================================

export async function carregarListaEquipe() {
    const tbody = document.getElementById('listaEquipeBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Atualizando RH...</td></tr>';
    
    const filtroSelect = document.getElementById('filtroCidadeEquipe');
    const idUnidade = filtroSelect ? filtroSelect.value : "";

    try {
        let url = `${API_URL}/admin/listar-equipe`;
        if (idUnidade) url += `?filtro_unidade=${idUnidade}`;
        
        const res = await fetchAdmin(url);
        if (!res) { tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Falha de conexão.</td></tr>'; return; }
        if (res.status === 403) { tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Acesso Restrito ao RH.</td></tr>'; return; }
        
        const equipe = await res.json();
        tbody.innerHTML = '';
        
        if (equipe.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhum funcionário encontrado.</td></tr>'; 
            return; 
        }

        equipe.forEach(f => {
            const statusHtml = f.ativo 
                ? '<span class="text-green-400 text-[10px] font-black border border-green-800 px-2 py-1 rounded tracking-widest uppercase">Ativo</span>' 
                : '<span class="text-red-400 text-[10px] font-black border border-red-800 px-2 py-1 rounded tracking-widest uppercase">Inativo</span>';
            
            const jsonFunc = encodeURIComponent(JSON.stringify(f));
            const unidadeLabel = f.id_unidade === 1 ? "CBA" : (f.id_unidade === 2 ? "THE" : "GERAL");
            const badgeUnidade = `<span class="text-[9px] bg-[#111] border border-[#444] px-1.5 py-0.5 rounded ml-2 text-gray-400 font-bold">${unidadeLabel}</span>`;

            tbody.innerHTML += `
                <tr class="border-b border-[#333] hover:bg-[#2a2a2a] transition-colors">
                    <td class="p-4">
                        <div class="font-bold text-white uppercase tracking-wider flex items-center">
                            ${f.nome_completo} ${idUnidade === "" ? badgeUnidade : ""}
                        </div>
                    </td>
                    <td class="p-4 text-[#00FFFF] font-bold text-xs uppercase">${f.tb_cargos ? f.tb_cargos.nome_cargo : '-'}</td>
                    <td class="p-4">
                        <div class="text-xs text-gray-300">${f.email || '-'}</div>
                        <div class="text-[10px] text-gray-500 font-mono mt-0.5">${f.telefone || 'Sem contato'}</div>
                    </td>
                    <td class="p-4 text-center">${statusHtml}</td>
                    <td class="p-4 text-right">
                        <button onclick="abrirModalColaborador('${jsonFunc}')" class="text-gray-400 hover:text-[#00FFFF] transition bg-[#111] border border-[#333] p-2 rounded-lg" title="Editar Perfil">
                            <i class="fas fa-user-edit"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch(e) { 
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Erro interno do sistema.</td></tr>'; 
    }
}

export function abrirModalColaborador(jsonDados = null) {
    const dados = jsonDados ? JSON.parse(decodeURIComponent(jsonDados)) : null;
    const isEdit = !!dados;

    const conteudo = `
        <div class="space-y-4 text-left">
            <div>
                <label class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Nome Completo</label>
                <input type="text" id="eqNome" value="${isEdit ? dados.nome_completo : ''}" 
                    class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white uppercase outline-none focus:border-[#00FFFF]" required>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Cargo Setorial</label>
                    <select id="eqCargo" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white outline-none focus:border-[#00FFFF]">
                        <option value="" disabled selected>Carregando...</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Celular</label>
                    <input type="text" id="eqTelefone" value="${isEdit ? (dados.telefone || '') : ''}" 
                        class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white font-mono outline-none">
                </div>
            </div>
            
            <div class="bg-yellow-900/10 border border-yellow-700/30 p-4 rounded-xl mt-2">
                <h4 class="text-[10px] text-yellow-500 font-bold uppercase mb-3"><i class="fas fa-shield-alt mr-2"></i>Acesso ao Sistema EAD</h4>
                <div class="space-y-3">
                    <div>
                        <label class="text-[10px] text-gray-400 font-bold uppercase">Email (Usuário)</label>
                        <input type="email" id="eqEmail" value="${isEdit ? dados.email : ''}" 
                            class="w-full bg-[#0a0a0a] border border-[#222] rounded p-2 text-white outline-none" required>
                    </div>
                    <div>
                        <label class="text-[10px] text-gray-400 font-bold uppercase">${isEdit ? 'Redefinir Senha (Opcional)' : 'Senha Temporária'}</label>
                        <input type="text" id="eqSenha" value="${isEdit ? '' : 'javis123'}" placeholder="Deixe em branco para não alterar"
                            class="w-full bg-[#0a0a0a] border border-[#222] rounded p-2 text-white outline-none text-xs">
                    </div>
                </div>
            </div>

            ${isEdit ? `
                <div class="pt-2">
                    <label class="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Status Contratual</label>
                    <select id="eqAtivo" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-3 text-white">
                        <option value="true" ${dados.ativo ? 'selected' : ''}>🟢 ATIVO (Acesso Liberado)</option>
                        <option value="false" ${!dados.ativo ? 'selected' : ''}>🔴 INATIVO (Acesso Bloqueado)</option>
                    </select>
                </div>
            ` : ''}
        </div>
    `;

    const titulo = isEdit ? `Editar: ${dados.nome_completo.split(' ')[0]}` : 'Novo Colaborador';

    abrirModalUniversal(titulo, conteudo, async () => {
        await salvarDadosColaborador(isEdit, isEdit ? dados.id_colaborador : null);
    });

    setTimeout(() => {
        carregarCargosSelect(isEdit ? dados.id_cargo : null);
        const elTel = document.getElementById('eqTelefone');
        if (elTel) IMask(elTel, { mask: '(00) 00000-0000' });
    }, 100);
}

export async function carregarCargosSelect(idSelecionado = null) {
    const select = document.getElementById('eqCargo');
    if (!select) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-cargos`); 
        if (!res) return;
        
        const cargos = await res.json(); 
        let html = '<option value="" disabled selected>Selecione um cargo</option>';
        
        cargos.forEach(c => {
            const selected = (idSelecionado == c.id_cargo) ? 'selected' : '';
            html += `<option value="${c.id_cargo}" ${selected}>${c.nome_cargo}</option>`;
        });
        select.innerHTML = html;
    } catch (e) {
        select.innerHTML = '<option value="">Erro de conexão</option>';
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

    // Pega a senha (se preenchida)
    const senha = document.getElementById('eqSenha').value;
    if (!isEdit && !senha) return Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe uma senha inicial para o novo cadastro.', background: '#222', color: '#fff' });
    if (senha) payload.senha = senha;

    // Pega o status ativo se for modo de edição
    if (isEdit) {
        payload.ativo = document.getElementById('eqAtivo').value === 'true';
    }

    const url = isEdit ? `${API_URL}/admin/editar-funcionario/${id}` : `${API_URL}/admin/cadastrar-funcionario`;
    const method = isEdit ? 'PUT' : 'POST';

    btn.innerText = "PROCESSANDO..."; btn.disabled = true;

    try {
        const res = await fetchAdmin(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res) return; 

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: isEdit ? 'Perfil atualizado.' : 'Registrado com sucesso no banco de dados.', timer: 1500, showConfirmButton: false, background: '#222', color: '#fff' });
            fecharModalUniversal();
            carregarListaEquipe();
        } else {
            const err = await res.json();
            Swal.fire({ icon: 'error', title: 'Erro de Validação', text: err.detail || 'Erro ao processar requisição.', background: '#222', color: '#fff' });
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Falha de Rede', text: 'O servidor demorou muito para responder.', background: '#222', color: '#fff' });
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
}

// ============================================================
// 3. CRIAR LOGIN MANUAL PARA ALUNO (Caso EAD dê falha automática)
// ============================================================

export async function carregarAlunosParaNovoUsuario() {
    const select = document.getElementById('novoUsuarioAluno');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Carregando sistema...</option>';

    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-alunos`);
        if (!res) throw new Error('Falha de rede');

        const alunos = await res.json();
        select.innerHTML = '<option value="" disabled selected>Clique e pesquise um aluno...</option>';

        alunos.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id_aluno;
            const turma = (a.tb_matriculas && a.tb_matriculas[0]) ? a.tb_matriculas[0].codigo_turma : 'Sem Turma';
            opt.textContent = `${a.nome_completo} [${turma}]`;
            select.appendChild(opt);
        });
    } catch (err) {
        select.innerHTML = '<option value="" disabled>Falha ao conectar com o banco</option>';
    }
}

// O Event Listener do botão submit de login será atrelado pelo main.js (escutarFormNovoUsuario)
export async function enviarCriacaoLoginAluno(e) {
    e.preventDefault();

    const id_aluno = Number(document.getElementById('novoUsuarioAluno')?.value);
    const email = document.getElementById('novoUsuarioEmail')?.value?.trim();
    const senha = document.getElementById('novoUsuarioSenha')?.value;

    if (!id_aluno || !email || !senha) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Vincule o Aluno e preencha email/senha.', background: '#222', color: '#fff' });
        return;
    }

    const btn = document.getElementById('btnCriarNovoUsuario');
    const original = btn?.innerText;
    if (btn) { btn.disabled = true; btn.innerText = 'AUTENTICANDO...'; }

    try {
        const res = await fetchAdmin(`${API_URL}/admin/criar-login-aluno`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_aluno, email, senha })
        });

        if (!res) throw new Error('Falha de conexão');

        const data = await res.json().catch(() => ({}));
        
        if (!res.ok) throw new Error(data.detail || data.message || 'Login possivelmente já existe.');

        Swal.fire({ icon: 'success', title: 'Login Vinculado!', text: 'O aluno já pode acessar a plataforma EAD.', background: '#222', color: '#fff' });
        document.getElementById('formNovoUsuario').reset();
        carregarAlunosParaNovoUsuario(); // Recarrega a lista
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro de Permissão', text: err.message, background: '#222', color: '#fff' });
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = original; }
    }
}