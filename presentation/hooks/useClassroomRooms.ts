import { useState, useEffect, useMemo, useCallback } from 'react';
import { ClassroomRoomUseCases } from '../../domain/usecases';
import { ClassroomRoomRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { ClassroomRoom } from '../../types';

export const useClassroomRooms = (classId: string | null, hasSupabase: boolean) => {
  const [rooms, setRooms] = useState<ClassroomRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInstitutionManager, setIsInstitutionManager] = useState(false);
  const [isProfessor, setIsProfessor] = useState(false);
  const [currentAppUserId, setCurrentAppUserId] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  const roomUseCase = useMemo(() => 
    supabase ? new ClassroomRoomUseCases(new ClassroomRoomRepositoryImpl(supabase)) : null, 
  [supabase]);

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!supabase) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Busca o app_users.id (não auth.users.id) para usar como created_by
          const { data } = await supabase
            .from('app_users')
            .select('id, user_rules(rule_name)')
            .eq('auth_id', user.id)
            .single();
          
          if (data) {
            setCurrentAppUserId(data.id); // app_users.id
            if (data.user_rules?.rule_name === 'Administrator') setIsAdmin(true);
            if (data.user_rules?.rule_name === 'Institution') setIsInstitutionManager(true);
            if (data.user_rules?.rule_name === 'Teacher') setIsProfessor(true);
          }
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
      }
    };
    if (hasSupabase) fetchUserRole();
  }, [supabase, hasSupabase]);

  // Only these roles can manage rooms
  const canManageRooms = isAdmin || isInstitutionManager || isProfessor;

  const fetchRooms = useCallback(async () => {
    if (!roomUseCase || !classId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const includeDeleted = isAdmin && showDeleted;
      const data = await roomUseCase.getRoomsByClass(classId, includeDeleted);
      setRooms(data);
    } catch (err: any) {
      console.error("Error fetching classroom rooms:", err);
      setError(err.message || "Erro ao carregar salas de bate-papo.");
    } finally {
      setLoading(false);
    }
  }, [roomUseCase, classId, isAdmin, showDeleted]);

  useEffect(() => {
    if (hasSupabase && classId) {
      fetchRooms();
    }
  }, [hasSupabase, classId, fetchRooms]);

  const createRoom = async (name: string, description?: string, isPublic = true) => {
    if (!roomUseCase || !classId || !canManageRooms) return;
    
    try {
      await roomUseCase.createRoom({
        class_id: classId,
        name,
        description,
        is_public: isPublic,
        created_by: currentAppUserId || undefined
      });
      await fetchRooms();
    } catch (e: any) {
      throw new Error(e.message || "Erro ao criar sala de bate-papo.");
    }
  };

  const updateRoom = async (id: string, name: string, description?: string, isPublic?: boolean) => {
    if (!roomUseCase || !canManageRooms) return;
    
    try {
      await roomUseCase.updateRoom(id, {
        name,
        description,
        is_public: isPublic
      });
      await fetchRooms();
    } catch (e: any) {
      throw new Error(e.message || "Erro ao atualizar sala de bate-papo.");
    }
  };

  const deleteRoom = async (id: string) => {
    if (!roomUseCase || !canManageRooms) return;
    
    try {
      await roomUseCase.deleteRoom(id);
      await fetchRooms();
    } catch (e: any) {
      throw new Error(e.message || "Erro ao excluir sala de bate-papo.");
    }
  };

  const restoreRoom = async (id: string) => {
    if (!roomUseCase || !isAdmin) return;
    
    try {
      await roomUseCase.restoreRoom(id);
      await fetchRooms();
    } catch (e: any) {
      throw new Error(e.message || "Erro ao restaurar sala de bate-papo.");
    }
  };

  return {
    rooms,
    loading,
    error,
    showDeleted,
    setShowDeleted,
    canManageRooms,
    isAdmin,
    createRoom,
    updateRoom,
    deleteRoom,
    restoreRoom,
    refresh: fetchRooms
  };
};

