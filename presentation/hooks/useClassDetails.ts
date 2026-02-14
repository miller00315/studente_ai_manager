
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ClassUseCases, StudentUseCases, TestReleaseUseCases, ProfessorUseCases } from '../../domain/usecases';
import { ClassRepositoryImpl, StudentRepositoryImpl, TestRepositoryImpl, TestReleaseRepositoryImpl, ProfessorRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { SchoolClass, Student, TestResult, TestRelease, Professor } from '../../types';

export const useClassDetails = (classId: string, hasSupabase: boolean) => {
  const [classData, setClassData] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [releases, setReleases] = useState<TestRelease[]>([]);
  const [availableProfessors, setAvailableProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  
  // Initialize UseCases
  const classUseCase = useMemo(() => 
    supabase ? new ClassUseCases(
        new ClassRepositoryImpl(supabase), 
        new TestRepositoryImpl(supabase) 
    ) : null, 
  [supabase]);

  const studentUseCase = useMemo(() => 
    supabase ? new StudentUseCases(new StudentRepositoryImpl(supabase)) : null, 
  [supabase]);

  const releaseUseCase = useMemo(() => 
    supabase ? new TestReleaseUseCases(new TestReleaseRepositoryImpl(supabase)) : null, 
  [supabase]);

  const profUseCase = useMemo(() => 
    supabase ? new ProfessorUseCases(new ProfessorRepositoryImpl(supabase)) : null, 
  [supabase]);

  const fetchDetails = useCallback(async () => {
    if (!classUseCase || !studentUseCase || !releaseUseCase || !profUseCase || !classId) return;
    
    setLoading(true);
    setError(null);
    
    try {
        const [cls, stus, res, rels, profs] = await Promise.all([
            classUseCase.getClassDetails(classId),
            studentUseCase.getStudentsByClass(classId),
            classUseCase.getClassResults(classId),
            releaseUseCase.getReleasesByClass(classId),
            profUseCase.getProfessors()
        ]);
        
        setClassData(cls);
        setStudents(stus);
        setTestResults(res);
        setReleases(rels);
        setAvailableProfessors(profs);
    } catch (err: any) {
        let msg = "Failed to load class details.";
        if (err) {
            if (typeof err === 'string') msg = err;
            else if (err.message && typeof err.message === 'string') msg = err.message;
            else if (err.error_description) msg = err.error_description;
            else {
                try {
                    const json = JSON.stringify(err);
                    if (json !== '{}') msg = json;
                } catch {
                    msg = "Unknown error occurred";
                }
            }
        }
        setError(msg);
    } finally {
        setLoading(false);
    }
  }, [classUseCase, studentUseCase, releaseUseCase, profUseCase, classId]);

  useEffect(() => {
    if (hasSupabase && classId) {
        setClassData(null); 
        fetchDetails();
    }
  }, [hasSupabase, classId, fetchDetails]);

  const assignProfessor = async (professorId: string) => {
      if (!classUseCase) return;
      try {
          await classUseCase.assignProfessor(classId, professorId);
          await fetchDetails();
      } catch (e: any) {
          alert("Failed to assign professor: " + (e.message || String(e)));
      }
  };

  const removeProfessor = async (professorId: string) => {
      if (!classUseCase) return;
      if (confirm("Remove this professor from the class?")) {
          try {
              await classUseCase.removeProfessor(classId, professorId);
              await fetchDetails();
          } catch (e: any) {
              alert("Failed to remove professor: " + (e.message || String(e)));
          }
      }
  };

  return { classData, students, testResults, releases, availableProfessors, loading, error, refresh: fetchDetails, assignProfessor, removeProfessor };
};
