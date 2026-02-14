
import { useState, useEffect, useMemo, useCallback } from 'react';
import { StudentDisabilityUseCases } from '../../domain/usecases';
import { StudentDisabilityRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { StudentDisability } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useStudentDisabilityManager = (hasSupabase: boolean, institutionId?: string, studentId?: string) => {
  const [disabilities, setDisabilities] = useState<StudentDisability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  const useCase = useMemo(() => supabase ? new StudentDisabilityUseCases(new StudentDisabilityRepositoryImpl(supabase)) : null, [supabase]);

  const fetchUserRole = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('app_users')
          .select('user_rules(rule_name)')
          .eq('auth_id', user.id)
          .maybeSingle();
        
        if (data?.user_rules) {
          setUserRole((data.user_rules as any).rule_name);
        }
      }
    } catch (err) {
    }
  }, [supabase]);

  const fetchData = useCallback(async () => {
    if (!useCase || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      if (studentId) {
        const data = await useCase.getDisabilitiesByStudent(studentId);
        setDisabilities(data);
      } else if (institutionId) {
        const data = await useCase.getDisabilitiesByInstitution(institutionId);
        setDisabilities(data);
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [useCase, studentId, institutionId, supabase]);

  useEffect(() => {
    if (hasSupabase) {
      fetchUserRole();
      fetchData();
    }
  }, [hasSupabase, fetchUserRole, fetchData]);

  const addDisability = useCallback(async (disability: Partial<StudentDisability>, documentFile?: File) => {
    if (!useCase) throw new Error('Supabase não configurado');
    try {
      await useCase.addDisability(disability, documentFile);
      await fetchData();
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [useCase, fetchData]);

  const updateDisability = useCallback(async (id: string, disability: Partial<StudentDisability>, documentFile?: File) => {
    if (!useCase) throw new Error('Supabase não configurado');
    try {
      await useCase.updateDisability(id, disability, documentFile);
      await fetchData();
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [useCase, fetchData]);

  const deleteDisability = useCallback(async (id: string) => {
    if (!useCase) throw new Error('Supabase não configurado');
    try {
      await useCase.deleteDisability(id);
      await fetchData();
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [useCase, fetchData]);

  const canEdit = useMemo(() => {
    return userRole === 'Administrator' || userRole === 'Institution';
  }, [userRole]);

  const canView = useMemo(() => {
    return userRole === 'Administrator' || userRole === 'Institution' || userRole === 'Teacher';
  }, [userRole]);

  return {
    disabilities,
    loading,
    error,
    userRole,
    canEdit,
    canView,
    addDisability,
    updateDisability,
    deleteDisability,
    refresh: fetchData
  };
};
