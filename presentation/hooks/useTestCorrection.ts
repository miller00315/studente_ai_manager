
import { useState, useMemo } from 'react';
import { GradingUseCases } from '../../domain/usecases';
import { TestRepositoryImpl, AIRepositoryImpl, TestReleaseRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { AnalyzedSheet, Test } from '../../types';

export const useTestCorrection = (hasSupabase: boolean) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentBase64, setCurrentBase64] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
      analysis: AnalyzedSheet;
      test: Test;
      gradedQuestions: any[];
      score: number;
      correctCount: number;
      totalQuestions: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const supabase = getSupabaseClient();
  const useCase = useMemo(() => {
      if (!supabase) return null;
      return new GradingUseCases(
          new TestRepositoryImpl(supabase), 
          new AIRepositoryImpl(),
          new TestReleaseRepositoryImpl(supabase)
      );
  }, [supabase]);

  const analyzeImage = async (base64Image: string, releaseId?: string) => {
      if (!useCase) return;
      setAnalyzing(true);
      setError(null);
      setResultData(null);
      setSavedSuccess(false);
      setCurrentBase64(base64Image);

      try {
          const result = await useCase.analyzeAndGrade(base64Image, releaseId);
          setResultData(result);
      } catch (err: any) {
          setError(err.message || "Analysis failed");
      } finally {
          setAnalyzing(false);
      }
  };

  const saveResults = async (overrides?: { student_id?: string, student_hash?: string }) => {
      if (!useCase || !resultData) return;
      
      if (!window.confirm("Are you sure you want to save this graded result to the database?")) {
          return;
      }

      setSaving(true);
      try {
        await useCase.saveResult({
            test_id: resultData.test.id,
            student_name: resultData.analysis.student_name || "Unknown",
            score: resultData.score,
            gradedQuestions: resultData.gradedQuestions,
            student_id: overrides?.student_id,
            student_hash: overrides?.student_hash,
            base64Image: currentBase64 || undefined
        });
        setSavedSuccess(true);
      } catch (err: any) {
          alert("Failed to save: " + err.message);
      } finally {
          setSaving(false);
      }
  };

  const reset = () => {
      setResultData(null);
      setError(null);
      setSavedSuccess(false);
      setCurrentBase64(null);
  };

  return {
      analyzing,
      saving,
      resultData,
      error,
      savedSuccess,
      analyzeImage,
      saveResults,
      reset
  };
};
