const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Convert audio file to raw PCM format using ffmpeg
 * @param {string} inputPath - Path to input audio file
 * @param {number} sampleRate - Target sample rate (default: 16000)
 * @returns {Promise<Buffer>} - Raw PCM audio data as Float32Array buffer
 */
async function convertToRawAudio(inputPath, sampleRate = 16000) {
  const outputPath = path.join(os.tmpdir(), `audio_${Date.now()}.f32le`);
  
  return new Promise((resolve, reject) => {
    // Use ffmpeg to convert to raw float32 PCM
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-f', 'f32le',  // 32-bit float little-endian
      '-acodec', 'pcm_f32le',
      '-ar', sampleRate.toString(),  // Sample rate
      '-ac', '1',  // Mono
      '-y',  // Overwrite output
      outputPath
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Read the raw audio data
        const rawData = await fs.readFile(outputPath);
        
        // Clean up temp file
        await fs.unlink(outputPath).catch(() => {});
        
        resolve(rawData);
      } catch (error) {
        reject(error);
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Simple fallback converter using Web Audio API (requires additional setup)
 * This is a placeholder for environments where ffmpeg is not available
 */
async function convertWithoutFFmpeg(inputPath) {
  // This would require a library like node-wav or similar
  // For now, throw an error indicating ffmpeg is required
  throw new Error('Audio conversion requires ffmpeg. Please install ffmpeg on your system.');
}

/**
 * Check if ffmpeg is available
 */
async function checkFFmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

module.exports = {
  convertToRawAudio,
  convertWithoutFFmpeg,
  checkFFmpeg
};