import { Injectable, inject } from '@angular/core';
import { ApplicationDatabase } from './db.service';
import { NetworkService } from './network.service';
import { getApiUrl } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private db = inject(ApplicationDatabase);
  private network = inject(NetworkService);

  constructor() {
    // Automatically trigger sync when network status changes to online
    window.addEventListener('online', () => {
      this.syncPendingLeads();
    });
  }

  /**
   * Batch uploads pending local leads to .NET Web API endpoint
   */
  async syncPendingLeads(apiBaseUrl?: string): Promise<void> {
    const targetBaseUrl = apiBaseUrl || `${getApiUrl()}/v1`;
    if (!this.network.isOnline()) {
      console.log('[SyncService] Client is offline. Sync skipped.');
      return;
    }

    const pendingLeads = await this.db.getPendingLeads();
    if (pendingLeads.length === 0) {
      console.log('[SyncService] No pending leads to sync.');
      return;
    }

    console.log(`[SyncService] Uploading ${pendingLeads.length} pending lead(s)...`);

    try {
      const payload = {
        leads: pendingLeads.map((lead) => ({
          id: lead.id,
          leadNumber: lead.leadNumber,
          exhibitionId: lead.exhibitionId,
          repId: lead.repId,
          name: lead.name,
          company: lead.company,
          designation: lead.designation,
          phone: lead.phone,
          email: lead.email,
          website: lead.website,
          address: lead.address,
          captureMethod: lead.captureMethod,
          photoDataUrl: typeof lead.photoBlob === 'string' ? lead.photoBlob : undefined,
          interestLevel: lead.interestLevel,
          productCategory: lead.productCategory,
          priority: lead.priority,
          budget: lead.budget,
          purchaseTimeline: lead.purchaseTimeline,
          followUpDate: lead.followUpDate,
          remarks: lead.remarks,
          createdAt: lead.createdAt,
        })),
      };

      const response = await fetch(`${targetBaseUrl}/leads/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.syncedIds && result.syncedIds.length > 0) {
          await this.db.markLeadsSynced(result.syncedIds);
          console.log(`[SyncService] Successfully synced ${result.syncedIds.length} lead(s).`);
        }
      } else {
        console.error('[SyncService] Sync request failed:', response.statusText);
      }
    } catch (error) {
      console.error('[SyncService] Network error during batch sync:', error);
    }
  }
}
