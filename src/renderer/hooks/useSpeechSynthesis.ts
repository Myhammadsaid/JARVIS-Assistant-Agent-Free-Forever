import { useCallback, useEffect, useRef, useState } from 'react'
import { AIState } from '../../shared/types'
import { useAppStore } from '../store'

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { setAIState } = useAppStore();
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const availableVoices = synthRef.current?.getVoices() || [];
        setVoices(availableVoices);
      };

      loadVoices();
      if (synthRef.current.onvoiceschanged !== undefined) {
        synthRef.current.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !text.trim()) return;

    synthRef.current.cancel();

    // Clean formatting symbols
    const cleanText = text
      .replace(/[*_#`~\[\]()]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Voice Selection Hierarchy for J.A.R.V.I.S. (British / Calm Male Profiles)
    const britishVoice = voices.find(
      (v) => v.lang === 'en-GB' || v.lang === 'en_GB' || v.name.includes('UK') || v.name.includes('British')
    );
    const naturalVoice = voices.find(
      (v) => v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Daniel')
    );

    if (britishVoice) {
      utterance.voice = britishVoice;
    } else if (naturalVoice) {
      utterance.voice = naturalVoice;
    } else if (voices.length > 0) {
      utterance.voice = voices[0];
    }

    // J.A.R.V.I.S Audio Profile Metrics
    utterance.rate = 0.92;  // Calm, deliberate pace
    utterance.pitch = 0.82; // Lower, masculine British register

    utterance.onstart = () => {
      setIsSpeaking(true);
      setAIState(AIState.SPEAKING);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setAIState(AIState.ONLINE);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setAIState(AIState.ONLINE);
    };

    synthRef.current.speak(utterance);
  }, [voices, setAIState]);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setAIState(AIState.ONLINE);
    }
  }, [setAIState]);

  return { speak, stop, isSpeaking, voices };
};