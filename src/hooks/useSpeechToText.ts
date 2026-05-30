import { useState, useRef } from 'react';

interface SpeechRecog {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function useSpeechToText(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecog | null>(null);

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser.'); return; }
    const recog: SpeechRecog = new SR();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = 'en-US';
    recog.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onResult(text);
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recog.start();
    recogRef.current = recog;
    setListening(true);
  };

  const stop = () => {
    recogRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop };
}
