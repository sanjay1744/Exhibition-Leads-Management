import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WhisperSttService } from '../../core/services/whisper-stt.service';

@Component({
  selector: 'app-voice-recorder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card-panel p-0 overflow-hidden h-full flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
      <div>
        <!-- Header with Rich Navy Gradient (#1a3a5c) -->
        <div class="bg-gradient-to-r from-[#142e4a] via-[#1a3a5c] to-[#204770] text-white p-3.5 px-4 flex items-center justify-between shadow-xs border-b border-white/10">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0 backdrop-blur-xs">
              <span class="material-icons text-blue-200 text-lg">mic</span>
            </div>
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-white">Voice Note Audio</h3>
              <p class="text-[10px] text-blue-200/80 font-medium">Dual AI Speech (Web & Whisper WASM)</p>
            </div>
          </div>
          @if (isRecording()) {
            <div class="flex items-center gap-1.5 bg-rose-500/20 text-rose-200 border border-rose-400/30 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold animate-pulse">
              <span class="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
              REC {{ formatTime(recordingDuration()) }} / 03:00
            </div>
          } @else {
            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-400/20 text-rose-100 border border-rose-300/30">AI Speech</span>
          }
        </div>

        <div class="p-4 space-y-3">
          <p class="text-xs text-slate-500 leading-relaxed">Record spoken notes to auto-fill remarks.</p>

          @if (errorMessage()) {
            <div class="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
              <span class="material-icons text-base text-rose-500 flex-shrink-0">error_outline</span>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <!-- Whisper AI Loading / Progress Indicator -->
          @if (whisperStt.isModelLoading() || whisperStt.isTranscribing()) {
            <div class="p-3 bg-slate-900 text-white rounded-xl space-y-2 text-xs shadow-md border border-slate-800 animate-fadeIn">
              <div class="flex items-center justify-between font-semibold">
                <span class="flex items-center gap-2 text-blue-300">
                  <span class="material-icons text-blue-400 animate-spin text-base">sync</span>
                  {{ whisperStt.loadingMessage() }}
                </span>
              </div>
            </div>
          }

          <!-- STATE 1: Ready to Record -->
          @if (!isRecording() && !audioRecorded()) {
            <button 
              type="button"
              (click)="startRecording()" 
              class="w-full justify-center text-xs py-2.5 px-4 rounded-xl font-extrabold shadow-sm hover:shadow-md flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white active:scale-[0.98] transition-all cursor-pointer"
            >
              <span class="material-icons text-base">fiber_manual_record</span>
              <span>Record Voice Note</span>
            </button>
          }

          <!-- STATE 2: Currently Recording -->
          @if (isRecording()) {
            <div class="space-y-2">
              <div class="flex items-center justify-between py-1.5 px-2 bg-red-50 rounded-lg border border-red-200">
                <div class="flex items-center gap-2">
                  <span class="material-icons text-red-600 text-base animate-bounce">graphic_eq</span>
                  <span class="text-xs font-bold text-red-800">Listening & Transcribing Live...</span>
                </div>
                <span class="text-[10px] text-red-600 font-mono font-bold">Max 3m</span>
              </div>

              <!-- Audio Waveform Visualizer Canvas -->
              <div class="relative w-full h-14 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center p-1 shadow-inner">
                <canvas #visualizerCanvas class="w-full h-full block rounded-lg"></canvas>
                <div class="absolute top-1 right-2 text-[9px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                  MIC ACTIVE
                </div>
              </div>

              @if (liveTranscript()) {
                <div class="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 max-h-16 overflow-y-auto italic">
                  "{{ liveTranscript() }}"
                </div>
              }

              <button 
                type="button"
                (click)="stopRecording()" 
                class="w-full btn bg-slate-900 hover:bg-black text-white justify-center text-xs py-2.5 rounded-lg font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <span class="material-icons text-sm">stop</span>
                Stop & Save Audio ({{ formatTime(recordingDuration()) }})
              </button>
            </div>
          }

          <!-- STATE 3: Recording Done + Transcript Available -->
          @if (audioRecorded()) {
            <div class="space-y-2.5">
              <!-- Audio Status Badge -->
              <div class="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2 rounded-lg text-xs flex items-center justify-between font-medium">
                <span class="flex items-center gap-1.5">
                  <span class="material-icons text-sm text-emerald-600">graphic_eq</span>
                  Audio Attached ({{ formatTime(recordingDuration()) }})
                </span>
                <span class="material-icons text-sm text-emerald-600">check_circle</span>
              </div>

              <!-- Audio Player -->
              @if (audioUrl()) {
                <div class="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <audio [src]="audioUrl()" controls class="w-full h-8 rounded focus:outline-none"></audio>
                </div>
              }

              <!-- Transcribed Notes Box -->
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span class="flex items-center gap-1 text-blue-700">
                    <span class="material-icons text-xs">subtitles</span>
                    Transcribed Discussion Notes:
                  </span>
                  @if (!isDictating()) {
                    <button 
                      type="button" 
                      (click)="startDictationOnly()" 
                      class="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                      title="Click to dictate or transcribe more spoken text"
                    >
                      <span class="material-icons text-[12px]">mic</span> Dictate
                    </button>
                  } @else {
                    <span class="text-[10px] text-red-600 font-bold animate-pulse">Listening...</span>
                  }
                </div>
                
                <textarea 
                  [ngModel]="transcriptText()"
                  (ngModelChange)="onTranscriptChange($event)"
                  rows="2" 
                  placeholder="Transcribed notes will appear here automatically..."
                  class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-blue-600 transition"
                ></textarea>

                <p class="text-[10px] text-slate-400 italic">
                  ✓ Auto-populates Visitor Discussion Remarks on form.
                </p>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-2 pt-1">
                <button 
                  type="button"
                  (click)="startRecording()" 
                  class="flex-1 btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-1.5 rounded-md font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span class="material-icons text-xs">mic</span>
                  Re-record
                </button>
                <button 
                  type="button"
                  (click)="deleteRecording()" 
                  class="btn bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs py-1.5 px-3 rounded-md font-medium transition flex items-center gap-1 cursor-pointer"
                  title="Delete Recording"
                >
                  <span class="material-icons text-xs">delete_outline</span>
                  Delete
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
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

        // Set live/accumulated Web Speech transcript first if available
        let initialText = this.accumulatedSpeechText.trim();
        if (initialText) {
          this.transcriptText.set(initialText);
          this.transcriptGenerated.emit(initialText);
        } else {
          this.transcriptText.set('Transcribing voice note with AI...');
        }

        this.voiceRecorded.emit(audioBlob);

        // Capture resampled 16kHz PCM audio
        const pcm16k = this.getCapturedPcm16k();

        // Perform Whisper AI high-accuracy pass
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
            this.errorMessage.set('No speech detected in audio. Please speak clearly into the microphone.');
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

      // Start Visualizer and native hardware PCM audio collection
      this.startVisualizerAndPcmCapture(this.mediaStream);

      // Start duration timer (max 3 minutes / 180s)
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

      // Start Speech Recognition live preview
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

  // Waveform Visualizer & Direct 16kHz PCM Audio Capture Methods
  private startVisualizerAndPcmCapture(stream: MediaStream): void {
    try {
      this.stopVisualizer();
      this.pcmBuffers = [];

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      // Initialize at native hardware rate (e.g. 44100Hz or 48000Hz)
      this.audioCtx = new AudioCtx();
      this.hardwareSampleRate = this.audioCtx.sampleRate || 44100;

      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      // Store on class instance to prevent V8 Garbage Collector from disconnecting audio processor
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

    // Resample from hardware rate (e.g., 44.1kHz or 48kHz) down to 16kHz for Whisper
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

