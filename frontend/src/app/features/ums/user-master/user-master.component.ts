import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { getApiUrl } from '../../../core/config/api.config';

export interface UserMasterItem {
  id: string;
  fullName: string;
  username: string;
  email: string;
  userGroup: string;
  role: 'Admin' | 'StallOwner' | 'Marketing' | string;
  status: 'Active' | 'Inactive';
}

@Component({
  selector: 'app-user-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-master.component.html',
  styleUrl: './user-master.component.css'
})
export class UserMasterComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private get apiUrl() { return `${getApiUrl()}/users`; }

  users = signal<UserMasterItem[]>([]);

  searchQuery = '';
  pageSize = signal(10);
  pageSizeSelect = 10;
  currentPage = signal(1);

  isModalOpen = signal(false);
  editingUser = signal<UserMasterItem | null>(null);

  formData = {
    fullName: '',
    username: '',
    email: '',
    userGroup: 'Naren-Marketing',
    role: 'Marketing',
    status: 'Active' as 'Active' | 'Inactive',
    password: ''
  };

  currentUser = this.auth.currentUser();

  isAdmin = computed(() => this.currentUser?.role === 'Admin');
  isStallOwner = computed(() => this.currentUser?.role === 'StallOwner');

  ngOnInit(): void {
    this.fetchUsers();
  }

  fetchUsers(): void {
    this.http.get<UserMasterItem[]>(this.apiUrl).subscribe({
      next: (res) => {
        if (res) {
          this.users.set(res);
        }
      },
      error: (err) => {
        console.error('Error fetching users from DB:', err);
      }
    });
  }

  filteredUsers = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.users();
    return this.users().filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.userGroup.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  });

  paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });

  startIndex = computed(() => (this.currentPage() - 1) * this.pageSize() + 1);
  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredUsers().length));

  onPageSizeChange(): void {
    this.pageSize.set(Number(this.pageSizeSelect));
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
    }
  }

  nextPage(): void {
    if (this.endIndex() < this.filteredUsers().length) {
      this.currentPage.update((p) => p + 1);
    }
  }

  openAddModal(): void {
    this.editingUser.set(null);
    this.formData = {
      fullName: '',
      username: '',
      email: '',
      userGroup: 'Naren-Marketing',
      role: 'Marketing',
      status: 'Active',
      password: ''
    };
    this.isModalOpen.set(true);
  }

  openEditModal(user: UserMasterItem): void {
    this.editingUser.set(user);
    this.formData = {
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      userGroup: user.userGroup,
      role: user.role,
      status: user.status as 'Active' | 'Inactive',
      password: ''
    };
    this.isModalOpen.set(true);
  }

  openPasswordModal(user: UserMasterItem): void {
    const newPass = prompt(`Reset Password for ${user.username}:`, 'Admin@123');
    if (newPass) {
      this.http.put(`${this.apiUrl}/${user.id}/reset-password`, JSON.stringify(newPass), {
        headers: { 'Content-Type': 'application/json' }
      }).subscribe({
        next: () => alert(`Password for ${user.username} reset successfully!`),
        error: () => alert('Failed to reset password.')
      });
    }
  }

  selectedUserForDelete = signal<UserMasterItem | null>(null);

  deleteUser(user: UserMasterItem): void {
    this.selectedUserForDelete.set(user);
  }

  cancelDeleteUser(): void {
    this.selectedUserForDelete.set(null);
  }

  confirmDeleteUser(): void {
    const user = this.selectedUserForDelete();
    if (!user) return;

    const headers = new HttpHeaders().set('X-User-Role', this.currentUser?.role || 'Admin');

    this.http.delete(`${this.apiUrl}/${user.id}`, { headers }).subscribe({
      next: () => {
        this.selectedUserForDelete.set(null);
        this.fetchUsers();
      },
      error: (err) => {
        this.selectedUserForDelete.set(null);
        alert(err?.error?.message || 'Delete operation failed.');
      }
    });
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  saveUser(): void {
    if (!this.formData.fullName || !this.formData.username) {
      alert('Full Name and Username are required.');
      return;
    }

    if (this.editingUser()) {
      this.http.put(`${this.apiUrl}/${this.editingUser()!.id}`, this.formData).subscribe({
        next: () => {
          this.fetchUsers();
          this.closeModal();
        },
        error: (err) => alert(err?.error?.message || 'Failed to update user.')
      });
    } else {
      this.http.post(this.apiUrl, this.formData).subscribe({
        next: () => {
          this.fetchUsers();
          this.closeModal();
        },
        error: (err) => alert(err?.error?.message || 'Failed to create user.')
      });
    }
  }
}
