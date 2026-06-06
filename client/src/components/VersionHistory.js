import React, { useState, useEffect } from 'react';
import { History, X, Clock, User, FileText, RotateCcw, AlertTriangle, Sparkles } from 'lucide-react';

// Formatter for dates
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function VersionHistory({ isOpen, onClose, documentId, getToken, backendUrl, onRestore, userRole }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchVersions();
      setShowCreateForm(false);
      setCustomLabel('');
    }
  }, [isOpen, documentId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await getToken();
      const res = await fetch(`${backendUrl}/api/documents/${documentId}/versions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch versions');
      const data = await res.json();
      setVersions(data.versions || []);
    } catch (err) {
      console.error(err);
      setError('Could not load version history.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (e) => {
    e.preventDefault();
    if (!customLabel.trim()) return;

    try {
      setIsCreating(true);
      const token = await getToken();
      const res = await fetch(`${backendUrl}/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ label: customLabel.trim(), triggerSource: 'manual' })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create version');
      }

      setCustomLabel('');
      setShowCreateForm(false);
      
      // Wait a moment for BullMQ to process the job before refreshing
      setTimeout(() => {
        fetchVersions();
      }, 1000);
      
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" 
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed top-0 right-0 w-80 h-full bg-white dark:bg-[#1A1A1A] shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-800 transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 text-slate-ink dark:text-white">
            <History className="w-5 h-5 text-docsy-blue" />
            <h2 className="font-semibold text-lg">Version History</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-muted-text dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Manual Version (Only for editors/owners) */}
        {(userRole === 'owner' || userRole === 'editor') && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1E1E1E]">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full py-2 px-3 bg-white dark:bg-[#2D2D2D] border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-slate-ink dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors"
              >
                + Save current state
              </button>
            ) : (
              <form onSubmit={handleCreateVersion} className="flex flex-col gap-2">
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Version name (e.g., Final Draft)"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-[#2D2D2D] text-slate-ink dark:text-white focus:outline-none focus:border-docsy-blue"
                  autoFocus
                  maxLength={50}
                  disabled={isCreating}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isCreating || !customLabel.trim()}
                    className="flex-1 py-1.5 bg-docsy-blue text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                  >
                    {isCreating ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    disabled={isCreating}
                    className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-docsy-blue border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-text dark:text-gray-400">
              <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No versions saved yet.</p>
            </div>
          ) : (
            versions.map((version) => (
              <div 
                key={version._id} 
                className="p-3 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-docsy-blue/50 dark:hover:border-blue-500/50 transition-colors bg-white dark:bg-[#1E1E1E] group"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-slate-ink dark:text-white text-sm">
                    {version.label || `Version ${version.versionNumber}`}
                  </div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 capitalize flex items-center gap-1">
                    {version.triggerSource === 'periodic' && <Clock className="w-3 h-3" />}
                    {version.triggerSource === 'manual' && <FileText className="w-3 h-3" />}
                    {version.triggerSource === 'ai-edit' && <Sparkles className="w-3 h-3" />}
                    {version.triggerSource === 'restore' && <RotateCcw className="w-3 h-3" />}
                    {version.triggerSource}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 text-xs text-muted-text dark:text-gray-400 mb-3">
                  <User className="w-3 h-3" />
                  <span className="truncate">{version.createdBy?.name || 'Unknown'}</span>
                  <span>•</span>
                  <span>{formatDate(version.createdAt)}</span>
                </div>

                {(userRole === 'owner' || userRole === 'editor') && (
                  <button
                    onClick={() => onRestore(version._id, version.versionNumber)}
                    className="w-full flex justify-center items-center gap-1 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-docsy-blue dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore this version
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
