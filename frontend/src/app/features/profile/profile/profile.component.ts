import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppUser } from '../../../core/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private toast = inject(ToastService);

  user = this.authService.currentUser();
  isEditing = signal(false);
  isSaving = signal(false);

  profileData = {
    fullName: this.user?.fullName || '',
    shortName: this.user?.username || '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: ''
  };

  ngOnInit(): void {
    this.loadUserProfile();
  }

  async loadUserProfile(): Promise<void> {
    const current = this.authService.currentUser();
    if (!current) return;

    // Search by username or id
    let appUser: AppUser | undefined;
    if (current.id) {
      const users = await this.userService.users();
      appUser = users.find((u) => u.id === current.id);
    }
    if (!appUser && current.username) {
      const users = await this.userService.users();
      appUser = users.find((u) => u.username.toLowerCase() === current.username.toLowerCase());
    }

    if (appUser) {
      this.profileData = {
        fullName: appUser.fullName || current.fullName || '',
        shortName: appUser.shortName || appUser.username || current.username || '',
        phone: appUser.phone || '',
        address1: appUser.address1 || '',
        address2: appUser.address2 || '',
        city: appUser.city || '',
        state: appUser.state || ''
      };
    } else {
      this.profileData.fullName = current.fullName || '';
      this.profileData.shortName = current.username || '';
    }
  }

  toggleEdit(): void {
    if (this.isEditing()) {
      this.saveProfile();
    } else {
      this.isEditing.set(true);
    }
  }

  saveProfile(): void {
    const current = this.authService.currentUser();
    if (!current) {
      this.isEditing.set(false);
      return;
    }

    this.isSaving.set(true);
    const userId = current.id || crypto.randomUUID();

    const updates: Partial<AppUser> = {
      fullName: this.profileData.fullName.trim() || current.fullName,
      shortName: this.profileData.shortName.trim() || current.username,
      phone: this.profileData.phone.trim(),
      address1: this.profileData.address1.trim(),
      address2: this.profileData.address2.trim(),
      city: this.profileData.city.trim(),
      state: this.profileData.state.trim(),
      updatedAt: new Date().toISOString()
    };

    this.userService.updateProfile(userId, updates).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isEditing.set(false);

        // Update local session
        this.authService.saveSession({
          ...current,
          fullName: updates.fullName || current.fullName
        });

        this.toast.showSuccess('Profile updated successfully in Supabase!');
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Failed to update profile:', err);
        this.toast.showError('Profile Update Failed', 'Could not save profile changes.');
      }
    });
  }
}
