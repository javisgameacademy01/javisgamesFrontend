import { apiGet, apiSend } from './config.js';

let todasAsAulas = [];
let aulaAtualEditando = null;

document.addEventListener('DOMContentLoaded', async () => {
    await carregarAulas();
    
    // Configura a pesquisa
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const filtradas = todasAsAulas.filter(a => 
            a.titulo.toLowerCase().includes(termo) || 
            a.curso.toLowerCase().includes(termo)
        );
        renderizarTabela(filtradas);
    });
});

async function carregarAulas() {
    try {
        todasAsAulas = await apiGet('/admin/aulas-curriculo');
        renderizarTabela(todasAsAulas);
    } catch (error) {
        console.error("Erro ao carregar aulas:", error);
        document.getElementById('aulasTableBody').innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-4">Erro ao carregar as aulas. Verifique a conexão.</td></tr>`;
    }
}

function renderizarTabela(aulas) {
    const tbody = document.getElementById('aulasTableBody');
    
    if (aulas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">Nenhuma aula encontrada.</td></tr>`;
        return;
    }

    tbody.innerHTML = aulas.map(a => {
        // Encurta o link na tabela para não quebrar o layout
        let linkCurto = a.conteudo || "Sem conteúdo";
        if (linkCurto.length > 50) linkCurto = linkCurto.substring(0, 50) + "...";
        
        const isCanva = (a.conteudo || "").includes("canva.com");
        const icone = isCanva ? '<i class="fas fa-paint-brush text-purple-400 mr-2" title="Canva Link"></i>' : '';

        return `
            <tr>
                <td>${a.id}</td>
                <td><span class="bg-[#222] text-[#00FFFF] text-xs px-2 py-1 rounded border border-[#333]">${a.curso}</span></td>
                <td class="font-medium">${a.titulo}</td>
                <td class="text-gray-400 text-xs">${icone}${linkCurto}</td>
                <td class="text-center">
                    <button onclick="abrirModal(${a.id})" class="text-[#00FFFF] hover:text-white transition bg-[#222] p-2 rounded border border-[#333] hover:border-[#00FFFF]">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.abrirModal = function(id) {
    const aula = todasAsAulas.find(a => a.id === id);
    if (!aula) return;
    
    aulaAtualEditando = id;
    document.getElementById('modalAulaId').textContent = `#${aula.id}`;
    document.getElementById('modalAulaTitulo').textContent = `${aula.curso} - ${aula.titulo}`;
    document.getElementById('modalConteudo').value = aula.conteudo || "";
    
    document.getElementById('editModal').classList.remove('hidden');
}

window.fecharModal = function() {
    document.getElementById('editModal').classList.add('hidden');
    aulaAtualEditando = null;
}

window.salvarConteudo = async function() {
    if (!aulaAtualEditando) return;
    
    const novoConteudo = document.getElementById('modalConteudo').value;
    const btn = document.querySelector('#editModal button.bg-\\[\\#00FFFF\\]');
    btn.textContent = "Salvando...";
    btn.disabled = true;

    try {
        await apiSend(`/admin/aula/${aulaAtualEditando}`, 'PUT', { conteudo: novoConteudo });
        
        Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Link salvo com sucesso!', showConfirmButton: false, timer: 3000,
            background: '#1a1a1a', color: '#00FFFF'
        });
        
        fecharModal();
        await carregarAulas(); // Recarrega a tabela para mostrar o novo link
    } catch (error) {
        Swal.fire('Erro!', 'Não foi possível salvar a aula.', 'error');
        console.error(error);
    } finally {
        btn.textContent = "Salvar Link";
        btn.disabled = false;
    }
}