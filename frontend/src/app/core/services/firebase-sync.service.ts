import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadString,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { firestoreDb, firebaseStorage } from '../config/firebase.config';
import { LocalLead } from '../models/lead.model';

@Injectable({
  providedIn: 'root',
})
export class FirebaseSyncService {
  private readonly LEADS_COLLECTION = 'leads';
  private readonly EXHIBITIONS_COLLECTION = 'exhibitions';
  private readonly STALLS_COLLECTION = 'stalls';

  constructor() {}

  /**
   * Uploads base64 or DataURL business card photo to Firebase Storage
   */
  async uploadCardImage(leadNumber: string, photoDataUrl: string): Promise<string | null> {
    if (!photoDataUrl || !photoDataUrl.startsWith('data:')) {
      return null;
    }

    try {
      const storageRef = ref(firebaseStorage, `card_images/${leadNumber}.jpg`);
      const snapshot = await uploadString(storageRef, photoDataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(snapshot.ref);
      console.log(`[Firebase] Card image uploaded for ${leadNumber}:`, downloadUrl);
      return downloadUrl;
    } catch (err) {
      console.warn(`[Firebase] Card image upload skipped or failed for ${leadNumber}:`, err);
      return null;
    }
  }

  /**
   * Uploads voice recording Blob or DataURL to Firebase Storage
   */
  async uploadVoiceAudio(leadNumber: string, voiceBlobOrData: Blob | string): Promise<string | null> {
    if (!voiceBlobOrData) return null;

    try {
      const storageRef = ref(firebaseStorage, `voice_audio/${leadNumber}.webm`);
      let downloadUrl = '';

      if (typeof voiceBlobOrData === 'string' && voiceBlobOrData.startsWith('data:')) {
        const snapshot = await uploadString(storageRef, voiceBlobOrData, 'data_url');
        downloadUrl = await getDownloadURL(snapshot.ref);
      } else if (voiceBlobOrData instanceof Blob) {
        const snapshot = await uploadBytes(storageRef, voiceBlobOrData, { contentType: 'audio/webm' });
        downloadUrl = await getDownloadURL(snapshot.ref);
      }

      if (downloadUrl) {
        console.log(`[Firebase] Voice audio uploaded for ${leadNumber}:`, downloadUrl);
        return downloadUrl;
      }
      return null;
    } catch (err) {
      console.warn(`[Firebase] Voice audio upload skipped or failed for ${leadNumber}:`, err);
      return null;
    }
  }

  /**
   * Batch sync an array of local leads to Firestore
   * Returns list of synced lead IDs
   */
  async syncLeadsToFirestore(leads: LocalLead[]): Promise<string[]> {
    if (!leads || leads.length === 0) return [];

    const syncedIds: string[] = [];
    console.log(`[FirebaseSyncService] Committing ${leads.length} lead(s) to Firestore...`);

    for (const lead of leads) {
      try {
        const docRef = doc(firestoreDb, this.LEADS_COLLECTION, lead.id);

        // Upload card image & audio if present and not already a cloud URL
        let cardImageUrl: string | null = null;
        if (typeof lead.photoBlob === 'string' && lead.photoBlob.startsWith('data:')) {
          cardImageUrl = await this.uploadCardImage(lead.leadNumber, lead.photoBlob);
        }

        let audioUrl: string | null = null;
        if (lead.voiceBlob) {
          audioUrl = await this.uploadVoiceAudio(lead.leadNumber, lead.voiceBlob);
        }

        const firestoreData: Record<string, any> = {
          id: lead.id,
          leadNumber: lead.leadNumber,
          exhibitionId: lead.exhibitionId || '',
          repId: lead.repId || '',
          name: lead.name || '',
          company: lead.company || '',
          designation: lead.designation || '',
          phone: lead.phone || '',
          email: lead.email || '',
          website: lead.website || '',
          address: lead.address || '',
          captureMethod: lead.captureMethod || 'manual',
          interestLevel: lead.interestLevel || 'Warm',
          productCategory: lead.productCategory || [],
          priority: lead.priority || 'Medium',
          budget: lead.budget ?? null,
          purchaseTimeline: lead.purchaseTimeline || '',
          followUpDate: lead.followUpDate || '',
          remarks: lead.remarks || '',
          voiceNotesTranscript: lead.voiceNotesTranscript || '',
          syncStatus: 'Synced',
          createdAt: lead.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cloudSyncedAt: serverTimestamp(),
        };

        if (cardImageUrl) {
          firestoreData['cardImageUrl'] = cardImageUrl;
        }
        if (audioUrl) {
          firestoreData['voiceAudioUrl'] = audioUrl;
        }

        await setDoc(docRef, firestoreData, { merge: true });
        syncedIds.push(lead.id);
      } catch (docError) {
        console.error(`[FirebaseSyncService] Failed to sync lead ${lead.leadNumber} (${lead.id}):`, docError);
      }
    }

    console.log(`[FirebaseSyncService] Successfully synced ${syncedIds.length}/${leads.length} lead(s) to Firestore.`);
    return syncedIds;
  }

  /**
   * Fetch all synced leads from Firestore
   */
  async getAllLeadsFromFirestore(): Promise<any[]> {
    try {
      const q = query(collection(firestoreDb, this.LEADS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data());
    } catch (err) {
      console.error('[FirebaseSyncService] Error fetching leads from Firestore:', err);
      return [];
    }
  }

  /**
   * Save or update an exhibition in Firestore
   */
  async saveExhibitionToFirestore(exhibition: any): Promise<void> {
    try {
      const docRef = doc(firestoreDb, this.EXHIBITIONS_COLLECTION, exhibition.id);
      await setDoc(docRef, {
        ...exhibition,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('[FirebaseSyncService] Error saving exhibition to Firestore:', err);
    }
  }

  /**
   * Fetch all exhibitions from Firestore
   */
  async getExhibitionsFromFirestore(): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(firestoreDb, this.EXHIBITIONS_COLLECTION));
      return snapshot.docs.map((d) => d.data());
    } catch (err) {
      console.error('[FirebaseSyncService] Error fetching exhibitions from Firestore:', err);
      return [];
    }
  }

  /**
   * Save or update a stall in Firestore
   */
  async saveStallToFirestore(stall: any): Promise<void> {
    try {
      const docRef = doc(firestoreDb, this.STALLS_COLLECTION, stall.id);
      await setDoc(docRef, {
        ...stall,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('[FirebaseSyncService] Error saving stall to Firestore:', err);
    }
  }

  /**
   * Fetch all stalls from Firestore
   */
  async getStallsFromFirestore(): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(firestoreDb, this.STALLS_COLLECTION));
      return snapshot.docs.map((d) => d.data());
    } catch (err) {
      console.error('[FirebaseSyncService] Error fetching stalls from Firestore:', err);
      return [];
    }
  }
}
