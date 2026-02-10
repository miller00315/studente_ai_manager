
import { useState, useEffect, useMemo, useCallback } from 'react';
import { StudentUseCases, InstitutionUseCases, ClassUseCases, TestReleaseUseCases, UserRuleUseCases } from '../../domain/usecases';
import { StudentRepositoryImpl, InstitutionRepositoryImpl, TestRepositoryImpl, ClassRepositoryImpl, TestReleaseRepositoryImpl, UserRuleRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { Student, Institution, TestResult, SchoolClass, UserRegistrationDTO, TestRelease, UserRule, Address } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useStudentManager = (hasSupabase: boolean, institutionId?: string) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [rules, setRules] = useState<UserRule[]>([]);
  
  // History & Releases State
  const [studentHistory, setStudentHistory] = useState<TestResult[]>([]);
  const [studentReleases, setStudentReleases] = useState<TestRelease[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const supabase = getSupabaseClient();
  const useCase = useMemo(() => supabase ? new StudentUseCases(new StudentRepositoryImpl(supabase), new TestRepositoryImpl(supabase)) : null, [supabase]);
  const instUseCase = useMemo(() => supabase ? new InstitutionUseCases(new InstitutionRepositoryImpl(supabase)) : null, [supabase]);
  const classUseCase = useMemo(() => supabase ? new ClassUseCases(new ClassRepositoryImpl(supabase)) : null, [supabase]);
  const releaseUseCase = useMemo(() => supabase ? new TestReleaseUseCases(new TestReleaseRepositoryImpl(supabase)) : null, [supabase]);
  const ruleUseCase = useMemo(() => supabase ? new UserRuleUseCases(new UserRuleRepositoryImpl(supabase)) : null, [supabase]);

  const fetchData = useCallback(async () => {
    if (!useCase || !instUseCase || !classUseCase || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      let targetInstId = institutionId;
      let adminStatus = false;

      // Check Role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const { data } = await supabase
            .from('app_users')
            .select('user_rules(rule_name)')
            .eq('auth_id', user.id)
            .single();
          
          if (data?.user_rules?.rule_name === 'Administrator') {
              adminStatus = true;
          }
      }
      setIsAdmin(adminStatus);

      if (!targetInstId && !adminStatus) {
          if (user) {
              const { data: managedInst } = await supabase.from('institutions').select('id').eq('manager_id', user.id).maybeSingle();
              if (managedInst) targetInstId = managedInst.id;
          }
      }

      // Logic: Include deleted only if Admin AND showDeleted is true
      const includeDeleted = adminStatus && showDeleted;

      let sData, iData, cData;

      if (targetInstId) {
          // Managers never see deleted, Admins can if toggle on
          [sData, cData] = await Promise.all([
              useCase.getStudentsByInstitution(targetInstId, includeDeleted),
              classUseCase.getClassesByInstitution(targetInstId, includeDeleted)
          ]);
          const me = await instUseCase.getInstitutionDetails(targetInstId);
          iData = me ? [me] : [];
      } else {
          [sData, iData, cData] = await Promise.all([
              useCase.getStudents(includeDeleted),
              instUseCase.getInstitutions(includeDeleted),
              classUseCase.getClasses(includeDeleted)
          ]);
      }

      setStudents(sData);
      setInstitutions(iData);
      setClasses(cData);
    } catch (err: any) {
      console.error("Error fetching students:", err);
      if (err?.code === '42P01') {
          setError("Tables missing. Run SQL update in Dashboard.");
      } else {
          const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          setError(msg || "Failed to load students.");
      }
    } finally {
      setLoading(false);
    }
  }, [useCase, instUseCase, classUseCase, supabase, institutionId, showDeleted]);

  const fetchRules = useCallback(async () => {
    if (!ruleUseCase) return;
    try {
        const data = await ruleUseCase.getRules();
        setRules(data);
    } catch (err) {
        console.error("Error fetching rules:", err);
    }
  }, [ruleUseCase]);

  useEffect(() => {
    if (hasSupabase) {
        fetchData();
        fetchRules();
    }
  }, [hasSupabase, fetchData, fetchRules]);

  const registerStudent = async (data: UserRegistrationDTO, file?: File, address?: Partial<Address>) => {
    if (!useCase || !ruleUseCase) return;
    try {
      const registrationData = { ...data };
      if (!registrationData.rule_id) {
        const rules = await ruleUseCase.getRules();
        const studentRule = rules.find(r => !r.deleted && ['student', 'aluno'].includes(r.rule_name?.toLowerCase()?.trim()));
        if (studentRule?.id) {
            registrationData.rule_id = studentRule.id;
        } else {
            // Student rule not found - will use default
            throw new Error("Regra de usuário 'Student' não encontrada. Por favor, verifique se a regra existe no banco de dados.");
        }
      }

      // Garante compatibilidade se o repositório esperar camelCase ruleId
      if (registrationData.rule_id) {
          (registrationData as any).ruleId = registrationData.rule_id;
          (registrationData as any).user_rule_id = registrationData.rule_id;
          (registrationData as any).userRuleId = registrationData.rule_id;
      }

      // Registering student
      await useCase.addStudent(registrationData, file, address);
      await fetchData();
      return true;
    } catch (err: any) {
      const msg = getFriendlyErrorMessage(err);
      alert("Failed to register student: " + msg);
      return false;
    }
  };

  const registerStudentsBulk = async (items: ReadonlyArray<{ readonly student: UserRegistrationDTO; readonly address?: Partial<Address> }>) => {
    if (!useCase || !ruleUseCase) return { successCount: 0, errors: [] as { rowNumber?: number; message: string }[] };
    const errors: { rowNumber?: number; message: string }[] = [];
    let successCount = 0;
    try {
      const availableRules = await ruleUseCase.getRules();
      const studentRule = availableRules.find(r => !r.deleted && ['student', 'aluno'].includes(r.rule_name?.toLowerCase()?.trim()));
      const studentRuleId: string | undefined = studentRule?.id;
      for (const item of items) {
        const registrationData: UserRegistrationDTO = { ...item.student };
        if (studentRuleId && !registrationData.rule_id) registrationData.rule_id = studentRuleId;
        try {
          await useCase.addStudent(registrationData, undefined, item.address);
          successCount += 1;
        } catch (err: any) {
          const msg: string = getFriendlyErrorMessage(err);
          errors.push({ message: msg });
        }
      }
      await fetchData();
    } catch (err: any) {
      const msg: string = getFriendlyErrorMessage(err);
      errors.push({ message: msg });
    }
    return { successCount, errors };
  };

  const updateStudent = async (id: string, data: Partial<Student>) => {
    if (!useCase) return;
    try {
      await useCase.updateStudent(id, data);
      await fetchData();
      return true;
    } catch (err: any) {
      const msg = getFriendlyErrorMessage(err);
      alert("Failed to update student: " + msg);
      return false;
    }
  };

  const deleteStudent = async (id: string) => {
    if (!useCase) return;
    try {
      await useCase.removeStudent(id);
      await fetchData();
    } catch (err: any) {
      throw err; // Propagate promise for UI loading state
    }
  };

  const restoreStudent = async (id: string) => {
      if (!useCase) return;
      try {
          await useCase.restoreStudent(id);
          await fetchData();
      } catch (err: any) {
          throw err;
      }
  };

  const loadStudentHistory = async (id: string) => {
    if (!useCase || !releaseUseCase) return;
    setLoadingHistory(true);
    setStudentHistory([]);
    setStudentReleases([]);
    try {
        const [history, releases] = await Promise.all([
            useCase.getStudentHistory(id),
            releaseUseCase.getReleasesByStudent(id)
        ]);
        setStudentHistory(history);
        setStudentReleases(releases);
    } catch(e: any) {
        console.error("Error fetching student details", e);
    } finally {
        setLoadingHistory(false);
    }
  };

  const uploadImage = async (id: string, file: File) => {
      if (!useCase) return;
      try {
          const url = await useCase.uploadStudentImage(id, file);
          setStudents(prev => prev.map(s => {
              if (s.id === id) {
                  return {
                      ...s,
                      app_users: {
                          ...s.app_users,
                          profile_picture_url: url
                      } as any
                  };
              }
              return s;
          }));
          return url;
      } catch (err: any) {
          const msg = getFriendlyErrorMessage(err);
          alert("Upload failed: " + msg);
          return null;
      }
  };

  const refresh = useCallback(async () => {
    await Promise.all([fetchData(), fetchRules()]);
  }, [fetchData, fetchRules]);

  return { 
      students, 
      institutions, 
      classes, 
      rules,
      loading, 
      error, 
      registerStudent, 
      registerStudentsBulk,
      updateStudent, 
      deleteStudent,
      restoreStudent, 
      isAdmin, showDeleted, setShowDeleted,
      refresh,
      loadStudentHistory,
      studentHistory,
      studentReleases,
      loadingHistory,
      uploadImage
  };
};
