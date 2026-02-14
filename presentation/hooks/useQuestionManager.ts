
import { useState, useEffect, useMemo, useCallback } from 'react';
import { QuestionUseCases } from '../../domain/usecases';
import { QuestionRepositoryImpl, AIRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { Question, AIQuestionParams } from '../../types';

export const useQuestionManager = (hasSupabase: boolean) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const supabase = getSupabaseClient();
  
  const useCase = useMemo(() => {
    if (!supabase) return null;
    return new QuestionUseCases(
        new QuestionRepositoryImpl(supabase),
        new AIRepositoryImpl()
    );
  }, [supabase]);

  const fetchQuestions = useCallback(async () => {
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
        const data = await useCase.getQuestions(includeDeleted);
        setQuestions(data);
    } catch (err: any) {
        const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        setError(msg || "Failed to load questions.");
    } finally {
        setLoading(false);
    }
  }, [useCase, supabase, showDeleted]);

  useEffect(() => {
    if (hasSupabase) fetchQuestions();
  }, [hasSupabase, fetchQuestions]);

  const generateAI = async (params: AIQuestionParams) => {
    if (!useCase) return;
    setIsGenerating(true);
    try {
        await useCase.generateFromAI(params);
        await fetchQuestions();
    } catch (err: any) {
        const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        alert("Failed to generate questions: " + msg);
    } finally {
        setIsGenerating(false);
    }
  };

  const saveManual = async (id: string | null, data: any, options: any[], imageFile?: File) => {
    if (!useCase) return;
    try {
        await useCase.saveQuestion(id, data, options, imageFile);
        await fetchQuestions();
        return true;
    } catch (err: any) {
        const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        alert("Error saving question: " + msg);
        return false;
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!useCase) return;
    try {
      await useCase.deleteQuestion(id);
      await fetchQuestions();
    } catch (err: any) {
      const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      alert("Failed to delete question: " + msg);
    }
  };

  const restoreQuestion = async (id: string) => {
      if (!useCase) return;
      try {
          await useCase.restoreQuestion(id);
          await fetchQuestions();
      } catch (err: any) {
          const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          alert("Failed to restore question: " + msg);
      }
  };

  return {
    questions,
    loading,
    error,
    isGenerating,
    fetchQuestions,
    generateAI,
    saveManual,
    deleteQuestion,
    restoreQuestion,
    isAdmin, showDeleted, setShowDeleted,
    refresh: fetchQuestions
  };
};
