
import { useState, useEffect, useMemo, useCallback } from 'react';
import { BNCCUseCases } from '../../domain/usecases';
import { BNCCRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { BNCCItem } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useBNCCManager = (hasSupabase: boolean) => {
    const [items, setItems] = useState<BNCCItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);

    const supabase = getSupabaseClient();
    const useCase = useMemo(() => supabase ? new BNCCUseCases(new BNCCRepositoryImpl(supabase)) : null, [supabase]);

    const fetchItems = useCallback(async () => {
        if (!useCase || !supabase) return;
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            let adminStatus = false;
            if (user) {
                const { data } = await supabase.from('app_users').select('user_rules(rule_name)').eq('auth_id', user.id).single();
                if (data?.user_rules?.rule_name === 'Administrator') adminStatus = true;
            }
            setIsAdmin(adminStatus);

            const includeDeleted = adminStatus && showDeleted;
            const data = await useCase.getItems(includeDeleted);
            setItems(data);
        } catch (err: any) {
            console.error("Error fetching BNCC items:", err);
            if (err?.code === '42P01') {
                setError("Tabela 'bncc' não encontrada. Por favor, execute o script SQL no Schema do Banco de Dados.");
            } else {
                setError(err.message || "Falha ao carregar itens BNCC.");
            }
        } finally {
            setLoading(false);
        }
    }, [useCase, supabase, showDeleted]);

    useEffect(() => {
        if (hasSupabase) fetchItems();
    }, [hasSupabase, fetchItems]);

    const saveItem = async (id: string | null, item: Partial<BNCCItem>) => {
        if (!useCase) return false;
        try {
            if (id) {
                await useCase.updateItem(id, item);
            } else {
                await useCase.createItem(item);
            }
            await fetchItems();
            return true;
        } catch (err: any) {
            alert("Error saving BNCC item: " + getFriendlyErrorMessage(err));
            return false;
        }
    };

    const deleteItem = async (id: string) => {
        if (!useCase) return;
        try {
            await useCase.deleteItem(id);
            await fetchItems();
        } catch (err: any) {
            alert("Error deleting item: " + getFriendlyErrorMessage(err));
        }
    };

    const restoreItem = async (id: string) => {
        if (!useCase) return;
        try {
            await useCase.restoreItem(id);
            await fetchItems();
        } catch (err: any) {
            alert("Error restoring item: " + getFriendlyErrorMessage(err));
        }
    };

    return { 
        items, loading, error, 
        saveItem, deleteItem, restoreItem, 
        isAdmin, showDeleted, setShowDeleted, refresh: fetchItems 
    };
};
