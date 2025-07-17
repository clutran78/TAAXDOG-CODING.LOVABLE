export interface SubAccount {
  id: string;
  name: string;
  balance: number;
  goalId?: string;
  type: 'savings' | 'investment' | 'general';
  createdAt: Date;
  updatedAt: Date;
}