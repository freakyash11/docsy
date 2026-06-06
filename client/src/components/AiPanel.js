/**
 * AiPanel.js
 *
 * Floating side-panel for AI actions in the Docsy editor.
 *
 * Selection-aware behavior:
 * ─────────────────────────
 * TextEditor tracks the Quill selection via a 'selection-change' listener and
 * passes a frozen snapshot ({ index, length, text } | null) as `quillSelection`.
 * Because the snapshot is captured BEFORE the AI button click blurs Quill, this
 * panel always has the correct selection — even after focus leaves the editor.
 *
 * Rules:
 *   • Grammar / Tone / Translate:
 *       – selection present → use selected text → Replace Selection on apply
 *       – no selection      → use full document  → Replace Document on apply
 *   • Summarize:
 *       – selection present → summarize selected text
 *       – no selection      → summarize full document
 *       – NEVER auto-replaces; always shows in panel; "Append to Document" is the only write action
 *
 * Viewer restriction:
 *   – Viewers may run AI and see results, but all write buttons are hidden/disabled.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAiActions } from '../hooks/useAiActions';
import {
  X,
  Sparkles,
  FileText,
  CheckCircle,
  Languages,
  Palette,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  AlertCircle,
  Info,
  PlusSquare,
  RefreshCw,
  MousePointer,
  ScrollText,
  LogIn,
  Lock,
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────

const TABS = [
  {
    id: 'summarize',
    label: 'Summarize',
    icon: FileText,
    descSelection: 'Summarize your selected text.',
    descFull:      'Summarize the full document.',
  },
  {
    id: 'grammar',
    label: 'Fix Grammar',
    icon: CheckCircle,
    descSelection: 'Fix grammar and spelling in your selection.',
    descFull:      'Fix grammar and spelling across the full document.',
  },
  {
    id: 'tone',
    label: 'Change Tone',
    icon: Palette,
    descSelection: 'Rewrite your selected text in a different tone.',
    descFull:      'Rewrite the full document in a different tone.',
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: Languages,
    descSelection: 'Translate your selected text.',
    descFull:      'Translate the full document.',
  },
];

const TONES = [
  { value: 'formal',       label: 'Formal'       },
  { value: 'casual',       label: 'Casual'       },
  { value: 'professional', label: 'Professional' },
  { value: 'friendly',     label: 'Friendly'     },
  { value: 'persuasive',   label: 'Persuasive'   },
  { value: 'empathetic',   label: 'Empathetic'   },
];

const LANGUAGES = [
  'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Dutch',
  'Japanese', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Korean',
  'Arabic', 'Hindi', 'Russian', 'Polish', 'Turkish', 'Swedish',
  'Danish', 'Norwegian', 'Finnish', 'Greek',
];

// ─── Sub-components ────────────────────────────────────────────────

function TabButton({ tab, isActive, onClick }) {
  const Icon = tab.icon;
  return (
    <button
      id={`ai-tab-${tab.id}`}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
        isActive
          ? 'bg-docsy-blue text-white shadow-sm'
          : 'text-muted-text dark:text-cool-grey hover:bg-input-field dark:hover:bg-gray-800 hover:text-slate-ink dark:hover:text-white'
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {tab.label}
    </button>
  );
}

function Shimmer() {
  return (
    <div className="space-y-2 animate-pulse">
      {[100, 85, 92, 70, 88].map((w, i) => (
        <div
          key={i}
          className="h-3 bg-gray-200 dark:bg-gray-700 rounded"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}

function ModelBadge({ modelUsed, isCached }) {
  const shortModel = modelUsed?.split('/').slice(-1)[0] ?? modelUsed ?? 'unknown';
  return (
    <div className="flex items-center gap-2 text-xs text-muted-text dark:text-cool-grey">
      <Info className="w-3 h-3 flex-shrink-0" />
      <span>
        {isCached ? '⚡ Cached · ' : ''}
        {shortModel}
      </span>
    </div>
  );
}

/**
 * Scope badge shown under the tabs — tells the user what the action will operate on.
 */
function ScopeBadge({ hasSelection, selectionText }) {
  if (hasSelection) {
    // Show a short preview of the selected text (max 40 chars)
    const preview = selectionText && selectionText.length > 40
      ? selectionText.slice(0, 40).trimEnd() + '…'
      : selectionText;
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <MousePointer className="w-3 h-3 text-docsy-blue flex-shrink-0" />
        <span className="text-xs text-docsy-blue dark:text-blue-400 font-medium">
          Selection:
        </span>
        <span className="text-xs text-blue-700 dark:text-blue-300 truncate" title={selectionText}>
          "{preview}"
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
      <ScrollText className="w-3 h-3 text-muted-text flex-shrink-0" />
      <span className="text-xs text-muted-text dark:text-cool-grey">
        Full document
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

/**
 * @param {object}  props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {object}  props.quill          - Quill instance (used for apply operations only)
 * @param {{ index: number, length: number, text: string } | null} props.quillSelection
 *   Live selection snapshot from TextEditor. Updated by Quill's selection-change
 *   listener — preserves the last real selection across blur events, and updates
 *   immediately when the user highlights new text.
 * @param {string}  props.userRole       - 'owner' | 'editor' | 'viewer'
 * @param {boolean} props.isSignedIn     - false for guests viewing a public document.
 *   When false the entire interactive body is replaced by a sign-in gate.
 *   AI generation is ONLY allowed for signed-in users; guests may not execute
 *   AI requests regardless of document visibility.
 */
export default function AiPanel({ isOpen, onClose, quill, quillSelection, userRole, isSignedIn = false }) {
  const { isLoading, error, result, modelUsed, isCached, retryAfter, run, reset } = useAiActions();

  const [activeTab, setActiveTab]       = useState('summarize');
  const [selectedTone, setSelectedTone] = useState('formal');
  const [targetLanguage, setTargetLang] = useState('French');
  const [copied, setCopied]             = useState(false);
  const [countdown, setCountdown]       = useState(null);
  const countdownRef                    = useRef(null);
  const isViewer                        = userRole === 'viewer';
  // Guests are unauthenticated users viewing a public document.
  // They must not be able to execute AI requests at all.
  const isGuest                         = !isSignedIn;


  // Allow the selection to refresh whenever the user switches tabs.
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    reset();
  }, [reset]);

  // Reset on panel close
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  // ── 429 countdown ────────────────────────────────────────────────
  useEffect(() => {
    if (retryAfter != null && retryAfter > 0) {
      setCountdown(retryAfter);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); return null; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [retryAfter]);

  // ── Derive input text from live quillSelection prop ─────────────
  // quillSelection is kept current by TextEditor's selection-change listener,
  // which preserves the last non-null range across blur events (e.g. clicking
  // the AI panel button) and updates immediately when the user re-selects text.
  const hasSelection = Boolean(quillSelection && quillSelection.length > 0);
  const inputText    = hasSelection
    ? quillSelection.text
    : (quill ? quill.getText().trim() : '');

  // ── Run the AI action ────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!inputText) return;
    let options = {};
    if (activeTab === 'tone')      options = { tone: selectedTone };
    if (activeTab === 'translate') options = { targetLanguage };
    await run(activeTab, inputText, options);
  }, [activeTab, inputText, run, selectedTone, targetLanguage]);

  // ── Apply result back to Quill ───────────────────────────────────
  //
  // Grammar / Tone / Translate:
  //   • Had selection → replace only that range
  //   • No selection  → replace entire document text
  //
  // Summarize:
  //   • Never auto-replaces — only "Append to Document" is offered.
  //
  // Bug 2 fix: all Quill mutations use source='user' so that Quill fires
  // text-change with source='user'. TextEditor's text-change handler
  // checks `if (source !== "user") return` — without this fix, API-sourced
  // changes were silently ignored by the save/broadcast pipeline.
  const handleInsert = useCallback(() => {
    if (!quill || !result || isViewer) return;

    if (hasSelection && quillSelection) {
      // Replace the exact selection range that was active when Run was clicked.
      // source='user' ensures text-change fires with source='user', which makes
      // TextEditor's listener set hasUnsavedChanges=true and broadcast the delta.
      quill.deleteText(quillSelection.index, quillSelection.length, 'user');
      quill.insertText(quillSelection.index, result, 'user');
      quill.setSelection(quillSelection.index, result.length);
    } else {
      // No selection — the AI operated on the full document; replace it.
      // source='user' for the same reason.
      quill.setText(result, 'user');
      quill.setSelection(result.length, 0);
    }
    onClose();
  }, [quill, result, isViewer, hasSelection, quillSelection, onClose]);

  const handleAppend = useCallback(() => {
    if (!quill || !result || isViewer) return;
    const len = quill.getLength();
    // Use source='user' so this append enters the autosave + collab pipeline
    // exactly like a normal user keystroke would.
    quill.insertText(len - 1, `\n\nSummary:\n${result}`, 'user');
    onClose();
  }, [quill, result, isViewer, onClose]);

  // ── Copy to clipboard ────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent fail */ }
  }, [result]);

  if (!isOpen) return null;

  const activeTabMeta = TABS.find(t => t.id === activeTab);
  // canRun: editor/owner signed-in users with text to process.
  // Guests and loading/countdown states all disable the button.
  const canRun   = !isGuest && quill && !isLoading && !countdown && inputText.length > 0;
  const canApply = result && !isViewer && !isGuest;

  // Determine the label for the insert button
  const insertLabel = hasSelection ? 'Replace Selection' : 'Replace Document';

  // Description shown in the panel body
  const description = hasSelection
    ? activeTabMeta?.descSelection
    : activeTabMeta?.descFull;

  // Run button label
  const runLabel =
    activeTab === 'summarize' ? 'Summarize' :
    activeTab === 'grammar'   ? 'Fix Grammar' :
    activeTab === 'tone'      ? `Apply ${selectedTone.charAt(0).toUpperCase() + selectedTone.slice(1)} Tone` :
                                `Translate to ${targetLanguage}`;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        id="ai-panel"
        className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-[#1A1A1A] border-l border-gray-200 dark:border-gray-800 shadow-2xl z-40 flex flex-col"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-docsy-blue flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-ink dark:text-white leading-tight">
                AI Assistant
              </h2>
              {isViewer && (
                <p className="text-xs text-muted-text dark:text-cool-grey">
                  View only — editor access needed to apply
                </p>
              )}
            </div>
          </div>
          <button
            id="ai-panel-close"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-input-field dark:hover:bg-gray-800 text-muted-text hover:text-slate-ink dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────── */}
        {!isGuest && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
            <div className="flex gap-1.5">
              {TABS.map(tab => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Body ─────────────────────────────────────────────── */}
        {isGuest ? (
          /* ── Guest gate: sign-in required to use AI ──────────── */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Lock className="w-7 h-7 text-muted-text dark:text-cool-grey" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-slate-ink dark:text-white">
                Sign in to use AI tools
              </p>
              <p className="text-xs text-muted-text dark:text-cool-grey leading-relaxed">
                AI features are available to signed-in users only.
                Public document viewing is not affected.
              </p>
            </div>
            <a
              href="/auth"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-docsy-blue text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </a>
          </div>
        ) : (
          /* ── Normal body for authenticated users ──────────────── */
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Scope badge — shows live selection preview or "Full document" */}
            <ScopeBadge
              hasSelection={hasSelection}
              selectionText={quillSelection?.text}
            />

            {/* Description */}
            <p className="text-xs text-muted-text dark:text-cool-grey leading-relaxed">
              {description}
            </p>

            {/* ── Action-specific options ────────────────────────── */}
            {activeTab === 'tone' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-ink dark:text-white">
                  Tone
                </label>
                <div className="relative">
                  <select
                    id="ai-tone-select"
                    value={selectedTone}
                    onChange={e => setSelectedTone(e.target.value)}
                    className="w-full appearance-none bg-input-field dark:bg-gray-800 text-slate-ink dark:text-white text-sm px-3 py-2 pr-8 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-docsy-blue/40 cursor-pointer"
                  >
                    {TONES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text pointer-events-none" />
                </div>
              </div>
            )}

            {activeTab === 'translate' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-ink dark:text-white">
                  Target Language
                </label>
                <div className="relative">
                  <select
                    id="ai-language-select"
                    value={targetLanguage}
                    onChange={e => setTargetLang(e.target.value)}
                    className="w-full appearance-none bg-input-field dark:bg-gray-800 text-slate-ink dark:text-white text-sm px-3 py-2 pr-8 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-docsy-blue/40 cursor-pointer"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text pointer-events-none" />
                </div>
              </div>
            )}

            {/* ── Run button ─────────────────────────────────────── */}
            <button
              id={`ai-run-${activeTab}`}
              onClick={handleRun}
              disabled={!canRun}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                canRun
                  ? 'bg-docsy-blue text-white hover:opacity-90 shadow-sm hover:shadow-md active:scale-[0.98]'
                  : 'bg-gray-100 dark:bg-gray-800 text-muted-text dark:text-cool-grey cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing…
                </>
              ) : countdown ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Retry in {countdown}s
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {runLabel}
                </>
              )}
            </button>

            {/* ── Error state ────────────────────────────────────── */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{error}</p>
              </div>
            )}

            {/* ── Loading shimmer ────────────────────────────────── */}
            {isLoading && (
              <div className="p-3 bg-input-field dark:bg-gray-800/50 rounded-lg">
                <Shimmer />
              </div>
            )}

            {/* ── Result ─────────────────────────────────────────── */}
            {result && !isLoading && (
              <div className="space-y-3">

                {/* Result text */}
                <div className="p-3 bg-input-field dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-slate-ink dark:text-gray-200 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {result}
                </div>

                {/* Model badge */}
                {modelUsed && <ModelBadge modelUsed={modelUsed} isCached={isCached} />}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {/* Copy */}
                  <button
                    id="ai-copy-btn"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-muted-text dark:text-cool-grey hover:bg-input-field dark:hover:bg-gray-800 hover:text-slate-ink dark:hover:text-white transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-soft-green" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>

                  {/* Replace selection / Replace document — grammar, tone, translate only */}
                  {canApply && activeTab !== 'summarize' && (
                    <button
                      id="ai-insert-btn"
                      onClick={handleInsert}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-docsy-blue text-white hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <PlusSquare className="w-3.5 h-3.5" />
                      {insertLabel}
                    </button>
                  )}

                  {/* Append summary — summarize only */}
                  {canApply && activeTab === 'summarize' && (
                    <button
                      id="ai-append-btn"
                      onClick={handleAppend}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-docsy-blue text-white hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <PlusSquare className="w-3.5 h-3.5" />
                      Append to Document
                    </button>
                  )}
                </div>

                {/* Viewer notice */}
                {isViewer && (
                  <p className="text-xs text-muted-text dark:text-cool-grey text-center">
                    You need editor access to apply AI results.
                  </p>
                )}

                {/* Try again */}
                <button
                  onClick={reset}
                  className="w-full text-xs text-muted-text dark:text-cool-grey hover:text-slate-ink dark:hover:text-white transition-colors py-1"
                >
                  ↺ Try again with different settings
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-muted-text dark:text-cool-grey text-center">
            Powered by{' '}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-docsy-blue hover:underline"
            >
              OpenRouter
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
