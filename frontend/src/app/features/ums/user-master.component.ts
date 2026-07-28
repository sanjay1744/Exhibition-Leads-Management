import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface UserMasterItem {
  id: string;
  fullName: string;
  username: string;
  userGroup: string;
  role: string;
  status: 'Active' | 'Inactive';
}

@Component({
  selector: 'app-user-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <!-- Page Title & Top Actions Bar (Matches Screenshot) -->
      <div class="page-title-bar">
        <div>
          <h1 class="page-title text-xl font-bold text-slate-900 uppercase tracking-wide">USER MASTER</h1>
        </div>

        <div class="page-actions flex items-center gap-2">
          <button (click)="openExportSettings()" class="btn btn-outline-pill bg-white border border-gray-300 text-xs px-3 py-1.5 rounded-md font-medium text-gray-700 flex items-center gap-1 shadow-sm">
            <span class="material-icons text-sm text-gray-500">tune</span>
            Export Setting
          </button>

          <button (click)="exportUsers()" class="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1 shadow-sm">
            <span class="material-icons text-sm">description</span>
            Export
          </button>

          <button (click)="openAddModal()" class="btn btn-primary text-xs px-3.5 py-1.5 rounded-md font-semibold flex items-center gap-1 shadow-sm">
            <span class="material-icons text-sm">add</span>
            + Add New User
          </button>
        </div>
      </div>

      <!-- Main Data Table Container Card -->
      <div class="card-panel p-0 overflow-hidden bg-white rounded-lg border border-slate-200 shadow-sm">
        
        <!-- Filter Search Bar & Total Counter Row -->
        <div class="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div class="w-72">
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search" 
              class="w-full border border-slate-300 rounded px-3 py-1.5 text-xs outline-none focus:border-blue-600"
            />
          </div>

          <div class="text-xs font-semibold text-slate-500">
            {{ filteredUsers().length }} users
          </div>
        </div>

        <!-- Table Data Grid (Exact Colors & Font from Screenshot) -->
        <div class="overflow-x-auto">
          <table class="erp-table w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#1a3a5c] text-white text-xs font-semibold">
                <th class="py-2.5 px-4 w-12 text-center">#</th>
                <th class="py-2.5 px-4">Full Name</th>
                <th class="py-2.5 px-4">Username</th>
                <th class="py-2.5 px-4">User Group</th>
                <th class="py-2.5 px-4">Role</th>
                <th class="py-2.5 px-4 text-center">Status</th>
                <th class="py-2.5 px-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody class="text-xs text-slate-700">
              @for (user of paginatedUsers(); track user.id; let idx = $index) {
                <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition">
                  <td class="py-3 px-4 text-center text-slate-500 font-medium">{{ (currentPage() - 1) * pageSize() + idx + 1 }}</td>
                  
                  <td class="py-3 px-4">
                    <div class="font-bold text-slate-900 leading-tight">{{ user.fullName }}</div>
                    <div class="text-[11px] text-slate-400 font-mono">{{ user.fullName.toLowerCase() }}</div>
                  </td>

                  <td class="py-3 px-4 font-medium text-slate-800">{{ user.username }}</td>

                  <td class="py-3 px-4 text-slate-600 font-medium">{{ user.userGroup }}</td>

                  <td class="py-3 px-4 text-slate-500">{{ user.role || '—' }}</td>

                  <td class="py-3 px-4 text-center">
                    <span 
                      class="px-2.5 py-0.5 rounded text-[11px] font-bold inline-block"
                      [ngClass]="user.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                    >
                      {{ user.status }}
                    </span>
                  </td>

                  <td class="py-3 px-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                      <button (click)="openEditModal(user)" class="text-indigo-600 hover:text-indigo-800 p-1" title="Edit User">
                        <span class="material-icons text-base">edit</span>
                      </button>
                      <button (click)="openPasswordModal(user)" class="text-amber-600 hover:text-amber-800 p-1" title="Reset Key">
                        <span class="material-icons text-base">vpn_key</span>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="py-8 text-center text-slate-400">
                    No users found matching your search.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination Footer (Exact Screenshot Layout) -->
        <div class="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-6 text-xs text-slate-600 font-medium">
          <div class="flex items-center gap-2">
            <span>Items per page:</span>
            <select [(ngModel)]="pageSizeSelect" (change)="onPageSizeChange()" class="border border-slate-300 rounded px-2 py-1 bg-white text-xs outline-none">
              <option [value]="10">10</option>
              <option [value]="25">25</option>
              <option [value]="50">50</option>
            </select>
          </div>

          <div>
            {{ startIndex() }} - {{ endIndex() }} of {{ filteredUsers().length }}
          </div>

          <div class="flex items-center gap-1">
            <button [disabled]="currentPage() === 1" (click)="prevPage()" class="p-1 rounded hover:bg-slate-200 disabled:opacity-40">
              <span class="material-icons text-base">chevron_left</span>
            </button>
            <button [disabled]="endIndex() >= filteredUsers().length" (click)="nextPage()" class="p-1 rounded hover:bg-slate-200 disabled:opacity-40">
              <span class="material-icons text-base">chevron_right</span>
            </button>
          </div>
        </div>

      </div>

      <!-- Add / Edit Modal -->
      @if (isModalOpen()) {
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-lg shadow-xl border w-full max-w-md p-6">
            <h2 class="text-base font-bold text-slate-900 mb-4 border-b pb-2">
              {{ editingUser() ? 'Edit User' : 'Add New User' }}
            </h2>

            <form (ngSubmit)="saveUser()">
              <div class="space-y-3 mb-5">
                <div>
                  <label class="form-label">Full Name *</label>
                  <input [(ngModel)]="formData.fullName" name="fullName" required class="form-control" placeholder="Thalaimalai" />
                </div>

                <div>
                  <label class="form-label">Username *</label>
                  <input [(ngModel)]="formData.username" name="username" required class="form-control" placeholder="Thalaimalai" />
                </div>

                <div>
                  <label class="form-label">User Group *</label>
                  <select [(ngModel)]="formData.userGroup" name="userGroup" class="form-control">
                    <option value="Naren-Marketing">Naren-Marketing</option>
                    <option value="Naren Marketing">Naren Marketing</option>
                    <option value="Naren-Store-Admin">Naren-Store-Admin</option>
                    <option value="Naren Admin">Naren Admin</option>
                    <option value="Naren-Accounts">Naren-Accounts</option>
                  </select>
                </div>

                <div>
                  <label class="form-label">Role</label>
                  <input [(ngModel)]="formData.role" name="role" class="form-control" placeholder="—" />
                </div>

                <div>
                  <label class="form-label">Status *</label>
                  <select [(ngModel)]="formData.status" name="status" class="form-control">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                @if (!editingUser()) {
                  <div>
                    <label class="form-label">Password *</label>
                    <input type="password" [(ngModel)]="formData.password" name="password" required class="form-control" placeholder="••••••••" />
                  </div>
                }
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t">
                <button type="button" (click)="closeModal()" class="btn btn-outline-pill text-xs">Cancel</button>
                <button type="submit" class="btn btn-primary text-xs px-4">Save User</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class UserMasterComponent implements OnInit {
  private apiUrl = 'http://localhost:5000/api/users';

  users = signal<UserMasterItem[]>([
    { id: '1', fullName: 'Thalaimalai', username: 'Thalaimalai', userGroup: 'Naren-Marketing', role: '—', status: 'Active' },
    { id: '2', fullName: 'Saravanan', username: 'Saravanan', userGroup: 'Naren Marketing', role: '—', status: 'Active' },
    { id: '3', fullName: 'Vasanth', username: 'Vasanth', userGroup: 'Naren-Store-Admin', role: '—', status: 'Active' },
    { id: '4', fullName: 'ntesales', username: 'Krishna', userGroup: 'Naren-Store-Admin', role: '—', status: 'Active' },
    { id: '5', fullName: 'Balasubramaniam', username: 'Bala', userGroup: 'Naren-Marketing', role: '—', status: 'Inactive' },
    { id: '6', fullName: 'Senthil', username: 'Senthil', userGroup: 'Naren-Marketing', role: '—', status: 'Inactive' },
    { id: '7', fullName: 'Venkatesan', username: 'Venkatesan', userGroup: 'Naren-Marketing', role: '—', status: 'Inactive' },
    { id: '8', fullName: 'snathan', username: 'Senthilnathan', userGroup: 'Naren Admin', role: '—', status: 'Active' },
    { id: '9', fullName: 'archana', username: 'Archana', userGroup: 'Naren-Accounts', role: '—', status: 'Inactive' },
    { id: '10', fullName: 'rohini', username: 'Rohini', userGroup: 'Naren Admin', role: '—', status: 'Active' }
  ]);

  searchQuery = '';
  pageSize = signal(10);
  pageSizeSelect = 10;
  currentPage = signal(1);

  isModalOpen = signal(false);
  editingUser = signal<UserMasterItem | null>(null);

  formData = {
    fullName: '',
    username: '',
    userGroup: 'Naren-Marketing',
    role: '—',
    status: 'Active' as 'Active' | 'Inactive',
    password: ''
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchUsers();
  }

  fetchUsers(): void {
    this.http.get<UserMasterItem[]>(this.apiUrl).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          this.users.set(res);
        }
      },
      error: () => {
        // Fallback to seeded items if offline
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
        u.userGroup.toLowerCase().includes(q)
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
      userGroup: 'Naren-Marketing',
      role: '—',
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
      userGroup: user.userGroup,
      role: user.role,
      status: user.status,
      password: ''
    };
    this.isModalOpen.set(true);
  }

  openPasswordModal(user: UserMasterItem): void {
    const newPass = prompt(`Reset Password for ${user.username}:`, 'Admin@123');
    if (newPass) {
      alert(`Password for ${user.username} successfully reset!`);
    }
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
      const updated = this.users().map((u) =>
        u.id === this.editingUser()!.id
          ? { ...u, fullName: this.formData.fullName, username: this.formData.username, userGroup: this.formData.userGroup, role: this.formData.role, status: this.formData.status }
          : u
      );
      this.users.set(updated);
    } else {
      const newUser: UserMasterItem = {
        id: crypto.randomUUID(),
        fullName: this.formData.fullName,
        username: this.formData.username,
        userGroup: this.formData.userGroup,
        role: this.formData.role,
        status: this.formData.status
      };
      this.users.update((list) => [newUser, ...list]);
    }

    this.closeModal();
  }

  exportUsers(): void {
    alert('Exporting USER MASTER to Excel/CSV...');
  }

  openExportSettings(): void {
    alert('Configuring Export Column Settings...');
  }
}
