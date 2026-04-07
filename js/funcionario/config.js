// ==========================================
// js/funcionario/config.js
// ==========================================
export const API_URL = 'https://javisgamesbackend.onrender.com'; 
export const token = localStorage.getItem('access_token');

export let nivelUsuarioLogado = 0; 
export let usuarioLogadoId = null;

// Função central de requisições com autenticação
export async function fetchAdmin(url, options = {}) {
    const tokenAtual = localStorage.getItem('access_token');
    const defaultHeaders = { 'Authorization': `Bearer ${tokenAtual}` };
    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            localStorage.removeItem('access_token');
            Swal.fire({ icon: 'warning', title: 'Sessão Expirada', text: 'Faça login novamente.', background: '#222', color: '#fff' })
                .then(() => window.location.href = 'IndexHome.html');
            return null;
        }
        return response;
    } catch (error) {
        console.error("Erro na requisição:", error);
        return null;
    }
}

// Função de Logout
export function logout() { 
    localStorage.removeItem('access_token'); 
    window.location.href = 'IndexHome.html'; 
}

// Função de validação inicial
export async function verificarPermissoes() {
    if (!token) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Faça login.', background: '#222', color: '#fff' })
            .then(() => { window.location.href = 'IndexHome.html'; });
        return;
    }
    try {
        const response = await fetchAdmin(`${API_URL}/admin/meus-dados`);
        if (!response) return;

        if (response.status === 403) {
            Swal.fire({ icon: 'error', title: 'Sem acesso', text: 'Seu usuário não está vinculado.', background:'#222', color:'#fff' });
            return; 
        }
        
        if (!response.ok) throw new Error("Sessão inválida");
        const dados = await response.json();

        nivelUsuarioLogado = dados.nivel;
        usuarioLogadoId = dados.id_colaborador;
        
        // Atualiza a UI Básica do topo
        const elNome = document.getElementById('nome-usuario-logado');
        if(elNome) elNome.innerText = dados.nome;
        
        const elCargo = document.getElementById('email-usuario-logado');
        if(elCargo) elCargo.innerText = dados.cargo;

        // ... (AQUI DEPOIS VAMOS PUXAR A LÓGICA DO aplicarRegras) ...
        
    } catch (e) {
        console.error(e); 
        logout();
    }
}