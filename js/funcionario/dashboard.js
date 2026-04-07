// ==========================================
// js/funcionario/dashboard.js
// ==========================================
import { API_URL, fetchAdmin } from './config.js';

// Registra o plugin de DataLabels globalmente (carregado via CDN no HTML)
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// Variáveis para guardar as instâncias dos gráficos e evitar o bug de "sobreposição" (hover piscando)
let chartCursos = null;
let meuChartFrequencia = null;
let chartsFrequenciaDetalhada = {};
let chartSprints = null;

/**
 * FUNÇÃO COMPLETA: Carrega todos os dados do Dashboard (Geral + Sprints)
 * Implementada com resiliência para falhas de API e limpeza de memória de gráficos.
 */
export async function carregarDashboard() {
    try {
        console.log("📊 Iniciando sincronização do Dashboard...");

        // ---------------------------------------------------------
        // 1. BUSCA ESTATÍSTICAS GERAIS (Alunos, Leads, Turmas)
        // ---------------------------------------------------------
        try {
            const res = await fetchAdmin(`${API_URL}/admin/dashboard-stats`);
            if (res && res.ok) {
                const dados = await res.json();
                
                const atualizarElemento = (id, valor) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = valor ?? 0;
                };

                if (dados.escola) {
                    atualizarElemento('dash-total-alunos', dados.escola.total_alunos);
                    atualizarElemento('dash-turmas-ativas', dados.escola.turmas_ativas);
                    // Caso tenha o elemento de aulas hoje no HTML
                    atualizarElemento('dash-aulas-hoje', dados.escola.aulas_hoje || '--');
                }
                if (dados.leads) {
                    atualizarElemento('dash-total-leads', dados.leads.total);
                    atualizarElemento('dash-conversao-leads', `${dados.leads.conversao}%`);
                }
                if (dados.reposicoes !== undefined) {
                    atualizarElemento('dash-saldo-reposicoes', dados.reposicoes);
                }
            }
        } catch (errGeral) {
            console.error("❌ Erro ao carregar estatísticas da escola:", errGeral);
        }

        // ---------------------------------------------------------
        // 2. BUSCA MÉTRICAS DAS SPRINTS PEDAGÓGICAS (DoD)
        // ---------------------------------------------------------
        try {
            const resSprints = await fetchAdmin(`${API_URL}/admin/sprints-pedagogicas/estatisticas/geral`);
            if (resSprints && resSprints.ok) {
                const stats = await resSprints.json();

                // Atualiza os cards de Sprints
                const scoreEl = document.getElementById('dash-sprint-score');
                const totalEl = document.getElementById('dash-sprint-total');
                
                if (scoreEl) scoreEl.innerText = `${Math.round(stats.media_conformidade || 0)}%`;
                if (totalEl) totalEl.innerText = stats.total_sprints || 0;

                // Renderiza o Gráfico de Performance por Professor
                const ctxSprints = document.getElementById('chartSprintProfessores');
                if (ctxSprints) {
                    // Destruir instância anterior para evitar bugs de hover/renderização
                    if (chartSprints) chartSprints.destroy();

                    const labelsProf = Object.keys(stats.por_professor || {});
                    const dataScore = labelsProf.map(p => 
                        (stats.por_professor[p].soma_score / stats.por_professor[p].sprints).toFixed(1)
                    );

                    chartSprints = new Chart(ctxSprints.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: labelsProf,
                            datasets: [{
                                label: 'Índice DoD',
                                data: dataScore,
                                backgroundColor: '#00FFFF',
                                borderRadius: 6,
                                barThickness: 18
                            }]
                        },
                        options: {
                            indexAxis: 'y', // Gráfico horizontal (melhor para ler nomes)
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { 
                                legend: { display: false },
                                datalabels: {
                                    color: '#fff',
                                    anchor: 'end',
                                    align: 'right',
                                    offset: 8,
                                    font: { size: 10, weight: '900' },
                                    formatter: (value) => `${value}%`
                                }
                            },
                            scales: {
                                x: { max: 115, display: false }, // Margem extra para o texto não cortar
                                y: { 
                                    grid: { display: false },
                                    ticks: { color: '#aaa', font: { size: 11, weight: 'bold' } }
                                }
                            }
                        }
                    });
                }
            } else {
                console.warn("📊 Estatísticas de Sprints ainda não processadas pelo servidor.");
                // Opcional: zerar os campos se a API falhar
                document.getElementById('dash-sprint-score').innerText = '0%';
                document.getElementById('dash-sprint-total').innerText = '0';
            }
        } catch (errSprints) {
            // Se der erro 500, ele cai aqui e NÃO TRAVA o resto do dashboard
            console.error("Métricas pedagógicas indisponíveis:", errSprints);
        }

        // ---------------------------------------------------------
        // 3. CARREGA OS GRÁFICOS DE FREQUÊNCIA (Linhas e Pizza)
        // ---------------------------------------------------------
        await carregarDashboardFrequenciaCompleto();

        console.log("✅ Dashboard atualizado com sucesso!");

    } catch (error) {
        console.error("❌ Falha crítica no processamento do Dashboard:", error);
    }
}

function renderizarGraficoCursos(dadosCursos) {
    const ctx = document.getElementById('graficoCursos')?.getContext('2d');
    if (!ctx) return;

    if (chartCursos) chartCursos.destroy();
    
    chartCursos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dadosCursos),
            datasets: [{ 
                label: 'Turmas', 
                data: Object.values(dadosCursos), 
                backgroundColor: '#00FFFF', 
                borderRadius: 4 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } } 
        }
    });
}

export async function carregarDashboardFrequenciaCompleto() {
    const dataInicio = document.getElementById('filtro-data-inicio')?.value;
    const dataFim = document.getElementById('filtro-data-fim')?.value;

    let url = `${API_URL}/admin/dashboard-frequencia-unificado?`;
    if (dataInicio) url += `data_inicio=${dataInicio}&`;
    if (dataFim) url += `data_fim=${dataFim}`;

    try {
        const res = await fetchAdmin(url);
        if (!res || !res.ok) return;
        const dados = await res.json();

        const g = dados.global;
        const totalEventos = (g.presencas || 0) + (g.faltas || 0) + (g.reposicoes || 0);
        
        if (document.getElementById('dash-assiduidade')) {
            document.getElementById('dash-assiduidade').innerText = `${g.assiduidade}%`;
        }
        if (document.getElementById('barra-assiduidade')) {
            document.getElementById('barra-assiduidade').style.width = `${g.assiduidade}%`;
        }

        // Gráfico Central Doughnut
        const ctxGeral = document.getElementById('chartFrequencia')?.getContext('2d');
        if (ctxGeral) {
            if (meuChartFrequencia) meuChartFrequencia.destroy();
            meuChartFrequencia = new Chart(ctxGeral, {
                type: 'doughnut',
                data: {
                    labels: ['Presenças', 'Faltas', 'Reposições'],
                    datasets: [{
                        data: [g.presencas, g.faltas, g.reposicoes],
                        backgroundColor: ['#00FF88', '#FF3131', '#00DDEE'],
                        borderColor: '#111', borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'bottom', labels: { color: '#fff', font: { size: 10 } } },
                        datalabels: {
                            color: '#000', font: { weight: 'bold', size: 10 },
                            formatter: (val) => val > 0 ? `${val}\n(${((val/totalEventos)*100).toFixed(1)}%)` : ''
                        }
                    },
                    cutout: '70%'
                }
            });
        }

        // Gráfico Mensal
        const ctxMes = document.getElementById('chartFrequenciaMes')?.getContext('2d');
        if (ctxMes && dados.por_mes) {
            const meses = Object.keys(dados.por_mes).sort();
            if (chartsFrequenciaDetalhada.mes) chartsFrequenciaDetalhada.mes.destroy();
            chartsFrequenciaDetalhada.mes = new Chart(ctxMes, {
                type: 'line',
                data: {
                    labels: meses,
                    datasets: [
                        { label: 'Presenças', data: meses.map(m => dados.por_mes[m].P), borderColor: '#00FF88', backgroundColor: '#00FF8822', fill: true, tension: 0.3 },
                        { label: 'Reposições', data: meses.map(m => dados.por_mes[m].R || 0), borderColor: '#00DDEE', backgroundColor: '#00DDEE22', fill: true, tension: 0.3 },
                        { label: 'Faltas', data: meses.map(m => dados.por_mes[m].F), borderColor: '#FF3131', backgroundColor: '#FF313122', fill: true, tension: 0.3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#888' } }, datalabels: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#666' } },
                        x: { grid: { display: false }, ticks: { color: '#666' } }
                    }
                }
            });
        }

        // Helper para gráficos em barra (Turma, Curso, Prof)
        const renderStackedBar = (id, key, chartKey) => {
            if (!dados[key]) return;
            const labels = Object.keys(dados[key]);
            const ctx = document.getElementById(id)?.getContext('2d');
            if (ctx) {
                if (chartsFrequenciaDetalhada[chartKey]) chartsFrequenciaDetalhada[chartKey].destroy();
                chartsFrequenciaDetalhada[chartKey] = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [
                            { label: 'Presenças', data: labels.map(l => dados[key][l].P), backgroundColor: '#00FF88' },
                            { label: 'Faltas', data: labels.map(l => dados[key][l].F), backgroundColor: '#FF3131' },
                            { label: 'Reposições', data: labels.map(l => dados[key][l].R || 0), backgroundColor: '#00DDEE' }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                        plugins: {
                            legend: { display: false },
                            datalabels: {
                                color: '#000', font: { weight: 'bold', size: 9 },
                                formatter: (val, context) => {
                                    if (val === 0) return '';
                                    let tLocal = 0;
                                    context.chart.data.datasets.forEach(d => tLocal += d.data[context.dataIndex]);
                                    return `${val}\n(${((val/tLocal)*100).toFixed(0)}%)`;
                                }
                            }
                        }
                    }
                });
            }
        };

        renderStackedBar('chartFrequenciaTurma', 'por_turma', 'turma');
        renderStackedBar('chartFrequenciaCurso', 'por_curso', 'curso');
        renderStackedBar('chartFrequenciaProfessor', 'por_professor', 'professor');

        // Tabela Alunos Críticos
        const tbody = document.getElementById('lista-alunos-criticos');
        if (tbody && dados.alunos_criticos) {
            tbody.innerHTML = dados.alunos_criticos.map(a => `
                <tr class="border-b border-[#333] hover:bg-white/[0.02] transition-colors">
                    <td class="p-3 text-white font-bold text-xs uppercase">${a.nome}</td>
                    <td class="p-3 text-gray-400 text-xs font-mono">${a.turma}</td>
                    <td class="p-3 text-center">
                        <span class="bg-red-900/20 text-red-400 px-2 py-1 rounded border border-red-800/30 font-black text-[10px]">
                            ${a.faltas} FALTAS
                        </span>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="3" class="p-4 text-center text-gray-600">Nenhum alerta crítico.</td></tr>';
        }

    } catch (e) { 
        console.error("Erro crítico na renderização do dashboard:", e); 
    }
}