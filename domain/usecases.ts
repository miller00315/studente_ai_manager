import { 
  IQuestionRepository, ITestRepository, IProfessorRepository, IStudentRepository, 
  IInstitutionRepository, IClassRepository, IAIRepository, IAIAgentRepository, 
  ITestReleaseRepository, IUserRuleRepository, ISettingsRepository, ILibraryRepository,
  IBNCCRepository, IClassroomRoomRepository, IClassroomMessageRepository, IMessageReactionRepository,
  IStudentDisabilityRepository, IReportRepository
} from './interfaces';
import { 
  Question, Test, Professor, Institution, SchoolClass, Student, TestResult, 
  AIAgent, TestRelease, UserRule, UserRegistrationDTO, InstitutionType, 
  SchoolGrade, Department, Discipline, AIQuestionParams, AnalyzedSheet, Address, TestReleaseSite, Library, LibraryItem,
  BNCCItem, ClassroomRoom, ClassroomMessage, MessageReactionType, StudentDisability,
  ClassPerformanceReport, StudentPerformanceReport, TestPerformanceReport, ReportDateFilter,
  InstitutionPerformanceReport, ProfessorPerformanceReport
} from '../../types';

export class QuestionUseCases {
    constructor(private repo: IQuestionRepository, private aiRepo: IAIRepository) {}
    async getQuestions(includeDeleted?: boolean) { return this.repo.getQuestions(includeDeleted); }
    async saveQuestion(id: string | null, question: Partial<Question>, options: any[], imageFile?: File) { return this.repo.saveQuestion({...question, id: id || undefined}, options, imageFile); }
    async deleteQuestion(id: string) { return this.repo.deleteQuestion(id); }
    async restoreQuestion(id: string) { return this.repo.restoreQuestion(id); }
    async generateFromAI(params: AIQuestionParams) { return this.aiRepo.generateQuestions(params); }
}

export class TestUseCases {
    constructor(private repo: ITestRepository) {}
    async getTests(includeDeleted?: boolean) { return this.repo.getTests(includeDeleted); }
    async getTestsByInstitution(id: string, includeDeleted?: boolean) { return this.repo.getTestsByInstitution(id, includeDeleted); }
    async getTestsByProfessor(id: string, includeDeleted?: boolean) { return this.repo.getTestsByProfessor(id, includeDeleted); }
    async createTest(test: Partial<Test>, qIds: string[], weights?: Record<string, number>) { return this.repo.createTest(test, qIds, weights); }
    async updateTest(id: string, test: Partial<Test>, qIds: string[], weights?: Record<string, number>) { return this.repo.updateTest(id, test, qIds, weights); }
    async getTestDetails(id: string) { return this.repo.getTestDetails(id); }
    async deleteTest(id: string) { return this.repo.deleteTest(id); }
    async restoreTest(id: string) { return this.repo.restoreTest(id); }
}

export class ProfessorUseCases {
    constructor(private repo: IProfessorRepository) {}
    async getProfessors(includeDeleted?: boolean) { return this.repo.getProfessors(includeDeleted); }
    async getProfessorsByInstitution(id: string, includeDeleted?: boolean) { return this.repo.getProfessorsByInstitution(id, includeDeleted); }
    async getProfessorDetails(id: string) { return this.repo.getProfessorDetails(id); }
    async registerProfessor(data: UserRegistrationDTO, file?: File, address?: Partial<Address>) { return this.repo.addProfessor(data, file, address); }
    async removeProfessor(id: string) { return this.repo.removeProfessor(id); }
    async restoreProfessor(id: string) { return this.repo.restoreProfessor(id); }
    async uploadProfessorImage(id: string, file: File) { return this.repo.uploadProfessorImage(id, file); }
    async getAssignedClasses(id: string) { return this.repo.getAssignedClasses(id); }
    async getTests(id: string) { return this.repo.getTests(id); }
    async getDisciplines(id: string) { return this.repo.getDisciplines(id); }
    async getStudents(id: string) { return this.repo.getStudents(id); }
    async assignToClass(profId: string, classId: string) { return this.repo.assignToClass(profId, classId); }
    async removeFromClass(profId: string, classId: string) { return this.repo.removeFromClass(profId, classId); }
}

export class StudentUseCases {
    constructor(private repo: IStudentRepository, private testRepo?: ITestRepository) {}
    async getStudents(includeDeleted?: boolean) { return this.repo.getStudents(includeDeleted); }
    async getStudentsByInstitution(id: string, includeDeleted?: boolean) { return this.repo.getStudentsByInstitution(id, includeDeleted); }
    async getStudentsByClass(id: string) { return this.repo.getStudentsByClass(id); }
    async addStudent(data: UserRegistrationDTO, file?: File) { return this.repo.addStudent(data, file); }
    async updateStudent(id: string, data: Partial<Student>) { return this.repo.updateStudent(id, data); }
    async removeStudent(id: string) { return this.repo.removeStudent(id); }
    async restoreStudent(id: string) { return this.repo.restoreStudent(id); }
    async getStudentHistory(id: string) { return this.repo.getStudentHistory(id); }
    async uploadStudentImage(id: string, file: File) { return this.repo.uploadStudentImage(id, file); }
}

export class InstitutionUseCases {
    constructor(private repo: IInstitutionRepository) {}
    async getInstitutions(includeDeleted?: boolean) { return this.repo.getInstitutions(includeDeleted); }
    async getInstitutionDetails(id: string) { return this.repo.getInstitutionDetails(id); }
    async addInstitution(inst: Partial<Institution>, addr?: Partial<Address>, manager?: UserRegistrationDTO) { return this.repo.addInstitution(inst, addr, manager); }
    async updateInstitution(id: string, inst: Partial<Institution>, addr?: Partial<Address>, manager?: Partial<UserRegistrationDTO>) { return this.repo.updateInstitution(id, inst, addr, manager); }
    async removeInstitution(id: string) { return this.repo.removeInstitution(id); }
    async restoreInstitution(id: string) { return this.repo.restoreInstitution(id); }
    async createStripeCustomerForManager(managerId: string) { return this.repo.createStripeCustomerForManager(managerId); }
}

export class ClassUseCases {
    constructor(private repo: IClassRepository, private testRepo?: ITestRepository) {}
    async getClasses(includeDeleted?: boolean) { return this.repo.getClasses(includeDeleted); }
    async getClassesByInstitution(id: string, includeDeleted?: boolean) { return this.repo.getClassesByInstitution(id, includeDeleted); }
    async getClassDetails(id: string) { return this.repo.getClassDetails(id); }
    async addClass(cls: Partial<SchoolClass>) { return this.repo.addClass(cls); }
    async updateClass(id: string, cls: Partial<SchoolClass>) { return this.repo.updateClass(id, cls); }
    async removeClass(id: string) { return this.repo.removeClass(id); }
    async restoreClass(id: string) { return this.repo.restoreClass(id); }
    async assignProfessor(classId: string, profId: string) { return this.repo.assignProfessor(classId, profId); }
    async removeProfessor(classId: string, profId: string) { return this.repo.removeProfessor(classId, profId); }
    async getClassResults(classId: string) { return this.repo.getClassResults(classId); }
}

export class AIAgentUseCases {
    constructor(private repo: IAIAgentRepository, private aiRepo: IAIRepository) {}
    async getAgents() { return this.repo.getAgents(); }
    async saveAgent(id: string | null, agent: Partial<AIAgent>) { return this.repo.saveAgent(id, agent); }
    async deleteAgent(id: string) { return this.repo.deleteAgent(id); }
    async restoreAgent(id: string) { return this.repo.restoreAgent(id); }
    async chatWithAgent(agent: AIAgent, history: any[], message: string) { 
        const context = await this.repo.getAgentKnowledge(agent.id);
        return this.repo.chatWithAgent(agent, history, message, context); 
    }
}

export class TestReleaseUseCases {
    constructor(private repo: ITestReleaseRepository) {}
    async getReleases(includeDeleted?: boolean) { return this.repo.getReleases(includeDeleted); }
    async getReleasesByInstitution(id: string, includeDeleted?: boolean) { return this.repo.getReleasesByInstitution(id, includeDeleted); }
    async getReleasesByClass(id: string) { return this.repo.getReleasesByClass(id); }
    async getReleasesByStudent(id: string) { return this.repo.getReleasesByStudent(id); }
    async getReleasesByProfessor(id: string, includeDeleted?: boolean) { return this.repo.getReleasesByProfessor(id, includeDeleted); }
    async createRelease(release: Partial<TestRelease>, sites?: Partial<TestReleaseSite>[]) { return this.repo.createRelease(release, sites); }
    async createBulkReleases(base: Partial<TestRelease>, sIds: string[], sites?: Partial<TestReleaseSite>[]) { return this.repo.createBulkReleases(base, sIds, sites); }
    async deleteRelease(id: string) { return this.repo.deleteRelease(id); }
    async restoreRelease(id: string) { return this.repo.restoreRelease(id); }
    async addAllowedSite(relId: string, site: Partial<TestReleaseSite>) { return this.repo.addAllowedSite(relId, site); }
    async removeAllowedSite(siteId: string) { return this.repo.removeAllowedSite(siteId); }
}

export class UserRuleUseCases {
    constructor(private repo: IUserRuleRepository) {}
    async getRules() { return this.repo.getRules(); }
    async saveRule(id: string | null, rule: Partial<UserRule>) { return this.repo.saveRule(id, rule); }
    async deleteRule(id: string) { return this.repo.deleteRule(id); }
    async restoreRule(id: string) { return this.repo.restoreRule(id); }
}

export class SettingsUseCases {
    constructor(private repo: ISettingsRepository) {}
    async getInstitutionTypes(includeDeleted?: boolean) { return this.repo.getInstitutionTypes(includeDeleted); }
    async addInstitutionType(type: Partial<InstitutionType>) { return this.repo.addInstitutionType(type); }
    async updateInstitutionType(id: string, type: Partial<InstitutionType>) { return this.repo.updateInstitutionType(id, type); }
    async removeInstitutionType(id: string) { return this.repo.removeInstitutionType(id); }
    async restoreInstitutionType(id: string) { return this.repo.restoreInstitutionType(id); }
    async getSchoolGrades(inc?: boolean) { return this.repo.getSchoolGrades(inc); }
    async getSchoolGradesByInstitution(id: string, inc?: boolean) { return this.repo.getSchoolGradesByInstitution(id, inc); }
    async addSchoolGrade(grade: Partial<SchoolGrade>) { return this.repo.addSchoolGrade(grade); }
    async updateSchoolGrade(id: string, grade: Partial<SchoolGrade>) { return this.repo.updateSchoolGrade(id, grade); }
    async removeSchoolGrade(id: string) { return this.repo.removeSchoolGrade(id); }
    async restoreSchoolGrade(id: string) { return this.repo.restoreSchoolGrade(id); }
    async getDepartments(id: string, inc?: boolean) { return this.repo.getDepartments(id, inc); }
    async addDepartment(d: Partial<Department>) { return this.repo.addDepartment(d); }
    async updateDepartment(id: string, d: Partial<Department>) { return this.repo.updateDepartment(id, d); }
    async removeDepartment(id: string) { return this.repo.removeDepartment(id); }
    async restoreDepartment(id: string) { return this.repo.restoreDepartment(id); }
    async getAllDisciplines(id: string, inc?: boolean) { return this.repo.getAllDisciplines(id, inc); }
    async getDisciplines(gradeId: string) { return this.repo.getDisciplines(gradeId); }
    async addDiscipline(d: Partial<Discipline>) { return this.repo.addDiscipline(d); }
    async updateDiscipline(id: string, d: Partial<Discipline>) { return this.repo.updateDiscipline(id, d); }
    async removeDiscipline(id: string) { return this.repo.removeDiscipline(id); }
    async restoreDiscipline(id: string) { return this.repo.restoreDiscipline(id); }
}

export class LibraryUseCases {
    constructor(private repo: ILibraryRepository) {}
    async getLibraries(gradeId: string, includeDeleted?: boolean) { return this.repo.getLibrariesByGrade(gradeId, includeDeleted); }
    async createLibrary(library: Partial<Library>) { await this.repo.createLibrary(library); }
    async deleteLibrary(id: string) { await this.repo.deleteLibrary(id); }
    async restoreLibrary(id: string) { await this.repo.restoreLibrary(id); }
    async getItems(libraryId: string, includeDeleted?: boolean) { return this.repo.getItems(libraryId, includeDeleted); }
    async addItem(item: Partial<LibraryItem>, file: File) { await this.repo.addItem(item, file); }
    async deleteItem(id: string) { await this.repo.deleteItem(id); }
    async restoreItem(id: string) { await this.repo.restoreItem(id); }
}

export class BNCCUseCases {
    constructor(private repo: IBNCCRepository) {}
    async getItems(includeDeleted?: boolean) { return this.repo.getAll(includeDeleted); }
    async createItem(item: Partial<BNCCItem>) { await this.repo.create(item); }
    async updateItem(id: string, item: Partial<BNCCItem>) { await this.repo.update(id, item); }
    async deleteItem(id: string) { await this.repo.delete(id); }
    async restoreItem(id: string) { await this.repo.restore(id); }
}

export class ResultsUseCases {
    constructor(private repo: ITestRepository, private releaseRepo?: ITestReleaseRepository) {}
    async getResults(includeDeleted?: boolean) { return this.repo.getResults(includeDeleted); }
    async getResultsByInstitution(id: string) { return this.repo.getResultsByInstitution(id); }
    async getResultsByProfessor(id: string) { return this.repo.getResultsByProfessor(id); }
    async getResultsByStudent(id: string) { return this.repo.getResultsByStudent(id); }
    async updateAnswer(resId: string, qId: string, newOpt: string, oldOpt?: string) { return this.repo.updateAnswer(resId, qId, newOpt, oldOpt); }
    async recalculateScore(resId: string) { return this.repo.recalculateScore(resId); }
    async getLogs(resId: string) { return this.repo.getLogs(resId); }
    async getStudentAnswers(resId: string) { return this.repo.getStudentAnswers(resId); }
    async getAttemptLogs(tId: string, sId: string) { return this.repo.getAttemptLogs(tId, sId); }
    async getTestDetails(id: string) { return this.repo.getTestDetails(id); }
}

export class GradingUseCases {
    constructor(private repo: ITestRepository, private ai: IAIRepository, private releaseRepo?: ITestReleaseRepository) {}
    async analyzeAndGrade(base64: string, releaseId?: string) { 
        const analysis = await this.ai.analyzeSheet(base64);
        
        // Se releaseId foi fornecido, buscar o test_id através da liberação
        let testId = analysis.test_id || '';
        if (releaseId && this.releaseRepo) {
            try {
                // Buscar todas as liberações e encontrar a específica
                // Nota: Idealmente teríamos um método getReleaseById, mas por enquanto usamos getReleases
                const releases = await this.releaseRepo.getReleases(false);
                const release = releases.find(r => r.id === releaseId);
                if (release) {
                    testId = release.test_id;
                }
            } catch (err: any) {
                throw new Error('Failed to fetch test release: ' + err.message);
            }
        } else if (releaseId && !this.releaseRepo) {
            // Fallback: tentar acessar diretamente através do repositório de testes
            const repoImpl = this.repo as any;
            if (repoImpl.supabase) {
                const { data: release, error } = await repoImpl.supabase
                    .from('test_releases')
                    .select('test_id')
                    .eq('id', releaseId)
                    .single();
                if (!error && release) {
                    testId = release.test_id;
                } else if (error) {
                    throw new Error('Failed to fetch test release: ' + error.message);
                }
            }
        }
        
        if (!testId) {
            throw new Error('Test ID not found. Please ensure a test release is selected or the test ID is detected in the image.');
        }
        
        const test = await this.repo.getTestDetails(testId);
        
        let score = 0;
        let correctCount = 0;
        const gradedQuestions: any[] = [];

        if (test && test.questions) {
            const totalQuestions = test.questions.length;
            
            test.questions.forEach((q: any, idx: number) => {
                // Busca a resposta do estudante pelo número da questão
                const studentAns = analysis.answers.find(a => a.question_number === (idx + 1));
                // Encontra a opção correta (is_correct = true)
                const correctOpt = q.question_options.find((o: any) => o.is_correct);
                // Encontra a opção selecionada pela letra/key
                const selectedOpt = q.question_options.find((o: any) => o.key === studentAns?.selected_option);
                
                // Compara diretamente os IDs: selecionado === correto
                const isCorrect = selectedOpt?.id != null && selectedOpt?.id === correctOpt?.id;
                
                if (isCorrect) {
                    correctCount++;
                }

                gradedQuestions.push({
                    questionId: q.id,
                    questionContent: q.content,
                    selectedOption: studentAns?.selected_option || '-',
                    selectedOptionId: selectedOpt?.id || null,
                    correctOption: correctOpt?.key || '?',
                    correctOptionId: correctOpt?.id || null,
                    isCorrect
                });
            });
            
            // Nota simples: (acertos / total) * 100
            score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        }

        return {
            analysis,
            test,
            gradedQuestions,
            score,
            correctCount,
            totalQuestions: test?.questions?.length || 0
        };
    }
    
    async saveResult(data: any) {
        return this.repo.saveResult({
            test_id: data.test_id,
            student_name: data.student_name,
            score: data.score,
            student_id: data.student_id,
            student_hash: data.student_hash,
            image_url: 'TODO_UPLOAD' 
        }, data.gradedQuestions);
    }
}

export class ClassroomRoomUseCases {
    constructor(private repo: IClassroomRoomRepository) {}
    async getRoomsByClass(classId: string, includeDeleted?: boolean) { return this.repo.getRoomsByClass(classId, includeDeleted); }
    async createRoom(room: Partial<ClassroomRoom>) { return this.repo.createRoom(room); }
    async updateRoom(id: string, room: Partial<ClassroomRoom>) { return this.repo.updateRoom(id, room); }
    async deleteRoom(id: string) { return this.repo.deleteRoom(id); }
    async restoreRoom(id: string) { return this.repo.restoreRoom(id); }
}

export class ClassroomMessageUseCases {
    constructor(private repo: IClassroomMessageRepository) {}
    // Apenas admin/institution podem listar todas mensagens
    async getMessagesByRoom(roomId: string, includeDeleted?: boolean) { return this.repo.getMessagesByRoom(roomId, includeDeleted); }
    // Professor pode listar suas próprias mensagens
    async getMessagesByUserInRoom(roomId: string, userId: string, includeDeleted?: boolean) { return this.repo.getMessagesByUserInRoom(roomId, userId, includeDeleted); }
    // Professor pode enviar mensagens para salas de suas turmas
    async sendMessage(message: Partial<ClassroomMessage>) { return this.repo.sendMessage(message); }
    async updateMessage(id: string, message: Partial<ClassroomMessage>) { return this.repo.updateMessage(id, message); }
    async deleteMessage(id: string) { return this.repo.deleteMessage(id); }
    async restoreMessage(id: string) { return this.repo.restoreMessage(id); }
}

export class MessageReactionUseCases {
    constructor(private repo: IMessageReactionRepository) {}
    
    // Obter reações de uma mensagem
    async getReactionsByMessage(messageId: string) { 
        return this.repo.getReactionsByMessage(messageId); 
    }
    
    // Obter contagem de reações de uma mensagem
    async getReactionCounts(messageId: string) { 
        return this.repo.getReactionCounts(messageId); 
    }
    
    // Obter contagem de reações para múltiplas mensagens (otimizado para listas)
    async getReactionCountsForMessages(messageIds: string[]) { 
        return this.repo.getReactionCountsForMessages(messageIds); 
    }
    
    // Obter reação do usuário em uma mensagem específica
    async getUserReaction(messageId: string, userId: string) { 
        return this.repo.getUserReaction(messageId, userId); 
    }
    
    // Obter reações do usuário em múltiplas mensagens (otimizado para listas)
    async getUserReactionsForMessages(messageIds: string[], userId: string) { 
        return this.repo.getUserReactionsForMessages(messageIds, userId); 
    }
    
    // Toggle reaction: adiciona, atualiza ou remove reação
    async toggleReaction(messageId: string, userId: string, reactionType: MessageReactionType) { 
        return this.repo.toggleReaction(messageId, userId, reactionType); 
    }
    
    // Remover reação (soft delete)
    async removeReaction(reactionId: string) { 
        return this.repo.removeReaction(reactionId); 
    }
    
    // Restaurar reação
    async restoreReaction(reactionId: string) { 
        return this.repo.restoreReaction(reactionId); 
    }
}

export class StudentDisabilityUseCases {
    constructor(private repo: IStudentDisabilityRepository) {}
    async getDisabilitiesByStudent(studentId: string) { return this.repo.getDisabilitiesByStudent(studentId); }
    async getDisabilitiesByInstitution(institutionId: string) { return this.repo.getDisabilitiesByInstitution(institutionId); }
    async getDisabilityById(id: string) { return this.repo.getDisabilityById(id); }
    async addDisability(disability: Partial<StudentDisability>, documentFile?: File) { return this.repo.addDisability(disability, documentFile); }
    async updateDisability(id: string, disability: Partial<StudentDisability>, documentFile?: File) { return this.repo.updateDisability(id, disability, documentFile); }
    async deleteDisability(id: string) { return this.repo.deleteDisability(id); }
    async uploadDocument(id: string, file: File) { return this.repo.uploadDocument(id, file); }
}

export class ReportUseCases {
    constructor(private repo: IReportRepository) {}
    async getClassPerformanceReport(classId: string, dateFilter: ReportDateFilter) { return this.repo.getClassPerformanceReport(classId, dateFilter); }
    async getStudentPerformanceReport(studentId: string, dateFilter: ReportDateFilter) { return this.repo.getStudentPerformanceReport(studentId, dateFilter); }
    async getTestPerformanceReport(testId: string, dateFilter: ReportDateFilter) { return this.repo.getTestPerformanceReport(testId, dateFilter); }
    async getInstitutionPerformanceReport(institutionId: string, dateFilter: ReportDateFilter) { return this.repo.getInstitutionPerformanceReport(institutionId, dateFilter); }
    async getProfessorPerformanceReport(professorId: string, dateFilter: ReportDateFilter) { return this.repo.getProfessorPerformanceReport(professorId, dateFilter); }
    async getClassesForProfessor(professorId: string) { return this.repo.getClassesForProfessor(professorId); }
    async getClassesForInstitution(institutionId: string) { return this.repo.getClassesForInstitution(institutionId); }
    async getStudentsForProfessor(professorId: string) { return this.repo.getStudentsForProfessor(professorId); }
    async getStudentsForInstitution(institutionId: string) { return this.repo.getStudentsForInstitution(institutionId); }
    async getTestsForProfessor(professorId: string) { return this.repo.getTestsForProfessor(professorId); }
    async getTestsForInstitution(institutionId: string) { return this.repo.getTestsForInstitution(institutionId); }
}