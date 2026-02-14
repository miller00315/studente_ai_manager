import { SupabaseClient } from '@supabase/supabase-js';
import {
    IQuestionRepository, ITestRepository, IProfessorRepository, IStudentRepository,
    IInstitutionRepository, IClassRepository, IAIRepository, IAIAgentRepository,
    ITestReleaseRepository, IUserRuleRepository, ISettingsRepository, ILibraryRepository,
    IBNCCRepository, IClassroomRoomRepository, IClassroomMessageRepository, IMessageReactionRepository,
    IStudentDisabilityRepository, IReportRepository
} from '../domain/interfaces';
import {
    Question, Test, Professor, Institution, SchoolClass, Student, TestResult,
    AIAgent, TestRelease, UserRule, UserRegistrationDTO, InstitutionType,
    SchoolGrade, Department, Discipline, AIQuestionParams, AnalyzedSheet,
    Address, TestReleaseSite, Library, LibraryItem, TestResultCorrectionLog, StudentTestAnswer, TestAttemptLog,
    BNCCItem, ClassroomRoom, ClassroomMessage, MessageReaction, MessageReactionType, MessageReactionCounts,
    StudentDisability, ClassPerformanceReport, StudentPerformanceReport, TestPerformanceReport, ReportDateFilter,
    InstitutionPerformanceReport, ProfessorPerformanceReport, ClassPerformanceSummary, TestPerformanceSummary
} from '../types';
import { generateQuestionsWithAI, analyzeAnswerSheet, embedText, chatWithAgent } from '../services/geminiService';

// Classe de erro customizada para violações de dependência
export class DependencyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DependencyError';
    }
}

export class QuestionRepositoryImpl implements IQuestionRepository {
    constructor(private supabase: SupabaseClient) { }

    async getQuestions(includeDeleted = false): Promise<Question[]> {
        let query = this.supabase
            .from('questions')
            .select(`
                *, 
                question_options(*),
                school_grades(name)
            `);

        if (!includeDeleted) {
            query = query.eq('deleted', false);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data as Question[];
    }

    async saveQuestion(question: Partial<Question>, options: any[], imageFile?: File): Promise<void> {
        let qId = question.id;

        // Handle Image Upload
        let imageUrl = question.image_url;
        if (imageFile) {
            const fileName = `q_${Date.now()}_${imageFile.name}`;
            const { error: uploadError } = await this.supabase.storage.from('question_images').upload(fileName, imageFile);
            if (uploadError) throw uploadError;
            const { data } = this.supabase.storage.from('question_images').getPublicUrl(fileName);
            imageUrl = data.publicUrl;
        }

        if (qId) {
            await this.supabase.from('questions').update({ ...question, image_url: imageUrl }).eq('id', qId);
        } else {
            const { data, error } = await this.supabase.from('questions').insert({ ...question, image_url: imageUrl }).select().single();
            if (error) throw error;
            qId = data.id;
        }

        if (options && options.length > 0) {
            const optionsWithQId = options.map(o => ({ ...o, question_id: qId }));
            if (question.id) {
                await this.supabase.from('question_options').delete().eq('question_id', qId);
            }
            await this.supabase.from('question_options').insert(optionsWithQId);
        }
    }

    async deleteQuestion(id: string): Promise<void> {
        // Check if question is used in any test
        const { count: testCount } = await this.supabase
            .from('test_questions')
            .select('id', { count: 'exact', head: true })
            .eq('question_id', id);

        if (testCount && testCount > 0) {
            throw new DependencyError(`Não é possível excluir esta questão. Ela está sendo usada em ${testCount} prova(s). Remova a questão das provas primeiro.`);
        }

        await this.supabase.from('questions').update({ deleted: true }).eq('id', id);
    }

    async restoreQuestion(id: string): Promise<void> {
        await this.supabase.from('questions').update({ deleted: false }).eq('id', id);
    }
}

export class TestRepositoryImpl implements ITestRepository {
    constructor(private supabase: SupabaseClient) { }

    async getTests(includeDeleted = false): Promise<Test[]> {
        let query = this.supabase.from('tests').select('*, professors(app_users(first_name, last_name)), school_grades(name), institutions(name)');
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data.map((t: any) => ({
            ...t,
            professors: t.professors ? {
                ...t.professors,
                name: `${t.professors.app_users?.first_name || ''} ${t.professors.app_users?.last_name || ''}`.trim()
            } : null
        })) as unknown as Test[];
    }

    async getTestsByInstitution(institutionId: string, includeDeleted = false): Promise<Test[]> {
        let query = this.supabase.from('tests').select('*, professors(app_users(first_name, last_name)), school_grades(name), institutions(name)').eq('institution_id', institutionId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data.map((t: any) => ({
            ...t,
            professors: t.professors ? {
                ...t.professors,
                name: `${t.professors.app_users?.first_name || ''} ${t.professors.app_users?.last_name || ''}`.trim()
            } : null
        })) as unknown as Test[];
    }

    async getTestsByProfessor(professorId: string, includeDeleted = false): Promise<Test[]> {
        let query = this.supabase.from('tests').select('*, professors(app_users(first_name, last_name)), school_grades(name), institutions(name)').eq('professor_id', professorId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data.map((t: any) => ({
            ...t,
            professors: t.professors ? {
                ...t.professors,
                name: `${t.professors.app_users?.first_name || ''} ${t.professors.app_users?.last_name || ''}`.trim()
            } : null
        })) as unknown as Test[];
    }

    async createTest(test: Partial<Test>, questionIds: string[], weights?: Record<string, number>): Promise<void> {
        const { data, error } = await this.supabase.from('tests').insert(test).select().single();
        if (error) throw error;

        const testId = data.id;
        if (questionIds.length > 0) {
            const junction = questionIds.map((qid, index) => ({
                test_id: testId,
                question_id: qid,
                order_index: index,
                weight: weights ? (weights[qid] || 1) : 1
            }));
            await this.supabase.from('test_questions').insert(junction);
        }
    }

    async updateTest(id: string, test: Partial<Test>, questionIds: string[], weights?: Record<string, number>): Promise<void> {
        const { error } = await this.supabase.from('tests').update(test).eq('id', id);
        if (error) throw error;

        await this.supabase.from('test_questions').delete().eq('test_id', id);
        if (questionIds.length > 0) {
            const junction = questionIds.map((qid, index) => ({
                test_id: id,
                question_id: qid,
                order_index: index,
                weight: weights ? (weights[qid] || 1) : 1
            }));
            await this.supabase.from('test_questions').insert(junction);
        }
    }

    async getTestDetails(id: string): Promise<Test> {
        const { data, error } = await this.supabase
            .from('tests')
            .select(`
                *,
                professors(app_users(first_name, last_name)),
                school_grades(name),
                institutions(name),
                test_questions(
                    weight,
                    order_index,
                    questions(
                        id, content, difficulty, image_url,
                        question_options(id, content, key, is_correct)
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        const questions = data.test_questions.map((tq: any) => ({
            ...tq.questions,
            weight: tq.weight,
            order_index: tq.order_index
        })).sort((a: any, b: any) => a.order_index - b.order_index);

        return {
            ...data,
            professors: data.professors ? {
                ...data.professors,
                name: `${data.professors.app_users?.first_name || ''} ${data.professors.app_users?.last_name || ''}`.trim()
            } : null,
            questions
        } as Test;
    }

    async deleteTest(id: string): Promise<void> {
        // Check for test results and active releases
        const [results, releases] = await Promise.all([
            this.supabase.from('test_results').select('id', { count: 'exact', head: true }).eq('test_id', id),
            this.supabase.from('test_releases').select('id', { count: 'exact', head: true })
                .eq('test_id', id).eq('completed', false)
        ]);

        const dependencies: string[] = [];
        if (results.count && results.count > 0) dependencies.push(`${results.count} resultado(s) de alunos`);
        if (releases.count && releases.count > 0) dependencies.push(`${releases.count} liberação(ões) pendente(s)`);

        if (dependencies.length > 0) {
            throw new DependencyError(`Não é possível excluir esta prova. Existem registros vinculados: ${dependencies.join(', ')}. A exclusão preservaria dados históricos incorretamente.`);
        }

        await this.supabase.from('tests').update({ deleted: true }).eq('id', id);
    }

    async restoreTest(id: string): Promise<void> {
        await this.supabase.from('tests').update({ deleted: false }).eq('id', id);
    }

    async getResults(includeDeleted = false): Promise<TestResult[]> {
        const { data, error } = await this.supabase
            .from('test_results')
            .select('*, tests(title, school_grades(name), institutions(name)), test_result_correction_logs(count)')
            .order('correction_date', { ascending: false });
        if (error) throw error;
        return data as any;
    }

    async getResultsByInstitution(institutionId: string): Promise<TestResult[]> {
        const { data, error } = await this.supabase
            .from('test_results')
            .select('*, tests!inner(title, school_grades(name), institution_id, institutions(name)), test_result_correction_logs(count)')
            .eq('tests.institution_id', institutionId)
            .order('correction_date', { ascending: false });
        if (error) throw error;
        return data as any;
    }

    async getResultsByProfessor(professorId: string): Promise<TestResult[]> {
        const { data, error } = await this.supabase
            .from('test_results')
            .select('*, tests!inner(title, professor_id, school_grades(name)), test_result_correction_logs(count)')
            .eq('tests.professor_id', professorId)
            .order('correction_date', { ascending: false });
        if (error) throw error;
        return data as any;
    }

    async getResultsByStudent(studentId: string): Promise<TestResult[]> {
        const { data, error } = await this.supabase
            .from('test_results')
            .select('*, tests(title, school_grades(name), institutions(name)), test_result_correction_logs(count)')
            .eq('student_id', studentId)
            .order('correction_date', { ascending: false });
        if (error) throw error;
        return data as any;
    }

    async saveResult(result: Partial<TestResult>, gradedQuestions: any[]): Promise<void> {
        const { data, error } = await this.supabase.from('test_results').insert(result).select().single();
        if (error) throw error;

        if (gradedQuestions && gradedQuestions.length > 0) {
            const answers = gradedQuestions.map(q => ({
                test_result_id: data.id,
                question_id: q.questionId,
                selected_option_id: q.selectedOptionId,
                is_correct: q.isCorrect
            }));
            await this.supabase.from('student_test_answers').insert(answers);
        }
    }

    async updateAnswer(resultId: string, questionId: string, newOptionId: string, originalOptionId?: string): Promise<void> {
        await this.supabase.from('test_result_correction_logs').insert({
            test_result_id: resultId,
            question_id: questionId,
            original_option_id: originalOptionId,
            new_option_id: newOptionId,
            reason: 'Manual Correction by Teacher'
        });

        const { data: existing } = await this.supabase.from('student_test_answers')
            .select('id')
            .match({ test_result_id: resultId, question_id: questionId })
            .maybeSingle();

        const { data: option } = await this.supabase.from('question_options').select('is_correct').eq('id', newOptionId).single();
        const isCorrect = option?.is_correct || false;

        if (existing) {
            await this.supabase.from('student_test_answers').update({
                selected_option_id: newOptionId,
                is_correct: isCorrect
            }).eq('id', existing.id);
        } else {
            await this.supabase.from('student_test_answers').insert({
                test_result_id: resultId,
                question_id: questionId,
                selected_option_id: newOptionId,
                is_correct: isCorrect
            });
        }

        // Recalcular e atualizar a nota após a correção
        await this.recalculateScore(resultId);
    }

    async recalculateScore(resultId: string): Promise<void> {
        // Buscar todas as respostas do aluno para este resultado
        const { data: answers, error: ansError } = await this.supabase
            .from('student_test_answers')
            .select('is_correct')
            .eq('test_result_id', resultId);

        if (ansError) throw ansError;

        // Contar acertos e erros
        const totalQuestions = answers?.length || 0;
        const correctCount = answers?.filter(a => a.is_correct).length || 0;
        const errorCount = totalQuestions - correctCount;

        // Calcular nota (acertos / total * 100)
        const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

        // Atualizar score, correct_count e error_count na tabela test_results
        const { error: updateError } = await this.supabase
            .from('test_results')
            .update({
                score,
                correct_count: correctCount,
                error_count: errorCount
            })
            .eq('id', resultId);

        if (updateError) throw updateError;
    }

    async getLogs(resultId: string): Promise<TestResultCorrectionLog[]> {
        const { data, error } = await this.supabase
            .from('test_result_correction_logs')
            .select('*, questions(content), original_option:question_options!original_option_id(content), new_option:question_options!new_option_id(content)')
            .eq('test_result_id', resultId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as any;
    }

    async getStudentAnswers(resultId: string): Promise<StudentTestAnswer[]> {
        const { data, error } = await this.supabase
            .from('student_test_answers')
            .select('*')
            .eq('test_result_id', resultId);
        if (error) throw error;
        return data as StudentTestAnswer[];
    }

    async getAttemptLogs(testId: string, studentId: string): Promise<TestAttemptLog[]> {
        const { data, error } = await this.supabase
            .from('test_attempt_logs')
            .select('*, test_releases!inner(test_id, student_id)')
            .eq('test_releases.test_id', testId)
            .eq('test_releases.student_id', studentId)
            .order('start_time', { ascending: false });
        if (error) throw error;
        return data as any;
    }
}

export class ProfessorRepositoryImpl implements IProfessorRepository {
    constructor(private supabase: SupabaseClient) { }

    async getProfessors(includeDeleted = false): Promise<Professor[]> {
        let query = this.supabase.from('professors').select('*, app_users(first_name, last_name, email, profile_picture_url), departments(code, institution_id, institutions(name))');
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;

        return data.map((p: any) => ({
            ...p,
            name: `${p.app_users?.first_name} ${p.app_users?.last_name}`,
            email: p.app_users?.email,
            department: p.departments?.code
        }));
    }

    async getProfessorsByInstitution(institutionId: string, includeDeleted = false): Promise<Professor[]> {
        let query = this.supabase.from('professors').select('*, app_users(first_name, last_name, email, profile_picture_url), departments!inner(code, institution_id, institutions(name))').eq('departments.institution_id', institutionId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;

        return data.map((p: any) => ({
            ...p,
            name: `${p.app_users?.first_name} ${p.app_users?.last_name}`,
            email: p.app_users?.email,
            department: p.departments?.code
        }));
    }

    async getProfessorDetails(id: string): Promise<Professor> {
        const { data, error } = await this.supabase.from('professors')
            .select('*, app_users(first_name, last_name, email, profile_picture_url), departments(code, institution_id, institutions(name))')
            .eq('id', id)
            .single();
        if (error) throw error;
        return {
            ...data,
            name: `${data.app_users?.first_name} ${data.app_users?.last_name}`,
            email: data.app_users?.email,
            department: data.departments?.code
        };
    }

    async addProfessor(professor: UserRegistrationDTO, file?: File, address?: Partial<Address>): Promise<void> {
        let profileUrl = '';
        if (file) {
            const fileName = `prof_${Date.now()}_${file.name}`;
            await this.supabase.storage.from('avatars').upload(fileName, file);
            const { data } = this.supabase.storage.from('avatars').getPublicUrl(fileName);
            profileUrl = data.publicUrl;
        }

        let ruleId = professor.rule_id;
        if (!ruleId) {
            // Busca case-insensitive por Teacher, professor, docente
            const { data: rules, error: rulesError } = await this.supabase
                .from('user_rules')
                .select('id, rule_name')
                .eq('deleted', false);

            if (rulesError) throw rulesError;

            if (rules && rules.length > 0) {
                const teacherRule = rules.find(r => {
                    const name = (r.rule_name || '').toLowerCase().trim();
                    return ['teacher', 'professor', 'docente'].includes(name);
                });
                ruleId = teacherRule?.id;
            }

            // Fallback: se não encontrou, tenta busca exata com 'Teacher'
            if (!ruleId) {
                const { data: userRule, error: fallbackError } = await this.supabase
                    .from('user_rules')
                    .select('id')
                    .eq('rule_name', 'Teacher')
                    .eq('deleted', false)
                    .maybeSingle();
                if (fallbackError) throw fallbackError;
                ruleId = userRule?.id;
            }

            // Se ainda não encontrou, lança erro
            if (!ruleId) {
                throw new Error(`Regra de usuário 'Teacher' não encontrada. Regras disponíveis: ${rules?.map(r => r.rule_name).join(', ') || 'nenhuma'}`);
            }
        }

        let addressId = null;
        if (address && (address.address_line_1 || address.city || address.country)) {
            // Limpar campos vazios antes de inserir
            const cleanAddress: any = {};
            if (address.address_line_1) cleanAddress.address_line_1 = address.address_line_1;
            if (address.city) cleanAddress.city = address.city;
            if (address.state_province) cleanAddress.state_province = address.state_province;
            if (address.postal_code) cleanAddress.postal_code = address.postal_code;
            if (address.country) cleanAddress.country = address.country;

            const { data: addrData, error: addrError } = await this.supabase.from('addresses').insert(cleanAddress).select().single();
            if (addrError) throw addrError;
            addressId = addrData.id;
        }

        const { data: userData, error: userError } = await this.supabase.from('app_users').insert({
            email: professor.email,
            first_name: professor.first_name,
            last_name: professor.last_name,
            rule_id: ruleId,
            profile_picture_url: profileUrl,
            address_id: addressId
        }).select().single();

        if (userError) throw userError;

        await this.supabase.from('professors').insert({
            user_id: userData.id,
            department_id: professor.department_id
        });
    }

    async updateProfessor(id: string, professor: Partial<Professor>): Promise<void> {
        await this.supabase.from('professors').update(professor).eq('id', id);
    }

    async removeProfessor(id: string): Promise<void> {
        // Check for active dependencies: disciplines and tests
        const [disciplines, tests] = await Promise.all([
            this.supabase.from('disciplines').select('id', { count: 'exact', head: true })
                .eq('professor_id', id).eq('deleted', false),
            this.supabase.from('tests').select('id', { count: 'exact', head: true })
                .eq('professor_id', id).eq('deleted', false)
        ]);

        const dependencies: string[] = [];
        if (disciplines.count && disciplines.count > 0) dependencies.push(`${disciplines.count} disciplina(s)`);
        if (tests.count && tests.count > 0) dependencies.push(`${tests.count} prova(s)`);

        if (dependencies.length > 0) {
            throw new DependencyError(`Não é possível excluir este professor. Existem registros ativos vinculados: ${dependencies.join(', ')}. Reatribua ou remova os itens dependentes primeiro.`);
        }

        await this.supabase.from('professors').update({ deleted: true }).eq('id', id);
    }

    async restoreProfessor(id: string): Promise<void> {
        await this.supabase.from('professors').update({ deleted: false }).eq('id', id);
    }

    // --- Extra Methods for Detail View ---
    async getAssignedClasses(professorId: string): Promise<SchoolClass[]> {
        const { data, error } = await this.supabase
            .from('class_professors')
            .select('classes(*, school_grades(name), institutions(name))')
            .eq('professor_id', professorId);
        if (error) throw error;
        return data.map((cp: any) => cp.classes);
    }

    async getTests(professorId: string): Promise<Test[]> {
        const { data, error } = await this.supabase
            .from('tests')
            .select('*, school_grades(name)')
            .eq('professor_id', professorId)
            .eq('deleted', false);
        if (error) throw error;
        return data as Test[];
    }

    async getDisciplines(professorId: string): Promise<Discipline[]> {
        const { data, error } = await this.supabase
            .from('disciplines')
            .select('*, school_grades(name)')
            .eq('professor_id', professorId)
            .eq('deleted', false);
        if (error) throw error;
        return (data || []) as Discipline[];
    }

    async getStudents(professorId: string): Promise<Student[]> {
        // 1. Get classes directly assigned via class_professors
        const { data: classProfessors, error: cpError } = await this.supabase
            .from('class_professors')
            .select('class_id')
            .eq('professor_id', professorId);

        if (cpError) throw cpError;

        const directClassIds = (classProfessors || []).map(cp => cp.class_id).filter(Boolean);

        // 2. Get classes through disciplines (professor teaches disciplines that belong to grades, and those grades have classes)
        const { data: disciplines, error: discError } = await this.supabase
            .from('disciplines')
            .select('grade_id')
            .eq('professor_id', professorId)
            .eq('deleted', false);

        if (discError) throw discError;

        let classesViaDisciplines: string[] = [];
        if (disciplines && disciplines.length > 0) {
            const gradeIds = [...new Set(disciplines.map(d => d.grade_id).filter(Boolean))] as string[];

            if (gradeIds.length > 0) {
                const { data: classesByGrade, error: classesError } = await this.supabase
                    .from('classes')
                    .select('id')
                    .in('grade_id', gradeIds)
                    .eq('deleted', false);

                if (classesError) throw classesError;
                classesViaDisciplines = (classesByGrade || []).map(c => c.id).filter(Boolean);
            }
        }

        // Combine both sources and remove duplicates
        const allClassIds = [...new Set([...directClassIds, ...classesViaDisciplines])];

        if (allClassIds.length === 0) {
            return [];
        }

        // Now fetch students from all these classes
        const { data: studentsData, error: studentsError } = await this.supabase
            .from('students')
            .select(`
                *,
                app_users(*),
                school_grades(name),
                classes(id, name, institution_id, institutions(name))
            `)
            .in('class_id', allClassIds)
            .eq('deleted', false);

        if (studentsError) throw studentsError;

        // Map and format students
        const students: Student[] = (studentsData || []).map((s: any) => ({
            ...s,
            name: `${s.app_users?.first_name || ''} ${s.app_users?.last_name || ''}`.trim() || s.app_users?.email || 'Unknown',
            email: s.app_users?.email,
            institution_id: s.institution_id || s.classes?.institution_id,
            institutions: s.institutions || s.classes?.institutions || (s.classes?.institution_id ? { id: s.classes.institution_id, name: s.classes.institutions?.name || '' } : undefined)
        }));

        // Remove duplicates by ID
        const uniqueStudents = students.filter((student, index, self) =>
            index === self.findIndex(s => s.id === student.id)
        );

        return uniqueStudents;
    }

    async assignToClass(professorId: string, classId: string): Promise<void> {
        await this.supabase.from('class_professors').insert({ professor_id: professorId, class_id: classId });
    }

    async removeFromClass(professorId: string, classId: string): Promise<void> {
        await this.supabase.from('class_professors').delete().match({ professor_id: professorId, class_id: classId });
    }

    async uploadProfessorImage(id: string, file: File): Promise<string | null> {
        const fileName = `prof_updated_${Date.now()}_${file.name}`;
        const { error } = await this.supabase.storage.from('avatars').upload(fileName, file);
        if (error) throw error;
        const { data } = this.supabase.storage.from('avatars').getPublicUrl(fileName);

        // Update user record
        const { data: prof } = await this.supabase.from('professors').select('user_id').eq('id', id).single();
        if (prof) {
            await this.supabase.from('app_users').update({ profile_picture_url: data.publicUrl }).eq('id', prof.user_id);
        }
        return data.publicUrl;
    }
}

export class StudentRepositoryImpl implements IStudentRepository {
    constructor(private supabase: SupabaseClient) { }

    async getStudents(includeDeleted = false): Promise<Student[]> {
        let query = this.supabase.from('students').select('*, app_users(first_name, last_name, email, profile_picture_url), school_grades(name), classes(name), institutions(name)');
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;

        return data.map((s: any) => ({
            ...s,
            name: `${s.app_users?.first_name} ${s.app_users?.last_name}`,
            email: s.app_users?.email
        }));
    }

    async getStudentsByInstitution(institutionId: string, includeDeleted = false): Promise<Student[]> {
        let query = this.supabase.from('students').select('*, app_users(first_name, last_name, email, profile_picture_url), school_grades(name), classes(name), institutions(name)').eq('institution_id', institutionId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;

        return data.map((s: any) => ({
            ...s,
            name: `${s.app_users?.first_name} ${s.app_users?.last_name}`,
            email: s.app_users?.email
        }));
    }

    async getStudentsByClass(classId: string): Promise<Student[]> {
        const { data, error } = await this.supabase
            .from('students')
            .select('*, app_users(first_name, last_name, email, profile_picture_url), school_grades(name), institutions(name)')
            .eq('class_id', classId)
            .eq('deleted', false);

        if (error) throw error;

        return data.map((s: any) => ({
            ...s,
            name: `${s.app_users?.first_name} ${s.app_users?.last_name}`,
            email: s.app_users?.email
        }));
    }

    async addStudent(student: UserRegistrationDTO, file?: File, address?: Partial<Address>): Promise<void> {
        let profileUrl = '';
        if (file) {
            const fileName = `student_${Date.now()}_${file.name}`;
            await this.supabase.storage.from('avatars').upload(fileName, file);
            const { data } = this.supabase.storage.from('avatars').getPublicUrl(fileName);
            profileUrl = data.publicUrl;
        }

        let ruleId = student.rule_id;
        if (!ruleId) {
            // Busca case-insensitive por Student, aluno
            const { data: rules, error: rulesError } = await this.supabase
                .from('user_rules')
                .select('id, rule_name')
                .eq('deleted', false);

            if (rulesError) throw rulesError;

            if (rules && rules.length > 0) {
                const studentRule = rules.find(r => {
                    const name = (r.rule_name || '').toLowerCase().trim();
                    return ['student', 'aluno'].includes(name);
                });
                ruleId = studentRule?.id;
            }

            // Fallback: se não encontrou, tenta busca exata com 'Student'
            if (!ruleId) {
                const { data: userRule, error: fallbackError } = await this.supabase
                    .from('user_rules')
                    .select('id')
                    .eq('rule_name', 'Student')
                    .eq('deleted', false)
                    .maybeSingle();
                if (fallbackError) throw fallbackError;
                ruleId = userRule?.id;
            }

            // Se ainda não encontrou, lança erro
            if (!ruleId) {
                throw new Error(`Regra de usuário 'Student' não encontrada. Regras disponíveis: ${rules?.map(r => r.rule_name).join(', ') || 'nenhuma'}`);
            }
        }

        let addressId = null;
        if (address && (address.address_line_1 || address.city || address.country)) {
            // Limpar campos vazios antes de inserir
            const cleanAddress: any = {};
            if (address.address_line_1) cleanAddress.address_line_1 = address.address_line_1;
            if (address.city) cleanAddress.city = address.city;
            if (address.state_province) cleanAddress.state_province = address.state_province;
            if (address.postal_code) cleanAddress.postal_code = address.postal_code;
            if (address.country) cleanAddress.country = address.country;

            const { data: addrData, error: addrError } = await this.supabase.from('addresses').insert(cleanAddress).select().single();
            if (addrError) throw addrError;
            addressId = addrData.id;
        }

        const { data: userData, error: userError } = await this.supabase.from('app_users').insert({
            email: student.email,
            first_name: student.first_name,
            last_name: student.last_name,
            rule_id: ruleId,
            profile_picture_url: profileUrl,
            address_id: addressId
        }).select().single();

        if (userError) throw userError;

        const hash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await this.supabase.from('students').insert({
            user_id: userData.id,
            grade_id: student.grade_id,
            class_id: student.class_id || null,
            institution_id: student.institution_id,
            age: student.age || null,
            student_hash: hash
        });
    }

    async updateStudent(id: string, student: Partial<Student>): Promise<void> {
        await this.supabase.from('students').update(student).eq('id', id);
    }

    async removeStudent(id: string): Promise<void> {
        // Check for test results
        const { count: resultCount } = await this.supabase
            .from('test_results')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', id);

        // Check for active test releases
        const { count: releaseCount } = await this.supabase
            .from('test_releases')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', id)
            .eq('completed', false);

        const dependencies: string[] = [];
        if (resultCount && resultCount > 0) dependencies.push(`${resultCount} resultado(s) de prova`);
        if (releaseCount && releaseCount > 0) dependencies.push(`${releaseCount} liberação(ões) de prova pendente(s)`);

        if (dependencies.length > 0) {
            throw new DependencyError(`Não é possível excluir este aluno. Existem registros vinculados: ${dependencies.join(', ')}. Esses dados históricos serão preservados.`);
        }

        await this.supabase.from('students').update({ deleted: true }).eq('id', id);
    }

    async restoreStudent(id: string): Promise<void> {
        await this.supabase.from('students').update({ deleted: false }).eq('id', id);
    }

    async getStudentHistory(studentId: string): Promise<TestResult[]> {
        const { data, error } = await this.supabase
            .from('test_results')
            .select('*, tests(title, professor_id, school_grades(name), professors(app_users(first_name, last_name)))')
            .eq('student_id', studentId)
            .order('correction_date', { ascending: false });
        if (error) throw error;
        return data.map((r: any) => ({
            ...r,
            tests: r.tests ? {
                ...r.tests,
                professor_id: r.tests.professor_id, // Garantir que professor_id está no objeto
                professors: r.tests.professors ? {
                    ...r.tests.professors,
                    name: `${r.tests.professors.app_users?.first_name || ''} ${r.tests.professors.app_users?.last_name || ''}`.trim()
                } : null
            } : null
        })) as any;
    }

    async uploadStudentImage(id: string, file: File): Promise<string | null> {
        const fileName = `stu_updated_${Date.now()}_${file.name}`;
        const { error } = await this.supabase.storage.from('avatars').upload(fileName, file);
        if (error) throw error;
        const { data } = this.supabase.storage.from('avatars').getPublicUrl(fileName);

        const { data: stu } = await this.supabase.from('students').select('user_id').eq('id', id).single();
        if (stu) {
            await this.supabase.from('app_users').update({ profile_picture_url: data.publicUrl }).eq('id', stu.user_id);
        }
        return data.publicUrl;
    }
}

export class InstitutionRepositoryImpl implements IInstitutionRepository {
    constructor(private supabase: SupabaseClient) { }

    async getInstitutions(includeDeleted = false): Promise<Institution[]> {
        let query = this.supabase.from('institutions').select('*, institution_types(name), addresses(*), manager:app_users!manager_id(first_name, last_name, email)');
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;
        return data as Institution[];
    }

    async getInstitutionDetails(id: string): Promise<Institution> {
        const { data, error } = await this.supabase.from('institutions')
            .select('*, institution_types(name), addresses(*), manager:app_users!manager_id(id, first_name, last_name, email, stripe_id)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Institution;
    }

    async createStripeCustomerForManager(managerId: string): Promise<boolean> {
        try {
            const { data, error } = await this.supabase.functions.invoke('create-stripe-customer', {
                body: { app_user_id: managerId }
            });

            if (error) {
                // Try to parse error context for more details
                const errorContext = (error as any).context;
                if (errorContext) {
                    try {
                        const errorBody = await errorContext.json();
                        // If already synced, consider it a success
                        if (errorBody?.ok || errorBody?.message === 'already synced') {
                            return true;
                        }
                    } catch {
                        // Couldn't parse error body
                    }
                }
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    async addInstitution(institution: Partial<Institution>, address?: Partial<Address>, manager?: UserRegistrationDTO): Promise<void> {
        let managerId = null;
        // Only create manager if required fields are provided
        if (manager && manager.email && manager.first_name) {
            let ruleId = manager.rule_id;
            if (!ruleId) {
                const { data: userRule } = await this.supabase.from('user_rules').select('id').eq('rule_name', 'Institution').single();
                ruleId = userRule?.id;
            }
            const { data: userData, error: userError } = await this.supabase.from('app_users').insert({
                email: manager.email,
                first_name: manager.first_name,
                last_name: manager.last_name || '',
                rule_id: ruleId
            }).select().single();
            if (userError) throw userError;
            managerId = userData.id;
            // Stripe customer will be created automatically by database trigger
        }

        // First create address if provided and has valid data, then use its ID for the institution
        let addressId = null;
        if (address && (address.address_line_1 || address.city || address.country)) {
            const { data: addrData, error: addrError } = await this.supabase.from('addresses').insert(address).select().single();
            if (addrError) throw addrError;
            addressId = addrData.id;
        }

        await this.supabase.from('institutions').insert({
            ...institution,
            manager_id: managerId,
            address_id: addressId
        });
    }

    async updateInstitution(id: string, institution: Partial<Institution>, address?: Partial<Address>, manager?: Partial<UserRegistrationDTO>): Promise<void> {
        // Get current institution to check for existing manager_id and address_id
        const { data: currentInst } = await this.supabase.from('institutions').select('manager_id, address_id').eq('id', id).single();

        // Handle address update/create
        if (address) {
            if (currentInst?.address_id) {
                // Update existing address
                await this.supabase.from('addresses').update(address).eq('id', currentInst.address_id);
            } else {
                // Create new address and link to institution
                const { data: addrData, error: addrError } = await this.supabase.from('addresses').insert(address).select().single();
                if (addrError) throw addrError;
                institution.address_id = addrData.id;
            }
        }

        // Handle manager update/create
        if (manager && (manager.first_name || manager.last_name || manager.email)) {
            if (currentInst?.manager_id) {
                // Update existing manager
                const managerUpdate: any = {};
                if (manager.first_name) managerUpdate.first_name = manager.first_name;
                if (manager.last_name) managerUpdate.last_name = manager.last_name;
                if (manager.email) managerUpdate.email = manager.email;

                await this.supabase.from('app_users').update(managerUpdate).eq('id', currentInst.manager_id);
            } else {
                // Create new manager with Institution role
                let ruleId = manager.rule_id;
                if (!ruleId) {
                    const { data: userRule } = await this.supabase.from('user_rules').select('id').eq('rule_name', 'Institution').single();
                    ruleId = userRule?.id;
                }
                const { data: userData, error: userError } = await this.supabase.from('app_users').insert({
                    email: manager.email,
                    first_name: manager.first_name,
                    last_name: manager.last_name,
                    rule_id: ruleId
                }).select().single();

                if (userError) throw userError;
                institution.manager_id = userData.id;
                // Stripe customer will be created automatically by database trigger
            }
        }

        await this.supabase.from('institutions').update(institution).eq('id', id);
    }

    async removeInstitution(id: string): Promise<void> {
        // Check for active dependencies
        const [depts, grades, classes, students, professors] = await Promise.all([
            this.supabase.from('departments').select('id', { count: 'exact', head: true }).eq('institution_id', id).eq('deleted', false),
            this.supabase.from('school_grades').select('id', { count: 'exact', head: true }).eq('institution_id', id).eq('deleted', false),
            this.supabase.from('classes').select('id', { count: 'exact', head: true }).eq('institution_id', id).eq('deleted', false),
            this.supabase.from('students').select('id', { count: 'exact', head: true }).eq('institution_id', id).eq('deleted', false),
            this.supabase.from('professors').select('id', { count: 'exact', head: true })
                .eq('deleted', false)
                .not('department_id', 'is', null)
        ]);

        // For professors, we need to check via departments
        const { data: instDepts } = await this.supabase.from('departments').select('id').eq('institution_id', id);
        const deptIds = instDepts?.map(d => d.id) || [];
        let profCount = 0;
        if (deptIds.length > 0) {
            const { count } = await this.supabase.from('professors').select('id', { count: 'exact', head: true })
                .in('department_id', deptIds).eq('deleted', false);
            profCount = count || 0;
        }

        const dependencies: string[] = [];
        if (depts.count && depts.count > 0) dependencies.push(`${depts.count} departamento(s)`);
        if (grades.count && grades.count > 0) dependencies.push(`${grades.count} série(s)`);
        if (classes.count && classes.count > 0) dependencies.push(`${classes.count} turma(s)`);
        if (students.count && students.count > 0) dependencies.push(`${students.count} aluno(s)`);
        if (profCount > 0) dependencies.push(`${profCount} professor(es)`);

        if (dependencies.length > 0) {
            throw new DependencyError(`Não é possível excluir esta instituição. Existem registros ativos vinculados: ${dependencies.join(', ')}. Remova ou exclua os itens dependentes primeiro.`);
        }

        await this.supabase.from('institutions').update({ deleted: true }).eq('id', id);
    }

    async restoreInstitution(id: string): Promise<void> {
        await this.supabase.from('institutions').update({ deleted: false }).eq('id', id);
    }
}

export class ClassRepositoryImpl implements IClassRepository {
    constructor(private supabase: SupabaseClient) { }

    async getClasses(includeDeleted = false): Promise<SchoolClass[]> {
        let query = this.supabase.from('classes').select('*, school_grades(name), institutions(name)');
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;
        return data as SchoolClass[];
    }

    async getClassesByInstitution(institutionId: string, includeDeleted = false): Promise<SchoolClass[]> {
        let query = this.supabase.from('classes').select('*, school_grades(name), institutions(name)').eq('institution_id', institutionId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;
        return data as SchoolClass[];
    }

    async getClassDetails(id: string): Promise<SchoolClass> {
        const { data, error } = await this.supabase
            .from('classes')
            .select(`
                *, 
                school_grades(name, disciplines(id, name, deleted, professors(app_users(first_name, last_name)))), 
                institutions(name),
                class_professors(professors(id, app_users(first_name, last_name), departments(code)))
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        const professors = data.class_professors.map((cp: any) => ({
            ...cp.professors,
            name: `${cp.professors.app_users?.first_name} ${cp.professors.app_users?.last_name}`,
            department: cp.professors.departments?.code
        }));

        // Filter deleted disciplines from nested school_grades
        const schoolGrades = data.school_grades ? {
            ...data.school_grades,
            disciplines: (data.school_grades.disciplines || []).filter((d: any) => !d.deleted)
        } : data.school_grades;

        return { ...data, school_grades: schoolGrades, professors } as SchoolClass;
    }

    async addClass(schoolClass: Partial<SchoolClass>): Promise<void> {
        // 1. Insert the class and get the ID
        const { data, error } = await this.supabase
            .from('classes')
            .insert(schoolClass)
            .select('id, name')
            .single();

        if (error) throw error;

        // 2. Automatically create a default classroom room for the new class
        if (data?.id) {
            await this.supabase.from('classroom_rooms').insert({
                class_id: data.id,
                name: `Sala Geral - ${data.name}`,
                description: 'Sala de bate-papo geral da turma',
                is_public: true
            });
        }
    }

    async updateClass(id: string, schoolClass: Partial<SchoolClass>): Promise<void> {
        await this.supabase.from('classes').update(schoolClass).eq('id', id);
    }

    async removeClass(id: string): Promise<void> {
        // Check for active dependencies
        const [students, rooms] = await Promise.all([
            this.supabase.from('students').select('id', { count: 'exact', head: true })
                .eq('class_id', id).eq('deleted', false),
            this.supabase.from('classroom_rooms').select('id', { count: 'exact', head: true })
                .eq('class_id', id).eq('deleted', false)
        ]);

        const dependencies: string[] = [];
        if (students.count && students.count > 0) dependencies.push(`${students.count} aluno(s)`);
        if (rooms.count && rooms.count > 0) dependencies.push(`${rooms.count} sala(s) de chat`);

        if (dependencies.length > 0) {
            throw new DependencyError(`Não é possível excluir esta turma. Existem registros ativos vinculados: ${dependencies.join(', ')}. Remova os itens dependentes primeiro.`);
        }

        await this.supabase.from('classes').update({ deleted: true }).eq('id', id);
    }

    async restoreClass(id: string): Promise<void> {
        await this.supabase.from('classes').update({ deleted: false }).eq('id', id);
    }

    async assignProfessor(classId: string, professorId: string): Promise<void> {
        await this.supabase.from('class_professors').insert({ class_id: classId, professor_id: professorId });
    }

    async removeProfessor(classId: string, professorId: string): Promise<void> {
        await this.supabase.from('class_professors').delete().match({ class_id: classId, professor_id: professorId });
    }

    async getClassResults(classId: string): Promise<TestResult[]> {
        // Join through test_releases to get results for students in this class
        const { data, error } = await this.supabase
            .from('test_results')
            .select('*, tests(title), students!inner(class_id)')
            .eq('students.class_id', classId)
            .order('correction_date', { ascending: false });
        if (error) throw error;
        return data as any;
    }
}

export class AIRepositoryImpl implements IAIRepository {
    async generateQuestions(params: AIQuestionParams): Promise<Partial<Question>[]> {
        return generateQuestionsWithAI(params);
    }

    async analyzeSheet(base64Image: string): Promise<AnalyzedSheet> {
        return analyzeAnswerSheet(base64Image);
    }
}

export class AIAgentRepositoryImpl implements IAIAgentRepository {
    constructor(private supabase: SupabaseClient) { }

    async getAgents(): Promise<AIAgent[]> {
        const { data, error } = await this.supabase.from('ai_agents').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data as AIAgent[];
    }

    async saveAgent(id: string | null, agent: Partial<AIAgent>): Promise<void> {
        if (id) {
            await this.supabase.from('ai_agents').update(agent).eq('id', id);
        } else {
            await this.supabase.from('ai_agents').insert(agent);
        }
    }

    async deleteAgent(id: string): Promise<void> {
        // Check for agent documents
        const { count: docCount } = await this.supabase
            .from('agent_documents')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', id);

        if (docCount && docCount > 0) {
            throw new DependencyError(`Não é possível excluir este agente. Existem ${docCount} documento(s) de conhecimento vinculado(s). Remova os documentos primeiro.`);
        }

        await this.supabase.from('ai_agents').update({ deleted: true }).eq('id', id);
    }

    async restoreAgent(id: string): Promise<void> {
        await this.supabase.from('ai_agents').update({ deleted: false }).eq('id', id);
    }

    async getAgentKnowledge(agentId: string): Promise<string> {
        const { data } = await this.supabase.from('agent_documents').select('content').eq('agent_id', agentId);
        return data?.map(d => d.content).join('\n\n') || '';
    }

    async chatWithAgent(agent: AIAgent, history: any[], message: string, context: string): Promise<string> {
        return chatWithAgent(agent.name, agent.system_prompt, context, history, message);
    }
}

export class TestReleaseRepositoryImpl implements ITestReleaseRepository {
    constructor(private supabase: SupabaseClient) { }

    async getReleases(includeDeleted = false): Promise<TestRelease[]> {
        let query = this.supabase
            .from('test_releases')
            .select('*, tests(title, school_grades(name)), students(app_users(first_name, last_name), student_hash, classes(id, name), school_grades(id, name), grade_level), professors(app_users(first_name, last_name))')
            .order('created_at', { ascending: false });

        if (!includeDeleted) {
            query = query.or('deleted.is.null,deleted.eq.false');
        }

        const { data, error } = await query;
        if (error) throw error;
        return data.map((r: any) => {
            // Preserve all student data including nested relations
            const studentData = r.students ? {
                ...r.students,
                name: `${r.students.app_users?.first_name || ''} ${r.students.app_users?.last_name || ''}`.trim(),
                // Preserve nested relations
                classes: r.students.classes || null,
                school_grades: r.students.school_grades || null,
                app_users: r.students.app_users || null
            } : null;
            
            return {
                ...r,
                students: studentData,
                professors: r.professors ? {
                    ...r.professors,
                    name: `${r.professors.app_users?.first_name || ''} ${r.professors.app_users?.last_name || ''}`.trim()
                } : null
            };
        }) as any;
    }

    async getReleasesByInstitution(institutionId: string, includeDeleted = false): Promise<TestRelease[]> {
        let query = this.supabase
            .from('test_releases')
            .select('*, tests(title, school_grades(name)), students(app_users(first_name, last_name), student_hash, classes(id, name), school_grades(id, name), grade_level), professors(app_users(first_name, last_name))')
            .eq('institution_id', institutionId)
            .order('created_at', { ascending: false });

        if (!includeDeleted) {
            query = query.or('deleted.is.null,deleted.eq.false');
        }

        const { data, error } = await query;
        if (error) throw error;
        return data.map((r: any) => {
            // Preserve all student data including nested relations
            const studentData = r.students ? {
                ...r.students,
                name: `${r.students.app_users?.first_name || ''} ${r.students.app_users?.last_name || ''}`.trim(),
                // Preserve nested relations
                classes: r.students.classes || null,
                school_grades: r.students.school_grades || null,
                app_users: r.students.app_users || null
            } : null;
            
            return {
                ...r,
                students: studentData,
                professors: r.professors ? {
                    ...r.professors,
                    name: `${r.professors.app_users?.first_name || ''} ${r.professors.app_users?.last_name || ''}`.trim()
                } : null
            };
        }) as any;
    }

    async getReleasesByClass(classId: string): Promise<TestRelease[]> {
        const { data, error } = await this.supabase
            .from('test_releases')
            .select('*, tests(title, school_grades(name)), students!inner(class_id, app_users(first_name, last_name), student_hash), professors(app_users(first_name, last_name))')
            .eq('students.class_id', classId)
            .order('start_time', { ascending: true });
        if (error) throw error;
        return data.map((r: any) => ({
            ...r,
            students: r.students ? {
                ...r.students,
                name: `${r.students.app_users?.first_name || ''} ${r.students.app_users?.last_name || ''}`.trim()
            } : null,
            professors: r.professors ? {
                ...r.professors,
                name: `${r.professors.app_users?.first_name || ''} ${r.professors.app_users?.last_name || ''}`.trim()
            } : null
        })) as any;
    }

    async getReleasesByStudent(studentId: string): Promise<TestRelease[]> {
        const { data, error } = await this.supabase
            .from('test_releases')
            .select('*, tests(title, school_grades(name)), professors(app_users(first_name, last_name))')
            .eq('student_id', studentId)
            .order('start_time', { ascending: true });
        if (error) throw error;
        return data.map((r: any) => ({
            ...r,
            professors: r.professors ? {
                ...r.professors,
                name: `${r.professors.app_users?.first_name || ''} ${r.professors.app_users?.last_name || ''}`.trim()
            } : null
        })) as any;
    }

    async getReleasesByProfessor(professorId: string, includeDeleted = false): Promise<TestRelease[]> {
        try {
            // Primeiro, buscar as liberações básicas
            let query = this.supabase
                .from('test_releases')
                .select('*')
                .eq('professor_id', professorId)
                .order('start_time', { ascending: false });

            if (!includeDeleted) {
                query = query.or('deleted.is.null,deleted.eq.false');
            }

            const { data, error } = await query;
            if (error) {
                throw error;
            }

            if (!data) {
                return [];
            }

            // Buscar dados relacionados separadamente
            const releasesWithRelations = await Promise.all(
                data.map(async (r: any) => {
                    // Buscar dados da prova
                    let testData: any = null;
                    if (r.test_id) {
                        try {
                            const { data: test } = await this.supabase
                                .from('tests')
                                .select('title, school_grades(name)')
                                .eq('id', r.test_id)
                                .maybeSingle();
                            testData = test;
                        } catch (testError) {
                            // Silently fail - test data will be null
                        }
                    }

                    // Buscar dados do professor
                    let professorData: any = null;
                    if (r.professor_id) {
                        try {
                            const { data: prof } = await this.supabase
                                .from('professors')
                                .select('id, app_users(first_name, last_name)')
                                .eq('id', r.professor_id)
                                .maybeSingle();
                            if (prof) {
                                const appUsers = Array.isArray(prof.app_users) ? prof.app_users[0] : prof.app_users;
                                professorData = {
                                    ...prof,
                                    name: `${appUsers?.first_name || ''} ${appUsers?.last_name || ''}`.trim()
                                };
                            }
                        } catch (profError) {
                            // Silently fail - professor data will be null
                        }
                    }

                    // Buscar dados do aluno com informações completas
                    // IMPORTANTE: Todas as releases devem ter um student_id, então sempre devemos buscar
                    let studentData: any = null;

                    // Verificar se student_id existe e não é vazio
                    if (!r.student_id || r.student_id.trim() === '') {
                        // Release sem student_id - será tratado como erro
                    } else {
                        try {

                            // PRIMEIRO: Tentar buscar o aluno de forma simples (sem relações) para verificar se existe
                            const { data: studentBasic, error: basicError } = await this.supabase
                                .from('students')
                                .select('id, deleted, user_id, class_id, institution_id, grade_id')
                                .eq('id', r.student_id)
                                .maybeSingle();

                            if (basicError) {
                                // Error fetching student - will be handled below
                            } else if (!studentBasic) {
                                studentData = {
                                    id: r.student_id,
                                    name: 'Aluno não encontrado',
                                    deleted: true,
                                    notFound: true
                                };
                            } else {

                                // AGORA: Buscar com todas as relações
                                const { data: student, error: studentError } = await this.supabase
                                    .from('students')
                                    .select(`
                                        id,
                                        student_hash,
                                        grade_level,
                                        age,
                                        class_id,
                                        institution_id,
                                        deleted,
                                        app_users(first_name, last_name, email),
                                        school_grades(name),
                                        classes(id, name),
                                        institutions(name)
                                    `)
                                    .eq('id', r.student_id)
                                    .maybeSingle();

                                if (studentError) {
                                    // Se a query básica funcionou mas a com relações falhou, buscar relações separadamente
                                    if (studentBasic && !basicError) {

                                        // Buscar app_users separadamente
                                        let appUserData: any = null;
                                        if (studentBasic.user_id) {
                                            try {
                                                const { data: appUser, error: appUserError } = await this.supabase
                                                    .from('app_users')
                                                    .select('first_name, last_name, email')
                                                    .eq('id', studentBasic.user_id)
                                                    .maybeSingle();
                                                if (!appUserError) {
                                                    appUserData = appUser;
                                                }
                                            } catch {
                                                // Silently fail
                                            }
                                        }

                                        // Buscar school_grades separadamente
                                        let gradeData: any = null;
                                        if (studentBasic.grade_id) {
                                            try {
                                                const { data: grade } = await this.supabase
                                                    .from('school_grades')
                                                    .select('name')
                                                    .eq('id', studentBasic.grade_id)
                                                    .maybeSingle();
                                                gradeData = grade;
                                            } catch {
                                                // Silently fail
                                            }
                                        }

                                        // Buscar classes separadamente
                                        let classData: any = null;
                                        if (studentBasic.class_id) {
                                            try {
                                                const { data: cls } = await this.supabase
                                                    .from('classes')
                                                    .select('id, name')
                                                    .eq('id', studentBasic.class_id)
                                                    .maybeSingle();
                                                classData = cls;
                                            } catch {
                                                // Silently fail
                                            }
                                        }

                                        // Buscar institutions separadamente
                                        let institutionData: any = null;
                                        if (studentBasic.institution_id) {
                                            try {
                                                const { data: inst } = await this.supabase
                                                    .from('institutions')
                                                    .select('name')
                                                    .eq('id', studentBasic.institution_id)
                                                    .maybeSingle();
                                                institutionData = inst;
                                            } catch {
                                                // Silently fail
                                            }
                                        }

                                        // Buscar student_hash e outros campos básicos
                                        const { data: studentFull, error: fullError } = await this.supabase
                                            .from('students')
                                            .select('student_hash, grade_level, age')
                                            .eq('id', r.student_id)
                                            .maybeSingle();

                                        studentData = {
                                            ...studentBasic,
                                            ...(studentFull || {}),
                                            app_users: appUserData,
                                            school_grades: gradeData,
                                            classes: classData,
                                            institutions: institutionData,
                                            name: appUserData ? `${appUserData.first_name || ''} ${appUserData.last_name || ''}`.trim() : 'Nome não disponível',
                                            email: appUserData?.email,
                                            hasPartialData: true,
                                            relationError: studentError.message
                                        };
                                    } else {
                                        // Mesmo com erro, criar um objeto para indicar problema
                                        studentData = {
                                            id: r.student_id,
                                            name: 'Erro ao buscar aluno',
                                            error: studentError.message,
                                            hasError: true
                                        };
                                    }
                                } else if (student) {
                                    // Verificar se app_users foi retornado
                                    const appUsers = Array.isArray(student.app_users) ? student.app_users[0] : student.app_users;

                                    const studentName = appUsers
                                        ? `${appUsers.first_name || ''} ${appUsers.last_name || ''}`.trim()
                                        : 'Nome não disponível';

                                    if (student.deleted) {
                                        studentData = {
                                            ...student,
                                            app_users: appUsers,
                                            name: studentName || 'Aluno Deletado',
                                            email: appUsers?.email,
                                            deleted: true
                                        };
                                    } else {
                                        studentData = {
                                            ...student,
                                            app_users: appUsers,
                                            name: studentName,
                                            email: appUsers?.email,
                                            deleted: false
                                        };
                                    }
                                } else {
                                    // Aluno não encontrado na query com relações, mas pode ter sido encontrado na query básica
                                    if (studentBasic && !basicError) {
                                        // Usar os dados básicos que já temos
                                        studentData = {
                                            ...studentBasic,
                                            name: 'Dados básicos apenas',
                                            hasPartialData: true,
                                            notFound: false
                                        };
                                    } else {
                                        // Aluno realmente não encontrado
                                        studentData = {
                                            id: r.student_id,
                                            name: 'Aluno não encontrado',
                                            deleted: true,
                                            notFound: true
                                        };
                                    }
                                }
                            }
                        } catch (studentError: any) {
                            studentData = {
                                id: r.student_id,
                                name: 'Erro ao buscar aluno',
                                error: studentError?.message || 'Unknown error',
                                hasError: true
                            };
                        }
                    }

                    // Buscar allowed_sites
                    let allowedSites: any[] = [];
                    try {
                        const { data: sites } = await this.supabase
                            .from('test_release_sites')
                            .select('*')
                            .eq('test_release_id', r.id);
                        allowedSites = sites || [];
                    } catch {
                        // Silently fail
                    }

                    // Buscar dados da instituição
                    let institutionData: any = null;
                    if (r.institution_id) {
                        try {
                            const { data: inst } = await this.supabase
                                .from('institutions')
                                .select('name')
                                .eq('id', r.institution_id)
                                .maybeSingle();
                            institutionData = inst;
                        } catch {
                            // Silently fail
                        }
                    }

                    // Garantir que student_id seja sempre preservado, mesmo se a busca falhar
                    const finalRelease = {
                        ...r,
                        student_id: r.student_id, // SEMPRE preservar o student_id original da query
                        tests: testData,
                        professors: professorData,
                        students: studentData, // Pode ser null se não encontrou, mas student_id deve estar presente
                        institutions: institutionData,
                        allowed_sites: allowedSites,
                        location_polygon: r.location_polygon || null
                    };

                    return finalRelease;
                })
            );

            return releasesWithRelations as any;
        } catch (err: any) {
            throw err;
        }
    }

    async createRelease(release: Partial<TestRelease>, sites?: Partial<TestReleaseSite>[]): Promise<void> {
        const { data, error } = await this.supabase.from('test_releases').insert(release).select().single();
        if (error) throw error;

        if (sites && sites.length > 0) {
            const sitePayload = sites.map(s => ({ ...s, test_release_id: data.id }));
            await this.supabase.from('test_release_sites').insert(sitePayload);
        }
    }

    async createBulkReleases(baseRelease: Partial<TestRelease>, studentIds: string[], sites?: Partial<TestReleaseSite>[]): Promise<void> {
        const releases = studentIds.map(sid => ({
            ...baseRelease,
            student_id: sid
        }));

        const { data, error } = await this.supabase.from('test_releases').insert(releases).select();
        if (error) throw error;

        if (sites && sites.length > 0 && data) {
            const allSites: any[] = [];
            data.forEach(rel => {
                sites.forEach(s => {
                    allSites.push({ ...s, test_release_id: rel.id });
                });
            });
            await this.supabase.from('test_release_sites').insert(allSites);
        }
    }

    async deleteRelease(id: string): Promise<void> {
        // Check for test results linked to this release
        const { count: resultCount } = await this.supabase
            .from('test_results')
            .select('id', { count: 'exact', head: true })
            .eq('test_release_id', id);

        if (resultCount && resultCount > 0) {
            throw new DependencyError(`Não é possível excluir esta liberação. Existem ${resultCount} resultado(s) de prova vinculado(s).`);
        }

        // Soft delete
        const { error } = await this.supabase.from('test_releases').update({ deleted: true }).eq('id', id);
        if (error) throw error;
    }

    async restoreRelease(id: string): Promise<void> {
        const { error } = await this.supabase.from('test_releases').update({ deleted: false }).eq('id', id);
        if (error) throw error;
    }

    async addAllowedSite(releaseId: string, site: Partial<TestReleaseSite>): Promise<void> {
        await this.supabase.from('test_release_sites').insert({ ...site, test_release_id: releaseId });
    }

    async removeAllowedSite(siteId: string): Promise<void> {
        await this.supabase.from('test_release_sites').delete().eq('id', siteId);
    }
}

export class UserRuleRepositoryImpl implements IUserRuleRepository {
    constructor(private supabase: SupabaseClient) { }

    async getRules(): Promise<UserRule[]> {
        const { data, error } = await this.supabase.from('user_rules').select('*');
        if (error) throw error;
        return data as UserRule[];
    }

    async saveRule(id: string | null, rule: Partial<UserRule>): Promise<void> {
        if (id) {
            await this.supabase.from('user_rules').update(rule).eq('id', id);
        } else {
            await this.supabase.from('user_rules').insert(rule);
        }
    }

    async deleteRule(id: string): Promise<void> {
        // Check for users using this rule
        const { count: userCount } = await this.supabase
            .from('app_users')
            .select('id', { count: 'exact', head: true })
            .eq('rule_id', id);

        if (userCount && userCount > 0) {
            throw new DependencyError(`Não é possível excluir esta regra. Existem ${userCount} usuário(s) utilizando esta regra. Altere a regra dos usuários primeiro.`);
        }

        await this.supabase.from('user_rules').update({ deleted: true }).eq('id', id);
    }

    async restoreRule(id: string): Promise<void> {
        await this.supabase.from('user_rules').update({ deleted: false }).eq('id', id);
    }
}

export class SettingsRepositoryImpl implements ISettingsRepository {
    constructor(private supabase: SupabaseClient) { }

    // --- TYPES ---
    async getInstitutionTypes(includeDeleted = false): Promise<InstitutionType[]> {
        let query = this.supabase.from('institution_types').select('*');
        if (!includeDeleted) {
            query = query.or('deleted.is.null,deleted.eq.false');
        }
        const { data, error } = await query.order('name');
        if (error) throw error;
        return (data || []) as InstitutionType[];
    }
    async addInstitutionType(type: Partial<InstitutionType>): Promise<void> {
        await this.supabase.from('institution_types').insert(type);
    }
    async updateInstitutionType(id: string, type: Partial<InstitutionType>): Promise<void> {
        await this.supabase.from('institution_types').update(type).eq('id', id);
    }
    async removeInstitutionType(id: string): Promise<void> {
        // Check for institutions using this type
        const { count: institutionCount } = await this.supabase
            .from('institutions')
            .select('id', { count: 'exact', head: true })
            .eq('type_id', id)
            .eq('deleted', false);

        if (institutionCount && institutionCount > 0) {
            throw new DependencyError(`Não é possível excluir este tipo de instituição. Existem ${institutionCount} instituição(ões) utilizando este tipo.`);
        }

        // Soft delete
        await this.supabase.from('institution_types').update({ deleted: true }).eq('id', id);
    }
    async restoreInstitutionType(id: string): Promise<void> {
        await this.supabase.from('institution_types').update({ deleted: false }).eq('id', id);
    }

    // --- GRADES ---
    async getSchoolGrades(includeDeleted = false): Promise<SchoolGrade[]> {
        let query = this.supabase.from('school_grades').select('*, disciplines(*)');
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('level');
        if (error) throw error;
        // Filter deleted disciplines from nested array (unless includeDeleted)
        return (data || []).map((grade: any) => ({
            ...grade,
            disciplines: includeDeleted
                ? (grade.disciplines || [])
                : (grade.disciplines || []).filter((d: any) => !d.deleted)
        })) as SchoolGrade[];
    }
    async getSchoolGradesByInstitution(institutionId: string, includeDeleted = false): Promise<SchoolGrade[]> {
        let query = this.supabase.from('school_grades').select('*, disciplines(*)').eq('institution_id', institutionId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('level');
        if (error) throw error;
        // Filter deleted disciplines from nested array (unless includeDeleted)
        return (data || []).map((grade: any) => ({
            ...grade,
            disciplines: includeDeleted
                ? (grade.disciplines || [])
                : (grade.disciplines || []).filter((d: any) => !d.deleted)
        })) as SchoolGrade[];
    }
    async addSchoolGrade(grade: Partial<SchoolGrade>): Promise<void> {
        await this.supabase.from('school_grades').insert(grade);
    }
    async updateSchoolGrade(id: string, grade: Partial<SchoolGrade>): Promise<void> {
        await this.supabase.from('school_grades').update(grade).eq('id', id);
    }
    async removeSchoolGrade(id: string): Promise<void> {
        // Check for active dependencies: classes and disciplines
        const [classes, disciplines] = await Promise.all([
            this.supabase.from('classes').select('id', { count: 'exact', head: true })
                .eq('grade_id', id).eq('deleted', false),
            this.supabase.from('disciplines').select('id', { count: 'exact', head: true })
                .eq('grade_id', id).eq('deleted', false)
        ]);

        const dependencies: string[] = [];
        if (classes.count && classes.count > 0) dependencies.push(`${classes.count} turma(s)`);
        if (disciplines.count && disciplines.count > 0) dependencies.push(`${disciplines.count} disciplina(s)`);

        if (dependencies.length > 0) {
            throw new DependencyError(`Não é possível excluir esta série. Existem registros ativos vinculados: ${dependencies.join(', ')}. Remova os itens dependentes primeiro.`);
        }

        await this.supabase.from('school_grades').update({ deleted: true }).eq('id', id);
    }
    async restoreSchoolGrade(id: string): Promise<void> {
        await this.supabase.from('school_grades').update({ deleted: false }).eq('id', id);
    }

    // --- DEPARTMENTS ---
    async getDepartments(institutionId: string, includeDeleted = false): Promise<Department[]> {
        let query = this.supabase.from('departments').select('*').eq('institution_id', institutionId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;
        return data as Department[];
    }
    async addDepartment(dept: Partial<Department>): Promise<void> {
        await this.supabase.from('departments').insert(dept);
    }
    async updateDepartment(id: string, dept: Partial<Department>): Promise<void> {
        await this.supabase.from('departments').update(dept).eq('id', id);
    }
    async removeDepartment(id: string): Promise<void> {
        // Check for active professors in this department
        const { count: professorCount } = await this.supabase
            .from('professors')
            .select('id', { count: 'exact', head: true })
            .eq('department_id', id)
            .eq('deleted', false);

        if (professorCount && professorCount > 0) {
            throw new DependencyError(`Não é possível excluir este departamento. Existem ${professorCount} professor(es) vinculado(s). Transfira ou remova os professores primeiro.`);
        }

        await this.supabase.from('departments').update({ deleted: true }).eq('id', id);
    }
    async restoreDepartment(id: string): Promise<void> {
        await this.supabase.from('departments').update({ deleted: false }).eq('id', id);
    }

    // --- DISCIPLINES ---
    async getAllDisciplines(institutionId: string, includeDeleted = false): Promise<Discipline[]> {
        let query = this.supabase.from('disciplines')
            .select('*, school_grades!inner(institution_id, name), professors(app_users(first_name, last_name))')
            .eq('school_grades.institution_id', institutionId);

        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query;
        if (error) throw error;

        return data.map((d: any) => ({
            ...d,
            professors: d.professors ? { name: `${d.professors.app_users?.first_name} ${d.professors.app_users?.last_name}` } : null
        }));
    }

    async getDisciplines(gradeId: string): Promise<Discipline[]> {
        const { data, error } = await this.supabase
            .from('disciplines')
            .select('*, professors(app_users(first_name, last_name))')
            .eq('grade_id', gradeId)
            .eq('deleted', false);
        if (error) throw error;
        return data.map((d: any) => ({
            ...d,
            professors: d.professors ? { name: `${d.professors.app_users?.first_name} ${d.professors.app_users?.last_name}` } : null
        }));
    }
    async addDiscipline(discipline: Partial<Discipline>): Promise<void> {
        await this.supabase.from('disciplines').insert(discipline);
    }
    async updateDiscipline(id: string, discipline: Partial<Discipline>): Promise<void> {
        await this.supabase.from('disciplines').update(discipline).eq('id', id);
    }
    async removeDiscipline(id: string): Promise<void> {
        // Note: No direct relationship between tests and disciplines in current schema
        // If needed, add discipline_id to tests table or check via other relationships

        await this.supabase.from('disciplines').update({ deleted: true }).eq('id', id);
    }
    async restoreDiscipline(id: string): Promise<void> {
        await this.supabase.from('disciplines').update({ deleted: false }).eq('id', id);
    }
}

export class LibraryRepositoryImpl implements ILibraryRepository {
    constructor(private supabase: SupabaseClient) { }

    async getLibrariesByGrade(gradeId: string, includeDeleted = false): Promise<Library[]> {
        let query = this.supabase
            .from('libraries')
            .select('*, library_items(count)')
            .eq('grade_id', gradeId)
            .order('created_at', { ascending: false });

        if (!includeDeleted) {
            query = query.or('deleted.is.null,deleted.eq.false');
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as any;
    }

    async createLibrary(library: Partial<Library>): Promise<void> {
        await this.supabase.from('libraries').insert(library);
    }

    async deleteLibrary(id: string): Promise<void> {
        // Check for library items
        const { count: itemCount } = await this.supabase
            .from('library_items')
            .select('id', { count: 'exact', head: true })
            .eq('library_id', id)
            .or('deleted.is.null,deleted.eq.false');

        if (itemCount && itemCount > 0) {
            throw new DependencyError(`Não é possível excluir esta biblioteca. Existem ${itemCount} item(s) vinculado(s). Remova os itens primeiro.`);
        }

        // Soft delete
        await this.supabase.from('libraries').update({ deleted: true }).eq('id', id);
    }

    async restoreLibrary(id: string): Promise<void> {
        await this.supabase.from('libraries').update({ deleted: false }).eq('id', id);
    }

    async getItems(libraryId: string, includeDeleted = false): Promise<LibraryItem[]> {
        let query = this.supabase.from('library_items').select('*').eq('library_id', libraryId);
        if (!includeDeleted) {
            query = query.or('deleted.is.null,deleted.eq.false');
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data as LibraryItem[];
    }

    async addItem(item: Partial<LibraryItem>, file: File): Promise<void> {
        // 1. Upload File
        const filePath = `${item.library_id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await this.supabase.storage.from('library_files').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = this.supabase.storage.from('library_files').getPublicUrl(filePath);

        // 2. Insert Record
        await this.supabase.from('library_items').insert({
            ...item,
            file_url: publicUrl,
            file_type: file.type
        });
    }

    async deleteItem(id: string): Promise<void> {
        // Soft delete
        await this.supabase.from('library_items').update({ deleted: true }).eq('id', id);
    }

    async restoreItem(id: string): Promise<void> {
        await this.supabase.from('library_items').update({ deleted: false }).eq('id', id);
    }
}

export class BNCCRepositoryImpl implements IBNCCRepository {
    constructor(private supabase: SupabaseClient) { }

    async getAll(includeDeleted = false): Promise<BNCCItem[]> {
        let query = this.supabase.from('bncc').select('*');
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('codigo_alfanumerico', { ascending: true });
        if (error) throw error;
        return data as BNCCItem[];
    }

    async create(item: Partial<BNCCItem>): Promise<void> {
        await this.supabase.from('bncc').insert(item);
    }

    async update(id: string, item: Partial<BNCCItem>): Promise<void> {
        await this.supabase.from('bncc').update(item).eq('id', id);
    }

    async delete(id: string): Promise<void> {
        // Check for disciplines using this BNCC code (via disciplines_bnccs junction table)
        const { count: disciplineCount } = await this.supabase
            .from('disciplines_bnccs')
            .select('discipline_id', { count: 'exact', head: true })
            .eq('bncc_id', id);

        if (disciplineCount && disciplineCount > 0) {
            throw new DependencyError(`Não é possível excluir este código BNCC. Existem ${disciplineCount} disciplina(s) vinculada(s). Remova a referência das disciplinas primeiro.`);
        }

        await this.supabase.from('bncc').update({ deleted: true }).eq('id', id);
    }

    async restore(id: string): Promise<void> {
        await this.supabase.from('bncc').update({ deleted: false }).eq('id', id);
    }
}

export class ClassroomRoomRepositoryImpl implements IClassroomRoomRepository {
    constructor(private supabase: SupabaseClient) { }

    async getRoomsByClass(classId: string, includeDeleted = false): Promise<ClassroomRoom[]> {
        let query = this.supabase
            .from('classroom_rooms')
            .select('*')
            .eq('class_id', classId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        return data as ClassroomRoom[];
    }

    async createRoom(room: Partial<ClassroomRoom>): Promise<ClassroomRoom> {
        const { data, error } = await this.supabase
            .from('classroom_rooms')
            .insert(room)
            .select()
            .single();
        if (error) throw error;
        return data as ClassroomRoom;
    }

    async updateRoom(id: string, room: Partial<ClassroomRoom>): Promise<void> {
        await this.supabase.from('classroom_rooms').update(room).eq('id', id);
    }

    async deleteRoom(id: string): Promise<void> {
        // TODO: Check for chat messages or other dependencies if needed in the future
        await this.supabase.from('classroom_rooms').update({ deleted: true }).eq('id', id);
    }

    async restoreRoom(id: string): Promise<void> {
        await this.supabase.from('classroom_rooms').update({ deleted: false }).eq('id', id);
    }
}

export class ClassroomMessageRepositoryImpl implements IClassroomMessageRepository {
    constructor(private supabase: SupabaseClient) { }

    async getMessagesByRoom(roomId: string, includeDeleted = false): Promise<ClassroomMessage[]> {
        let query = this.supabase
            .from('classroom_messages')
            .select(`
                *,
                app_users:user_id (id, first_name, last_name, profile_picture_url)
            `)
            .eq('room_id', roomId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        return data as ClassroomMessage[];
    }

    async getMessagesByUserInRoom(roomId: string, userId: string, includeDeleted = false): Promise<ClassroomMessage[]> {
        let query = this.supabase
            .from('classroom_messages')
            .select(`
                *,
                app_users:user_id (id, first_name, last_name, profile_picture_url)
            `)
            .eq('room_id', roomId)
            .eq('user_id', userId);
        if (!includeDeleted) query = query.eq('deleted', false);
        const { data, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        return data as ClassroomMessage[];
    }

    async sendMessage(message: Partial<ClassroomMessage>): Promise<ClassroomMessage> {
        const { data, error } = await this.supabase
            .from('classroom_messages')
            .insert({
                room_id: message.room_id,
                user_id: message.user_id,
                type: message.type || 'text',
                content: message.content,
                metadata: message.metadata || {},
                nickname: message.nickname
            })
            .select(`
                *,
                app_users:user_id (id, first_name, last_name, profile_picture_url)
            `)
            .single();
        if (error) throw error;
        return data as ClassroomMessage;
    }

    async updateMessage(id: string, message: Partial<ClassroomMessage>): Promise<void> {
        const { error } = await this.supabase
            .from('classroom_messages')
            .update({
                content: message.content,
                edited: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        if (error) throw error;
    }

    async deleteMessage(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('classroom_messages')
            .update({ deleted: true, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    }

    async restoreMessage(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('classroom_messages')
            .update({ deleted: false, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    }
}

export class MessageReactionRepositoryImpl implements IMessageReactionRepository {
    constructor(private supabase: SupabaseClient) { }

    async getReactionsByMessage(messageId: string): Promise<MessageReaction[]> {
        const { data, error } = await this.supabase
            .from('message_reactions')
            .select(`
                *,
                app_users:user_id (id, first_name, last_name, profile_picture_url)
            `)
            .eq('message_id', messageId)
            .eq('deleted', false)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data as MessageReaction[];
    }

    async getReactionCounts(messageId: string): Promise<MessageReactionCounts> {
        const { data, error } = await this.supabase
            .from('message_reactions')
            .select('reaction_type')
            .eq('message_id', messageId)
            .eq('deleted', false);

        if (error) throw error;

        const counts: MessageReactionCounts = {
            like: 0,
            dislike: 0,
            love: 0,
            understood: 0
        };

        data?.forEach((reaction: { reaction_type: MessageReactionType }) => {
            if (counts[reaction.reaction_type] !== undefined) {
                counts[reaction.reaction_type]++;
            }
        });

        return counts;
    }

    async getReactionCountsForMessages(messageIds: string[]): Promise<Record<string, MessageReactionCounts>> {
        if (messageIds.length === 0) return {};

        const { data, error } = await this.supabase
            .from('message_reactions')
            .select('message_id, reaction_type')
            .in('message_id', messageIds)
            .eq('deleted', false);

        if (error) throw error;

        const result: Record<string, MessageReactionCounts> = {};

        // Inicializar contadores para todas as mensagens
        messageIds.forEach(id => {
            result[id] = { like: 0, dislike: 0, love: 0, understood: 0 };
        });

        // Contabilizar reações
        data?.forEach((reaction: { message_id: string; reaction_type: MessageReactionType }) => {
            if (result[reaction.message_id] && result[reaction.message_id][reaction.reaction_type] !== undefined) {
                result[reaction.message_id][reaction.reaction_type]++;
            }
        });

        return result;
    }

    async getUserReaction(messageId: string, userId: string): Promise<MessageReaction | null> {
        const { data, error } = await this.supabase
            .from('message_reactions')
            .select(`
                *,
                app_users:user_id (id, first_name, last_name, profile_picture_url)
            `)
            .eq('message_id', messageId)
            .eq('user_id', userId)
            .eq('deleted', false)
            .maybeSingle();

        if (error) throw error;
        return data as MessageReaction | null;
    }

    async getUserReactionsForMessages(messageIds: string[], userId: string): Promise<Record<string, MessageReaction>> {
        if (messageIds.length === 0) return {};

        const { data, error } = await this.supabase
            .from('message_reactions')
            .select(`
                *,
                app_users:user_id (id, first_name, last_name, profile_picture_url)
            `)
            .in('message_id', messageIds)
            .eq('user_id', userId)
            .eq('deleted', false);

        if (error) throw error;

        const result: Record<string, MessageReaction> = {};
        data?.forEach((reaction: MessageReaction) => {
            result[reaction.message_id] = reaction;
        });

        return result;
    }

    async toggleReaction(messageId: string, userId: string, reactionType: MessageReactionType): Promise<MessageReaction | null> {
        // Verificar se já existe uma reação do usuário para esta mensagem
        const { data: existingReaction } = await this.supabase
            .from('message_reactions')
            .select('*')
            .eq('message_id', messageId)
            .eq('user_id', userId)
            .eq('deleted', false)
            .maybeSingle();

        if (existingReaction) {
            // Se a reação é a mesma, remove (soft delete)
            if (existingReaction.reaction_type === reactionType) {
                await this.supabase
                    .from('message_reactions')
                    .update({ deleted: true, updated_at: new Date().toISOString() })
                    .eq('id', existingReaction.id);
                return null;
            } else {
                // Se a reação é diferente, atualiza
                const { data, error } = await this.supabase
                    .from('message_reactions')
                    .update({
                        reaction_type: reactionType,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingReaction.id)
                    .select(`
                        *,
                        app_users:user_id (id, first_name, last_name, profile_picture_url)
                    `)
                    .single();

                if (error) throw error;
                return data as MessageReaction;
            }
        } else {
            // Verificar se existe uma reação deletada para restaurar/atualizar
            const { data: deletedReaction } = await this.supabase
                .from('message_reactions')
                .select('*')
                .eq('message_id', messageId)
                .eq('user_id', userId)
                .eq('deleted', true)
                .maybeSingle();

            if (deletedReaction) {
                // Restaurar e atualizar a reação deletada
                const { data, error } = await this.supabase
                    .from('message_reactions')
                    .update({
                        reaction_type: reactionType,
                        deleted: false,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', deletedReaction.id)
                    .select(`
                        *,
                        app_users:user_id (id, first_name, last_name, profile_picture_url)
                    `)
                    .single();

                if (error) throw error;
                return data as MessageReaction;
            } else {
                // Criar nova reação
                const { data, error } = await this.supabase
                    .from('message_reactions')
                    .insert({
                        message_id: messageId,
                        user_id: userId,
                        reaction_type: reactionType
                    })
                    .select(`
                        *,
                        app_users:user_id (id, first_name, last_name, profile_picture_url)
                    `)
                    .single();

                if (error) throw error;
                return data as MessageReaction;
            }
        }
    }

    async removeReaction(reactionId: string): Promise<void> {
        const { error } = await this.supabase
            .from('message_reactions')
            .update({ deleted: true, updated_at: new Date().toISOString() })
            .eq('id', reactionId);

        if (error) throw error;
    }

    async restoreReaction(reactionId: string): Promise<void> {
        const { error } = await this.supabase
            .from('message_reactions')
            .update({ deleted: false, updated_at: new Date().toISOString() })
            .eq('id', reactionId);

        if (error) throw error;
    }
}

export class StudentDisabilityRepositoryImpl implements IStudentDisabilityRepository {
    constructor(private supabase: SupabaseClient) { }

    async getDisabilitiesByStudent(studentId: string): Promise<StudentDisability[]> {
        const { data, error } = await this.supabase
            .from('student_disabilities')
            .select(`
                *,
                students(*, app_users(*), institutions(*)),
                institutions(*)
            `)
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as StudentDisability[];
    }

    async getDisabilitiesByInstitution(institutionId: string): Promise<StudentDisability[]> {
        const { data, error } = await this.supabase
            .from('student_disabilities')
            .select(`
                *,
                students(*, app_users(*), institutions(*)),
                institutions(*)
            `)
            .eq('institution_id', institutionId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as StudentDisability[];
    }

    async getDisabilityById(id: string): Promise<StudentDisability> {
        const { data, error } = await this.supabase
            .from('student_disabilities')
            .select(`
                *,
                students(*, app_users(*), institutions(*)),
                institutions(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as StudentDisability;
    }

    async addDisability(disability: Partial<StudentDisability>, documentFile?: File): Promise<void> {
        let documentUrl = disability.document_url;

        // First insert to get the ID
        const { data: insertedData, error: insertError } = await this.supabase
            .from('student_disabilities')
            .insert({
                student_id: disability.student_id,
                institution_id: disability.institution_id,
                disability_type: disability.disability_type,
                description: disability.description,
                additional_info: disability.additional_info || null,
                support_number: disability.support_number || null,
                responsible_name: disability.responsible_name || null,
                document_url: null
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // Upload document if provided
        if (documentFile && insertedData) {
            documentUrl = await this.uploadDocument(insertedData.id, documentFile);

            // Update with document URL
            const { error: updateError } = await this.supabase
                .from('student_disabilities')
                .update({ document_url: documentUrl })
                .eq('id', insertedData.id);

            if (updateError) throw updateError;
        }
    }

    async updateDisability(id: string, disability: Partial<StudentDisability>, documentFile?: File): Promise<void> {
        let documentUrl = disability.document_url;

        if (documentFile) {
            documentUrl = await this.uploadDocument(id, documentFile);
        }

        const updateData: any = {
            disability_type: disability.disability_type,
            description: disability.description,
            additional_info: disability.additional_info || null,
            support_number: disability.support_number || null,
            responsible_name: disability.responsible_name || null,
            updated_at: new Date().toISOString()
        };

        if (documentUrl !== undefined) {
            updateData.document_url = documentUrl;
        }

        const { error } = await this.supabase
            .from('student_disabilities')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
    }

    async deleteDisability(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('student_disabilities')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async uploadDocument(id: string, file: File): Promise<string | null> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${id || 'new'}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `student-disabilities/${fileName}`;

        const { error: uploadError } = await this.supabase.storage
            .from('documents')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = this.supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
}

export class ReportRepositoryImpl implements IReportRepository {
    constructor(private supabase: SupabaseClient) { }

    async getClassPerformanceReport(classId: string, dateFilter: ReportDateFilter): Promise<ClassPerformanceReport> {
        // Get class details
        const { data: classData, error: classError } = await this.supabase
            .from('classes')
            .select('id, name, grade_id, institution_id, school_grades(name), institutions(name)')
            .eq('id', classId)
            .single();

        if (classError) throw classError;

        // Get students in class
        const { data: students, error: studentsError } = await this.supabase
            .from('students')
            .select('id')
            .eq('class_id', classId)
            .eq('deleted', false);

        if (studentsError) throw studentsError;
        const studentIds = students?.map(s => s.id) || [];

        // Get test results for students in this class within date range
        const { data: results, error: resultsError } = await this.supabase
            .from('test_results')
            .select(`
                id, test_id, student_id, score, correct_count, error_count, correction_date,
                tests(title),
                students(id, app_users(first_name, last_name))
            `)
            .in('student_id', studentIds.length > 0 ? studentIds : [''])
            .gte('correction_date', dateFilter.startDate)
            .lte('correction_date', dateFilter.endDate)
            .order('correction_date', { ascending: false });

        if (resultsError) throw resultsError;

        // Get unique test IDs
        const testIds = [...new Set((results || []).map(r => r.test_id))];

        // Calculate statistics
        const totalStudents = studentIds.length;
        const totalTests = testIds.length;
        const totalAttempts = results?.length || 0;
        const averageScore = totalAttempts > 0
            ? (results || []).reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts
            : 0;
        const completionRate = totalStudents > 0 && totalTests > 0
            ? (totalAttempts / (totalStudents * totalTests)) * 100
            : 0;

        // Students performance summary
        const studentsPerformance: any[] = [];
        for (const studentId of studentIds) {
            const studentResults = (results || []).filter(r => r.student_id === studentId);
            if (studentResults.length > 0) {
                const studentAvg = studentResults.reduce((sum, r) => sum + (r.score || 0), 0) / studentResults.length;
                const student = students?.find(s => s.id === studentId);
                const studentData = studentResults[0]?.students as any;
                studentsPerformance.push({
                    studentId,
                    studentName: studentData?.app_users
                        ? `${studentData.app_users.first_name || ''} ${studentData.app_users.last_name || ''}`.trim()
                        : 'Unknown',
                    averageScore: studentAvg,
                    totalTests: studentResults.length,
                    completionRate: totalTests > 0 ? (studentResults.length / totalTests) * 100 : 0
                });
            }
        }

        // Tests performance summary
        const testsPerformance: any[] = [];
        for (const testId of testIds) {
            const testResults = (results || []).filter(r => r.test_id === testId);
            if (testResults.length > 0) {
                const testAvg = testResults.reduce((sum, r) => sum + (r.score || 0), 0) / testResults.length;
                const testData = testResults[0]?.tests as any;
                testsPerformance.push({
                    testId,
                    testTitle: testData?.title || 'Unknown',
                    averageScore: testAvg,
                    totalStudents: new Set(testResults.map(r => r.student_id)).size,
                    completionRate: totalStudents > 0 ? (new Set(testResults.map(r => r.student_id)).size / totalStudents) * 100 : 0
                });
            }
        }

        // Calculate performance evolution (grouped by date)
        const evolutionMap = new Map<string, { scores: number[], attempts: number, students: Set<string> }>();
        (results || []).forEach(r => {
            const date = r.correction_date.split('T')[0];
            if (!evolutionMap.has(date)) {
                evolutionMap.set(date, { scores: [], attempts: 0, students: new Set() });
            }
            const dayData = evolutionMap.get(date)!;
            dayData.scores.push(r.score || 0);
            dayData.attempts += 1;
            dayData.students.add(r.student_id);
        });

        const performanceEvolution = Array.from(evolutionMap.entries())
            .map(([date, data]) => ({
                date,
                averageScore: data.scores.length > 0
                    ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
                    : 0,
                completionRate: totalStudents > 0 ? (data.students.size / totalStudents) * 100 : 0,
                totalAttempts: data.attempts
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            classId: classData.id,
            className: classData.name,
            gradeName: (classData.school_grades as any)?.name || '',
            institutionName: (classData.institutions as any)?.name || '',
            totalStudents,
            totalTests,
            averageScore,
            totalAttempts,
            completionRate,
            studentsPerformance,
            testsPerformance,
            performanceEvolution,
            period: dateFilter
        };
    }

    async getStudentPerformanceReport(studentId: string, dateFilter: ReportDateFilter): Promise<StudentPerformanceReport> {
        // Get student details
        const { data: studentData, error: studentError } = await this.supabase
            .from('students')
            .select(`
                id, class_id, grade_id, institution_id,
                app_users(first_name, last_name),
                classes(name, school_grades(name)),
                institutions(name)
            `)
            .eq('id', studentId)
            .single();

        if (studentError) throw studentError;

        // Get test results for this student within date range
        const { data: results, error: resultsError } = await this.supabase
            .from('test_results')
            .select(`
                id, test_id, score, correct_count, error_count, correction_date, test_release_id,
                tests(title, questions(id))
            `)
            .eq('student_id', studentId)
            .gte('correction_date', dateFilter.startDate)
            .lte('correction_date', dateFilter.endDate)
            .order('correction_date', { ascending: false });

        if (resultsError) throw resultsError;

        // Calculate statistics
        const totalTests = new Set((results || []).map(r => r.test_id)).size;
        const totalAttempts = results?.length || 0;
        const averageScore = totalAttempts > 0
            ? (results || []).reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts
            : 0;
        const scores = (results || []).map(r => r.score || 0).filter(s => s > 0);
        const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
        const worstScore = scores.length > 0 ? Math.min(...scores) : 0;
        const completionRate = totalTests > 0 ? (totalAttempts / totalTests) * 100 : 0;

        // Tests details
        const testsDetails = (results || []).map(r => {
            const test = r.tests as any;
            const questionCount = test?.questions?.length || 0;
            return {
                testId: r.test_id,
                testTitle: test?.title || 'Unknown',
                score: r.score || 0,
                correctCount: r.correct_count || 0,
                errorCount: r.error_count || 0,
                totalQuestions: questionCount,
                attemptDate: r.correction_date,
                testReleaseId: r.test_release_id || ''
            };
        });

        // Calculate performance evolution (grouped by date)
        const evolutionMap = new Map<string, { scores: number[], attempts: number }>();
        (results || []).forEach(r => {
            const date = r.correction_date.split('T')[0]; // Get date part only
            if (!evolutionMap.has(date)) {
                evolutionMap.set(date, { scores: [], attempts: 0 });
            }
            const dayData = evolutionMap.get(date)!;
            dayData.scores.push(r.score || 0);
            dayData.attempts += 1;
        });

        const performanceEvolution = Array.from(evolutionMap.entries())
            .map(([date, data]) => ({
                date,
                averageScore: data.scores.length > 0
                    ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
                    : 0,
                totalAttempts: data.attempts
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const student = studentData.app_users as any;
        const classData = studentData.classes as any;
        const institution = studentData.institutions as any;

        return {
            studentId: studentData.id,
            studentName: student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : 'Unknown',
            classId: studentData.class_id || '',
            className: classData?.name || '',
            gradeName: classData?.school_grades?.name || '',
            institutionName: institution?.name || '',
            totalTests,
            averageScore,
            totalAttempts,
            completionRate,
            bestScore,
            worstScore,
            testsDetails,
            performanceEvolution,
            period: dateFilter
        };
    }

    async getTestPerformanceReport(testId: string, dateFilter: ReportDateFilter): Promise<TestPerformanceReport> {
        // Get test details
        const { data: testData, error: testError } = await this.supabase
            .from('tests')
            .select(`
                id, title, professor_id, institution_id,
                professors(app_users(first_name, last_name)),
                institutions(name),
                questions(id, content)
            `)
            .eq('id', testId)
            .single();

        if (testError) throw testError;

        // Get test results within date range
        const { data: results, error: resultsError } = await this.supabase
            .from('test_results')
            .select(`
                id, student_id, score, correct_count, error_count, correction_date,
                students(app_users(first_name, last_name)),
                student_answers(question_id, selected_option_id, is_correct)
            `)
            .eq('test_id', testId)
            .gte('correction_date', dateFilter.startDate)
            .lte('correction_date', dateFilter.endDate)
            .order('correction_date', { ascending: false });

        if (resultsError) throw resultsError;

        // Calculate statistics
        const totalStudents = new Set((results || []).map(r => r.student_id)).size;
        const totalAttempts = results?.length || 0;
        const averageScore = totalAttempts > 0
            ? (results || []).reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts
            : 0;
        const completionRate = totalStudents > 0 ? (totalAttempts / totalStudents) * 100 : 0;

        // Students performance
        const studentsPerformance: any[] = [];
        const studentMap = new Map<string, any[]>();
        (results || []).forEach(r => {
            if (!studentMap.has(r.student_id)) {
                studentMap.set(r.student_id, []);
            }
            studentMap.get(r.student_id)!.push(r);
        });

        for (const [studentId, studentResults] of studentMap.entries()) {
            const latestResult = studentResults[0];
            const student = latestResult.students as any;
            studentsPerformance.push({
                studentId,
                studentName: student?.app_users
                    ? `${student.app_users.first_name || ''} ${student.app_users.last_name || ''}`.trim()
                    : 'Unknown',
                score: latestResult.score || 0,
                correctCount: latestResult.correct_count || 0,
                errorCount: latestResult.error_count || 0,
                attemptDate: latestResult.correction_date
            });
        }

        // Question performance
        const questions = (testData.questions || []) as any[];
        const questionPerformance: any[] = [];

        for (const question of questions) {
            let correctCount = 0;
            let errorCount = 0;

            (results || []).forEach(r => {
                const answers = (r.student_answers || []) as any[];
                const answer = answers.find((a: any) => a.question_id === question.id);
                if (answer) {
                    if (answer.is_correct) {
                        correctCount++;
                    } else {
                        errorCount++;
                    }
                }
            });

            const totalAttemptsForQuestion = correctCount + errorCount;
            questionPerformance.push({
                questionId: question.id,
                questionContent: question.content || '',
                totalAttempts: totalAttemptsForQuestion,
                correctCount,
                errorCount,
                successRate: totalAttemptsForQuestion > 0 ? (correctCount / totalAttemptsForQuestion) * 100 : 0
            });
        }

        // Calculate performance evolution (grouped by date)
        const evolutionMap = new Map<string, { scores: number[], attempts: number, students: Set<string> }>();
        (results || []).forEach(r => {
            const date = r.correction_date.split('T')[0];
            if (!evolutionMap.has(date)) {
                evolutionMap.set(date, { scores: [], attempts: 0, students: new Set() });
            }
            const dayData = evolutionMap.get(date)!;
            dayData.scores.push(r.score || 0);
            dayData.attempts += 1;
            dayData.students.add(r.student_id);
        });

        const performanceEvolution = Array.from(evolutionMap.entries())
            .map(([date, data]) => ({
                date,
                averageScore: data.scores.length > 0
                    ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
                    : 0,
                completionRate: totalStudents > 0 ? (data.students.size / totalStudents) * 100 : 0,
                totalAttempts: data.attempts
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const professor = testData.professors as any;
        const institution = testData.institutions as any;

        return {
            testId: testData.id,
            testTitle: testData.title,
            professorName: professor?.app_users
                ? `${professor.app_users.first_name || ''} ${professor.app_users.last_name || ''}`.trim()
                : 'Unknown',
            institutionName: institution?.name || '',
            totalStudents,
            totalAttempts,
            averageScore,
            completionRate,
            studentsPerformance,
            questionPerformance,
            performanceEvolution,
            period: dateFilter
        };
    }

    async getClassesForProfessor(professorId: string): Promise<SchoolClass[]> {
        // 1. Fetch classes directly assigned via class_professors
        const { data: assignedClasses, error: assignedError } = await this.supabase
            .from('class_professors')
            .select('classes(*, school_grades(name), institutions(name))')
            .eq('professor_id', professorId);

        if (assignedError) throw assignedError;
        const directClasses = (assignedClasses || []).map((cp: any) => cp.classes).filter(Boolean);

        // 2. Fetch classes through disciplines (professor teaches disciplines that belong to grades, and those grades have classes)
        const { data: disciplines, error: disciplinesError } = await this.supabase
            .from('disciplines')
            .select('grade_id')
            .eq('professor_id', professorId)
            .eq('deleted', false);

        if (disciplinesError) throw disciplinesError;

        let classesViaDisciplines: SchoolClass[] = [];
        if (disciplines && disciplines.length > 0) {
            const gradeIds = [...new Set(disciplines.map(d => d.grade_id).filter(Boolean))] as string[];

            if (gradeIds.length > 0) {
                const { data: classesByGrade, error: classesError } = await this.supabase
                    .from('classes')
                    .select('*, school_grades(name), institutions(name)')
                    .in('grade_id', gradeIds)
                    .eq('deleted', false);

                if (classesError) throw classesError;
                classesViaDisciplines = (classesByGrade || []) as SchoolClass[];
            }
        }

        // Combine both sources and remove duplicates
        const allClassesMap = new Map<string, SchoolClass>();
        [...directClasses, ...classesViaDisciplines].forEach((cls: SchoolClass) => {
            if (cls && cls.id && !cls.deleted) {
                allClassesMap.set(cls.id, cls);
            }
        });

        return Array.from(allClassesMap.values());
    }

    async getClassesForInstitution(institutionId: string): Promise<SchoolClass[]> {
        const { data, error } = await this.supabase
            .from('classes')
            .select('*, school_grades(name), institutions(name)')
            .eq('institution_id', institutionId)
            .eq('deleted', false);

        if (error) throw error;
        return data || [];
    }

    async getStudentsForProfessor(professorId: string): Promise<Student[]> {
        // Get classes assigned to professor
        const { data: classProfs, error: classProfsError } = await this.supabase
            .from('class_professors')
            .select('class_id')
            .eq('professor_id', professorId);

        if (classProfsError) throw classProfsError;
        const classIds = (classProfs || []).map(cp => cp.class_id);

        if (classIds.length === 0) return [];

        // Get students from those classes
        const { data, error } = await this.supabase
            .from('students')
            .select('*, app_users(first_name, last_name), classes(name), school_grades(name), institutions(name)')
            .in('class_id', classIds)
            .eq('deleted', false);

        if (error) throw error;
        return data || [];
    }

    async getStudentsForInstitution(institutionId: string): Promise<Student[]> {
        const { data, error } = await this.supabase
            .from('students')
            .select('*, app_users(first_name, last_name), classes(name), school_grades(name), institutions(name)')
            .eq('institution_id', institutionId)
            .eq('deleted', false);

        if (error) throw error;
        return data || [];
    }

    async getTestsForProfessor(professorId: string): Promise<Test[]> {
        const { data, error } = await this.supabase
            .from('tests')
            .select('*, professors(app_users(first_name, last_name)), school_grades(name), institutions(name)')
            .eq('professor_id', professorId)
            .eq('deleted', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async getTestsForInstitution(institutionId: string): Promise<Test[]> {
        const { data, error } = await this.supabase
            .from('tests')
            .select('*, professors(app_users(first_name, last_name)), school_grades(name), institutions(name)')
            .eq('institution_id', institutionId)
            .eq('deleted', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async getInstitutionPerformanceReport(institutionId: string, dateFilter: ReportDateFilter): Promise<InstitutionPerformanceReport> {
        // Get institution details
        const { data: institutionData, error: institutionError } = await this.supabase
            .from('institutions')
            .select('id, name')
            .eq('id', institutionId)
            .single();

        if (institutionError) throw institutionError;

        // Get all classes in institution
        const { data: classesData, error: classesError } = await this.supabase
            .from('classes')
            .select('id, name, grade_id, school_grades(name)')
            .eq('institution_id', institutionId)
            .eq('deleted', false);

        if (classesError) throw classesError;
        const classIds = (classesData || []).map(c => c.id);

        // Get all students in institution
        const { data: studentsData, error: studentsError } = await this.supabase
            .from('students')
            .select('id, class_id, app_users(first_name, last_name)')
            .eq('institution_id', institutionId)
            .eq('deleted', false);

        if (studentsError) throw studentsError;
        const studentIds = (studentsData || []).map(s => s.id);

        // Se não houver estudantes, retornar relatório vazio
        if (studentIds.length === 0) {
            return {
                institutionId: institutionId,
                institutionName: '',
                totalClasses: 0,
                totalStudents: 0,
                totalTests: 0,
                totalAttempts: 0,
                averageScore: 0,
                completionRate: 0,
                classesPerformance: [],
                studentsPerformance: [],
                testsPerformance: [],
                period: {
                    startDate: dateFilter.startDate,
                    endDate: dateFilter.endDate
                }
            };
        }

        // Get all test results for students in this institution within date range
        const { data: results, error: resultsError } = await this.supabase
            .from('test_results')
            .select(`
                id, test_id, student_id, score, correct_count, error_count, correction_date,
                tests(title, professor_id, professors(app_users(first_name, last_name))),
                students(id, class_id, app_users(first_name, last_name), classes(name, school_grades(name)))
            `)
            .in('student_id', studentIds)
            .gte('correction_date', dateFilter.startDate)
            .lte('correction_date', dateFilter.endDate)
            .order('correction_date', { ascending: false });

        if (resultsError) throw resultsError;

        // Get unique test IDs
        const testIds = [...new Set((results || []).map(r => r.test_id))];

        // Calculate overall statistics
        const totalClasses = classIds.length;
        const totalStudents = studentIds.length;
        const totalTests = testIds.length;
        const totalAttempts = results?.length || 0;
        const averageScore = totalAttempts > 0
            ? (results || []).reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts
            : 0;
        const completionRate = totalStudents > 0 && totalTests > 0
            ? (totalAttempts / (totalStudents * totalTests)) * 100
            : 0;

        // Classes performance summary
        const classesPerformance: ClassPerformanceSummary[] = [];
        for (const classData of classesData || []) {
            const classResults = (results || []).filter(r => {
                const student = r.students as any;
                return student?.class_id === classData.id;
            });

            if (classResults.length > 0) {
                const classStudentIds = new Set(classResults.map(r => r.student_id));
                const classTestIds = new Set(classResults.map(r => r.test_id));
                const classAvg = classResults.reduce((sum, r) => sum + (r.score || 0), 0) / classResults.length;
                const classCompletionRate = classStudentIds.size > 0 && classTestIds.size > 0
                    ? (classResults.length / (classStudentIds.size * classTestIds.size)) * 100
                    : 0;

                classesPerformance.push({
                    classId: classData.id,
                    className: classData.name,
                    gradeName: (classData.school_grades as any)?.name || '',
                    totalStudents: classStudentIds.size,
                    totalTests: classTestIds.size,
                    averageScore: classAvg,
                    completionRate: classCompletionRate
                });
            }
        }

        // Students performance summary (top performers)
        const studentMap = new Map<string, any[]>();
        (results || []).forEach(r => {
            if (!studentMap.has(r.student_id)) {
                studentMap.set(r.student_id, []);
            }
            studentMap.get(r.student_id)!.push(r);
        });

        const studentsPerformance: any[] = [];
        for (const [studentId, studentResults] of studentMap.entries()) {
            const studentAvg = studentResults.reduce((sum, r) => sum + (r.score || 0), 0) / studentResults.length;
            const studentTestIds = new Set(studentResults.map(r => r.test_id));
            const student = studentResults[0]?.students as any;
            const studentName = student?.app_users
                ? `${student.app_users.first_name || ''} ${student.app_users.last_name || ''}`.trim()
                : 'Unknown';

            studentsPerformance.push({
                studentId,
                studentName,
                averageScore: studentAvg,
                totalTests: studentTestIds.size,
                completionRate: totalTests > 0 ? (studentTestIds.size / totalTests) * 100 : 0
            });
        }

        // Tests performance summary
        const testsPerformance: TestPerformanceSummary[] = [];
        for (const testId of testIds) {
            const testResults = (results || []).filter(r => r.test_id === testId);
            if (testResults.length > 0) {
                const testAvg = testResults.reduce((sum, r) => sum + (r.score || 0), 0) / testResults.length;
                const testStudentIds = new Set(testResults.map(r => r.student_id));
                const testData = testResults[0]?.tests as any;
                const professor = testData?.professors as any;
                const professorName = professor?.app_users
                    ? `${professor.app_users.first_name || ''} ${professor.app_users.last_name || ''}`.trim()
                    : 'Unknown';

                testsPerformance.push({
                    testId,
                    testTitle: testData?.title || 'Unknown',
                    professorName,
                    averageScore: testAvg,
                    totalStudents: testStudentIds.size,
                    completionRate: totalStudents > 0 ? (testStudentIds.size / totalStudents) * 100 : 0
                });
            }
        }

        return {
            institutionId: institutionData.id,
            institutionName: institutionData.name,
            totalClasses,
            totalStudents,
            totalTests,
            totalAttempts,
            averageScore,
            completionRate,
            classesPerformance,
            studentsPerformance,
            testsPerformance,
            period: dateFilter
        };
    }

    async getProfessorPerformanceReport(professorId: string, dateFilter: ReportDateFilter): Promise<ProfessorPerformanceReport> {
        // Get professor details
        const { data: professorData, error: professorError } = await this.supabase
            .from('professors')
            .select(`
                id, user_id,
                app_users(first_name, last_name),
                departments(institution_id, institutions(name))
            `)
            .eq('id', professorId)
            .single();

        if (professorError) throw professorError;

        const professor = professorData.app_users as any;
        const department = professorData.departments as any;
        const institution = department?.institutions as any;
        const institutionId = department?.institution_id;

        // Get all classes assigned to professor
        const { data: classProfs, error: classProfsError } = await this.supabase
            .from('class_professors')
            .select('class_id, classes(id, name, grade_id, school_grades(name))')
            .eq('professor_id', professorId);

        if (classProfsError) throw classProfsError;
        const classIds = (classProfs || []).map(cp => cp.class_id);
        const classesData = (classProfs || []).map(cp => cp.classes).filter(Boolean) as any[];

        // Get all students from professor's classes
        const { data: studentsData, error: studentsError } = await this.supabase
            .from('students')
            .select('id, class_id, app_users(first_name, last_name)')
            .in('class_id', classIds.length > 0 ? classIds : [''])
            .eq('deleted', false);

        if (studentsError) throw studentsError;
        const studentIds = (studentsData || []).map(s => s.id);

        // Get all tests created by professor
        const { data: testsData, error: testsError } = await this.supabase
            .from('tests')
            .select('id, title')
            .eq('professor_id', professorId)
            .eq('deleted', false);

        if (testsError) throw testsError;
        const testIds = (testsData || []).map(t => t.id);

        // Get all test results for students in professor's classes AND tests created by professor within date range
        // Only include results that match both: professor's tests AND professor's students
        let results: any[] = [];

        if (testIds.length > 0 && studentIds.length > 0) {
            const { data: resultsData, error: resultsError } = await this.supabase
                .from('test_results')
                .select(`
                    id, test_id, student_id, score, correct_count, error_count, correction_date,
                    tests(title),
                    students(id, class_id, app_users(first_name, last_name), classes(name, school_grades(name)))
                `)
                .in('student_id', studentIds)
                .in('test_id', testIds)
                .gte('correction_date', dateFilter.startDate)
                .lte('correction_date', dateFilter.endDate)
                .order('correction_date', { ascending: false });

            if (resultsError) throw resultsError;
            results = resultsData || [];
        }

        // Calculate overall statistics
        const totalClasses = classIds.length;
        const totalStudents = studentIds.length;
        const totalTests = testIds.length;
        const totalAttempts = results?.length || 0;
        const averageScore = totalAttempts > 0
            ? (results || []).reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts
            : 0;
        const completionRate = totalStudents > 0 && totalTests > 0
            ? (totalAttempts / (totalStudents * totalTests)) * 100
            : 0;

        // Classes performance summary
        const classesPerformance: ClassPerformanceSummary[] = [];
        for (const classData of classesData) {
            const classResults = (results || []).filter(r => {
                const student = r.students as any;
                return student?.class_id === classData.id;
            });

            if (classResults.length > 0) {
                const classStudentIds = new Set(classResults.map(r => r.student_id));
                const classTestIds = new Set(classResults.map(r => r.test_id));
                const classAvg = classResults.reduce((sum, r) => sum + (r.score || 0), 0) / classResults.length;
                const classCompletionRate = classStudentIds.size > 0 && classTestIds.size > 0
                    ? (classResults.length / (classStudentIds.size * classTestIds.size)) * 100
                    : 0;

                classesPerformance.push({
                    classId: classData.id,
                    className: classData.name,
                    gradeName: (classData.school_grades as any)?.name || '',
                    totalStudents: classStudentIds.size,
                    totalTests: classTestIds.size,
                    averageScore: classAvg,
                    completionRate: classCompletionRate
                });
            }
        }

        // Students performance summary
        const studentMap = new Map<string, any[]>();
        (results || []).forEach(r => {
            if (!studentMap.has(r.student_id)) {
                studentMap.set(r.student_id, []);
            }
            studentMap.get(r.student_id)!.push(r);
        });

        const studentsPerformance: any[] = [];
        for (const [studentId, studentResults] of studentMap.entries()) {
            const studentAvg = studentResults.reduce((sum, r) => sum + (r.score || 0), 0) / studentResults.length;
            const studentTestIds = new Set(studentResults.map(r => r.test_id));
            const student = studentResults[0]?.students as any;
            const studentName = student?.app_users
                ? `${student.app_users.first_name || ''} ${student.app_users.last_name || ''}`.trim()
                : 'Unknown';

            studentsPerformance.push({
                studentId,
                studentName,
                averageScore: studentAvg,
                totalTests: studentTestIds.size,
                completionRate: totalTests > 0 ? (studentTestIds.size / totalTests) * 100 : 0
            });
        }

        // Tests performance summary
        const testsPerformance: TestPerformanceSummary[] = [];
        for (const testId of testIds) {
            const testResults = (results || []).filter(r => r.test_id === testId);
            if (testResults.length > 0) {
                const testAvg = testResults.reduce((sum, r) => sum + (r.score || 0), 0) / testResults.length;
                const testStudentIds = new Set(testResults.map(r => r.student_id));
                const testData = testResults[0]?.tests as any;

                testsPerformance.push({
                    testId,
                    testTitle: testData?.title || 'Unknown',
                    averageScore: testAvg,
                    totalStudents: testStudentIds.size,
                    completionRate: totalStudents > 0 ? (testStudentIds.size / totalStudents) * 100 : 0
                });
            }
        }

        return {
            professorId: professorData.id,
            professorName: professor
                ? `${professor.first_name || ''} ${professor.last_name || ''}`.trim()
                : 'Unknown',
            institutionName: institution?.name || '',
            totalClasses,
            totalStudents,
            totalTests,
            totalAttempts,
            averageScore,
            completionRate,
            classesPerformance,
            studentsPerformance,
            testsPerformance,
            period: dateFilter
        };
    }
}