import { useState, useEffect, useMemo, useCallback } from 'react';
import { ReportUseCases } from '../../domain/usecases';
import { ReportRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import {
    ClassPerformanceReport,
    StudentPerformanceReport,
    TestPerformanceReport,
    InstitutionPerformanceReport,
    ProfessorPerformanceReport,
    ReportDateFilter,
    SchoolClass,
    Student,
    Test
} from '../../types';

export const useReportManager = (hasSupabase: boolean, userRole?: string, institutionId?: string, professorId?: string) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [classReport, setClassReport] = useState<ClassPerformanceReport | null>(null);
    const [studentReport, setStudentReport] = useState<StudentPerformanceReport | null>(null);
    const [testReport, setTestReport] = useState<TestPerformanceReport | null>(null);
    const [institutionReport, setInstitutionReport] = useState<InstitutionPerformanceReport | null>(null);
    const [professorReport, setProfessorReport] = useState<ProfessorPerformanceReport | null>(null);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [tests, setTests] = useState<Test[]>([]);
    const [effectiveProfessorId, setEffectiveProfessorId] = useState<string | undefined>(professorId);
    const [professorIdFetched, setProfessorIdFetched] = useState(false);
    const [dataFetched, setDataFetched] = useState(false);
    const [dateFilter, setDateFilter] = useState<ReportDateFilter>(() => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    });

    const supabase = getSupabaseClient();

    const useCase = useMemo(() => {
        if (!supabase) return null;
        return new ReportUseCases(new ReportRepositoryImpl(supabase));
    }, [supabase]);

    // Auto-fetch professorId for Teacher role (only once)
    useEffect(() => {
        const fetchProfessorId = async () => {
            if (userRole === 'Teacher' && !effectiveProfessorId && !professorIdFetched && supabase) {
                setProfessorIdFetched(true); // Mark as fetched to prevent multiple calls
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                        setProfessorIdFetched(false); // Reset if failed
                        return;
                    }

                    const { data: appUser } = await supabase
                        .from('app_users')
                        .select('id')
                        .eq('auth_id', user.id)
                        .maybeSingle();

                    if (appUser) {
                        const { data: prof } = await supabase
                            .from('professors')
                            .select('id')
                            .eq('user_id', appUser.id)
                            .maybeSingle();

                        if (prof) {
                            setEffectiveProfessorId(prof.id);
                            setDataFetched(false); // Reset dataFetched so data can be fetched with new professorId
                        }
                    }
                } catch (err) {
                    setProfessorIdFetched(false); // Reset on error to allow retry
                }
            }
        };

        if (hasSupabase && userRole === 'Teacher' && !effectiveProfessorId && !professorIdFetched) {
            fetchProfessorId();
        }
    }, [hasSupabase, userRole, supabase, professorIdFetched]); // Removed effectiveProfessorId to prevent loop

    const fetchClasses = useCallback(async () => {
        if (!useCase || !supabase) return;
        
        // Don't fetch if we don't have required IDs
        if (userRole === 'Teacher' && !effectiveProfessorId) return;
        if (userRole === 'Institution' && !institutionId) return;
        
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            let data: SchoolClass[] = [];
            if (userRole === 'Teacher' && effectiveProfessorId) {
                data = await useCase.getClassesForProfessor(effectiveProfessorId);
            } else if (userRole === 'Institution' && institutionId) {
                data = await useCase.getClassesForInstitution(institutionId);
            }
            setClasses(data);
        } catch (err: any) {
            setError(err.message || "Failed to load classes.");
        } finally {
            setLoading(false);
        }
    }, [useCase, supabase, userRole, effectiveProfessorId, institutionId]);

    const fetchStudents = useCallback(async () => {
        if (!useCase || !supabase) return;
        
        // Don't fetch if we don't have required IDs
        if (userRole === 'Teacher' && !effectiveProfessorId) return;
        if (userRole === 'Institution' && !institutionId) return;
        
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            let data: Student[] = [];
            if (userRole === 'Teacher' && effectiveProfessorId) {
                data = await useCase.getStudentsForProfessor(effectiveProfessorId);
            } else if (userRole === 'Institution' && institutionId) {
                data = await useCase.getStudentsForInstitution(institutionId);
            }
            setStudents(data);
        } catch (err: any) {
            setError(err.message || "Failed to load students.");
        } finally {
            setLoading(false);
        }
    }, [useCase, supabase, userRole, effectiveProfessorId, institutionId]);

    const fetchTests = useCallback(async () => {
        if (!useCase || !supabase) return;
        
        // Don't fetch if we don't have required IDs
        if (userRole === 'Teacher' && !effectiveProfessorId) return;
        if (userRole === 'Institution' && !institutionId) return;
        
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            let data: Test[] = [];
            if (userRole === 'Teacher' && effectiveProfessorId) {
                data = await useCase.getTestsForProfessor(effectiveProfessorId);
            } else if (userRole === 'Institution' && institutionId) {
                data = await useCase.getTestsForInstitution(institutionId);
            }
            setTests(data);
        } catch (err: any) {
            setError(err.message || "Failed to load tests.");
        } finally {
            setLoading(false);
        }
    }, [useCase, supabase, userRole, effectiveProfessorId, institutionId]);

    const fetchClassReport = useCallback(async (classId: string) => {
        if (!useCase) return;
        setLoading(true);
        setError(null);
        try {
            const report = await useCase.getClassPerformanceReport(classId, dateFilter);
            setClassReport(report);
        } catch (err: any) {
            setError(err.message || "Failed to load class report.");
        } finally {
            setLoading(false);
        }
    }, [useCase, dateFilter]);

    const fetchStudentReport = useCallback(async (studentId: string) => {
        if (!useCase) return;
        setLoading(true);
        setError(null);
        try {
            const report = await useCase.getStudentPerformanceReport(studentId, dateFilter);
            setStudentReport(report);
        } catch (err: any) {
            setError(err.message || "Failed to load student report.");
        } finally {
            setLoading(false);
        }
    }, [useCase, dateFilter]);

    const fetchTestReport = useCallback(async (testId: string) => {
        if (!useCase) return;
        setLoading(true);
        setError(null);
        try {
            const report = await useCase.getTestPerformanceReport(testId, dateFilter);
            setTestReport(report);
        } catch (err: any) {
            setError(err.message || "Failed to load test report.");
        } finally {
            setLoading(false);
        }
    }, [useCase, dateFilter]);

    const fetchInstitutionReport = useCallback(async (instId: string) => {
        if (!useCase) return;
        setLoading(true);
        setError(null);
        try {
            const report = await useCase.getInstitutionPerformanceReport(instId, dateFilter);
            setInstitutionReport(report);
        } catch (err: any) {
            setError(err.message || "Failed to load institution report.");
        } finally {
            setLoading(false);
        }
    }, [useCase, dateFilter]);

    const fetchProfessorReport = useCallback(async (profId: string) => {
        if (!useCase) return;
        setLoading(true);
        setError(null);
        try {
            const report = await useCase.getProfessorPerformanceReport(profId, dateFilter);
            setProfessorReport(report);
        } catch (err: any) {
            setError(err.message || "Failed to load professor report.");
        } finally {
            setLoading(false);
        }
    }, [useCase, dateFilter]);

    useEffect(() => {
        if (!hasSupabase || !useCase || !supabase) return;
        
        // Only fetch if we have the required IDs for the role and haven't fetched yet
        const shouldFetch = 
            ((userRole === 'Teacher' && effectiveProfessorId) ||
            (userRole === 'Institution' && institutionId)) &&
            !dataFetched;

        if (shouldFetch) {
            setDataFetched(true); // Mark as fetched to prevent multiple calls
            // Use a small delay to avoid race conditions and ensure session is ready
            const timer = setTimeout(() => {
                fetchClasses();
                fetchStudents();
                fetchTests();
            }, 300);
            
            return () => {
                clearTimeout(timer);
            };
        }
        
        // Reset dataFetched when IDs change or become unavailable
        if ((userRole === 'Teacher' && !effectiveProfessorId) || 
            (userRole === 'Institution' && !institutionId)) {
            setDataFetched(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSupabase, userRole, effectiveProfessorId, institutionId, useCase, supabase, dataFetched]); // Only fetch when IDs are available

    // Additional effect to fetch data when effectiveProfessorId becomes available
    useEffect(() => {
        if (!hasSupabase || !useCase || !supabase) return;
        
        if (userRole === 'Teacher' && effectiveProfessorId && !dataFetched) {
            setDataFetched(true); // Mark as fetched
            // Fetch data when professorId becomes available
            const timer = setTimeout(() => {
                fetchClasses();
                fetchStudents();
                fetchTests();
            }, 100);
            
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveProfessorId, userRole, hasSupabase, useCase, supabase]);

    return {
        loading,
        error,
        classReport,
        studentReport,
        testReport,
        institutionReport,
        professorReport,
        classes,
        students,
        tests,
        dateFilter,
        setDateFilter,
        fetchClassReport,
        fetchStudentReport,
        fetchTestReport,
        fetchInstitutionReport,
        fetchProfessorReport,
        effectiveProfessorId,
        refreshClasses: fetchClasses,
        refreshStudents: fetchStudents,
        refreshTests: fetchTests
    };
};
