import { useState, useEffect } from "react"
import { X, Mail, Globe, Lock, UserPlus, Check, Trash2, Link2} from "lucide-react"

export default function ShareModal({ 
  isOpen, 
  onClose, 
  documentId, 
  currentPermissions,
  socket,
  getToken,
  backendUrl 
}) {
  const [isPublic, setIsPublic] = useState(false)
  const [collaborators, setCollaborators] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("viewer")
  const [saveStatus, setSaveStatus] = useState("")
  const [error, setError] = useState("")
  const [copySuccess, setCopySuccess] = useState(false)

  const handleResendInvite = async (inviteId) => {
    try {
      const token = await getToken()
      const response = await fetch(`${backendUrl}/api/invite/${inviteId}/resend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to resend invitation')
      }
      const data = await response.json()
      setSaveStatus('Invitation resent successfully')
      setTimeout(() => setSaveStatus(''), 3000)
      setPendingInvites(prev => prev.map(invite => 
        invite.id === inviteId 
          ? { ...data.invitation, id: data.invitation.id } 
          : invite
      ))

    } catch (err) {
      console.error('Resend invitation error:', err)
      setError(err.message)
    }
  }

  const handleRevokeInvite = async (inviteId) => {
    try {
      const token = await getToken()
      const response = await fetch(`${backendUrl}/api/invite/revoke/${inviteId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to revoke invitation')
      }
      setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId))
      setSaveStatus('Invitation revoked')
      setTimeout(() => setSaveStatus(''), 3000)
      if (socket) {
        socket.emit("invitation-revoked", {
          documentId,
          invitationId: inviteId
        })
      }

    } catch (err) {
      console.error('Revoke invitation error:', err)
      setError(err.message)
    }
  }

  const handleCopyLink = async () => {
    try {
      const documentLink = `${window.location.origin}/documents/${documentId}`
      await navigator.clipboard.writeText(documentLink)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
      setError('Failed to copy link to clipboard')
    }
  }

  useEffect(() => {
    const fetchDocumentData = async () => {
      if (!isOpen || !documentId) return;
      
      try {
        const token = await getToken();
        const inviteResponse = await fetch(`${backendUrl}/api/invite/documents/${documentId}?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!inviteResponse.ok) throw new Error('Failed to fetch invitations');
        
        const inviteData = await inviteResponse.json();
        console.log('📬 All invitations RAW:', JSON.stringify(inviteData, null, 2));
        
        // Log each invitation's details
        (inviteData.invitations || []).forEach((invite, idx) => {
          console.log(`Invitation ${idx}:`, {
            email: invite.email,
            status: invite.status,
            statusType: typeof invite.status,
            role: invite.role,
            id: invite.id || invite._id
          });
        });
        
        // Filter invitations
        const accepted = (inviteData.invitations || []).filter(
          invite => invite.status === 'accepted'
        );
        
        // Get list of emails that have already accepted
        const acceptedEmails = new Set(accepted.map(inv => inv.email.toLowerCase()));
        
        // Only show pending invitations for emails that haven't been accepted yet
        const pending = (inviteData.invitations || []).filter(
          invite => {
            const isPending = invite.status === 'pending';
            const emailNotAccepted = !acceptedEmails.has(invite.email.toLowerCase());
            console.log(`${invite.email}: status="${invite.status}" isPending=${isPending} emailNotAccepted=${emailNotAccepted}`);
            return isPending && emailNotAccepted;
          }
        );
        
        console.log('⏳ Pending invitations:', pending.length, pending.map(i => i.email));
        console.log('✅ Accepted invitations:', accepted.length, accepted.map(i => i.email));
        
        setPendingInvites(pending);
        
        // Build collaborators list from accepted invitations
        const collabList = accepted.map(invite => ({
          email: invite.email,
          permission: invite.role,
          userId: invite.acceptedBy || null
        }));
        setCollaborators(collabList);
        
        // Fetch document public/private status from invitations endpoint
        if (inviteData.document) {
          setIsPublic(inviteData.document.isPublic || false);
        }
        
      } catch (err) {
        console.error('Fetch document data error:', err);
      }
    };

    fetchDocumentData();
  }, [isOpen, documentId, getToken, backendUrl]);

  useEffect(() => {
    const fetchPendingInvites = async () => {
      if (!isOpen) return;
      // Keeping this empty to avoid duplicate fetches
    }

    fetchPendingInvites()
  }, [isOpen, documentId, getToken, backendUrl])

  // Listen for invitation acceptance via socket to refresh lists
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleCollaboratorAdded = async (data) => {
      console.log('🔔 Collaborator added - refreshing lists', data);
      
      // Refetch all invitations to update both pending and accepted lists
      try {
        const token = await getToken();
        const inviteResponse = await fetch(`${backendUrl}/api/invite/documents/${documentId}?t=${Date.now()}`, {
          headers: { 
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (inviteResponse.ok) {
          const inviteData = await inviteResponse.json();
          console.log('📋 Fetched invitations:', inviteData.invitations);
          
          const accepted = (inviteData.invitations || []).filter(
            invite => invite.status === 'accepted'
          );
          
          // Get list of emails that have already accepted
          const acceptedEmails = new Set(accepted.map(inv => inv.email.toLowerCase()));
          
          // Only show pending invitations for emails that haven't been accepted yet
          const pending = (inviteData.invitations || []).filter(
            invite => {
              const isPending = invite.status === 'pending';
              const emailNotAccepted = !acceptedEmails.has(invite.email.toLowerCase());
              console.log(`Checking invite: ${invite.email}, status: ${invite.status}, isPending: ${isPending}, emailNotAccepted: ${emailNotAccepted}`);
              return isPending && emailNotAccepted;
            }
          );
          
          console.log('⏳ Filtered pending:', pending.length);
          console.log('✅ Filtered accepted:', accepted.length);
          
          setPendingInvites(pending);
          
          const collabList = accepted.map(invite => ({
            email: invite.email,
            permission: invite.role,
            userId: invite.acceptedBy || null
          }));
          
          setCollaborators(collabList);
        }
      } catch (err) {
        console.error('Failed to refresh lists:', err);
      }
    };

    socket.on('collaborator-added', handleCollaboratorAdded);

    return () => {
      socket.off('collaborator-added', handleCollaboratorAdded);
    };
  }, [socket, isOpen, documentId, getToken, backendUrl])

  const updatePermissions = async (updates) => {
    try {
      setSaveStatus("saving")
      setError("")
      const token = await getToken()

      console.log('🔄 Updating permissions:', updates);
      console.log('📍 URL:', `${backendUrl}/api/invite/document/${documentId}`);

      const response = await fetch(`${backendUrl}/api/invite/document/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      })

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('❌ Response:', text);
        let errorMessage = 'Failed to update permissions';
        try {
          const data = JSON.parse(text);
          errorMessage = data.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json()
      console.log('✅ Permissions updated:', data);
      
      // Notify other collaborators via socket
      if (socket) {
        socket.emit("permissions-updated", {
          documentId,
          updates
        })
      }
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus(""), 2000) 
      return data
    } catch (err) {
      console.error('❌ Update permissions error:', err)
      setError(err.message)
      setSaveStatus("")
      throw err
    }
  }

  // Toggle public/private
  const handlePublicToggle = async () => {
    const newIsPublic = !isPublic
    setIsPublic(newIsPublic) 
    try {
      await updatePermissions({ isPublic: newIsPublic })
    } catch (err) {
      setIsPublic(!newIsPublic) 
    }
  }

  // Send invitation
  const handleAddCollaborator = async () => {
    if (!newEmail.trim()) {
      setError("Please enter an email address")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setError("Please enter a valid email address")
      return
    }

    if (collaborators.some(c => c.email === newEmail)) {
      setError("This user is already a collaborator")
      return
    }

    setSaveStatus("sending")
    setError("")

    try {
      const token = await getToken()
      const response = await fetch(`${backendUrl}/api/invite/${documentId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          role: newRole
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send invitation')
      }

      const data = await response.json()
      
      setSaveStatus("sent")
      setNewEmail("")
      
      setPendingInvites(prev => [...prev, data.invitation])
      
      const successMessage = `Invitation sent to ${newEmail} (expires in 7 days)`
      setError("")
      setSaveStatus(successMessage)
      
      setTimeout(() => {
        setSaveStatus("")
      }, 3000)

      if (socket) {
        socket.emit("invitation-sent", {
          documentId,
          invitation: data.invitation
        })
      }

    } catch (err) {
      console.error('Send invitation error:', err)
      setError(err.message)
      setSaveStatus("")
    }
  }

  // Update collaborator role
  const handleUpdateRole = async (email, newPermission) => {
    const updatedCollaborators = collaborators.map(c =>
      c.email === email ? { ...c, permission: newPermission } : c
    )
    setCollaborators(updatedCollaborators)

    try {
      await updatePermissions({ collaborators: updatedCollaborators })
    } catch (err) {
      setCollaborators(collaborators) 
    }
  }

  // Remove collaborator
  const handleRemoveCollaborator = async (email) => {
    const updatedCollaborators = collaborators.filter(c => c.email !== email)
    setCollaborators(updatedCollaborators)

    try {
      await updatePermissions({ collaborators: updatedCollaborators })
    } catch (err) {
      setCollaborators(collaborators) 
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border dark:border-gray-800 transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Share Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* General Access Toggle */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">General Access</h3>
            <button
              onClick={handlePublicToggle}
              className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isPublic ? <Globe className="w-5 h-5 text-blue-600" /> : <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{isPublic ? "Public" : "Private"}</p>
                  <p className="text-xs text-gray-500 dark:text-cool-grey">{isPublic ? "Anyone with the link can view" : "Only invited people can access"}</p>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform mt-0.5 ${isPublic ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>

          {/* Invite Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Invite People</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg text-sm"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <button onClick={handleAddCollaborator} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium">
                <UserPlus className="w-4 h-4" /> Send Invitation
              </button>
            </div>
          </div>

          {/* Collaborators List */}
          {collaborators.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">People with access</h3>
              <div className="space-y-2">
                {collaborators.map((collaborator, index) => (
                  <div key={collaborator.email || index} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {collaborator.email?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{collaborator.email}</p>
                        <p className="text-xs text-gray-500 dark:text-cool-grey">{collaborator.permission === 'editor' ? 'Can edit' : 'Can view only'}</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveCollaborator(collaborator.email)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}