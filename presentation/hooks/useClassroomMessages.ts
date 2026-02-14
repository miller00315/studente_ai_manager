import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ClassroomMessageUseCases } from '../../domain/usecases';
import { ClassroomMessageRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { ClassroomMessage, ClassroomMessageType } from '../../types';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useClassroomMessages = (roomId: string | null, hasSupabase: boolean) => {
  const [messages, setMessages] = useState<ClassroomMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInstitutionManager, setIsInstitutionManager] = useState(false);
  const [isProfessor, setIsProfessor] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAppUserId, setCurrentAppUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');

  const supabase = getSupabaseClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const messageUseCase = useMemo(() => 
    supabase ? new ClassroomMessageUseCases(new ClassroomMessageRepositoryImpl(supabase)) : null, 
  [supabase]);

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!supabase) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data } = await supabase
            .from('app_users')
            .select('id, first_name, last_name, user_rules(rule_name)')
            .eq('auth_id', user.id)
            .single();
          
          if (data) {
            setCurrentAppUserId(data.id);
            setCurrentUserName(`${data.first_name || ''} ${data.last_name || ''}`.trim());
            
            const ruleName = data.user_rules?.rule_name;
            if (ruleName === 'Administrator') setIsAdmin(true);
            if (ruleName === 'Institution') setIsInstitutionManager(true);
            if (ruleName === 'Teacher') setIsProfessor(true);
          }
        }
      } catch {
        // ignore
      }
    };
    if (hasSupabase) fetchUserRole();
  }, [supabase, hasSupabase]);

  // Professor, Admin and Institution can list ALL messages
  const canListMessages = isAdmin || isInstitutionManager || isProfessor;
  const canSendMessages = isAdmin || isInstitutionManager || isProfessor;
  const canManageMessages = isAdmin; // Only admin can delete/restore

  const fetchMessages = useCallback(async () => {
    if (!messageUseCase || !roomId || !canListMessages) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const includeDeleted = isAdmin && showDeleted;
      const data = await messageUseCase.getMessagesByRoom(roomId, includeDeleted);
      setMessages(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar mensagens.");
    } finally {
      setLoading(false);
    }
  }, [messageUseCase, roomId, canListMessages, isAdmin, showDeleted]);

  // Setup realtime subscription
  useEffect(() => {
    if (!supabase || !roomId || !hasSupabase || !canListMessages) return;

    // Cleanup previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new subscription
    const channel = supabase
      .channel(`classroom_messages:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'classroom_messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          // Re-fetch messages on any change
          // This ensures proper filtering for professors (only their own messages)
          await fetchMessages();
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup on unmount or dependency change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, roomId, hasSupabase, canListMessages, fetchMessages]);

  // Initial fetch
  useEffect(() => {
    if (hasSupabase && roomId && canListMessages && currentAppUserId !== null) {
      fetchMessages();
    } else if (!canListMessages) {
      // Clear messages if user cannot list
      setMessages([]);
    }
  }, [hasSupabase, roomId, canListMessages, currentAppUserId, fetchMessages]);

  const sendMessage = async (
    content: string, 
    type: ClassroomMessageType = 'text', 
    metadata?: Record<string, any>,
    nickname?: string
  ): Promise<ClassroomMessage | null> => {
    if (!messageUseCase || !roomId || !canSendMessages || !currentAppUserId) {
      throw new Error("Você não tem permissão para enviar mensagens.");
    }
    
    setSending(true);
    setError(null);
    
    try {
      const sentMessage = await messageUseCase.sendMessage({
        room_id: roomId,
        user_id: currentAppUserId,
        type,
        content,
        metadata,
        nickname: nickname || currentUserName
      });
      
      // Realtime will handle the update, but we can also refresh immediately
      // for better UX on the sender's side
      if (canListMessages) {
        await fetchMessages();
      }
      
      return sentMessage;
    } catch (e: any) {
      const errorMsg = e.message || "Erro ao enviar mensagem.";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const updateMessage = async (id: string, content: string) => {
    if (!messageUseCase || !canManageMessages) return;
    
    try {
      await messageUseCase.updateMessage(id, { content });
      // Realtime will handle the update
    } catch (e: any) {
      throw new Error(e.message || "Erro ao atualizar mensagem.");
    }
  };

  const deleteMessage = async (id: string) => {
    if (!messageUseCase || !canManageMessages) return;
    
    try {
      await messageUseCase.deleteMessage(id);
      // Realtime will handle the update
    } catch (e: any) {
      throw new Error(e.message || "Erro ao excluir mensagem.");
    }
  };

  const restoreMessage = async (id: string) => {
    if (!messageUseCase || !isAdmin) return;
    
    try {
      await messageUseCase.restoreMessage(id);
      // Realtime will handle the update
    } catch (e: any) {
      throw new Error(e.message || "Erro ao restaurar mensagem.");
    }
  };

  return {
    messages,
    loading,
    sending,
    error,
    showDeleted,
    setShowDeleted,
    canListMessages,
    canSendMessages,
    canManageMessages,
    isAdmin,
    isProfessor,
    currentAppUserId,
    currentUserName,
    sendMessage,
    updateMessage,
    deleteMessage,
    restoreMessage,
    refresh: fetchMessages
  };
};
