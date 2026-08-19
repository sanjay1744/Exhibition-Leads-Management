import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  user = this.authService.currentUser();

  isEditing = signal(false);

  profileData = {
    fullName: this.user?.fullName || 'Thalaimalai',
    shortName: 'Thalaimalai',
    phone: '+91 00000 00000',
    address1: 'Street / Building',
    address2: 'Area / Locality',
    city: 'City',
    state: 'State / Country'
  };

  toggleEdit(): void {
    if (this.isEditing()) {
      this.toast.showSuccess('Profile details updated successfully.');
    }
    this.isEditing.update((val) => !val);
  }
}
