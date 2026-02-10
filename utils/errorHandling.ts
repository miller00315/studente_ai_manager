
export const getFriendlyErrorMessage = (error: any): string => {
    if (!error) return "Ocorreu um erro desconhecido.";
    
    // DependencyError - custom error from our repositories
    if (error.name === 'DependencyError') {
        return error.message;
    }
    
    // Postgres Error Code 23503: Foreign Key Violation
    if (error.code === '23503') {
        const msg = (error.details || error.message || '').toLowerCase();
        
        if (msg.includes('test_releases')) return "Não é possível excluir: Este item está vinculado a Agendamentos de Provas ativos.";
        if (msg.includes('test_results')) return "Não é possível excluir: Este item possui Resultados de Provas associados.";
        if (msg.includes('student_test_answers')) return "Não é possível excluir: Este item faz parte do registro de respostas de um aluno.";
        if (msg.includes('test_questions')) return "Não é possível excluir: Esta questão está sendo usada em uma Prova.";
        if (msg.includes('students')) return "Não é possível excluir: Existem Alunos matriculados ou vinculados a este item.";
        if (msg.includes('professors')) return "Não é possível excluir: Existem Professores designados a este item.";
        if (msg.includes('classes')) return "Não é possível excluir: Existem Turmas vinculadas a este item.";
        if (msg.includes('questions')) return "Não é possível excluir: Este tópico/série é usado no Banco de Questões.";
        if (msg.includes('tests')) return "Não é possível excluir: Existem Provas criadas sob esta categoria.";
        if (msg.includes('app_users')) return "Não é possível excluir: Usuários ativos estão atribuídos a esta Função/Entidade.";
        if (msg.includes('disciplines')) return "Não é possível excluir: Existem Disciplinas/Matérias vinculadas a isso.";
        
        return "Não é possível excluir: Este registro é referenciado por outros dados. Remova as dependências primeiro.";
    }

    return error.message || String(error);
};
