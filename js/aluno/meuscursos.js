// === CONFIGURAÇÃO DA API ===
const TRINKET_URL = "https://trinket.io/embed/pygame/b96aa43355e3";

const courseData = {
  'game-pro': {
    title: 'GAME PRO',
    icon: 'fas fa-headset',
    description: 'Formação completa para ProPlayers e atletas digitais.',
    duration: '120h',
    level: 'Avançado',
  },
  'designer-start': {
    title: 'DESIGNER START',
    icon: 'fas fa-paint-brush',
    description: 'Aprenda design do zero com foco em identidade gamer e criação visual.',
    duration: '120h',
    level: 'Iniciante',
  },
  'game-dev': {
    title: 'GAME DEV',
    icon: 'fas fa-code',
    description: 'Crie seus primeiros jogos com Python + Pygame do zero.',
    duration: '120h',
    level: 'Iniciante',
  },
};

let userPermissions = [];

/* =========================
    Helpers
========================= */
function escapeHtml(str) {
  return (str || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function calcDiasPassados(dataMatriculaIso) {
  try {
    const hoje = new Date();
    const dataInicio = new Date(dataMatriculaIso);
    const diff = hoje - dataInicio;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  } catch { return 0; }
}

/* =========================
    Inicialização
========================= */
document.addEventListener('DOMContentLoaded', async function () {
  const courseItems = document.querySelectorAll('.course-item');
  const loadingOverlay = document.getElementById('loadingOverlay');
  
  // Usando a função global do config.js
  const token = getTokenOrRedirect();
  if (!token) return;

  try {
    // Usando a função global do config.js
    const data = await apiGet('/aluno/meus-cursos', token);
    userPermissions = data.cursos || [];
  } catch (error) {
    console.error("Erro de conexão:", error);
  } finally {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }

  courseItems.forEach(item => {
    const courseId = item.dataset.course;
    const permission = userPermissions.find(p => p.id === courseId);

    if (!permission) {
      item.classList.add('locked');
      item.onclick = (e) => { e.preventDefault(); alert("Matrícula não encontrada."); };
    } else {
      item.onclick = async () => {
        courseItems.forEach(i => i.classList.remove('border-[#00FFFF]', 'bg-[#00FFFF]/10'));
        item.classList.add('border-[#00FFFF]', 'bg-[#00FFFF]/10');
        await showCourseDetails(courseId, permission.data_inicio);
      };
    }
  });
});

/* =========================
    Renderização do Curso
========================= */
async function showCourseDetails(courseSlug, dataMatricula) {
  // Usando a função global do config.js
  const token = getTokenOrRedirect();
  if (!token) return;

  const meta = courseData[courseSlug] || { title: courseSlug, icon: 'fas fa-book', description: '', duration: '--', level: '--' };

  document.getElementById('noSelection').classList.add('hidden');
  document.getElementById('detailsContent').classList.remove('hidden');
  document.getElementById('detailsIcon').innerHTML = `<i class="${meta.icon}"></i>`;
  document.getElementById('detailsTitle').textContent = meta.title;
  document.getElementById('detailsDescription').textContent = meta.description;
  document.getElementById('statDuration').textContent = meta.duration;
  document.getElementById('statLevel').textContent = meta.level;

  const modulesList = document.getElementById('modulesList');
  modulesList.innerHTML = `<div class="p-4 text-gray-400 animate-pulse">Carregando módulos...</div>`;

  try {
    // Usando a função global do config.js
    const curso = await apiGet(`/aluno/curso/${encodeURIComponent(courseSlug)}/estrutura`, token);
    const diasPassados = calcDiasPassados(dataMatricula);
    const totalAulas = curso.aulas_total || 0;
    let aulasLiberadas = Math.floor(diasPassados / 7) + 1;
    if (aulasLiberadas > totalAulas) aulasLiberadas = totalAulas;

    const percent = totalAulas ? Math.round((aulasLiberadas / totalAulas) * 100) : 0;
    document.getElementById('detailsProgress').style.width = `${percent}%`;
    document.getElementById('progressText').textContent = `${percent}%`;
    document.getElementById('statModules').textContent = (curso.modulos || []).length;
    document.getElementById('statCompleted').textContent = `${aulasLiberadas}/${totalAulas}`;

    renderModulesFromDB(modulesList, curso, courseSlug, diasPassados, aulasLiberadas);
  } catch (e) {
    modulesList.innerHTML = `<div class="p-4 text-red-400">Erro: ${escapeHtml(e.message)}</div>`;
  }
}

function renderModulesFromDB(container, curso, courseSlug, diasPassados, aulasLiberadas) {
  container.innerHTML = '';
  const aulasOrdenadas = [];
  (curso.modulos || []).sort((a,b) => (a.ordem||0)-(b.ordem||0)).forEach(m => {
    (m.aulas || []).sort((a,b) => (a.ordem||0)-(b.ordem||0)).forEach(a => aulasOrdenadas.push({ mId: m.id, aId: a.id }));
  });

  const ordemGlobalPorAula = new Map();
  aulasOrdenadas.forEach((x, idx) => ordemGlobalPorAula.set(x.aId, idx + 1));

  (curso.modulos || []).sort((a,b) => (a.ordem||0)-(b.ordem||0)).forEach((mod, index) => {
    const moduleId = `module-${index}`;
    const subHTML = (mod.aulas || []).sort((a,b) => (a.ordem||0)-(b.ordem||0)).map(aula => {
      const ord = ordemGlobalPorAula.get(aula.id);
      const bloqueada = ord > aulasLiberadas;
      if (bloqueada) return `<div class="p-3 pl-6 border-b border-[#222] bg-[#1a1a1a] opacity-50"><span class="text-sm text-gray-500"><i class="fas fa-lock mr-2"></i>${escapeHtml(aula.titulo)}</span></div>`;
      
      return `<button onclick="abrirConteudoGeral(${aula.id}, '${escapeHtml(aula.titulo).replaceAll("'", "\'")}', '${courseSlug}')" class="group flex justify-between w-full p-3 pl-6 border-b border-[#222] bg-[#151515] hover:bg-[#00FFFF]/10 text-left">
                <span class="text-sm text-gray-300 group-hover:text-[#00FFFF]"><i class="far fa-play-circle mr-2 text-[#00FFFF]"></i>${escapeHtml(aula.titulo)}</span>
                <span class="text-[10px] text-gray-600">Aula ${ord}</span>
              </button>`;
    }).join('');

    const div = document.createElement('div');
    div.className = 'module-item border border-[#333] rounded-lg overflow-hidden bg-[#161616] mb-3';
    div.innerHTML = `<div class="p-4 cursor-pointer flex justify-between hover:bg-[#222]" onclick="toggleSubmodules('${moduleId}')">
                        <span class="text-gray-300 font-semibold">${escapeHtml(mod.titulo)}</span>
                        <i class="fas fa-chevron-down text-[#00FFFF]" id="icon-${moduleId}"></i>
                     </div>
                     <div class="hidden bg-[#1a1a1a] border-t border-[#333]" id="${moduleId}">${subHTML}</div>`;
    container.appendChild(div);
  });
}

/* =========================
    UI e Modal de Aulas
========================= */
function toggleSubmodules(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById(`icon-${id}`);
  if (!content) return;
  content.classList.toggle('hidden');
  icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

function aplicarLayout(modal, modoSplit) {
    const sidebar = document.getElementById("modalSidebar");
    const mainContent = document.getElementById("modalMainContent");
    const warningHeader = document.getElementById("modalWarningHeader");

    if (!sidebar || !mainContent) return;

    sidebar.classList.remove("w-1/3", "md:w-1/3", "w-full");
    mainContent.classList.remove("w-2/3", "md:w-2/3");
    mainContent.classList.add("w-full");

    if (modoSplit) {
        sidebar.classList.remove("hidden");
        sidebar.classList.add("w-full");
        sidebar.classList.add("md:w-1/3");
        mainContent.classList.add("md:w-2/3");
        if (warningHeader) warningHeader.classList.remove("hidden");
    } else {
        sidebar.classList.add("hidden");
        if (warningHeader) warningHeader.classList.add("hidden");
    }
}

function closeReplit() {
    const modal = document.getElementById("replitModal");
    const iframeContainer = document.getElementById("iframeContainer");
    if (!modal) return;

    modal.classList.add("hidden");
    if (iframeContainer) iframeContainer.innerHTML = ""; 
    
    aplicarLayout(modal, false);
}

/* =========================
    Abertura da Aula
========================= */
async function abrirConteudoGeral(idAula, titulo = "", courseSlug = "") {
  const token = localStorage.getItem('access_token');
  if (!token) { window.location.href = "IndexHome.html"; return; }

  const modal = document.getElementById("replitModal");
  const iframeContainer = document.getElementById("iframeContainer");
  const modalTitleEl = document.getElementById("modalTitle");
  const slug = String(courseSlug || "").toLowerCase();

  if (!modal || !iframeContainer) return;

  if (modalTitleEl) modalTitleEl.textContent = titulo;
  
  iframeContainer.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full text-cyan-400 bg-black">
        <i class="fas fa-circle-notch fa-spin text-4xl mb-4"></i>
        <p class="animate-pulse">A carregar ambiente da Javis...</p>
    </div>`;

  const sidebar = document.getElementById("modalSidebar");
  if (sidebar) sidebar.classList.add("hidden"); 

  modal.classList.remove("hidden");
  aplicarLayout(modal, false);

  try {
    const aula = await apiGet(`/aluno/aula/${idAula}`, token);
    if (!aula) return;

    const conteudoRaw = (aula.conteudo || "").trim();

    if (conteudoRaw.includes("canva.com")) {
      aplicarLayout(modal, false); 
      
      let cleanUrl = conteudoRaw.includes("view?embed") 
                     ? conteudoRaw 
                     : conteudoRaw.split('?')[0] + "/view?embed";

      iframeContainer.innerHTML = `
        <div class="flex items-center justify-center w-full h-full bg-black p-2 md:p-6">
          <div style="position: relative; width: 100%; height: 0; padding-top: 56.25%; width: 100%; max-width: 1200px; border-radius: 12px; overflow: hidden; box-shadow: 0 0 50px rgba(0,255,255,0.15); border: 1px solid #333;">
            <iframe loading="lazy" 
                    style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none;"
                    src="${cleanUrl}" 
                    allowfullscreen>
            </iframe>
          </div>
        </div>`;
    } 
    else if (slug === "game-dev") {
      aplicarLayout(modal, true); 
      renderGameDevSidebar(conteudoRaw);
      
      iframeContainer.innerHTML = `
        <iframe src="${TRINKET_URL}" 
                width="100%" 
                height="100%" 
                frameborder="0" 
                marginwidth="0" 
                marginheight="0" 
                style="border-radius: 8px;"
                allowfullscreen>
        </iframe>`;
    }
    else {
      aplicarLayout(modal, false);
      iframeContainer.innerHTML = `
        <div class="bg-white text-black p-8 min-h-full prose max-w-none overflow-y-auto">
          <div class="p-4 border-b mb-4 flex justify-between items-center">
            <span class="bg-black text-white px-3 py-1 rounded-full text-xs font-bold">AULA</span>
          </div>
          ${conteudoRaw}
        </div>`;
    }

  } catch (err) {
    console.error("Erro no carregamento:", err);
    iframeContainer.innerHTML = `<div class="p-8 text-red-500 text-center">Erro ao carregar os dados da aula.</div>`;
  }
}

function parseTaggedContent(conteudo) {
  const get = (tag) => {
    const r = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
    const m = (conteudo || '').match(r);
    return m ? m[1].trim() : '';
  };
  return { script: get('SCRIPT'), codigo: get('CODIGO'), desafio: get('DESAFIO') };
}

function renderGameDevSidebar(conteudo) {
  const contentElement = document.getElementById('lessonContent');
  const challengeElement = document.getElementById('lessonChallenge');
  const { script, codigo, desafio } = parseTaggedContent(conteudo);
  
  contentElement.innerHTML = `<p class="mb-4 text-gray-300">${escapeHtml(script).replace(/\n/g, '<br>')}</p>
    ${codigo ? `<div class="bg-[#111] p-3 rounded border border-[#333]"><pre class="text-xs text-green-400 font-mono">${escapeHtml(codigo)}</pre></div>` : ''}`;
  challengeElement.textContent = desafio || "";
}