

document.addEventListener('DOMContentLoaded', function() {
    carregarNavbar();
});

async function carregarNavbar() {
    const token = localStorage.getItem('access_token');
    
    // 1. HTML da Navbar
    const navbarHTML = `
    <header class="navbar">
        <div class="logo">
            <a href="IndexHome.html">
                <img src="assets/img/JAVIS - LOGO COM REGISTRO (BRANCO) (2).webp" width="320" height="100" alt="Logo Javis Game Academy">
            </a>
        </div>
        <ul class="nav-menu">
            <li class="nav-item"><a href="CursosIndex.html" class="nav-link" data-page="CursosIndex.html"><i class="fas fa-book"></i> Meus Cursos</a></li>
            <li class="nav-item"><a href="AgendaIndex.html" class="nav-link" data-page="AgendaIndex.html"><i class="fas fa-calendar-alt"></i> Minha Agenda</a></li>
            <li class="nav-item"><a href="CertificadosIndex.html" class="nav-link" data-page="CertificadosIndex.html"><i class="fas fa-graduation-cap"></i> Certificados</a></li>
            <li class="nav-item"><a href="SuporteIndex.html" class="nav-link" data-page="SuporteIndex.html"><i class="fas fa-headset"></i> Suporte</a></li>
        </ul>
        <button class="mobile-menu-btn" type="button" aria-label="Abrir menu">
            <i class="fas fa-bars"></i>
        </button>
        <div class="user-menu flex items-center gap-4">
            <div class="user-profile relative flex items-center gap-2 cursor-pointer">
                <img id="nav-avatar-img" src="https://ui-avatars.com/api/?name=Aluno&background=00FFFF&color=000" alt="Avatar" class="w-8 h-8 rounded-full border border-[#00FFFF]">
                <span id="nav-user-name" class="user-name text-sm font-semibold text-gray-200 hidden md:block">Carregando...</span>
                <i class="fas fa-chevron-down text-xs text-[#00FFFF] hidden md:block"></i>
                <div class="user-dropdown">
                    <div class="p-4 border-b border-gray-700 flex items-center gap-3">
                        <div class="overflow-hidden">
                            <h4 id="nav-dropdown-name" class="font-bold text-sm text-[#00FFFF]">Aluno</h4>
                        </div>
                    </div>
                    <div class="py-1">
                        <a href="#" id="btn-meu-perfil"
                            class="dropdown-item flex items-center gap-3 px-4 py-3 text-[#00FFFF] hover:bg-[#00FFFF]/10">
                            <i class="fas fa-user w-5"></i> Meu Perfil
                        </a>

                        <a href="#" id="btn-sair-global"
                            class="dropdown-item flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300">
                            <i class="fas fa-sign-out-alt w-5"></i> Sair
                        </a>
                    </div>

                </div>
            </div>
        </div>
    </header>`;

    // 2. HTML do Modal de Perfil (Agora Global)
    const profileModalHTML = `
    <div id="profileModal" class="fixed inset-0 z-[100] hidden bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-[#161616] w-full max-w-2xl rounded-xl border border-[#00FFFF] shadow-[0_0_30px_rgba(0,255,255,0.2)] overflow-hidden">
            <div class="flex justify-between items-center p-4 border-b border-[#333] bg-[#1a1a1a]">
                <div class="flex items-center gap-3">
                    <i class="fas fa-id-card text-[#00FFFF]"></i>
                    <h3 class="text-gray-200 font-bold">Editar Perfil</h3>
                </div>
                <button id="closeProfileBtn" class="text-gray-400 hover:text-red-500 transition">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            <form id="profileForm" class="p-5 space-y-5">
                <div id="profileAlert" class="hidden p-3 rounded-lg text-sm border"></div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs text-gray-400">Nome completo</label>
                        <input id="pf_nome" type="text" class="w-full mt-1 bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#00FFFF]" />
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Telefone</label>
                        <input id="pf_telefone" type="text" class="w-full mt-1 bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#00FFFF]" />
                    </div>
                    <div class="md:col-span-2">
                        <label class="text-xs text-gray-400">E-mail</label>
                        <input id="pf_email" type="email" class="w-full mt-1 bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#00FFFF]" />
                        <p class="text-[11px] text-gray-500 mt-1">Se o Supabase estiver com confirmação por e-mail, pode exigir verificação.</p>
                    </div>
                </div>
                <div class="border-t border-[#333] pt-4">
                    <div class="flex items-center gap-2 mb-3">
                        <i class="fas fa-key text-[#00FFFF]"></i>
                        <h4 class="text-gray-200 font-bold">Trocar senha</h4>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs text-gray-400">Senha atual</label>
                            <input id="pf_senha_atual" type="password" class="w-full mt-1 bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#00FFFF]" />
                        </div>
                        <div>
                            <label class="text-xs text-gray-400">Nova senha</label>
                            <input id="pf_senha_nova" type="password" class="w-full mt-1 bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#00FFFF]" />
                        </div>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-2">Deixe em branco se não quiser trocar a senha.</p>
                </div>
                <div class="flex items-center justify-end gap-3 pt-2">
                    <button type="button" id="cancelProfileBtn" class="px-4 py-2 rounded-lg border border-[#333] text-gray-300 hover:bg-[#222] transition">Cancelar</button>
                    <button type="submit" id="saveProfileBtn" class="px-5 py-2 rounded-lg bg-[#00FFFF] text-black font-bold hover:scale-[1.01] transition">Salvar</button>
                </div>
            </form>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('afterbegin', navbarHTML);
    document.body.insertAdjacentHTML('beforeend', profileModalHTML); // Injeta o modal na página

    // 3. Busca o nome real do Backend para a Navbar
    if (token) {
        try {
            const resp = await fetch(`${API_URL_GLOBAL}/aluno/meus-cursos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (resp.ok) {
                const data = await resp.json();
                const nomeReal = data.nome || "Aluno"; 
                document.getElementById('nav-user-name').textContent = nomeReal;
                document.getElementById('nav-dropdown-name').textContent = nomeReal;
                const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeReal)}&background=00FFFF&color=000`;
                document.getElementById('nav-avatar-img').src = avatarUrl;
            }
        } catch (err) {
            console.error("Erro ao buscar nome:", err);
            document.getElementById('nav-user-name').textContent = "Aluno";
        }
    }

    inicializarEventosNavbar();
    inicializarEventosPerfil();
}

function inicializarEventosNavbar() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navMenu = document.querySelector('.nav-menu');
    const userProfile = document.querySelector('.user-profile');
    const userDropdown = document.querySelector('.user-dropdown');
    const btnSair = document.getElementById('btn-sair-global');
    const btnMeuPerfil = document.getElementById('btn-meu-perfil');

    if (btnMeuPerfil) {
        btnMeuPerfil.addEventListener('click', async (e) => {
            e.preventDefault();
            if (userDropdown) userDropdown.classList.remove('active');
            abrirModalPerfilGlobal();
            await carregarDadosPerfilGlobal();
        });
    }

    if(mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => navMenu.classList.toggle('active'));
    if(userProfile) {
        userProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });
    }
    document.addEventListener('click', () => {
        if(userDropdown) userDropdown.classList.remove('active');
    });

    if(btnSair){
        btnSair.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('access_token'); 
            window.location.href = "IndexHome.html";
        });
    }
}

/* =========================================================
   LÓGICA GLOBAL DO PERFIL
========================================================= */
function inicializarEventosPerfil() {
    const modal = document.getElementById('profileModal');
    const closeBtn = document.getElementById('closeProfileBtn');
    const cancelBtn = document.getElementById('cancelProfileBtn');
    const form = document.getElementById('profileForm');

    if (closeBtn) closeBtn.addEventListener('click', fecharModalPerfilGlobal);
    if (cancelBtn) cancelBtn.addEventListener('click', fecharModalPerfilGlobal);
    if (form) form.addEventListener('submit', salvarPerfilGlobal);
    
    if (modal) {
        modal.addEventListener('click', (ev) => {
            if (ev.target === modal) fecharModalPerfilGlobal();
        });
    }
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') fecharModalPerfilGlobal();
    });
}

function abrirModalPerfilGlobal() {
    const modal = document.getElementById('profileModal');
    const alertEl = document.getElementById('profileAlert');
    if(alertEl) alertEl.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalPerfilGlobal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('hidden');
}

function mostrarAlertaPerfil(tipo, msg) {
    const el = document.getElementById('profileAlert');
    if (!el) return;
    el.classList.remove('hidden', 'border-red-500', 'text-red-300', 'bg-red-500/10', 'border-green-500', 'text-green-300', 'bg-green-500/10');
    if(tipo === 'error') el.classList.add('border-red-500', 'text-red-300', 'bg-red-500/10');
    if(tipo === 'success') el.classList.add('border-green-500', 'text-green-300', 'bg-green-500/10');
    el.textContent = msg;
}

async function carregarDadosPerfilGlobal() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const res = await fetch(`${API_URL_GLOBAL}/aluno/perfil`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) {
            const data = await res.json();
            document.getElementById('pf_nome').value = data.nome_completo || '';
            document.getElementById('pf_telefone').value = data.telefone || '';
            document.getElementById('pf_email').value = data.email || '';
            window.__perfilEmailOriginalGlobal = data.email || '';
        }
    } catch(e) {
        console.error("Erro ao carregar perfil:", e);
    }
}

async function salvarPerfilGlobal(e) {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const btn = document.getElementById('saveProfileBtn');
    if (!token) return;

    btn.disabled = true;
    btn.textContent = "Salvando...";

    try {
        const nome = document.getElementById('pf_nome').value.trim();
        const telefone = document.getElementById('pf_telefone').value.trim();
        const novoEmail = document.getElementById('pf_email').value.trim();
        const senhaAtual = document.getElementById('pf_senha_atual').value;
        const senhaNova = document.getElementById('pf_senha_nova').value;
        const emailOriginal = (window.__perfilEmailOriginalGlobal || "").trim();

        const payloadPerfil = {};
        if (nome) payloadPerfil.nome_completo = nome;
        if (telefone) payloadPerfil.telefone = telefone;
        if (novoEmail && novoEmail !== emailOriginal) payloadPerfil.email = novoEmail;

        const temUpdatePerfil = Object.keys(payloadPerfil).length > 0;
        const temTrocaSenha = !!senhaNova.trim();

        if (temTrocaSenha && senhaNova.trim().length < 6) {
            mostrarAlertaPerfil('error', 'A nova senha deve ter pelo menos 6 caracteres.');
            btn.disabled = false; btn.textContent = "Salvar"; return;
        }

        if (temUpdatePerfil) {
            const res = await fetch(`${API_URL_GLOBAL}/aluno/perfil`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payloadPerfil)
            });
            if(!res.ok) throw new Error("Erro ao atualizar dados.");
            if (payloadPerfil.email) window.__perfilEmailOriginalGlobal = payloadPerfil.email;
        }

        if (temTrocaSenha) {
            const res = await fetch(`${API_URL_GLOBAL}/aluno/senha`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ senha_atual: senhaAtual, senha_nova: senhaNova })
            });
            if(!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Erro ao trocar senha.");
            }
            document.getElementById('pf_senha_atual').value = "";
            document.getElementById('pf_senha_nova').value = "";
        }

        if(temUpdatePerfil || temTrocaSenha) {
            mostrarAlertaPerfil('success', 'Atualizado com sucesso!');
        } else {
            mostrarAlertaPerfil('error', 'Nada para atualizar.');
        }

    } catch (err) {
        mostrarAlertaPerfil('error', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar";
    }
}