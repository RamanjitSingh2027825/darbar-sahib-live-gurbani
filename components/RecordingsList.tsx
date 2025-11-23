import React, { useEffect, useState } from 'react';
import { X, Play, Trash2, Edit2, FileAudio, Pause } from 'lucide-react';
import { Filesystem, Directory, FileInfo } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

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
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const result = await Filesystem.readdir({
        path: '',
        directory: Directory.Documents
      });
      // Filter for audio files only
      const audioFiles = result.files.filter(f => f.name.endsWith('.webm') || f.name.endsWith('.mp3'));
      // Sort by newest first (if stats available) or name
      setFiles(audioFiles.sort((a, b) => (b.mtime || 0) - (a.mtime || 0)));
    } catch (err) {
      console.error('Error loading files:', err);
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return;
    
    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Documents
      });
      loadRecordings();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const startRenaming = (file: FileInfo) => {
    setEditingId(file.name);
    setRenameText(file.name.replace('.webm', ''));
  };

  const saveRename = async (oldName: string) => {
    if (!renameText.trim()) {
        setEditingId(null);
        return;
    }
    
    const newName = `${renameText.trim()}.webm`;
    
    try {
      await Filesystem.rename({
        from: oldName,
        to: newName,
        directory: Directory.Documents
      });
      setEditingId(null);
      loadRecordings();
    } catch (err) {
      console.error('Rename failed:', err);
      alert('Could not rename file. Name might be taken.');
    }
  };

  const handlePlay = async (fileName: string) => {
    try {
        const uri = await Filesystem.getUri({
            path: fileName,
            directory: Directory.Documents
        });
        // Convert native file path to webview-accessible path
        const src = Capacitor.convertFileSrc(uri.uri);
        onPlayRecording(src);
    } catch (err) {
        console.error('Error getting file URI:', err);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h2 className="text-lg font-medium text-slate-200 flex items-center gap-2">
            <FileAudio className="w-5 h-5 text-amber-400" />
            Saved Recordings
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {files.length === 0 ? (
            <div className="text-center text-slate-500 mt-12">
                <p>No recordings found</p>
            </div>
        ) : (
            files.map((file) => (
                <div key={file.name} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between group">
                    <div className="flex-1 min-w-0 mr-3">
                        {editingId === file.name ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    value={renameText}
                                    onChange={(e) => setRenameText(e.target.value)}
                                    className="bg-slate-800 text-slate-200 text-sm px-2 py-1 rounded border border-slate-700 w-full focus:border-amber-500 outline-none"
                                    autoFocus
                                />
                                <button 
                                    onClick={() => saveRename(file.name)}
                                    className="text-xs bg-amber-500 text-slate-950 px-2 py-1 rounded font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-slate-200 font-medium truncate text-sm">{file.name}</p>
                                <p className="text-slate-500 text-xs mt-0.5">
                                    {(file.size ? (file.size / 1024 / 1024).toFixed(2) : '0')} MB
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {!editingId && (
                            <>
                                <button 
                                    onClick={() => startRenaming(file)}
                                    className="p-2 text-slate-500 hover:text-amber-400 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleDelete(file.name)}
                                    className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handlePlay(file.name)}
                                    className="ml-1 p-2 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 rounded-full transition-all"
                                >
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