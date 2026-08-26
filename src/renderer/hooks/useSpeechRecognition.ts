import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

/**
 * Wraps the Web Speech API's SpeechRecognition.
 *
 * Important lifecycle rule: the recognition instance is created exactly
 * once (on mount) and torn down exactly once (on unmount). The onResult /
 * onError callbacks the caller passes in are stored in refs and read at
 * call time, NOT captured as effect dependencies — otherwise a new
 * recognition object gets built on every re-render (which, with Zustand
 * driving re-renders on every streamed token, happened many times per
 * second) and the previous, still-listening instance is orphaned: it
 * keeps the microphone open but is no longer reachable via
 * recognitionRef, so stop() stops the wrong object and the UI reads as
 * permanently stuck in LISTENING.
 */
export const useSpeechRecognition = ({ onResult, onError }: SpeechRecognitionOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Always-current callback refs, so the recognition instance's handlers
  // never close over a stale onResult/onError from an earlier render.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const isNativeSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    if (!isNativeSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResultRef.current?.(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      // 'no-speech' and 'aborted' are routine (silence timeout / manual
      // stop), not failures worth surfacing as an error state.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onErrorRef.current?.(event.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // Mount-only: tear down cleanly on unmount so nothing keeps listening
    // after the component (or the whole app) goes away.
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped — nothing to clean up.
      }
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNativeSupported]);

  const startListening = useCallback(() => {
    if (!isNativeSupported || !recognitionRef.current) {
      onErrorRef.current?.(
        'Speech recognition is not available in this environment. Try Chrome/Chromium, or use text chat instead.'
      );
      return;
    }
    if (isListening) return; // already running — ignore duplicate start

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      // start() throws if called on an already-started instance (can
      // happen with rapid double-clicks); treat as a no-op rather than
      // surfacing a scary error.
      console.error('STT Start Error:', err);
    }
  }, [isNativeSupported, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Not currently running — nothing to stop.
      }
    }
    setIsListening(false);
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    isSupported: isNativeSupported,
  };
};
