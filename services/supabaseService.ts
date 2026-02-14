
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 1. Try Environment Variables (Vite uses import.meta.env)
// Support both VITE_ prefix and REACT_APP_ prefix for compatibility
// Note: We can't use typeof import, so we check import.meta directly
let envUrl: string | undefined;
let envKey: string | undefined;

try {
    // @ts-ignore - import.meta is available in Vite
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        envUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.REACT_APP_SUPABASE_URL;
        // @ts-ignore
        envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.REACT_APP_SUPABASE_ANON_KEY;
    }
} catch {
    // import.meta not available, try process.env
}

// Fallback to process.env
if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}
if (!envKey && typeof process !== 'undefined' && process.env) {
    envKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
}

// 2. Try Local Storage (Manual Entry fallback)
const localUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_url') : null;
const localKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_key') : null;

let client: SupabaseClient | null = null;

const url = envUrl || localUrl;
const key = envKey || localKey;

if (url && key) {
  try {
    client = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  } catch {
    // Supabase client init failed (e.g. missing env)
  }
}

export const getSupabaseClient = () => {
  return client;
};

export const setupSupabase = (url: string, key: string) => {
    if (!url || !key) throw new Error("URL and Key are required");
    try {
        // Validate URL format simply
        new URL(url); 
        
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);
        
        // Re-initialize with auth options to ensure tokens are automatically included
        client = createClient(url, key, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false
          }
        });
        return client;
    } catch (e) {
        throw e;
    }
};

export const disconnectSupabase = () => {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    client = null;
    window.location.reload();
};

/**
 * Sign out the current user from Supabase Auth.
 * This clears the session, localStorage, and redirects to login.
 * Enhanced for production to ensure complete logout.
 */
export const signOut = async (): Promise<void> => {
    try {
        // 1. Sign out from Supabase Auth (this clears server-side session and cookies)
        if (client) {
            try {
                const { error } = await client.auth.signOut();
                if (error) {
                    // signOut error - continue clearing local state
                }
            } catch {
                // signOut exception - continue clearing local state
            }
        }

        // 2. Clear Supabase-related localStorage keys
        // Supabase stores auth tokens in localStorage with specific keys
        if (typeof window !== 'undefined') {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (
                    key.startsWith('sb-') || // Supabase auth keys
                    key.includes('supabase.auth') || // Alternative format
                    key.includes('supabase:auth') // Another possible format
                )) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch {
                    // ignore
                }
            });

            // Also clear sessionStorage for good measure
            try {
                sessionStorage.clear();
            } catch {
                // ignore
            }
        }

        // 3. Wait a bit to ensure all async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // 4. Clear state without full page reload - just reset to login state
        // Removed automatic reload to prevent unnecessary page refreshes
    } catch {
        // State will be cleared by React state management, no need to reload
    }
};
