import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppUser } from '../../../core/models/user.model';

export type UserMasterItem = AppUser;

@Component({
  selector: 'app-user-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-master.component.html',
  styleUrl: './user-master.component.css'
})
export class UserMasterComponent implements OnInit {
  private userService = inject(UserService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  users = signal<UserMasterItem[]>([]);

  searchQuery = '';
  pageSize = signal(10);
  pageSizeSelect = 10;
  currentPage = signal(1);

  isModalOpen = signal(false);
  editingUser = signal<UserMasterItem | null>(null);

  isViewModalOpen = signal(false);
  viewingUser = signal<UserMasterItem | null>(null);

  openViewModal(user: UserMasterItem): void {
    this.viewingUser.set(user);
    this.isViewModalOpen.set(true);
  }

  closeViewModal(): void {
    this.isViewModalOpen.set(false);
    this.viewingUser.set(null);
  }

  switchToEditFromView(): void {
    const user = this.viewingUser();
    this.closeViewModal();
    if (user && this.canEditUser(user)) {
      this.openEditModal(user);
    }
  }

  formData: {
    fullName: string;
    username: string;
    email: string;
    role: string;
    status: 'Active' | 'Inactive';
    password: string;
    userGroup?: string;
  } = {
    fullName: '',
    username: '',
    email: '',
    role: 'Marketing',
    status: 'Active',
    password: '',
    userGroup: 'Sales Team'
  };

  currentUser = this.auth.currentUser();

  isSuperAdmin = computed(() => this.currentUser?.role === 'SuperAdmin');
  isAdmin = computed(() => this.currentUser?.role === 'Admin');
  isStallOwner = computed(() => this.currentUser?.role === 'StallOwner');
  isMarketing = computed(() => this.currentUser?.role === 'Marketing');

  // Matrix: Super Admin: TRUE, Admin: TRUE, Stall Owner: TRUE, Marketing: FALSE
  canCreateUser = computed(() => this.isSuperAdmin() || this.isAdmin() || this.isStallOwner());

  availableRoles = computed(() => {
    if (this.isSuperAdmin()) return ['SuperAdmin', 'Admin', 'StallOwner', 'Marketing'];
    if (this.isAdmin()) return ['Admin', 'StallOwner', 'Marketing'];
    if (this.isStallOwner()) return ['StallOwner', 'Marketing'];
    return [];
  });

  // Granular row-level permissions according to Excel Matrix
  canEditUser(targetUser: UserMasterItem): boolean {
    if (this.isSuperAdmin()) return true;
    if (this.isAdmin()) {
      // Row 6: Edit Admin: FALSE; Row 10: Edit Stall Owner: TRUE; Row 14: Edit Marketing: TRUE
      return targetUser.role === 'StallOwner' || targetUser.role === 'Marketing';
    }
    if (this.isStallOwner()) {
      // Row 10: Edit Stall Owner: FALSE; Row 14: Edit Marketing: TRUE
      return targetUser.role === 'Marketing';
    }
    return false;
  }

  canDeleteUser(targetUser: UserMasterItem): boolean {
    if (targetUser.id === this.currentUser?.id || targetUser.username === this.currentUser?.username) {
      return false; // Cannot delete self
    }
    if (this.isSuperAdmin()) return true;
    if (this.isAdmin()) {
      // Row 7: Delete Admin: FALSE; Row 11: Delete Stall Owner: TRUE; Row 15: Delete Marketing: TRUE
      return targetUser.role === 'StallOwner' || targetUser.role === 'Marketing';
    }
    if (this.isStallOwner()) {
      // Row 11: Delete Stall Owner: FALSE; Row 15: Delete Marketing: TRUE
      return targetUser.role === 'Marketing';
    }
    return false;
  }

  canResetPassword(targetUser: UserMasterItem): boolean {
    if (this.isSuperAdmin()) return true;
    if (this.isAdmin()) {
      // Row 8: Reset Admin: FALSE; Row 12: Reset Stall Owner: TRUE; Row 16: Reset Marketing: TRUE
      return targetUser.role === 'StallOwner' || targetUser.role === 'Marketing';
    }
    if (this.isStallOwner()) {
      // Row 12: Reset Stall Owner: FALSE; Row 16: Reset Marketing: TRUE
      return targetUser.role === 'Marketing';
    }
    return false;
  }

  ngOnInit(): void {
    this.fetchUsers();
  }

  fetchUsers(): void {
    this.userService.getUsers().subscribe({
      next: (res) => {
        if (res) {
          this.users.set(res);
        }
      },
      error: (err) => {
        console.error('Error fetching users from Supabase:', err);
      }
    });
  }

  filteredUsers = computed(() => {
    let list = this.users();
    // StallOwner only views StallOwner and Marketing users
    if (this.isStallOwner()) {
      list = list.filter((u) => u.role === 'StallOwner' || u.role === 'Marketing');
    }
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.userGroup ? u.userGroup.toLowerCase().includes(q) : false) ||
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
    if (!this.canCreateUser()) {
      this.toast.showError('Access Denied', 'You do not have permission to add new users.');
      return;
    }
    this.editingUser.set(null);
    const defaultRole = this.isStallOwner() ? 'Marketing' : (this.isAdmin() ? 'StallOwner' : 'Marketing');
    this.formData = {
      fullName: '',
      username: '',
      email: '',
      role: defaultRole,
      status: 'Active',
      password: '',
      userGroup: 'Sales Team'
    };
    this.isModalOpen.set(true);
  }

  openEditModal(user: UserMasterItem): void {
    if (!this.canEditUser(user)) {
      this.toast.showError('Access Denied', 'You do not have permission to edit this user.');
      return;
    }
    this.editingUser.set(user);
    this.formData = {
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status as 'Active' | 'Inactive',
      password: user.password || '',
      userGroup: user.userGroup || 'Sales Team'
    };
    this.isModalOpen.set(true);
  }

  openPasswordModal(user: UserMasterItem): void {
    if (!this.canResetPassword(user)) {
      this.toast.showError('Access Denied', 'You do not have permission to reset password for this user.');
      return;
    }
    const newPass = prompt(`Reset Password for ${user.username}:`, 'Admin@123');
    if (newPass) {
      this.userService.resetPassword(user.id, newPass).subscribe({
        next: () => this.toast.showSuccess(`Password for ${user.username} reset successfully in Supabase!`),
        error: () => this.toast.showError('Reset Failed', 'Failed to reset password.')
      });
    }
  }

  selectedUserForDelete = signal<UserMasterItem | null>(null);

  deleteUser(user: UserMasterItem): void {
    if (!this.canDeleteUser(user)) {
      this.toast.showError('Access Denied', 'You do not have permission to delete this user.');
      return;
    }
    this.selectedUserForDelete.set(user);
  }

  cancelDeleteUser(): void {
    this.selectedUserForDelete.set(null);
  }

  confirmDeleteUser(): void {
    const user = this.selectedUserForDelete();
    if (!user || !this.canDeleteUser(user)) {
      this.toast.showError('Access Denied', 'You do not have permission to delete this user.');
      this.selectedUserForDelete.set(null);
      return;
    }

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.selectedUserForDelete.set(null);
        this.toast.showSuccess(`User '${user.username}' deleted.`);
        this.fetchUsers();
      },
      error: (err) => {
        this.selectedUserForDelete.set(null);
        this.toast.showError('Delete Failed', err?.message || 'Delete operation failed.');
      }
    });
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  saveUser(): void {
    if (!this.formData.fullName || !this.formData.username) {
      this.toast.showError('Validation Error', 'Full Name and Username are required.');
      return;
    }

    if (!this.editingUser() && !this.canCreateUser()) {
      this.toast.showError('Access Denied', 'You do not have permission to add new users.');
      return;
    }

    if (this.editingUser() && !this.canEditUser(this.editingUser()!)) {
      this.toast.showError('Access Denied', 'You do not have permission to edit this user.');
      return;
    }

    const payload: Partial<AppUser> = {
      ...this.formData,
      email: this.formData.email || `${this.formData.username.toLowerCase().trim()}@company.com`,
      userGroup: this.formData.userGroup || 'Sales Team'
    };

    // Prevent non-superadmin from promoting to SuperAdmin
    if (!this.isSuperAdmin() && payload.role === 'SuperAdmin') {
      payload.role = this.editingUser() ? this.editingUser()!.role : 'Marketing';
    }

    if (this.editingUser()) {
      this.userService.updateUser(this.editingUser()!.id, payload).subscribe({
        next: () => {
          this.toast.showSuccess(`User '${payload.username}' updated successfully in Supabase!`);
          this.fetchUsers();
          this.closeModal();
        },
        error: (err) => {
          const msg = err?.message || 'Failed to update user in Supabase.';
          this.toast.showError('Update Failed', msg);
        }
      });
    } else {
      this.userService.createUser(payload).subscribe({
        next: () => {
          this.toast.showSuccess(`User '${payload.username}' created successfully in Supabase!`);
          this.fetchUsers();
          this.closeModal();
        },
        error: (err) => {
          const msg = err?.message || 'Failed to create user in Supabase.';
          this.toast.showError('Create Failed', msg);
        }
      });
    }
  }
}
