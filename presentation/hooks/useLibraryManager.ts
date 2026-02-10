
import { useState, useEffect, useMemo, useCallback } from 'react';
import { LibraryUseCases } from '../../domain/usecases';
import { LibraryRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { Library, LibraryItem } from '../../types';

export const useLibraryManager = (hasSupabase: boolean, gradeId?: string) => {
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [selectedLibraryItems, setSelectedLibraryItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingItems, setLoadingItems] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [currentLibraryId, setCurrentLibraryId] = useState<string | null>(null);

    const supabase = getSupabaseClient();
    const useCase = useMemo(() => supabase ? new LibraryUseCases(new LibraryRepositoryImpl(supabase)) : null, [supabase]);

    // Check if user is admin
    useEffect(() => {
        const checkAdmin = async () => {
            if (!supabase) return;
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase.from('app_users').select('user_rules(rule_name)').eq('auth_id', user.id).single();
                    setIsAdmin(data?.user_rules?.rule_name === 'Administrator');
                }
            } catch (e) {
                console.error("Error checking admin status:", e);
            }
        };
        checkAdmin();
    }, [supabase]);

    const fetchLibraries = useCallback(async () => {
        if (!useCase || !gradeId) return;
        setLoading(true);
        try {
            const includeDeleted = isAdmin && showDeleted;
            const data = await useCase.getLibraries(gradeId, includeDeleted);
            setLibraries(data);
        } catch (err: any) {
            console.error("Error fetching libraries:", err);
            setError(err.message || "Failed to load libraries");
        } finally {
            setLoading(false);
        }
    }, [useCase, gradeId, isAdmin, showDeleted]);

    const fetchItems = useCallback(async (libraryId: string) => {
        if (!useCase) return;
        setLoadingItems(true);
        setCurrentLibraryId(libraryId);
        try {
            const includeDeleted = isAdmin && showDeleted;
            const data = await useCase.getItems(libraryId, includeDeleted);
            setSelectedLibraryItems(data);
        } catch (err: any) {
            console.error("Error fetching items:", err);
            alert("Failed to load items");
        } finally {
            setLoadingItems(false);
        }
    }, [useCase, isAdmin, showDeleted]);

    useEffect(() => {
        if (hasSupabase && gradeId) fetchLibraries();
    }, [hasSupabase, gradeId, fetchLibraries]);

    // Re-fetch items when showDeleted changes
    useEffect(() => {
        if (currentLibraryId) {
            fetchItems(currentLibraryId);
        }
    }, [showDeleted, currentLibraryId, fetchItems]);

    const createLibrary = async (name: string, description: string) => {
        if (!useCase || !gradeId) return;
        try {
            await useCase.createLibrary({ name, description, grade_id: gradeId });
            await fetchLibraries();
            return true;
        } catch (err: any) {
            alert(err.message);
            return false;
        }
    };

    const deleteLibrary = async (id: string) => {
        if (!useCase) return;
        await useCase.deleteLibrary(id);
        await fetchLibraries();
    };

    const restoreLibrary = async (id: string) => {
        if (!useCase) return;
        await useCase.restoreLibrary(id);
        await fetchLibraries();
    };

    const uploadItem = async (libraryId: string, title: string, description: string, file: File) => {
        if (!useCase) return;
        try {
            await useCase.addItem({ library_id: libraryId, title, description }, file);
            await fetchItems(libraryId);
            // Refresh libraries list to update counts if implemented
            fetchLibraries();
            return true;
        } catch (err: any) {
            alert("Upload failed: " + err.message);
            return false;
        }
    };

    const deleteItem = async (itemId: string, libraryId: string) => {
        if (!useCase) return;
        await useCase.deleteItem(itemId);
        await fetchItems(libraryId);
    };

    const restoreItem = async (itemId: string, libraryId: string) => {
        if (!useCase) return;
        await useCase.restoreItem(itemId);
        await fetchItems(libraryId);
    };

    return {
        libraries,
        selectedLibraryItems,
        loading,
        loadingItems,
        error,
        isAdmin,
        showDeleted,
        setShowDeleted,
        createLibrary,
        deleteLibrary,
        restoreLibrary,
        fetchItems,
        uploadItem,
        deleteItem,
        restoreItem,
        refresh: fetchLibraries
    };
};
