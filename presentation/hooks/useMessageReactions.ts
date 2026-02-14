import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MessageReactionUseCases } from '../../domain/usecases';
import { MessageReactionRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { MessageReaction, MessageReactionType, MessageReactionCounts } from '../../types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseMessageReactionsProps {
  messageIds: string[];
  currentUserId: string | null;
  hasSupabase: boolean;
}


export const useMessageReactions = ({ messageIds, currentUserId, hasSupabase }: UseMessageReactionsProps) => {
  const [reactionCounts, setReactionCounts] = useState<Record<string, MessageReactionCounts>>({});
  const [userReactions, setUserReactions] = useState<Record<string, MessageReaction>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const reactionUseCase = useMemo(() => 
    supabase ? new MessageReactionUseCases(new MessageReactionRepositoryImpl(supabase)) : null, 
  [supabase]);

  // Buscar contagens e reações do usuário
  const fetchReactions = useCallback(async () => {
    if (!reactionUseCase || messageIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Buscar contagens de reações para todas as mensagens
      const counts = await reactionUseCase.getReactionCountsForMessages(messageIds);
      setReactionCounts(counts);

      // Se o usuário está logado, buscar suas reações
      if (currentUserId) {
        const reactions = await reactionUseCase.getUserReactionsForMessages(messageIds, currentUserId);
        setUserReactions(reactions);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar reações.");
    } finally {
      setLoading(false);
    }
  }, [reactionUseCase, messageIds, currentUserId]);

  // Configurar subscription realtime para reações
  useEffect(() => {
    if (!supabase || !hasSupabase || messageIds.length === 0) return;

    // Limpar subscription anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Criar filtro para múltiplas mensagens
    const channel = supabase
      .channel('message_reactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        async (payload: any) => {
          // Verificar se a reação é para uma das mensagens que estamos monitorando
          const messageId = payload.new?.message_id || payload.old?.message_id;
          if (messageId && messageIds.includes(messageId)) {
            // Re-fetch reactions para atualizar o estado
            await fetchReactions();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Limpar ao desmontar
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, hasSupabase, messageIds.join(','), fetchReactions]);

  // Initial fetch quando messageIds mudam
  useEffect(() => {
    if (hasSupabase && messageIds.length > 0) {
      fetchReactions();
    }
  }, [hasSupabase, messageIds.join(','), currentUserId, fetchReactions]);

  // Toggle reaction para uma mensagem
  const toggleReaction = async (messageId: string, reactionType: MessageReactionType) => {
    if (!reactionUseCase || !currentUserId) {
      throw new Error("Você precisa estar logado para reagir.");
    }

    try {
      const result = await reactionUseCase.toggleReaction(messageId, currentUserId, reactionType);
      
      // Atualizar estado local otimisticamente
      setUserReactions(prev => {
        const updated = { ...prev };
        if (result) {
          updated[messageId] = result;
        } else {
          delete updated[messageId];
        }
        return updated;
      });

      // Re-fetch para garantir sincronização
      await fetchReactions();

      return result;
    } catch (err: any) {
      throw new Error(err.message || "Erro ao reagir.");
    }
  };

  // Helper para obter contagem de uma mensagem específica
  const getReactionCounts = (messageId: string): MessageReactionCounts => {
    return reactionCounts[messageId] || { like: 0, dislike: 0, love: 0, understood: 0 };
  };

  // Helper para obter reação do usuário em uma mensagem específica
  const getUserReaction = (messageId: string): MessageReaction | null => {
    return userReactions[messageId] || null;
  };

  // Helper para verificar se o usuário reagiu com um tipo específico
  const hasUserReacted = (messageId: string, reactionType: MessageReactionType): boolean => {
    const reaction = userReactions[messageId];
    return reaction?.reaction_type === reactionType;
  };

  return {
    reactionCounts,
    userReactions,
    loading,
    error,
    toggleReaction,
    getReactionCounts,
    getUserReaction,
    hasUserReacted,
    refresh: fetchReactions
  };
};

