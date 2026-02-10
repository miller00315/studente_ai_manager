import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSupabaseClient } from '../../services/supabaseService';
import { 
  FinancialTransaction, 
  FinancialCategory, 
  BankAccount, 
  CostCenter,
  FinancialTransactionType,
  FinancialTransactionStatus,
  FinancialCategoryType,
  PaymentMethod
} from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errorHandling';

export const useFinancialManager = (hasSupabase: boolean, institutionId: string | null) => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!supabase || !institutionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('financial_transactions')
        .select(`
          *,
          financial_categories(*),
          bank_accounts(*),
          cost_centers(*),
          app_users(id, first_name, last_name, email),
          students(id, app_users(id, first_name, last_name))
        `)
        .eq('institution_id', institutionId)
        .eq('deleted', false)
        .order('due_date', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('financial_categories')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('deleted', false)
        .order('name', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Fetch bank accounts
      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('deleted', false)
        .order('name', { ascending: true });

      if (bankAccountsError) throw bankAccountsError;

      // Fetch cost centers
      const { data: costCentersData, error: costCentersError } = await supabase
        .from('cost_centers')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('deleted', false)
        .order('name', { ascending: true });

      if (costCentersError) throw costCentersError;

      setTransactions(transactionsData || []);
      setCategories(categoriesData || []);
      setBankAccounts(bankAccountsData || []);
      setCostCenters(costCentersData || []);
    } catch (err: any) {
      console.error("Error fetching financial data:", err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, institutionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add transaction
  const addTransaction = useCallback(async (transaction: Partial<FinancialTransaction>) => {
    if (!supabase || !institutionId) return;
    
    try {
      const { data, error: insertError } = await supabase
        .from('financial_transactions')
        .insert({
          ...transaction,
          institution_id: institutionId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update bank account balance if applicable
      if (transaction.bank_account_id && transaction.status === 'PAID') {
        const { data: accountData } = await supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('id', transaction.bank_account_id)
          .single();
        
        if (accountData) {
          const balanceChange = transaction.type === 'RECEIVABLE' 
            ? transaction.amount 
            : -transaction.amount;
          
          await supabase
            .from('bank_accounts')
            .update({ current_balance: Number(accountData.current_balance) + Number(balanceChange) })
            .eq('id', transaction.bank_account_id);
        }
      }

      await fetchData();
      return data;
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, institutionId, fetchData]);

  // Update transaction
  const updateTransaction = useCallback(async (id: string, transaction: Partial<FinancialTransaction>) => {
    if (!supabase) return;
    
    try {
      const oldTransaction = transactions.find(t => t.id === id);
      
      const { data, error: updateError } = await supabase
        .from('financial_transactions')
        .update({
          ...transaction,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update bank account balance if status changed
      if (oldTransaction && transaction.status && oldTransaction.status !== transaction.status) {
        const accountId = transaction.bank_account_id || oldTransaction.bank_account_id;
        if (accountId) {
          const { data: accountData } = await supabase
            .from('bank_accounts')
            .select('current_balance')
            .eq('id', accountId)
            .single();
          
          if (accountData) {
            let balanceChange = 0;
            
            if (oldTransaction.status === 'PAID' && transaction.status !== 'PAID') {
              // Reverting payment
              balanceChange = oldTransaction.type === 'RECEIVABLE' 
                ? -Number(oldTransaction.amount) 
                : Number(oldTransaction.amount);
            } else if (oldTransaction.status !== 'PAID' && transaction.status === 'PAID') {
              // Applying payment
              balanceChange = oldTransaction.type === 'RECEIVABLE' 
                ? Number(oldTransaction.amount) 
                : -Number(oldTransaction.amount);
            }

            if (balanceChange !== 0) {
              await supabase
                .from('bank_accounts')
                .update({ current_balance: Number(accountData.current_balance) + balanceChange })
                .eq('id', accountId);
            }
          }
        }
      }

      await fetchData();
      return data;
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, transactions, fetchData]);

  // Delete transaction
  const deleteTransaction = useCallback(async (id: string) => {
    if (!supabase) return;
    
    try {
      const { error: deleteError } = await supabase
        .from('financial_transactions')
        .update({ deleted: true })
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchData();
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, fetchData]);

  // Add category
  const addCategory = useCallback(async (category: Partial<FinancialCategory>) => {
    if (!supabase || !institutionId) return;
    
    try {
      const { data, error: insertError } = await supabase
        .from('financial_categories')
        .insert({
          ...category,
          institution_id: institutionId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchData();
      return data;
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, institutionId, fetchData]);

  // Update category
  const updateCategory = useCallback(async (id: string, category: Partial<FinancialCategory>) => {
    if (!supabase) return;
    
    try {
      const { data, error: updateError } = await supabase
        .from('financial_categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchData();
      return data;
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, fetchData]);

  // Delete category
  const deleteCategory = useCallback(async (id: string) => {
    if (!supabase) return;
    
    try {
      const { error: deleteError } = await supabase
        .from('financial_categories')
        .update({ deleted: true })
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchData();
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, fetchData]);

  // Add bank account
  const addBankAccount = useCallback(async (account: Partial<BankAccount>) => {
    if (!supabase || !institutionId) return;
    
    try {
      const { data, error: insertError } = await supabase
        .from('bank_accounts')
        .insert({
          ...account,
          institution_id: institutionId,
          current_balance: account.initial_balance || 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchData();
      return data;
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, institutionId, fetchData]);

  // Update bank account
  const updateBankAccount = useCallback(async (id: string, account: Partial<BankAccount>) => {
    if (!supabase) return;
    
    try {
      const { data, error: updateError } = await supabase
        .from('bank_accounts')
        .update(account)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchData();
      return data;
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, fetchData]);

  // Delete bank account
  const deleteBankAccount = useCallback(async (id: string) => {
    if (!supabase) return;
    
    try {
      const { error: deleteError } = await supabase
        .from('bank_accounts')
        .update({ deleted: true })
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchData();
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, fetchData]);

  // Add cost center
  const addCostCenter = useCallback(async (costCenter: Partial<CostCenter>) => {
    if (!supabase || !institutionId) return;
    
    try {
      const { data, error: insertError } = await supabase
        .from('cost_centers')
        .insert({
          ...costCenter,
          institution_id: institutionId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchData();
      return data;
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, institutionId, fetchData]);

  // Update cost center
  const updateCostCenter = useCallback(async (id: string, costCenter: Partial<CostCenter>) => {
    if (!supabase) return;
    
    try {
      const { data, error: updateError } = await supabase
        .from('cost_centers')
        .update(costCenter)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchData();
      return data;
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, fetchData]);

  // Delete cost center
  const deleteCostCenter = useCallback(async (id: string) => {
    if (!supabase) return;
    
    try {
      const { error: deleteError } = await supabase
        .from('cost_centers')
        .update({ deleted: true })
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchData();
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err));
    }
  }, [supabase, fetchData]);

  // Calculate summary
  const summary = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'RECEIVABLE' && t.status === 'PAID')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const expenses = transactions
      .filter(t => t.type === 'PAYABLE' && t.status === 'PAID')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const pendingIncome = transactions
      .filter(t => t.type === 'RECEIVABLE' && t.status === 'PENDING')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const pendingExpenses = transactions
      .filter(t => t.type === 'PAYABLE' && t.status === 'PENDING')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const overdueIncome = transactions
      .filter(t => t.type === 'RECEIVABLE' && t.status === 'OVERDUE')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const overdueExpenses = transactions
      .filter(t => t.type === 'PAYABLE' && t.status === 'OVERDUE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      income,
      expenses,
      balance: income - expenses,
      pendingIncome,
      pendingExpenses,
      overdueIncome,
      overdueExpenses,
      totalBankBalance: bankAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0),
    };
  }, [transactions, bankAccounts]);

  return {
    transactions,
    categories,
    bankAccounts,
    costCenters,
    loading,
    error,
    summary,
    refresh: fetchData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
  };
};
