
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type UserRole = 'Administrator' | 'Institution' | 'Teacher' | 'Student';

export type View = 'dashboard' | 'questions' | 'tests' | 'professors' | 'institutions' | 'classes' | 'grades' | 'students' | 'grading' | 'results' | 'agents' | 'releases' | 'rules' | 'settings' | 'my_class' | 'bncc' | 'departments' | 'disciplines' | 'my_institution' | 'institution_types' | 'financial' | 'reports';

export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface Address {
    address_line_1: string;
    city: string;
    state_province: string;
    postal_code: string;
    country: string;
}

export interface AppUser {
    id: string;
    auth_id: string;
    email: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
    user_rules?: UserRule;
}

export interface UserRule {
    id: string;
    rule_name: string;
    description?: string;
    enabled: boolean;
    deleted?: boolean;
}

export interface InstitutionType {
    id: string;
    name: string;
    deleted?: boolean;
}

export interface Institution {
    id: string;
    name: string;
    type_id?: string;
    type?: string;
    address_id?: string;
    institution_types?: InstitutionType;
    manager_id?: string;
    manager?: AppUser;
    addresses?: Address;
    deleted?: boolean;
    created_at?: string;
}

export interface Department {
    id: string;
    name: string;
    code?: string;
    institution_id: string;
    institutions?: Institution;
    deleted?: boolean;
}

export interface Professor {
    id: string;
    user_id: string;
    department_id?: string;
    name: string;
    email: string;
    department?: string;
    departments?: Department;
    app_users?: AppUser;
    deleted?: boolean;
}

export interface SchoolGrade {
    id: string;
    name: string;
    level: number;
    institution_id: string;
    description?: string;
    deleted?: boolean;
    institutions?: Institution;
    disciplines?: Discipline[];
}

export interface SchoolClass {
    id: string;
    name: string;
    grade_id: string;
    institution_id: string;
    deleted?: boolean;
    school_grades?: SchoolGrade;
    institutions?: Institution;
    professors?: Professor[];
}

export interface Student {
    id: string;
    user_id: string;
    name: string;
    age: number;
    student_hash: string;
    grade_id: string;
    class_id?: string;
    institution_id: string;
    deleted?: boolean;
    app_users?: AppUser;
    school_grades?: SchoolGrade;
    classes?: SchoolClass;
    institutions?: Institution;
}

export type DisabilityType = 'AUDITIVA' | 'FISICA' | 'INTELECTUAL' | 'VISUAL' | 'MULTIPLA' | 'TEA' | 'OUTRA';

export interface StudentDisability {
    id: string;
    student_id: string;
    institution_id: string;
    disability_type: DisabilityType;
    description: string;
    additional_info?: string;
    support_number?: string;
    responsible_name?: string;
    document_url?: string;
    created_at?: string;
    updated_at?: string;
    students?: Student;
    institutions?: Institution;
}

export interface Discipline {
    id: string;
    name: string;
    description?: string;
    grade_id: string;
    professor_id?: string;
    bncc_id?: string;
    deleted?: boolean;
    school_grades?: SchoolGrade;
    professors?: Professor;
    bncc?: BNCCItem;
}

export interface QuestionOption {
    id: string;
    content: string;
    is_correct: boolean;
    key?: string;
}

export interface Question {
    id: string;
    content: string;
    difficulty: Difficulty;
    subject: string;
    grade_id: string;
    image_url?: string;
    deleted?: boolean;
    question_options?: QuestionOption[];
    school_grades?: SchoolGrade;
    weight?: number;
}

export interface Test {
    id: string;
    title: string;
    description?: string;
    professor_id: string;
    grade_id: string;
    institution_id?: string;
    deleted?: boolean;
    created_at?: string;
    questions?: Question[];
    school_grades?: SchoolGrade;
    institutions?: Institution;
    professors?: Professor;
}

export interface TestRelease {
    id: string;
    test_id: string;
    student_id?: string;
    professor_id: string;
    institution_id: string;
    start_time: string;
    end_time: string;
    max_attempts: number;
    allow_consultation: boolean;
    allow_ai_agent: boolean;
    location_polygon?: GeoPoint[];
    deleted?: boolean;
    tests?: Test;
    students?: Student;
    professors?: Professor;
    allowed_sites?: TestReleaseSite[];
}

export interface TestReleaseSite {
    id: string;
    test_release_id: string;
    url: string;
    title: string;
}

export interface TestResult {
    id: string;
    test_id: string;
    student_id?: string;
    test_release_id?: string;
    student_name: string;
    student_hash?: string;
    score: number;
    correct_count: number;
    error_count: number;
    correction_date: string;
    image_url?: string;
    tests?: Test;
    student_answers?: any;
    test_result_correction_logs?: TestResultCorrectionLog[];
}

export interface TestResultCorrectionLog {
    id: string;
    test_result_id: string;
    question_id: string;
    original_option_id?: string;
    new_option_id: string;
    reason: string;
    created_at: string;
    questions?: Question;
    original_option?: QuestionOption;
    new_option?: QuestionOption;
    count?: number;
}

export interface StudentTestAnswer {
    id: string;
    test_result_id: string;
    question_id: string;
    selected_option_id?: string;
    is_correct: boolean;
}

export interface TestAttemptLog {
    id: string;
    test_release_id: string;
    attempt_number: number;
    start_time: string;
    end_time?: string;
    preliminary_score?: number;
    restarted?: boolean;
    location_lat?: number;
    location_lng?: number;
}

export interface AIAgent {
    id: string;
    name: string;
    role: string;
    system_prompt: string;
    deleted?: boolean;
}

export interface Library {
    id: string;
    name: string;
    description?: string;
    grade_id: string;
    created_at?: string;
    deleted?: boolean;
    library_items?: LibraryItem[];
}

export interface LibraryItem {
    id: string;
    library_id: string;
    title: string;
    description?: string;
    file_url: string;
    file_type?: string;
    created_at?: string;
    deleted?: boolean;
}

export interface BNCCItem {
    id: string;
    codigo_alfanumerico: string;
    descricao_habilidade?: string;
    ano_serie?: string;
    componente_curricular?: string;
    unidade_tematica?: string;
    deleted?: boolean;
    created_at?: string;
}

export interface ClassroomRoom {
    id: string;
    class_id: string;
    name: string;
    description?: string;
    is_public: boolean;
    created_by?: string; // app_users.id
    created_at?: string;
    updated_at?: string;
    deleted?: boolean;
    classes?: SchoolClass;
    app_users?: AppUser; // creator
}

export type ClassroomMessageType = 'text' | 'image' | 'file' | 'audio' | 'video';

export interface ClassroomMessage {
    id: string;
    room_id: string;
    user_id: string; // app_users.id
    type: ClassroomMessageType;
    content?: string;
    metadata?: Record<string, any>;
    edited: boolean;
    deleted: boolean;
    created_at?: string;
    updated_at?: string;
    nickname?: string;
    app_users?: AppUser;
    classroom_rooms?: ClassroomRoom;
    reactions?: MessageReaction[];
    reaction_counts?: MessageReactionCounts;
}

export type MessageReactionType = 'like' | 'dislike' | 'love' | 'understood';

export interface MessageReaction {
    id: string;
    message_id: string;
    user_id: string; // app_users.id
    reaction_type: MessageReactionType;
    deleted: boolean;
    created_at?: string;
    updated_at?: string;
    app_users?: AppUser;
}

export interface MessageReactionCounts {
    like: number;
    dislike: number;
    love: number;
    understood: number;
}

export interface AIQuestionParams {
    topic: string;
    gradeLevelName: string;
    gradeId?: string;
    difficulty: Difficulty;
    count: number;
    sourceText?: string;
}

export interface AnalyzedSheet {
    test_id: string;
    student_name: string;
    answers: { question_number: number; selected_option: string }[];
}

export interface UserRegistrationDTO {
    email: string;
    password?: string;
    first_name: string;
    last_name: string;
    birthdate?: string;
    gender?: string;
    address_line_1?: string;
    city?: string;
    state_province?: string;
    postal_code?: string;
    country?: string;
    department_id?: string;
    department?: string;
    institution_id?: string;
    grade_id?: string;
    class_id?: string;
    rule_id?: string;
    age?: number;
}

// Financial Management Types
export type FinancialTransactionType = 'PAYABLE' | 'RECEIVABLE';
export type FinancialTransactionStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type FinancialCategoryType = 'INCOME' | 'EXPENSE';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'BOLETO' | 'PIX' | 'TRANSFER';

export interface FinancialCategory {
    id: string;
    institution_id: string;
    name: string;
    type: FinancialCategoryType;
    parent_id?: string;
    created_at?: string;
    deleted?: boolean;
    parent?: FinancialCategory;
    children?: FinancialCategory[];
}

export interface BankAccount {
    id: string;
    institution_id: string;
    name: string;
    bank_name?: string;
    agency?: string;
    account_number?: string;
    initial_balance: number;
    current_balance: number;
    created_at?: string;
    deleted?: boolean;
}

export interface CostCenter {
    id: string;
    institution_id: string;
    name: string;
    code?: string;
    created_at?: string;
    deleted?: boolean;
}

export interface FinancialTransaction {
    id: string;
    institution_id: string;
    category_id: string;
    bank_account_id?: string;
    cost_center_id?: string;
    user_id?: string;
    student_id?: string;
    description: string;
    amount: number;
    due_date: string;
    payment_date?: string;
    status: FinancialTransactionStatus;
    type: FinancialTransactionType;
    payment_method?: PaymentMethod;
    installments_info?: any;
    created_at?: string;
    updated_at?: string;
    deleted?: boolean;
    financial_categories?: FinancialCategory;
    bank_accounts?: BankAccount;
    cost_centers?: CostCenter;
    app_users?: AppUser;
    students?: Student;
}

// Report Types
export interface ReportDateFilter {
    startDate: string;
    endDate: string;
}

export interface ClassPerformanceReport {
    classId: string;
    className: string;
    gradeName: string;
    institutionName: string;
    totalStudents: number;
    totalTests: number;
    averageScore: number;
    totalAttempts: number;
    completionRate: number;
    studentsPerformance: StudentPerformanceSummary[];
    testsPerformance: TestPerformanceSummary[];
    performanceEvolution?: PerformanceEvolution[];
    period: ReportDateFilter;
}

export interface PerformanceEvolution {
    date: string;
    averageScore: number;
    completionRate?: number;
    totalAttempts?: number;
}

export interface StudentPerformanceReport {
    studentId: string;
    studentName: string;
    classId: string;
    className: string;
    gradeName: string;
    institutionName: string;
    totalTests: number;
    averageScore: number;
    totalAttempts: number;
    completionRate: number;
    bestScore: number;
    worstScore: number;
    testsDetails: StudentTestDetail[];
    performanceEvolution?: PerformanceEvolution[];
    period: ReportDateFilter;
}

export interface TestPerformanceReport {
    testId: string;
    testTitle: string;
    professorName: string;
    institutionName: string;
    totalStudents: number;
    totalAttempts: number;
    averageScore: number;
    completionRate: number;
    studentsPerformance: StudentTestPerformance[];
    questionPerformance: QuestionPerformance[];
    performanceEvolution?: PerformanceEvolution[];
    period: ReportDateFilter;
}

export interface StudentPerformanceSummary {
    studentId: string;
    studentName: string;
    averageScore: number;
    totalTests: number;
    completionRate: number;
}

export interface StudentTestDetail {
    testId: string;
    testTitle: string;
    score: number;
    correctCount: number;
    errorCount: number;
    totalQuestions: number;
    attemptDate: string;
    testReleaseId: string;
}

export interface StudentTestPerformance {
    studentId: string;
    studentName: string;
    score: number;
    correctCount: number;
    errorCount: number;
    attemptDate: string;
}

export interface QuestionPerformance {
    questionId: string;
    questionContent: string;
    totalAttempts: number;
    correctCount: number;
    errorCount: number;
    successRate: number;
}

export interface InstitutionPerformanceReport {
    institutionId: string;
    institutionName: string;
    totalClasses: number;
    totalStudents: number;
    totalTests: number;
    totalAttempts: number;
    averageScore: number;
    completionRate: number;
    classesPerformance: ClassPerformanceSummary[];
    studentsPerformance: StudentPerformanceSummary[];
    testsPerformance: TestPerformanceSummary[];
    period: ReportDateFilter;
}

export interface ClassPerformanceSummary {
    classId: string;
    className: string;
    gradeName: string;
    totalStudents: number;
    totalTests: number;
    averageScore: number;
    completionRate: number;
}

export interface TestPerformanceSummary {
    testId: string;
    testTitle: string;
    professorName?: string;
    averageScore: number;
    totalStudents: number;
    completionRate: number;
}

export interface ProfessorPerformanceReport {
    professorId: string;
    professorName: string;
    institutionName: string;
    totalClasses: number;
    totalStudents: number;
    totalTests: number;
    totalAttempts: number;
    averageScore: number;
    completionRate: number;
    classesPerformance: ClassPerformanceSummary[];
    studentsPerformance: StudentPerformanceSummary[];
    testsPerformance: TestPerformanceSummary[];
    period: ReportDateFilter;
}
