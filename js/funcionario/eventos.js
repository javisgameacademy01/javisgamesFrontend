// ==========================================
// js/funcionario/eventos.js
// ==========================================
import { API_URL, fetchAdmin } from './config.js';
import { abrirModalUniversal, fecharModalUniversal } from './ui.js';

// Estado local do módulo
let cacheFestasAniversario = new Map();
let debounceFestasTimer = null;
let festasSort = { by: 'data_festa', dir: 'asc' };
const allowedSortColsFestas = new Set([
    'data_festa', 'horario', 'contratante', 'telefone', 'aniversariante',
    'idade', 'data_pagamento', 'kit_festa', 'valor',
    'id_vendedor', 'id_unidade', 'status', 'created_at'
]);

// ============================================================
// AUXILIARES E FORMATAÇÃO
// ============================================================

export function debounceCarregarFestasAniversario() {
    clearTimeout(debounceFestasTimer);
    debounceFestasTimer = setTimeout(() => carregarFestasAniversario(), 300);
}

function formatarDataBR(isoOrDateString) {
    if (!isoOrDateString) return '-';
    if (/^\d{4}-\d{2}-\d{2}/.test(isoOrDateString)) {
        const d = new Date(isoOrDateString + "T00:00:00");
        return d.toLocaleDateString('pt-BR');
    }
    try { return new Date(isoOrDateString).toLocaleDateString('pt-BR'); } catch { return isoOrDateString; }
}

function badgeStatus(status) {
    if (status === 'FECHADA') return `<span class="text-[10px] px-2 py-1 rounded bg-red-900/40 border border-red-700 text-red-200 font-bold">FECHADA</span>`;
    if (status === 'PARA_ACONTECER') return `<span class="text-[10px] px-2 py-1 rounded bg-yellow-900/40 border border-yellow-700 text-yellow-200 font-bold">PARA ACONTECER</span>`;
    return `<span class="text-[10px] px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-200 font-bold">${status || '-'}</span>`;
}

function badgeBool(v) {
    if (v === true) return `<span class="text-[10px] px-2 py-1 rounded bg-green-900/40 border border-green-700 text-green-200 font-bold">SIM</span>`;
    if (v === false) return `<span class="text-[10px] px-2 py-1 rounded bg-gray-900/40 border border-gray-700 text-gray-300 font-bold">NÃO</span>`;
    return `-`;
}

function escapeHtml(s) {
    return (s ?? '').toString()
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// ============================================================
// CARREGAMENTO DA TABELA E FILTROS
// ============================================================

export async function carregarFiltrosFestasAniversario() {
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
        if (Array.isArray(dados)) {
            dados.forEach(v => sel.innerHTML += `<option value="${v.id_colaborador}">${v.nome_completo}</option>`);
        }
    } catch (e) { console.error(e); }
}

async function carregarSelectUnidadesFesta() {
    const sel = document.getElementById('filtroUnidadeFesta');
    if (!sel) return;

    sel.innerHTML = `<option value="">Todas as unidades</option>`;
    try {
        const res = await fetchAdmin(`${API_URL}/admin/unidades`);
        if (!res || !res.ok) return;
        const unidades = await res.json();
        if (Array.isArray(unidades)) {
            unidades.forEach(u => sel.innerHTML += `<option value="${u.id_unidade}">${u.nome_unidade}</option>`);
        }
    } catch (e) { console.error(e); }
}

export function limparPeriodoFesta() {
    if(document.getElementById('filtroDataIniFesta')) document.getElementById('filtroDataIniFesta').value = '';
    if(document.getElementById('filtroDataFimFesta')) document.getElementById('filtroDataFimFesta').value = '';
    carregarFestasAniversario();
}

export async function carregarFestasAniversario() {
    const tbody = document.getElementById('listaFestasBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando eventos...</td></tr>`;

    const status = document.getElementById('filtroStatusFesta')?.value || '';
    const q = (document.getElementById('buscaFesta')?.value || '').trim();
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
        
        params.set('sort_by', festasSort.by);
        params.set('sort_dir', festasSort.dir);

        if ([...params.keys()].length) url += `?${params.toString()}`;

        const res = await fetchAdmin(url);
        if (!res) {
            tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-red-400">Falha de conexão.</td></tr>`;
            return;
        }

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-red-400">Erro ao carregar festas.</td></tr>`;
            return;
        }

        const festas = await res.json();
        if (!Array.isArray(festas) || festas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-gray-500">Nenhuma festa encontrada.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        cacheFestasAniversario.clear(); // Limpa cache antigo

        festas.forEach(f => {
            cacheFestasAniversario.set(f.id, f);
            const valor = (f.valor !== null && f.valor !== undefined) ? `R$ ${Number(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
            const unidadeNome = (f.tb_unidades && f.tb_unidades.nome_unidade) ? f.tb_unidades.nome_unidade : (f.nome_unidade ? f.nome_unidade : '-');
            const vendedorNome = (f.tb_colaboradores && f.tb_colaboradores.nome_completo) ? f.tb_colaboradores.nome_completo : (f.quem_vendeu || '-');

            tbody.innerHTML += `
                <tr class="border-b border-[#222] hover:bg-[#2a2a2a] transition">
                    <td class="p-3 text-[#00FFFF] font-mono">${formatarDataBR(f.data_festa)}</td>
                    <td class="p-3">${f.horario || '-'}</td>
                    <td class="p-3 font-bold text-white">${f.contratante || '-'}</td>
                    <td class="p-3 text-gray-300 font-mono">${f.telefone || '-'}</td>
                    <td class="p-3 uppercase">${f.aniversariante || '-'}</td>
                    <td class="p-3 text-center">${f.idade ?? '-'}</td>
                    <td class="p-3">${formatarDataBR(f.data_pagamento)}</td>
                    <td class="p-3 text-center">${badgeBool(f.kit_festa)}</td>
                    <td class="p-3 font-mono text-green-400 font-bold">${valor}</td>
                    <td class="p-3 truncate max-w-[100px] text-xs" title="${vendedorNome}">${vendedorNome}</td>
                    <td class="p-3 text-xs">${unidadeNome}</td>
                    <td class="p-3">${badgeStatus(f.status)}</td>
                    <td class="p-3 max-w-[120px] truncate text-[10px] text-gray-400" title="${f.observacoes || ''}">${f.observacoes || '-'}</td>
                    <td class="p-3 text-right">
                        <button onclick="abrirModalEditarFestaAniversario(${f.id})" class="text-gray-400 hover:text-[#00FFFF] transition p-2 bg-[#111] border border-[#333] rounded" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-red-400">Erro de rede.</td></tr>`;
    }
}

// ============================================================
// ORDENAÇÃO (SORTING)
// ============================================================

export function toggleSortFestas(th) {
    const col = th.getAttribute('data-sort');
    if (!allowedSortColsFestas.has(col)) return;

    if (festasSort.by !== col) {
        festasSort.by = col;
        festasSort.dir = 'asc';
    } else {
        if (festasSort.dir === 'asc') festasSort.dir = 'desc';
        else if (festasSort.dir === 'desc') festasSort = { by: 'data_festa', dir: 'asc' };
        else festasSort.dir = 'asc';
    }
    atualizarSetasOrdenacaoFestas();
    carregarFestasAniversario();
}

function atualizarSetasOrdenacaoFestas() {
    document.querySelectorAll('#aniversario thead th[data-sort]').forEach(th => {
        const arrow = th.querySelector('[data-arrow]');
        if (arrow) {
            arrow.textContent = '↕';
            arrow.classList.remove('text-[#00FFFF]');
            arrow.classList.add('text-gray-500');
        }
    });

    const thAtivo = document.querySelector(`#aniversario thead th[data-sort="${festasSort.by}"]`);
    if (!thAtivo) return;
    const arrow = thAtivo.querySelector('[data-arrow]');
    if (!arrow) return;

    arrow.textContent = (festasSort.dir === 'desc') ? '↓' : '↑';
    arrow.classList.remove('text-gray-500');
    arrow.classList.add('text-[#00FFFF]');
}

// ============================================================
// MODAIS DE CRIAÇÃO E EDIÇÃO
// ============================================================

function montarFormFestaAniversario(dados = null) {
    const f = dados || {};
    const isEdit = !!dados;
    
    const contratante = escapeHtml(f.contratante);
    const telefone = escapeHtml(f.telefone);
    const aniversariante = escapeHtml(f.aniversariante);
    const horario = escapeHtml(f.horario);
    const obs = escapeHtml(f.observacoes);
    const idade = (f.idade ?? '');
    const valor = (f.valor ?? '');
    const kitVal = (f.kit_festa === true) ? 'true' : (f.kit_festa === false ? 'false' : '');
    const status = f.status || 'PARA_ACONTECER';
    const dataFesta = f.data_festa || '';
    const dataPgto = f.data_pagamento || '';

    return `
        <div class="space-y-3 text-sm text-left">
            <input type="hidden" id="festaId" value="${f.id || ''}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Status</label>
                    <select id="faStatus" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#00FFFF]">
                        <option value="PARA_ACONTECER" ${status === 'PARA_ACONTECER' ? 'selected' : ''}>Para acontecer</option>
                        <option value="FECHADA" ${status === 'FECHADA' ? 'selected' : ''}>Fechada</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Data da festa</label>
                    <input id="faDataFesta" type="date" value="${dataFesta}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00FFFF]" />
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Horário</label>
                    <input id="faHorario" placeholder="Ex: 14h às 18h" value="${horario}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#00FFFF]" />
                </div>
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Telefone</label>
                    <input id="faTelefone" value="${telefone}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white font-mono outline-none focus:border-[#00FFFF]" />
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Contratante</label>
                    <input id="faContratante" value="${contratante}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white uppercase outline-none focus:border-[#00FFFF]" />
                </div>
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Aniversariante</label>
                    <input id="faAniversariante" value="${aniversariante}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white uppercase outline-none focus:border-[#00FFFF]" />
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Idade</label>
                    <input id="faIdade" type="number" min="0" value="${idade}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#00FFFF]" />
                </div>
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Pagamento</label>
                    <input id="faDataPgto" type="date" value="${dataPgto}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00FFFF]" />
                </div>
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Valor (R$)</label>
                    <input id="faValor" type="number" step="0.01" value="${valor}" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#00FFFF]" />
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Vendedor</label>
                    <select id="faVendedor" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#00FFFF]">
                        <option value="">Carregando...</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Kit festa</label>
                    <select id="faKit" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#00FFFF]">
                        <option value="" ${kitVal === '' ? 'selected' : ''}>Não informado</option>
                        <option value="true" ${kitVal === 'true' ? 'selected' : ''}>Sim</option>
                        <option value="false" ${kitVal === 'false' ? 'selected' : ''}>Não</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Observações</label>
                <textarea id="faObs" rows="2" class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00FFFF]">${obs}</textarea>
            </div>
        </div>
    `;
}

export async function abrirModalNovaFestaAniversario() {
    const conteudo = montarFormFestaAniversario(null);
    abrirModalUniversal("Novo Evento Gamer", conteudo, () => salvarDadosFestaAniversario(false));
    await preencherSelectVendedoresModal(null);
}

export async function abrirModalEditarFestaAniversario(id) {
    const f = cacheFestasAniversario.get(Number(id));
    if (!f) return Swal.fire('Erro', 'Dados não encontrados no cache.', 'error');
    
    const conteudo = montarFormFestaAniversario(f);
    abrirModalUniversal(`Editar Evento #${id}`, conteudo, () => salvarDadosFestaAniversario(true, id));
    await preencherSelectVendedoresModal(f.id_vendedor);
}

async function preencherSelectVendedoresModal(selecionadoId) {
    const sel = document.getElementById('faVendedor');
    if (!sel) return;
    try {
        const res = await fetchAdmin(`${API_URL}/admin/festas-aniversario/vendedores`);
        const vendedores = await res.json();
        sel.innerHTML = `<option value="">Selecione</option>`;
        vendedores.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id_colaborador;
            opt.textContent = v.nome_completo;
            if (selecionadoId && Number(selecionadoId) === Number(v.id_colaborador)) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { sel.innerHTML = `<option value="">Erro</option>`; }
}

async function salvarDadosFestaAniversario(isEdit, id = null) {
    const btn = document.getElementById('modalConfirmBtn');
    const original = btn?.innerText;
    if (btn) { btn.disabled = true; btn.innerText = 'SALVANDO...'; }

    const payload = {
        tipo: "ANIVERSARIO_GAMER",
        status: document.getElementById('faStatus')?.value || 'PARA_ACONTECER',
        data_festa: document.getElementById('faDataFesta')?.value || null,
        horario: document.getElementById('faHorario')?.value || null,
        contratante: document.getElementById('faContratante')?.value || null,
        telefone: document.getElementById('faTelefone')?.value || null,
        aniversariante: document.getElementById('faAniversariante')?.value || null,
        idade: document.getElementById('faIdade')?.value ? parseInt(document.getElementById('faIdade').value) : null,
        data_pagamento: document.getElementById('faDataPgto')?.value || null,
        valor: document.getElementById('faValor')?.value ? parseFloat(document.getElementById('faValor').value) : null,
        kit_festa: document.getElementById('faKit')?.value === '' ? null : (document.getElementById('faKit').value === 'true'),
        id_vendedor: document.getElementById('faVendedor')?.value ? parseInt(document.getElementById('faVendedor').value) : null,
        observacoes: document.getElementById('faObs')?.value || null,
        id_unidade: 1 // Default Cuiabá
    };

    try {
        const url = isEdit ? `${API_URL}/admin/festas-aniversario/${id}` : `${API_URL}/admin/festas-aniversario`;
        const res = await fetchAdmin(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res) return;
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Falha ao salvar evento.');
        }

        Swal.fire({ icon: 'success', title: 'Salvo!', text: 'Evento registrado com sucesso.', timer: 1400, showConfirmButton: false, background: '#222', color: '#fff' });
        fecharModalUniversal();
        carregarFestasAniversario();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: e.message || 'Erro de conexão.', background: '#222', color: '#fff' });
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = original || 'SALVAR'; }
    }
}