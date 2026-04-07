/**
 * Módulo de Coordenação Ágil - Javis Games Academy
 * Responsável: Maxxuel Campos (Coordenador Pedagógico)
 */
import { fetchAdmin, API_URL } from './config.js';

const JAVIS_COORDS = { lat: -15.5861, lng: -56.0714 }; // Av. Historiador Rubens de Mendonça, 1593
const RAIO_MAXIMO_METROS = 1500;

const turmasJavis = [
    { id: '3004', prof: 'Breno', info: '3004 Terça - Game Pro' },
    { id: '4003', prof: 'Breno', info: '4003 Quarta - Game Pro' },
    { id: '7001.1', prof: 'Breno', info: '7001.1 Sábado - Game Pro (M)' },
    { id: '7003.1', prof: 'Breno', info: '7003.1 Sábado - Game Dev (M)' },
    { id: '7003-1', prof: 'Breno', info: '7003-1 Sábado - Game Pro (T)' },
    { id: '6003', prof: 'Felipe', info: '6003 Sexta - Design Start' },
    { id: '7002.1', prof: 'Felipe', info: '7002.1 Sábado - Design Start' }
];

// Inicialização das abas no Dashboard
export function initSprintDashboard() {
    const tabContainer = document.getElementById('sprint-tabs');
    if (!tabContainer) return;
    
    tabContainer.innerHTML = '';
    turmasJavis.forEach(t => {
        const btn = document.createElement('button');
        btn.className = "px-4 py-2 rounded-lg text-[10px] font-bold uppercase bg-[#222] text-gray-400 hover:text-white transition-all border border-transparent";
        btn.innerHTML = `<i class="fas fa-chalkboard-teacher mr-1"></i> ${t.id}`;
        btn.onclick = () => loadSprintTurma(t);
        tabContainer.appendChild(btn);
    });
}

/**
 * Carrega a interface de Sprint para uma turma específica
 * Inclui trava de data, log de auditoria e interface DoD
 */
async function loadSprintTurma(turma) {
    // Reset de variáveis de sessão para a nova aba
    window.currentSprintStart = null;

    // Gerir visibilidade dos containers
    document.getElementById('welcome-sprint').classList.add('hidden');
    const content = document.getElementById('active-sprint-content');
    content.classList.remove('hidden');

    // Preparar datas
    const hoje = new Date().toISOString().split('T')[0];
    const dataFormatada = new Date().toLocaleDateString('pt-BR');

    content.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#333] pb-4 mb-4 gap-4">
            <div>
                <h2 class="text-[#00FFFF] font-black uppercase italic text-lg">${turma.info}</h2>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] bg-[#222] border border-[#333] px-3 py-1 rounded text-gray-400">
                        <i class="fas fa-user-tie mr-1"></i> Prof. ${turma.prof}
                    </span>
                    <span class="text-[10px] bg-[#00FFFF]/10 border border-[#00FFFF]/20 px-3 py-1 rounded text-[#00FFFF] font-bold">
                        <i class="fas fa-calendar-alt mr-1"></i> ${dataFormatada}
                    </span>
                </div>
            </div>
            
            <div class="text-right">
                <div id="log-status-${turma.id}" class="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">
                    Aguardando Início da Aula...
                </div>
                <input type="date" id="sprint-date-filter" value="${hoje}" disabled class="hidden">
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-3">
                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2 h-2 bg-[#00FFFF] rounded-full animate-pulse"></span> Protocolo de Entrada
                </p>
                ${createCheckItem(turma.id, 'chegada_cedo', 'Chegar 10min antes (Check-in)')}
                ${createCheckItem(turma.id, 'sala_organizada', 'Arrumar Laboratório / Setup')}
                ${createCheckItem(turma.id, 'recepcao_alunos', 'Receção e Boas-vindas')}
                ${createCheckItem(turma.id, 'foto_grupo', 'Foto no grupo de Chamada')}
            </div>
            
            <div class="space-y-3">
                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2 h-2 bg-purple-500 rounded-full"></span> Execução e Pós-Aula
                </p>
                ${createCheckItem(turma.id, 'foto_pais', 'Registo Fotográfico para Pais')}
                ${createCheckItem(turma.id, 'assinaturas', 'Coleta de Assinaturas')}
                ${createCheckItem(turma.id, 'chamada_site', 'Lançar Presenças no Portal')}
                ${createCheckItem(turma.id, 'ligacao_faltantes', 'Acompanhamento de Faltantes')}
            </div>
        </div>
        
        <div class="mt-6 pt-6 border-t border-[#333]">
            <label class="text-[9px] text-gray-500 font-bold uppercase mb-2 block">Ocorrências Pedagógicas / Observações</label>
            <textarea id="obs-${turma.id}" 
                class="w-full bg-[#0f0f0f] border border-[#333] rounded-xl p-4 text-white text-xs outline-none focus:border-[#00FFFF] transition-all min-h-[80px]" 
                placeholder="Ex: Aluno X apresentou dificuldade no módulo de lógica..."></textarea>
            
            <div class="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div id="msg-${turma.id}" class="text-[10px] font-bold text-[#00FFFF] hidden uppercase tracking-widest animate-bounce">
                    <i class="fas fa-check-circle mr-1"></i> Dados sincronizados em nuvem
                </div>
                
                <button onclick="saveSprintDataToAPI('${turma.id}', '${turma.prof}')" 
                        class="w-full md:w-auto bg-[#00FFFF] text-black font-black px-10 py-4 rounded-xl shadow-[0_0_20px_rgba(0,255,255,0.15)] hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all uppercase text-[11px] italic flex items-center justify-center gap-3">
                    <i class="fas fa-rocket"></i> Concluir e Salvar Sprint
                </button>
            </div>
        </div>
    `;

    // Buscar dados já existentes no banco para esta turma hoje
    fetchSupabaseData(turma.id);
}
/**
 * Gera o HTML dos itens do checklist
 */
function createCheckItem(turmaId, field, text) {
    const inputId = `${turmaId}-${field}`;
    
    // Adicionamos um evento onchange especial apenas para o item de chegada (chegada_cedo)
    const eventHandler = (field === 'chegada_cedo') 
        ? `onchange="registrarCheckIn(this, '${turmaId}')"` 
        : '';

    return `
        <label class="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5 cursor-pointer hover:bg-black/40 transition-all">
            <input type="checkbox" id="${inputId}" ${eventHandler} class="w-4 h-4 accent-[#00FFFF]">
            <span class="text-xs text-gray-300 font-medium">${text}</span>
        </label>
    `;
}

/**
 * Registra o timestamp de início assim que o professor marca a chegada
 */
window.registrarCheckIn = function(el, turmaId) {
    if (el.checked) {
        // Se ainda não houver um horário de início para esta sessão, grava agora
        if (!window.currentSprintStart) {
            window.currentSprintStart = new Date().toISOString();
            
            // Feedback visual no log de auditoria (opcional)
            const logEl = document.getElementById(`log-status-${turmaId}`);
            if (logEl) {
                logEl.innerHTML = `🚩 Check-in registrado às ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                logEl.classList.remove('text-gray-500');
                logEl.classList.add('text-[#00FFFF]');
            }

            console.log("Check-in capturado:", window.currentSprintStart);
        }
    } else {
        // Se desmarcar, limpamos o início para permitir novo registro (opcional, para correção de erro)
        window.currentSprintStart = null;
    }
};

/**
 * Procura dados existentes na API para a turma e data selecionadas
 * Preenche o checklist e o log de status automaticamente
 */
async function fetchSupabaseData(turmaId) {
    // 1. Obter a data do input (que está bloqueado no 'hoje')
    const dataAlvo = document.getElementById('sprint-date-filter').value;
    const logEl = document.getElementById(`log-status-${turmaId}`);

    try {
        // 2. Chamar a API via fetchAdmin (garante o envio do Token JWT)
        const response = await fetchAdmin(`${API_URL}/admin/sprints-pedagogicas/${turmaId}?data=${dataAlvo}`, {
            method: 'GET'
        });

        if (response && response.ok) {
            const data = await response.json();

            // 3. Se não houver dados (Data Object vazio), limpamos o formulário para uma nova Sprint
            if (!data || Object.keys(data).length === 0) {
                console.log(`Nenhum registo encontrado para a turma ${turmaId} em ${dataAlvo}.`);
                if (logEl) logEl.innerText = "Aguardando Início da Aula...";
                window.currentSprintStart = null; // Reset do timer de início
                return;
            }

            // 4. Se houver dados, preenchemos os Checkboxes
            // Mapeamento: ID do formulário -> Chave vinda do Banco de Dados
            const mapping = {
                'chegada_cedo': 'check_chegada_cedo',
                'sala_organizada': 'check_sala_organizada',
                'recepcao_alunos': 'check_recepcao_alunos',
                'foto_grupo': 'check_foto_grupo_chamada',
                'foto_pais': 'check_foto_pais',
                'assinaturas': 'check_chamada_assinada',
                'chamada_site': 'check_chamada_site',
                'ligacao_faltantes': 'check_ligacao_faltantes'
            };

            Object.keys(mapping).forEach(idFim => {
                const el = document.getElementById(`${turmaId}-${idFim}`);
                if (el) {
                    el.checked = data[mapping[idFim]] || false;
                }
            });

            // 5. Preencher Observações
            const obsEl = document.getElementById(`obs-${turmaId}`);
            if (obsEl) obsEl.value = data.observacoes || '';

            // 6. Atualizar Log de Auditoria (Check-in e Check-out)
            if (data.hora_chegada) {
                // Sincroniza a variável global para que o save saiba que já houve check-in
                window.currentSprintStart = data.hora_chegada;
                
                const horaIn = new Date(data.hora_chegada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const horaOut = data.updated_at 
                    ? new Date(data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : '--:--';

                if (logEl) {
                    logEl.innerHTML = `🚩 INÍCIO: ${horaIn} | 🏁 FIM: ${horaOut}`;
                    logEl.classList.remove('text-gray-500');
                    logEl.classList.add('text-[#00FFFF]');
                }
            }

        } else {
            console.error("Erro ao recuperar dados da Sprint.");
        }
    } catch (err) {
        console.error("Falha na ligação com o servidor:", err);
    }
}

// Lógica de Persistência via API Javis (Render -> Supabase)
export async function saveSprintDataToAPI(turmaId, professorName) {
    // 1. Mostrar loading de localização
    Swal.fire({
        title: 'Validando Localização...',
        text: 'Aguarde um momento enquanto confirmamos que você está na Unidade.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // 2. Solicitar Geolocalização do Navegador
    navigator.geolocation.getCurrentPosition(async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // 3. Calcular distância até a Javis
        const distancia = calcularDistancia(userLat, userLng, JAVIS_COORDS.lat, JAVIS_COORDS.lng);

        // 4. Bloquear se estiver fora do raio permitido
        if (distancia > RAIO_MAXIMO_METROS) {
            Swal.fire({
                icon: 'error',
                title: 'Acesso Negado',
                text: `Você está a ${Math.round(distancia)}m da escola. O registro de Sprint só é permitido dentro da Javis.`,
                background: '#111',
                color: '#fff',
                confirmButtonColor: '#00FFFF'
            });
            return;
        }

        // 5. Preparar o Payload (Dados para o Banco)
        const payload = {
            turma_id: turmaId,
            professor_name: professorName,
            data_aula: document.getElementById('sprint-date-filter').value,
            hora_chegada: window.currentSprintStart || null, // Capturado no primeiro check
            check_chegada_cedo: document.getElementById(`${turmaId}-chegada_cedo`).checked,
            check_sala_organizada: document.getElementById(`${turmaId}-sala_organizada`).checked,
            check_recepcao_alunos: document.getElementById(`${turmaId}-recepcao_alunos`).checked,
            check_foto_grupo_chamada: document.getElementById(`${turmaId}-foto_grupo`).checked,
            check_foto_pais: document.getElementById(`${turmaId}-foto_pais`).checked,
            check_chamada_assinada: document.getElementById(`${turmaId}-assinaturas`).checked,
            check_chamada_site: document.getElementById(`${turmaId}-chamada_site`).checked,
            check_ligacao_faltantes: document.getElementById(`${turmaId}-ligacao_faltantes`).checked,
            observacoes: document.getElementById(`obs-${turmaId}`).value
        };

        try {
            // 6. Enviar para a API no Render
            const response = await fetchAdmin(`${API_URL}/admin/sprints-pedagogicas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // VAMOS LER A RESPOSTA DO PYTHON ANTES DE JULGAR
            const responseData = await response.json().catch(() => null); 

            if (response.ok) {
                // Sucesso Total
                Swal.fire({
                    icon: 'success',
                    title: 'Sprint Salva!',
                    html: `Check-out realizado com sucesso.<br><small class="text-gray-500">Localização validada</small>`,
                    background: '#111',
                    color: '#00FFFF',
                    confirmButtonColor: '#00FFFF',
                    timer: 3000
                });

                const msg = document.getElementById(`msg-${turmaId}`);
                if (msg) {
                    msg.classList.remove('hidden');
                    setTimeout(() => msg.classList.add('hidden'), 5000);
                }
            } else {
                // SE DEU ERRO (Como o 500), PEGAMOS O MOTIVO REAL
                const erroServidor = responseData?.detail || responseData?.message || "Erro interno no código Python.";
                throw new Error(erroServidor);
            }

        } catch (error) {
            console.error("ERRO DO BACKEND:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro no Servidor (500)',
                html: `<span style="color: #ff4444;">O Python reclamou disso:</span><br><br> ${error.message}`,
                background: '#111',
                color: '#fff'
            });
        }

    }, (error) => {
        // Erro de GPS (Negado pelo usuário ou sem sinal)
        let msgErro = "Por favor, ative o GPS para validar seu trabalho na unidade.";
        if (error.code === 1) msgErro = "Você bloqueou o acesso à localização. Ative-a nas configurações do navegador.";
        
        Swal.fire({
            icon: 'warning',
            title: 'GPS Necessário',
            text: msgErro,
            background: '#111',
            color: '#fff',
            confirmButtonColor: '#00FFFF'
        });
    }, {
        enableHighAccuracy: true,
        timeout: 10000
    });
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distância em metros
}

export async function loadSprintsDashboard() {
    const content = document.getElementById('active-sprint-content');
    content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-[#111] p-6 rounded-2xl border border-[#333]">
                <p class="text-gray-500 text-[10px] font-bold uppercase">Média de Conformidade</p>
                <h3 id="stat-conformidade" class="text-3xl font-black text-[#00FFFF]">0%</h3>
            </div>
            <div class="bg-[#111] p-6 rounded-2xl border border-[#333]">
                <p class="text-gray-500 text-[10px] font-bold uppercase">Sprints Realizadas</p>
                <h3 id="stat-total" class="text-3xl font-black text-white">0</h3>
            </div>
            <div class="bg-[#111] p-6 rounded-2xl border border-[#333]">
                <p class="text-gray-500 text-[10px] font-bold uppercase">Status de Auditoria</p>
                <h3 class="text-lg font-bold text-green-500">100% ONLINE</h3>
            </div>
        </div>
        
        <div class="bg-[#111] p-6 rounded-2xl border border-[#333]">
            <p class="text-gray-500 text-[10px] font-bold uppercase mb-4">Conformidade por Professor (%)</p>
            <canvas id="chartProfessores" height="100"></canvas>
        </div>
    `;

    const response = await fetchAdmin(`${API_URL}/admin/sprints-pedagogicas/estatisticas/geral`);
    if (response.ok) {
        const stats = await response.json();
        
        document.getElementById('stat-conformidade').innerText = `${Math.round(stats.media_conformidade)}%`;
        document.getElementById('stat-total').innerText = stats.total_sprints;

        // Renderizar Gráfico
        const ctx = document.getElementById('chartProfessores').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(stats.por_professor),
                datasets: [{
                    label: 'Score Médio',
                    data: Object.values(stats.por_professor).map(p => p.soma_score / p.sprints),
                    backgroundColor: '#00FFFF',
                    borderRadius: 8
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, max: 100, grid: { color: '#222' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

