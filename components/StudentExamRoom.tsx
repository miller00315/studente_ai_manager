
import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { Test, Student } from '../types';
import { Loader2, Clock, ChevronRight, ChevronLeft, Send, CheckCircle } from 'lucide-react';

interface StudentExamRoomProps {
    releaseId: string;
    testId: string;
    studentId: string;
    onComplete: () => void;
    onExit: () => void;
}

const StudentExamRoom: React.FC<StudentExamRoomProps> = ({ releaseId, testId, studentId, onComplete, onExit }) => {
    const [test, setTest] = useState<Test | null>(null);
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Exam State
    const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
    const [currentQIndex, setCurrentQIndex] = useState(0);

    const supabase = getSupabaseClient();

    // 1. Fetch Full Test Content (Questions & Options)
    useEffect(() => {
        const initExam = async () => {
            if (!supabase) return;
            try {
                // Fetch Student Info for name/hash
                const { data: stuData } = await supabase.from('students').select('*, app_users(first_name, last_name)').eq('id', studentId).single();
                setStudent({
                    ...stuData,
                    name: stuData.app_users ? `${stuData.app_users.first_name} ${stuData.app_users.last_name}` : 'Student'
                });

                // Fetch Test with Questions manually to ensure deep depth
                const { data: testData, error } = await supabase
                    .from('tests')
                    .select(`
                        *, 
                        test_questions(
                            weight, order_index,
                            questions(
                                id, content, difficulty, image_url, deleted,
                                question_options(id, content, key, is_correct)
                            )
                        )
                    `)
                    .eq('id', testId)
                    .single();

                if (error) throw error;

                // Flatten, filter deleted, and sort questions
                const questions = testData.test_questions?.map((tq: any) => ({
                    ...tq.questions,
                    weight: tq.weight,
                    question_options: tq.questions.question_options.sort((a: any, b: any) => (a.key || '').localeCompare(b.key || ''))
                }))
                .filter((q: any) => !q.deleted) // <--- CRITICAL FILTER FOR ACCURATE SCORING
                .sort((a: any, b: any) => a.order_index - b.order_index);

                setTest({ ...testData, questions } as Test);

            } catch (e) {
                alert("Erro ao carregar dados da prova. Por favor, contate o aplicador.");
                onExit();
            } finally {
                setLoading(false);
            }
        };
        initExam();
    }, [testId, studentId, supabase]);

    const handleSelectOption = (questionId: string, optionId: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const calculateScore = () => {
        if (!test || !test.questions) return { score: 0, correctCount: 0, errorCount: 0, gradedAnswers: [] };

        const totalQuestions = test.questions.length;
        let correctCount = 0;

        const gradedAnswers = test.questions.map((q, idx) => {
            const selectedOptId = answers[q.id];
            // Encontra a opção correta (is_correct = true)
            const correctOpt = q.question_options?.find(o => o.is_correct);
            // Encontra a opção selecionada pelo estudante
            const selectedOpt = q.question_options?.find(o => o.id === selectedOptId);
            
            // Compara diretamente os IDs: selecionado === correto
            const isCorrect = selectedOptId != null && selectedOptId === correctOpt?.id;
            
            if (isCorrect) {
                correctCount++;
            }

            return {
                number: idx + 1,
                questionId: q.id,
                questionContent: q.content,
                selectedOption: selectedOpt?.key || '-',
                selectedOptionId: selectedOptId || null,
                correctOption: correctOpt?.key || '?',
                correctOptionId: correctOpt?.id || null,
                isCorrect
            };
        });

        // Nota simples: (acertos / total) * 100
        const errorCount = totalQuestions - correctCount;
        const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

        return { score, correctCount, errorCount, gradedAnswers };
    };

    const handleSubmit = async () => {
        if (!window.confirm("Tem certeza de que deseja finalizar a prova? Esta ação não pode ser desfeita.")) return;
        if (!test || !student || !supabase) return;

        setSubmitting(true);
        try {
            const { score, correctCount, errorCount, gradedAnswers } = calculateScore();

            // 1. Create Test Result Header
            const { data: resultData, error: rError } = await supabase.from('test_results').insert({
                test_id: test.id,
                student_id: student.id,
                test_release_id: releaseId,
                student_name: student.name || 'Student',
                student_hash: student.student_hash,
                score: score,
                correct_count: correctCount,
                error_count: errorCount,
                correction_date: new Date().toISOString()
            }).select().single();

            if (rError) throw rError;

            // 2. Create Answer Details
            const answerPayload = gradedAnswers.map(ans => ({
                test_result_id: resultData.id,
                question_id: ans.questionId,
                selected_option_id: ans.selectedOptionId,
                is_correct: ans.isCorrect
            }));

            const { error: aError } = await supabase.from('student_test_answers').insert(answerPayload);
            if (aError) throw aError;

            // 3. Log Attempt
            await supabase.from('test_attempt_logs').insert({
                test_release_id: releaseId,
                attempt_number: 1, 
                start_time: new Date().toISOString(), 
                end_time: new Date().toISOString(),
                preliminary_score: score
            });

            alert(`Prova Enviada!\nSua Nota: ${score}%`);
            onComplete();

        } catch (e: any) {
            alert("Falha ao enviar prova: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !test) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={48}/>
                <h2 className="text-xl font-bold text-slate-700">Carregando Material da Prova...</h2>
                <p className="text-slate-500">Por favor aguarde enquanto preparamos seu ambiente.</p>
            </div>
        );
    }

    const currentQuestion = test.questions ? test.questions[currentQIndex] : null;
    const progress = Math.round(((Object.keys(answers).length) / (test.questions?.length || 1)) * 100);

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
            {/* Exam Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 md:px-6 md:py-4 flex justify-between items-center shrink-0 shadow-sm z-10">
                <div className="flex-1 min-w-0 mr-4">
                    <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">{test.title}</h1>
                    <p className="text-xs md:text-sm text-slate-500">Questão {currentQIndex + 1} de {test.questions?.length}</p>
                </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    <div className="bg-slate-100 px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-2 text-slate-600 font-mono text-xs md:text-sm border border-slate-200">
                        <Clock size={16}/> <span className="hidden md:inline">Sem Limite</span>
                    </div>
                    <div className="w-20 md:w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Question Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-12 w-full flex justify-center">
                <div className="max-w-4xl w-full">
                    {currentQuestion && (
                        <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300" key={currentQuestion.id}>
                            {currentQuestion.image_url && (
                                            <img src={currentQuestion.image_url} alt="Referência da Questão" className="max-h-[300px] w-auto max-w-full object-contain rounded-lg border border-slate-100 mx-auto" />
                            )}
                            
                            <h2 className="text-lg md:text-2xl font-medium text-slate-900 leading-relaxed">{currentQuestion.content}</h2>

                            <div className="space-y-3">
                                {currentQuestion.question_options?.map(opt => (
                                    <label 
                                        key={opt.id} 
                                        className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[currentQuestion.id] === opt.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${answers[currentQuestion.id] === opt.id ? 'border-indigo-600' : 'border-slate-300'}`}>
                                            {answers[currentQuestion.id] === opt.id && <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-indigo-600 rounded-full"/>}
                                        </div>
                                        <span className="text-base md:text-lg font-bold text-slate-400 w-5 md:w-6">{opt.key}</span>
                                        <span className="text-sm md:text-base text-slate-800 font-medium">{opt.content}</span>
                                        <input 
                                            type="radio" 
                                            name={currentQuestion.id} 
                                            value={opt.id} 
                                            checked={answers[currentQuestion.id] === opt.id}
                                            onChange={() => handleSelectOption(currentQuestion.id, opt.id || '')}
                                            className="hidden"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="bg-white border-t border-slate-200 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center shrink-0">
                <button 
                    onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQIndex === 0}
                    className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-sm md:text-base text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft size={18} className="md:w-5 md:h-5"/> <span className="hidden md:inline">Anterior</span>
                </button>

                <div className="flex gap-2">
                    {test.questions && currentQIndex < test.questions.length - 1 ? (
                        <button 
                            onClick={() => setCurrentQIndex(prev => Math.min(test.questions!.length - 1, prev + 1))}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold text-sm md:text-base flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
                        >
                            Próxima <span className="hidden md:inline">Questão</span> <ChevronRight size={18} className="md:w-5 md:h-5"/>
                        </button>
                    ) : (
                        <button 
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 md:px-8 py-2 md:py-2.5 rounded-xl font-bold text-sm md:text-base flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all disabled:opacity-70"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>} 
                            Finalizar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentExamRoom;
