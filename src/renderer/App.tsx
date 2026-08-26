import { MessageSquare, Mic, MicOff } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { AIState, ChatMessageData } from '../shared/types'
import { AICore } from './components/AICore'
import { ChatInterface } from './components/ChatInterface'
import { Footer } from './components/Footer'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { useSystemMetrics } from './hooks/useSystemMetrics'
import { ensureConversationId, persistMessage } from './lib/persistence'
import { useAppStore } from './store'
import './styles/globals.css'

export const App: React.FC = () => {
  useSystemMetrics();

  const [voiceError, setVoiceError] = useState<string | null>(null);

  const { 
    aiState, 
    viewMode, 
    setAIState, 
    setViewMode, 
    messages,
    addMessage, 
    updateLastMessageContent,
    finalizeLastMessage,
    setIsGenerating,
    setMessages,
    currentConversationId,
    setCurrentConversationId,
  } = useAppStore();

  // On startup, load the most recent conversation (or create one) so chat
  // history survives an app restart. Previously the SQLite IPC handlers
  // existed but nothing in the renderer ever called them.
  useEffect(() => {
    (async () => {
      if (!window.jarvisAPI?.getConversations) return;
      try {
        const conversations = await window.jarvisAPI.getConversations();
        let convo = conversations[0];
        if (!convo && window.jarvisAPI.createConversation) {
          convo = await window.jarvisAPI.createConversation(`conv-${Date.now()}`);
        }
        if (!convo) return;
        setCurrentConversationId(convo.id);

        const dbMessages = await window.jarvisAPI.getMessages(convo.id);
        if (dbMessages.length > 0) {
          setMessages(
            dbMessages.map((m) => ({
              id: m.id,
              role: m.role as ChatMessageData['role'],
              content: m.content,
              timestamp: m.timestamp,
            }))
          );
        }
      } catch (err) {
        console.error('[Persistence] Failed to load conversation history:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { speak } = useSpeechSynthesis();

  const handleVoiceCommand = async (transcript: string) => {
    if (!transcript.trim()) {
      setAIState(AIState.ONLINE);
      return;
    }

    setAIState(AIState.PROCESSING);

    const userMsg: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: transcript,
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

    const convoId = await ensureConversationId(currentConversationId, setCurrentConversationId);
    persistMessage(convoId, userMsg);

    const context = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let fullReply = '';

    try {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2:1.5b',
          messages: context,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) throw new Error('Ollama connection error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n').filter((l) => l.trim() !== '');

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              fullReply += parsed.message.content;
              updateLastMessageContent(parsed.message.content);
            }
          } catch {
            // Buffer chunk split catch
          }
        }
      }

      // Speak response using neural synthesizer
      finalizeLastMessage();
      if (fullReply) {
        persistMessage(convoId, { ...assistantMsg, content: fullReply });
        speak(fullReply);
      } else {
        setAIState(AIState.ONLINE);
      }
    } catch (err) {
      finalizeLastMessage();
      updateLastMessageContent('\n[Error: Unable to connect to Ollama LLM provider.]');
      setAIState(AIState.ERROR);
    } finally {
      setIsGenerating(false);
    }
  };

  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: (transcript) => {
      setVoiceError(null);
      stopListening();
      handleVoiceCommand(transcript);
    },
    onError: (error) => {
      setVoiceError(error);
      setAIState(AIState.ONLINE);
    },
  });

  const toggleVoice = () => {
    if (!isSupported) {
      setVoiceError(
        'Speech recognition is not available in this environment. Try Chrome/Chromium, or use text chat instead.'
      );
      return;
    }
    if (isListening) {
      stopListening();
      setAIState(AIState.ONLINE);
    } else {
      setVoiceError(null);
      startListening();
      setAIState(AIState.LISTENING);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-between h-screen bg-jarvis-dark overflow-hidden selection:bg-jarvis-cyan/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.03)_0%,transparent_60%)] pointer-events-none" />

      <div className="flex-1 w-full max-w-6xl p-6 flex flex-col items-center justify-center z-10 overflow-hidden pb-14">
        {viewMode === 'HOME' ? (
          <div className="flex flex-col items-center space-y-12">
            <AICore state={aiState} />
            
            <div className="flex flex-col items-center space-y-8">
              <h1 className="text-4xl font-light tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-jarvis-cyan to-blue-500 uppercase filter drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]">
                J.A.R.V.I.S
              </h1>

              <div className="flex gap-8">
                <button 
                  onClick={toggleVoice}
                  disabled={!isSupported}
                  title={!isSupported ? 'Speech recognition unavailable in this environment' : undefined}
                  className={`group relative flex items-center justify-center w-36 h-12 rounded border transition-all duration-300 ${
                    !isSupported
                      ? 'border-jarvis-cyan/10 bg-jarvis-cyan/5 opacity-40 cursor-not-allowed'
                      : isListening 
                      ? 'border-jarvis-cyan bg-jarvis-cyan/20 shadow-[0_0_20px_rgba(0,243,255,0.6)]' 
                      : 'border-jarvis-cyan/30 bg-jarvis-cyan/5 hover:bg-jarvis-cyan/10 hover:shadow-[0_0_15px_rgba(0,243,255,0.3)]'
                  }`}
                >
                  <div className="flex items-center gap-2 text-jarvis-cyan font-mono tracking-wider">
                    {isListening ? (
                      <MicOff size={16} className="animate-pulse text-jarvis-cyan" />
                    ) : (
                      <Mic size={16} />
                    )}
                    <span>{isListening ? 'LISTENING' : 'VOICE'}</span>
                  </div>
                </button>

                <button 
                  onClick={() => setViewMode('CHAT')}
                  className="group relative flex items-center justify-center w-36 h-12 rounded border border-jarvis-cyan/30 bg-jarvis-cyan/5 hover:bg-jarvis-cyan/10 transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,243,255,0.3)]"
                >
                  <div className="flex items-center gap-2 text-jarvis-cyan font-mono tracking-wider">
                    <MessageSquare size={16} />
                    <span>CHAT</span>
                  </div>
                </button>
              </div>

              {voiceError && (
                <p className="text-xs font-mono text-jarvis-red/80 max-w-sm text-center">
                  {voiceError}
                </p>
              )}
            </div>
          </div>
        ) : (
          <ChatInterface />
        )}
      </div>

      <Footer />
    </div>
  );
};