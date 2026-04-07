/**
 * js/funcionario/matricula.js
 * Lógica Completa e Integrada do Fluxo de Matrícula
 */

import { API_URL, fetchAdmin } from './config.js';

// Cache de dados do banco
let cursosDoBanco = [];
let turmasDoBanco = [];
const SUB_ABAS = ['mat-identificacao', 'mat-academico', 'mat-negociacao', 'mat-finalizacao'];
let subAbaAtual = 0;

/* ============================================================
   1. NAVEGAÇÃO E INTERFACE
   ============================================================ */

export function mudarSubAba(id) {
    const index = SUB_ABAS.indexOf(id);
    if (index === -1) return;
    subAbaAtual = index;

    document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');

    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active', 'text-[#00FFFF]', 'border-[#00FFFF]', 'border-b-2');
        btn.classList.add('text-gray-500');
    });
    document.getElementById(`btn-${id}`)?.classList.add('active', 'text-[#00FFFF]', 'border-[#00FFFF]', 'border-b-2');

    const btnPrev = document.getElementById('matBtnPrev');
    const btnNext = document.getElementById('matBtnNext');
    if (btnPrev) btnPrev.classList.toggle('hidden', subAbaAtual === 0);
    if (btnNext) {
        btnNext.innerHTML = subAbaAtual === SUB_ABAS.length - 1 
            ? 'CONCLUIR MATRÍCULA <i class="fas fa-check ml-2"></i>' 
            : 'PRÓXIMO PASSO <i class="fas fa-arrow-right ml-2"></i>';
    }

    if (id === 'mat-negociacao') calcularFinanceiroMatricula();
}

export function navegarMatricula(dir) {
    const novoIndex = subAbaAtual + dir;
    if (novoIndex >= 0 && novoIndex < SUB_ABAS.length) mudarSubAba(SUB_ABAS[novoIndex]);
}

export function abrirModalMatricula() {
    const modal = document.getElementById('modalMatricula');
    if (modal) {
        modal.classList.replace('hidden', 'flex');
        carregarDadosIniciaisMatricula();
        mudarSubAba('mat-identificacao');
    }
}

export function fecharModalMatricula() {
    document.getElementById('modalMatricula')?.classList.replace('flex', 'hidden');
}

/* ============================================================
   2. SINCRONIZAÇÃO COM O BANCO DE DADOS
   ============================================================ */

export async function carregarDadosIniciaisMatricula() {
    try {
        const [resCursos, resTurmas] = await Promise.all([
            fetchAdmin(`${API_URL}/admin/conteudo-didatico/cursos`),
            fetchAdmin(`${API_URL}/admin/gerenciar-turmas`)
        ]);

        cursosDoBanco = await resCursos.json();
        turmasDoBanco = await resTurmas.json();

        // Popula o select de cursos na Aba 2
        const select = document.getElementById('matCurso');
        if (select) {
            select.innerHTML = '<option value="">Selecione o Curso...</option>';
            cursosDoBanco.forEach(c => select.appendChild(new Option(c.titulo.toUpperCase(), c.id)));
        }
        carregarVendedores();
    } catch (err) {
        console.error("Erro ao sincronizar dados:", err);
    }
}

export function atualizarInfoCurso(cursoId) {
    const curso = cursosDoBanco.find(c => c.id == cursoId);
    if (curso) {
        if (document.getElementById('infoCargaHoraria')) 
            document.getElementById('infoCargaHoraria').innerText = `${curso.modulos.length * 20} Horas`;
        if (document.getElementById('infoDuracao')) 
            document.getElementById('infoDuracao').innerText = `${curso.modulos.length} Meses`;
        
        carregarTurmasPorCurso(curso.titulo);
    }
}

export function carregarTurmasPorCurso(nomeCurso) {
    const selectTurma = document.getElementById('matTurma');
    if (!selectTurma) return;

    const filtradas = turmasDoBanco.filter(t => 
        String(t.nome_curso).trim().toUpperCase() === String(nomeCurso).trim().toUpperCase() &&
        (t.status === 'Em Andamento' || t.status === 'Planejada')
    );

    selectTurma.innerHTML = filtradas.length ? '<option value="">Selecione o horário...</option>' : '<option>Nenhuma turma ativa</option>';
    filtradas.forEach(t => {
        const opt = new Option(`${t.codigo_turma} | ${t.dia_semana || '---'} - ${t.horario || '---'}`, t.codigo_turma);
        selectTurma.appendChild(opt);
    });
}

/* ============================================================
   3. FINANCEIRO E CÁLCULOS
   ============================================================ */

export function calcularFinanceiroMatricula() {
    // 1. CAPTURA DOS INPUTS (Incluindo o Vencimento)
    const taxa = parseFloat(document.getElementById('matTaxa')?.value) || 0;
    const entrada = parseFloat(document.getElementById('matEntrada')?.value) || 0;
    const valorTotal = parseFloat(document.getElementById('matValorTotalNegociado')?.value) || 0;
    const parcelas = parseInt(document.getElementById('matQtdParcelas')?.value) || 1;
    
    // PEGANDO O DIA DO VENCIMENTO DIGITADO
    const diaVencimento = 8;

    const valorParcela = (valorTotal - entrada) / parcelas;
    const totalAdesao = taxa + entrada;

    const safeSet = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    safeSet('displayValorParcela', valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    safeSet('displaySaldoRestante', (valorTotal - entrada).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    safeSet('resTotalContrato', (valorTotal + taxa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    safeSet('resTotalMatricula', totalAdesao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

    const tbody = document.getElementById('tbodyPreviewParcelas');
    if (!tbody) return;
    tbody.innerHTML = '';
    const hoje = new Date();

    // Linha de Adesão (Sempre o dia de hoje)
    tbody.innerHTML += `
        <tr class="bg-red-500/5 border-l-2 border-red-500">
            <td class="p-3 text-red-500 font-bold">0</td>
            <td class="p-3 text-white">${hoje.toLocaleDateString('pt-BR')}</td>
            <td class="p-3 text-red-400 font-bold">${totalAdesao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td class="p-3 text-gray-500">0,00</td>
            <td class="p-3 text-[9px] font-black uppercase text-red-500">Adesão</td>
            <td class="p-3 italic text-[10px] text-gray-500">Taxa + Entrada</td>
        </tr>`;

    // 2. LOOP DAS PARCELAS (Agora usando o diaVencimento variável)
    for (let i = 1; i <= parcelas; i++) {
        // Criamos a data do próximo mês usando o diaVencimento que o usuário escolheu
        const dataVenc = new Date(hoje.getFullYear(), hoje.getMonth() + i, diaVencimento);
        
        tbody.innerHTML += `
            <tr class="hover:bg-white/5 border-b border-white/5 transition-colors">
                <td class="p-3 text-white">${i}</td>
                <td class="p-3 text-gray-300">${dataVenc.toLocaleDateString('pt-BR')}</td>
                <td class="p-3 text-white font-bold">${valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td class="p-3 text-gray-500">0,00</td>
                <td class="p-3 text-gray-500 font-bold uppercase text-[9px]">A Gerar</td>
                <td class="p-3 text-[10px] text-gray-600">Mensalidade ${i}/${parcelas}</td>
            </tr>`;
    }
}

/* ============================================================
   4. UTILITÁRIOS (TELEFONE, CEP, CÓPIA)
   ============================================================ */

export function adicionarCampoTelefone(containerId, tipo) {
    const container = document.getElementById(containerId);
    if (!container || container.children.length >= 3) return;

    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 mt-2';
    div.innerHTML = `
        <input type="text" class="w-full bg-[#1a1a1a] border border-[#333] rounded-xl p-2 text-xs text-white" placeholder="OUTRO NÚMERO">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-500"><i class="fas fa-minus"></i></button>
    `;
    container.appendChild(div);
}

export async function buscarCep(cep, prefixo) {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    try {
        const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
        const d = await r.json();
        if (!d.erro) {
            document.getElementById(`${prefixo}Logradouro`).value = d.logradouro.toUpperCase();
            document.getElementById(`${prefixo}Bairro`).value = d.bairro.toUpperCase();
            document.getElementById(`${prefixo}Cidade`).value = d.localidade.toUpperCase();
        }
    } catch (e) { console.error(e); }
}

export function copiarDadosResponsavel() {
    const chk = document.getElementById('matMesmoResponsavel');
    const campos = [
        { de: 'matRespNome', para: 'matAlunoNome' }, { de: 'matRespCpf', para: 'matAlunoCpf' },
        { de: 'matRespNasc', para: 'matAlunoNasc' }, { de: 'matRespSexo', para: 'matAlunoSexo' },
        { de: 'matRespCelular', para: 'matAlunoCelular' }
    ];
    campos.forEach(c => {
        const dest = document.getElementById(c.para);
        if (chk?.checked) {
            dest.value = document.getElementById(c.de).value;
            dest.readOnly = true;
        } else {
            dest.value = '';
            dest.readOnly = false;
        }
    });
}

export function copiarEnderecoResponsavel() {
    const campos = ['Cep', 'Logradouro', 'Numero', 'Bairro', 'Cidade'];
    campos.forEach(c => {
        document.getElementById('matAluno' + c).value = document.getElementById('matResp' + c).value;
    });
}

export function verificarParentescoProprio(v) {
    if (v === 'PROPRIO') {
        const chk = document.getElementById('matMesmoResponsavel');
        if(chk) { chk.checked = true; copiarDadosResponsavel(); }
    }
}

export async function carregarVendedores() {
    const s = document.getElementById('matVendedor');
    if(s) s.innerHTML = '<option value="Marcos">MARCOS (COORDENADOR)</option><option value="Vendedor 1">CONSULTOR 1</option>';
}

/**
 * Gera o Contrato Privado em PDF e cria o fluxo financeiro no Asaas.
 */
/**
 * Inicia o fluxo de Pré-Matrícula:
 * Salva os dados na 'geladeira', gera o PDF do contrato e fecha o modal.
 */
export async function gerarContrato() {
    try {
        // 1. CAPTURA DE DADOS - IDENTIFICAÇÃO (ABA 1)
        const payload = {
            aluno_nome: document.getElementById('matAlunoNome')?.value || "",
            aluno_cpf: document.getElementById('matAlunoCpf')?.value || "",
            aluno_nascimento: document.getElementById('matAlunoNasc')?.value || "",
            email: document.getElementById('matAlunoEmail')?.value || "",
            whatsapp: document.getElementById('matAlunoCelular')?.value || "",
            
            cep: document.getElementById('matAlunoCep')?.value || "",
            endereco: `${document.getElementById('matAlunoLogradouro')?.value || ""}, ${document.getElementById('matAlunoNumero')?.value || ""}`,
            bairro: document.getElementById('matAlunoBairro')?.value || "",

            responsavel_nome: document.getElementById('matRespNome')?.value || "",
            responsavel_cpf: document.getElementById('matRespCpf')?.value || "",
            responsavel_parentesco: document.getElementById('matRespParentesco')?.value || "",
            responsavel_rg: document.getElementById('matRespRg')?.value || "",
            responsavel_rg_orgao: document.getElementById('matRespRgOrgao')?.value || "",

            // 2. DADOS ACADÊMICOS (ABA 2)
            curso: document.getElementById('matCurso')?.options[document.getElementById('matCurso').selectedIndex]?.text || "",
            turma_codigo: document.getElementById('matTurma')?.value || null,
            horario_aula: document.getElementById('matTurma')?.options[document.getElementById('matTurma').selectedIndex]?.text.split('|')[1]?.trim() || "A definir",

            // 3. FINANCEIRO (ABA 3)
            valor_total: parseFloat(document.getElementById('matValorTotalNegociado')?.value) || 0,
            parcelas: parseInt(document.getElementById('matQtdParcelas')?.value) || 1,
            valor_entrada: (parseFloat(document.getElementById('matTaxa')?.value) || 0) + (parseFloat(document.getElementById('matEntrada')?.value) || 0),
            vencimento: 8 // Regra fixa da Javis
        };

        // Validação básica
        if (!payload.aluno_nome || !payload.aluno_cpf || !payload.curso) {
            Swal.fire({ icon: 'warning', title: 'Campos Obrigatórios', text: 'Preencha Nome, CPF e Curso antes de gerar o contrato.' });
            return;
        }

        // Feedback visual de processamento
        Swal.fire({
            title: 'Gerando Documentação...',
            html: 'Estamos preparando o contrato e reservando a vaga no sistema.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // 4. ENVIO PARA O BACKEND (NOVA ROTA DE PRÉ-MATRÍCULA)
        const res = await fetchAdmin('/admin/gerar-pre-matricula', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.status === 'success') {
            // 5. SUCESSO: ABRE O PDF E FINALIZA A INTERFACE
            window.open(data.url_pdf, '_blank');
            
            fecharModalMatricula();

            Swal.fire({
                icon: 'success',
                title: 'Pré-Matrícula Realizada!',
                text: 'O contrato foi gerado. Agora, na lista de matrículas, gere o link de pagamento para o cliente efetivar a vaga.',
                confirmButtonColor: '#00FFFF',
                confirmButtonText: 'Entendido'
            });

            // Recarrega a lista de termos/matrículas ao fundo se a função existir
            if (window.carregarListaTermos) window.carregarListaTermos();

        } else {
            throw new Error(data.detail || 'Erro ao processar pré-matrícula.');
        }

    } catch (error) {
        console.error("Erro no fluxo de matrícula:", error);
        Swal.fire({ icon: 'error', title: 'Falha na Operação', text: error.message });
    }
}

export function finalizarProcessoMatricula() {
    Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: 'Processo de matrícula finalizado.',
        background: '#222',
        color: '#fff',
        timer: 1500,
        showConfirmButton: false
    }).then(() => {
        // Fecha o modal
        fecharModalMatricula();
        
        // Atualiza a tabela do painel de matrículas por trás (se a função existir)
        // carregarListaTermos(); // Descomente e coloque o nome da sua função que carrega a tabela
        
        // Limpa todos os campos para a próxima matrícula
        document.querySelectorAll('#modalMatricula input, #modalMatricula select').forEach(el => {
            if (el.type === 'checkbox') el.checked = false;
            else el.value = '';
        });
    });
}


// Nova função para o botão da linha da tabela
export async function emitirPagamentoEntrada(idPre) {
    Swal.fire({ title: 'Gerando Link...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const res = await fetchAdmin(`/admin/gerar-pagamento-entrada/${idPre}`, { method: 'POST' });
    const data = await res.json();
    
    if (data.url_pagamento) {
        Swal.fire({
            title: 'Link do PIX / Boleto',
            html: `Envie este link para o cliente pagar a entrada:<br><br>
                   <input type="text" value="${data.url_pagamento}" class="w-full p-2 bg-black border border-gray-700 text-cyan-400 text-xs rounded" readonly>`,
            icon: 'success',
            confirmButtonText: 'Copiar e Fechar'
        });
    }
}

function renderizarLinhaPreMatricula(item) {
    let btnPagamento = '';
    
    if (item.status === 'Aguardando Pagamento') {
        btnPagamento = `<button onclick="emitirPagamentoEntrada('${item.id}')" class="bg-yellow-600 p-1 rounded text-[9px] text-white">GERAR PAGAMENTO</button>`;
    } else {
        btnPagamento = `<span class="text-green-500 font-bold">MATRICULADO</span>`;
    }

    return `
        <tr>
            <td class="p-4">${item.dados_json.aluno_nome}</td>
            <td class="p-4">${item.status}</td>
            <td class="p-4 text-right">
                <a href="${item.url_contrato}" target="_blank" class="text-blue-400 mr-2">Contrato</a>
                ${btnPagamento}
            </td>
        </tr>
    `;
}

// 1. Torna a função de gerar pagamento global para o botão funcionar
window.emitirPagamentoEntrada = async function(idPre) {
    Swal.fire({ title: 'Gerando Link...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const res = await fetchAdmin(`/admin/gerar-pagamento-entrada/${idPre}`, { method: 'POST' });
        const data = await res.json();
        
        if (data.url_pagamento) {
            Swal.fire({
                title: 'Link de Pagamento',
                html: `Copie o link abaixo e envie para o cliente:<br><br>
                       <input type="text" id="linkPix" value="${data.url_pagamento}" class="w-full p-2 bg-black border border-gray-700 text-[#00FFFF] rounded text-xs" readonly>`,
                icon: 'success',
                confirmButtonText: 'Copiar Link',
                preConfirm: () => {
                    const input = document.getElementById('linkPix');
                    input.select();
                    document.execCommand('copy');
                    Swal.fire('Copiado!', '', 'success');
                }
            });
        }
    } catch (err) {
        Swal.fire('Erro', 'Não foi possível gerar o link.', 'error');
    }
};

// 2. Função para carregar a lista de pré-matrículas na tabela
export async function carregarListaMatriculas() {
    const tbody = document.getElementById('tbodyMatriculas');
    if (!tbody) return;

    try {
        const res = await fetchAdmin('/admin/listar-termos'); // Ajuste a rota se criou uma específica para pre-matriculas
        const dados = await res.json();

        tbody.innerHTML = dados.map(item => {
            const info = item.dados_json || {};
            const isPendente = item.status === 'Aguardando Pagamento';
            
            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-4">
                        <p class="text-white font-bold">${info.aluno_nome || 'NOME N/A'}</p>
                        <p class="text-[10px]">Resp: ${info.responsavel_nome || 'O Próprio'}</p>
                    </td>
                    <td class="p-4">
                        <p class="text-white">${info.curso || '---'}</p>
                        <p class="text-[10px] text-[#00FFFF]">${info.turma_codigo || 'Sem Turma'}</p>
                    </td>
                    <td class="p-4 text-center">
                        <span class="px-2 py-1 rounded-full text-[9px] font-bold uppercase ${isPendente ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}">
                            ${item.status}
                        </span>
                    </td>
                    <td class="p-4 text-right">
                        <div class="flex justify-end gap-2">
                            <a href="${item.url_contrato}" target="_blank" class="p-2 bg-gray-800 rounded hover:text-white" title="Ver Contrato">
                                <i class="fas fa-file-pdf"></i>
                            </a>
                            ${isPendente ? `
                                <button onclick="emitirPagamentoEntrada('${item.id}')" class="bg-[#00FFFF] text-black px-3 py-1 rounded-lg font-bold text-[9px] hover:bg-cyan-400">
                                    GERAR PAGAMENTO
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Erro ao carregar lista:", err);
    }
}