

# Voice Chat for CDG Pulse AI

## Overview
Add voice conversation capability to the existing AI vendor chat, allowing dealers to speak with CDG Pulse AI using ElevenLabs Conversational AI. Users can press a microphone button to start a voice conversation, speak naturally, and hear AI responses spoken back.

## User Experience
1. User opens the AI chat (via `?ai_chat=true`)
2. After vendor data loads, a **microphone button** appears next to the send button
3. User clicks the mic button to start voice conversation
4. Browser requests microphone permission (with helpful prompt)
5. User speaks naturally - their speech is transcribed in real-time
6. AI responds with vendor recommendations, and the response is **spoken aloud**
7. User can interrupt the AI at any time
8. Text transcripts of both sides appear in the chat history

## Architecture

```text
+------------------+     +-----------------------+     +------------------+
|   React Client   |---->| ElevenLabs Token Edge |---->| ElevenLabs API   |
| (useConversation)|     | Function (server-side)|     | (WebRTC/voice)   |
+------------------+     +-----------------------+     +------------------+
        |                                                      |
        v                                                      v
+------------------+     +-----------------------+     +------------------+
| vendor-ai-chat   |---->| Lovable AI Gateway    |---->| Text AI Response |
| (existing edge)  |     |                       |     |                  |
+------------------+     +-----------------------+     +------------------+
```

## Technical Approach

### Option A: ElevenLabs Conversational AI Agent (Full Voice-to-Voice)
Uses ElevenLabs' built-in conversational agent for speech-to-speech. The agent handles STT, LLM routing, and TTS in one WebRTC stream.

**Pros**: Lower latency, simpler client code, built-in interruption handling
**Cons**: Requires ElevenLabs Agent ID configured in their dashboard with system prompt

### Option B: Hybrid Approach (ElevenLabs STT + Existing Chat + ElevenLabs TTS)
Use realtime transcription for voice input, send to existing `vendor-ai-chat` edge function, then use TTS to speak the response.

**Pros**: Reuses existing chat logic, more control over AI behavior
**Cons**: Higher latency (3 network hops), more complex orchestration

**Recommendation**: Option B (Hybrid) - This preserves the existing chat logic with vendor data context and gives us full control over the AI's system prompt and behavior.

## Implementation Steps

### 1. Set Up ElevenLabs Connector
- Use the ElevenLabs connector to add `ELEVENLABS_API_KEY` to the project
- This secret will be available to edge functions

### 2. Create Token Generation Edge Function
**File**: `supabase/functions/elevenlabs-scribe-token/index.ts`

Generates single-use tokens for ElevenLabs realtime transcription:
- Calls `https://api.elevenlabs.io/v1/single-use-token/realtime_scribe`
- Returns token to client (expires in 15 minutes)

### 3. Create TTS Edge Function
**File**: `supabase/functions/elevenlabs-tts/index.ts`

Converts AI text responses to speech:
- Receives text and optional voiceId
- Calls ElevenLabs TTS API (`/v1/text-to-speech/{voiceId}`)
- Returns audio as binary blob
- Uses `eleven_turbo_v2_5` model for low latency
- Default voice: "Roger" (CwhRBWXzGAHq8TQ4Fs17) - professional, clear

### 4. Install ElevenLabs React SDK
Add `@elevenlabs/react` package for the `useScribe` hook

### 5. Create Voice Chat Hook
**File**: `src/hooks/useVoiceChat.ts`

Custom hook that orchestrates:
- Microphone permission request with user-friendly prompts
- Connection to ElevenLabs realtime transcription
- Sending transcribed text to existing `sendMessage` function
- Playing TTS audio when AI responds
- Managing voice/text mode state

### 6. Update VendorAIChat Component
**File**: `src/components/vendors/VendorAIChat.tsx`

Add voice UI elements:
- Microphone button next to send button (Mic icon from lucide-react)
- Visual indicator when listening (pulsing animation)
- Visual indicator when AI is speaking (speaker animation)
- Live transcription preview while user speaks
- Toggle between voice and text input modes

### 7. UI States to Handle
| State | Visual | Behavior |
|-------|--------|----------|
| Idle | Mic button (outline) | Click to start voice |
| Connecting | Mic pulsing, "Connecting..." | Wait for WebSocket |
| Listening | Mic filled + sound waves | User speaking, show partial transcript |
| Processing | Loader | Sending to AI |
| Speaking | Speaker icon pulsing | AI audio playing |
| Error | Red mic, error toast | Show retry option |

## Component Changes Summary

### New Files
1. `supabase/functions/elevenlabs-scribe-token/index.ts` - Token generation
2. `supabase/functions/elevenlabs-tts/index.ts` - Text-to-speech conversion
3. `src/hooks/useVoiceChat.ts` - Voice orchestration hook

### Modified Files
1. `src/components/vendors/VendorAIChat.tsx` - Add voice UI
2. `package.json` - Add `@elevenlabs/react` dependency

## Technical Details

### Voice Settings
- **Model**: `eleven_turbo_v2_5` (optimized for real-time)
- **Voice**: Roger (CwhRBWXzGAHq8TQ4Fs17) - professional male voice
- **Sample Rate**: 16kHz for transcription
- **Commit Strategy**: VAD (Voice Activity Detection) - auto-commits on silence

### Error Handling
- Graceful fallback to text-only if microphone denied
- Retry logic for network failures
- Clear error messages in UI
- Auto-disconnect on component unmount

### Mobile Considerations
- Larger touch targets for mic button on mobile
- Visual feedback works without hover states
- Audio plays through device speakers (not earpiece)

