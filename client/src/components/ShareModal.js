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
  const [isLoading, setIsLoading] = useState(false);

  // --- Data Fetching ---
  useEffect(() => {
    if (isOpen && documentId) {
      const fetchSharingData = async () => {
        setIsLoading(true);
        setError("");
        try {
          const token = await getToken();
          const response = await fetch(`${backendUrl}/api/invite/document/${documentId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            throw new Error('Failed to fetch sharing data');
          }
          
          const data = await response.json();
          console.log('API Response:', data); // Debug log
          
          // Set public status from document object
          setIsPublic(data.document?.isPublic || false);
          
          // Filter invitations by status
          const allInvitations = data.invitations || [];
          
          // Pending invitations (not accepted, not revoked, not expired)
          const pending = allInvitations.filter(inv => 
            inv.status === 'pending' && new Date(inv.expiresAt) > new Date()
          );
          
          // Accepted invitations become collaborators
          const accepted = allInvitations.filter(inv => 
            inv.status === 'accepted'
          ).map(inv => ({
            email: inv.email,
            permission: inv.role,
            id: inv.id
          }));
          
          setPendingInvites(pending);
          setCollaborators(accepted);
          
          console.log('Pending:', pending); // Debug log
          console.log('Collaborators:', accepted); // Debug log
        } catch (err) {
          console.error('Error fetching sharing data:', err);
          setError("Failed to load sharing settings");
        } finally {
          setIsLoading(false);
        }
      };

      fetchSharingData();
    }
  }, [isOpen, documentId, backendUrl, getToken]);

  // --- Logic Handlers ---

  const handleCopyLink = async () => {
    try {
      const documentLink = `${window.location.origin}/document/${documentId}`;
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update permissions');
      }
      
      if (socket) {
        socket.emit("permissions-updated", { documentId, updates });
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error('Error updating permissions:', err);
      setError(err.message);
      setSaveStatus("");
    }
  };

  const handlePublicToggle = () => {
    const nextValue = !isPublic;
    setIsPublic(nextValue);
    updatePermissions({ isPublic: nextValue });
  };

  const handleAddCollaborator = async () => {
    if (!newEmail.trim()) {
      setError("Please enter an email address");
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setSaveStatus("sending");
    setError("");
    
    try {
      const token = await getToken();
      const response = await fetch(`${backendUrl}/api/invite/document/${documentId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to send invitation");
      }
      
      const data = await response.json();
      // Add the new invitation to pending invites
      setPendingInvites(prev => [...prev, data.invitation || data]);
      setNewEmail("");
      setNewRole("viewer");
      setSaveStatus("Invitation sent");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      console.error('Error sending invitation:', err);
      setError(err.message);
      setSaveStatus("");
    }
  };

  const handleUpdateRole = async (email, role) => {
    const updated = collaborators.map(c => 
      c.email === email ? { ...c, permission: role } : c
    );
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
    setError("");
    
    try {
      const token = await getToken();
      const response = await fetch(`${backendUrl}/api/invite/${inviteId}/resend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to resend invitation");
      }
      
      setSaveStatus("Invitation resent");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error('Error resending invitation:', err);
      setError(err.message);
      setSaveStatus("");
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    setError("");
    
    try {
      const token = await getToken();
      const response = await fetch(`${backendUrl}/api/invite/${inviteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to revoke invitation");
      }
      
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
      setSaveStatus("Invitation revoked");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error('Error revoking invitation:', err);
      setError(err.message);
    }
  };

  // Handle Enter key in email input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddCollaborator();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border dark:border-gray-800 transition-all">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Share Document</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          )}

          {!isLoading && (
            <>
              {/* Status Bars */}
              {saveStatus && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                  {saveStatus === "saving" || saveStatus === "sending" || saveStatus === "resending" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{saveStatus}</span>
                </div>
              )}
              
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              {/* General Access Toggle */}
              <div>
                <h3 className="text-sm font-medium dark:text-gray-300 mb-2">General Access</h3>
                <button
                  onClick={handlePublicToggle}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <Globe className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium dark:text-white">
                        {isPublic ? "Public" : "Private"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isPublic ? "Anyone with the link can view" : "Only invited users"}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${
                    isPublic ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      isPublic ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                </button>
              </div>

              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {copySuccess ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {copySuccess ? "Link Copied!" : "Copy Link"}
              </button>

              {/* Invite Input */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium dark:text-gray-300">Invite Collaborators</h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Email address"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                    />
                  </div>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>
                <button
                  onClick={handleAddCollaborator}
                  disabled={!newEmail.trim()}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Send Invitation
                </button>
              </div>

              {/* Pending Invites */}
              {pendingInvites.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">
                    Pending Invitations
                  </h3>
                  {pendingInvites.map(invite => (
                    <div 
                      key={invite.id} 
                      className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Mail className="w-4 h-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                        <span className="text-sm dark:text-gray-300 truncate">{invite.email}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          ({invite.role})
                        </span>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button 
                          onClick={() => handleResendInvite(invite.id)} 
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Resend invitation"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleRevokeInvite(invite.id)} 
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Revoke invitation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Collaborators */}
              {collaborators.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">
                    People with Access
                  </h3>
                  {collaborators.map(collab => (
                    <div 
                      key={collab.email} 
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <span className="text-sm dark:text-white font-medium truncate flex-1 min-w-0">
                        {collab.email}
                      </span>
                      <div className="flex items-center gap-2 ml-2">
                        <select
                          value={collab.permission}
                          onChange={(e) => handleUpdateRole(collab.email, e.target.value)}
                          className="text-xs px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button 
                          onClick={() => handleRemoveCollaborator(collab.email)} 
                          className="text-red-600 dark:text-red-400 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Remove access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Lock className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No collaborators yet. Invite someone to get started!
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/20 flex justify-end">
          <button 
            onClick={onClose} 
            className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}