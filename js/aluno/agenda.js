document.addEventListener('DOMContentLoaded', function() {
    const token = getTokenOrRedirect();
    if (!token) return;

    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                // Chama a nova rota de agenda geral
                const eventos = await apiGet('/aluno/agenda-geral', token);
                successCallback(eventos);
            } catch (error) {
                console.error("Erro ao carregar agenda:", error);
                failureCallback(error);
            }
        },
        eventClick: function(info) {
            const props = info.event.extendedProps;
            const dataHora = info.event.start.toLocaleString('pt-BR');
            
            let htmlConteudo = '';
            let swalIcon = 'info';
            let swalColor = '#00FFFF';

            // MODO FERIADO
            if (props.tipo === 'feriado') {
                htmlConteudo = `
                    <div class="text-center text-sm space-y-3">
                        <i class="fas fa-umbrella-beach text-4xl text-red-400 mb-2"></i>
                        <p class="text-gray-300">Neste dia a Javis estará fechada e <b>não haverá aula</b>.</p>
                        <p class="text-xs text-gray-500 mt-4">Aproveite para descansar e jogar um pouco!</p>
                    </div>
                `;
                swalIcon = 'info';
                swalColor = '#EF4444'; // Vermelho
            } 
            // MODO REPOSIÇÃO OU REGULAR
            else {
                htmlConteudo = `
                    <div class="text-left text-sm space-y-2">
                        <p><b>📅 Horário:</b> ${props.horario || dataHora.split(',')[1]}</p>
                        <p><b>🆔 Turma:</b> ${props.turma}</p>
                `;

                if(props.tipo === 'reposicao') {
                    htmlConteudo += `
                        <p><b>📝 Conteúdo:</b> ${props.conteudo || 'Não informado'}</p>
                        <p><b>Status:</b> <span class="px-2 py-0.5 rounded bg-yellow-900 text-yellow-300">${props.status}</span></p>
                    `;
                    swalIcon = 'warning';
                    swalColor = '#EAB308'; // Amarelo
                }

                htmlConteudo += `</div>`;
            }

            Swal.fire({
                title: info.event.title,
                html: htmlConteudo,
                icon: swalIcon,
                background: '#1a1a1a',
                color: '#fff',
                confirmButtonColor: swalColor,
                confirmButtonText: 'Entendi'
            });
        }
    });

    calendar.render();
});