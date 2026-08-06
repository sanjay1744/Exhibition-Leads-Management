import { Injectable, inject, signal } from '@angular/core';
import { ApplicationDatabase } from './db.service';
import { NetworkService } from './network.service';
import { getApiUrl } from '../config/api.config';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private db = inject(ApplicationDatabase);
  private network = inject(NetworkService);

  readonly isSyncing = signal<boolean>(false);
  readonly pendingCount = signal<number>(0);
  readonly syncProgress = signal<{ current: number; total: number } | null>(null);
  readonly syncError = signal<string | null>(null);

  constructor() {
    // Initial fetch of pending lead count for UI badges
    this.refreshPendingCount();
  }

  /**
   * Recalculate count of unsynced offline leads
   */
  async refreshPendingCount(): Promise<number> {
    const count = await this.db.getPendingCount();
    this.pendingCount.set(count);
    return count;
  }

  /**
   * User-triggered manual batch upload of pending local leads & images to Cloud API / Server
   */
  async syncPendingLeads(apiBaseUrl?: string): Promise<SyncResult> {
    const targetBaseUrl = apiBaseUrl || `${getApiUrl()}/v1`;
    this.syncError.set(null);

    if (!this.network.isOnline()) {
      const msg = 'Unable to sync: Internet connection is currently offline.';
      this.syncError.set(msg);
      return { success: false, syncedCount: 0, message: msg };
    }

    const pendingLeads = await this.db.getPendingLeads();
    if (pendingLeads.length === 0) {
      await this.refreshPendingCount();
      return { success: true, syncedCount: 0, message: 'No pending leads to sync.' };
    }

    this.isSyncing.set(true);
    this.syncProgress.set({ current: 0, total: pendingLeads.length });

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
        const syncedCount = result.syncedIds?.length || 0;
        if (syncedCount > 0) {
          await this.db.markLeadsSynced(result.syncedIds);
        }
        await this.refreshPendingCount();
        this.syncProgress.set({ current: syncedCount, total: pendingLeads.length });

        return {
          success: true,
          syncedCount: syncedCount,
          message: `Successfully synced ${syncedCount} of ${pendingLeads.length} lead(s) to the cloud.`
        };
      } else {
        const errText = `Sync request failed with status: ${response.status} ${response.statusText}`;
        this.syncError.set(errText);
        return { success: false, syncedCount: 0, message: errText };
      }
    } catch (error: any) {
      const errText = `Network error during cloud sync: ${error?.message || error}`;
      this.syncError.set(errText);
      return { success: false, syncedCount: 0, message: errText };
    } finally {
      this.isSyncing.set(false);
      this.syncProgress.set(null);
    }
  }
}
