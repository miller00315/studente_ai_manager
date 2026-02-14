
import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { TestRelease, TestResult } from '../types';
import { Play, Clock, CheckCircle, FileText, Loader2, Calendar, AlertCircle, CalendarClock, Timer, XCircle } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

interface StudentDashboardProps {
    hasSupabase: boolean;
    session: Session | null;
    onTakeTest: (release: TestRelease) => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ hasSupabase, session, onTakeTest }) => {
    const [releases, setReleases] = useState<TestRelease[]>([]);
    const [results, setResults] = useState<TestResult[]>([]);
    const [studentName, setStudentName] = useState('');
    const [loading, setLoading] = useState(true);

    const supabase = getSupabaseClient();

    const fetchData = useCallback(async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }
        // Wait for session to be ready
        if (!session?.user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // 1. Get current Student ID - use session user directly
            const user = session.user;

            const { data: appUser, error: appUserError } = await supabase
                .from('app_users')
                .select('id, first_name')
                .eq('auth_id', user.id)
                .maybeSingle();
            
            if (appUserError) {
                setLoading(false);
                return;
            }

            if (!appUser) {
                setLoading(false);
                return;
            }

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('id')
                .eq('user_id', appUser.id)
                .eq('deleted', false)
                .maybeSingle();

            if (studentError) {
                setLoading(false);
                return;
            }

            if (student) {
                setStudentName(appUser?.first_name || 'Student');

                // 2. Fetch Releases
                const { data: relData, error: relError } = await supabase
                    .from('test_releases')
                    .select('*, tests(title, description, school_grades(name)), professors(app_users(first_name, last_name))')
                    .eq('student_id', student.id)
                    .order('start_time', { ascending: false });
                
                // 3. Fetch Completed Results
                const { data: resData } = await supabase
                    .from('test_results')
                    .select('*, tests(title)')
                    .eq('student_id', student.id);

                setReleases((relData as any) || []);
                setResults((resData as any) || []);
            } else {
                // Set empty arrays so the UI can render properly
                setReleases([]);
                setResults([]);
                setStudentName(appUser?.first_name || 'Usuário');
            }
        } catch (e) {
        } finally {
            // Always stop loading, even if there was an error
            setLoading(false);
        }
    }, [supabase, session]);

    useEffect(() => {
        if (hasSupabase && session?.user) {
            // Add a small delay to ensure session is fully established
            const timer = setTimeout(() => {
                fetchData();
            }, 100);
            return () => clearTimeout(timer);
        } else if (!session?.user) {
            // If no session yet, keep loading state
            setLoading(true);
        }
    }, [hasSupabase, session?.user?.id, fetchData]); // Use session?.user?.id to ensure re-render on user change

    const getTestStatus = (r: TestRelease) => {
        const now = new Date();
        const start = new Date(r.start_time);
        const end = new Date(r.end_time);
        
        // Check if result exists for this specific release
        const resultExists = results.some(res => res.test_release_id === r.id);
        
        if (resultExists) return 'completed';
        if (now < start) return 'upcoming';
        if (now > end) return 'expired';
        return 'active';
    };

    const getTimeUntil = (dateStr: string) => {
        const now = new Date();
        const target = new Date(dateStr);
        const diff = target.getTime() - now.getTime();
        
        if (diff <= 0) return null;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    if (loading) {
        return (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                <Loader2 className="animate-spin mx-auto mb-2" size={32}/>
                <p className="text-sm font-medium">Carregando suas atividades...</p>
            </div>
        );
    }

    // Show message if user doesn't have a student record
    if (!studentName || studentName === 'Usuário') {
        return (
            <div className="max-w-2xl mx-auto p-12 text-center">
                <AlertCircle className="mx-auto mb-4 text-amber-500 dark:text-amber-400" size={48}/>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Registro de Estudante Não Encontrado</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Sua conta não possui um registro de estudante vinculado no sistema.
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                    Se você é um estudante, entre em contato com o administrador para vincular seu perfil.
                </p>
            </div>
        );
    }

    const activeTests = releases.filter(r => getTestStatus(r) === 'active');
    const upcomingTests = releases.filter(r => getTestStatus(r) === 'upcoming').sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const completedTests = releases.filter(r => getTestStatus(r) === 'completed');
    const expiredTests = releases.filter(r => getTestStatus(r) === 'expired');

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">Bem-vindo, {studentName}!</h1>
                    <p className="text-violet-100 max-w-lg">
                        {activeTests.length > 0 ? (
                            <>Você tem <strong className="text-white">{activeTests.length}</strong> prova(s) disponível(is) para fazer agora.</>
                        ) : upcomingTests.length > 0 ? (
                            <>Você tem <strong className="text-white">{upcomingTests.length}</strong> prova(s) agendada(s). Fique atento aos horários!</>
                        ) : (
                            <>Nenhuma prova pendente no momento. Bom trabalho!</>
                        )}
                    </p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                    <FileText size={200} className="transform translate-x-10 translate-y-10"/>
                </div>
                
                {/* Quick Stats */}
                <div className="flex gap-6 mt-6 relative z-10">
                    <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
                        <div className="text-2xl font-bold">{activeTests.length}</div>
                        <div className="text-xs text-violet-200">Disponíveis</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
                        <div className="text-2xl font-bold">{upcomingTests.length}</div>
                        <div className="text-xs text-violet-200">Agendadas</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
                        <div className="text-2xl font-bold">{completedTests.length}</div>
                        <div className="text-xs text-violet-200">Concluídas</div>
                    </div>
                </div>
            </div>

            {/* Active Tests Grid */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400"/> Provas Disponíveis</h3>
                {activeTests.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
                        <CheckCircle size={48} className="mx-auto mb-3 text-emerald-100 dark:text-emerald-900 fill-emerald-500 dark:fill-emerald-400"/>
                        <p className="font-medium">Nenhuma prova disponível agora!</p>
                        <p className="text-sm">Verifique abaixo os testes agendados.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeTests.map(r => (
                            <div key={r.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-emerald-500 dark:bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                    ATIVO
                                </div>
                                <div className="mb-4">
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded uppercase tracking-wider">{r.tests?.school_grades?.name}</span>
                                    <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-2 line-clamp-2">{r.tests?.title}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Prof. {(r.professors as any)?.app_users?.last_name || 'Professor'}</p>
                                </div>
                                
                                <div className="space-y-2 mb-6">
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <Clock size={16} className="text-amber-500 dark:text-amber-400"/>
                                        <span>Termina em: {getTimeUntil(r.end_time) || new Date(r.end_time).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <AlertCircle size={16} className="text-blue-500 dark:text-blue-400"/>
                                        <span>{r.max_attempts} tentativa(s) permitida(s)</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => onTakeTest(r)}
                                    className="mt-auto w-full bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50"
                                >
                                    <Play size={18} fill="currentColor"/> Iniciar Prova
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upcoming Tests Section */}
            {upcomingTests.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><CalendarClock size={20} className="text-amber-600 dark:text-amber-400"/> Provas Agendadas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {upcomingTests.map(r => (
                            <div key={r.id} className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-amber-500 dark:bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                                    <Timer size={12}/> AGENDADA
                                </div>
                                <div className="mb-4">
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded uppercase tracking-wider">{r.tests?.school_grades?.name}</span>
                                    <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-2 line-clamp-2">{r.tests?.title}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Prof. {(r.professors as any)?.app_users?.last_name || 'Professor'}</p>
                                </div>
                                
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 font-medium">
                                        <Calendar size={16} className="text-amber-600 dark:text-amber-400"/>
                                        <span>Início: {new Date(r.start_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <Clock size={16} className="text-amber-500 dark:text-amber-400"/>
                                        <span>Término: {new Date(r.end_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                </div>

                                {/* Countdown */}
                                <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 text-center">
                                    <div className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-1">Começa em</div>
                                    <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">{getTimeUntil(r.start_time)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* History / Completed & Expired */}
            {(completedTests.length > 0 || expiredTests.length > 0) && (
                <div className="pt-8 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 mb-4">Histórico</h3>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                <tr>
                                    <th className="p-4">Título da Prova</th>
                                    <th className="p-4">Prazo</th>
                                    <th className="p-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {completedTests.map(r => (
                                    <tr key={r.id} className="text-sm bg-emerald-50/50 dark:bg-emerald-900/20">
                                        <td className="p-4 font-medium text-slate-700 dark:text-slate-200">{r.tests?.title}</td>
                                        <td className="p-4 text-slate-500 dark:text-slate-400">{new Date(r.end_time).toLocaleDateString('pt-BR')}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                                                <CheckCircle size={12}/> Concluída
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {expiredTests.map(r => (
                                    <tr key={r.id} className="text-sm bg-red-50/50 dark:bg-red-900/20">
                                        <td className="p-4 font-medium text-slate-700 dark:text-slate-200">{r.tests?.title}</td>
                                        <td className="p-4 text-slate-500 dark:text-slate-400">{new Date(r.end_time).toLocaleDateString('pt-BR')}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 inline-flex items-center gap-1">
                                                <XCircle size={12}/> Expirada
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
