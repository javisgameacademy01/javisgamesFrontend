// ==========================================
// js/funcionario/gestao-aulas.js
// ==========================================
import { apiGet, apiSend } from './config.js';
import { abrirModalUniversal, fecharModalUniversal } from './ui.js';

let todasAsAulas = [];

window.carregarAulasCurriculo = async function() {
    const tbody = document.getElementById('aulasTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8"><i class="fas fa-circle-notch fa-spin text-[#00FFFF] text-2xl"></i></td></tr>`;
    
    try {
        todasAsAulas = await apiGet('/admin/aulas-curriculo'); // Lembre-se de criar esta rota no Python
        
        if (todasAsAulas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">Nenhuma aula encontrada.</td></tr>`;
            return;
        }

        tbody.innerHTML = todasAsAulas.map(a => {
            let linkCurto = a.conteudo || "Sem conteúdo";
            if (linkCurto.length > 40) linkCurto = linkCurto.substring(0, 40) + "...";
            
            const isCanva = (a.conteudo || "").includes("canva.com");
            const icone = isCanva ? '<i class="fas fa-paint-brush text-[#00FFFF] mr-2"></i>' : '<i class="fas fa-file-alt text-gray-500 mr-2"></i>';

            return `
                <tr class="hover:bg-[#151515] transition-colors">
                    <td class="p-4 text-[#00FFFF] font-bold">#${a.id}</td>
                    <td class="p-4"><span class="bg-[#222] text-gray-300 text-[10px] uppercase font-bold px-2 py-1 rounded border border-[#333]">${a.curso}</span></td>
                    <td class="p-4 font-medium text-gray-200">${a.titulo}</td>
                    <td class="p-4 text-[11px] text-gray-500">${icone}${linkCurto}</td>
                    <td class="p-4 text-right">
                        <button onclick="editarConteudoAula(${a.id})" class="bg-[#222] hover:bg-[#00FFFF] hover:text-black text-[#00FFFF] font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-all border border-[#333] hover:border-[#00FFFF]">
                            <i class="fas fa-edit mr-1"></i> Editar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Erro ao carregar aulas:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-4">Erro ao carregar dados.</td></tr>`;
    }
}

window.editarConteudoAula = function(id) {
    const aula = todasAsAulas.find(a => a.id === id);
    if (!aula) return;

    const modalHTML = `
        <div class="space-y-4 text-left">
            <div class="bg-[#222] p-3 rounded-lg border border-[#333]">
                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Curso</p>
                <p class="text-sm font-bold text-white">${aula.curso}</p>
                <p class="text-xs text-gray-400 mt-1">${aula.titulo}</p>
            </div>
            
            <div>
                <label class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Link do Canva (Embed) ou Texto</label>
                <textarea id="modalEditConteudo" rows="4" class="w-full bg-[#0f0f0f] border border-[#333] text-white text-xs rounded-xl p-3 focus:border-[#00FFFF] outline-none" placeholder="Cole o link do Canva aqui...">${aula.conteudo || ''}</textarea>
            </div>
        </div>
    `;

    abrirModalUniversal(
        `Editar Aula #${aula.id}`, 
        modalHTML, 
        async () => {
            const novoConteudo = document.getElementById('modalEditConteudo').value;
            try {
                await apiSend(`/admin/aula/${aula.id}`, 'PUT', { conteudo: novoConteudo });
                fecharModalUniversal();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Link salvo!', showConfirmButton: false, timer: 3000, background: '#1a1a1a', color: '#00FFFF' });
                window.carregarAulasCurriculo(); // Recarrega a tabela
            } catch (err) {
                Swal.fire('Erro', 'Falha ao salvar a aula.', 'error');
            }
        }
    );
}