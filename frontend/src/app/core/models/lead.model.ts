export type CaptureMethod = 'card_ocr' | 'qr_scan' | 'manual' | 'voice_note';
export type InterestLevel = 'Hot' | 'Warm' | 'Cold';
export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type LeadStatus = 'New' | 'Qualified' | 'Converted' | 'Closed';
export type SyncStatus = 'Pending' | 'Synced' | 'Failed';

export interface LocalLead {
  id: string; // UUID v4
  leadNumber: string; // Unique format e.g. S1L09698
  exhibitionId: string;
  repId: string;
  name: string;
  company: string;
  designation?: string;
  phone: string;
  email?: string;
  website?: string;
  address?: string;

  // Capture Meta
  captureMethod: CaptureMethod;
  photoBlob?: Blob | string; // Card image Blob or Base64/Data URL
  voiceBlob?: Blob | string; // Voice recording audio Blob
  voiceNotesTranscript?: string;

  // Qualification
  interestLevel: InterestLevel;
  productCategory: string[];
  priority: PriorityLevel;
  budget?: number;
  purchaseTimeline?: string;
  followUpDate?: string;
  remarks?: string;
  status: LeadStatus;

  // Synchronization Metadata & Audit Trail
  photoPath?: string; // Reference to OPFS / local device file path
  syncStatus: SyncStatus;
  syncError?: string;
  syncedAt?: string;
  deviceId?: string;
  appVersion?: string;
  version?: number;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface UserSession {
  token: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'SalesRep' | 'Manager' | 'Admin';
  expiresAt: string;
}
