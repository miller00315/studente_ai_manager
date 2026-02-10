
import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { SchoolClass, Discipline, Professor } from '../types';
import { Loader2, Users, BookOpen, User, Building2, GraduationCap, Mail, AlertTriangle, Library as LibraryIcon } from 'lucide-react';
import LibraryManager from './LibraryManager';

interface StudentClassViewerProps {
    hasSupabase: boolean;
}

const StudentClassViewer: React.FC<StudentClassViewerProps> = ({ hasSupabase }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [classData, setClassData] = useState<SchoolClass | null>(null);
    const [disciplines, setDisciplines] = useState<Discipline[]>([]);
    const [classProfessors, setClassProfessors] = useState<Professor[]>([]);

    const supabase = getSupabaseClient();

    useEffect(() => {
        const fetchData = async () => {
            if (!supabase) return;
            setLoading(true);
            try {
                // 1. Get current Student
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Not authenticated");

                const { data: appUser } = await supabase.from('app_users').select('id').eq('auth_id', user.id).single();
                const { data: student } = await supabase.from('students').select('class_id').eq('user_id', appUser?.id).single();

                if (!student || !student.class_id) {
                    setLoading(false);
                    return; // Student has no class assigned
                }

                // 2. Get Class Info with Grade & Institution
                const { data: cls, error: clsError } = await supabase
                    .from('classes')
                    .select('*, school_grades(*), institutions(name)')
                    .eq('id', student.class_id)
                    .single();
                
                if (clsError) throw clsError;
                setClassData(cls);

                // 3. Get Disciplines for this Grade
                // FIX: Removed 'name' from professors selection, rely on app_users
                if (cls.grade_id) {
                    const { data: discs, error: discError } = await supabase
                        .from('disciplines')
                        .select(`
                            *, 
                            professors(
                                id, 
                                app_users(first_name, last_name, email, profile_picture_url)
                            )
                        `)
                        .eq('grade_id', cls.grade_id);
                    
                    if (discError) console.error("Error fetching disciplines:", discError);

                    const mappedDiscs = discs?.map((d: any) => ({
                        ...d,
                        professors: d.professors ? {
                            id: d.professors.id,
                            name: d.professors.app_users ? `${d.professors.app_users.first_name} ${d.professors.app_users.last_name}` : 'Unknown',
                            email: d.professors.app_users?.email,
                            profile_picture_url: d.professors.app_users?.profile_picture_url,
                            app_users: d.professors.app_users
                        } : null
                    })) || [];
                    setDisciplines(mappedDiscs);
                }

                // 4. Get Direct Class Professors (Directors/Advisors)
                // FIX: Added join to departments(name) and app_users
                const { data: classProfs, error: cpError } = await supabase
                    .from('class_professors')
                    .select(`
                        professors(
                            id, 
                            departments(name), 
                            app_users(first_name, last_name, email, profile_picture_url)
                        )
                    `)
                    .eq('class_id', student.class_id);
                
                if (cpError) console.error("Error fetching class professors:", cpError);
                
                if (classProfs) {
                    const mappedProfs = classProfs.map((cp: any) => ({
                        id: cp.professors.id,
                        department: cp.professors.departments?.name || 'General',
                        name: cp.professors.app_users ? `${cp.professors.app_users.first_name} ${cp.professors.app_users.last_name}` : 'Unknown',
                        email: cp.professors.app_users?.email,
                        app_users: cp.professors.app_users
                    }));
                    setClassProfessors(mappedProfs as any);
                }

            } catch (err: any) {
                console.error("Error fetching class info:", err);
                setError(err.message || "Failed to load class information.");
            } finally {
                setLoading(false);
            }
        };

        if (hasSupabase) fetchData();
    }, [hasSupabase]);

    if (!hasSupabase) return <div className="p-8 text-center text-slate-500">Connecting to school database...</div>;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="animate-spin mb-4 text-indigo-500" size={40}/>
                <p>Loading class schedule...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-2xl mx-auto mt-8">
                <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
                <h3 className="text-lg font-bold text-red-700 mb-2">Error Loading Class Data</h3>
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    if (!classData) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 m-4">
                <Users size={48} className="mb-4 opacity-20"/>
                <h3 className="text-lg font-bold text-slate-600">No Class Assigned</h3>
                <p>You haven't been assigned to a class yet.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header Card */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Users size={200}/>
                </div>
                <div>
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase mb-4 tracking-wider">
                        <GraduationCap size={12}/> Academic Year {new Date().getFullYear()}
                    </span>
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">{classData.name}</h1>
                    <div className="flex items-center gap-6 text-slate-600 mt-4">
                        <div className="flex items-center gap-2">
                            <Building2 size={18} className="text-slate-400"/>
                            <span className="font-medium">{classData.institutions?.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <BookOpen size={18} className="text-slate-400"/>
                            <span className="font-medium">{classData.school_grades?.name} Grade</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Libraries Section */}
            {classData.grade_id && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-4">
                        <LibraryIcon size={20} className="text-indigo-600"/>
                        Grade Libraries & Resources
                    </h3>
                    <LibraryManager 
                        hasSupabase={hasSupabase} 
                        gradeId={classData.grade_id} 
                        gradeName={classData.school_grades?.name} 
                        readOnly={true} 
                    />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Disciplines */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <BookOpen size={20} className="text-indigo-600"/> 
                        My Subjects & Teachers
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {disciplines.length === 0 ? (
                            <div className="col-span-full p-8 text-center bg-white border border-dashed border-slate-200 rounded-xl text-slate-400">
                                No subjects defined for this grade.
                            </div>
                        ) : disciplines.map(d => (
                            <div key={d.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="font-bold text-slate-800 text-lg">{d.name}</div>
                                    <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
                                        <BookOpen size={16}/>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-50">
                                    <div className="text-xs text-slate-400 font-bold uppercase mb-2">Professor</div>
                                    {d.professors ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 border border-slate-200">
                                                {(d.professors as any).profile_picture_url ? (
                                                    <img src={(d.professors as any).profile_picture_url} alt="Prof" className="w-full h-full object-cover"/>
                                                ) : (
                                                    <User size={14}/>
                                                )}
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="font-medium text-slate-700 text-sm truncate">{d.professors.name}</div>
                                                <div className="text-xs text-slate-400 truncate">{d.professors.email || 'No email'}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-slate-400 italic">Not Assigned</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar: Class Directors / Info */}
                <div className="space-y-6">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Users size={20} className="text-indigo-600"/> 
                        Class Faculty
                    </h3>
                    
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                            Class Directors / Advisors
                        </div>
                        <div className="divide-y divide-slate-100">
                            {classProfessors.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-sm">No specific directors assigned.</div>
                            ) : classProfessors.map(p => (
                                <div key={p.id} className="p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                                        {p.app_users?.profile_picture_url ? (
                                            <img src={p.app_users.profile_picture_url} alt="Prof" className="w-full h-full object-cover"/>
                                        ) : (
                                            <User size={18}/>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.department}</div>
                                        <div className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1"><Mail size={10}/> {p.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-slate-500 text-sm">
                        <p className="font-medium text-slate-700 mb-2">Student Notice</p>
                        <p>This information is read-only. If you notice any discrepancies in your class assignment or subjects, please contact the school administration office.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentClassViewer;
