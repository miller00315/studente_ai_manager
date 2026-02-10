
import { useState, useEffect, useMemo, useCallback } from 'react';
import { TestUseCases, QuestionUseCases, ProfessorUseCases, InstitutionUseCases } from '../../domain/usecases';
import { TestRepositoryImpl, QuestionRepositoryImpl, ProfessorRepositoryImpl, AIRepositoryImpl, InstitutionRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { Test, Professor, Question, Institution } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useTestManager = (hasSupabase: boolean, institutionId?: string) => {
  const [tests, setTests] = useState<Test[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  
  // Loading States
  const [loading, setLoading] = useState(false); // For initial page load
  const [loadingQuestions, setLoadingQuestions] = useState(false); // Specific for lazy loading

  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const supabase = getSupabaseClient();

  const testUseCase = useMemo(() => supabase ? new TestUseCases(new TestRepositoryImpl(supabase)) : null, [supabase]);
  const profUseCase = useMemo(() => supabase ? new ProfessorUseCases(new ProfessorRepositoryImpl(supabase)) : null, [supabase]);
  const instUseCase = useMemo(() => supabase ? new InstitutionUseCases(new InstitutionRepositoryImpl(supabase)) : null, [supabase]);
  const questUseCase = useMemo(() => supabase ? new QuestionUseCases(new QuestionRepositoryImpl(supabase), new AIRepositoryImpl()) : null, [supabase]);

  // Initial Fetch: Only loads Tests, Professors, and Institutions (Fast)
  const fetchData = useCallback(async () => {
    if (!testUseCase || !profUseCase || !instUseCase || !supabase) return;
    setLoading(true);
    setError(null);
    try {
        let adminStatus = false;
        const { data: { user } } = await supabase.auth.getUser();
        
        let appUserId = null;
        if (user) {
            const { data } = await supabase
              .from('app_users')
              .select('id, user_rules(rule_name)')
              .eq('auth_id', user.id)
              .single();
            
            if (data) {
                appUserId = data.id;
                if (data.user_rules?.rule_name === 'Administrator') {
                    adminStatus = true;
                }
            }
        }
        setIsAdmin(adminStatus);

        // Check for Manager role
        const { data: managedInst } = await supabase.from('institutions').select('id').eq('manager_id', appUserId).maybeSingle();
        
        // Check for Professor role
        const { data: prof } = await supabase.from('professors').select('id, departments(institution_id)').eq('user_id', appUserId).maybeSingle();

        let tData, pData, iData;

        // Determine which institution to filter by
        // Admin with prop → filter tests/profs but keep all institutions for dropdown
        // Manager → filter by their institution
        const filterInstId = institutionId || managedInst?.id;
        const isAdminWithPropFilter = adminStatus && institutionId && !managedInst;

        if (filterInstId) {
            // Filtered for Institution (via prop or Manager role)
            [tData, pData] = await Promise.all([
                testUseCase.getTestsByInstitution(filterInstId, adminStatus),
                profUseCase.getProfessorsByInstitution(filterInstId, adminStatus),
            ]);
            
            // Admin filtering via dropdown should still see all institutions
            if (isAdminWithPropFilter) {
                iData = await instUseCase.getInstitutions(adminStatus);
            } else {
                // Manager only sees their institution
                const myInst = await instUseCase.getInstitutionDetails(filterInstId);
                iData = myInst ? [myInst] : [];
            }
        } else if (prof) {
            // Filtered for Professor
            tData = await testUseCase.getTestsByProfessor(prof.id, adminStatus);
            // Professors generally don't manage other professors, so list is empty or just self
            pData = [await profUseCase.getProfessorDetails(prof.id)].filter(Boolean) as Professor[]; 
            
            // Context institution
            const instId = (prof.departments as any)?.institution_id;
            if (instId) {
                const myInst = await instUseCase.getInstitutionDetails(instId);
                iData = myInst ? [myInst] : [];
            } else {
                iData = [];
            }
        } else {
            // Global Admin View
            [tData, pData, iData] = await Promise.all([
                testUseCase.getTests(adminStatus),
                profUseCase.getProfessors(adminStatus),
                instUseCase.getInstitutions(adminStatus)
            ]);
        }

        setTests(tData);
        setProfessors(pData);
        setInstitutions(iData);
    } catch (err: any) {
        console.error("Error fetching test data:", err);
        const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        setError(msg || "Failed to load test management data.");
    } finally {
        setLoading(false);
    }
  }, [testUseCase, profUseCase, instUseCase, supabase, institutionId]);

  // Lazy Load: Only called when user wants to create a test
  const fetchQuestions = useCallback(async () => {
      if (!questUseCase) return; 
      // Always refresh questions list when entering edit mode to ensure we see updates
      setLoadingQuestions(true);
      try {
          const q = await questUseCase.getQuestions();
          setAvailableQuestions(q);
      } catch (err: any) {
          console.error("Error lazy loading questions:", err);
          alert("Failed to load question bank: " + (err.message || String(err)));
      } finally {
          setLoadingQuestions(false);
      }
  }, [questUseCase]);

  useEffect(() => {
    if (hasSupabase) fetchData();
  }, [hasSupabase, fetchData]);

  const createTest = async (testData: Partial<Test>, questionIds: string[], weights?: Record<string, number>) => {
    if (!testUseCase) return;
    setIsCreating(true);
    try {
        await testUseCase.createTest(testData, questionIds, weights);
        await fetchData();
        return true;
    } catch (err: any) {
        console.error(err);
        alert("Failed to create test: " + (err.message || String(err)));
        return false;
    } finally {
        setIsCreating(false);
    }
  };

  const updateTest = async (id: string, testData: Partial<Test>, questionIds: string[], weights?: Record<string, number>) => {
      if (!testUseCase) return;
      setIsCreating(true);
      try {
          await testUseCase.updateTest(id, testData, questionIds, weights);
          await fetchData();
          return true;
      } catch (err: any) {
          console.error(err);
          alert("Failed to update test: " + (err.message || String(err)));
          return false;
      } finally {
          setIsCreating(false);
      }
  };

  const saveQuestion = async (id: string | null, data: any, options: any[], imageFile?: File) => {
      if (!questUseCase) return;
      try {
          await questUseCase.saveQuestion(id, data, options, imageFile);
          await fetchQuestions(); // Refresh internal list
          return true;
      } catch (e: any) {
          alert("Failed to save question: " + e.message);
          return false;
      }
  };

  const loadTestDetails = async (id: string) => {
    if (!testUseCase) return null;
    setLoading(true);
    try {
        const test = await testUseCase.getTestDetails(id);
        setSelectedTest(test);
        return test;
    } catch (err: any) {
        console.error(err);
        alert("Failed to load details: " + (err.message || String(err)));
        return null;
    } finally {
        setLoading(false);
    }
  };

  const deleteTest = async (id: string) => {
    if (!testUseCase) return false;
    setDeletingId(id);
    try {
        await testUseCase.deleteTest(id);
        await fetchData();
        return true;
    } catch (err: any) {
        console.error(err);
        alert("Failed to delete test: " + (err.message || String(err)));
        return false;
    } finally {
        setDeletingId(null);
    }
  };

  const restoreTest = async (id: string) => {
      if (!testUseCase) return;
      try {
          await testUseCase.restoreTest(id);
          await fetchData();
      } catch (err: any) {
          alert("Failed to restore: " + getFriendlyErrorMessage(err));
      }
  };

  return {
    tests,
    professors,
    institutions,
    availableQuestions,
    selectedTest,
    loading,
    loadingQuestions, 
    isCreating,
    deletingId,
    error,
    createTest,
    updateTest, // Exposed
    saveQuestion, // Exposed
    loadTestDetails,
    deleteTest,
    restoreTest,
    isAdmin,
    showDeleted,
    setShowDeleted,
    setSelectedTest,
    refresh: fetchData,
    fetchQuestions 
  };
};
