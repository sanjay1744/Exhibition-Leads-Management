import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WhisperSttService {
  isModelLoading = signal(false);
  isTranscribing = signal(false);
  loadingMessage = signal('');

  private transcriber: any = null;

  /**
   * Transcribe direct 16kHz Float32Array PCM audio samples captured live from mic.
   * 100% bypasses WebM/MP4 container decoding for guaranteed audio recognition.
   */
  async transcribePcm(pcmData: Float32Array): Promise<string> {
    try {
      if (!pcmData || pcmData.length === 0) {
        console.warn('Whisper STT: PCM audio array is empty.');
        return '';
      }

      await this.ensureModelLoaded();

      this.isTranscribing.set(true);
      this.loadingMessage.set('Transcribing voice note with Whisper AI...');

      const normalizedPcm = this.normalizeAudio(pcmData);

      const result = await this.transcriber(normalizedPcm, {
        task: 'transcribe',
        return_timestamps: false,
      });

      console.log('Whisper PCM pipeline output:', result);

      this.isTranscribing.set(false);
      this.loadingMessage.set('');

      return this.extractResultText(result);
    } catch (err: any) {
      console.error('Whisper STT PCM error:', err);
      this.isModelLoading.set(false);
      this.isTranscribing.set(false);
      this.loadingMessage.set('');
      return '';
    }
  }

  /**
   * Transcribe an audio Blob to text using Whisper base model.
   */
  async transcribe(audioBlob: Blob): Promise<string> {
    try {
      if (!audioBlob || audioBlob.size === 0) {
        console.warn('Whisper STT: Audio blob is empty.');
        return '';
      }

      await this.ensureModelLoaded();

      this.isTranscribing.set(true);
      this.loadingMessage.set('Transcribing voice note with Whisper AI...');

      const audioData = await this.decodeAudioBlob(audioBlob);

      if (!audioData || audioData.length === 0) {
        console.warn('Whisper STT: Decoded audio data is empty.');
        this.isTranscribing.set(false);
        this.loadingMessage.set('');
        return '';
      }

      const result = await this.transcriber(audioData, {
        task: 'transcribe',
        return_timestamps: false,
      });

      console.log('Whisper Blob pipeline output:', result);

      this.isTranscribing.set(false);
      this.loadingMessage.set('');

      return this.extractResultText(result);
    } catch (err: any) {
      console.error('Whisper STT error:', err);
      this.isModelLoading.set(false);
      this.isTranscribing.set(false);
      this.loadingMessage.set('');
      return '';
    }
  }

  private async ensureModelLoaded(): Promise<void> {
    if (!this.transcriber) {
      this.isModelLoading.set(true);
      this.loadingMessage.set('Loading Whisper AI Model (~75MB one-time download)...');

      const { pipeline, env } = await import('@huggingface/transformers');

      // Configure ONNX WASM single-thread mode to prevent Blob Worker CORS errors in Angular dev server
      try {
        if (env && env.backends && env.backends.onnx && env.backends.onnx.wasm) {
          env.backends.onnx.wasm.numThreads = 1;
          env.backends.onnx.wasm.simd = true;
        }
      } catch (e) {
        console.warn('Transformers env config warning:', e);
      }

      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-base',
        {
          dtype: 'q8',
          device: 'wasm',
        }
      );

      this.isModelLoading.set(false);
      this.loadingMessage.set('');
    }
  }

  private extractResultText(result: any): string {
    let extractedText = '';
    if (typeof result === 'string') {
      extractedText = result;
    } else if (Array.isArray(result) && result.length > 0) {
      extractedText = result.map((r: any) => (typeof r === 'string' ? r : r?.text || '')).join(' ');
    } else if (result && typeof result === 'object') {
      extractedText = result.text || '';
    }
    return extractedText.trim();
  }

  private async decodeAudioBlob(blob: Blob): Promise<Float32Array> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const targetSampleRate = 16000;

      const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const tempBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
      const duration = tempBuffer.duration;
      await tempCtx.close();

      if (!duration || duration <= 0) {
        return new Float32Array(0);
      }

      const targetLength = Math.ceil(duration * targetSampleRate);

      const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
      const source = offlineCtx.createBufferSource();

      const arrayBuffer2 = await blob.arrayBuffer();
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer2);
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const pcmData = renderedBuffer.getChannelData(0);

      return this.normalizeAudio(pcmData);
    } catch (err) {
      console.error('Error decoding audio blob for Whisper:', err);
      return new Float32Array(0);
    }
  }

  private normalizeAudio(samples: Float32Array): Float32Array {
    if (!samples || samples.length === 0) return samples;

    // Use 98th percentile amplitude to ignore clicks/pop noise frames
    const sorted = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      sorted[i] = Math.abs(samples[i]);
    }
    sorted.sort();

    const p98 = sorted[Math.floor(sorted.length * 0.98)] || 0;

    if (p98 > 0.001 && p98 < 0.7) {
      const factor = 0.75 / p98;
      for (let i = 0; i < samples.length; i++) {
        const val = samples[i] * factor;
        samples[i] = Math.max(-1, Math.min(1, val));
      }
    }
    return samples;
  }
}



