import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WhisperSttService {
  isModelLoading = signal(false);
  isTranscribing = signal(false);
  loadingMessage = signal('');

  private transcriber: any = null;

  /**
   * Transcribe an audio Blob to text using Whisper tiny.en model.
   * On first call, downloads the model (~40MB) from HuggingFace CDN and caches it.
   * Subsequent calls use the cached model instantly.
   */
  async transcribe(audioBlob: Blob): Promise<string> {
    try {
      // Step 1: Load the Whisper pipeline if not loaded yet
      if (!this.transcriber) {
        this.isModelLoading.set(true);
        this.loadingMessage.set('Loading Whisper AI model (one-time ~40MB download)...');

        const { pipeline } = await import('@huggingface/transformers');

        this.transcriber = await pipeline(
          'automatic-speech-recognition',
          'onnx-community/whisper-tiny.en',
          {
            dtype: 'fp32',
            device: 'wasm',
          }
        );

        this.isModelLoading.set(false);
        this.loadingMessage.set('');
      }

      // Step 2: Convert audio Blob to Float32Array at 16kHz for Whisper
      this.isTranscribing.set(true);
      this.loadingMessage.set('Transcribing your voice note...');

      const audioData = await this.decodeAudioBlob(audioBlob);

      // Step 3: Run Whisper inference
      const result = await this.transcriber(audioData, {
        language: 'en',
        task: 'transcribe',
      });

      this.isTranscribing.set(false);
      this.loadingMessage.set('');

      return (result?.text || '').trim();
    } catch (err: any) {
      console.error('Whisper STT error:', err);
      this.isModelLoading.set(false);
      this.isTranscribing.set(false);
      this.loadingMessage.set('');
      return '';
    }
  }

  /**
   * Decode an audio Blob (webm/mp4/ogg) into a Float32Array resampled to 16kHz mono,
   * which is the format Whisper expects.
   */
  private async decodeAudioBlob(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();

    // Use OfflineAudioContext to decode and resample to 16kHz in one step
    const targetSampleRate = 16000;

    // First decode at native rate to get duration
    const tempCtx = new AudioContext();
    const tempBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
    const duration = tempBuffer.duration;
    const targetLength = Math.ceil(duration * targetSampleRate);
    await tempCtx.close();

    // Decode and resample using OfflineAudioContext at 16kHz
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();

    // Need to re-decode because arrayBuffer was consumed
    const arrayBuffer2 = await blob.arrayBuffer();
    const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer2);
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer.getChannelData(0);
  }
}
