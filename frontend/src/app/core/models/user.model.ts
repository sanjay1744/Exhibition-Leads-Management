export interface AppUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: 'Admin' | 'StallOwner' | 'Marketing' | string;
  userGroup?: string;
  status: 'Active' | 'Inactive';
  password?: string;
  phone?: string;
  shortName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  assignedStallId?: string;
  createdAt?: string;
  updatedAt?: string;
}
