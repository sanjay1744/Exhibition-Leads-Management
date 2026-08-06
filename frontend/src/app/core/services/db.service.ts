import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { LocalLead, UserSession } from '../models/lead.model';

export interface BrochureItem {
  id: string;
  title: string;
  pdfBlob?: Blob;
  downloadUrl?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApplicationDatabase extends Dexie {
  leads!: Table<LocalLead, string>;
  userSession!: Table<UserSession, string>;
  brochures!: Table<BrochureItem, string>;

  constructor() {
    super('ExhibitionLeadCaptureDB');

    this.version(2).stores({
      leads: 'id, &leadNumber, exhibitionId, repId, phone, email, syncStatus, createdAt',
      userSession: 'userId, expiresAt',
      brochures: 'id, title',
    });

    this.requestPersistentStorage();
  }

  /**
   * Request Persistent Storage from Browser to prevent eviction during 3+ day offline use
   */
  async requestPersistentStorage(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const result = await navigator.storage.persist();
        console.log(`[Database] Storage persistent allocation: ${result}`);
        return result;
      }
      return true;
    }
    return false;
  }

  /**
   * Save Card Image to Origin Private File System (OPFS) to prevent 2x IndexedDB memory duplication
   */
  async saveImageToOPFS(fileName: string, dataUrlOrBlob: string | Blob): Promise<string> {
    try {
      if (!navigator.storage || !navigator.storage.getDirectory) {
        return fileName; // Fallback
      }
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      if (typeof dataUrlOrBlob === 'string') {
        const res = await fetch(dataUrlOrBlob);
        const blob = await res.blob();
        await writable.write(blob);
      } else {
        await writable.write(dataUrlOrBlob);
      }
      await writable.close();
      return fileName;
    } catch (e) {
      console.warn('[Database] OPFS write fallback to memory:', e);
      return fileName;
    }
  }

  /**
   * Retrieve Card Image from OPFS as Object URL
   */
  async getImageFromOPFS(fileName: string): Promise<string | null> {
    try {
      if (!navigator.storage || !navigator.storage.getDirectory) return null;
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch (e) {
      return null;
    }
  }

  /**
   * Save or Update a Lead in IndexedDB
   */
  async saveLead(lead: LocalLead): Promise<string> {
    return await this.leads.put(lead);
  }

  /**
   * Get a single Lead by ID
   */
  async getLeadById(id: string): Promise<LocalLead | undefined> {
    return await this.leads.get(id);
  }

  /**
   * Delete a Lead from IndexedDB
   */
  async deleteLead(id: string): Promise<void> {
    await this.leads.delete(id);
  }

  /**
   * Fetch all leads pending synchronization
   */
  async getPendingLeads(): Promise<LocalLead[]> {
    return await this.leads.where('syncStatus').equals('Pending').toArray();
  }

  /**
   * Get count of pending leads waiting for cloud sync
   */
  async getPendingCount(): Promise<number> {
    return await this.leads.where('syncStatus').equals('Pending').count();
  }

  /**
   * Fetch all leads ordered by creation time
   */
  async getAllLeads(): Promise<LocalLead[]> {
    return await this.leads.orderBy('createdAt').reverse().toArray();
  }

  /**
   * Update sync status of uploaded leads
   */
  async markLeadsSynced(leadIds: string[]): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.transaction('rw', this.leads, async () => {
      for (const id of leadIds) {
        await this.leads.update(id, { syncStatus: 'Synced', syncedAt: nowIso, updatedAt: nowIso });
      }
    });
  }

  /**
   * Emergency Disaster Recovery: Export all local leads & images to JSON for USB backup
   */
  async exportEmergencyBackup(): Promise<void> {
    const allLeads = await this.getAllLeads();
    const exportPayload = {
      app: 'ExhibitionLeadsManager',
      exportedAt: new Date().toISOString(),
      leadCount: allLeads.length,
      leads: allLeads
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `exhibition_leads_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
