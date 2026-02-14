
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ProfessorUseCases, ClassUseCases } from '../../domain/usecases';
import { ProfessorRepositoryImpl, ClassRepositoryImpl, TestRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { Professor, SchoolClass, Test, Discipline, Student } from '../../types';

export const useProfessorDetails = (professorId: string, hasSupabase: boolean) => {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<SchoolClass[]>([]);
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]); // New state
  const [tests, setTests] = useState<Test[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  
  const useCase = useMemo(() => supabase ? new ProfessorUseCases(new ProfessorRepositoryImpl(supabase)) : null, [supabase]);
  const classUseCase = useMemo(() => supabase ? new ClassUseCases(new ClassRepositoryImpl(supabase), new TestRepositoryImpl(supabase)) : null, [supabase]);

  const fetchDetails = useCallback(async () => {
    if (!useCase || !classUseCase || !professorId) return;
    setLoading(true);
    setError(null);
    try {
        const [profData, classData, testData, disciplineData, studentData] = await Promise.all([
            useCase.getProfessorDetails(professorId),
            useCase.getAssignedClasses(professorId),
            useCase.getTests(professorId),
            useCase.getDisciplines(professorId),
            useCase.getStudents(professorId)
        ]);

        setProfessor(profData);
        setAssignedClasses(classData);
        setTests(testData);
        setDisciplines(disciplineData || []);
        setStudents(studentData || []);

        // Fetch potential classes to assign based on context
        if (profData?.departments?.institution_id) {
            // Institution specific
            const allClasses = await classUseCase.getClassesByInstitution(profData.departments.institution_id);
            setAvailableClasses(allClasses);
        } else if (profData?.departments?.institutions?.id) {
             // Fallback deep nested check
             const allClasses = await classUseCase.getClassesByInstitution(profData.departments.institutions.id);
             setAvailableClasses(allClasses);
        } else {
            // Global (Admin fallback)
            const allClasses = await classUseCase.getClasses();
            setAvailableClasses(allClasses);
        }

    } catch (err: any) {
        let msg = "Failed to load professor details.";
        
        if (err) {
            if (typeof err === 'string') {
                msg = err;
            } else if (err.message) {
                msg = err.message;
            } else if (err.error_description) {
                msg = err.error_description;
            } else if (err.details) {
                msg = err.details;
            } else {
                try {
                    const json = JSON.stringify(err);
                    if (json && json !== '{}') msg = json;
                } catch {
                    msg = String(err);
                }
            }
        }
        
        setError(msg);
    } finally {
        setLoading(false);
    }
  }, [useCase, classUseCase, professorId]);

  useEffect(() => {
    if (hasSupabase && professorId) fetchDetails();
  }, [hasSupabase, professorId, fetchDetails]);

  const uploadImage = async (file: File) => {
      if (!useCase || !professorId) return;
      try {
          const url = await useCase.uploadProfessorImage(professorId, file);
          setProfessor(prev => {
              if (!prev) return null;
              return {
                  ...prev,
                  app_users: {
                      ...prev.app_users,
                      profile_picture_url: url
                  } as any
              };
          });
          return url;
      } catch (err: any) {
          alert("Upload failed: " + err.message);
          return null;
      }
  };

  const assignClass = async (classId: string) => {
      if (!useCase || !professorId) return;
      try {
          await useCase.assignToClass(professorId, classId);
          await fetchDetails();
      } catch (err: any) {
          alert("Failed to assign class: " + err.message);
      }
  };

  const removeClass = async (classId: string) => {
      if (!useCase || !professorId) return;
      try {
          await useCase.removeFromClass(professorId, classId);
          await fetchDetails();
      } catch (err: any) {
          alert("Failed to remove class: " + err.message);
      }
  };

  return { 
      professor, 
      assignedClasses,
      availableClasses, 
      tests, 
      disciplines, 
      students,
      loading, 
      error, 
      refresh: fetchDetails,
      uploadImage,
      assignClass,
      removeClass
  };
};
