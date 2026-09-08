import { Injectable, inject, signal } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApplicationDatabase } from './db.service';
import { SupabaseSyncService } from './supabase-sync.service';
import { AppUser } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private dbService = inject(ApplicationDatabase);
  private supabaseSync = inject(SupabaseSyncService);

  users = signal<AppUser[]>([]);

  constructor() {
    this.initUsers();
  }

  /**
   * Load authoritative users from Supabase (Primary DB) and prune stale local records
   */
  async initUsers(): Promise<void> {
    try {
      // 1. Fetch live authoritative users from Supabase
      const remoteUsers = await this.supabaseSync.getUsersFromSupabase();
      if (remoteUsers && remoteUsers.length > 0) {
        this.users.set(remoteUsers);

        // Supabase is Primary DB: Prune stale local users that do not exist in Supabase
        const remoteIds = new Set(remoteUsers.map((u) => u.id));
        const remoteUsernames = new Set(remoteUsers.map((u) => u.username.toLowerCase()));
        const localUsers = await this.dbService.getAllUsers();
        for (const localU of localUsers) {
          if (!remoteIds.has(localU.id) && !remoteUsernames.has(localU.username.toLowerCase())) {
            await this.dbService.deleteUser(localU.id);
          }
        }
        for (const u of remoteUsers) {
          await this.dbService.saveUser(u);
        }
        return;
      }

      // Offline fallback only if Supabase returns nothing or is unreachable
      const localUsers = await this.dbService.getAllUsers();
      if (localUsers.length > 0) {
        this.users.set(localUsers);
      }
    } catch (err) {
      console.warn('[UserService] Error during initUsers, falling back to local:', err);
      const localUsers = await this.dbService.getAllUsers();
      this.users.set(localUsers);
    }
  }

  /**
   * Fetch all users as an Observable
   */
  getUsers(): Observable<AppUser[]> {
    return from(this.fetchUsersAsync());
  }

  private async fetchUsersAsync(): Promise<AppUser[]> {
    try {
      const remote = await this.supabaseSync.getUsersFromSupabase();
      if (remote && remote.length > 0) {
        this.users.set(remote);

        // Supabase is Primary DB: synchronize local Dexie cache
        const remoteIds = new Set(remote.map((u) => u.id));
        const remoteUsernames = new Set(remote.map((u) => u.username.toLowerCase()));
        const localUsers = await this.dbService.getAllUsers();
        for (const localU of localUsers) {
          if (!remoteIds.has(localU.id) && !remoteUsernames.has(localU.username.toLowerCase())) {
            await this.dbService.deleteUser(localU.id);
          }
        }
        for (const u of remote) {
          await this.dbService.saveUser(u);
        }
        return remote;
      }

      const local = await this.dbService.getAllUsers();
      this.users.set(local);
      return local;
    } catch (err) {
      console.warn('[UserService] Error fetching from Supabase, returning local:', err);
      const local = await this.dbService.getAllUsers();
      this.users.set(local);
      return local;
    }
  }

  /**
   * Create a new user in Supabase and Dexie
   */
  createUser(userData: Partial<AppUser>): Observable<AppUser> {
    return from(this.createUserAsync(userData));
  }

  private async createUserAsync(userData: Partial<AppUser>): Promise<AppUser> {
    const rawUsername = (userData.username || '').trim();
    if (!rawUsername) {
      throw new Error('Username is required.');
    }

    // Check for duplicate username in current list
    const lowerUser = rawUsername.toLowerCase();
    const existing = this.users().find((u) => u.username.toLowerCase() === lowerUser);
    if (existing) {
      throw new Error(`Username '${rawUsername}' is already taken. Please choose another username.`);
    }

    const newUser: AppUser = {
      id: crypto.randomUUID(),
      fullName: userData.fullName ? userData.fullName.trim() : 'User',
      username: rawUsername,
      email: userData.email ? userData.email.trim() : `${rawUsername.toLowerCase()}@company.com`,
      role: userData.role || 'Marketing',
      userGroup: userData.userGroup || 'Sales Team',
      status: userData.status || 'Active',
      password: userData.password || 'Admin@123',
      phone: userData.phone || '',
      shortName: userData.shortName || rawUsername,
      address1: userData.address1 || '',
      address2: userData.address2 || '',
      city: userData.city || '',
      state: userData.state || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to Supabase (Primary Cloud Database)
    await this.supabaseSync.saveUserToSupabase(newUser);

    // Save locally to Dexie (Safe Offline Cache)
    try {
      await this.dbService.saveUser(newUser);
    } catch (localErr) {
      console.warn('[UserService] Could not save to local Dexie cache:', localErr);
    }

    this.users.update((list) => [...list, newUser]);
    return newUser;
  }

  /**
   * Update an existing user in Supabase and Dexie
   */
  updateUser(id: string, updates: Partial<AppUser>): Observable<AppUser> {
    return from(this.updateUserAsync(id, updates));
  }

  private async updateUserAsync(id: string, updates: Partial<AppUser>): Promise<AppUser> {
    const existing = (await this.dbService.getUserById(id)) || this.users().find((u) => u.id === id);
    const updatedUser: AppUser = {
      ...(existing || { id, username: 'user', fullName: 'User', email: 'user@company.com', role: 'Marketing', status: 'Active' }),
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    // Save to Supabase
    await this.supabaseSync.saveUserToSupabase(updatedUser);

    // Save locally
    try {
      await this.dbService.saveUser(updatedUser);
    } catch (localErr) {
      console.warn('[UserService] Could not update local Dexie cache:', localErr);
    }

    this.users.update((list) => list.map((u) => (u.id === id ? updatedUser : u)));
    return updatedUser;
  }

  /**
   * Delete a user in Supabase and Dexie
   */
  deleteUser(id: string): Observable<void> {
    return from(this.deleteUserAsync(id));
  }

  private async deleteUserAsync(id: string): Promise<void> {
    await this.dbService.deleteUser(id);
    await this.supabaseSync.deleteUserFromSupabase(id);
    this.users.update((list) => list.filter((u) => u.id !== id));
  }

  /**
   * Reset user password in Supabase and Dexie
   */
  resetPassword(id: string, newPass: string): Observable<void> {
    return from(this.updateUserAsync(id, { password: newPass })).pipe(
      map(() => void 0)
    );
  }

  /**
   * Update Profile details in Supabase and Dexie
   */
  updateProfile(id: string, profileData: Partial<AppUser>): Observable<void> {
    return from(this.updateUserAsync(id, profileData)).pipe(
      map(() => void 0)
    );
  }

  /**
   * Authenticate against Supabase users table and local Dexie
   */
  async authenticate(username: string, pass: string): Promise<AppUser | null> {
    const cleanUser = username.trim().toLowerCase();

    // 1. Check local Dexie first
    let user = await this.dbService.getUserByUsername(cleanUser);

    // 2. If not found locally or password mismatch, fetch latest from Supabase
    if (!user || user.password !== pass) {
      const remoteUsers = await this.supabaseSync.getUsersFromSupabase();
      for (const u of remoteUsers) {
        await this.dbService.saveUser(u);
      }
      user = await this.dbService.getUserByUsername(cleanUser);
    }

    // Check credentials if user found
    if (user && (!user.password || user.password === pass)) {
      return user;
    }

    return null;
  }

  /**
   * Ensure at least one initial administrator exists if empty
   */
  async ensureInitialAdmin(): Promise<AppUser> {
    const existing = await this.dbService.getAllUsers();
    if (existing.length > 0) {
      return existing[0];
    }

    const remote = await this.supabaseSync.getUsersFromSupabase();
    if (remote.length > 0) {
      for (const u of remote) {
        await this.dbService.saveUser(u);
      }
      return remote[0];
    }

    // Auto-create initial Admin user if completely empty
    const adminUser = await this.createUserAsync({
      username: 'sanjay',
      fullName: 'Sanjay',
      email: 'sanjay@company.com',
      role: 'Admin',
      userGroup: 'Admin',
      status: 'Active',
      password: '123456'
    });

    return adminUser;
  }
}
