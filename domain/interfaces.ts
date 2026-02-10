import { 
    Question, Test, Professor, Institution, AIQuestionParams, AnalyzedSheet, 
    TestResult, AIAgent, Student, TestRelease, SchoolClass, UserRule, 
    UserRegistrationDTO, Address, InstitutionType, SchoolGrade, Department, 
    Discipline, TestResultCorrectionLog, StudentTestAnswer, TestAttemptLog, 
    Library, LibraryItem, TestReleaseSite, BNCCItem, ClassroomRoom, ClassroomMessage,
    MessageReaction, MessageReactionType, MessageReactionCounts, StudentDisability,
    ClassPerformanceReport, StudentPerformanceReport, TestPerformanceReport, ReportDateFilter,
    InstitutionPerformanceReport, ProfessorPerformanceReport
} from '../../types';

export interface IQuestionRepository {
    getQuestions(includeDeleted?: boolean): Promise<Question[]>;
    saveQuestion(question: Partial<Question>, options: any[], imageFile?: File): Promise<void>;
    deleteQuestion(id: string): Promise<void>;
    restoreQuestion(id: string): Promise<void>;
}

export interface ITestRepository {
    getTests(includeDeleted?: boolean): Promise<Test[]>;
    getTestsByInstitution(institutionId: string, includeDeleted?: boolean): Promise<Test[]>;
    getTestsByProfessor(professorId: string, includeDeleted?: boolean): Promise<Test[]>;
    createTest(test: Partial<Test>, questionIds: string[], weights?: Record<string, number>): Promise<void>;
    updateTest(id: string, test: Partial<Test>, questionIds: string[], weights?: Record<string, number>): Promise<void>;
    getTestDetails(id: string): Promise<Test>;
    deleteTest(id: string): Promise<void>;
    restoreTest(id: string): Promise<void>;
    getResults(includeDeleted?: boolean): Promise<TestResult[]>;
    getResultsByInstitution(institutionId: string): Promise<TestResult[]>;
    getResultsByProfessor(professorId: string): Promise<TestResult[]>;
    getResultsByStudent(studentId: string): Promise<TestResult[]>;
    saveResult(result: Partial<TestResult>, gradedQuestions: any[]): Promise<void>;
    updateAnswer(resultId: string, questionId: string, newOptionId: string, originalOptionId?: string): Promise<void>;
    recalculateScore(resultId: string): Promise<void>;
    getLogs(resultId: string): Promise<TestResultCorrectionLog[]>;
    getStudentAnswers(resultId: string): Promise<StudentTestAnswer[]>;
    getAttemptLogs(testId: string, studentId: string): Promise<TestAttemptLog[]>;
}

export interface IProfessorRepository {
    getProfessors(includeDeleted?: boolean): Promise<Professor[]>;
    getProfessorsByInstitution(institutionId: string, includeDeleted?: boolean): Promise<Professor[]>;
    getProfessorDetails(id: string): Promise<Professor>;
    addProfessor(professor: UserRegistrationDTO, file?: File, address?: Partial<Address>): Promise<void>;
    updateProfessor(id: string, professor: Partial<Professor>): Promise<void>;
    removeProfessor(id: string): Promise<void>;
    restoreProfessor(id: string): Promise<void>;
    
    // Additional methods for Professor Details
    getAssignedClasses(professorId: string): Promise<SchoolClass[]>;
    getTests(professorId: string): Promise<Test[]>;
    getDisciplines(professorId: string): Promise<Discipline[]>;
    getStudents(professorId: string): Promise<Student[]>;
    assignToClass(professorId: string, classId: string): Promise<void>;
    removeFromClass(professorId: string, classId: string): Promise<void>;
    uploadProfessorImage(id: string, file: File): Promise<string | null>;
}

export interface IStudentRepository {
    getStudents(includeDeleted?: boolean): Promise<Student[]>;
    getStudentsByInstitution(institutionId: string, includeDeleted?: boolean): Promise<Student[]>;
    getStudentsByClass(classId: string): Promise<Student[]>;
    addStudent(student: UserRegistrationDTO, file?: File): Promise<void>;
    updateStudent(id: string, student: Partial<Student>): Promise<void>;
    removeStudent(id: string): Promise<void>;
    restoreStudent(id: string): Promise<void>;
    getStudentHistory(studentId: string): Promise<TestResult[]>;
    uploadStudentImage(id: string, file: File): Promise<string | null>;
}

export interface IInstitutionRepository {
    getInstitutions(includeDeleted?: boolean): Promise<Institution[]>;
    getInstitutionDetails(id: string): Promise<Institution>;
    addInstitution(institution: Partial<Institution>, address?: Partial<Address>, manager?: UserRegistrationDTO): Promise<void>;
    updateInstitution(id: string, institution: Partial<Institution>, address?: Partial<Address>, manager?: Partial<UserRegistrationDTO>): Promise<void>;
    removeInstitution(id: string): Promise<void>;
    restoreInstitution(id: string): Promise<void>;
    createStripeCustomerForManager(managerId: string): Promise<boolean>;
}

export interface IClassRepository {
    getClasses(includeDeleted?: boolean): Promise<SchoolClass[]>;
    getClassesByInstitution(institutionId: string, includeDeleted?: boolean): Promise<SchoolClass[]>;
    getClassDetails(id: string): Promise<SchoolClass>;
    addClass(schoolClass: Partial<SchoolClass>): Promise<void>;
    updateClass(id: string, schoolClass: Partial<SchoolClass>): Promise<void>;
    removeClass(id: string): Promise<void>;
    restoreClass(id: string): Promise<void>;
    assignProfessor(classId: string, professorId: string): Promise<void>;
    removeProfessor(classId: string, professorId: string): Promise<void>;
    getClassResults(classId: string): Promise<TestResult[]>;
}

export interface IAIRepository {
    generateQuestions(params: AIQuestionParams): Promise<Partial<Question>[]>;
    analyzeSheet(base64Image: string): Promise<AnalyzedSheet>;
}

export interface IAIAgentRepository {
    getAgents(): Promise<AIAgent[]>;
    saveAgent(id: string | null, agent: Partial<AIAgent>): Promise<void>;
    deleteAgent(id: string): Promise<void>;
    restoreAgent(id: string): Promise<void>;
    getAgentKnowledge(agentId: string): Promise<string>;
    chatWithAgent(agent: AIAgent, history: any[], message: string, context: string): Promise<string>;
}

export interface ITestReleaseRepository {
    getReleases(includeDeleted?: boolean): Promise<TestRelease[]>;
    getReleasesByInstitution(institutionId: string, includeDeleted?: boolean): Promise<TestRelease[]>;
    getReleasesByClass(classId: string): Promise<TestRelease[]>;
    getReleasesByStudent(studentId: string): Promise<TestRelease[]>;
    getReleasesByProfessor(professorId: string, includeDeleted?: boolean): Promise<TestRelease[]>;
    createRelease(release: Partial<TestRelease>, sites?: Partial<TestReleaseSite>[]): Promise<void>;
    createBulkReleases(baseRelease: Partial<TestRelease>, studentIds: string[], sites?: Partial<TestReleaseSite>[]): Promise<void>;
    deleteRelease(id: string): Promise<void>;
    restoreRelease(id: string): Promise<void>;
    addAllowedSite(releaseId: string, site: Partial<TestReleaseSite>): Promise<void>;
    removeAllowedSite(siteId: string): Promise<void>;
}

export interface IUserRuleRepository {
    getRules(): Promise<UserRule[]>;
    saveRule(id: string | null, rule: Partial<UserRule>): Promise<void>;
    deleteRule(id: string): Promise<void>;
    restoreRule(id: string): Promise<void>;
}

export interface ISettingsRepository {
    getInstitutionTypes(includeDeleted?: boolean): Promise<InstitutionType[]>;
    addInstitutionType(type: Partial<InstitutionType>): Promise<void>;
    updateInstitutionType(id: string, type: Partial<InstitutionType>): Promise<void>;
    removeInstitutionType(id: string): Promise<void>;
    restoreInstitutionType(id: string): Promise<void>;
    
    getSchoolGrades(includeDeleted?: boolean): Promise<SchoolGrade[]>;
    getSchoolGradesByInstitution(institutionId: string, includeDeleted?: boolean): Promise<SchoolGrade[]>;
    addSchoolGrade(grade: Partial<SchoolGrade>): Promise<void>;
    updateSchoolGrade(id: string, grade: Partial<SchoolGrade>): Promise<void>;
    removeSchoolGrade(id: string): Promise<void>;
    restoreSchoolGrade(id: string): Promise<void>;

    getDepartments(institutionId: string, includeDeleted?: boolean): Promise<Department[]>;
    addDepartment(dept: Partial<Department>): Promise<void>;
    updateDepartment(id: string, dept: Partial<Department>): Promise<void>;
    removeDepartment(id: string): Promise<void>;
    restoreDepartment(id: string): Promise<void>;

    getAllDisciplines(institutionId: string, includeDeleted?: boolean): Promise<Discipline[]>;
    getDisciplines(gradeId: string): Promise<Discipline[]>;
    addDiscipline(discipline: Partial<Discipline>): Promise<void>;
    updateDiscipline(id: string, discipline: Partial<Discipline>): Promise<void>;
    removeDiscipline(id: string): Promise<void>;
    restoreDiscipline(id: string): Promise<void>;
}

export interface ILibraryRepository {
    getLibrariesByGrade(gradeId: string, includeDeleted?: boolean): Promise<Library[]>;
    createLibrary(library: Partial<Library>): Promise<void>;
    deleteLibrary(id: string): Promise<void>;
    restoreLibrary(id: string): Promise<void>;
    getItems(libraryId: string, includeDeleted?: boolean): Promise<LibraryItem[]>;
    addItem(item: Partial<LibraryItem>, file: File): Promise<void>;
    deleteItem(id: string): Promise<void>;
    restoreItem(id: string): Promise<void>;
}

export interface IBNCCRepository {
    getAll(includeDeleted?: boolean): Promise<BNCCItem[]>;
    create(item: Partial<BNCCItem>): Promise<void>;
    update(id: string, item: Partial<BNCCItem>): Promise<void>;
    delete(id: string): Promise<void>;
    restore(id: string): Promise<void>;
}

export interface IClassroomRoomRepository {
    getRoomsByClass(classId: string, includeDeleted?: boolean): Promise<ClassroomRoom[]>;
    createRoom(room: Partial<ClassroomRoom>): Promise<ClassroomRoom>;
    updateRoom(id: string, room: Partial<ClassroomRoom>): Promise<void>;
    deleteRoom(id: string): Promise<void>;
    restoreRoom(id: string): Promise<void>;
}

export interface IClassroomMessageRepository {
    // Mensagens de uma sala (apenas admin/institution podem listar)
    getMessagesByRoom(roomId: string, includeDeleted?: boolean): Promise<ClassroomMessage[]>;
    // Mensagens enviadas por um usuário específico em uma sala (para professor ver seu histórico)
    getMessagesByUserInRoom(roomId: string, userId: string, includeDeleted?: boolean): Promise<ClassroomMessage[]>;
    // Enviar mensagem (professor pode enviar para salas de suas turmas)
    sendMessage(message: Partial<ClassroomMessage>): Promise<ClassroomMessage>;
    // Editar mensagem (apenas autor pode editar)
    updateMessage(id: string, message: Partial<ClassroomMessage>): Promise<void>;
    // Soft delete mensagem
    deleteMessage(id: string): Promise<void>;
    // Restaurar mensagem
    restoreMessage(id: string): Promise<void>;
}

export interface IMessageReactionRepository {
    // Obter reações de uma mensagem
    getReactionsByMessage(messageId: string): Promise<MessageReaction[]>;
    // Obter contagem de reações de uma mensagem
    getReactionCounts(messageId: string): Promise<MessageReactionCounts>;
    // Obter contagem de reações para múltiplas mensagens (otimizado)
    getReactionCountsForMessages(messageIds: string[]): Promise<Record<string, MessageReactionCounts>>;
    // Obter reação do usuário em uma mensagem específica
    getUserReaction(messageId: string, userId: string): Promise<MessageReaction | null>;
    // Obter reações do usuário em múltiplas mensagens (otimizado)
    getUserReactionsForMessages(messageIds: string[], userId: string): Promise<Record<string, MessageReaction>>;
    // Adicionar ou atualizar reação (toggle: se já existe a mesma reação, remove; se diferente, atualiza)
    toggleReaction(messageId: string, userId: string, reactionType: MessageReactionType): Promise<MessageReaction | null>;
    // Remover reação (soft delete)
    removeReaction(reactionId: string): Promise<void>;
    // Restaurar reação
    restoreReaction(reactionId: string): Promise<void>;
}

export interface IStudentDisabilityRepository {
    getDisabilitiesByStudent(studentId: string): Promise<StudentDisability[]>;
    getDisabilitiesByInstitution(institutionId: string): Promise<StudentDisability[]>;
    getDisabilityById(id: string): Promise<StudentDisability>;
    addDisability(disability: Partial<StudentDisability>, documentFile?: File): Promise<void>;
    updateDisability(id: string, disability: Partial<StudentDisability>, documentFile?: File): Promise<void>;
    deleteDisability(id: string): Promise<void>;
    uploadDocument(id: string, file: File): Promise<string | null>;
}

export interface IReportRepository {
    getClassPerformanceReport(classId: string, dateFilter: ReportDateFilter): Promise<ClassPerformanceReport>;
    getStudentPerformanceReport(studentId: string, dateFilter: ReportDateFilter): Promise<StudentPerformanceReport>;
    getTestPerformanceReport(testId: string, dateFilter: ReportDateFilter): Promise<TestPerformanceReport>;
    getInstitutionPerformanceReport(institutionId: string, dateFilter: ReportDateFilter): Promise<InstitutionPerformanceReport>;
    getProfessorPerformanceReport(professorId: string, dateFilter: ReportDateFilter): Promise<ProfessorPerformanceReport>;
    getClassesForProfessor(professorId: string): Promise<SchoolClass[]>;
    getClassesForInstitution(institutionId: string): Promise<SchoolClass[]>;
    getStudentsForProfessor(professorId: string): Promise<Student[]>;
    getStudentsForInstitution(institutionId: string): Promise<Student[]>;
    getTestsForProfessor(professorId: string): Promise<Test[]>;
    getTestsForInstitution(institutionId: string): Promise<Test[]>;
}