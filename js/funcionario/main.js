// ============================================================================
// js/funcionario/main.js (ORQUESTRADOR PRINCIPAL DO PORTAL)
// ============================================================================

// 1. Configurações e UI
import { verificarPermissoes, logout } from './config.js';
import { toggleSidebar, showTab, abrirModalUniversal, fecharModalUniversal, filtrarTabelaGeneric, aplicarMascaras } from './ui.js';
import { carregarDashboard, carregarDashboardFrequenciaCompleto } from './dashboard.js';

// 2. Aniversário Gamer
import { 
    renderCalendarAniversario, 
    carregarFestasAniversario, 
    carregarTabelaAniversarios, 
    debounceCarregarFestasAniversario, 
    limparPeriodoFesta,
    toggleSortFestas,
    agendarAniversario,
    abrirModalAgendarAniversario, 
    fecharModalAgendarAniversario,
    excluirFestaAniversario,
    finalizarFestaAniversario,
    abrirModalEditarAniversario
} from './aniversario.js';

// 3. Acadêmico e Frequência
import { 
    carregarListaTurmas, abrirModalNovaTurma, prepararEdicaoTurma,
    carregarTurmasParaChamada, liberarUploadChamada, enviarChamadaComFoto, imprimirModeloChamada
} from './academico.js';
import { 
    popularSelectTurmasFrequencia, carregarMapaFrequencia 
} from './frequencia.js';

// 4. CRM (Leads e Experimentais)
import {
    carregarInscricoes, atualizarStatusLead,
    carregarAulasExperimentais, abrirModalAulaExp, fecharModalAulaExp,
    salvarAulaExp, excluirAulaExp, ordenarAulasExp, filtrarAulasExpLocal,
    limparFiltrosAulasExp, escutarBuscaAulasExp
} from './crm.js';

// 5. Agenda e Reposições
import {
    renderCalendar, carregarReposicoes, ordenarTabelaReposicoes,
    abrirModalAgendarReposicao, fecharModalAgendarReposicao, agendarReposicao,
    abrirModalRepo, deletarReposicao, salvarEdicaoRepo,
    abrirModalConcluirReposicao, enviarBaixaReposicao, carregarSelectRepTurma, 
    carregarSelectProfessores, carregarSelectAlunos, autoSelecionarProfessor
} from './agenda.js';

// 6. Equipe, Alunos e Perfis
import {
    carregarAlunos, cadastrarAluno, carregarOpcoesTurmas, abrirModalEditarAluno, salvarEdicaoAluno,
    carregarListaEquipe, abrirModalColaborador, carregarCargosSelect
} from './equipe.js';

import { carregarAlunosParaNovoUsuario, enviarCriacaoLoginAluno } from './novo-usuario.js';

// 7. Chat e Comunicação
import {
    mudarAbaChat, atualizarListaChat, handleSearchInputChat,
    abrirChatPrivado, abrirChatGrupo, enviarMensagemUnified
} from './chat.js';

// 8. Matrículas
import { 
    mudarSubAba, navegarMatricula, calcularFinanceiroMatricula, copiarDadosResponsavel,
    verificarParentescoProprio, abrirModalMatricula, fecharModalMatricula,
    copiarEnderecoResponsavel, gerarContrato, buscarCep, adicionarCampoTelefone,
    carregarVendedores, atualizarInfoCurso, carregarTurmasPorCurso, carregarDadosIniciaisMatricula
} from './matricula.js';

// 9. Coordenação Ágil (Sprints Pedagógicas)
import { 
    initSprintDashboard, 
    saveSprintDataToAPI 
} from './sprints.js';

import './gestao-aulas.js';

// ============================================================================
// EXPONDO FUNÇÕES PARA O WINDOW (Necessário para o onclick do HTML)
// ============================================================================

// Dashboard e UI
window.carregarDashboard = carregarDashboard; // <--- ADICIONADO (Essencial para o showTab)
window.carregarDashboardFrequenciaCompleto = carregarDashboardFrequenciaCompleto;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.showTab = showTab;
window.abrirModalUniversal = abrirModalUniversal;
window.fecharModalUniversal = fecharModalUniversal;
window.filtrarTabelaGeneric = filtrarTabelaGeneric;
window.aplicarMascaras = aplicarMascaras;

// Acadêmico & Sprints
window.initSprintDashboard = initSprintDashboard;
window.saveSprintDataToAPI = saveSprintDataToAPI;
window.carregarListaTurmas = carregarListaTurmas;
window.abrirModalNovaTurma = abrirModalNovaTurma;
window.prepararEdicaoTurma = prepararEdicaoTurma;
window.carregarTurmasParaChamada = carregarTurmasParaChamada;
window.liberarUploadChamada = liberarUploadChamada;
window.enviarChamadaComFoto = enviarChamadaComFoto;
window.imprimirModeloChamada = imprimirModeloChamada;
window.popularSelectTurmasFrequencia = popularSelectTurmasFrequencia;
window.carregarMapaFrequencia = carregarMapaFrequencia;

// Matrículas
window.abrirModalMatricula = abrirModalMatricula;
window.fecharModalMatricula = fecharModalMatricula;
window.mudarSubAba = mudarSubAba;
window.navegarMatricula = navegarMatricula;
window.calcularFinanceiroMatricula = calcularFinanceiroMatricula;
window.copiarDadosResponsavel = copiarDadosResponsavel;
window.verificarParentescoProprio = verificarParentescoProprio;
window.copiarEnderecoResponsavel = copiarEnderecoResponsavel;
window.gerarContrato = gerarContrato;
window.buscarCep = buscarCep;
window.adicionarCampoTelefone = adicionarCampoTelefone;
window.carregarVendedores = carregarVendedores;
window.atualizarInfoCurso = atualizarInfoCurso;
window.carregarTurmasPorCurso = carregarTurmasPorCurso;
window.carregarDadosIniciaisMatricula = carregarDadosIniciaisMatricula;

// CRM e Agenda
window.carregarInscricoes = carregarInscricoes;
window.atualizarStatusLead = atualizarStatusLead;
window.carregarAulasExperimentais = carregarAulasExperimentais;
window.abrirModalAulaExp = abrirModalAulaExp;
window.fecharModalAulaExp = fecharModalAulaExp;
window.salvarAulaExp = salvarAulaExp;
window.excluirAulaExp = excluirAulaExp;
window.ordenarAulasExp = ordenarAulasExp;
window.filtrarAulasExpLocal = filtrarAulasExpLocal;
window.limparFiltrosAulasExp = limparFiltrosAulasExp;
window.renderCalendar = renderCalendar;
window.carregarReposicoes = carregarReposicoes;
window.ordenarTabelaReposicoes = ordenarTabelaReposicoes;
window.abrirModalAgendarReposicao = abrirModalAgendarReposicao;
window.fecharModalAgendarReposicao = fecharModalAgendarReposicao;
window.agendarReposicao = agendarReposicao; 
window.abrirModalRepo = abrirModalRepo;
window.deletarReposicao = deletarReposicao;
window.salvarEdicaoRepo = salvarEdicaoRepo; 
window.abrirModalConcluirReposicao = abrirModalConcluirReposicao;
window.enviarBaixaReposicao = enviarBaixaReposicao;
window.carregarSelectRepTurma = carregarSelectRepTurma;
window.carregarSelectProfessores = carregarSelectProfessores;
window.carregarSelectAlunos = carregarSelectAlunos;
window.autoSelecionarProfessor = autoSelecionarProfessor;

// Equipe & Chat & Eventos
window.carregarAlunos = carregarAlunos;
window.cadastrarAluno = cadastrarAluno; 
window.carregarOpcoesTurmas = carregarOpcoesTurmas;
window.abrirModalEditarAluno = abrirModalEditarAluno;
window.salvarEdicaoAluno = salvarEdicaoAluno; 
window.carregarListaEquipe = carregarListaEquipe;
window.abrirModalColaborador = abrirModalColaborador; 
window.carregarCargosSelect = carregarCargosSelect;
window.carregarAlunosParaNovoUsuario = carregarAlunosParaNovoUsuario;
window.enviarCriacaoLoginAluno = enviarCriacaoLoginAluno;
window.excluirFestaAniversario = excluirFestaAniversario;
window.finalizarFestaAniversario = finalizarFestaAniversario;
window.abrirModalEditarAniversario = abrirModalEditarAniversario;
window.renderCalendarAniversario = renderCalendarAniversario;
window.carregarTabelaAniversarios = carregarTabelaAniversarios;
window.abrirModalAgendarAniversario = abrirModalAgendarAniversario;
window.agendarAniversario = agendarAniversario;
window.fecharModalAgendarAniversario = fecharModalAgendarAniversario;
window.carregarFestasAniversario = carregarFestasAniversario;
window.limparPeriodoFesta = limparPeriodoFesta;
window.debounceCarregarFestasAniversario = debounceCarregarFestasAniversario;
window.toggleSortFestas = toggleSortFestas;
window.mudarAbaChat = mudarAbaChat;
window.atualizarListaChat = atualizarListaChat;
window.handleSearchInputChat = handleSearchInputChat;
window.abrirChatPrivado = abrirChatPrivado;
window.abrirChatGrupo = abrirChatGrupo;
window.enviarMensagemUnified = enviarMensagemUnified;

// ============================================================================
// INICIALIZAÇÃO DO PORTAL (Ajustada para Carga Automática)
// ============================================================================

// Localize o final do seu arquivo main.js e substitua a função inicializarPortal
async function inicializarPortal() {
        console.log("🛠️ Iniciando validação de segurança...");
            // Forçamos a exibição da aba e a carga dos dados IMEDIATAMENTE
            await showTab('dashboard'); 
            // Carregamos os dados sem travar o código (usando catch para ignorar o erro 500 por enquanto)
            carregarDashboard().catch(e => console.error("Aguardando backend responder...", e));

        console.log("🚀 Portal Javis sincronizado!");
}
inicializarPortal()
