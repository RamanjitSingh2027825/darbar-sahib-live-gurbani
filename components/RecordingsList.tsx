import React, { useEffect, useState } from 'react';
import { X, Play, Trash2, Edit2, FileAudio, Pause } from 'lucide-react';
import { Filesystem, Directory, FileInfo } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '../contexts/ThemeContext'; // IMPORT THEME

interface RecordingsListProps {
  onClose: () => void;
  onPlayRecording: (url: string) => void;
  currentPlayingUrl: string | null;
  isPlayerPaused: boolean;
}

const RecordingsList: React.FC<RecordingsListProps> = ({ 
  onClose, 
  onPlayRecording, 
  currentPlayingUrl,
  isPlayerPaused 
}) => {
  const { theme } = useTheme(); // USE THEME
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  useEffect(() => { loadRecordings(); }, []);

  const loadRecordings = async () => {
    try {
      const result = await Filesystem.readdir({ path: '', directory: Directory.Documents });
      setFiles(result.files.filter(f => f.name.endsWith('.webm') || f.name.endsWith('.mp3')).sort((a, b) => (b.mtime || 0) - (a.mtime || 0)));
    } catch (err) { console.error('Error loading files:', err); }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return;
    try { await Filesystem.deleteFile({ path: fileName, directory: Directory.Documents }); loadRecordings(); } 
    catch (err) { console.error('Delete failed:', err); }
  };

  const startRenaming = (file: FileInfo) => { setEditingId(file.name); setRenameText(file.name.replace('.webm', '')); };

  const saveRename = async (oldName: string) => {
    if (!renameText.trim()) { setEditingId(null); return; }
    const newName = `${renameText.trim()}.webm`;
    try { await Filesystem.rename({ from: oldName, to: newName, directory: Directory.Documents }); setEditingId(null); loadRecordings(); } 
    catch (err) { console.error('Rename failed:', err); alert('Could not rename file.'); }
  };

  const handlePlay = async (fileName: string) => {
    try {
        const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Documents });
        onPlayRecording(Capacitor.convertFileSrc(uri.uri));
    } catch (err) { console.error('Error getting file URI:', err); }
  };

  return (
    <div className={`absolute inset-0 z-50 flex flex-col animate-in fade-in duration-200 ${theme.colors.appBg}`}>
      {/* Header */}
      <div className={`p-4 border-b flex justify-between items-center ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
        <h2 className={`text-lg font-medium flex items-center gap-2 ${theme.colors.textMain}`}>
            <FileAudio className={`w-5 h-5 ${theme.colors.accent}`} />
            Saved Recordings
        </h2>
        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${theme.colors.iconBg} ${theme.colors.textSub} ${theme.colors.hover}`}>
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {files.length === 0 ? (
            <div className={`text-center mt-12 ${theme.colors.textSub}`}>
                <p>No recordings found</p>
            </div>
        ) : (
            files.map((file) => (
                <div key={file.name} className={`border rounded-xl p-3 flex items-center justify-between group transition-colors ${theme.colors.cardBg} ${theme.colors.cardBorder}`}>
                    <div className="flex-1 min-w-0 mr-3">
                        {editingId === file.name ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    value={renameText}
                                    onChange={(e) => setRenameText(e.target.value)}
                                    className={`text-sm px-2 py-1 rounded border w-full outline-none ${theme.colors.appBg} ${theme.colors.textMain} ${theme.colors.cardBorder} focus:border-${theme.colors.accent.split('-')[1]}`}
                                    autoFocus
                                />
                                <button onClick={() => saveRename(file.name)} className={`text-xs px-2 py-1 rounded font-medium ${theme.colors.accentBg} text-white`}>
                                    Save
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className={`font-medium truncate text-sm ${theme.colors.textMain}`}>{file.name}</p>
                                <p className={`text-xs mt-0.5 ${theme.colors.textSub}`}>
                                    {(file.size ? (file.size / 1024 / 1024).toFixed(2) : '0')} MB
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {!editingId && (
                            <>
                                <button onClick={() => startRenaming(file)} className={`p-2 transition-colors ${theme.colors.textSub} hover:${theme.colors.accent}`}>
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(file.name)} className={`p-2 transition-colors ${theme.colors.textSub} hover:text-red-400`}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handlePlay(file.name)} className={`ml-1 p-2 rounded-full transition-all ${theme.colors.iconBg} ${theme.colors.accent} ${theme.colors.hover}`}>
                                    <Play className="w-4 h-4 fill-current" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default RecordingsList;