// 1. Configurações Globais - Importação correta do módulo
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// 2. Inicialização do Supabase
// Corrigido: usando SUPABASE_ANON_KEY (o mesmo nome que foi importado)
const supabaseClient = typeof supabase !== 'undefined' 
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

// 3. Função Global para abrir Modal 
// Exposta ao window para funcionar com o onclick="handleModalOpen(...)" do HTML
window.handleModalOpen = function(event, url) {
    event.preventDefault();
    const modalContainer = document.getElementById('studentPortalModal');
    
    console.log("🚀 Tentando abrir modal:", url);

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Erro HTTP: ' + response.status);
            return response.text();
        })
        .then(html => {
            modalContainer.innerHTML = html;
            modalContainer.style.display = 'block';
            
            setupCloseEvents(modalContainer);
            
            // LÓGICA DE SELEÇÃO: FUNCIONÁRIO OU ALUNO
            if(url.indexOf('funcionario') !== -1) {
                setupLoginFuncionario();
            } else {
                setupLoginAluno();
            }
            
            setupRecuperarEvent();
        })
        .catch(error => console.error('❌ Erro ao carregar modal:', error));
};

// --- FUNÇÕES AUXILIARES ---

function setupCloseEvents(modalContainer) {
    const closeBtn = modalContainer.querySelector('.close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => modalContainer.style.display = 'none');
}

// --- LÓGICA DE INICIALIZAÇÃO DE UI ---
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Botão Voltar ao Topo
    const backToTopButton = document.getElementById('backToTop');
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) backToTopButton.classList.add('visible');
            else backToTopButton.classList.remove('visible');
        });
        backToTopButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 2. Menu Hamburger
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const mainNav = document.querySelector('.main-nav');
    if (hamburgerBtn && mainNav) {
        hamburgerBtn.addEventListener('click', () => {
            const isOpen = mainNav.classList.toggle('open');
            const icon = hamburgerBtn.querySelector('i');
            icon.classList.replace(isOpen ? 'fa-bars' : 'fa-times', isOpen ? 'fa-times' : 'fa-bars');
        });
    }

    // 3. Fechar modal ao clicar fora
    const modalContainer = document.getElementById('studentPortalModal');
    window.addEventListener('click', (event) => {
        if (event.target == modalContainer) modalContainer.style.display = 'none';
    });
});

// --- SISTEMA DE LOGIN ---

// A. LOGIN ALUNO
function setupLoginAluno() {
    const formLogin = document.getElementById('form-login-aluno');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const btnSubmit = document.getElementById('btn-login');
            const originalText = btnSubmit.innerText;
            btnSubmit.innerText = 'Conectando...'; btnSubmit.disabled = true;

            try {
                const email = document.getElementById('email-aluno').value;
                const password = document.getElementById('senha-aluno').value;
                
                const response = await fetch('https://javisgamesbackend.onrender.com/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) throw new Error('Email ou senha inválidos');
                const data = await response.json();

                // Padronização do Token
                localStorage.removeItem('access_token');
                localStorage.setItem('access_token', data.token);
                window.location.href = 'CursosIndex.html';

            } catch (error) {
                alert(error.message);
                btnSubmit.innerText = originalText; btnSubmit.disabled = false;
            }
        });
    }
}

// B. LOGIN FUNCIONÁRIO
function setupLoginFuncionario() {
    const formLogin = document.getElementById('form-login-func');
    if (!formLogin) return;

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const btnSubmit = document.getElementById('btn-login-func');
        const originalText = btnSubmit.innerText;
        btnSubmit.innerText = 'Verificando...'; btnSubmit.disabled = true;

        try {
            const email = document.getElementById('email-func').value;
            const password = document.getElementById('senha-func').value;

            const response = await fetch('https://javisgamesbackend.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) throw new Error('Credenciais inválidas.');
            const data = await response.json();
            
            // Padronização do Token (Mesma chave usada no Aluno e Dashboard)
            localStorage.removeItem('access_token');
            localStorage.setItem('access_token', data.token);
            
            window.location.href = 'portal-funcionario.html'; 

        } catch (error) {
            alert("Erro: " + error.message);
            btnSubmit.innerText = originalText; btnSubmit.disabled = false;
        }
    });
}

// C. RECUPERAR SENHA
function setupRecuperarEvent() {
    const formRecuperar = document.getElementById('form-recuperar');
    if (formRecuperar) {
        formRecuperar.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Link de recuperação enviado (simulação).');
        });
    }
}