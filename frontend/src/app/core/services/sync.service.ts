import { Injectable, inject } from '@angular/core';
import { ApplicationDatabase } from './db.service';
import { NetworkService } from './network.service';
import { SupabaseSyncService } from './supabase-sync.service';

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private db = inject(ApplicationDatabase);
  private network = inject(NetworkService);
  private supabaseSync = inject(SupabaseSyncService);

  constructor() {
    // Automatically trigger sync when network status changes to online
    window.addEventListener('online', () => {
      this.syncPendingLeads();
    });
  }

  /**
   * Batch uploads pending local leads to Supabase PostgreSQL and Supabase Storage
   */
  async syncPendingLeads(): Promise<void> {
    if (!this.network.isOnline()) {
      console.log('[SyncService] Client is offline. Sync skipped.');
      return;
    }

    const pendingLeads = await this.db.getPendingLeads();
    if (pendingLeads.length === 0) {
      console.log('[SyncService] No pending leads to sync.');
      return;
    }

    console.log(`[SyncService] Uploading ${pendingLeads.length} pending lead(s) to Supabase Cloud...`);

    // Direct Sync to Supabase Database & Storage
    try {
      const syncedIds = await this.supabaseSync.syncLeadsToSupabase(pendingLeads);
      if (syncedIds && syncedIds.length > 0) {
        await this.db.markLeadsSynced(syncedIds);
        console.log(`[SyncService] Successfully synced ${syncedIds.length} lead(s) to Supabase.`);
      }
    } catch (err) {
      console.error('[SyncService] Supabase sync error:', err);
    }
  }
}
