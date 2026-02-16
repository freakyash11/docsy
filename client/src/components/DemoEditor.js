import { useCallback, useEffect, useState, useRef } from "react"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import { useNavigate } from "react-router-dom"
import { Globe, Sparkles, ArrowRight, Check } from "lucide-react"

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ color: [] }],
  ["clean"],
]

// Mock collaborators for simulation
const MOCK_COLLABORATORS = [
  { name: "Alex Chen", email: "alex@example.com", color: "#3A86FF", initials: "AC" },
  { name: "Maria Garcia", email: "maria@example.com", color: "#FF595E", initials: "MG" },
  { name: "Jordan Smith", email: "jordan@example.com", color: "#6EEB83", initials: "JS" }
]

// Sample demo content
const DEMO_CONTENT = {
  ops: [
    { insert: "Welcome to Docsy Demo! 🎉\n", attributes: { header: 1 } },
    { insert: "\nTry editing this document - your changes are " },
    { insert: "automatically saved", attributes: { bold: true } },
    { insert: " as you type.\n\n" },
    { insert: "What you can try:\n", attributes: { header: 2 } },
    { insert: "\n" },
    { insert: "✨ Type anywhere in this document\n" },
    { insert: "🎨 Format text using the toolbar above\n" },
    { insert: "👥 Watch simulated collaborators edit with you\n" },
    { insert: "💾 See autosave in action\n" },
    { insert: "\nThis is a temporary demo - " },
    { insert: "sign up", attributes: { bold: true, color: "#3A86FF" } },
    { insert: " to save your work and invite real collaborators!\n\n" },
    { insert: "Start typing below to experience Docsy...\n", attributes: { italic: true } },
  ]
}

function DemoCollaboratorAvatar({ collaborator, index, isActive }) {
  return (
    <div 
      className="relative"
      style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: 10 - index }}
    >
      <div 
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white transition-all ${
          isActive ? 'ring-docsy-blue ring-4 scale-110' : ''
        }`}
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.initials}
      </div>
      {isActive && (
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-soft-green rounded-full ring-2 ring-white"></div>
      )}
    </div>
  )
}

export default function DemoEditor() {
  const navigate = useNavigate()
  const [title] = useState("Welcome to Docsy Demo")
  const [saveStatus, setSaveStatus] = useState("")
  const [quill, setQuill] = useState()
  const [showConversionModal, setShowConversionModal] = useState(false)
  const [activeCollaborator, setActiveCollaborator] = useState(null)
  const [userHasTyped, setUserHasTyped] = useState(false)
  const [editsCount, setEditsCount] = useState(0)
  const [timeSpent, setTimeSpent] = useState(0)
  const conversionTimerRef = useRef(null)
  const collaboratorSimulationRef = useRef(null)
  const timeTrackerRef = useRef(null)
  const startTimeRef = useRef(null)

  // Simulate autosave
  const simulateAutosave = useCallback(() => {
    setSaveStatus("saving")
    setTimeout(() => {
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus(""), 2000)
    }, 800)
  }, [])

  // Simulate collaborator activity
  const simulateCollaboratorActivity = useCallback(() => {
    if (!quill) return

    const randomCollaborator = MOCK_COLLABORATORS[Math.floor(Math.random() * MOCK_COLLABORATORS.length)]
    setActiveCollaborator(randomCollaborator)

    // Simulate typing after 2 seconds
    setTimeout(() => {
      const length = quill.getLength()
      const randomPosition = Math.floor(Math.random() * (length - 1))
      
      // Subtle content change (add a space or period)
      quill.insertText(randomPosition, " ", "api")
      
      setActiveCollaborator(null)
    }, 2000)
  }, [quill])

  // Initialize Quill editor
  const wrapperRef = useCallback(wrapper => {
    if (wrapper == null) return

    wrapper.innerHTML = ""
    const editor = document.createElement("div")
    wrapper.append(editor)
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    })
    
    // Load demo content
    q.setContents(DEMO_CONTENT)
    q.enable()
    setQuill(q)
  }, [])

  // Track user typing and edit count
  useEffect(() => {
    if (!quill) return

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return
      
      if (!userHasTyped) {
        setUserHasTyped(true)
        startTimeRef.current = Date.now()
      }
      
      // Increment edit count
      setEditsCount(prev => prev + 1)
      
      // Trigger autosave animation
      simulateAutosave()
    }

    quill.on("text-change", handler)
    return () => quill.off("text-change", handler)
  }, [quill, userHasTyped, simulateAutosave])

  // Track time spent in demo
  useEffect(() => {
    if (!userHasTyped) return

    timeTrackerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setTimeSpent(elapsed)
      }
    }, 1000)

    return () => {
      if (timeTrackerRef.current) {
        clearInterval(timeTrackerRef.current)
      }
    }
  }, [userHasTyped])

  // Show conversion modal after user engagement
  useEffect(() => {
    if (userHasTyped && !conversionTimerRef.current) {
      conversionTimerRef.current = setTimeout(() => {
        setShowConversionModal(true)
      }, 15000) // 15 seconds after first typing
    }

    return () => {
      if (conversionTimerRef.current) {
        clearTimeout(conversionTimerRef.current)
      }
    }
  }, [userHasTyped])

  // Simulate cursor movement for active collaborator
  useEffect(() => {
    if (!quill || !activeCollaborator) return
    
    const cursorModule = quill.getModule('cursors')
    if (!cursorModule) return
    
    // Simulate cursor movement
    const moveCursor = () => {
      const length = quill.getLength()
      const randomPos = Math.floor(Math.random() * length)
      
      cursorModule.createCursor(
        activeCollaborator.email,
        activeCollaborator.name,
        activeCollaborator.color
      )
      cursorModule.moveCursor(activeCollaborator.email, { index: randomPos, length: 0 })
    }
    
    moveCursor()
    const interval = setInterval(moveCursor, 2000)
    
    return () => clearInterval(interval)
  }, [quill, activeCollaborator])

  // Simulate collaborator activity periodically
  useEffect(() => {
    if (!quill || !userHasTyped) return

    collaboratorSimulationRef.current = setInterval(() => {
      if (Math.random() > 0.5) { // 50% chance
        simulateCollaboratorActivity()
      }
    }, 8000) // Every 8 seconds

    return () => {
      if (collaboratorSimulationRef.current) {
        clearInterval(collaboratorSimulationRef.current)
      }
    }
  }, [quill, userHasTyped, simulateCollaboratorActivity])

  const handleStartWriting = () => {
    navigate('/auth?mode=signup&source=demo')
  }

  const handleDismissModal = () => {
    setShowConversionModal(false)
    // Show again after 30 seconds if still in demo
    conversionTimerRef.current = setTimeout(() => {
      setShowConversionModal(true)
    }, 30000)
  }

  // Dynamic conversion message based on engagement
  const getConversionMessage = useCallback((timeSpent, editsCount) => {
    if (editsCount > 40) {
      return {
        title: "You're on a roll! 🔥",
        description: "You've made 20+ edits. Sign up to save this masterpiece!"
      }
    }
    if (timeSpent > 100) {
      return {
        title: "Loving Docsy so far?",
        description: "Create an account to keep your work and invite your team."
      }
    }
    return {
      title: "Ready to create your own document?",
      description: "Sign up to save, share, and collaborate in real time."
    }
  }, [])

  // Get current conversion message
  const conversionMessage = getConversionMessage(timeSpent, editsCount)

  return (
    <div className="h-screen flex flex-col bg-light-bg font-['Inter']">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        /* Reuse your exact Quill styling */
        .ql-toolbar.ql-snow {
          border: none !important;
          background: #F1F3F5 !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05) !important;
          padding: 12px 16px !important;
          margin-bottom: 24px !important;
          font-family: 'Inter', sans-serif !important;
        }

        .ql-container.ql-snow {
          border: none !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 16px !important;
          line-height: 1.6 !important;
          color: #2D2D2D !important;
        }

        .ql-editor {
          padding: 40px 64px !important;
          min-height: 800px !important;
        }

        .ql-editor h1 {
          font-size: 2.5em !important;
          font-weight: 700 !important;
          margin-bottom: 0.5em !important;
          color: #2D2D2D !important;
        }

        .ql-editor h2 {
          font-size: 2em !important;
          font-weight: 600 !important;
          margin-top: 1em !important;
          margin-bottom: 0.5em !important;
        }

        .ql-snow .ql-stroke {
          stroke: #6C757D !important;
        }

        .ql-snow .ql-fill {
          fill: #6C757D !important;
        }

        .ql-toolbar button:hover,
        .ql-toolbar button:focus {
          background: rgba(58, 134, 255, 0.1) !important;
          border-radius: 4px !important;
        }

        .ql-toolbar button.ql-active {
          background: rgba(58, 134, 255, 0.15) !important;
          border-radius: 4px !important;
        }

        /* Pulse animation for active collaborator */
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(58, 134, 255, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(58, 134, 255, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(58, 134, 255, 0);
          }
        }
        
        .pulse-ring {
          animation: pulse-ring 1.5s ease-out infinite;
        }
      `}</style>

      {/* Demo Banner - Always Visible */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm">
            <Sparkles className="w-4 h-4 text-docsy-blue" />
            <span className="text-sm font-semibold text-docsy-blue">Demo Mode</span>
          </div>
          <span className="text-sm text-slate-ink">
            You're in a <strong>temporary demo</strong> - changes won't be saved permanently
          </span>
        </div>
        <button
          onClick={handleStartWriting}
          className="px-5 py-2 bg-docsy-blue text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2"
        >
          Start Writing
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        {/* Left Section - Title & Status */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="text-xl font-semibold text-slate-ink px-3 py-1">
            {title}
          </div>
          
          {/* Status Pills Row */}
          <div className="flex items-center gap-2 px-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 rounded-full">
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">
                Demo Document
              </span>
            </div>
            
            {/* Autosave Status */}
            {saveStatus === "saving" && (
              <span className="text-xs text-muted-text font-medium flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-docsy-blue border-t-transparent rounded-full animate-spin" />
                Autosaving...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-soft-green font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Saved to demo
              </span>
            )}
          </div>
        </div>
        
        {/* Right Section - Mock Collaborators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
            <span className="text-xs font-medium text-docsy-blue">Simulated collaborators:</span>
            <div className="flex items-center">
              {MOCK_COLLABORATORS.map((collab, index) => (
                <DemoCollaboratorAvatar 
                  key={collab.email} 
                  collaborator={collab} 
                  index={index}
                  isActive={activeCollaborator?.email === collab.email}
                />
              ))}
            </div>
          </div>
          
          {/* Disabled Share Button with Tooltip */}
          <div className="relative group">
            <button
              disabled
              className="px-4 py-2 bg-cool-grey text-white rounded-lg cursor-not-allowed flex items-center gap-2 text-sm font-medium"
            >
              Share
            </button>
            <div className="absolute top-full mt-2 right-0 bg-slate-ink text-white px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
              Sign up to share documents
              <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-ink rotate-45"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 overflow-auto bg-light-bg flex justify-center pt-6 pb-12">
        <div 
          className="w-full max-w-5xl h-fit bg-white shadow-lg rounded-lg mx-6 overflow-hidden" 
          ref={wrapperRef}
        ></div>
      </div>

      {/* Conversion Modal with Dynamic Message */}
      {showConversionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-docsy-blue to-purple-600 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-slate-ink mb-2">
                {conversionMessage.title}
              </h2>
              
              <p className="text-muted-text mb-6">
                {conversionMessage.description}
              </p>
              
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handleStartWriting}
                  className="w-full px-6 py-3 bg-docsy-blue text-white rounded-lg hover:opacity-90 transition-opacity font-semibold text-base flex items-center justify-center gap-2 shadow-md"
                >
                  Start Writing - It's Free
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                <button
                  onClick={handleDismissModal}
                  className="w-full px-6 py-3 bg-gray-100 text-slate-ink rounded-lg hover:bg-gray-200 transition-colors font-medium text-base"
                >
                  Continue Demo
                </button>
              </div>
              
              <p className="text-xs text-muted-text mt-4">
                No credit card required • Free forever plan available
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
