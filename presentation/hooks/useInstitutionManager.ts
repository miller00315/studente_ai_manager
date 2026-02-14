import { useState, useEffect, useMemo, useCallback } from 'react';
import { InstitutionUseCases, UserRuleUseCases } from '../../domain/usecases';
import { InstitutionRepositoryImpl, UserRuleRepositoryImpl } from '../../data/repositories';
import { getSupabaseClient } from '../../services/supabaseService';
import { Institution, Address, UserRegistrationDTO, UserRule } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useInstitutionManager = (hasSupabase: boolean) => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [rules, setRules] = useState<UserRule[]>([]);

  const supabase = getSupabaseClient();
  const useCase = useMemo(() => supabase ? new InstitutionUseCases(new InstitutionRepositoryImpl(supabase)) : null, [supabase]);
  const ruleUseCase = useMemo(() => supabase ? new UserRuleUseCases(new UserRuleRepositoryImpl(supabase)) : null, [supabase]);

  const fetchInstitutions = useCallback(async () => {
    if (!useCase || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      // Check role to determine visibility
      const { data: { user } } = await supabase.auth.getUser();
      let adminStatus = false;
      if (user) {
          const { data } = await supabase
            .from('app_users')
            .select('user_rules(rule_name)')
            .eq('auth_id', user.id)
            .single();
          
          if (data?.user_rules?.rule_name === 'Administrator') {
              adminStatus = true;
          }
      }
      setIsAdmin(adminStatus);

      // Only allow includeDeleted if user is Admin AND toggle is checked
      const includeDeleted = adminStatus && showDeleted;
      const data = await useCase.getInstitutions(includeDeleted);
      setInstitutions(data);
    } catch (err: any) {
      const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setError(msg || "Failed to load institutions.");
    } finally {
      setLoading(false);
    }
  }, [useCase, supabase, showDeleted]);

  const fetchRules = useCallback(async () => {
    if (!ruleUseCase) return;
    try {
        const data = await ruleUseCase.getRules();
        setRules(data);
    } catch (err) {
    }
  }, [ruleUseCase]);

  useEffect(() => {
    if (hasSupabase) {
        fetchInstitutions();
        fetchRules();
    }
  }, [hasSupabase, fetchInstitutions, fetchRules]);

  const addInstitution = async (inst: Partial<Institution>, address: Partial<Address> | undefined, manager: UserRegistrationDTO) => {
    if (!useCase || !ruleUseCase) return;
    try {
      const managerData = { ...manager };
      if (!managerData.rule_id) {
        const rules = await ruleUseCase.getRules();
        const instRule = rules.find(r => !r.deleted && ['institution', 'instituição', 'gestor'].includes(r.rule_name?.toLowerCase()?.trim()));
        if (instRule?.id) {
            managerData.rule_id = instRule.id;
        }
      }

      // Garante compatibilidade se o repositório esperar camelCase ruleId
      if (managerData.rule_id) {
          (managerData as any).ruleId = managerData.rule_id;
          (managerData as any).user_rule_id = managerData.rule_id;
          (managerData as any).userRuleId = managerData.rule_id;
      }

      // Adding institution manager
      await useCase.addInstitution(inst, address, managerData);
      await fetchInstitutions();
    } catch (err: any) {
      const msg = getFriendlyErrorMessage(err);
      alert("Failed to add institution: " + msg);
    }
  };

  const updateInstitution = async (id: string, inst: Partial<Institution>, address: Partial<Address> | undefined, manager: Partial<UserRegistrationDTO>) => {
      if (!useCase) return;
      try {
          await useCase.updateInstitution(id, inst, address, manager);
          await fetchInstitutions();
      } catch (err: any) {
          const msg = getFriendlyErrorMessage(err);
          alert("Failed to update institution: " + msg);
      }
  };

  const deleteInstitution = async (id: string) => {
    if (!useCase) return;
    try {
      await useCase.removeInstitution(id);
      await fetchInstitutions();
    } catch (err: any) {
      throw err; // Propagate error to component for handling
    }
  };

  const restoreInstitution = async (id: string) => {
      if (!useCase) return;
      try {
          await useCase.restoreInstitution(id);
          await fetchInstitutions();
      } catch (err: any) {
          throw err;
      }
  };

  const refresh = useCallback(async () => {
    await Promise.all([fetchInstitutions(), fetchRules()]);
  }, [fetchInstitutions, fetchRules]);

  return { 
      institutions, loading, error, 
      addInstitution, updateInstitution, deleteInstitution, restoreInstitution, 
      isAdmin, showDeleted, setShowDeleted, 
      refresh,
      rules
  };
};
