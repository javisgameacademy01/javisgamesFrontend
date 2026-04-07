// ==========================================
// js/frequencia.js - GESTÃO DE MAPA PEDAGÓGICO
// ==========================================
import { API_URL, fetchAdmin } from './config.js';

/**
 * Preenche o select de turmas na aba de frequência
 */
export async function popularSelectTurmasFrequencia() {
    const select = document.getElementById('select-turma-frequencia');
    if (!select || select.options.length > 1) return;

    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-turmas`);
        if (!res) return;
        const turmas = await res.json();
        
        turmas.forEach(t => {
            const opt = new Option(`${t.codigo_turma} - ${t.nome_curso}`, t.codigo_turma);
            select.add(opt);
        });
    } catch (e) { 
        console.error("Erro ao popular select de frequências:", e); 
    }
}

/**
 * Função principal que coordena a montagem do mapa
 */
export async function carregarMapaFrequencia() {
    const codTurma = document.getElementById('select-turma-frequencia').value;
    const body = document.getElementById('corpo-frequencia');
    if (!codTurma || !body) return;

    // Feedback visual de carregamento
    body.innerHTML = '<tr><td colspan="100%" class="p-10 text-center text-gray-500 italic"><i class="fas fa-spinner fa-spin mr-2"></i>Sincronizando dados pedagógicos...</td></tr>';

    try {
        // 1. Busca dados da Turma (para saber qual o curso dela)
        const resTurmas = await fetchAdmin(`${API_URL}/admin/gerenciar-turmas`);
        const turmas = await resTurmas.json();
        const dadosTurma = turmas.find(t => t.codigo_turma === codTurma);

        if (!dadosTurma) throw new Error("Turma não localizada no sistema.");

        // 2. Busca a estrutura de Módulos e Aulas (Conteúdo Didático)
        const resCursos = await fetchAdmin(`${API_URL}/admin/conteudo-didatico/cursos`);
        const cursos = await resCursos.json();
        
        console.log("DEBUG: Lista de cursos da API:", cursos);
        console.log("DEBUG: Curso da turma selecionada:", dadosTurma.nome_curso);

        // BUSCA ROBUSTA: Compara ignorando espaços e cases (GAME PRO === game pro)
        const cursoDados = cursos.find(c => 
            c.titulo.trim().toUpperCase() === dadosTurma.nome_curso.trim().toUpperCase()
        );

        if (!cursoDados || !cursoDados.modulos || cursoDados.modulos.length === 0) {
            body.innerHTML = `
                <tr>
                    <td colspan="100%" class="p-10 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle mb-2 text-2xl block"></i>
                        <span class="font-bold">Módulos não configurados.</span><br>
                        O curso "${dadosTurma.nome_curso}" não possui estrutura de aulas cadastrada no banco.
                    </td>
                </tr>`;
            return;
        }

        // 3. Busca os eventos de presença (P, F, R) desta turma
        const resFreq = await fetchAdmin(`${API_URL}/admin/relatorio-frequencia-geral?q=${codTurma}`);
        const eventos = await resFreq.json();

        // 4. Renderiza o cabeçalho (Módulos e números de aula)
        renderizarCabecalhoMapa(cursoDados.modulos);

        // 5. Renderiza as linhas dos alunos
        renderizarCorpoMapa(eventos, cursoDados.modulos);

    } catch (e) {
        console.error("Erro fatal no mapa de frequência:", e);
        body.innerHTML = '<tr><td colspan="100%" class="p-10 text-center text-red-500">Erro técnico ao carregar mapa. Verifique o console (F12).</td></tr>';
    }
}

/**
 * Monta as colunas da tabela dinamicamente
 */
function renderizarCabecalhoMapa(modulos) {
    const trModulos = document.getElementById('header-modulos');
    const trAulas = document.getElementById('header-aulas');
    if (!trModulos || !trAulas) return;
    
    // Reset do header (Mantém as colunas fixas ID e Aluno)
    trModulos.innerHTML = '<th rowspan="2" class="p-4 border-r border-[#222] text-[#00FFFF] w-16">ID</th><th rowspan="2" class="p-4 border-r border-[#222] text-[#00FFFF] min-w-[200px]">Aluno</th>';
    trAulas.innerHTML = '';

    modulos.forEach(mod => {
        const qtdAulas = mod.aulas ? mod.aulas.length : 0;
        if (qtdAulas > 0) {
            // Coluna do Módulo (Agrupadora)
            const thMod = document.createElement('th');
            thMod.className = 'p-2 text-center border-b border-r border-[#222] bg-[#161616] text-gray-300 text-[10px] uppercase font-black';
            thMod.colSpan = qtdAulas;
            // Limpa emojis e prefixos do título do módulo para caber na tela
            thMod.innerText = mod.titulo.replace(/[0-9]️⃣|Módulo — |🕹️|🟢|🐍|🤖|🚀|💎|🎮/g, '').trim(); 
            trModulos.appendChild(thMod);

            // Sub-colunas com o número de cada aula
            mod.aulas.forEach((_, idx) => {
                const thAula = document.createElement('th');
                thAula.className = 'p-2 text-center border-r border-[#222] text-[9px] text-gray-500 font-bold w-8';
                thAula.innerText = idx + 1;
                trAulas.appendChild(thAula);
            });
        }
    });

    // Coluna final de Porcentagem
    const thFreq = document.createElement('th');
    thFreq.rowSpan = 2;
    thFreq.className = 'p-4 text-center text-[#00FFFF] w-16';
    thFreq.innerText = '%';
    trModulos.appendChild(thFreq);
}

/**
 * Preenche a tabela com os nomes e os status (P, F, R)
 */
function renderizarCorpoMapa(eventos, modulos) {
    const tbody = document.getElementById('corpo-frequencia');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Agrupa os eventos por aluno: { id: { nome: 'Marcos', aulas: { 1: 'P', 2: 'F' } } }
    const mapaAlunos = {};
    eventos.forEach(ev => {
        const id = ev.id_aluno;
        if (!id) return; // Pula se o ID for nulo
        if (!mapaAlunos[id]) mapaAlunos[id] = { nome: ev.nome_aluno || ev.nome, aulas: {} };
        mapaAlunos[id].aulas[ev.numero_aula] = ev.status;
    });

    const listaIds = Object.keys(mapaAlunos);
    
    if (listaIds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="p-10 text-center text-gray-600">Nenhum registro de frequência encontrado para esta turma.</td></tr>';
        return;
    }

    listaIds.forEach(id => {
        const aluno = mapaAlunos[id];
        let totalP = 0, totalValid = 0;
        
        let html = `
            <tr class="hover:bg-white/[0.02] border-b border-[#1a1a1a] transition-colors">
                <td class="p-3 border-r border-[#222] text-gray-600 font-mono text-[10px]">${id}</td>
                <td class="p-3 border-r border-[#222] font-bold text-white whitespace-nowrap text-xs uppercase">${aluno.nome}</td>`;

        let contadorAulaGlobal = 1;
        modulos.forEach(mod => {
            mod.aulas.forEach(() => {
                const status = aluno.aulas[contadorAulaGlobal] || '-';
                let css = 'text-gray-800'; // Cor para aula não lançada (-)
                
                if (status === 'P') { 
                    css = 'text-blue-400 bg-blue-500/5 font-bold'; 
                    totalP++; totalValid++; 
                } else if (status === 'F') { 
                    css = 'text-red-500 bg-red-500/10 font-black'; 
                    totalValid++; 
                } else if (status === 'R') { 
                    css = 'text-cyan-400 bg-cyan-500/10 font-bold'; 
                    totalP++; totalValid++; 
                }

                html += `<td class="p-2 text-center border-r border-[#1a1a1a] text-[10px] ${css}">${status}</td>`;
                contadorAulaGlobal++;
            });
        });

        // Cálculo da porcentagem de assiduidade
        const porcentagem = totalValid > 0 ? ((totalP / totalValid) * 100).toFixed(0) : 0;
        const corPorc = porcentagem < 75 ? 'text-red-500' : 'text-green-400';

        html += `<td class="p-3 text-center font-bold ${corPorc} border-l border-[#222] bg-[#0c0c0c]">${porcentagem}%</td></tr>`;
        tbody.innerHTML += html;
    });
}