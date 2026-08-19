import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WhisperSttService } from '../../../core/services/whisper-stt.service';

@Component({
  selector: 'app-voice-recorder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-recorder.component.html',
  styleUrl: './voice-recorder.component.css'
})
export class VoiceRecorderComponent implements OnInit, OnDestroy {
  @ViewChild('visualizerCanvas') visualizerCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() set initialAudio(data: Blob | string | null | undefined) {
    if (data) {
      this.loadExistingAudio(data);
    }
  }

  @Input() set initialTranscript(text: string | null | undefined) {
    if (text) {
      this.transcriptText.set(text);
    }
  }

  @Output() voiceRecorded = new EventEmitter<Blob>();
  @Output() transcriptGenerated = new EventEmitter<string>();
  @Output() voiceCleared = new EventEmitter<void>();

  whisperStt = inject(WhisperSttService);

  isRecording = signal(false);
  isDictating = signal(false);
  audioRecorded = signal(false);
  audioUrl = signal<string | null>(null);
  transcriptText = signal<string>('');
  liveTranscript = signal<string>('');
  recordingDuration = signal(0);
  errorMessage = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private recordingInterval: any = null;
  private speechRecognition: any = null;
  private accumulatedSpeechText: string = '';

  // Audio Visualizer & Real-Time PCM Buffer members
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private animFrameId: number | null = null;
  private pcmBuffers: Float32Array[] = [];
  private hardwareSampleRate: number = 44100;

  ngOnInit(): void {
    this.initSpeechRecognition();
  }

  ngOnDestroy(): void {
    this.cleanupRecording();
  }

  private initSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = navigator.language || 'en-IN';

        this.speechRecognition.onresult = (event: any) => {
          let currentSessionText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentSessionText += event.results[i][0].transcript;
          }
          const text = currentSessionText.trim();
          if (text) {
            this.accumulatedSpeechText = text;
            this.liveTranscript.set(text);
            this.transcriptText.set(text);
            this.transcriptGenerated.emit(text);
          }
        };

        this.speechRecognition.onerror = (err: any) => {
          console.warn('SpeechRecognition warning:', err);
        };

        this.speechRecognition.onend = () => {
          if (this.isRecording() || this.isDictating()) {
            try {
              this.speechRecognition.start();
            } catch (e) {
              // ignore
            }
          }
        };
      } catch (e) {
        console.warn('SpeechRecognition initialization error:', e);
      }
    }
  }

  async startRecording(): Promise<void> {
    this.errorMessage.set(null);
    this.audioChunks = [];
    this.accumulatedSpeechText = '';
    this.liveTranscript.set('');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });

        if (this.audioUrl()) {
          URL.revokeObjectURL(this.audioUrl()!);
        }
        this.audioUrl.set(URL.createObjectURL(audioBlob));
        this.audioRecorded.set(true);

        let initialText = this.accumulatedSpeechText.trim();
        if (initialText) {
          this.transcriptText.set(initialText);
          this.transcriptGenerated.emit(initialText);
        } else {
          this.transcriptText.set('Transcribing voice note with AI...');
        }

        this.voiceRecorded.emit(audioBlob);

        const pcm16k = this.getCapturedPcm16k();

        try {
          let whisperText = '';
          if (pcm16k && pcm16k.length > 0) {
            whisperText = await this.whisperStt.transcribePcm(pcm16k);
          } else {
            whisperText = await this.whisperStt.transcribe(audioBlob);
          }

          console.log('Whisper AI final transcript:', whisperText);

          if (whisperText && whisperText.length > 0) {
            this.transcriptText.set(whisperText);
            this.transcriptGenerated.emit(whisperText);
          } else if (initialText) {
            this.transcriptText.set(initialText);
            this.transcriptGenerated.emit(initialText);
          } else {
            this.transcriptText.set('');
          }
        } catch (e) {
          console.warn('Whisper pass error:', e);
          if (initialText) {
            this.transcriptText.set(initialText);
            this.transcriptGenerated.emit(initialText);
          } else {
            this.transcriptText.set('');
          }
        }
      };

      this.mediaRecorder.start(200);
      this.isRecording.set(true);
      this.audioRecorded.set(false);
      this.recordingDuration.set(0);

      this.startVisualizerAndPcmCapture(this.mediaStream);

      this.recordingInterval = setInterval(() => {
        this.recordingDuration.update((d) => {
          const next = d + 1;
          if (next >= 180) {
            setTimeout(() => this.stopRecording(), 0);
            this.errorMessage.set('Max recording limit reached (3 minutes). Audio saved.');
          }
          return next;
        });
      }, 1000);

      if (this.speechRecognition) {
        try {
          this.speechRecognition.start();
        } catch (e) {
          console.warn('SpeechRecognition start failed or already running:', e);
        }
      }
    } catch (err: any) {
      console.error('Microphone error:', err);
      this.isRecording.set(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.errorMessage.set('Microphone permission denied. Allow mic access in browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.errorMessage.set('No microphone device found.');
      } else {
        this.errorMessage.set('Microphone error: ' + (err.message || 'Unknown'));
      }
    }
  }

  stopRecording(): void {
    this.stopVisualizer();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.requestData();
      } catch (e) {
        // ignore
      }
      this.mediaRecorder.stop();
    }

    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch (e) {
        // ignore
      }
    }

    this.stopStreamTracks();
    this.stopTimer();
    this.isRecording.set(false);
    this.isDictating.set(false);
  }

  startDictationOnly(): void {
    if (!this.speechRecognition) {
      alert('Speech recognition is not supported in this browser. You can type notes directly into the text box.');
      return;
    }
    try {
      this.isDictating.set(true);
      this.speechRecognition.start();
    } catch (e) {
      this.speechRecognition.stop();
      this.isDictating.set(false);
    }
  }

  onTranscriptChange(text: string): void {
    this.transcriptText.set(text);
    this.transcriptGenerated.emit(text);
  }

  deleteRecording(): void {
    this.stopRecording();
    if (this.audioUrl()) {
      URL.revokeObjectURL(this.audioUrl()!);
    }
    this.audioUrl.set(null);
    this.audioRecorded.set(false);
    this.transcriptText.set('');
    this.liveTranscript.set('');
    this.accumulatedSpeechText = '';
    this.recordingDuration.set(0);
    this.errorMessage.set(null);
    this.voiceCleared.emit();
  }

  reset(): void {
    this.deleteRecording();
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private loadExistingAudio(data: Blob | string): void {
    if (data instanceof Blob) {
      if (this.audioUrl()) URL.revokeObjectURL(this.audioUrl()!);
      this.audioUrl.set(URL.createObjectURL(data));
      this.audioRecorded.set(true);
    } else if (typeof data === 'string' && data.length > 0) {
      this.audioUrl.set(data);
      this.audioRecorded.set(true);
    }
  }

  private stopStreamTracks(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private stopTimer(): void {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
  }

  private cleanupRecording(): void {
    this.stopRecording();
    if (this.audioUrl() && this.audioUrl()?.startsWith('blob:')) {
      URL.revokeObjectURL(this.audioUrl()!);
    }
  }

  private startVisualizerAndPcmCapture(stream: MediaStream): void {
    try {
      this.stopVisualizer();
      this.pcmBuffers = [];

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioCtx = new AudioCtx();
      this.hardwareSampleRate = this.audioCtx.sampleRate || 44100;

      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      this.scriptProcessor = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isRecording()) {
          const inputData = e.inputBuffer.getChannelData(0);
          this.pcmBuffers.push(new Float32Array(inputData));
        }
      };
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioCtx.destination);

      requestAnimationFrame(() => this.drawWaveform());
    } catch (e) {
      console.warn('Visualizer & PCM capture error:', e);
    }
  }

  private getCapturedPcm16k(): Float32Array {
    let totalLength = 0;
    for (const buf of this.pcmBuffers) {
      totalLength += buf.length;
    }
    if (totalLength === 0) return new Float32Array(0);

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of this.pcmBuffers) {
      merged.set(buf, offset);
      offset += buf.length;
    }

    return this.resampleTo16k(merged, this.hardwareSampleRate);
  }

  private resampleTo16k(samples: Float32Array, oldSampleRate: number): Float32Array {
    const targetSampleRate = 16000;
    if (oldSampleRate === targetSampleRate) return samples;

    const ratio = oldSampleRate / targetSampleRate;
    const newLength = Math.round(samples.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originIndex = i * ratio;
      const index1 = Math.floor(originIndex);
      const index2 = Math.min(index1 + 1, samples.length - 1);
      const weight = originIndex - index1;
      result[i] = samples[index1] * (1 - weight) + samples[index2] * weight;
    }
    return result;
  }

  private drawWaveform(): void {
    if (!this.analyser || !this.isRecording()) return;

    const canvas = this.visualizerCanvas?.nativeElement;
    if (!canvas) {
      this.animFrameId = requestAnimationFrame(() => this.drawWaveform());
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth || 300;
      canvas.height = canvas.clientHeight || 56;
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 1.4;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * (canvas.height - 8);

      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(0.5, '#ec4899');
      gradient.addColorStop(1, '#f43f5e');

      ctx.fillStyle = gradient;
      const y = canvas.height - Math.max(4, barHeight);
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, Math.max(2, barWidth - 2), Math.max(4, barHeight), [3, 3, 0, 0]);
      } else {
        ctx.rect(x, y, Math.max(2, barWidth - 2), Math.max(4, barHeight));
      }
      ctx.fill();

      x += barWidth;
    }

    this.animFrameId = requestAnimationFrame(() => this.drawWaveform());
  }

  private stopVisualizer(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      try { this.scriptProcessor.disconnect(); } catch (e) {}
      this.scriptProcessor = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }
}
