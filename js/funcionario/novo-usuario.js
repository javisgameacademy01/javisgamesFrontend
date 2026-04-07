import { API_URL, fetchAdmin } from './config.js';

/**
 * Busca no banco os alunos que ainda não possuem um user_id (sem login)
 * e preenche o `<select>` do formulário.
 */
export async function carregarAlunosParaNovoUsuario() {
    const select = document.getElementById('novoUsuarioAluno');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Carregando alunos...</option>';

    try {
        const res = await fetchAdmin(`${API_URL}/admin/listar-alunos`);
        const alunos = await res.json();

        // Filtra apenas os alunos que NÃO possuem user_id
        const alunosSemLogin = alunos.filter(a => !a.user_id);

        if (alunosSemLogin.length === 0) {
            select.innerHTML = '<option value="" disabled selected>Todos os alunos já possuem login.</option>';
            return;
        }

        select.innerHTML = '<option value="" disabled selected>Selecione um aluno...</option>';
        
        alunosSemLogin.forEach(aluno => {
            // Exibe o nome e o CPF para facilitar a identificação
            const opt = new Option(`${aluno.nome_completo} (CPF: ${aluno.cpf || 'N/A'})`, aluno.id_aluno);
            select.appendChild(opt);
        });

    } catch (error) {
        console.error("Erro ao carregar alunos para novo usuário:", error);
        select.innerHTML = '<option value="" disabled selected>Erro ao carregar a lista.</option>';
    }
}

/**
 * Disparado quando o formulário é enviado. Captura os dados e cria a conta no Supabase Auth.
 */
export async function enviarCriacaoLoginAluno(event) {
    event.preventDefault(); // Evita que a página recarregue

    const id_aluno = document.getElementById('novoUsuarioAluno').value;
    const email = document.getElementById('novoUsuarioEmail').value;
    const senha = document.getElementById('novoUsuarioSenha').value;

    // Validação de segurança
    if (!id_aluno || !email || !senha) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Preencha todos os campos antes de continuar.',
            background: '#1a1a1a',
            color: '#fff'
        });
        return;
    }

    if (senha.length < 6) {
        Swal.fire({
            icon: 'warning',
            title: 'Senha muito curta',
            text: 'A senha deve ter pelo menos 6 caracteres.',
            background: '#1a1a1a',
            color: '#fff'
        });
        return;
    }

    Swal.fire({
        title: 'Criando acesso...',
        text: 'Registrando o aluno no sistema de autenticação.',
        allowOutsideClick: false,
        background: '#1a1a1a',
        color: '#fff',
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await fetchAdmin(`${API_URL}/admin/criar-login-aluno`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // <-- O SEGREDO DO 422 ESTÁ AQUI
            },
            body: JSON.stringify({
                id_aluno: parseInt(id_aluno),
                email: email,
                senha: senha
            })
        });

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Sucesso!',
                text: 'O login do aluno foi criado e vinculado.',
                background: '#1a1a1a',
                color: '#fff'
            });
            
            // Limpa o formulário
            document.getElementById('formNovoUsuario').reset();
            
            // Recarrega a lista (o aluno criado vai sumir do select)
            carregarAlunosParaNovoUsuario();
        } else {
            // TRATAMENTO DE ERRO MELHORADO (Fim do [object Object])
            let erroFormatado = 'Erro ao criar login no servidor.';
            if (Array.isArray(data.detail)) {
                // Traduz os erros do FastAPI de forma legível
                erroFormatado = data.detail.map(e => `Campo '${e.loc[e.loc.length-1]}': ${e.msg}`).join('<br>');
            } else if (data.detail) {
                erroFormatado = data.detail;
            }
            throw new Error(erroFormatado);
        }
    } catch (error) {
        console.error("Erro na criação de login:", error);
        Swal.fire({
            icon: 'error',
            title: 'Falha na Operação',
            html: error.message, // Usando html em vez de text para quebrar linha se houver mais de um erro
            background: '#1a1a1a',
            color: '#fff'
        });
    }
}