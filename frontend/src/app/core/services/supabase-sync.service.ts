import { Injectable } from '@angular/core';
import { supabase, supabaseConfig } from '../config/supabase.config';
import { LocalLead } from '../models/lead.model';

@Injectable({
  providedIn: 'root',
})
export class SupabaseSyncService {
  private readonly BUCKET_NAME = supabaseConfig.storageBucket || 'lead-assets';
  private readonly LEADS_TABLE = 'leads';
  private readonly EXHIBITIONS_TABLE = 'exhibitions';
  private readonly STALLS_TABLE = 'stalls';
  private readonly USERS_TABLE = 'users';

  constructor() {}

  /**
   * Helper to convert Base64 data URL to Uint8Array for Supabase storage upload
   */
  private dataUrlToBinary(dataUrl: string): { data: Uint8Array; contentType: string } | null {
    try {
      const parts = dataUrl.split(',');
      if (parts.length < 2) return null;
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const binaryStr = atob(parts[1]);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return { data: bytes, contentType: mime };
    } catch {
      return null;
    }
  }

  /**
   * Upload business card photo to Supabase Storage bucket ('lead-assets')
   * Returns public permanent CDN download URL
   */
  async uploadCardImage(leadNumber: string, photoDataUrl: string): Promise<string | null> {
    if (!photoDataUrl || !photoDataUrl.startsWith('data:')) {
      return photoDataUrl || null;
    }

    try {
      const binary = this.dataUrlToBinary(photoDataUrl);
      if (!binary) return photoDataUrl;

      const filePath = `cards/${leadNumber}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, binary.data, {
          contentType: binary.contentType,
          upsert: true,
        });

      if (error) {
        console.warn(`[Supabase Storage] Card upload warning for ${leadNumber}:`, error.message);
        return photoDataUrl; // Return base64 fallback if storage upload fails
      }

      const { data: publicData } = supabase.storage.from(this.BUCKET_NAME).getPublicUrl(filePath);
      console.log(`[Supabase Storage] Card uploaded successfully for ${leadNumber}:`, publicData.publicUrl);
      return publicData.publicUrl;
    } catch (err) {
      console.warn(`[Supabase Storage] Error uploading card for ${leadNumber}:`, err);
      return photoDataUrl;
    }
  }

  /**
   * Upload voice recording Blob or DataURL to Supabase Storage
   * Returns public permanent CDN download URL
   */
  async uploadVoiceAudio(leadNumber: string, voiceBlobOrData: Blob | string): Promise<string | null> {
    if (!voiceBlobOrData) return null;

    try {
      const filePath = `audio/${leadNumber}_${Date.now()}.webm`;
      let fileBody: Blob | Uint8Array;
      let contentType = 'audio/webm';

      if (typeof voiceBlobOrData === 'string' && voiceBlobOrData.startsWith('data:')) {
        const bin = this.dataUrlToBinary(voiceBlobOrData);
        if (!bin) return null;
        fileBody = bin.data;
        contentType = bin.contentType;
      } else if (voiceBlobOrData instanceof Blob) {
        fileBody = voiceBlobOrData;
        contentType = voiceBlobOrData.type || 'audio/webm';
      } else {
        return null;
      }

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, fileBody, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.warn(`[Supabase Storage] Audio upload warning for ${leadNumber}:`, error.message);
        return null;
      }

      const { data: publicData } = supabase.storage.from(this.BUCKET_NAME).getPublicUrl(filePath);
      console.log(`[Supabase Storage] Audio uploaded successfully for ${leadNumber}:`, publicData.publicUrl);
      return publicData.publicUrl;
    } catch (err) {
      console.warn(`[Supabase Storage] Error uploading audio for ${leadNumber}:`, err);
      return null;
    }
  }

  /**
   * Batch sync an array of local leads to Supabase PostgreSQL database
   */
  async syncLeadsToSupabase(leads: LocalLead[]): Promise<string[]> {
    if (!leads || leads.length === 0) return [];

    const syncedIds: string[] = [];
    console.log(`[SupabaseSyncService] Committing ${leads.length} lead(s) to Supabase...`);

    for (const lead of leads) {
      try {
        let cardImageUrl: string | null = null;
        if (typeof lead.photoBlob === 'string' && lead.photoBlob.startsWith('data:')) {
          cardImageUrl = await this.uploadCardImage(lead.leadNumber, lead.photoBlob);
        } else if (typeof lead.photoBlob === 'string') {
          cardImageUrl = lead.photoBlob;
        }

        let audioUrl: string | null = null;
        if (lead.voiceBlob) {
          audioUrl = await this.uploadVoiceAudio(lead.leadNumber, lead.voiceBlob);
        }

        const supabaseRecord = {
          id: lead.id,
          lead_number: lead.leadNumber,
          exhibition_id: lead.exhibitionId || null,
          rep_id: lead.repId || null,
          name: lead.name || '',
          company: lead.company || '',
          designation: lead.designation || '',
          phone: lead.phone || '',
          email: lead.email || '',
          website: lead.website || '',
          address: lead.address || '',
          capture_method: lead.captureMethod || 'manual',
          card_image_url: cardImageUrl || null,
          voice_audio_url: audioUrl || null,
          interest_level: lead.interestLevel || 'Warm',
          product_category: lead.productCategory || [],
          priority: lead.priority || 'Medium',
          budget: lead.budget ?? null,
          purchase_timeline: lead.purchaseTimeline || '',
          follow_up_date: lead.followUpDate || '',
          remarks: lead.remarks || '',
          voice_notes_transcript: lead.voiceNotesTranscript || '',
          sync_status: 'Synced',
          created_at: lead.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from(this.LEADS_TABLE).upsert(supabaseRecord, { onConflict: 'id' });
        if (error) {
          console.warn(`[SupabaseSyncService] Database write skipped or error for ${lead.leadNumber}:`, error.message);
        }

        syncedIds.push(lead.id);
      } catch (leadErr) {
        console.error(`[SupabaseSyncService] Failed to sync lead ${lead.leadNumber}:`, leadErr);
      }
    }

    console.log(`[SupabaseSyncService] Successfully synced ${syncedIds.length}/${leads.length} lead(s) to Supabase.`);
    return syncedIds;
  }

  /**
   * Fetch all synced leads from Supabase
   */
  async getAllLeadsFromSupabase(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from(this.LEADS_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.warn('[SupabaseSyncService] Error fetching leads from Supabase:', error?.message);
        return [];
      }

      return data.map((d: any) => ({
        id: d.id,
        leadNumber: d.lead_number,
        exhibitionId: d.exhibition_id,
        repId: d.rep_id,
        name: d.name,
        company: d.company,
        designation: d.designation,
        phone: d.phone,
        email: d.email,
        website: d.website,
        address: d.address,
        captureMethod: d.capture_method,
        cardImageUrl: d.card_image_url,
        voiceAudioUrl: d.voice_audio_url,
        interestLevel: d.interest_level,
        productCategory: d.product_category,
        priority: d.priority,
        budget: d.budget,
        purchaseTimeline: d.purchase_timeline,
        followUpDate: d.follow_up_date,
        remarks: d.remarks,
        voiceNotesTranscript: d.voice_notes_transcript,
        syncStatus: d.sync_status,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    } catch (err) {
      console.error('[SupabaseSyncService] Error fetching leads:', err);
      return [];
    }
  }

  /**
   * Save or update an exhibition in Supabase
   */
  async saveExhibitionToSupabase(exhibition: any): Promise<void> {
    try {
      const record = {
        id: exhibition.id,
        code: exhibition.code,
        name: exhibition.name,
        organizer: exhibition.organizer || '',
        venue: exhibition.venue || '',
        start_date: exhibition.startDate || null,
        end_date: exhibition.endDate || null,
        duration_days: exhibition.durationDays || 3,
        description: exhibition.description || '',
        status: exhibition.status || 'Active',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(this.EXHIBITIONS_TABLE).upsert(record, { onConflict: 'id' });
      if (error) {
        console.warn('[SupabaseSyncService] Error saving exhibition to Supabase:', error.message);
      }
    } catch (err) {
      console.error('[SupabaseSyncService] Exception saving exhibition:', err);
    }
  }

  /**
   * Fetch all exhibitions from Supabase
   */
  async getExhibitionsFromSupabase(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from(this.EXHIBITIONS_TABLE).select('*');
      if (error || !data) return [];
      return data.map((d: any) => {
        const match = (d.code || '').match(/EXH-STL(\d+)-/i);
        const codeStallCount = match ? parseInt(match[1], 10) : 1;
        return {
          id: d.id,
          code: d.code,
          name: d.name,
          organizer: d.organizer,
          venue: d.venue,
          startDate: d.start_date,
          endDate: d.end_date,
          durationDays: d.duration_days,
          description: d.description,
          status: d.status,
          stallCount: d.stall_count !== undefined ? d.stall_count : codeStallCount,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Save or update a stall in Supabase
   */
  async saveStallToSupabase(stall: any): Promise<void> {
    try {
      const record = {
        id: stall.id,
        code: stall.code,
        name: stall.name,
        exhibition_id: stall.exhibitionId || null,
        event_name: stall.eventName || '',
        organizer: stall.organizer || '',
        duration_days: stall.durationDays || 3,
        start_date: stall.startDate || null,
        end_date: stall.endDate || null,
        location: stall.location || '',
        hall_number: stall.hallNumber || '',
        booth_number: stall.boothNumber || '',
        owner_id: stall.ownerId || null,
        owner_name: stall.ownerName || '',
        status: stall.status || 'Active',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(this.STALLS_TABLE).upsert(record, { onConflict: 'id' });
      if (error) {
        console.warn('[SupabaseSyncService] Error saving stall to Supabase:', error.message);
      }
    } catch (err) {
      console.error('[SupabaseSyncService] Exception saving stall:', err);
    }
  }

  /**
   * Fetch all stalls from Supabase
   */
  async getStallsFromSupabase(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from(this.STALLS_TABLE).select('*');
      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        exhibitionId: d.exhibition_id,
        eventName: d.event_name,
        organizer: d.organizer,
        durationDays: d.duration_days,
        startDate: d.start_date,
        endDate: d.end_date,
        location: d.location,
        hallNumber: d.hall_number,
        boothNumber: d.booth_number,
        ownerId: d.owner_id,
        ownerName: d.owner_name,
        status: d.status,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Delete a stall from Supabase
   */
  async deleteStallFromSupabase(id: string): Promise<void> {
    try {
      await supabase.from(this.STALLS_TABLE).delete().eq('id', id);
    } catch (err) {
      console.warn('[SupabaseSyncService] Error deleting stall from Supabase:', err);
    }
  }

  /**
   * Save or update a user in Supabase
   */
  async saveUserToSupabase(user: any): Promise<void> {
    try {
      const record = {
        id: user.id,
        username: user.username,
        full_name: user.fullName,
        short_name: user.shortName || user.username,
        email: user.email || '',
        password: user.password || '123456',
        role: user.role || 'Marketing',
        user_group: user.userGroup || 'Sales Team',
        status: user.status || 'Active',
        phone: user.phone || '',
        address1: user.address1 || '',
        address2: user.address2 || '',
        city: user.city || '',
        state: user.state || '',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(this.USERS_TABLE).upsert(record, { onConflict: 'id' });
      if (error) {
        console.warn('[SupabaseSyncService] Error saving user to Supabase:', error.message);
      }
    } catch (err) {
      console.error('[SupabaseSyncService] Exception saving user:', err);
    }
  }

  /**
   * Fetch all users from Supabase
   */
  async getUsersFromSupabase(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from(this.USERS_TABLE).select('*');
      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        username: d.username,
        fullName: d.full_name,
        shortName: d.short_name,
        email: d.email,
        password: d.password,
        role: d.role,
        userGroup: d.user_group,
        status: d.status,
        phone: d.phone,
        address1: d.address1,
        address2: d.address2,
        city: d.city,
        state: d.state,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Delete a user from Supabase
   */
  async deleteUserFromSupabase(id: string): Promise<void> {
    try {
      await supabase.from(this.USERS_TABLE).delete().eq('id', id);
    } catch (err) {
      console.warn('[SupabaseSyncService] Error deleting user from Supabase:', err);
    }
  }
}
