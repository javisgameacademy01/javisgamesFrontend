// ==========================================
// js/funcionario/crm.js
// ==========================================
import { API_URL, fetchAdmin, nivelUsuarioLogado } from './config.js';

// ============================================================
// GESTÃO DE LEADS (INSCRIÇÕES)
// ============================================================

export async function carregarInscricoes() {
    const tbody = document.getElementById('listaInscricoesBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando leads...</td></tr>';
    
    const filtroSelect = document.getElementById('filtroCidadeLeads');
    const idUnidade = filtroSelect ? filtroSelect.value : "";

    try {
        let url = `${API_URL}/admin/leads-crm`;
        if (idUnidade) url += `?filtro_unidade=${idUnidade}`;

        const res = await fetchAdmin(url);
        if (!res) { 
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Erro de conexão ao carregar leads.</td></tr>'; 
            return; 
        }
        
        if (!res.ok) throw new Error("Erro API");
        const leads = await res.json();
        
        tbody.innerHTML = '';
        if(leads.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhum lead encontrado.</td></tr>'; 
            return; 
        }

        let pendentes = 0, emAtend = 0, vendas = 0;
        // Níveis que podem editar o status do Lead: 3 (Vendedor), 4 (Coord), 8 (Admin), 9/10 (Diretoria)
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
                        <select onchange="atualizarStatusLead(${lead.id}, this.value)" class="status-select ${color} w-full bg-[#111] border border-[#444] rounded p-1 outline-none" ${disabledAttr}>
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
        
        // Atualiza os cards no painel superior (Dashboard) se eles existirem na tela
        if(document.getElementById('dash-pendentes')) document.getElementById('dash-pendentes').innerText = pendentes;
        if(document.getElementById('dash-atendimento')) document.getElementById('dash-atendimento').innerText = emAtend;
        if(document.getElementById('dash-vendas')) document.getElementById('dash-vendas').innerText = vendas;

    } catch(e) { 
        console.error("Erro leads:", e); 
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-400">Erro ao carregar leads. Verifique o console.</td></tr>'; 
    }
}

export async function atualizarStatusLead(id, novoStatus) {
    try {
        const statusRes = await fetchAdmin(`${API_URL}/admin/leads-crm/${id}`, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ status: novoStatus }) 
        });
        
        if (!statusRes) { 
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Sem resposta do servidor.', background: '#222', color: '#fff' }); 
            return; 
        }
        carregarInscricoes(); // Recarrega a tabela para atualizar cores e contadores
    } catch(e) { 
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao atualizar', background: '#222', color: '#fff' }); 
    }
}

// ============================================================
// AULAS EXPERIMENTAIS
// ============================================================
let cacheAulasExp = [];
let cacheEquipeAExp = [];

let configOrdemAulasExp = {
    coluna: 'data_aula',
    crescente: false
};

function podeEditarAulaExp() {
    return (nivelUsuarioLogado === 3 || nivelUsuarioLogado >= 8);
}

// Helpers de formatação
const formatarDataBR = (iso) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '';
const formatarDataHoraBR = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR');
};

export async function carregarVendedoresAExp() {
    const res = await fetchAdmin(`${API_URL}/admin/listar-equipe`);
    if (!res) return;
    const equipe = await res.json();
    cacheEquipeAExp = Array.isArray(equipe) ? equipe : [];

    const sel = document.getElementById('aexpVendedor');
    if (!sel) return;

    sel.innerHTML = `<option value="">Selecione...</option>`;
    cacheEquipeAExp.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id_colaborador;
        opt.textContent = p.nome_completo || `#${p.id_colaborador}`;
        sel.appendChild(opt);
    });
}

export async function carregarAulasExperimentais() {
    const tbody = document.getElementById('tbody-aulas-experimentais');
    const btnNova = document.getElementById('btnNovaAulaExp');
    
    if (btnNova) btnNova.classList.toggle('hidden', !podeEditarAulaExp());
    await carregarVendedoresAExp();

    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando dados...</td></tr>`;

    const filtroGlobal = document.getElementById('filtroAulasExp');
    const q = (filtroGlobal?.value || '').trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);

    const res = await fetchAdmin(`${API_URL}/admin/aulas-experimentais?${params.toString()}`);
    if (!res) return;

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        tbody.innerHTML = `<tr><td colspan="14" class="p-6 text-center text-red-500 font-bold bg-red-900/20 border border-red-800 rounded">ERRO DO SERVIDOR: ${err.detail || 'Falha ao buscar.'}</td></tr>`;
        return;
    }

    const rows = await res.json();
    cacheAulasExp = Array.isArray(rows) ? rows : [];

    preencherSelectsAulasExp();
    atualizarIconesOrdemAulasExp();
    filtrarAulasExpLocal(); 
}

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

        const dataExibicao = r.data_aula ? (() => {
            const partes = r.data_aula.split('T')[0].split('-');
            if (partes.length !== 3) return r.data_aula;
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
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

function preencherSelectsAulasExp() {
    const getUnicos = (chavePai, chaveFilho) => {
        const valores = cacheAulasExp.map(r => {
            if (chaveFilho) return r[chavePai] ? r[chavePai][chaveFilho] : '';
            return r[chavePai] || '';
        }).filter(v => v && v.trim() !== '');
        return [...new Set(valores)].sort(); 
    };

    const popular = (id, valores, padrao = "Todos") => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const valorAtual = sel.value; 
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

    const datas = getUnicos('data_aula');
    const selData = document.getElementById('f-data');
    if (selData) {
        const atual = selData.value;
        selData.innerHTML = `<option value="">Todas</option>` + 
            datas.map(d => {
                const partes = d.split('-');
                const formatada = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : d;
                return `<option value="${d}">${formatada}</option>`;
            }).join('');
        selData.value = atual;
    }
}

export function ordenarAulasExp(coluna) {
    if (configOrdemAulasExp.coluna === coluna) {
        configOrdemAulasExp.crescente = !configOrdemAulasExp.crescente;
    } else {
        configOrdemAulasExp.coluna = coluna;
        configOrdemAulasExp.crescente = true;
    }
    atualizarIconesOrdemAulasExp();
    filtrarAulasExpLocal();
}

function atualizarIconesOrdemAulasExp() {
    const icones = document.querySelectorAll('th i.fas');
    icones.forEach(i => i.className = 'fas fa-sort text-gray-600 ml-1');

    const iconeAtivo = document.getElementById(`sort-${configOrdemAulasExp.coluna}`);
    if (iconeAtivo) {
        iconeAtivo.className = configOrdemAulasExp.crescente ? 'fas fa-sort-up text-[#00FFFF] ml-1' : 'fas fa-sort-down text-[#00FFFF] ml-1';
    }
}

export function filtrarAulasExpLocal() {
    const fResp = document.getElementById('f-resp')?.value || '';
    const fAluno = document.getElementById('f-aluno')?.value || '';
    const fData = document.getElementById('f-data')?.value || ''; 
    const fCurso = document.getElementById('f-curso')?.value || '';
    const fOrigem = document.getElementById('f-origem')?.value || '';
    const fVend = document.getElementById('f-vend')?.value || '';
    const fStatus = document.getElementById('f-status')?.value || '';

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

    const col = configOrdemAulasExp.coluna;
    const direcao = configOrdemAulasExp.crescente ? 1 : -1;

    dadosProcessados.sort((a, b) => {
        let valA = a[col] || '';
        let valB = b[col] || '';

        if (col === 'vendedor_nome') {
            valA = a.tb_colaboradores ? a.tb_colaboradores.nome_completo : '';
            valB = b.tb_colaboradores ? b.tb_colaboradores.nome_completo : '';
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return -1 * direcao;
        if (valA > valB) return 1 * direcao;
        return 0;
    });

    renderizarTabelaAulasExp(dadosProcessados);
}

export function limparFiltrosAulasExp() {
    ['f-resp', 'f-aluno', 'f-data', 'f-curso', 'f-origem', 'f-vend', 'f-status'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = '';
    });
    filtrarAulasExpLocal(); 
}

export function abrirModalAulaExp(id = null) {
    if (!podeEditarAulaExp()) return;

    const modal = document.getElementById('modalAulaExp');
    const titulo = document.getElementById('tituloModalAulaExp');
    const r = id ? cacheAulasExp.find(x => x.id === id) : null;

    document.getElementById('aexpId').value = r?.id || '';
    document.getElementById('aexpResponsavel').value = r?.responsavel || '';
    document.getElementById('aexpContato1').value = r?.contato1 || '';
    document.getElementById('aexpContato2').value = r?.contato2 || '';
    document.getElementById('aexpAluno').value = r?.aluno || '';

    if (r && r.data_aula) {
        document.getElementById('aexpData').value = r.data_aula.substring(0, 10);
    } else {
        document.getElementById('aexpData').value = '';
    }

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

export function fecharModalAulaExp() {
    const modal = document.getElementById('modalAulaExp');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

export async function salvarAulaExp(event) {
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
        id_vendedor: document.getElementById('aexpVendedor').value || null,
        status_atendimento: (document.getElementById('aexpStatusAtend').value || '').trim() || null,
        observacao: (document.getElementById('aexpObs').value || '').trim() || null
    };

    if (!payload.aluno || !payload.data_aula) {
        Swal.fire({ icon: 'warning', title: 'Obrigatório', text: 'ALUNO e DATA DA AULA são obrigatórios.', background:'#222', color:'#fff' });
        return;
    }

    const url = id ? `${API_URL}/admin/aulas-experimentais/${id}` : `${API_URL}/admin/aulas-experimentais`;
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

export async function excluirAulaExp(id) {
    if (!podeEditarAulaExp()) return;

    const conf = await Swal.fire({
        icon: 'warning', title: 'Excluir aula?', text: 'Isso não pode ser desfeito.',
        showCancelButton: true, confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar', background:'#222', color:'#fff'
    });
    
    if (!conf.isConfirmed) return;

    const res = await fetchAdmin(`${API_URL}/admin/aulas-experimentais/${id}`, { method: 'DELETE' });
    if (!res) return;

    if (!res.ok) {
        Swal.fire({ icon: 'error', title: 'Erro ao excluir', background:'#222', color:'#fff' });
        return;
    }

    await carregarAulasExperimentais();
    Swal.fire({ icon: 'success', title: 'Excluído!', timer: 1200, showConfirmButton: false, background:'#222', color:'#fff' });
}

// Configuração do Debounce (Busca ao digitar)
let debounceTimerAExp = null;
export function escutarBuscaAulasExp() {
    clearTimeout(debounceTimerAExp);
    debounceTimerAExp = setTimeout(() => carregarAulasExperimentais(), 300);
}