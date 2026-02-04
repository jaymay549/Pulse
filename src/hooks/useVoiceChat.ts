import { useState, useCallback, useRef, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { toast } from "sonner";

const SCRIBE_TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-scribe-token`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

export type VoiceState = 
  | "idle" 
  | "connecting" 
  | "listening" 
  | "processing" 
  | "speaking" 
  | "error";

interface UseVoiceChatOptions {
  onTranscriptComplete: (text: string) => Promise<string | undefined>;
  enabled: boolean;
}

export function useVoiceChat({ onTranscriptComplete, enabled }: UseVoiceChatOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setPartialTranscript(data.text);
    },
    onCommittedTranscript: async (data) => {
      if (isProcessingRef.current) return;
      
      const transcript = data.text.trim();
      if (!transcript) return;
      
      isProcessingRef.current = true;
      setPartialTranscript("");
      setVoiceState("processing");
      
      try {
        // Disconnect scribe while processing
        scribe.disconnect();
        
        // Send to AI chat and get response
        const aiResponse = await onTranscriptComplete(transcript);
        
        if (aiResponse) {
          // Convert response to speech
          setVoiceState("speaking");
          await playTTS(aiResponse);
        }
        
        setVoiceState("idle");
      } catch (err) {
        console.error("Voice processing error:", err);
        setError("Failed to process voice");
        setVoiceState("error");
      } finally {
        isProcessingRef.current = false;
      }
    },
  });

  const playTTS = async (text: string): Promise<void> => {
    // Clean up previous audio
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    
    // Truncate text if too long (ElevenLabs has limits)
    const truncatedText = text.slice(0, 4000);
    
    const response = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text: truncatedText }),
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    audioUrlRef.current = audioUrl;
    
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        resolve();
      };
      
      audio.onerror = () => {
        reject(new Error("Audio playback failed"));
      };
      
      audio.play().catch(reject);
    });
  };

  const startVoice = useCallback(async () => {
    if (!enabled) {
      toast.error("Voice chat requires vendor data to be loaded first");
      return;
    }
    
    setError(null);
    setVoiceState("connecting");
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get scribe token from edge function
      const response = await fetch(SCRIBE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to get voice token");
      }
      
      const data = await response.json();
      
      if (!data.token) {
        throw new Error("No token received");
      }
      
      // Connect to ElevenLabs Scribe
      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      setVoiceState("listening");
      toast.success("Voice chat started - speak now!");
    } catch (err) {
      console.error("Failed to start voice:", err);
      
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access denied");
          toast.error("Please enable microphone access to use voice chat");
        } else {
          setError(err.message);
          toast.error(err.message);
        }
      }
      
      setVoiceState("error");
    }
  }, [enabled, scribe]);

  const stopVoice = useCallback(() => {
    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Clean up audio URL
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    
    // Disconnect scribe
    scribe.disconnect();
    
    setVoiceState("idle");
    setPartialTranscript("");
    isProcessingRef.current = false;
  }, [scribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      scribe.disconnect();
    };
  }, [scribe]);

  return {
    voiceState,
    partialTranscript,
    error,
    isConnected: scribe.isConnected,
    startVoice,
    stopVoice,
  };
}
