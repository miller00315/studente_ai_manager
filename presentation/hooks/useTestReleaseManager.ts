
import { useState, useEffect, useMemo, useCallback } from 'react';
import { TestReleaseUseCases, TestUseCases, StudentUseCases, ProfessorUseCases, InstitutionUseCases, ResultsUseCases } from '../../domain/usecases';
import { TestReleaseRepositoryImpl, TestRepositoryImpl, StudentRepositoryImpl, ProfessorRepositoryImpl, InstitutionRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { TestRelease, Test, Student, Professor, Institution, TestReleaseSite, TestResult } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useTestReleaseManager = (hasSupabase: boolean, institutionId?: string) => {
  const [releases, setReleases] = useState<TestRelease[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [results, setResults] = useState<TestResult[]>([]); 
  
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const supabase = getSupabaseClient();
  
  const releaseUC = useMemo(() => supabase ? new TestReleaseUseCases(new TestReleaseRepositoryImpl(supabase)) : null, [supabase]);
  const testUC = useMemo(() => supabase ? new TestUseCases(new TestRepositoryImpl(supabase)) : null, [supabase]);
  const studentUC = useMemo(() => supabase ? new StudentUseCases(new StudentRepositoryImpl(supabase)) : null, [supabase]);
  const profUC = useMemo(() => supabase ? new ProfessorUseCases(new ProfessorRepositoryImpl(supabase)) : null, [supabase]);
  const instUC = useMemo(() => supabase ? new InstitutionUseCases(new InstitutionRepositoryImpl(supabase)) : null, [supabase]);
  const resultsUC = useMemo(() => supabase ? new ResultsUseCases(new TestRepositoryImpl(supabase)) : null, [supabase]);

  const fetchData = useCallback(async () => {
    if (!releaseUC || !testUC || !studentUC || !profUC || !instUC || !resultsUC || !supabase) return;
    setLoading(true);
    setError(null);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Get App User details and role
        const { data: appUser } = await supabase
            .from('app_users')
            .select('id, user_rules(rule_name)')
            .eq('auth_id', user.id)
            .single();

        if (!appUser) throw new Error("User profile not found");

        const role = (appUser.user_rules as any)?.rule_name;
        const adminStatus = role === 'Administrator';
        setIsAdmin(adminStatus);
        
        let rData, tData, sData, pData, iData, resData;
        const includeDeleted = adminStatus && showDeleted;

        if (role === 'Administrator') {
            // Always fetch all institutions for admin dropdown
            iData = await instUC.getInstitutions();
            
            if (institutionId) {
                // Admin filtering by specific institution
                [rData, tData, sData, pData, resData] = await Promise.all([
                    releaseUC.getReleasesByInstitution(institutionId, includeDeleted),
                    testUC.getTestsByInstitution(institutionId),
                    studentUC.getStudentsByInstitution(institutionId),
                    profUC.getProfessorsByInstitution(institutionId),
                    resultsUC.getResultsByInstitution(institutionId)
                ]);
            } else {
                // Admin sees everything (no filter)
                [rData, tData, sData, pData, resData] = await Promise.all([
                    releaseUC.getReleases(includeDeleted),
                    testUC.getTests(),
                    studentUC.getStudents(),
                    profUC.getProfessors(),
                    resultsUC.getResults()
                ]);
            }
        } else if (role === 'Institution') {
            // Institution Manager - filter by managed institution
            const { data: managedInst } = await supabase
                .from('institutions')
                .select('id')
                .eq('manager_id', appUser.id)  // Use App User ID, not Auth ID
                .maybeSingle();

            if (managedInst) {
                [rData, tData, sData, pData, resData] = await Promise.all([
                    releaseUC.getReleasesByInstitution(managedInst.id),
                    testUC.getTestsByInstitution(managedInst.id),
                    studentUC.getStudentsByInstitution(managedInst.id),
                    profUC.getProfessorsByInstitution(managedInst.id),
                    resultsUC.getResultsByInstitution(managedInst.id)
                ]);
                const myInst = await instUC.getInstitutionDetails(managedInst.id);
                iData = myInst ? [myInst] : [];
            } else {
                // No institution linked
                rData = []; tData = []; sData = []; pData = []; iData = []; resData = [];
            }
        } else if (role === 'Teacher') {
            // Teacher - filter by professor_id
            const { data: prof } = await supabase
                .from('professors')
                .select('id, departments(institution_id)')
                .eq('user_id', appUser.id)
                .maybeSingle();

            if (prof) {
                // Get releases by professor (they created)
                rData = await releaseUC.getReleasesByProfessor(prof.id);
                // Get tests by professor
                tData = await testUC.getTestsByProfessor(prof.id);
                // Get results by professor
                resData = await resultsUC.getResultsByProfessor(prof.id);
                // Professor sees only themselves
                pData = [await profUC.getProfessorDetails(prof.id)].filter(Boolean) as Professor[];
                
                // Get students from professor's institution for creating releases
                const instId = (prof.departments as any)?.institution_id;
                if (instId) {
                    sData = await studentUC.getStudentsByInstitution(instId);
                    const myInst = await instUC.getInstitutionDetails(instId);
                    iData = myInst ? [myInst] : [];
                } else {
                    sData = []; iData = [];
                }
            } else {
                // Not linked as professor
                rData = []; tData = []; sData = []; pData = []; iData = []; resData = [];
            }
        } else {
            // Other roles (Student, etc.) - no access to release management
            rData = []; tData = []; sData = []; pData = []; iData = []; resData = [];
        }

        setReleases(rData);
        setTests(tData);
        setStudents(sData);
        setProfessors(pData);
        setInstitutions(iData);
        setResults(resData);
    } catch (err: any) {
        console.error("Error fetching release data:", err);
        
        let msg = "Unknown error";
        
        // Priority 1: Direct Message
        if (err?.message && typeof err.message === 'string') {
            msg = err.message;
        } 
        // Priority 2: Supabase Error description
        else if (err?.error_description) {
            msg = err.error_description;
        }
        // Priority 3: Details (Postgres)
        else if (err?.details) {
            msg = err.details;
        }
        // Priority 4: String representation check
        else if (typeof err === 'string') {
            msg = err;
        }
        // Priority 5: Stringify Object Fallback
        else if (typeof err === 'object') {
             try {
                 const json = JSON.stringify(err);
                 if (json !== '{}') msg = json;
                 else msg = "Unknown database error (Empty Response)";
             } catch {
                 msg = "Error processing request";
             }
        }
        
        setError(msg);
    } finally {
        setLoading(false);
    }
  }, [releaseUC, testUC, studentUC, profUC, instUC, resultsUC, supabase, institutionId, showDeleted]);

  useEffect(() => {
    if (hasSupabase) fetchData();
  }, [hasSupabase, fetchData]);

  const createRelease = async (release: Partial<TestRelease>, sites?: Partial<TestReleaseSite>[]) => {
    if (!releaseUC) return false;
    setIsCreating(true);
    try {
        await releaseUC.createRelease(release, sites);
        await fetchData();
        return true;
    } catch (err: any) {
        const msg = getFriendlyErrorMessage(err);
        alert(msg);
        return false;
    } finally {
        setIsCreating(false);
    }
  };

  const createBulkReleases = async (baseRelease: Partial<TestRelease>, studentIds: string[], sites?: Partial<TestReleaseSite>[]) => {
      if (!releaseUC) return false;
      setIsCreating(true);
      try {
          await releaseUC.createBulkReleases(baseRelease, studentIds, sites);
          await fetchData();
          return true;
      } catch (err: any) {
          const msg = getFriendlyErrorMessage(err);
          alert(msg);
          return false;
      } finally {
          setIsCreating(false);
      }
  };

  const deleteRelease = async (id: string) => {
    if (!releaseUC) return;
    setDeletingId(id);
    try {
        await releaseUC.deleteRelease(id);
        await fetchData();
    } catch (err: any) {
        const msg = getFriendlyErrorMessage(err);
        alert(msg);
    } finally {
        setDeletingId(null);
    }
  };

  const addAllowedSite = async (releaseId: string, site: Partial<TestReleaseSite>) => {
      if (!releaseUC) return;
      try {
          await releaseUC.addAllowedSite(releaseId, site);
          await fetchData();
      } catch (err: any) {
          alert("Failed to add site: " + getFriendlyErrorMessage(err));
      }
  };

  const removeAllowedSite = async (siteId: string) => {
      if (!releaseUC) return;
      try {
          await releaseUC.removeAllowedSite(siteId);
          await fetchData();
      } catch (err: any) {
          alert("Failed to remove site: " + getFriendlyErrorMessage(err));
      }
  };

  const restoreRelease = async (id: string) => {
      if (!releaseUC) return;
      try {
          await releaseUC.restoreRelease(id);
          await fetchData();
      } catch (err: any) {
          alert("Falha ao restaurar liberação: " + getFriendlyErrorMessage(err));
      }
  };

  // Helper to fetch deep details for the modal
  const getTestDetails = async (id: string) => {
      if (!testUC) return null;
      return testUC.getTestDetails(id);
  };

  const getStudentAnswers = async (resultId: string) => {
      if (!resultsUC) return [];
      return resultsUC.getStudentAnswers(resultId);
  };

  return {
      releases, tests, students, professors, institutions, results,
      loading, isCreating, deletingId, error, isAdmin, showDeleted, setShowDeleted,
      createRelease, createBulkReleases, deleteRelease, restoreRelease,
      addAllowedSite, removeAllowedSite, refresh: fetchData,
      getTestDetails, getStudentAnswers
  };
};
