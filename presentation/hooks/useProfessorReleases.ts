
import { useState, useEffect, useMemo, useCallback } from 'react';
import { TestReleaseUseCases, TestUseCases } from '../../domain/usecases';
import { TestReleaseRepositoryImpl, TestRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { TestRelease, Test } from '../../types';


export const useProfessorReleases = (hasSupabase: boolean) => {
  const [releases, setReleases] = useState<TestRelease[]>([]);
  const [allReleases, setAllReleases] = useState<TestRelease[]>([]); // Todas as liberações (antes do filtro)
  const [tests, setTests] = useState<Test[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [professorIdLoading, setProfessorIdLoading] = useState(false);
  const [professorIdFetched, setProfessorIdFetched] = useState(false); // Flag para evitar múltiplas chamadas

  const supabase = getSupabaseClient();
  
  const releaseUC = useMemo(() => supabase ? new TestReleaseUseCases(new TestReleaseRepositoryImpl(supabase)) : null, [supabase]);
  const testUC = useMemo(() => supabase ? new TestUseCases(new TestRepositoryImpl(supabase)) : null, [supabase]);

  const fetchProfessorId = useCallback(async () => {
    if (!supabase || professorId || professorIdFetched || professorIdLoading) {
      if (!professorId && !professorIdFetched && !professorIdLoading) {
        setProfessorIdLoading(false);
      }
      return;
    }
    
    setProfessorIdLoading(true);
    setProfessorIdFetched(true);
    try {
      // Usar a mesma estratégia que useTestManager
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setProfessorIdLoading(false);
        setProfessorIdFetched(false);
        return;
      }
      
      let appUserId = null;
      const { data, error: appUserError } = await supabase
        .from('app_users')
        .select('id, user_rules(rule_name)')
        .eq('auth_id', user.id)
        .maybeSingle();
      
      if (appUserError) {
        console.error('Error fetching app_user:', appUserError);
        setProfessorIdLoading(false);
        setProfessorIdFetched(false);
        return;
      }
      
      if (data) {
        appUserId = data.id;
      }

      if (!appUserId) {
        setProfessorIdLoading(false);
        setProfessorIdFetched(false);
        return;
      }

      // Buscar professor usando a mesma query que useTestManager
      const { data: prof, error: profError } = await supabase
        .from('professors')
        .select('id, departments(institution_id)')
        .eq('user_id', appUserId)
        .maybeSingle();

      if (profError) {
        console.error('Error fetching professor:', profError);
        setProfessorIdLoading(false);
        setProfessorIdFetched(false);
        return;
      }

      if (prof) {
        setProfessorId(prof.id);
      }
      setProfessorIdLoading(false);
    } catch (err: any) {
      console.error('Error fetching professor ID:', err);
      setError('errors.professor.fetchFailed');
      setProfessorIdLoading(false);
      setProfessorIdFetched(false); // Permitir tentar novamente em caso de erro
    }
  }, [supabase, professorId, professorIdFetched, professorIdLoading]);

  const fetchTests = useCallback(async () => {
    if (!testUC || !professorId || !supabase) {
      setTests([]);
      setTestsLoading(false);
      return;
    }
    
    setTestsLoading(true);
    try {
      // Verificar se é admin (mesma estratégia que useTestManager)
      let adminStatus = false;
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error: appUserError } = await supabase
          .from('app_users')
          .select('id, user_rules(rule_name)')
          .eq('auth_id', user.id)
          .maybeSingle();
        
        if (!appUserError && data && data.user_rules?.rule_name === 'Administrator') {
          adminStatus = true;
        }
      }

      // Usar adminStatus para determinar se deve incluir deletados (mesma estratégia que useTestManager)
      const data = await testUC.getTestsByProfessor(professorId, adminStatus);
      setTests(data || []);
    } catch (err: any) {
      console.error('Error fetching tests:', err);
      setError('errors.test.fetchFailed');
      setTests([]);
    } finally {
      setTestsLoading(false);
    }
  }, [testUC, professorId, supabase]);

  const fetchReleases = useCallback(async (testId?: string) => {
    // Não buscar liberações se não houver professorId ou testId
    if (!releaseUC || !professorId || !testId) {
      setReleases([]);
      setAllReleases([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const fetchedReleases = await releaseUC.getReleasesByProfessor(professorId, false);
      
      // Filtrar apenas as liberações da prova selecionada
      const filtered = fetchedReleases.filter(r => r.test_id === testId);
      
      // Ordenar por data mais recente primeiro
      filtered.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      
      setAllReleases(filtered);
      // Inicialmente, mostrar todas (a paginação será feita no componente)
      setReleases(filtered);
    } catch (err: any) {
      console.error('Error fetching releases:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint
      });
      setError('errors.release.fetchFailed');
      setReleases([]);
      setAllReleases([]);
    } finally {
      setLoading(false);
    }
  }, [releaseUC, professorId]);

  // Buscar professorId quando o componente montar (similar ao useTestManager)
  useEffect(() => {
    if (hasSupabase && supabase && !professorId && !professorIdFetched) {
      fetchProfessorId();
    }
  }, [hasSupabase, supabase, professorId, professorIdFetched, fetchProfessorId]);

  // Buscar provas quando professorId estiver disponível
  useEffect(() => {
    if (hasSupabase && professorId && testUC && !professorIdLoading) {
      fetchTests();
    }
  }, [hasSupabase, professorId, testUC, professorIdLoading, fetchTests]);

  // Não buscar liberações automaticamente - apenas quando uma prova for selecionada

  // Loading geral é true enquanto está buscando professorId OU releases OU tests
  // Mas só mostra loading de releases se já tiver professorId
  const isLoading = professorIdLoading || loading || testsLoading;

  return {
    tests,
    releases,
    allReleases, // Todas as liberações filtradas (para paginação)
    loading: isLoading,
    loadingReleases: loading && professorId && !professorIdLoading, // Loading específico para releases
    loadingTests: testsLoading || professorIdLoading, // Loading específico para tests (inclui quando está buscando professorId)
    error,
    professorId,
    professorIdLoading, // Expor para debug
    refreshReleases: fetchReleases,
    refreshTests: fetchTests
  };
};
