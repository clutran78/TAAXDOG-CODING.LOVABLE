export interface Goal {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  dueDate: string;
  userId: string;
  description?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}
