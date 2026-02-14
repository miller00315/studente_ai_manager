import React, { useState, useEffect, useCallback, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import { UserRole } from './types';
import { getSupabaseClient, setupSupabase, signOut } from './services/supabaseService';
import { Loader2, Database, GraduationCap, Save } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { useTheme } from './presentation/hooks/useTheme';
import StudentLayout from './components/StudentLayout';

// --- SETUP SCREEN COMPONENT ---
const SetupScreen = () => {
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
            setupSupabase(url.trim(), key.trim());
            window.location.reload();
        } catch (err: any) {
            setError(err.message || "Invalid configuration. Check URL format.");
            setIsSaving(false);
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                        <Database size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Setup Database</h2>
                    <p className="text-slate-500 text-center mt-2 text-sm">
                        Environment variables are missing. Please enter your Supabase credentials manually to connect.
                    </p>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Supabase URL</label>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://your-project.supabase.co"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Supabase Anon Key</label>
                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            required
                        />
                    </div>
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Configuration
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    useTheme();

    const [session, setSession] = useState<Session | null>(null);
    const [userRole, setUserRole] = useState<UserRole>('Student');
    const [authLoading, setAuthLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Inicializando Sistema...");
    const [roleCheckAttempted, setRoleCheckAttempted] = useState(false);
    const loginProcessingRef = useRef(false);
    const signInProcessingRef = useRef(false);
    const profileResolvedRef = useRef(false);

    const client = getSupabaseClient();

    /** Extracts rule_name from Supabase relation (object, array, or user_rule FK name). */
    const extractRoleFromAppUser = useCallback((appUser: any): string | null => {
        if (!appUser) return null;
        const rel = appUser.user_rules ?? appUser.user_rule;
        if (Array.isArray(rel)) return rel[0]?.rule_name ?? null;
        if (rel && typeof rel === 'object') return (rel as any).rule_name ?? null;
        return null;
    }, []);

    const fetchRole = useCallback(async (uid: string): Promise<void> => {
        if (!client) {
            setUserRole('Student');
            return;
        }
        try {
            let appUser: any = null;

            const { data: singleData, error: singleError } = await client
                .from('app_users')
                .select('id, user_rules(rule_name)')
                .eq('auth_id', uid)
                .single();

            if (singleError) {
                const { data: maybeData, error: maybeError } = await client
                    .from('app_users')
                    .select('id, user_rules(rule_name)')
                    .eq('auth_id', uid)
                    .maybeSingle();

                if (maybeError || !maybeData) {
                    return;
                }
                appUser = maybeData;
            } else {
                appUser = singleData;
            }

            if (!appUser) return;

            const role = extractRoleFromAppUser(appUser);
            if (role) {
                setUserRole(role as UserRole);
            } else {
                // Perfil encontrado mas relação user_rules vazia ou formato inesperado: no app student, tratar como Student
                setUserRole('Student');
            }
            profileResolvedRef.current = true;
        } catch {
            // fetchRole failed (e.g. user not in app_users)
        }
    }, [client, extractRoleFromAppUser]);

    const handleLoginSuccess = async () => {
        if (loginProcessingRef.current) return;
        loginProcessingRef.current = true;
        
        setAuthLoading(true);
        setLoadingMessage("Verificando Credenciais...");

        if (client) {
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                let currentSession = null;
                for (let i = 0; i < 3; i++) {
                    const { data: { session } } = await client.auth.getSession();
                    if (session?.user) {
                        currentSession = session;
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                if (currentSession?.user) {
                    setSession(currentSession);
                    setLoadingMessage("Carregando Perfil...");

                    const fetchRolePromise = fetchRole(currentSession.user.id);
                    const timeoutPromise = new Promise<void>((resolve) => {
                        setTimeout(() => resolve(), 5000);
                    });

                    await Promise.race([fetchRolePromise, timeoutPromise]);

                    setLoadingMessage("Preparando Ambiente...");
                    await new Promise(resolve => setTimeout(resolve, 300));
                    setAuthLoading(false);
                    loginProcessingRef.current = false;
                } else {
                    setAuthLoading(false);
                    loginProcessingRef.current = false;
                }
            } catch (e) {
                setAuthLoading(false);
                loginProcessingRef.current = false;
            }
        } else {
            setAuthLoading(false);
            loginProcessingRef.current = false;
        }
    };

    useEffect(() => {
        let mounted = true;
        let isTabVisible = typeof document !== 'undefined' ? !document.hidden : true;
        let lastVisibilityChange = Date.now();
        const VISIBILITY_DEBOUNCE_MS = 500; // Wait 500ms after visibility change before processing events

        // Listen to visibility changes to prevent actions when tab is not visible
        const handleVisibilityChange = () => {
            if (typeof document === 'undefined') return;
            const wasHidden = !isTabVisible;
            isTabVisible = !document.hidden;
            lastVisibilityChange = Date.now();
            if (!wasHidden && isTabVisible) {
                return;
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        const hasCredentials = client ||
            (typeof window !== 'undefined' && localStorage.getItem('supabase_url') && localStorage.getItem('supabase_key'));

        if (hasCredentials) {
            setIsConnected(true);

            if (!client) {
                return () => {
                    if (typeof document !== 'undefined') {
                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                    }
                };
            }

            const initAuth = async () => {
                try {
                    const sessionPromise = client.auth.getSession();
                    const timeoutPromise = new Promise((resolve) =>
                        setTimeout(() => resolve({ data: { session: null }, error: { message: "Auth timeout" } }), 5000)
                    );

                    const result: any = await Promise.race([sessionPromise, timeoutPromise]);
                    const { data: { session }, error } = result;

                    if (error && error.message !== "Auth timeout") {
                        if (mounted) {
                            setSession(null);
                        }
                    }

                    if (mounted) {
                        setSession(session);
                        if (session?.user) {
                            setLoadingMessage("Restaurando Sessão...");
                            await fetchRole(session.user.id);
                        } else {
                            if (!session) {
                                setUserRole('Student');
                            }
                        }
                    }
                } catch {
                    // Auth init error
                } finally {
                    if (mounted) setAuthLoading(false);
                }
            };

            initAuth();

            const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
                if (!mounted) return;

                // Ignore all events when tab is not visible to prevent unnecessary state changes
                if (typeof document !== 'undefined' && (document.hidden || !isTabVisible)) {
                    return;
                }
                const timeSinceVisibilityChange = Date.now() - lastVisibilityChange;
                if (timeSinceVisibilityChange < VISIBILITY_DEBOUNCE_MS) {
                    return;
                }

                if (event === 'SIGNED_IN') {
                    if (signInProcessingRef.current) return;
                    signInProcessingRef.current = true;
                    
                    if (session?.user && mounted) {
                        setSession(session);
                        setAuthLoading(true);
                        setLoadingMessage("Carregando Perfil...");

                        try {
                            const fetchRolePromise = fetchRole(session.user.id);
                            const timeoutPromise = new Promise<void>((resolve) => {
                                setTimeout(() => resolve(), 5000);
                            });

                            await Promise.race([fetchRolePromise, timeoutPromise]);
                        } catch {
                            // Error fetching role
                        }

                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        setLoadingMessage("Preparando Ambiente...");
                        setTimeout(() => {
                            if (mounted) {
                                setAuthLoading(false);
                                signInProcessingRef.current = false;
                            }
                        }, 300);
                    } else {
                        signInProcessingRef.current = false;
                    }
                    return;
                }

                if (event === 'SIGNED_OUT') {
                    profileResolvedRef.current = false;
                    setSession(null);
                    setUserRole('Student');
                    setAuthLoading(false);
                    return;
                }
                
                // Don't treat TOKEN_REFRESHED with no session as SIGNED_OUT immediately
                // This prevents reloads when tab regains focus and token is being refreshed

                if (event === 'TOKEN_REFRESHED') {
                    // Token refresh is normal - completely ignore to prevent any state changes
                    // This prevents reloads and remounts when tab regains focus
                    // Don't update session state, don't do anything - just return silently
                    // The Supabase client handles the token refresh internally, we don't need to react to it
                    return;
                }

                if (event === 'PASSWORD_RECOVERY') {
                    if (mounted) {
                        const { data: { session: currentSession } } = await client.auth.getSession();
                        if (currentSession) {
                            await signOut();
                        } else {
                            setSession(null);
                            setUserRole('Student');
                            setAuthLoading(false);
                        }
                    }
                }
            });

            const sessionCheckInterval = setInterval(async () => {
                if (!mounted) return;
                if (typeof document !== 'undefined' && (document.hidden || !isTabVisible)) {
                    return;
                }

                const { data: { session: currentSession } } = await client.auth.getSession();
                if (!currentSession) {
                    return;
                }

                try {
                    const { data: { session: checkedSession }, error } = await client.auth.getSession();

                    // Only sign out if there's a real error, not just a missing session
                    // This prevents unnecessary reloads when the tab regains focus
                    if (error) {
                        // Don't automatically sign out on errors - let Supabase handle token refresh
                    } else if (!checkedSession) {
                        // Session expired, update state without reloading
                        if (mounted) {
                            profileResolvedRef.current = false;
                            setSession(null);
                            setUserRole('Student');
                            setAuthLoading(false);
                        }
                    } else {
                        const expiresAt = checkedSession.expires_at;
                        if (expiresAt) {
                            const now = Math.floor(Date.now() / 1000);
                            const timeLeft = expiresAt - now;
                            // Only sign out if session is actually expired (with small buffer)
                            if (timeLeft < -60) { // 60 second buffer to avoid race conditions
                                if (mounted) {
                                    profileResolvedRef.current = false;
                                    setSession(null);
                                    setUserRole('Student');
                                    setAuthLoading(false);
                                }
                            }
                        }
                    }
                } catch {
                    // Session check error
                }
            }, 30000);

            return () => {
                mounted = false;
                subscription.unsubscribe();
                clearInterval(sessionCheckInterval);
                if (typeof document !== 'undefined') {
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                }
            };
        } else {
            setAuthLoading(false);
            setIsConnected(false);
            return () => {
                if (typeof document !== 'undefined') {
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                }
            };
        }
    }, [client]);

    useEffect(() => {
        if (session && !authLoading && userRole === 'Student' && !roleCheckAttempted) {
            setRoleCheckAttempted(true);
            const checkRoleAgain = async () => {
                if (session?.user?.id) {
                    await fetchRole(session.user.id);
                }
            };
            checkRoleAgain();
        }
    }, [session, authLoading, userRole, roleCheckAttempted]);

    // When login is not identified (wrong role or profile not resolved), logout and return to login screen
    useEffect(() => {
        if (!session || authLoading) return;
        const unidentified =
            userRole !== 'Student' ||
            (userRole === 'Student' && roleCheckAttempted && !profileResolvedRef.current);
        if (!unidentified) return;
        signOut().finally(() => {
            setSession(null);
            setUserRole('Student');
            setAuthLoading(false);
            setRoleCheckAttempted(false);
            profileResolvedRef.current = false;
        });
    }, [session, authLoading, userRole, roleCheckAttempted]);

    if (!isConnected) {
        return <SetupScreen />;
    }

    if (authLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-50"></div>

                <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-8 relative">
                        <div className="absolute inset-0 bg-indigo-50 rounded-2xl animate-pulse"></div>
                        <GraduationCap size={40} className="text-indigo-600 relative z-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">EduTest AI</h2>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm mt-4">
                        <Loader2 size={18} className="animate-spin text-indigo-600" />
                        <span className="text-sm font-medium text-slate-600">{loadingMessage}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (isConnected && !session) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    const shouldLogoutAndReturnToLogin =
        session &&
        !authLoading &&
        (userRole !== 'Student' ||
            (userRole === 'Student' && roleCheckAttempted && !profileResolvedRef.current));

    if (shouldLogoutAndReturnToLogin) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-slate-200">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mb-4">
                            <Loader2 size={32} className="animate-spin" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Encerrando sessão</h2>
                        <p className="text-slate-600 text-center text-sm">
                            Redirecionando para a tela de login...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <StudentLayout session={session} isConnected={isConnected} key={session?.user?.id || 'no-session'} />;
};

export default App;
