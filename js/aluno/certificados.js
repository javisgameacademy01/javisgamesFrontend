
document.addEventListener('DOMContentLoaded', () => {
    carregarCertificadosProgresso();
});

async function carregarCertificadosProgresso() {
    const token = localStorage.getItem('access_token');
    
    // Redireciona se não estiver logado
    if (!token) {
        window.location.href = "IndexHome.html";
        return;
    }

    const container = document.getElementById('certificados-container');
    if (!container) return;

    // Coloca um ícone de carregamento visual
    container.innerHTML = `
        <div class="col-span-full text-center text-[#00FFFF] py-10">
            <i class="fas fa-circle-notch fa-spin text-4xl mb-3"></i>
            <p class="animate-pulse font-bold uppercase tracking-widest text-xs">Calculando seu progresso...</p>
        </div>`;

    try {
        // 1. Busca os cursos em que o aluno está matriculado
        const respCursos = await fetch(`${API_URL}/aluno/meus-cursos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!respCursos.ok) throw new Error("Erro ao buscar cursos");
        
        const dataCursos = await respCursos.json();
        const cursos = dataCursos.cursos || [];

        if (cursos.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">Nenhuma matrícula ativa encontrada.</div>';
            return;
        }

        container.innerHTML = ''; // Limpa o carregamento

        // 2. Para cada curso, busca a estrutura para saber quantas aulas liberou
        for (const curso of cursos) {
            const slug = curso.id; // o 'id' aqui vem como o slug do curso, ex: 'game-pro'
            
            try {
                const respEstrutura = await fetch(`${API_URL}/aluno/curso/${slug}/estrutura`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (respEstrutura.ok) {
                    const estrutura = await respEstrutura.json();
                    
                    // Cálculo da porcentagem usando os dados do backend
                    const total = estrutura.aulas_total || 0;
                    const liberadas = estrutura.aulas_liberadas || 0;
                    
                    let percent = 0;
                    if (total > 0) {
                        percent = Math.min(100, Math.round((liberadas / total) * 100));
                    }

                    // Nome real do curso que vem do banco
                    const cursoNome = estrutura.curso_nome || curso.curso_nome || slug.toUpperCase();

                    // Manda pintar o card na tela
                    renderizarCardCertificado(container, cursoNome, percent);
                }
            } catch (errEstrutura) {
                console.error(`Erro ao carregar estrutura de ${slug}:`, errEstrutura);
            }
        }

    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">Erro ao carregar seus dados. Verifique a conexão.</div>';
    }
}

function renderizarCardCertificado(container, titulo, percent) {
    const isConcluido = percent >= 100;
    
    // Substitui espaços por '+' para gerar a imagem na API de placeholder
    const textoImagem = encodeURIComponent('Certificado ' + titulo);
    
    let cardHTML = '';

    if (isConcluido) {
        // CARTÃO 100% CONCLUÍDO (FOCO NA RETIRADA PRESENCIAL)
        cardHTML = `
            <div class="certificate-card bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#00FFFF] hover:border-white transition duration-300 shadow-[0_0_20px_rgba(0,255,255,0.1)] hover:shadow-[0_0_25px_rgba(0,255,255,0.2)]">
                <div class="relative h-32 bg-cover bg-center" style="background-image: url('https://via.placeholder.com/600x300/101010/00FFFF?text=${textoImagem}')">
                    <div class="absolute inset-0 bg-black opacity-40"></div>
                    <i class="fas fa-award absolute top-4 right-4 text-3xl text-[#00FFFF] drop-shadow-[0_0_10px_#00FFFF]"></i>
                </div>
                <div class="p-4 flex flex-col h-[130px]">
                    <h3 class="text-lg font-bold text-[#00FFFF] uppercase mb-1 truncate" title="${titulo}">${titulo}</h3>
                    <p class="text-xs text-gray-400">Javis Game Academy</p>
                    
                    <div class="flex justify-between items-end flex-1 mt-3 pt-3 border-t border-[#222]">
                        <div>
                            <span class="text-xs font-bold uppercase tracking-wider text-green-400"><i class="fas fa-check-circle mr-1"></i> Concluído</span>
                        </div>
                        <button onclick="exibirAvisoRetirada('${titulo}')" class="bg-[#00FFFF] text-black text-xs font-black py-2 px-3 rounded hover:bg-cyan-400 transition-colors shadow-[0_0_10px_rgba(0,255,255,0.2)]">
                            <i class="fas fa-map-marker-alt mr-1"></i> Como Retirar
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else {
        // CARTÃO EM PROGRESSO
        cardHTML = `
            <div class="certificate-card bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333] opacity-70 grayscale-[30%]">
                <div class="relative h-32 bg-cover bg-center" style="background-image: url('https://via.placeholder.com/600x300/101010/888888?text=${textoImagem}')">
                    <div class="absolute inset-0 bg-black opacity-70"></div>
                    <i class="fas fa-hourglass-half absolute top-4 right-4 text-3xl text-gray-500"></i>
                </div>
                <div class="p-4 flex flex-col h-[130px]">
                    <h3 class="text-lg font-bold text-gray-400 uppercase mb-1 truncate" title="${titulo}">${titulo}</h3>
                    <p class="text-xs text-gray-500">Javis Game Academy</p>
                    
                    <div class="mt-auto pt-3 border-t border-[#222]">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Em Progresso</span>
                            <span class="text-xs font-bold text-gray-300">${percent}%</span>
                        </div>
                        <div class="w-full bg-[#333] rounded-full h-1.5 overflow-hidden">
                            <div class="bg-yellow-500 h-1.5 transition-all duration-1000" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    container.insertAdjacentHTML('beforeend', cardHTML);
}

// Nova função de alerta para explicar a regra da unidade
window.exibirAvisoRetirada = function(nomeCurso) {
    Swal.fire({
        title: 'Parabéns pela Conquista!',
        html: `
            Seu certificado oficial de <b>${nomeCurso}</b> já está pronto! <br><br>
            Para garantir a autenticidade e a assinatura da coordenação, os certificados impressos exclusivos devem ser retirados <b>presencialmente na secretaria da Javis</b>.<br><br>
            <span class="text-xs text-gray-400">Passe na unidade para pegar o seu e não se esqueça de tirar uma foto para marcar a gente!</span>
        `,
        icon: 'success',
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#00FFFF',
        confirmButtonText: 'Entendi, vou buscar!'
    });
}