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
   * Fetch all leads ordered by creation time
   */
  async getAllLeads(): Promise<LocalLead[]> {
    return await this.leads.orderBy('createdAt').reverse().toArray();
  }

  /**
   * Update sync status of uploaded leads
   */
  async markLeadsSynced(leadIds: string[]): Promise<void> {
    await this.transaction('rw', this.leads, async () => {
      for (const id of leadIds) {
        await this.leads.update(id, { syncStatus: 'Synced', updatedAt: new Date().toISOString() });
      }
    });
  }
}
