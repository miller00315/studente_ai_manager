
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ClassUseCases, InstitutionUseCases } from '../../domain/usecases';
import { ClassRepositoryImpl, InstitutionRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { SchoolClass, Institution } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useClassManager = (hasSupabase: boolean, institutionId?: string) => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const supabase = getSupabaseClient();
  
  const classUseCase = useMemo(() => supabase ? new ClassUseCases(new ClassRepositoryImpl(supabase)) : null, [supabase]);
  const instUseCase = useMemo(() => supabase ? new InstitutionUseCases(new InstitutionRepositoryImpl(supabase)) : null, [supabase]);

  const fetchData = useCallback(async () => {
    if (!classUseCase || !instUseCase || !supabase) return;
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

      // Logic: Include deleted only if Admin AND showDeleted is true
      const includeDeleted = adminStatus && showDeleted;

      let cData: SchoolClass[] = [];
      let iData: Institution[] = [];
      let appUserId: string | null = null;

      if (user) {
          const { data: appUser } = await supabase.from('app_users').select('id, user_rules(rule_name)').eq('auth_id', user.id).maybeSingle();
          if (appUser) appUserId = appUser.id;
          
          const role = (appUser?.user_rules as any)?.rule_name;

          if (!targetInstId && !adminStatus) {
              // Check if Manager
              const { data: managedInst } = await supabase.from('institutions').select('id').eq('manager_id', appUserId).maybeSingle();
              if (managedInst) {
                  targetInstId = managedInst.id;
              }
          }

          // For Teachers: show classes they are assigned to via class_professors AND via disciplines
          if (role === 'Teacher' && !adminStatus) {
              const { data: prof } = await supabase.from('professors')
                  .select('id, departments(institution_id)')
                  .eq('user_id', appUserId)
                  .maybeSingle();
              
              if (prof) {
                  // 1. Fetch classes directly assigned via class_professors
                  const { data: assignedClasses } = await supabase
                      .from('class_professors')
                      .select('classes(*, school_grades(name), institutions(name))')
                      .eq('professor_id', prof.id);
                  
                  const directClasses = (assignedClasses || []).map((cp: any) => cp.classes).filter(Boolean);
                  
                  // 2. Fetch classes through disciplines (professor teaches disciplines that belong to grades, and those grades have classes)
                  const { data: disciplines } = await supabase
                      .from('disciplines')
                      .select('grade_id')
                      .eq('professor_id', prof.id)
                      .eq('deleted', false);
                  
                  let classesViaDisciplines: SchoolClass[] = [];
                  if (disciplines && disciplines.length > 0) {
                      const gradeIds = [...new Set(disciplines.map(d => d.grade_id).filter(Boolean))] as string[];
                      
                      if (gradeIds.length > 0) {
                          const { data: classesByGrade } = await supabase
                              .from('classes')
                              .select('*, school_grades(name), institutions(name)')
                              .in('grade_id', gradeIds)
                              .eq('deleted', false);
                          
                          classesViaDisciplines = (classesByGrade || []) as SchoolClass[];
                      }
                  }
                  
                  // Combine both sources and remove duplicates
                  const allClassesMap = new Map<string, SchoolClass>();
                  [...directClasses, ...classesViaDisciplines].forEach(cls => {
                      if (cls && cls.id) {
                          allClassesMap.set(cls.id, cls);
                      }
                  });
                  
                  cData = Array.from(allClassesMap.values());
                  
                  // Get professor's institution
                  const instId = (prof.departments as any)?.institution_id;
                  if (instId) {
                      const myInst = await instUseCase.getInstitutionDetails(instId);
                      iData = myInst ? [myInst] : [];
                  }
              }
          } else if (targetInstId) {
              // Manager or filtered by institution
              cData = await classUseCase.getClassesByInstitution(targetInstId, includeDeleted);
              const myInst = await instUseCase.getInstitutionDetails(targetInstId);
              iData = myInst ? [myInst] : [];
          } else {
              // Admin - global view
              [cData, iData] = await Promise.all([
                  classUseCase.getClasses(includeDeleted),
                  instUseCase.getInstitutions(includeDeleted)
              ]);
          }
      }

      setClasses(cData);
      setInstitutions(iData);
    } catch (err: any) {
      console.error("Error fetching classes:", err);
      if (err?.code === '42P01') {
          setError("Table 'classes' missing. Run SQL update.");
      } else {
          setError(err.message || "Failed to load classes.");
      }
    } finally {
      setLoading(false);
    }
  }, [classUseCase, instUseCase, supabase, institutionId, showDeleted]);

  useEffect(() => {
    if (hasSupabase) fetchData();
  }, [hasSupabase, fetchData]);

  const addClass = async (schoolClass: Partial<SchoolClass>) => {
    if (!classUseCase) return;
    try {
      await classUseCase.addClass(schoolClass);
      await fetchData();
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err));
    }
  };

  const updateClass = async (id: string, data: Partial<SchoolClass>) => {
    if (!classUseCase) return;
    try {
      await classUseCase.updateClass(id, data);
      await fetchData();
      return true;
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err));
      return false;
    }
  };

  const deleteClass = async (id: string) => {
    if (!classUseCase) return;
    try {
      await classUseCase.removeClass(id);
      await fetchData();
    } catch (err: any) {
      throw err; // Propagate promise
    }
  };

  const restoreClass = async (id: string) => {
      if (!classUseCase) return;
      try {
          await classUseCase.restoreClass(id);
          await fetchData();
      } catch (err: any) {
          throw err;
      }
  };

  return { 
      classes, institutions, loading, error, 
      addClass, updateClass, deleteClass, restoreClass, 
      isAdmin, showDeleted, setShowDeleted, refresh: fetchData 
  };
};
