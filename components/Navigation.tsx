
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileQuestion, 
  FileText, 
  GraduationCap,
  ScanLine,
  ClipboardList,
  Building2,
  Bot,
  UserCheck,
  Send,
  BookOpen,
  LogOut,
  ShieldCheck,
  Settings,
  Briefcase,
  Layers,
  Lock,
  Landmark,
  X,
  ScrollText,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { View, UserRole } from '../types';
import { signOut } from '../services/supabaseService';

interface NavigationProps {
  currentView: View;
  onNavigate: (view: View) => void;
  userEmail?: string;
  userRole: UserRole;
  onClose?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onNavigate, userEmail, userRole, onClose }) => {
  
  const items = {
      dashboard: { id: 'dashboard', label: 'Painel', desc: 'Visão Geral', icon: LayoutDashboard },
      institutions: { id: 'institutions', label: 'Instituições', desc: 'Escolas e Universidades', icon: Building2 },
      institution_types: { id: 'institution_types', label: 'Tipos de Instituição', desc: 'Categorias', icon: Layers },
      professors: { id: 'professors', label: 'Professores', desc: 'Docentes e Departamentos', icon: Briefcase },
      students: { id: 'students', label: 'Alunos', desc: 'Matrículas e Cadastro', icon: Users },
      classes: { id: 'classes', label: 'Turmas', desc: 'Grupos de Alunos', icon: Users },
      grades: { id: 'grades', label: 'Séries', desc: 'Anos Letivos', icon: GraduationCap },
      questions: { id: 'questions', label: 'Banco de Questões', desc: 'Conteúdo Curricular', icon: FileQuestion },
      tests: { id: 'tests', label: 'Provas', desc: 'Criar Avaliações', icon: FileText },
      releases: { id: 'releases', label: 'Liberações', desc: 'Agendar e Atribuir', icon: Send },
      grading: { id: 'grading', label: 'Correção', desc: 'Digitalizar Gabaritos', icon: ScanLine },
      results: { id: 'results', label: 'Resultados', desc: 'Histórico e Análises', icon: ClipboardList },
      agents: { id: 'agents', label: 'Agentes IA', desc: 'Tutores e Assistentes', icon: Bot },
      config: { id: 'settings', label: 'Configurações', desc: 'Sistema', icon: Settings },
      rules: { id: 'rules', label: 'Regras de Usuário', desc: 'Permissões', icon: ShieldCheck },
      bncc: { id: 'bncc', label: 'BNCC', desc: 'Base Nacional Comum', icon: ScrollText },
      
      // Institution Manager specific
      my_institution: { id: 'my_institution', label: 'Minha Instituição', desc: 'Perfil', icon: Building2 },
      departments: { id: 'departments', label: 'Departamentos', desc: 'Divisões', icon: Briefcase },
      disciplines: { id: 'disciplines', label: 'Disciplinas', desc: 'Matérias', icon: BookOpen },
      financial: { id: 'financial', label: 'Financeiro', desc: 'Receitas e Despesas', icon: DollarSign },
      reports: { id: 'reports', label: 'Relatórios', desc: 'Desempenho e Análises', icon: BarChart3 },
  };

  const getMenuForRole = (role: UserRole) => {
      switch (role) {
          case 'Administrator':
              return [
                  items.dashboard,
                  { label: 'Gestão', type: 'header' },
                  items.institutions, items.institution_types, items.rules, items.config,
                  { label: 'Estrutura Acadêmica', type: 'header' },
                  items.professors, items.students, items.classes, items.grades, items.disciplines,
                  { label: 'Educacional', type: 'header' },
                  items.bncc, items.questions, items.tests, items.releases, items.grading, items.results, items.agents
              ];
          case 'Institution':
              return [
                  items.dashboard,
                  { label: 'Minha Escola', type: 'header' },
                  items.my_institution, items.departments, items.professors, items.students,
                  { label: 'Financeiro', type: 'header' },
                  items.financial,
                  { label: 'Acadêmico', type: 'header' },
                  items.grades, items.classes, items.disciplines, items.bncc,
                  { label: 'Avaliações', type: 'header' },
                  items.questions, items.tests, items.releases, items.results,
                  { label: 'Relatórios', type: 'header' },
                  items.reports
              ];
          case 'Teacher':
              return [
                  items.dashboard,
                  { label: 'Meus Grupos', type: 'header' },
                  items.classes, items.students, items.grades,
                  { label: 'Avaliações', type: 'header' },
                  items.questions, items.tests, items.releases, items.grading, items.results, items.agents,
                  { label: 'Relatórios', type: 'header' },
                  items.reports
              ];
          case 'Student':
              return [
                  items.dashboard,
                  // Alunos tipicamente têm navegação simplificada, tratada no StudentLayout diretamente.
                  // Mas se usar este componente:
                  { label: 'Meu Aprendizado', type: 'header' },
                  { id: 'my_class', label: 'Minha Turma', icon: Users },
                  { id: 'results', label: 'Minhas Notas', icon: FileText }
              ];
          default:
              return [items.dashboard];
      }
  };

  const menuItems = getMenuForRole(userRole);

  const handleLogout = async () => {
      await signOut();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
        <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${userRole === 'Administrator' ? 'bg-slate-800 dark:bg-slate-700' : userRole === 'Institution' ? 'bg-indigo-600 dark:bg-indigo-700' : 'bg-emerald-600 dark:bg-emerald-700'}`}>
                    <LayoutDashboard size={20} />
                </div>
                <div>
                    <h1 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">EduTest AI</h1>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{userRole}</p>
                </div>
            </div>
            {onClose && (
                <button onClick={onClose} className="md:hidden text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                    <X size={24}/>
                </button>
            )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {menuItems.map((item: any, idx) => {
                if (item.type === 'header') {
                    return (
                        <div key={idx} className="px-3 py-2 mt-4 mb-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {item.label}
                        </div>
                    );
                }
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => { onNavigate(item.id); if(onClose) onClose(); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'}`}
                    >
                        <div className={`p-1.5 rounded-md transition-colors ${isActive ? 'bg-white dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-600 group-hover:shadow-sm'}`}>
                            <Icon size={18} />
                        </div>
                        <div className="text-left">
                            <div className="font-semibold text-sm">{item.label}</div>
                            {item.desc && <div className="text-[10px] opacity-70 font-medium">{item.desc}</div>}
                        </div>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></div>}
                    </button>
                );
            })}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                    {userEmail?.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{userEmail}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Conectado</div>
                </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 rounded-lg transition-colors text-sm font-bold">
                <LogOut size={16} /> Sair
            </button>
        </div>
    </div>
  );
};

export default Navigation;
