import React, { useState, useEffect } from "react";
import { 
  X, 
  Mail, 
  Globe, 
  Lock, 
  UserPlus, 
  Check, 
  Trash2, 
  Link2, 
  Loader2 
} from "lucide-react";

export default function ShareModal({ 
  isOpen, 
  onClose, 
  documentId, 
  socket, 
  getToken, 
  backendUrl 
}) {
  const [isPublic, setIsPublic] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  // --- Logic Handlers ---

  const handleCopyLink = async () => {
    try {
      const documentLink = `${window.location.origin}/documents/${documentId}`;
      await navigator.clipboard.writeText(documentLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError("Failed to copy link");
    }
  };

  const updatePermissions = async (updates) => {
    try {
      setSaveStatus("saving");
      const token = await getToken();
      const response = await fetch(`${backendUrl}/api/invite/document/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update');
      
      if (socket) {
        socket.emit("permissions-updated", { documentId, updates });
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePublicToggle = () => {
    const nextValue = !isPublic;
    setIsPublic(nextValue);
    updatePermissions({ isPublic: nextValue });
  };

  const handleAddCollaborator = async () => {
    if (!newEmail.trim()) return setError("Enter an email");
    setSaveStatus("sending");
    try {
      const token = await getToken();
      const response = await fetch(`${backendUrl}/api/invite/${documentId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole })
      });

      if (!response.ok) throw new Error("Invite failed");
      const data = await response.json();
      setPendingInvites(prev => [...prev, data.invitation]);
      setNewEmail("");
      setSaveStatus("Invitation sent");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateRole = async (email, role) => {
    const updated = collaborators.map(c => c.email === email ? { ...c, permission: role } : c);
    setCollaborators(updated);
    updatePermissions({ collaborators: updated });
  };

  const handleRemoveCollaborator = async (email) => {
    const updated = collaborators.filter(c => c.email !== email);
    setCollaborators(updated);
    updatePermissions({ collaborators: updated });
  };

  const handleResendInvite = async (inviteId) => {
    setSaveStatus("resending");
    // Implementation for fetch resend...
    setSaveStatus("Resent!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const handleRevokeInvite = async (inviteId) => {
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    setSaveStatus("Revoked");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  useEffect(() => {
    if (isOpen) {
        // Initial fetch logic here...
    }
  }, [isOpen, documentId, backendUrl, getToken]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border dark:border-gray-800 transition-all">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Share Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6">
          {/* Status Bars */}
          {saveStatus && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
              {saveStatus === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{saveStatus}</span>
            </div>
          )}
          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

          {/* General Access Toggle */}
          <button
            onClick={handlePublicToggle}
            className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {isPublic ? <Globe className="w-5 h-5 text-blue-600" /> : <Lock className="w-5 h-5 text-gray-500" />}
              <div className="text-left">
                <p className="text-sm font-medium dark:text-white">{isPublic ? "Public" : "Private"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isPublic ? "Anyone with the link can view" : "Only invited users"}
                </p>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors ${isPublic ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`} />
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {copySuccess ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}
            {copySuccess ? "Copied" : "Copy Link"}
          </button>

          {/* Invite Input */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium dark:text-gray-300">Invite Collaborators</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded-lg text-sm"
                />
              </div>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="px-2 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded-lg text-sm"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            <button
              onClick={handleAddCollaborator}
              className="w-full py-2 bg-docsy-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600"
            >
              <UserPlus className="w-4 h-4 inline mr-2" /> Invite
            </button>
          </div>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Pending</h3>
              {pendingInvites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <span className="text-sm dark:text-gray-300">{invite.email}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleResendInvite(invite.id)} className="p-1 text-blue-500"><Mail className="w-4 h-4" /></button>
                    <button onClick={() => handleRevokeInvite(invite.id)} className="p-1 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Collaborators */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">With Access</h3>
            {collaborators.map(collab => (
              <div key={collab.email} className="flex items-center justify-between p-2">
                <span className="text-sm dark:text-white font-medium">{collab.email}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={collab.permission}
                    onChange={(e) => handleUpdateRole(collab.email, e.target.value)}
                    className="text-xs bg-transparent dark:text-gray-300 focus:outline-none"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button onClick={() => handleRemoveCollaborator(collab.email)} className="text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/20 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}