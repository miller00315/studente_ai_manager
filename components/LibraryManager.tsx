
import React, { useState } from 'react';
import { useLibraryManager } from '../presentation/hooks/useLibraryManager';
import { Library, LibraryItem } from '../types';
import { Book, Plus, Trash2, Loader2, FolderOpen, FileText, Download, Upload, X, File, Image as ImageIcon, Film, Link as LinkIcon, RotateCcw } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { getFriendlyErrorMessage } from '../utils/errorHandling';

interface LibraryManagerProps {
    hasSupabase: boolean;
    gradeId: string;
    gradeName?: string;
    readOnly?: boolean;
}

const LibraryManager: React.FC<LibraryManagerProps> = ({ hasSupabase, gradeId, gradeName, readOnly = false }) => {
    const { 
        libraries, selectedLibraryItems, loading, loadingItems, error, isAdmin, showDeleted, setShowDeleted,
        createLibrary, deleteLibrary, restoreLibrary, fetchItems, uploadItem, deleteItem, restoreItem
    } = useLibraryManager(hasSupabase, gradeId);

    const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(null);
    const [isCreatingLib, setIsCreatingLib] = useState(false);
    
    const [libForm, setLibForm] = useState({ name: '', description: '' });
    
    const [isUploading, setIsUploading] = useState(false);
    const [itemForm, setItemForm] = useState({ title: '', description: '' });
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        id: string | null;
        type: 'library' | 'item';
        action: 'delete' | 'restore';
        name: string;
    }>({ isOpen: false, id: null, type: 'library', action: 'delete', name: '' });
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCreateLib = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!libForm.name) return;
        setIsCreatingLib(true);
        try {
            // Uses gradeId from hook context automatically
            const success = await createLibrary(libForm.name, libForm.description);
            if (success) {
                setLibForm({ name: '', description: '' });
            }
        } finally {
            setIsCreatingLib(false);
        }
    };

    const handleSelectLibrary = (lib: Library) => {
        setSelectedLibrary(lib);
        fetchItems(lib.id);
    };

    const handleUpload = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!file || !itemForm.title || !selectedLibrary) return;
        setIsUploading(true);
        try {
            const success = await uploadItem(selectedLibrary.id, itemForm.title, itemForm.description, file);
            if (success) {
                setItemForm({ title: '', description: '' });
                setFile(null);
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    };

    const openDeleteModal = (id: string, name: string, type: 'library' | 'item') => {
        setModalConfig({ isOpen: true, id, name, type, action: 'delete' });
    };

    const openRestoreModal = (id: string, name: string, type: 'library' | 'item') => {
        setModalConfig({ isOpen: true, id, name, type, action: 'restore' });
    };

    const executeAction = async () => {
        if (!modalConfig.id) return;
        setIsProcessing(true);
        try {
            if (modalConfig.action === 'restore') {
                if (modalConfig.type === 'library') {
                    await restoreLibrary(modalConfig.id);
                } else {
                    if (selectedLibrary) await restoreItem(modalConfig.id, selectedLibrary.id);
                }
            } else {
                if (modalConfig.type === 'library') {
                    await deleteLibrary(modalConfig.id);
                    if (selectedLibrary?.id === modalConfig.id) setSelectedLibrary(null);
                } else {
                    if (selectedLibrary) await deleteItem(modalConfig.id, selectedLibrary.id);
                }
            }
            setModalConfig({ ...modalConfig, isOpen: false });
        } catch (err: any) {
            alert(getFriendlyErrorMessage(err));
        } finally {
            setIsProcessing(false);
        }
    };

    const getFileIcon = (type?: string) => {
        if (!type) return <FileText size={20}/>;
        if (type.startsWith('image/')) return <ImageIcon size={20} className="text-purple-500 dark:text-purple-400"/>;
        if (type.startsWith('video/')) return <Film size={20} className="text-red-500 dark:text-red-400"/>;
        if (type.includes('pdf')) return <FileText size={20} className="text-red-600 dark:text-red-400"/>;
        return <File size={20} className="text-blue-500 dark:text-blue-400"/>;
    };

    // Filter libraries based on showDeleted
    const filteredLibraries = libraries.filter(l => showDeleted || !l.deleted);
    const filteredItems = selectedLibraryItems.filter(i => showDeleted || !i.deleted);

    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                onConfirm={executeAction}
                title={modalConfig.action === 'restore' 
                    ? `Restaurar ${modalConfig.type === 'library' ? 'Biblioteca' : 'Arquivo'}`
                    : `Excluir ${modalConfig.type === 'library' ? 'Biblioteca' : 'Arquivo'}`}
                message={modalConfig.action === 'restore'
                    ? <span>Restaurar <strong>{modalConfig.name}</strong>?</span>
                    : <span>Excluir <strong>{modalConfig.name}</strong>? Esta ação não pode ser desfeita.</span>}
                confirmLabel={modalConfig.action === 'restore' ? 'Restaurar' : 'Excluir'}
                isDestructive={modalConfig.action === 'delete'}
                isLoading={isProcessing}
            />

            {/* Left: Libraries List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Book size={18}/> Bibliotecas</h3>
                    {isAdmin && (
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                            <input 
                                type="checkbox" 
                                checked={showDeleted} 
                                onChange={e => setShowDeleted(e.target.checked)}
                                className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-slate-600 cursor-pointer"
                            />
                            Excluídos
                        </label>
                    )}
                </div>
                
                {!readOnly && (
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <form onSubmit={handleCreateLib} className="space-y-2">
                            {/* Context Indicator */}
                            {gradeName && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-2 py-1.5 rounded border border-slate-100 dark:border-slate-600 flex items-center gap-1.5 mb-2">
                                    <LinkIcon size={10} className="text-indigo-500 dark:text-indigo-400"/>
                                    <span>Série: <span className="font-bold text-slate-700 dark:text-slate-200">{gradeName}</span></span>
                                </div>
                            )}
                            <input 
                                value={libForm.name}
                                onChange={e => setLibForm({...libForm, name: e.target.value})}
                                placeholder="Nome da Biblioteca"
                                className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            />
                            <textarea 
                                value={libForm.description}
                                onChange={e => setLibForm({...libForm, description: e.target.value})}
                                placeholder="Descrição (opcional)"
                                className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-16 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            />
                            <button disabled={isCreatingLib || !libForm.name} className="w-full bg-indigo-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex justify-center shadow-sm">
                                {isCreatingLib ? <Loader2 className="animate-spin" size={16}/> : <><Plus size={16} className="mr-1"/> Criar</>}
                            </button>
                        </form>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
                    {loading ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin inline mr-2"/></div>
                    ) : filteredLibraries.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">Nenhuma biblioteca criada para esta série.</div>
                    ) : filteredLibraries.map(lib => {
                        const isDeleted = lib.deleted === true;
                        return (
                            <div 
                                key={lib.id} 
                                onClick={() => !isDeleted && handleSelectLibrary(lib)}
                                className={`p-3 rounded-lg border transition-all group ${
                                    isDeleted 
                                        ? 'bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800 opacity-60 cursor-not-allowed' 
                                        : selectedLibrary?.id === lib.id 
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500 dark:ring-indigo-400 cursor-pointer' 
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold text-sm ${isDeleted ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>{lib.name}</span>
                                        {isDeleted && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">Excluído</span>
                                        )}
                                    </div>
                                    {!readOnly && (
                                        isDeleted ? (
                                            <button 
                                                onClick={(e) => {e.stopPropagation(); openRestoreModal(lib.id, lib.name, 'library');}} 
                                                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-opacity"
                                                title="Restaurar"
                                            >
                                                <RotateCcw size={14}/>
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={(e) => {e.stopPropagation(); openDeleteModal(lib.id, lib.name, 'library');}} 
                                                className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        )
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{lib.description || "Sem descrição"}</div>
                                <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded w-fit">
                                    {(lib as any).library_items?.[0]?.count || 0} itens
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right: Items Viewer */}
            <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
                {selectedLibrary ? (
                    <>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><FolderOpen size={18} className="text-indigo-600 dark:text-indigo-400"/> {selectedLibrary.name}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Visualizador de Conteúdo</p>
                            </div>
                            <button onClick={() => setSelectedLibrary(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 md:hidden"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingItems ? (
                                <div className="flex justify-center py-20 text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin" size={32}/></div>
                            ) : filteredItems.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
                                    <FolderOpen size={48} className="mx-auto mb-2 opacity-20"/>
                                    <p>Esta biblioteca está vazia.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredItems.map(item => {
                                        const isDeleted = item.deleted === true;
                                        return (
                                            <div key={item.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-all group ${
                                                isDeleted 
                                                    ? 'bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800 opacity-60' 
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600 hover:shadow-sm bg-white dark:bg-slate-800'
                                            }`}>
                                                <div className={`p-3 rounded-lg shrink-0 ${isDeleted ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                                    {getFileIcon(item.file_type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className={`font-bold text-sm truncate ${isDeleted ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>{item.title}</h4>
                                                        {isDeleted && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 shrink-0">Excluído</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.description}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isDeleted ? (
                                                        !readOnly && (
                                                            <button 
                                                                onClick={() => openRestoreModal(item.id, item.title, 'item')}
                                                                className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors font-bold text-xs flex items-center gap-1"
                                                            >
                                                                <RotateCcw size={14}/> Restaurar
                                                            </button>
                                                        )
                                                    ) : (
                                                        <>
                                                            <a 
                                                                href={item.file_url} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-bold text-xs flex items-center gap-1"
                                                            >
                                                                <Download size={14}/> Abrir
                                                            </a>
                                                            {!readOnly && (
                                                                <button 
                                                                    onClick={() => openDeleteModal(item.id, item.title, 'item')}
                                                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {!readOnly && !selectedLibrary.deleted && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2"><Upload size={14}/> Adicionar Arquivo</h4>
                                <form onSubmit={handleUpload} className="flex flex-col gap-3">
                                    <div className="flex gap-3">
                                        <input 
                                            value={itemForm.title}
                                            onChange={e => setItemForm({...itemForm, title: e.target.value})}
                                            placeholder="Título"
                                            className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        />
                                        <input 
                                            value={itemForm.description}
                                            onChange={e => setItemForm({...itemForm, description: e.target.value})}
                                            placeholder="Descrição"
                                            className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        />
                                    </div>
                                    
                                    {/* Drag and Drop Area */}
                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                                            isDragging
                                                ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 scale-[1.02]'
                                                : file
                                                    ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                        onClick={() => document.getElementById('file-input-library')?.click()}
                                    >
                                        {file ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <FileText size={32} className="text-emerald-600 dark:text-emerald-400"/>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{file.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFile(null);
                                                        const input = document.getElementById('file-input-library') as HTMLInputElement;
                                                        if (input) input.value = '';
                                                    }}
                                                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline mt-1"
                                                >
                                                    Remover arquivo
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <Upload size={32} className={`${isDragging ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}/>
                                                <p className={`text-sm font-medium ${isDragging ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {isDragging ? 'Solte o arquivo aqui' : 'Arraste e solte um arquivo ou clique para selecionar'}
                                                </p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500">PDF, imagens, vídeos e outros arquivos</p>
                                            </div>
                                        )}
                                        <input
                                            id="file-input-library"
                                            type="file"
                                            className="hidden"
                                            onChange={e => setFile(e.target.files?.[0] || null)}
                                        />
                                    </div>

                                    <button 
                                        type="submit"
                                        disabled={isUploading || !file || !itemForm.title} 
                                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16}/> Enviando...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={16}/> Upload
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-500">
                        <Book size={64} className="mb-4 opacity-50"/>
                        <p className="font-medium text-slate-400 dark:text-slate-500">Selecione uma biblioteca para ver o conteúdo.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LibraryManager;
