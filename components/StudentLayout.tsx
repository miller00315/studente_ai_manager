
import React, { useState } from 'react';
import Navigation from './Navigation';
import { View, TestRelease } from '../types';
import { Session } from '@supabase/supabase-js';
import { User, LogOut, FileText, Users, Menu } from 'lucide-react';
import StudentDashboard from './StudentDashboard';
import StudentExamRoom from './StudentExamRoom';
import TestResults from './TestResults';
import StudentClassViewer from './StudentClassViewer';
import { signOut } from '../services/supabaseService';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

interface LayoutProps {
    session: Session | null;
    isConnected: boolean;
}

type StudentView = 'dashboard' | 'results' | 'exam' | 'my_class';

const StudentLayout: React.FC<LayoutProps> = ({ session, isConnected }) => {
    const [currentView, setCurrentView] = useState<StudentView>('dashboard');
    const [activeExam, setActiveExam] = useState<TestRelease | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleNavigate = (view: View) => {
        if (currentView === 'exam') {
            if (!confirm("Você está em uma prova. Sair perderá seu progresso. Tem certeza?")) return;
            setActiveExam(null);
        }
        // Map generic View type to StudentView
        if (view === 'dashboard' || view === 'results' || view === 'my_class') {
            setCurrentView(view);
        }
        setIsSidebarOpen(false);
    };

    const startExam = (release: TestRelease) => {
        if (confirm(`Pronto para iniciar "${release.tests?.title}"? Certifique-se de ter uma conexão estável.`)) {
            setActiveExam(release);
            setCurrentView('exam');
        }
    };

    const handleExamComplete = () => {
        setActiveExam(null);
        setCurrentView('results'); // Redirect to results after finishing
    };

    const handleLogout = async () => {
        await signOut();
    };

    // If taking an exam, show full screen mode without sidebar
    // Use a consistent root element to avoid DOM reconciliation issues
    const isExamMode = currentView === 'exam' && activeExam && session;

    if (isExamMode) {
        return (
            <div key="exam-mode" className="h-screen w-screen overflow-hidden">
                <StudentExamRoom 
                    releaseId={activeExam.id}
                    testId={activeExam.test_id}
                    studentId={activeExam.student_id} // In the release object
                    onComplete={handleExamComplete}
                    onExit={() => { setActiveExam(null); setCurrentView('dashboard'); }}
                />
            </div>
        );
    }

    return (
        <div key="normal-mode" className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col border-r border-slate-200">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-violet-200">
                                <User size={20}/>
                            </div>
                            <div>
                                <h1 className="font-bold text-slate-800">Aluno</h1>
                            </div>
                        </div>
                    </div>
                    
                    <nav className="flex-1 p-4 space-y-2">
                        <button 
                            onClick={() => handleNavigate('dashboard')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'dashboard' ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <User size={18}/> Painel
                        </button>
                        <button 
                            onClick={() => handleNavigate('my_class')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'my_class' ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Users size={18}/> Minha Turma
                        </button>
                        <button 
                            onClick={() => handleNavigate('results')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'results' ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <FileText size={18}/> Minhas Notas
                        </button>
                    </nav>

                    <div className="p-4 border-t border-slate-100">
                        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-600 py-2 text-sm font-bold">
                            <LogOut size={16}/> Sair
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Sidebar (Static) */}
            <div className="hidden md:flex h-full flex-col border-r border-slate-200 bg-white w-64 shadow-lg z-20">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-violet-200">
                        <User size={20}/>
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800">Portal do Aluno</h1>
                        <p className="text-xs text-slate-500">Acesso Acadêmico</p>
                    </div>
                </div>
                
                <nav className="flex-1 p-4 space-y-2">
                    <button 
                        onClick={() => handleNavigate('dashboard')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'dashboard' ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <User size={18}/> Painel
                    </button>
                    <button 
                        onClick={() => handleNavigate('my_class')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'my_class' ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Users size={18}/> Minha Turma
                    </button>
                    <button 
                        onClick={() => handleNavigate('results')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'results' ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <FileText size={18}/> Minhas Notas
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-600 py-2 text-sm font-bold">
                        <LogOut size={16}/> Sair
                    </button>
                </div>
            </div>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900 relative">
                <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 md:px-8 flex justify-between items-center sticky top-0 z-10 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg md:hidden"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 capitalize truncate">{currentView.replace('_', ' ')}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeSwitcher variant="compact" />
                        <LanguageSwitcher variant="compact" />
                        <span className="text-sm text-slate-500 dark:text-slate-400 hidden md:block">{session?.user?.email}</span>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {currentView === 'dashboard' && <StudentDashboard hasSupabase={isConnected} session={session} onTakeTest={startExam} />}
                    {currentView === 'my_class' && <StudentClassViewer hasSupabase={isConnected} />}
                    {currentView === 'results' && <TestResults hasSupabase={isConnected} />}
                </div>
            </main>
        </div>
    );
};

export default StudentLayout;
