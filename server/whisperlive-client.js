const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WhisperLiveClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.transcription = '';
    this.isConnected = false;
    this.uid = crypto.randomUUID();
    this.isReady = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('Connecting to WhisperLive at:', this.url);
        this.ws = new WebSocket(this.url);
        
        this.ws.on('open', () => {
          console.log('Connected to WhisperLive');
          this.isConnected = true;
          
          // Send initial configuration according to WhisperLive API spec
          const config = {
            uid: this.uid,
            language: null,  // null for auto-detect
            task: "transcribe",
            model: "small",
            use_vad: false
          };
          console.log('Sending configuration:', JSON.stringify(config));
          this.ws.send(JSON.stringify(config));
          
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('Received message:', message);
            
            // Check if this is our message
            if (message.uid !== this.uid) {
              return;
            }
            
            // First message is ready signal
            if (!this.isReady && (message.status === 'ready' || message.segments)) {
              this.isReady = true;
              console.log('Server is ready to receive audio');
            }
            
            // Handle transcription updates
            if (message.segments && Array.isArray(message.segments)) {
              // Concatenate all segment texts
              const text = message.segments.map(seg => seg.text).join(' ');
              if (text) {
                this.transcription = text;
                console.log('Transcription update:', text);
              }
            }
            
            // Handle wait status
            if (message.status === 'WAIT') {
              console.log(`Server queue full, wait time: ${message.message} minutes`);
            }
            
            // Handle disconnect
            if (message.message === 'DISCONNECT') {
              console.log('Server requested disconnect');
              this.disconnect();
            }
          } catch (error) {
            console.error('Error parsing WhisperLive message:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('WhisperLive WebSocket error:', error);
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('Disconnected from WhisperLive');
          this.isConnected = false;
        });

        // Timeout if connection takes too long
        setTimeout(() => {
          if (!this.isConnected) {
            this.disconnect();
            reject(new Error('WhisperLive connection timeout'));
          }
        }, 5000);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  async transcribeAudioFile(audioFilePath) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Reset transcription
      this.transcription = '';

      // Read the audio file
      const audioData = await fs.promises.readFile(audioFilePath);
      console.log('Audio file size:', audioData.length);
      
      // For now, let's try sending the WebM data directly
      // WhisperLive might handle it or we'll get a more specific error
      
      // Wait for ready signal
      const readyTimeout = 5000;
      const readyStart = Date.now();
      while (!this.isReady && (Date.now() - readyStart) < readyTimeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!this.isReady) {
        throw new Error('Server did not send ready signal');
      }
      
      // Send audio data in chunks
      const chunkSize = 16384; // 16KB chunks
      for (let i = 0; i < audioData.length; i += chunkSize) {
        const chunk = audioData.slice(i, i + chunkSize);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(chunk);
          
          // Small delay between chunks to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Wait for transcription to complete (with timeout)
      const startTime = Date.now();
      const timeout = 30000; // 30 seconds timeout
      
      while (!this.transcription && (Date.now() - startTime) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!this.transcription) {
        throw new Error('Transcription timeout - no response from WhisperLive');
      }

      return this.transcription.trim();
      
    } catch (error) {
      console.error('Error transcribing audio file:', error);
      throw error;
    } finally {
      // Always disconnect after transcription
      this.disconnect();
    }
  }

  disconnect() {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Simple transcription function for one-off use
async function transcribeWithWhisperLive(audioFilePath, whisperLiveUrl) {
  const client = new WhisperLiveClient(whisperLiveUrl);
  
  try {
    const transcription = await client.transcribeAudioFile(audioFilePath);
    return transcription;
  } catch (error) {
    console.error('WhisperLive transcription error:', error);
    throw error;
  }
}

module.exports = {
  WhisperLiveClient,
  transcribeWithWhisperLive
};