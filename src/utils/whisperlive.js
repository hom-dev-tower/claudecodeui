// WhisperLive WebSocket client for direct browser integration
export class WhisperLiveClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.uid = this.generateUID();
    this.isReady = false;
    this.transcription = '';
    this.audioContext = null;
    this.processor = null;
  }

  generateUID() {
    // Generate UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('Connecting to WhisperLive at:', this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('Connected to WhisperLive');
          
          // Send initial configuration
          const config = {
            uid: this.uid,
            language: null,  // Auto-detect
            task: 'transcribe',
            model: 'small',
            use_vad: false
          };
          
          console.log('Sending config:', config);
          this.ws.send(JSON.stringify(config));
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Received:', message);
            
            // Check if this is our message
            if (message.uid !== this.uid) {
              return;
            }
            
            // First message is ready signal
            if (!this.isReady && (message.status === 'ready' || message.segments)) {
              this.isReady = true;
              console.log('Server ready');
            }
            
            // Handle transcription
            if (message.segments && Array.isArray(message.segments)) {
              const text = message.segments.map(seg => seg.text).join(' ');
              if (text) {
                this.transcription = text;
                console.log('Transcription:', text);
              }
            }
            
            // Handle wait status
            if (message.status === 'WAIT') {
              console.log(`Queue full, wait: ${message.message} min`);
            }
            
            // Handle disconnect
            if (message.message === 'DISCONNECT') {
              console.log('Server disconnect');
              this.disconnect();
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.isReady = false;
        };

        // Timeout
        setTimeout(() => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error('Connection timeout'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  async startStreaming(stream) {
    // Wait for ready signal
    const maxWait = 5000;
    const start = Date.now();
    while (!this.isReady && (Date.now() - start) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.isReady) {
      throw new Error('Server not ready');
    }

    // Set up audio processing
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000  // WhisperLive expects 16kHz
    });

    const source = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    // Process audio
    this.processor.onaudioprocess = (e) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert to Float32Array and send
        const float32Data = new Float32Array(inputData);
        this.ws.send(float32Data.buffer);
      }
    };

    // Connect audio pipeline
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stopStreaming() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  disconnect() {
    this.stopStreaming();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Recording stopped');
    }
    this.ws = null;
    this.isReady = false;
  }

  getTranscription() {
    return this.transcription;
  }
}

// Alternative: Transcribe from blob using server proxy
export async function transcribeWithWhisperLive(audioBlob, onStatusChange) {
  // This uses the server-side proxy implementation
  const formData = new FormData();
  const fileName = `recording_${Date.now()}.webm`;
  const file = new File([audioBlob], fileName, { type: audioBlob.type });
  
  formData.append('audio', file);
  
  try {
    if (onStatusChange) {
      onStatusChange('transcribing');
    }

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Transcription error: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    throw error;
  }
}