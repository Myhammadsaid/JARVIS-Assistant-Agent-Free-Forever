import { ArrowLeft, Paperclip, Send, Square, Trash2, Volume2, VolumeX } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { AIState, ChatMessageData } from '../../shared/types'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { ensureConversationId, persistMessage } from '../lib/persistence'
import { useAppStore } from '../store'

const generateRequestId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { speak, stop, isSpeaking } = useSpeechSynthesis();

  const {
    messages,
    isGenerating,
    setAIState,
    setViewMode,
    addMessage,
    updateLastMessageContent,
    finalizeLastMessage,
    setIsGenerating,
    clearMessages,
    currentConversationId,
    setCurrentConversationId,
  } = useAppStore();

  // Tracks which in-flight request's chunks we should actually apply —
  // guards against a stray chunk arriving after a stop/new-message.
  const activeRequestIdRef = useRef<string | null>(null);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  const wasStoppedRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe once. Previously nothing in the renderer ever listened for
  // 'llm:stream-chunk', so the IPC (Electron) path awaited the full
  // response with no incremental UI update and never cleared
  // isStreaming — the message bubble was stuck on "..." and TTS never
  // reliably fired because completion state was never resolved cleanly.
  useEffect(() => {
    if (!window.jarvisAPI?.onStreamChunk) return;
    const unsubscribe = window.jarvisAPI.onStreamChunk((requestId, chunk) => {
      if (requestId !== activeRequestIdRef.current) return; // stale/aborted stream
      updateLastMessageContent(chunk);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userText = input.trim();
    setInput('');

    const userMsg: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessageData = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    addMessage(userMsg);
    addMessage(assistantMsg);
    setIsGenerating(true);
    setAIState(AIState.PROCESSING);
    wasStoppedRef.current = false;

    const convoId = await ensureConversationId(currentConversationId, setCurrentConversationId);
    persistMessage(convoId, userMsg);

    const context = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const requestId = generateRequestId();
    activeRequestIdRef.current = requestId;

    let accumulatedText = '';

    try {
      if (window.jarvisAPI?.sendPromptStream) {
        // Chunks land via the onStreamChunk subscription above and get
        // appended to the store as they arrive; the resolved value here
        // is the full (or partial, if stopped) final text, used only to
        // decide whether/what to speak.
        accumulatedText = await window.jarvisAPI.sendPromptStream(requestId, context);
      } else {
        const controller = new AbortController();
        fetchAbortControllerRef.current = controller;

        const response = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen2:1.5b',
            messages: context,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) throw new Error('Ollama offline');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            const lines = chunkText.split('\n').filter((l) => l.trim() !== '');

            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.message?.content) {
                  accumulatedText += parsed.message.content;
                  updateLastMessageContent(parsed.message.content);
                }
              } catch {
                // Ignore partial JSON buffers
              }
            }
          }
        } catch (streamErr: any) {
          if (streamErr?.name !== 'AbortError') throw streamErr;
          // Stopped mid-stream — fall through with whatever we have.
        }
      }

      finalizeLastMessage();

      if (accumulatedText) {
        persistMessage(convoId, { ...assistantMsg, content: accumulatedText });
      }

      if (wasStoppedRef.current) {
        setAIState(AIState.ONLINE);
      } else if (autoSpeak && accumulatedText) {
        speak(accumulatedText);
      } else {
        setAIState(AIState.ONLINE);
      }
    } catch (err) {
      finalizeLastMessage();
      updateLastMessageContent('\n[Error: Unable to connect to Ollama LLM provider.]');
      setAIState(AIState.ERROR);
    } finally {
      setIsGenerating(false);
      activeRequestIdRef.current = null;
      fetchAbortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    wasStoppedRef.current = true;
    const requestId = activeRequestIdRef.current;
    if (window.jarvisAPI?.abortStream && requestId) {
      window.jarvisAPI.abortStream(requestId);
    }
    fetchAbortControllerRef.current?.abort();
    setIsGenerating(false);
  };

  const handleClearLogs = async () => {
    clearMessages();
    if (window.jarvisAPI?.createConversation) {
      const id = `conv-${Date.now()}`;
      try {
        await window.jarvisAPI.createConversation(id);
        setCurrentConversationId(id);
      } catch (err) {
        console.error('[Persistence] Failed to start new conversation:', err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-jarvis-dark/95 border border-jarvis-cyan/20 rounded-lg backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-jarvis-cyan/20 bg-jarvis-panel/60 px-6 flex items-center justify-between font-mono text-sm text-jarvis-cyan">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              stop();
              setViewMode('HOME');
            }}
            className="flex items-center gap-2 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>BACK TO CORE</span>
          </button>
          <span className="text-jarvis-cyan/30">|</span>
          <span className="tracking-widest font-bold">WORKSPACE // CHAT MODE</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (isSpeaking) stop();
              setAutoSpeak(!autoSpeak);
            }}
            className={`flex items-center gap-2 text-xs font-mono transition-colors ${
              autoSpeak ? 'text-jarvis-cyan' : 'text-jarvis-cyan/40'
            }`}
            title="Toggle Voice Output"
          >
            {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{autoSpeak ? 'AUDIO ON' : 'MUTED'}</span>
          </button>

          <button
            onClick={handleClearLogs}
            className="flex items-center gap-2 text-jarvis-cyan/60 hover:text-jarvis-red transition-colors text-xs"
            title="Clear session messages"
          >
            <Trash2 size={14} />
            <span>CLEAR LOGS</span>
          </button>
        </div>
      </div>

      {/* Conversation Window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-jarvis-cyan/20">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="text-[10px] font-mono text-jarvis-cyan/50 mb-1 uppercase tracking-wider">
              {msg.role === 'user' ? 'USER' : 'J.A.R.V.I.S.'}
            </div>
            <div
              className={`max-w-[80%] rounded-lg p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-jarvis-cyan/10 border border-jarvis-cyan/30 text-jarvis-cyan'
                  : 'bg-jarvis-panel/80 border border-jarvis-cyan/15 text-gray-200 shadow-[0_0_15px_rgba(0,0,0,0.5)]'
              }`}
            >
              {msg.content || (msg.isStreaming ? '...' : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-jarvis-cyan/20 bg-jarvis-panel/80 flex items-center gap-3">
        <button
          className="p-3 rounded border border-jarvis-cyan/20 text-jarvis-cyan/60 hover:text-jarvis-cyan hover:bg-jarvis-cyan/10 transition-colors"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Command J.A.R.V.I.S..."
          rows={1}
          className="flex-1 bg-jarvis-dark/80 border border-jarvis-cyan/30 rounded px-4 py-3 text-sm text-jarvis-cyan placeholder-jarvis-cyan/40 focus:outline-none focus:border-jarvis-cyan resize-none font-mono"
        />

        {isGenerating ? (
          <button
            onClick={handleStop}
            className="p-3 rounded bg-jarvis-red/20 border border-jarvis-red text-jarvis-red hover:bg-jarvis-red/30 transition-colors"
            title="Stop generation"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-3 rounded border border-jarvis-cyan/40 bg-jarvis-cyan/10 text-jarvis-cyan hover:bg-jarvis-cyan/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
