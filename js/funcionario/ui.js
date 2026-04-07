// ==========================================
// js/funcionario/ui.js
// ==========================================
import { carregarDashboard, carregarDashboardFrequenciaCompleto } from './dashboard.js';

// --- MENU LATERAL (MOBILE) ---
export function toggleSidebar() {
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

// Oculta o menu mobile ao clicar em um item
document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
        if(window.innerWidth < 768) { toggleSidebar(); }
    });
});

/**
 * Controla a navegação entre abas e dispara o carregamento de dados específicos
 * @param {string} tabId - O ID da div de conteúdo a ser exibida
 */
export async function showTab(tabId) {
    const targetTab = document.getElementById(tabId);
    if (!targetTab) return;

    // 1. Esconde todas as abas de conteúdo (.tab-content)
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // 2. Mostra a aba selecionada
    targetTab.classList.remove('hidden');

    // 3. Atualiza o estado visual do menu lateral (sidebar)
    document.querySelectorAll('.sidebar-item').forEach(el => {
        el.classList.remove('active', 'bg-white/5', 'text-[#00FFFF]');
    });

    // 4. Ativa o link correspondente no menu lateral
    const menuLink = document.getElementById('menu-' + tabId);
    if (menuLink) {
        menuLink.classList.add('active');
        menuLink.classList.add('text-[#00FFFF]');
    }

    // ============================================================
    // ROTEAMENTO: DISPARO DE CARGAS DE DADOS E LÓGICA POR ABA
    // ============================================================

    // Dashboard Geral (Performance e Frequência)
    if (tabId === 'dashboard') {
        carregarDashboard();    
    }

    // Módulo de Extensão: Sprints Pedagógicas
    if (tabId === 'coordenacao-sprints') {
        if (window.initSprintDashboard) window.initSprintDashboard();
    }

    // Matrículas (Reset do fluxo para a etapa 1)
    if (tabId === 'matricula') {
        if (window.mudarSubAba) {
            window.mudarSubAba('mat-identificacao');
        }
    }

    // Reposições
    if (tabId === 'reposicao') {
        await carregarDadosAbaReposicao();
    }

    // Novo usuario
    if (tabId === 'novo-usuario') {
        if (window.carregarAlunosParaNovoUsuario) {
            window.carregarAlunosParaNovoUsuario();
        }
    }

    // Aniversário Gamer
    if (tabId === 'aniversario') {
        if (window.renderCalendarAniversario) {
            window.renderCalendarAniversario(); 
        }
    }

    // Chamadas de API para tabelas e selects
    if (tabId === 'cadastro' && window.carregarOpcoesTurmas) window.carregarOpcoesTurmas();
    if (tabId === 'inscricoes' && window.carregarInscricoes) window.carregarInscricoes();
    if (tabId === 'alunos' && window.carregarAlunos) window.carregarAlunos();
    if (tabId === 'aulas-experimentais' && window.carregarAulasExperimentais) window.carregarAulasExperimentais();
    if (tabId === 'atendimento' && window.atualizarListaChat) window.atualizarListaChat();
    if (tabId === 'turmas' && window.carregarListaTurmas) window.carregarListaTurmas();
    if (tabId === 'chamada' && window.carregarTurmasParaChamada) window.carregarTurmasParaChamada();
    
    // Gestão de Equipe
    if (tabId === 'equipe') { 
        if (window.carregarCargosSelect) window.carregarCargosSelect(); 
        if (window.carregarListaEquipe) window.carregarListaEquipe(); 
    }

    // 5. Fecha sidebar no Mobile após clicar
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            toggleSidebar();
        }
    }

    // 6. Aplica máscaras e reseta scroll para o topo
    setTimeout(() => {
        if (window.aplicarMascaras) window.aplicarMascaras();
    }, 150);

    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.scrollTop = 0;
}

/**
 * Helper para carregar a aba de reposição de forma assíncrona
 */
async function carregarDadosAbaReposicao() {
    try {
        if (window.carregarSelectAlunos) await window.carregarSelectAlunos();
        if (window.carregarSelectProfessores) await window.carregarSelectProfessores();
        if (window.carregarSelectRepTurma) await window.carregarSelectRepTurma();
        if (window.carregarReposicoes) await window.carregarReposicoes();
        if (window.renderCalendar) window.renderCalendar();
    } catch (err) { 
        console.error("Erro ao carregar dados de reposição:", err); 
    }
}

// --- MODAL UNIVERSAL ---
export function abrirModalUniversal(title, contentHTML, onConfirm) {
    const modal = document.getElementById('modalUniversal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    
    if (!modal) return;

    modalTitle.innerText = title || 'Aviso';
    modalBody.innerHTML = contentHTML || '';

    modalConfirmBtn.onclick = null;
    if (typeof onConfirm === 'function') {
        modalConfirmBtn.onclick = async () => {
            try { 
                await onConfirm(); 
            } catch (err) { 
                console.error("Erro na confirmação do modal:", err); 
            }
        };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function fecharModalUniversal() {
    const modal = document.getElementById('modalUniversal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// --- MÁSCARAS DE INPUT (IMask) ---
export function aplicarMascaras() {
    const elementos = [
        { id: 'matRespCpf', mask: '000.000.000-00' },
        { id: 'matRespCelular', mask: '(00) 00000-0000' },
        { id: 'matRespCep', mask: '00000-000' },
        { id: 'matAlunoCpf', mask: '000.000.000-00' },
        { id: 'matAlunoCelular', mask: '(00) 00000-0000' },
        { id: 'matAlunoCep', mask: '00000-000' },
        { id: 'matCep', mask: '00000-000' },
        { id: 'cadCpf', mask: '000.000.000-00' },
        { id: 'cadCelular', mask: '(00) 00000-0000' },
        { id: 'perfTel', mask: '(00) 00000-0000' },
        { id: 'aniTelefone', mask: '(00) 00000-0000' },
        { id: 'eqTelefone', mask: '(00) 00000-0000' }
    ];

    elementos.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            if (el.mask) el.mask.destroy(); 
            el.mask = IMask(el, { mask: item.mask });
        }
    });
}

// --- FILTRO GENÉRICO PARA TABELAS ---
export function filtrarTabelaGeneric(inputId, bodyId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const termo = input.value.toLowerCase();
    const linhas = document.querySelectorAll(`#${bodyId} tr`);

    linhas.forEach(linha => {
        const textoLinha = linha.innerText.toLowerCase();
        linha.style.display = textoLinha.includes(termo) ? "" : "none";
    });
}

/**
 * Atualiza os elementos de texto do portal com os dados reais do colaborador
 */
export function atualizarInterfaceUsuario(usuario) {
    if (!usuario) return;

    const nomeEl = document.getElementById('nome-usuario-logado');
    const cargoEl = document.getElementById('email-usuario-logado'); // Na sua estrutura, este ID é usado para o cargo/email
    const labelCargoTop = document.getElementById('label-cargo');

    if (nomeEl) nomeEl.innerText = usuario.nome || "Usuário";
    
    // Formata o cargo baseado no nível (ex: Nível 8 = Diretor)
    const cargoTexto = usuario.nivel >= 8 ? "Diretor" : (usuario.nivel >= 4 ? "Coordenador" : "Professor");
    
    if (cargoEl) cargoEl.innerText = cargoTexto;
    if (labelCargoTop) labelCargoTop.innerText = cargoTexto.toUpperCase();
}