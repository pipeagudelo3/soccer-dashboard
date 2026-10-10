export interface AuthenticatedUserInterface {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}
