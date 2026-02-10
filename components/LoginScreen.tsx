
import React, { useState } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { LogIn, Mail, Lock, Loader2, AlertCircle, ShieldCheck, UserPlus, Eye, EyeOff } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => Promise<void> | void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const supabase = getSupabaseClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
        setError("Cliente Supabase não inicializado. Verifique suas variáveis de ambiente.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
        let authResponse;
        if (mode === 'login') {
            authResponse = await supabase.auth.signInWithPassword({
                email,
                password
            });
        } else {
            authResponse = await supabase.auth.signUp({
                email,
                password
            });
        }

        const { data: { user, session }, error: authError } = authResponse;
        if (authError) throw authError;

        if (user) {
            // Check for linkage with app_users
            try {
                const { data: appUser, error: fetchError } = await supabase
                    .from('app_users')
                    .select('id, auth_id')
                    .ilike('email', email.trim()) 
                    .maybeSingle();

                if (appUser && appUser.auth_id !== user.id) {
                    await supabase
                        .from('app_users')
                        .update({ auth_id: user.id })
                        .eq('id', appUser.id);
                }
            } catch (linkError) {
                // Linkage check skipped
            }

            if (mode === 'signup' && !session) {
                alert("Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.");
                setMode('login');
            } else {
                // Await this to keep button loading until parent switches to full screen loader
                await onLoginSuccess();
            }
        }

    } catch (err: any) {
        // Use warn for expected auth errors to keep console clean
        // Authentication failed
        
        let msg = err.message || "Autenticação falhou";
        if (msg.includes("Email not confirmed")) {
            msg = "E-mail não confirmado. Verifique sua caixa de entrada.";
        } else if (msg.includes("Invalid login credentials")) {
            msg = "E-mail ou senha inválidos. Se você ainda não ativou sua conta, por favor ative a sua conta.";
        } else if (msg.includes("User already registered")) {
            msg = "Usuário já registrado. Por favor, faça login.";
        }
        setError(msg);
        setLoading(false); // Only stop loading on error. On success, parent takes over.
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-indigo-600 dark:bg-indigo-700 p-8 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                    <ShieldCheck size={32} className="text-white"/>
                </div>
                <h1 className="text-2xl font-bold text-white">EduTest AI Manager</h1>
                <p className="text-indigo-200 text-sm mt-1">Sistema Seguro de Gestão Acadêmica</p>
            </div>
            
            <div className="p-8">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm flex gap-2 items-start mb-6">
                        <AlertCircle size={16} className="shrink-0 mt-0.5"/>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Endereço de E-mail</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18}/>
                            <input 
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-3 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                                placeholder="admin@escola.edu.br"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18}/>
                            <input 
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-10 py-3 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20}/> : (mode === 'login' ? <LogIn size={20}/> : <UserPlus size={20}/>)}
                        {mode === 'login' ? 'Entrar' : 'Ativar Conta'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                        className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                        {mode === 'login' ? "Não tem conta? Ative a sua conta" : "Já tem conta? Entrar"}
                    </button>
                </div>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">Protegido por Supabase Auth</p>
            </div>
        </div>
    </div>
  );
};

export default LoginScreen;
