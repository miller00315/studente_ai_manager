
import { useState, useEffect, useMemo, useCallback } from 'react';
import { InstitutionUseCases, SettingsUseCases, ClassUseCases, StudentUseCases, ProfessorUseCases } from '../../domain/usecases';
import { InstitutionRepositoryImpl, SettingsRepositoryImpl, ClassRepositoryImpl, StudentRepositoryImpl, ProfessorRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { Institution, Department, SchoolGrade, SchoolClass, Student, Professor, Address } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useInstitutionDetails = (institutionId: string, hasSupabase: boolean) => {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [grades, setGrades] = useState<SchoolGrade[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  
  const instUseCase = useMemo(() => supabase ? new InstitutionUseCases(new InstitutionRepositoryImpl(supabase)) : null, [supabase]);
  const settingsUseCase = useMemo(() => supabase ? new SettingsUseCases(new SettingsRepositoryImpl(supabase)) : null, [supabase]);
  const classUseCase = useMemo(() => supabase ? new ClassUseCases(new ClassRepositoryImpl(supabase)) : null, [supabase]);
  const studentUseCase = useMemo(() => supabase ? new StudentUseCases(new StudentRepositoryImpl(supabase)) : null, [supabase]);
  const professorUseCase = useMemo(() => supabase ? new ProfessorUseCases(new ProfessorRepositoryImpl(supabase)) : null, [supabase]);

  const fetchDetails = useCallback(async () => {
    if (!instUseCase || !settingsUseCase || !classUseCase || !studentUseCase || !professorUseCase || !institutionId) return;
    
    setLoading(true);
    setError(null);
    try {
        const [instData, deptData, gradeData, classData, studentData, profData] = await Promise.all([
            instUseCase.getInstitutionDetails(institutionId),
            settingsUseCase.getDepartments(institutionId),
            settingsUseCase.getSchoolGrades(),
            classUseCase.getClassesByInstitution(institutionId),
            studentUseCase.getStudentsByInstitution(institutionId),
            professorUseCase.getProfessorsByInstitution(institutionId)
        ]);

        setInstitution(instData);
        setDepartments(deptData);
        setClasses(classData);
        setStudents(studentData);
        setProfessors(profData);
        // Filter grades locally since the repo gets all
        setGrades(gradeData.filter(g => g.institution_id === institutionId));

    } catch (err: any) {
        setError(err.message || "Failed to load institution details.");
    } finally {
        setLoading(false);
    }
  }, [instUseCase, settingsUseCase, classUseCase, studentUseCase, professorUseCase, institutionId]);

  useEffect(() => {
    if (hasSupabase && institutionId) fetchDetails();
  }, [hasSupabase, institutionId, fetchDetails]);

  // --- Departments ---
  const addDepartment = async (dept: Partial<Department>) => {
      if (!settingsUseCase) return;
      try {
          await settingsUseCase.addDepartment({ ...dept, institution_id: institutionId });
          await fetchDetails();
      } catch (e: any) {
          alert("Falha ao adicionar departamento: " + getFriendlyErrorMessage(e));
      }
  };

  const deleteDepartment = async (id: string) => {
      if (!settingsUseCase) return;
      try {
          await settingsUseCase.removeDepartment(id);
          await fetchDetails();
      } catch (e: any) {
          alert(getFriendlyErrorMessage(e));
      }
  };

  // --- Grades ---
  const addGrade = async (grade: Partial<SchoolGrade>) => {
      if (!settingsUseCase) return;
      try {
          await settingsUseCase.addSchoolGrade({ ...grade, institution_id: institutionId });
          await fetchDetails();
      } catch (e: any) {
          alert("Falha ao adicionar série: " + getFriendlyErrorMessage(e));
      }
  };

  const deleteGrade = async (id: string) => {
      if (!settingsUseCase) return;
      try {
          await settingsUseCase.removeSchoolGrade(id);
          await fetchDetails();
      } catch (e: any) {
          alert(getFriendlyErrorMessage(e));
      }
  };

  // --- Classes ---
  const addClass = async (cls: Partial<SchoolClass>) => {
      if (!classUseCase) return;
      try {
          await classUseCase.addClass({ ...cls, institution_id: institutionId });
          await fetchDetails();
      } catch (e: any) {
          alert("Falha ao adicionar turma: " + getFriendlyErrorMessage(e));
      }
  };

  const deleteClass = async (id: string) => {
      if (!classUseCase) return;
      try {
          await classUseCase.removeClass(id);
          await fetchDetails();
      } catch (e: any) {
          alert(getFriendlyErrorMessage(e));
      }
  };

  // --- Update Institution ---
  const updateInstitution = async (data: Partial<Institution>, addressData?: Partial<Address>) => {
      if (!instUseCase || !institution) return;
      try {
          await instUseCase.updateInstitution(institutionId, data, addressData);
          await fetchDetails();
          return true;
      } catch (e: any) {
          alert("Falha ao atualizar instituição: " + e.message);
          return false;
      }
  };

  // --- Create Stripe Customer for Manager ---
  const createStripeCustomer = async (managerId: string): Promise<boolean> => {
      if (!instUseCase) return false;
      try {
          const success = await instUseCase.createStripeCustomerForManager(managerId);
          if (success) {
              await fetchDetails(); // Refresh to get updated stripe_id
          }
          return success;
      } catch {
          return false;
      }
  };

  return { 
      institution, 
      departments, 
      grades, 
      classes, 
      students, 
      professors,
      loading, 
      error, 
      refresh: fetchDetails,
      updateInstitution,
      createStripeCustomer,
      addDepartment, deleteDepartment,
      addGrade, deleteGrade,
      addClass, deleteClass
  };
};
