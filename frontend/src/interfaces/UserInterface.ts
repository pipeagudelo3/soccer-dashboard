// Public Users API profile: passwords are write-only and never belong to displayed data.
export interface UserInterface {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}
