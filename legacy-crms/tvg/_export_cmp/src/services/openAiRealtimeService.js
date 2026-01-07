/**
 * Service to handle OpenAI Realtime API connections for live transcription and coaching.
 * This service manages the WebSocket connection, audio streaming, and event handling.
 */

// Note: In a production environment, you would proxy this through your backend/edge function
// to keep your API key secure. For this implementation, we assume a secure token exchange 
// or environment variable availability in a protected context.

export const openAiRealtimeService = {
  socket: null,
  audioContext: null,
  mediaStream: null,
  processor: null,
  
  /**
   * Initialize the Realtime Session
   * @param {Function} onTranscript - Callback for partial/final transcripts
   * @param {Function} onInsight - Callback for AI insights/coaching
   */
  async startSession(onTranscript, onInsight) {
    try {
      // 1. Get Ephemeral Token (Mocked for now, typically fetched from backend)
      const token = import.meta.env.VITE_OPENAI_API_KEY; 
      if (!token) throw new Error("OpenAI API Key not found");

      // 2. Initialize WebSocket
      // OpenAI Realtime API URL (beta)
      const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
      this.socket = new WebSocket(url, [
        "realtime",
        `openai-insecure-api-key.${token}`,
        "openai-beta.realtime-v1",
      ]);

      // 3. Handle Socket Events
      this.socket.onopen = () => {
        console.log("OpenAI Realtime Connected");
        this.startAudioCapture();
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "response.audio_transcript.delta":
            onTranscript && onTranscript(data.delta, false);
            break;
          case "response.audio_transcript.done":
            onTranscript && onTranscript(data.transcript, true);
            break;
          case "response.function_call_arguments.done":
             // Handle tool calls if we define coaching tools
             break;
          case "conversation.item.created":
             // Track conversation history
             break;
          default:
             // Log other events for debugging
             // console.log("Event:", data.type);
             break;
        }
      };

      this.socket.onerror = (err) => console.error("Realtime Error:", err);
      
    } catch (error) {
      console.error("Failed to start OpenAI Realtime session:", error);
      throw error;
    }
  },

  /**
   * Capture Microphone Audio and stream to Socket
   */
  async startAudioCapture() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Worklet to process raw PCM16 audio
      await this.audioContext.audioWorklet.addModule(
        URL.createObjectURL(
          new Blob(
            [
              `class AudioProcessor extends AudioWorkletProcessor {
                process(inputs, outputs, parameters) {
                  const input = inputs[0];
                  if (input.length > 0) {
                    const float32Data = input[0];
                    const int16Data = new Int16Array(float32Data.length);
                    for (let i = 0; i < float32Data.length; i++) {
                      const s = Math.max(-1, Math.min(1, float32Data[i]));
                      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    this.port.postMessage(int16Data.buffer);
                  }
                  return true;
                }
              }
              registerProcessor('audio-processor', AudioProcessor);`,
            ],
            { type: "application/javascript" }
          )
        )
      );

      this.processor = new AudioWorkletNode(this.audioContext, "audio-processor");
      
      this.processor.port.onmessage = (e) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          // Send audio buffer as base64
          const audioData = btoa(String.fromCharCode(...new Uint8Array(e.data)));
          this.socket.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: audioData
          }));
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

    } catch (error) {
      console.error("Audio capture failed:", error);
    }
  },

  /**
   * Analyze Intent explicitly (can be called periodically or on button press)
   */
  async analyzeIntent(transcript) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

      // Ask the model to categorize the user's intent based on the transcript so far
      this.socket.send(JSON.stringify({
          type: "response.create",
          response: {
              modalities: ["text"],
              instructions: `Analyze this transcript chunk: "${transcript}". Identify the caller's primary intent from these categories: "price_shopper", "urgent_service", "skeptical", "booking_ready", "informational". Return ONLY the category name.`
          }
      }));
  },

  stopSession() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.socket) {
      this.socket.close();
    }
    this.mediaStream = null;
    this.audioContext = null;
    this.socket = null;
    this.processor = null;
    console.log("OpenAI Realtime Session Ended");
  }
};