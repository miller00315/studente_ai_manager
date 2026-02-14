
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTestResults } from '../presentation/hooks/useTestResults';
import { CheckCircle, XCircle, Calendar, FileText, Loader2, User, Percent, Filter, Search, Building2, GraduationCap, AlertTriangle, RotateCcw, Eye, X, Hash, Image as ImageIcon, ExternalLink, Edit2, Save, FileClock, AlertOctagon, Map as MapIcon, Timer, History, Scale, Calculator, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { TestResult, TestResultCorrectionLog, TestAttemptLog } from '../types';

declare global {
  interface Window {
    L: any; // Leaflet global
  }
}

interface TestResultsProps {
  hasSupabase: boolean;
  institutionId?: string; // Optional prop for Strict Isolation
  onViewStudent?: (studentId: string) => void;
  onViewTest?: (testId: string) => void;
}

const TestResults: React.FC<TestResultsProps> = ({ hasSupabase, institutionId, onViewStudent, onViewTest }) => {
  // Filter State for Admin
  const [filterInst, setFilterInst] = useState(institutionId || '');
  
  // Use the effective institution ID (prop or selected)
  const effectiveInstId = institutionId || filterInst;

  const { results, institutions, loading, error, refresh, fetchTestDetails, updateResultAnswer, recalculateScore, fetchLogs, fetchStudentAnswers, fetchAttemptLogs, userRole } = useTestResults(hasSupabase, effectiveInstId || undefined);

  // Role-based access control
  const isAdmin = userRole === 'Administrator';
  const isInstitutionManager = userRole === 'Institution';
  const isTeacher = userRole === 'Teacher';
  const isStudent = userRole === 'Student';
  
  // Manager mode: roles que NÃO precisam selecionar instituição (tela isolada)
  const isIsolatedRole = isInstitutionManager || isTeacher || isStudent;
  
  // Admin mode: precisa selecionar instituição para ver dados
  const isManagerMode = !!institutionId || isIsolatedRole;
  
  // Para roles isolados, sempre tem contexto (não precisa selecionar)
  // Para admin, precisa selecionar ou ter institutionId como prop
  const hasInstitutionContext = isIsolatedRole || !!institutionId || !!filterInst;

  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'logs' | 'activity'>('details');
  const [logs, setLogs] = useState<TestResultCorrectionLog[]>([]);
  const [attemptLogs, setAttemptLogs] = useState<TestAttemptLog[]>([]);
  
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const [studentSearch, setStudentSearch] = useState('');
  const [testFilter, setTestFilter] = useState('All');
  const [institutionFilter, setInstitutionFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Auto-select institution if only one is available
  useEffect(() => {
      if (institutionId) {
          setFilterInst(institutionId);
      } else if (institutions.length === 1 && !filterInst) {
          setFilterInst(institutions[0].id);
      }
  }, [institutionId, institutions, filterInst]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const uniqueTests = Array.from(new Set(results.map(r => r.tests?.title).filter(Boolean))).sort();
  const uniqueInstitutions = Array.from(new Set(results.map(r => r.tests?.institutions?.name).filter(Boolean))).sort();

  const showInstitutionFilter = uniqueInstitutions.length > 1;

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const sName = r.student_name.toLowerCase();
      const tTitle = r.tests?.title || '';
      const iName = r.tests?.institutions?.name || '';
      const rDate = r.correction_date ? new Date(r.correction_date).toISOString().split('T')[0] : '';

      const matchStudent = sName.includes(studentSearch.toLowerCase());
      const matchTest = testFilter === 'All' || tTitle === testFilter;
      const matchInst = institutionFilter === 'All' || iName === institutionFilter;
      const matchDate = !dateFilter || rDate === dateFilter;

      return matchStudent && matchTest && matchInst && matchDate;
    });
  }, [results, studentSearch, testFilter, institutionFilter, dateFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResults = useMemo(() => {
      return filteredResults.slice(startIndex, endIndex);
  }, [filteredResults, startIndex, endIndex]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [studentSearch, testFilter, institutionFilter, dateFilter]);

  const handleResultClick = async (r: TestResult) => {
      setLoadingDetails(true);
      setModalTab('details');
      
      try {
           const [testDetails, logData, manualAnswers, attempts] = await Promise.all([
               fetchTestDetails(r.test_id),
               fetchLogs(r.id),
               fetchStudentAnswers(r.id),
               r.student_id ? fetchAttemptLogs(r.test_id, r.student_id) : Promise.resolve([])
           ]);
           
           setLogs(logData);
           setAttemptLogs(attempts);

           if (!testDetails || !testDetails.questions) {
               setSelectedResult(r);
               setLoadingDetails(false);
               return;
           }

           const rawAnswers = r.student_answers as any;

           const reconstructedAnswers = testDetails.questions.map((q, idx) => {
               const qNum = idx + 1;
               
               const manualOverride = manualAnswers.find(ma => ma.question_id === q.id);
               
               let storedData: any = null;

               if (Array.isArray(rawAnswers)) {
                   storedData = rawAnswers.find((a: any) => 
                       a.question_id === q.id || 
                       a.questionId === q.id || 
                       a.number === qNum || 
                       a.question_number === qNum
                   );
               } else if (rawAnswers && typeof rawAnswers === 'object') {
                   const val = rawAnswers[String(qNum)];
                   if (val) storedData = { selectedOptionId: val };
               }
               
               let selectedId = manualOverride?.selected_option_id || storedData?.selected_option_id || storedData?.selectedOptionId;
               let selectedLetter = storedData?.selectedOption || storedData?.selected_option || "-"; 
               
               let selectedContent = "No selection";
               let isCorrect = false;

               // IMPORTANT: Sort options to ensure index 0 corresponds to 'A', 1 to 'B', etc.
               // Added stable sort fallback for options without keys (legacy/broken data)
               const options = [...(q.question_options || [])].sort((a, b) => {
                   const ka = a.key || '';
                   const kb = b.key || '';
                   if (ka && kb) return ka.localeCompare(kb);
                   // Fallback: Use ID to ensure deterministic order if keys are missing
                   return (a.id || '').localeCompare(b.id || '');
               });
               
               const correctOptIndex = options.findIndex(o => o.is_correct);
               const correctLabel = correctOptIndex !== -1 ? (options[correctOptIndex].key || String.fromCharCode(65 + correctOptIndex)) : "?";
               const correctContent = correctOptIndex !== -1 ? options[correctOptIndex].content : "Unknown";

               if (selectedId) {
                   const optIndex = options.findIndex(o => o.id === selectedId);
                   if (optIndex !== -1) {
                       selectedLetter = options[optIndex].key || String.fromCharCode(65 + optIndex);
                       selectedContent = options[optIndex].content;
                       isCorrect = !!options[optIndex].is_correct;
                   }
               } else if (selectedLetter && selectedLetter !== "-") {
                   const cleanLetter = selectedLetter.trim().charAt(0).toUpperCase();
                   
                   const matchingOpt = options.find(o => o.key === cleanLetter);
                   if (matchingOpt) {
                       selectedContent = matchingOpt.content;
                       isCorrect = !!matchingOpt.is_correct;
                       selectedId = matchingOpt.id; 
                   } else {
                       // Fallback logic by index
                       const charCode = cleanLetter.charCodeAt(0);
                       if (charCode >= 65 && charCode <= 90) {
                           const optIndex = charCode - 65;
                           if (options[optIndex]) {
                                selectedContent = options[optIndex].content;
                                isCorrect = !!options[optIndex].is_correct;
                                selectedId = options[optIndex].id;
                           }
                       }
                   }
                   
                   if (selectedContent === "No selection") {
                       selectedContent = `Option ${cleanLetter} (Content not found)`;
                   }
               }

               return {
                   questionId: q.id, 
                   selectedOptionId: selectedId, 
                   number: qNum,
                   questionContent: q.content,
                   questionImage: q.image_url, // ADDED: Map the image URL
                   selectedOption: selectedLetter,
                   selectedOptionContent: selectedContent,
                   correctOption: correctLabel,
                   correctOptionContent: correctContent,
                   isCorrect,
                   allOptions: options,
                   weight: q.weight 
               };
           });

           setSelectedResult({
               ...r,
               student_answers: reconstructedAnswers
           });

      } catch (e) {
          setSelectedResult(r);
      } finally {
          setLoadingDetails(false);
      }
  };

  const handleUpdateAnswer = async (questionId: string, originalOptionId?: string) => {
      if (!selectedResult || !editValue) return;
      setIsUpdating(true);
      try {
          const success = await updateResultAnswer(selectedResult.id, questionId, editValue, originalOptionId);
          if (success) {
              setEditingQuestionId(null);
              await handleResultClick(selectedResult);
          }
      } finally {
          setIsUpdating(false);
      }
  };
  
  useEffect(() => {
    if (modalTab === 'activity' && selectedResult && mapRef.current && !mapInstance.current && window.L && attemptLogs.length > 0) {
       const map = window.L.map(mapRef.current);
       window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
           attribution: '&copy; OpenStreetMap'
       }).addTo(map);

       const validLogs = attemptLogs.filter(l => l.location_lat && l.location_lng);
       
       if (validLogs.length > 0) {
           const latLngs = validLogs.map(l => [l.location_lat, l.location_lng]);
           const bounds = window.L.latLngBounds(latLngs);
           
           validLogs.forEach((l, idx) => {
               const marker = window.L.marker([l.location_lat, l.location_lng]).addTo(map);
               marker.bindPopup(`<b>Attempt #${l.attempt_number}</b><br>${new Date(l.start_time).toLocaleString()}`);
               markersRef.current.push(marker);
           });

           map.fitBounds(bounds, { padding: [50, 50] });
       } else {
           map.setView([51.505, -0.09], 2);
       }
       mapInstance.current = map;
    }

    return () => {
        if (modalTab !== 'activity' && mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
            markersRef.current = [];
        }
    }
  }, [modalTab, selectedResult, attemptLogs]);

  const correctedQuestionIds = new Set(logs.map(l => l.question_id));

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Configure o banco de dados primeiro.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Histórico de Correções</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Revise correções de provas e folhas arquivadas</p>
         </div>
         {userRole && (isIsolatedRole || hasInstitutionContext) && (
             <button 
                onClick={refresh} 
                disabled={loading}
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
             >
                <RotateCcw size={18} className={`${loading ? 'animate-spin' : ''}`} />
                <span>Atualizar Lista</span>
             </button>
         )}
      </div>

      {/* Loading inicial enquanto carrega o role */}
      {loading && !userRole && (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
              <Loader2 size={32} className="mx-auto text-indigo-500 dark:text-indigo-400 animate-spin mb-4"/>
              <p className="text-slate-500 dark:text-slate-400">Carregando...</p>
          </div>
      )}

      {/* Institution Filter - APENAS para Admin (tela isolada para outros roles) */}
      {isAdmin && !institutionId && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contexto da Instituição</label>
              <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                  <select 
                      value={filterInst} 
                      onChange={e => setFilterInst(e.target.value)} 
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                      <option value="">Selecione a Instituição</option>
                      {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
              </div>
          </div>
      )}

      {/* No Institution Selected Message - APENAS para Admin sem filtro */}
      {isAdmin && !hasInstitutionContext && !loading && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
              <Building2 size={48} className="mx-auto text-amber-400 dark:text-amber-500 mb-4"/>
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">Nenhuma Instituição Selecionada</h3>
              <p className="text-amber-600 dark:text-amber-400 text-sm">Selecione uma instituição acima para visualizar o histórico de correções.</p>
          </div>
      )}

      {/* Conteúdo principal - mostra para roles isolados OU admin com contexto */}
      {(isIsolatedRole || (isAdmin && hasInstitutionContext)) && userRole && (
      <>
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
        <div className={`grid grid-cols-1 md:grid-cols-2 ${showInstitutionFilter ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
             <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16}/>
                 <input 
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Buscar Aluno..." 
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all shadow-sm"
                 />
             </div>
             <div className="relative">
                 <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16}/>
                 <select value={testFilter} onChange={e => setTestFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm">
                     <option value="All">Todas as Provas</option>
                     {uniqueTests.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
                 </select>
             </div>
             {showInstitutionFilter && (
                 <div className="relative">
                     <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16}/>
                     <select value={institutionFilter} onChange={e => setInstitutionFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm">
                         <option value="All">Todas as Instituições</option>
                         {uniqueInstitutions.map(i => <option key={i as string} value={i as string}>{i as string}</option>)}
                     </select>
                 </div>
             )}
             <div className="relative">
                 <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full pl-3 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm"/>
             </div>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm relative">
            {loadingDetails && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/80 z-10 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 mb-2" size={40}/>
                    <p className="font-bold text-slate-700 dark:text-slate-200">Carregando detalhes...</p>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="p-5 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Data</th>
                            <th className="p-5 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Aluno</th>
                            <th className="p-5 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Detalhes da Prova</th>
                            <th className="p-5 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Arquivado</th>
                            <th className="p-5 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Nota</th>
                            <th className="p-5 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {loading ? (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin inline mr-2"/> Carregando histórico...</td></tr>
                        ) : filteredResults.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400 dark:text-slate-500">Nenhum resultado encontrado.</td></tr>
                        ) : paginatedResults.map(r => {
                            const correctionCount = r.test_result_correction_logs?.[0]?.count || 0;
                            return (
                                <tr key={r.id} onClick={() => handleResultClick(r)} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer group">
                                    <td className="p-5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Calendar size={16} className="text-slate-400 dark:text-slate-500"/>
                                            <span>{new Date(r.correction_date || '').toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div 
                                          onClick={(e) => { e.stopPropagation(); r.student_id && onViewStudent?.(r.student_id); }}
                                          className={`font-semibold text-slate-800 dark:text-slate-200 ${onViewStudent && r.student_id ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors' : ''}`}
                                        >
                                          {r.student_name}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div 
                                          onClick={(e) => { e.stopPropagation(); r.test_id && onViewTest?.(r.test_id); }}
                                          className={`font-bold text-slate-900 dark:text-slate-100 text-sm ${onViewTest && r.test_id ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors' : ''}`}
                                        >
                                          {r.tests?.title}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.tests?.school_grades?.name || 'Série não atribuída'}</div>
                                    </td>
                                    <td className="p-5">
                                        {r.image_url ? (
                                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded text-xs font-bold border border-emerald-100 dark:border-emerald-800">
                                                <ImageIcon size={14}/> Imagem Salva
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 dark:text-slate-500 italic">Sem Digitalização</div>
                                        )}
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {correctionCount > 0 && (
                                                <div className="text-amber-500 dark:text-amber-400 relative group/icon" title="Manually Corrected">
                                                    <AlertOctagon size={18} className="fill-amber-100 dark:fill-amber-900/30"/>
                                                </div>
                                            )}
                                            <div className={`inline-flex items-center gap-1 text-lg font-bold px-3 py-1 rounded-lg ${r.score >= 70 ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30' : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30'}`}>
                                                {r.score}%
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <button className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 group-hover:opacity-100 opacity-0 transition-all p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                                            <Eye size={18}/>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {filteredResults.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mt-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Items per page selector and info */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">Itens por página:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                      </select>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Mostrando {startIndex + 1} - {Math.min(endIndex, filteredResults.length)} de {filteredResults.length} resultado{filteredResults.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Page navigation */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Página anterior"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === pageNum
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Próxima página"
                    >
                      <ChevronRight size={18} />
                    </button>

                    {/* Jump to page */}
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-300 dark:border-slate-600">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Ir para:</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={currentPage}
                        onChange={(e) => {
                          const page = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                          setCurrentPage(page);
                        }}
                        className="w-16 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">/ {totalPages}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      )}
      </>
      )}

      {selectedResult && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-900">
                      <div>
                          <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">{selectedResult.student_name}</h3>
                          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{selectedResult.tests?.title} ({selectedResult.tests?.school_grades?.name})</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl font-black px-4 py-1 rounded-lg ${selectedResult.score >= 70 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                            {selectedResult.score}%
                        </div>
                        <button 
                            onClick={async () => {
                                setIsRecalculating(true);
                                const success = await recalculateScore(selectedResult.id);
                                if (success) {
                                    await handleResultClick(selectedResult);
                                }
                                setIsRecalculating(false);
                            }}
                            disabled={isRecalculating}
                            className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-full transition-colors text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                            title="Recalcular Nota"
                        >
                            {isRecalculating ? <Loader2 size={20} className="animate-spin"/> : <Calculator size={20}/>}
                        </button>
                        <button onClick={() => setSelectedResult(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24} className="text-slate-500 dark:text-slate-400"/></button>
                      </div>
                  </div>

                  <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
                      <button 
                        onClick={() => setModalTab('details')}
                        className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${modalTab === 'details' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                          <FileText size={16}/> Details & Correction
                      </button>
                      <button 
                        onClick={() => setModalTab('activity')}
                        className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${modalTab === 'activity' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                          <History size={16}/> Activity Logs {attemptLogs.length > 0 && <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full text-xs">{attemptLogs.length}</span>}
                      </button>
                      <button 
                        onClick={() => setModalTab('logs')}
                        className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${modalTab === 'logs' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                          <FileClock size={16}/> Correction Logs {logs.length > 0 && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full text-xs">{logs.length}</span>}
                      </button>
                  </div>
                  
                  {modalTab === 'details' && (
                      <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-3">
                              {logs.length > 0 && (
                                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg flex items-start gap-3 mb-2">
                                      <AlertTriangle className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" size={20} />
                                      <div>
                                          <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Result Manually Modified</h4>
                                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                              {logs.length} answers have been corrected by a human reviewer.
                                          </p>
                                      </div>
                                  </div>
                              )}

                              <h4 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-wider mb-2">Graded Answers (Click Edit to Override)</h4>
                              {selectedResult.student_answers?.map((ans: any, idx) => {
                                 const isManual = correctedQuestionIds.has(ans.questionId);
                                 return (
                                    <div key={idx} className={`flex gap-4 items-start p-3 rounded-xl border transition-all shadow-sm ${ans.isCorrect ? 'border-emerald-100 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/20' : 'border-red-100 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20'} ${isManual ? 'ring-2 ring-amber-300 dark:ring-amber-600' : ''}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 text-xs relative ${ans.isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                            {ans.number}
                                            {isManual && <div className="absolute -top-1 -right-1 bg-amber-500 dark:bg-amber-600 rounded-full p-0.5 border border-white dark:border-slate-800"><AlertOctagon size={10}/></div>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div className="w-full">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 leading-tight">{ans.questionContent}</p>
                                                    {ans.questionImage && (
                                                        <div className="mb-3">
                                                            <img src={ans.questionImage} alt="Question" className="max-h-48 rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white dark:bg-slate-700" />
                                                        </div>
                                                    )}
                                                </div>
                                                {ans.weight && <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded flex items-center gap-1 shrink-0 ml-2"><Scale size={10}/> {Math.round(ans.weight)}%</span>}
                                            </div>
                                            
                                            {editingQuestionId === ans.questionId ? (
                                                <div className="flex gap-2 items-center mt-2 bg-white dark:bg-slate-700 p-2 rounded border border-indigo-200 dark:border-indigo-700">
                                                    <select 
                                                        value={editValue} 
                                                        onChange={e => setEditValue(e.target.value)}
                                                        className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                                    >
                                                        <option value="">Select Option</option>
                                                        {ans.allOptions?.map((o: any, i: number) => (
                                                            <option key={o.id} value={o.id}>
                                                                {o.key || String.fromCharCode(65+i)}: {o.content} {o.is_correct ? '(Correct)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button onClick={() => handleUpdateAnswer(ans.questionId, ans.selectedOptionId)} disabled={isUpdating} className="p-1 bg-indigo-600 dark:bg-indigo-700 text-white rounded hover:bg-indigo-700 dark:hover:bg-indigo-600">
                                                        {isUpdating ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                                                    </button>
                                                    <button onClick={() => setEditingQuestionId(null)} className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"><X size={16}/></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <div className="flex gap-2 items-center text-xs">
                                                            <span className={`px-2 py-0.5 rounded font-bold ${ans.isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                                                                Detected: {ans.selectedOption}
                                                            </span>
                                                            <span className="text-slate-500 dark:text-slate-400 italic">{ans.selectedOptionContent}</span>
                                                        </div>
                                                        {!ans.isCorrect && (
                                                            <div className="flex gap-2 items-center text-xs">
                                                                <span className="px-2 py-0.5 rounded font-bold bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                                    Correct: {ans.correctOption}
                                                                </span>
                                                                <span className="text-slate-500 dark:text-slate-400 italic">{ans.correctOptionContent}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => { setEditingQuestionId(ans.questionId); setEditValue(ans.selectedOptionId || ''); }} className="p-2 text-slate-300 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Manual Correction">
                                                        <Edit2 size={16}/>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                 );
                              })}
                          </div>
                          
                          <div className="space-y-4">
                              <h4 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-wider mb-2">Archived Answer Sheet</h4>
                              {selectedResult.image_url ? (
                                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-inner group relative">
                                      <img src={selectedResult.image_url} className="w-full h-auto max-h-[500px] object-contain" alt="Archived Sheet" />
                                      <a href={selectedResult.image_url} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-3 rounded-full text-indigo-600 dark:text-indigo-400 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110">
                                          <ExternalLink size={20}/>
                                      </a>
                                  </div>
                              ) : (
                                  <div className="h-48 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                      <ImageIcon size={40} className="mb-2 opacity-20"/>
                                      <p className="text-sm">No image available for this record.</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {modalTab === 'activity' && (
                      <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                              <h4 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-wider mb-2 flex items-center gap-2"><MapIcon size={14}/> Test Location</h4>
                              <div ref={mapRef} className="w-full h-64 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner z-0" />
                              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                                  <p className="font-bold mb-1">Geolocation Data</p>
                                  <p>Recorded locations during the test session. Accuracy may vary based on device.</p>
                              </div>
                          </div>
                          <div className="space-y-4">
                              <h4 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-wider mb-2 flex items-center gap-2"><Timer size={14}/> Timeline</h4>
                              {attemptLogs.length === 0 ? (
                                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500">
                                      <History size={32} className="mx-auto mb-2 opacity-30"/>
                                      <p className="text-sm">No digital attempt logs found.</p>
                                  </div>
                              ) : (
                                  <div className="space-y-3">
                                      {attemptLogs.map(log => (
                                          <div key={log.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex flex-col gap-2">
                                              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                                                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Attempt #{log.attempt_number}</span>
                                                  {log.restarted && <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-xs px-2 py-0.5 rounded font-bold">Restarted</span>}
                                              </div>
                                              <div className="grid grid-cols-2 gap-4 text-xs">
                                                  <div>
                                                      <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Start Time</span>
                                                      <span className="font-mono text-slate-700 dark:text-slate-300">{new Date(log.start_time).toLocaleString()}</span>
                                                  </div>
                                                  <div>
                                                      <span className="text-slate-400 dark:text-slate-500 block mb-0.5">End Time</span>
                                                      <span className="font-mono text-slate-700 dark:text-slate-300">{log.end_time ? new Date(log.end_time).toLocaleString() : 'In Progress'}</span>
                                                  </div>
                                              </div>
                                              {log.preliminary_score !== undefined && (
                                                  <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-700 text-right">
                                                      <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">Preliminary Auto-Score:</span>
                                                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{log.preliminary_score}%</span>
                                                  </div>
                                              )}
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {modalTab === 'logs' && (
                      <div className="p-6 overflow-y-auto flex-1">
                          {logs.length === 0 ? (
                              <div className="text-center py-20 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                  <FileClock size={48} className="mx-auto mb-4 opacity-20"/>
                                  <p className="font-medium">No manual corrections recorded.</p>
                                  <p className="text-sm">Changes made by human graders will appear here.</p>
                              </div>
                          ) : (
                              <div className="space-y-4">
                                  {logs.map(log => (
                                      <div key={log.id} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex justify-between items-center">
                                          <div>
                                              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">{log.questions?.content || "Unknown Question"}</p>
                                              <div className="flex gap-3 text-xs">
                                                  <span className="text-red-500 dark:text-red-400 line-through">Old: {log.original_option?.content || 'No Selection'}</span>
                                                  <span className="text-slate-400 dark:text-slate-500">→</span>
                                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">New: {log.new_option?.content}</span>
                                              </div>
                                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{log.reason}</p>
                                          </div>
                                          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                                              <div>{new Date(log.created_at).toLocaleDateString()}</div>
                                              <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default TestResults;
