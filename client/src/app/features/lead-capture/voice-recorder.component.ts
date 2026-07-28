import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-voice-recorder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="voice-recorder p-4 border rounded-lg bg-white shadow-sm">
      <h3 class="text-lg font-semibold mb-2">Voice Note Audio Recorder</h3>

      <div class="flex items-center gap-3">
        @if (!isRecording()) {
          <button 
            (click)="startRecording()" 
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium text-sm flex items-center gap-1"
          >
            🔴 Start Voice Recording
          </button>
        } @else {
          <button 
            (click)="stopRecording()" 
            class="px-4 py-2 bg-gray-800 text-white rounded hover:bg-black font-medium text-sm flex items-center gap-1"
          >
            ⏹️ Stop Recording
          </button>
          <span class="text-sm font-semibold text-red-600 animate-pulse">Recording...</span>
        }
      </div>

      @if (audioRecorded()) {
        <div class="mt-3 text-sm text-green-700 bg-green-50 p-2 rounded">
          ✓ Audio voice note attached (Ready to save).
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

    // Mock Audio Blob created locally offline
    const dummyAudioBlob = new Blob(['AUDIO_DATA_MOCK'], { type: 'audio/webm' });
    this.voiceRecorded.emit(dummyAudioBlob);
  }
}
