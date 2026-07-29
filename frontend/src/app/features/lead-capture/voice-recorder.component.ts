import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-voice-recorder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card-panel p-0 overflow-hidden h-full flex flex-col justify-between hover:shadow-md transition bg-white border border-slate-200 rounded-xl">
      <div>
        <!-- Header with Table Blue (#1a3a5c) theme -->
        <div class="bg-[#1a3a5c] text-white p-3.5 px-4 flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-icons text-blue-300 text-lg">mic</span>
            <h3 class="text-xs font-bold uppercase tracking-wider text-white">Voice Note Audio</h3>
          </div>
        </div>

        <div class="p-4">
          <p class="text-xs text-slate-500 mb-3">Record quick spoken discussion notes.</p>

          @if (!isRecording()) {
            <button 
              (click)="startRecording()" 
              class="w-full btn bg-red-600 hover:bg-red-700 text-white justify-center text-xs py-2.5 rounded-lg font-bold shadow-sm transition flex items-center gap-2"
            >
              <span class="material-icons text-sm">fiber_manual_record</span>
              Record Voice Note
            </button>
          } @else {
            <button 
              (click)="stopRecording()" 
              class="w-full btn bg-gray-900 hover:bg-black text-white justify-center text-xs py-2.5 rounded-lg font-bold shadow-sm transition animate-pulse flex items-center gap-2"
            >
              <span class="material-icons text-sm">stop</span>
              Stop & Save Audio
            </button>
          }
        </div>
      </div>

      @if (audioRecorded()) {
        <div class="mt-3 text-xs bg-red-50 border border-red-200 text-red-800 p-2 rounded-md flex items-center justify-between font-medium">
          <span class="flex items-center gap-1.5">
            <span class="material-icons text-sm text-red-600">graphic_eq</span>
            Audio Note Attached (0:15)
          </span>
          <span class="material-icons text-sm text-emerald-600">check_circle</span>
        </div>
      }
    </div>
  `
})
export class VoiceRecorderComponent {
  @Output() voiceRecorded = new EventEmitter<Blob>();

  isRecording = signal(false);
  audioRecorded = signal(false);

  startRecording(): void {
    this.isRecording.set(true);
    this.audioRecorded.set(false);
  }

  stopRecording(): void {
    this.isRecording.set(false);
    this.audioRecorded.set(true);

    const dummyAudioBlob = new Blob(['AUDIO_DATA_MOCK'], { type: 'audio/webm' });
    this.voiceRecorded.emit(dummyAudioBlob);
  }
}
