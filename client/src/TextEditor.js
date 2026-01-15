import { useCallback, useEffect, useState, useRef } from "react"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import { io } from "socket.io-client"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth, useUser } from '@clerk/clerk-react'
import { Share2, Globe, Lock, Users, Crown, Eye, Keyboard } from "lucide-react"
import ShareModal from "./components/ShareModal"
import { useTheme } from './context/ThemeContext'; 
import { Sun, Moon } from "lucide-react";

const SAVE_INTERVAL_MS = 2000
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
]

// Utility to generate initials from name
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Utility to generate avatar color from email
function getAvatarColor(email) {
  const colors = ['#3A86FF', '#6EEB83', '#FFBE0B', '#FF595E', '#ADB5BD', '#8B5CF6', '#EC4899', '#10B981'];
  if (!email) return colors[0];
  const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Utility to format relative time
function getRelativeTime(timestamp) {
  if (!timestamp) return '';
  
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs} seconds ago`;
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return then.toLocaleDateString();
}

function KeyboardShortcutsTooltip({ isOpen, onClose }) {
  if (!isOpen) return null;
  
  const shortcuts = [
    { keys: 'Ctrl/Cmd + B', action: 'Bold' },
    { keys: 'Ctrl/Cmd + I', action: 'Italic' },
    { keys: 'Ctrl/Cmd + U', action: 'Underline' },
    { keys: 'Ctrl/Cmd + Z', action: 'Undo' },
    { keys: 'Ctrl/Cmd + Y', action: 'Redo' },
    { keys: 'Ctrl/Cmd + K', action: 'Insert Link' },
    { keys: 'Ctrl/Cmd + Shift + 7', action: 'Numbered List' },
    { keys: 'Ctrl/Cmd + Shift + 8', action: 'Bullet List' },
  ];
  
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-[#1A1A1A] rounded-xl shadow-2xl p-6 z-50 w-full max-w-md border dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-ink dark:text-white">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="text-muted-text hover:text-slate-ink dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-sm text-slate-ink dark:text-gray-300">{shortcut.action}</span>
              <kbd className="px-2 py-1 bg-input-field dark:bg-gray-800 text-muted-text dark:text-cool-grey text-xs rounded font-mono border dark:border-gray-700">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CollaboratorAvatar({ collaborator, index, isOnline = false }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const initials = getInitials(collaborator.name || collaborator.email)
  const color = getAvatarColor(collaborator.email)
  
  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: 10 - index }}
    >
      <div className="relative">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white dark:ring-[#1A1A1A] cursor-pointer hover:scale-110 transition-transform"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        <div 
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#1A1A1A] ${
            isOnline ? 'bg-soft-green' : 'bg-cool-grey'
          }`}
        />
      </div>
      
      {showTooltip && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-ink dark:bg-gray-800 text-white px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg z-50 border dark:border-gray-700">
          <div>{collaborator.name || collaborator.email}</div>
          <div className="text-gray-300 capitalize">
            {isOnline ? `${collaborator.permission === 'editor' ? 'Editing' : 'Viewing'}` : 'Offline'}
          </div>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-ink dark:bg-gray-800 rotate-45 border-l border-t dark:border-gray-700"></div>
        </div>
      )}
    </div>
  )
}

function CollaboratorAvatars({ collaborators, onlineUsers = [] }) {
  const maxVisible = 4
  const visibleCollaborators = collaborators.slice(0, maxVisible)
  const remaining = Math.max(0, collaborators.length - maxVisible)
  
  if (collaborators.length === 0) return null
  
  return (
    <div className="flex items-center">
      {visibleCollaborators.map((collab, index) => {
        const isOnline = onlineUsers.some(u => 
          u.email?.toLowerCase() === collab.email?.toLowerCase() ||
          u.userId === collab.id
        );
        return (
          <CollaboratorAvatar 
            key={collab.id || collab.email} 
            collaborator={collab} 
            index={index}
            isOnline={isOnline}
          />
        );
      })}
      {remaining > 0 && (
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-cool-grey text-white ring-2 ring-white"
          style={{ marginLeft: '-8px', zIndex: 10 - maxVisible }}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}

function StatusPill({ userRole, isPublic }) {
  const getStatusConfig = () => {
    if (userRole === 'owner') {
      return {
        icon: Crown,
        label: 'Owner',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        textColor: 'text-soft-green dark:text-green-400',
        iconColor: 'text-soft-green'
      }
    }
    if (userRole === 'viewer') {
      return {
        icon: Eye,
        label: 'View only',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-muted-text dark:text-cool-grey',
        iconColor: 'text-muted-text'
      }
    }
    if (userRole === 'editor') {
      return {
        icon: Users,
        label: 'Editor',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        textColor: 'text-docsy-blue dark:text-blue-400',
        iconColor: 'text-docsy-blue'
      }
    }
    return null
  }
  
  const config = getStatusConfig()
  if (!config) return null
  
  const Icon = config.icon
  
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 ${config.bgColor} rounded-full`}>
        <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
        <span className={`text-xs font-medium ${config.textColor}`}>
          {config.label}
        </span>
      </div>
      
      {isPublic && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
          <Globe className="w-3.5 h-3.5 text-docsy-blue" />
          <span className="text-xs font-medium text-docsy-blue dark:text-blue-400">Public</span>
        </div>
      )}
    </div>
  )
}

export default function TextEditor() {
  const { getToken, isSignedIn } = useAuth();
  const { id: documentId } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [title, setTitle] = useState("Untitled Document");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [lastSaved, setLastSaved] = useState(null);
  const titleTimeoutRef = useRef(null);
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();
  const socketRef = useRef(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [permissions, setPermissions] = useState({
    isPublic: false,
    collaborators: [],
    isOwner: false
  });
  const [userRole, setUserRole] = useState(null); 
  const [isPublicDoc, setIsPublicDoc] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

  const handleSignInRedirect = () => {
    navigate('/auth');
  };

  // Fetch collaborators from document schema
  const fetchCollaborators = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${backendUrl}/api/documents/${documentId}/collaborators`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Map collaborators from document schema
        const collaboratorsList = (data.collaborators || []).map(collab => ({
          id: collab.id,
          email: collab.email,
          name: collab.name || collab.email.split('@')[0],
          permission: collab.permission
        }));
        
        setCollaborators(collaboratorsList);
        
        if (data.document) {
          setIsPublicDoc(data.document.isPublic);
          if (data.document.updatedAt) {
            setLastSaved(data.document.updatedAt);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    }
  }, [documentId, getToken, backendUrl]);

  useEffect(() => {
    if (documentId && isSignedIn) {
      fetchCollaborators();
    }
  }, [documentId, isSignedIn, fetchCollaborators]);

  const updateDocumentTitle = useCallback(async (newTitle) => {
    if (userRole === "viewer") return;

    try {
      setSaveStatus("saving");
      const token = await getToken();
      
      const response = await fetch(`${backendUrl}/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });

      if (!response.ok) {
        throw new Error('Failed to update title');
      }

      setSaveStatus("saved");
      setLastSaved(new Date().toISOString());
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (error) {
      console.error('Error updating document title:', error);
      setSaveStatus("");
    }
  }, [userRole, documentId, getToken, backendUrl]);

  const handleTitleChange = useCallback((e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    if (titleTimeoutRef.current) {
      clearTimeout(titleTimeoutRef.current);
    }

    titleTimeoutRef.current = setTimeout(() => {
      updateDocumentTitle(newTitle);
    }, 1000);
  }, [updateDocumentTitle]);

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    if (titleTimeoutRef.current) {
      clearTimeout(titleTimeoutRef.current);
      updateDocumentTitle(title);
    }
  }, [title, updateDocumentTitle]);

  useEffect(() => {
    const connectSocket = async () => {
      try {
        let token = null;
        try {
          token = await getToken();
        } catch (err) {
          console.log('No auth token - connecting as guest');
        }

        const s = io(backendUrl, {
          auth: { token: token || '' }, 
          transports: ['websocket'],
          secure: true,
          withCredentials: true,
          path: '/socket.io/',
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: 10,
          forceNew: true
        });
        
        s.on('connect', () => console.log('Socket connected successfully!'));
        s.on('connect_error', (err) => {
          console.error('Socket connect error:', err.message);
        });
        s.on('disconnect', (reason) => console.log('Disconnect reason:', reason));
        s.on('error', (err) => {
          console.error('Socket error:', err);
          alert(err.message || 'An error occurred');
        });
        
        socketRef.current = s;
        setSocket(s);
      } catch (error) {
        console.error('Failed to connect socket:', error);
      }
    };
    
    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
      }
    };
  }, [getToken, backendUrl]);

  useEffect(() => {
    if (socket == null || quill == null) return;

    socket.once("load-document", (data) => {
      console.log('Document loaded with role:', data.role);
      setUserRole(data.role);
      setIsPublicDoc(data.isPublic || false);
      quill.setContents(data.data || []);
      
      // Store initial content for comparison
      lastSavedContent.current = data.data || [];
      
      if (data.title) {
        setTitle(data.title);
      }
      if (data.role === 'viewer') {
        quill.disable();
        console.log('Editor disabled for viewer');
      } else {
        quill.enable();
        console.log('Editor enabled for role:', data.role);
      }
      
      // Set initial online users list
      if (data.onlineUsers) {
        setOnlineUsers(data.onlineUsers);
      }
    });

    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  // Listen for presence events
  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = (data) => {
      console.log('User joined:', data);
      setOnlineUsers(prev => {
        // Avoid duplicates
        const exists = prev.some(u => 
          u.email?.toLowerCase() === data.email?.toLowerCase() ||
          u.userId === data.userId
        );
        if (exists) return prev;
        return [...prev, data];
      });
    };

    const handleUserLeft = (data) => {
      console.log('User left:', data);
      setOnlineUsers(prev => prev.filter(u => 
        u.email?.toLowerCase() !== data.email?.toLowerCase() &&
        u.userId !== data.userId
      ));
    };

    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleRoleChanged = (data) => {
      console.log('Collaborator role changed:', data);
      
      const currentUserEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
      const isCurrentUser = 
        data.email?.toLowerCase() === currentUserEmail || 
        data.userId === user?.id;
      
      if (isCurrentUser) {
        const newRole = data.newRole;
        console.log(`Your role changed from ${data.oldRole} to ${newRole}`);
        
        setUserRole(newRole);
        socket.emit('refresh-role', documentId);
        
        if (quill) {
          if (newRole === "viewer") {
            quill.disable();
            alert(`Your access has been changed to view-only by ${data.updatedBy}`);
          } else if (newRole === "editor") {
            quill.enable();
            alert(`Your access has been upgraded to editor by ${data.updatedBy}`);
          }
        }
        
        fetchCollaborators();
      }
    };

    socket.on("collaborator-role-changed", handleRoleChanged);

    return () => {
      socket.off("collaborator-role-changed", handleRoleChanged);
    };
  }, [socket, quill, user, documentId, fetchCollaborators]);

  useEffect(() => {
    if (!socket) return;

    const handlePermissionsUpdate = (data) => {
      console.log('General permissions updated:', data);
      
      if (data.isPublic !== undefined) {
        setIsPublicDoc(data.isPublic);
      }
      
      fetchCollaborators();
    };

    socket.on("permissions-updated", handlePermissionsUpdate);

    return () => {
      socket.off("permissions-updated", handlePermissionsUpdate);
    };
  }, [socket, fetchCollaborators]);

  // Track if document has unsaved changes
  const hasUnsavedChanges = useRef(false);
  const lastSavedContent = useRef(null);

  useEffect(() => {
    if (socket == null || quill == null || userRole === 'viewer' || !userRole) return;

    const interval = setInterval(() => {
      // Only save if there are actual changes
      if (!hasUnsavedChanges.current) {
        return;
      }

      const currentContent = quill.getContents();
      
      // Double-check: compare with last saved content
      if (lastSavedContent.current && 
          JSON.stringify(currentContent) === JSON.stringify(lastSavedContent.current)) {
        hasUnsavedChanges.current = false;
        return;
      }

      setSaveStatus("saving");
      socket.emit("save-document", currentContent);
      
      setTimeout(() => {
        setSaveStatus("saved");
        setLastSaved(new Date().toISOString());
        lastSavedContent.current = currentContent;
        hasUnsavedChanges.current = false;
        setTimeout(() => setSaveStatus(""), 2000);
      }, 300);
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill, userRole]);

  useEffect(() => {
    if (socket == null || quill == null) return;

    const handler = delta => {
      quill.updateContents(delta);
    };
    socket.on("receive-changes", handler);

    return () => {
      socket.off("receive-changes", handler);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (socket == null || quill == null || userRole === 'viewer' || !userRole) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      
      // Mark that we have unsaved changes
      hasUnsavedChanges.current = true;
      
      socket.emit("send-changes", delta);
    };
    quill.on("text-change", handler);

    return () => {
      quill.off("text-change", handler);
    };
  }, [socket, quill, userRole]);

  const wrapperRef = useCallback(wrapper => {
    if (wrapper == null) return;

    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    });
    q.disable();
    q.setText("Loading...");
    setQuill(q);
  }, []);

 return (
    <div className="h-screen flex flex-col bg-light-bg dark:bg-slate-ink font-['Inter'] transition-colors duration-300">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        /* Layout-only styles that apply to both modes */
        .ql-toolbar.ql-snow {
          border: none !important;
          border-radius: 8px !important;
          padding: 12px 16px !important;
          margin-bottom: 24px !important;
          font-family: 'Inter', sans-serif !important;
        }

        .ql-container.ql-snow {
          border: none !important;
          font-family: 'Inter', sans-serif !important;
        }

        .ql-editor {
          padding: 40px 64px !important;
          min-height: 800px !important;
        }

        /* Dark Mode CSS Overrides for Quill */
        .dark .ql-toolbar.ql-snow {
          background-color: #2D2D2D !important;
          border-color: #404040 !important;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3) !important;
        }

        .dark .ql-snow .ql-stroke { stroke: #ADB5BD !important; }
        .dark .ql-snow .ql-fill { fill: #ADB5BD !important; }
        .dark .ql-snow .ql-picker { color: #ADB5BD !important; }

        .dark .ql-editor {
          color: #E9ECEF !important;
          caret-color: #3A86FF !important;
        }

        .dark .ql-editor.ql-blank::before {
          color: #6C757D !important;
          font-style: italic;
        }
      `}</style>

      {/* Guest Banner */}
      {!isSignedIn && isPublicDoc && userRole === 'viewer' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <Globe className="w-4 h-4" />
            <span className="font-medium">You're viewing this document as a guest.</span>
          </div>
          <button
            onClick={handleSignInRedirect}
            className="px-5 py-2 bg-docsy-blue text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Sign in to collaborate
          </button>
        </div>
      )}

      {/* Editor Header */}
      <div className="bg-white dark:bg-[#1A1A1A] border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between gap-4 transition-colors">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onFocus={() => setIsEditingTitle(true)}
            onBlur={handleTitleBlur}
            className={`title-input text-xl font-semibold text-slate-ink dark:text-white border-none px-3 py-1 rounded-md transition-all ${
              isEditingTitle ? 'bg-input-field dark:bg-gray-800' : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
            placeholder="Untitled Document"
            disabled={userRole === "viewer"}
          />
          
          <div className="flex items-center gap-3 px-3">
            <StatusPill userRole={userRole} isPublic={isPublicDoc} />
            {!saveStatus && lastSaved && (
              <span className="text-xs text-muted-text dark:text-cool-grey">
                Last edited {getRelativeTime(lastSaved)}
              </span>
            )}
            {saveStatus === "saving" && <span className="text-xs text-muted-text animate-pulse">Saving...</span>}
            {saveStatus === "saved" && <span className="text-xs text-soft-green">✓ Saved</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-input-field dark:hover:bg-gray-800 rounded-lg transition-all duration-200 group"
            title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === 'light' ? 
              <Moon className="w-5 h-5 text-muted-text group-hover:text-slate-ink" /> : 
              <Sun className="w-5 h-5 text-sun-yellow" />
            }
          </button>

          <button
            onClick={() => setShowShortcuts(true)}
            className="p-2 hover:bg-input-field dark:hover:bg-gray-800 rounded-lg transition-colors group"
          >
            <Keyboard className="w-5 h-5 text-muted-text group-hover:text-slate-ink dark:group-hover:text-white" />
          </button>
          
          <CollaboratorAvatars collaborators={collaborators} onlineUsers={onlineUsers} />
          
          {userRole === 'owner' && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-4 py-2 bg-docsy-blue text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-auto bg-light-bg dark:bg-[#121212] flex justify-center pt-6 pb-12 transition-colors">
        <div 
          className="w-full max-w-5xl h-fit bg-white dark:bg-[#1E1E1E] shadow-lg dark:shadow-none rounded-lg mx-6 overflow-hidden border dark:border-gray-800" 
          ref={wrapperRef}
        ></div>
      </div>
      
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          fetchCollaborators();
        }}
        documentId={documentId}
        socket={socket}
        getToken={getToken}
        backendUrl={backendUrl}
      />
      
      <KeyboardShortcutsTooltip 
        isOpen={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />
    </div>
  );
}