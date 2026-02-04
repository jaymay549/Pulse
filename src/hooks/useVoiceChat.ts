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
  const sessionStartRef = useRef<{
    resolve: () => void;
    reject: (e: Error) => void;
  } | null>(null);

  const waitForSessionStart = useCallback((timeoutMs: number) => {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (sessionStartRef.current) sessionStartRef.current = null;
        reject(new Error("Timed out waiting for voice session to start"));
      }, timeoutMs);

      sessionStartRef.current = {
        resolve: () => {
          window.clearTimeout(timeoutId);
          sessionStartRef.current = null;
          resolve();
        },
        reject: (e: Error) => {
          window.clearTimeout(timeoutId);
          sessionStartRef.current = null;
          reject(e);
        },
      };
    });
  }, []);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onSessionStarted: () => {
      console.log("[VoiceChat] Scribe session started");
      sessionStartRef.current?.resolve();
      setVoiceState("listening");
      toast.success("Voice chat started - speak now!");
    },
    onPartialTranscript: (data) => {
      console.log("[VoiceChat] Partial transcript:", data.text);
      setPartialTranscript(data.text);
    },
    onCommittedTranscript: async (data) => {
      console.log("[VoiceChat] Committed transcript:", data.text);
      
      if (isProcessingRef.current) {
        console.log("[VoiceChat] Already processing, ignoring");
        return;
      }
      
      const transcript = data.text.trim();
      if (!transcript) {
        console.log("[VoiceChat] Empty transcript, ignoring");
        return;
      }
      
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
        console.error("[VoiceChat] Voice processing error:", err);
        setError("Failed to process voice");
        setVoiceState("error");
      } finally {
        isProcessingRef.current = false;
      }
    },
    onError: (err) => {
      console.error("[VoiceChat] Scribe error:", err);
      // Some errors come through as Event (e.g. WebSocket error) without details.
      sessionStartRef.current?.reject(
        new Error(
          err instanceof Error
            ? err.message
            : "Voice connection failed (WebSocket error)"
        )
      );
      setError(err instanceof Error ? err.message : "Transcription error");
      setVoiceState("error");
      toast.error("Voice transcription error");
    },
    onConnect: () => {
      console.log("[VoiceChat] Scribe connected");
    },
    onDisconnect: () => {
      console.log("[VoiceChat] Scribe disconnected");
      // If we disconnect while still connecting, reject the pending start.
      if (sessionStartRef.current) {
        sessionStartRef.current.reject(
          new Error("Voice connection closed before session started")
        );
      }
      if (voiceState === "listening") {
        setVoiceState("idle");
      }
    },
    onAuthError: (data) => {
      console.error("[VoiceChat] Auth error:", data.error);
      sessionStartRef.current?.reject(new Error(data.error || "Auth error"));
      setError("Voice authentication failed");
      setVoiceState("error");
      toast.error("Voice authentication failed");
    },
    onQuotaExceededError: (data) => {
      console.error("[VoiceChat] Quota exceeded:", data.error);
      sessionStartRef.current?.reject(new Error(data.error || "Quota exceeded"));
      setError("Voice quota exceeded");
      setVoiceState("error");
      toast.error("Voice quota exceeded");
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
    
    console.log("[VoiceChat] Playing TTS for text length:", truncatedText.length);
    
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
      console.error("[VoiceChat] TTS request failed:", response.status);
      throw new Error(`TTS request failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    console.log("[VoiceChat] TTS audio blob size:", audioBlob.size);
    
    const audioUrl = URL.createObjectURL(audioBlob);
    audioUrlRef.current = audioUrl;
    
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        console.log("[VoiceChat] Audio playback ended");
        resolve();
      };
      
      audio.onerror = (e) => {
        console.error("[VoiceChat] Audio playback error:", e);
        reject(new Error("Audio playback failed"));
      };
      
      audio.play().catch((err) => {
        console.error("[VoiceChat] Audio play() failed:", err);
        reject(err);
      });
    });
  };

  const startVoice = useCallback(async () => {
    if (!enabled) {
      toast.error("Voice chat requires vendor data to be loaded first");
      return;
    }
    
    console.log("[VoiceChat] Starting voice chat...");
    setError(null);
    setVoiceState("connecting");
    
    try {
      // Request microphone permission
      console.log("[VoiceChat] Requesting microphone permission...");
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[VoiceChat] Microphone permission granted");
      
      // Get scribe token from edge function
      console.log("[VoiceChat] Fetching scribe token...");
      const response = await fetch(SCRIBE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[VoiceChat] Token fetch failed:", response.status, errorText);
        throw new Error("Failed to get voice token");
      }
      
      const data = await response.json();
      console.log("[VoiceChat] Token received:", data.token ? "yes" : "no");
      
      if (!data.token) {
        throw new Error("No token received");
      }

      const microphone = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      // Some environments require a residency-specific base URI.
      // We'll try default first, then EU/IN residency endpoints.
      const baseUris: Array<string | undefined> = [
        undefined,
        "wss://api.eu.residency.elevenlabs.io",
        "wss://api.in.residency.elevenlabs.io",
      ];

      let lastErr: unknown = null;

      for (let i = 0; i < baseUris.length; i++) {
        const baseUri = baseUris[i];
        try {
          console.log(
            `[VoiceChat] Connecting to Scribe...${baseUri ? ` baseUri=${baseUri}` : ""}`
          );

          // Ensure we're not reusing an old connection
          scribe.disconnect();

          await scribe.connect({
            token: data.token,
            microphone,
            ...(baseUri ? { baseUri } : {}),
          });

          console.log("[VoiceChat] Scribe connect() completed; waiting for session_start...");
          await waitForSessionStart(5000);
          console.log("[VoiceChat] Voice session confirmed");
          return;
        } catch (e) {
          lastErr = e;
          console.warn("[VoiceChat] Scribe connection attempt failed:", e);
          // Brief delay before retry
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      throw lastErr instanceof Error
        ? lastErr
        : new Error("Voice connection failed");
      
    } catch (err) {
      console.error("[VoiceChat] Failed to start voice:", err);
      
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access denied");
          toast.error("Please enable microphone access to use voice chat");
        } else {
          const msg = err.message || "Voice chat failed to connect";
          setError(msg);
          toast.error(msg);
        }
      }
      
      setVoiceState("error");
    }
  }, [enabled, scribe, waitForSessionStart]);

  const stopVoice = useCallback(() => {
    console.log("[VoiceChat] Stopping voice chat...");
    
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
