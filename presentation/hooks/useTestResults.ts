
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ResultsUseCases, InstitutionUseCases } from '../../domain/usecases';
import { TestRepositoryImpl, TestReleaseRepositoryImpl, InstitutionRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { TestResult, TestResultCorrectionLog, StudentTestAnswer, TestAttemptLog, Institution } from '../../types';

export const useTestResults = (hasSupabase: boolean, institutionId?: string) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  const useCase = useMemo(() => supabase ? new ResultsUseCases(
      new TestRepositoryImpl(supabase),
      new TestReleaseRepositoryImpl(supabase) 
  ) : null, [supabase]);
  const instUC = useMemo(() => supabase ? new InstitutionUseCases(new InstitutionRepositoryImpl(supabase)) : null, [supabase]);

  const fetchResults = useCallback(async () => {
    if (!useCase || !instUC || !supabase) return;
    setLoading(true);
    setError(null);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Determine Role Context
        const { data: appUser } = await supabase.from('app_users')
            .select('id, user_rules(rule_name)')
            .eq('auth_id', user.id)
            .single();

        if (!appUser) throw new Error("User profile not found");

        const role = (appUser.user_rules as any)?.rule_name;
        setUserRole(role);
        
        let data: TestResult[] = [];
        let instData: Institution[] = [];

        if (role === 'Administrator') {
            // Always fetch all institutions for admin dropdown
            instData = await instUC.getInstitutions();
            
            if (institutionId) {
                // Admin filtering by specific institution
                data = await useCase.getResultsByInstitution(institutionId);
            } else {
                // Admin sees everything (no filter)
                data = await useCase.getResults();
            }
        } else if (role === 'Institution') {
            const { data: inst } = await supabase.from('institutions').select('id').eq('manager_id', appUser.id).single();
            if (inst) {
                data = await useCase.getResultsByInstitution(inst.id);
                const myInst = await instUC.getInstitutionDetails(inst.id);
                instData = myInst ? [myInst] : [];
            }
        } else if (role === 'Student') {
            const { data: student } = await supabase
                .from('students')
                .select('id, institution_id')
                .eq('user_id', appUser.id)
                .single();
            if (student) {
                data = await useCase.getResultsByStudent(student.id);
                // Carregar instituição do estudante
                if (student.institution_id) {
                    const myInst = await instUC.getInstitutionDetails(student.institution_id);
                    instData = myInst ? [myInst] : [];
                }
            }
        } else if (role === 'Teacher') {
            const { data: prof } = await supabase
                .from('professors')
                .select('id, departments(institution_id)')
                .eq('user_id', appUser.id)
                .single();
            if (prof) {
                data = await useCase.getResultsByProfessor(prof.id);
                // Carregar instituição do professor (via departamento)
                const deptInstId = (prof.departments as any)?.institution_id;
                if (deptInstId) {
                    const myInst = await instUC.getInstitutionDetails(deptInstId);
                    instData = myInst ? [myInst] : [];
                }
            }
        }

        setResults(data);
        setInstitutions(instData);
    } catch (err: any) {
        console.error("Error fetching results:", err);
        setError(err.message || "Failed to load results history.");
    } finally {
        setLoading(false);
    }
  }, [useCase, instUC, supabase, institutionId]);

  useEffect(() => {
    if (hasSupabase) fetchResults();
  }, [hasSupabase, fetchResults]);

  const fetchTestDetails = useCallback(async (testId: string) => {
    if (!useCase) return null;
    try {
        return await useCase.getTestDetails(testId);
    } catch (e) {
        console.error(e);
        return null;
    }
 }, [useCase]);

 const updateResultAnswer = useCallback(async (resultId: string, questionId: string, newOptionId: string, originalOptionId?: string) => {
     if (!useCase) return false;
     try {
         await useCase.updateAnswer(resultId, questionId, newOptionId, originalOptionId);
         await fetchResults(); 
         return true;
     } catch (e: any) {
         alert("Error updating answer: " + e.message);
         return false;
     }
 }, [useCase, fetchResults]);

 const recalculateScore = useCallback(async (resultId: string) => {
     if (!useCase) return false;
     try {
         await useCase.recalculateScore(resultId);
         await fetchResults();
         return true;
     } catch (e: any) {
         alert("Error recalculating score: " + e.message);
         return false;
     }
 }, [useCase, fetchResults]);

 const fetchLogs = useCallback(async (resultId: string): Promise<TestResultCorrectionLog[]> => {
     if (!useCase) return [];
     try {
         return await useCase.getLogs(resultId);
     } catch(e) {
         console.error(e);
         return [];
     }
 }, [useCase]);

 const fetchStudentAnswers = useCallback(async (resultId: string): Promise<StudentTestAnswer[]> => {
     if (!useCase) return [];
     try {
         return await useCase.getStudentAnswers(resultId);
     } catch(e) {
         console.error(e);
         return [];
     }
 }, [useCase]);

 const fetchAttemptLogs = useCallback(async (testId: string, studentId: string): Promise<TestAttemptLog[]> => {
     if (!useCase) return [];
     try {
         return await useCase.getAttemptLogs(testId, studentId);
     } catch(e) {
         console.error(e);
         return [];
     }
 }, [useCase]);

  return { results, institutions, loading, error, userRole, fetchResults, refresh: fetchResults, fetchTestDetails, updateResultAnswer, recalculateScore, fetchLogs, fetchStudentAnswers, fetchAttemptLogs };
};
