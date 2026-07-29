import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-voice-recorder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card-panel p-0 overflow-hidden h-full flex flex-col justify-between hover:shadow-md transition bg-white border border-slate-200 rounded-xl">
      <div>
        <!-- Header -->
        <div class="bg-[#1a3a5c] text-white p-3.5 px-4 flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-icons text-blue-300 text-lg">mic</span>
            <h3 class="text-xs font-bold uppercase tracking-wider text-white">Voice Note Audio</h3>
          </div>
          @if (isRecording()) {
            <div class="flex items-center gap-1.5 bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-[11px] font-mono animate-pulse">
              <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              REC {{ formatTime(recordingDuration()) }}
            </div>
          }
        </div>

        <div class="p-4 space-y-3">
          <p class="text-xs text-slate-500">Record spoken discussion notes. Auto-transcribed for Lead Remarks.</p>

          @if (errorMessage()) {
            <div class="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
              <span class="material-icons text-base text-rose-500 flex-shrink-0">error_outline</span>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <!-- STATE 1: Ready to Record -->
          @if (!isRecording() && !audioRecorded()) {
            <button 
              type="button"
              (click)="startRecording()" 
              class="w-full btn bg-red-600 hover:bg-red-700 text-white justify-center text-xs py-2.5 rounded-lg font-bold shadow-sm transition flex items-center gap-2"
            >
              <span class="material-icons text-sm">fiber_manual_record</span>
              Record Voice Note
            </button>
          }

          <!-- STATE 2: Currently Recording -->
          @if (isRecording()) {
            <div class="space-y-2">
              <div class="flex items-center justify-center gap-2 py-2.5 bg-red-50 rounded-lg border border-red-200 animate-pulse">
                <span class="material-icons text-red-600 text-base animate-bounce">graphic_eq</span>
                <span class="text-xs font-bold text-red-800">Listening & Transcribing Live...</span>
              </div>

              @if (liveTranscript()) {
                <div class="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 max-h-16 overflow-y-auto italic">
                  "{{ liveTranscript() }}"
                </div>
              }

              <button 
                type="button"
                (click)="stopRecording()" 
                class="w-full btn bg-slate-900 hover:bg-black text-white justify-center text-xs py-2.5 rounded-lg font-bold shadow-sm transition flex items-center gap-2"
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
                      class="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-semibold"
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
                  class="flex-1 btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-1.5 rounded-md font-medium transition flex items-center justify-center gap-1"
                >
                  <span class="material-icons text-xs">mic</span>
                  Re-record
                </button>
                <button 
                  type="button"
                  (click)="deleteRecording()" 
                  class="btn bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs py-1.5 px-3 rounded-md font-medium transition flex items-center gap-1"
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

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });

        if (this.audioUrl()) {
          URL.revokeObjectURL(this.audioUrl()!);
        }
        this.audioUrl.set(URL.createObjectURL(audioBlob));
        this.audioRecorded.set(true);

        // Finalize transcript
        let finalText = this.accumulatedSpeechText.trim();
        if (!finalText) {
          finalText = `Spoken Voice Note Discussion (${this.formatTime(this.recordingDuration())})`;
        }

        this.transcriptText.set(finalText);
        this.voiceRecorded.emit(audioBlob);
        this.transcriptGenerated.emit(finalText);
      };

      this.mediaRecorder.start(200);
      this.isRecording.set(true);
      this.audioRecorded.set(false);
      this.recordingDuration.set(0);

      this.recordingInterval = setInterval(() => {
        this.recordingDuration.update((d) => d + 1);
      }, 1000);

      // Start Speech Recognition
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
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
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
}
