import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { LocalLead, UserSession } from '../models/lead.model';
import { AppUser } from '../models/user.model';

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
  stalls!: Table<any, string>;
  exhibitions!: Table<any, string>;
  users!: Table<AppUser, string>;

  constructor() {
    super('ExhibitionLeadCaptureDB');

    this.version(4).stores({
      leads: 'id, &leadNumber, exhibitionId, repId, phone, email, syncStatus, createdAt',
      userSession: 'userId, expiresAt',
      brochures: 'id, title',
      stalls: 'id, code, name, exhibitionId',
      exhibitions: 'id, code, name, status',
      users: 'id, username, email, role, status',
    });

    this.version(5).stores({
      users: 'id, username, email, role, status',
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

  /**
   * Stalls Local Cache
   */
  async getAllStalls(): Promise<any[]> {
    return await this.stalls.toArray();
  }

  async saveStall(stall: any): Promise<string> {
    return await this.stalls.put(stall);
  }

  async deleteStall(id: string): Promise<void> {
    await this.stalls.delete(id);
  }

  /**
   * Exhibitions Local Cache
   */
  async getAllExhibitions(): Promise<any[]> {
    return await this.exhibitions.toArray();
  }

  async saveExhibition(exhibition: any): Promise<string> {
    return await this.exhibitions.put(exhibition);
  }

  async deleteExhibition(id: string): Promise<void> {
    await this.exhibitions.delete(id);
  }

  /**
   * Users Local Cache
   */
  async getAllUsers(): Promise<AppUser[]> {
    return await this.users.toArray();
  }

  async getUserById(id: string): Promise<AppUser | undefined> {
    return await this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<AppUser | undefined> {
    return await this.users.where('username').equalsIgnoreCase(username).first();
  }

  async saveUser(user: AppUser): Promise<string> {
    return await this.users.put(user);
  }

  async deleteUser(id: string): Promise<void> {
    await this.users.delete(id);
  }
}
