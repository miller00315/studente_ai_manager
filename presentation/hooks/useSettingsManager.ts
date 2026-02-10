import { useState, useEffect, useMemo, useCallback } from 'react';
import { SettingsUseCases, InstitutionUseCases, ProfessorUseCases } from '../../domain/usecases';
import { SettingsRepositoryImpl, InstitutionRepositoryImpl, ProfessorRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { InstitutionType, SchoolGrade, Department, Discipline, Institution, Professor } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useSettingsManager = (hasSupabase: boolean, institutionId?: string) => {
    const [types, setTypes] = useState<InstitutionType[]>([]);
    const [grades, setGrades] = useState<SchoolGrade[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [disciplines, setDisciplines] = useState<Discipline[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [professors, setProfessors] = useState<Professor[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isManager, setIsManager] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);

    const supabase = getSupabaseClient();

    const useCase = useMemo(() => supabase ? new SettingsUseCases(new SettingsRepositoryImpl(supabase)) : null, [supabase]);
    const instUseCase = useMemo(() => supabase ? new InstitutionUseCases(new InstitutionRepositoryImpl(supabase)) : null, [supabase]);
    const profUseCase = useMemo(() => supabase ? new ProfessorUseCases(new ProfessorRepositoryImpl(supabase)) : null, [supabase]);

    const handleError = (err: any, defaultMsg: string) => {
        console.error(err);
        const msg = getFriendlyErrorMessage(err);
        alert(defaultMsg + ": " + msg);
    };

    const fetchData = useCallback(async () => {
        if (!useCase || !instUseCase || !profUseCase || !supabase) return;
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            let adminStatus = false;
            let managerStatus = false;
            let isTeacher = false;
            let targetInstId = institutionId;
            let teacherGradeIds: string[] = [];
            let currentProfId: string | null = null;

            if (user) {
                const { data, error: userError } = await supabase.from('app_users').select('user_rules(rule_name), id').eq('auth_id', user.id).single();
                if (userError) {
                    console.error('Error fetching user data:', userError);
                } else if (data) {
                    // Handle both array and object cases for user_rules relation
                    const userRules = data?.user_rules;
                    const ruleName = Array.isArray(userRules) ? (userRules[0] as any)?.rule_name : (userRules as any)?.rule_name;
                    if (ruleName === 'Administrator') adminStatus = true;
                    if (ruleName === 'Institution') managerStatus = true;
                    if (ruleName === 'Teacher') isTeacher = true;

                    // Auto-detect institution for Manager
                    if (managerStatus && !targetInstId) {
                        const { data: inst } = await supabase.from('institutions').select('id').eq('manager_id', data.id).maybeSingle();
                        if (inst) targetInstId = inst.id;
                    }

                    // Auto-detect institution and grades for Teacher (Professor)
                    if (isTeacher && !targetInstId) {
                        const { data: prof } = await supabase
                            .from('professors')
                            .select('id, departments(institution_id)')
                            .eq('user_id', data.id)
                            .maybeSingle();
                        
                        if (prof) {
                            currentProfId = prof.id;
                            
                            // Handle both array and object cases for departments relation
                            const deptData = prof.departments;
                            let instId: string | undefined;
                            
                            if (Array.isArray(deptData) && deptData.length > 0) {
                                instId = deptData[0].institution_id;
                            } else if (deptData && typeof deptData === 'object' && 'institution_id' in deptData) {
                                instId = (deptData as any).institution_id;
                            }
                            
                            if (instId) {
                                targetInstId = instId;
                            }

                            // Fetch only grades linked to disciplines this professor teaches
                            const { data: disciplines } = await supabase
                                .from('disciplines')
                                .select('grade_id')
                                .eq('professor_id', prof.id)
                                .eq('deleted', false);

                            if (disciplines && disciplines.length > 0) {
                                teacherGradeIds = [...new Set(disciplines.map(d => d.grade_id).filter(Boolean))] as string[];
                            }
                        }
                    }
                }
            }
            setIsAdmin(adminStatus);
            setIsManager(managerStatus);

            const includeDeleted = adminStatus && showDeleted;

            let typeData: InstitutionType[] = [];
            let gradeData: SchoolGrade[] = [];
            let deptData: Department[] = [];
            let instData: Institution[] = [];
            let profData: Professor[] = [];

            if (adminStatus) {
                // Admin sees all types (with deleted if showDeleted)
                try {
                    typeData = await useCase.getInstitutionTypes(includeDeleted);
                } catch (typeError: any) {
                    console.error('Error fetching institution types:', typeError);
                    setError(`Erro ao carregar tipos de instituição: ${typeError.message || 'Erro desconhecido'}`);
                    typeData = [];
                }
            }

            if (targetInstId) {
                // Context-specific fetch
                const myInst = await instUseCase.getInstitutionDetails(targetInstId);
                instData = myInst ? [myInst] : [];
                gradeData = await useCase.getSchoolGradesByInstitution(targetInstId, includeDeleted);
                deptData = await useCase.getDepartments(targetInstId, includeDeleted);
                profData = await profUseCase.getProfessorsByInstitution(targetInstId, includeDeleted);

                // For Teachers: filter grades to only those linked to their disciplines
                // If teacher has no disciplines assigned, they see no grades
                if (isTeacher && teacherGradeIds.length > 0) {
                    gradeData = gradeData.filter(g => teacherGradeIds.includes(g.id));
                }
            } else if (isTeacher && currentProfId && teacherGradeIds.length > 0) {
                // For Teachers without institution context but with disciplines:
                // Get institution from first discipline's grade
                const { data: firstDiscipline } = await supabase
                    .from('disciplines')
                    .select('grade_id, school_grades(institution_id)')
                    .eq('professor_id', currentProfId)
                    .eq('deleted', false)
                    .limit(1)
                    .maybeSingle();
                
                if (firstDiscipline?.school_grades) {
                    const gradeInstId = Array.isArray(firstDiscipline.school_grades) 
                        ? firstDiscipline.school_grades[0]?.institution_id 
                        : (firstDiscipline.school_grades as any)?.institution_id;
                    
                    if (gradeInstId) {
                        const myInst = await instUseCase.getInstitutionDetails(gradeInstId);
                        instData = myInst ? [myInst] : [];
                        gradeData = await useCase.getSchoolGradesByInstitution(gradeInstId, includeDeleted);
                        gradeData = gradeData.filter(g => teacherGradeIds.includes(g.id));
                    } else {
                        // Fallback: fetch all grades and filter
                        gradeData = await useCase.getSchoolGrades(includeDeleted);
                        gradeData = gradeData.filter(g => teacherGradeIds.includes(g.id));
                    }
                } else {
                    // Fallback: fetch all grades and filter
                    gradeData = await useCase.getSchoolGrades(includeDeleted);
                    gradeData = gradeData.filter(g => teacherGradeIds.includes(g.id));
                }
            } else {
                // Global fetch (Admin only usually)
                if (adminStatus) {
                    instData = await instUseCase.getInstitutions(includeDeleted);
                    // Fetching all grades/depts might be heavy, but standard for this UI
                    gradeData = await useCase.getSchoolGrades(includeDeleted);
                    // Departments usually fetched per institution in UI, but maybe needed for listing
                }
            }

            setTypes(typeData);
            setGrades(gradeData);
            setDepartments(deptData);
            setInstitutions(instData);
            setProfessors(profData);

        } catch (e: any) {
            console.error('Error in fetchData:', e);
            setError(e.message || "Failed to load settings.");
            // Ensure states are set even on error
            setIsAdmin(false);
            setIsManager(false);
            setTypes([]);
            setGrades([]);
            setDepartments([]);
            setInstitutions([]);
            setProfessors([]);
        } finally {
            setLoading(false);
        }
    }, [useCase, instUseCase, profUseCase, supabase, institutionId, showDeleted]);

    useEffect(() => {
        if (hasSupabase) fetchData();
    }, [hasSupabase, fetchData]);

    // Type Actions
    const addType = async (type: Partial<InstitutionType>) => {
        if (!useCase) return;
        try { await useCase.addInstitutionType(type); await fetchData(); } catch (e: any) { handleError(e, "Failed to add type"); }
    };
    const updateType = async (id: string, type: Partial<InstitutionType>) => {
        if (!useCase) return;
        try { await useCase.updateInstitutionType(id, type); await fetchData(); return true; } catch (e: any) { handleError(e, "Failed to update type"); return false; }
    };
    const deleteType = async (id: string) => {
        if (!useCase) return;
        try { await useCase.removeInstitutionType(id); await fetchData(); } catch (e: any) { throw e; }
    };
    const restoreType = async (id: string) => {
        if (!useCase) return;
        try { await useCase.restoreInstitutionType(id); await fetchData(); } catch (e: any) { throw e; }
    };

    // Grade Actions
    const addGrade = async (grade: Partial<SchoolGrade>) => {
        if (!useCase) return;
        try { await useCase.addSchoolGrade(grade); await fetchData(); } catch (e: any) { handleError(e, "Failed to add grade"); }
    };
    const updateGrade = async (id: string, grade: Partial<SchoolGrade>) => {
        if (!useCase) return;
        try { await useCase.updateSchoolGrade(id, grade); await fetchData(); return true; } catch (e: any) { handleError(e, "Failed to update grade"); return false; }
    };
    const deleteGrade = async (id: string) => {
        if (!useCase) return;
        try { await useCase.removeSchoolGrade(id); await fetchData(); } catch (e: any) { throw e; }
    };
    const restoreGrade = async (id: string) => {
        if (!useCase) return;
        try { await useCase.restoreSchoolGrade(id); await fetchData(); } catch (e: any) { throw e; }
    };

    // Department Actions
    const fetchDepartments = async (instId: string) => {
        if (!useCase) return;
        try {
            const includeDeleted = isAdmin && showDeleted;
            const data = await useCase.getDepartments(instId, includeDeleted);
            setDepartments(data);
        } catch (e: any) { handleError(e, "Failed to fetch departments"); }
    };
    const addDepartment = async (dept: Partial<Department>) => {
        if (!useCase) return;
        try { await useCase.addDepartment(dept); await fetchData(); } catch (e: any) { handleError(e, "Failed to add department"); }
    };
    const updateDepartment = async (id: string, dept: Partial<Department>) => {
        if (!useCase) return;
        try { await useCase.updateDepartment(id, dept); await fetchData(); } catch (e: any) { handleError(e, "Failed to update department"); }
    };
    const deleteDepartment = async (id: string, instId?: string) => {
        if (!useCase) return;
        try {
            await useCase.removeDepartment(id);
            if (instId) await fetchDepartments(instId);
            else await fetchData();
        } catch (e: any) { throw e; }
    };
    const restoreDepartment = async (id: string, instId?: string) => {
        if (!useCase) return;
        try {
            await useCase.restoreDepartment(id);
            if (instId) await fetchDepartments(instId);
            else await fetchData();
        } catch (e: any) { throw e; }
    };

    // Discipline Actions
    const fetchAllDisciplines = async (instId: string) => {
        if (!useCase) return;
        setLoading(true);
        try {
            const includeDeleted = isAdmin && showDeleted;
            const data = await useCase.getAllDisciplines(instId, includeDeleted);
            setDisciplines(data);
        } catch (e: any) {
            console.error("Error loading disciplines", e);
            setError("Error loading disciplines: " + (e.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    }

    const fetchDisciplines = async (gradeId: string) => {
        if (!useCase) return;
        setLoading(true);
        try {
            const data = await useCase.getDisciplines(gradeId);
            setDisciplines(data);
        } catch (e: any) {
            console.error("Error loading disciplines", e);
            setError("Error loading disciplines: " + (e.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    const addDiscipline = async (data: Partial<Discipline>) => {
        if (!useCase) return;
        try { await useCase.addDiscipline(data); } catch (e: any) { handleError(e, "Failed to add discipline"); throw e; }
    };

    const updateDiscipline = async (id: string, data: Partial<Discipline>) => {
        if (!useCase) return;
        try { await useCase.updateDiscipline(id, data); } catch (e: any) { handleError(e, "Failed to update discipline"); throw e; }
    };

    const deleteDiscipline = async (id: string, parentId: string) => {
        if (!useCase) return;
        try {
            await useCase.removeDiscipline(id);
            // Trigger specific refresh depending on context logic in UI
            if (parentId) {
                // If called from Grade Details, refresh just that grade's disciplines
                await fetchDisciplines(parentId);
            }
        } catch (e: any) { handleError(e, "Failed to delete discipline"); }
    };

    const restoreDiscipline = async (id: string) => {
        if (!useCase) return;
        try {
            await useCase.restoreDiscipline(id);
        } catch (e: any) { handleError(e, "Failed to restore discipline"); }
    };

    return {
        types, grades, departments, institutions, professors, disciplines,
        loading, error, isManager, isAdmin, showDeleted, setShowDeleted,
        addType, updateType, deleteType, restoreType,
        addGrade, updateGrade, deleteGrade, restoreGrade,
        fetchDepartments, addDepartment, updateDepartment, deleteDepartment, restoreDepartment,
        fetchDisciplines, fetchAllDisciplines, addDiscipline, updateDiscipline, deleteDiscipline, restoreDiscipline,
        refresh: fetchData
    };
};
