import api from '../api/api';

export interface Budget {
  _id: string;
  category: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  notifications: {
    enabled: boolean;
    threshold: number;
  };
  currentSpending?: number;
  remainingAmount?: number;
  utilizationPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBudgetDTO {
  category: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  notifications?: {
    enabled: boolean;
    threshold: number;
  };
}

export interface UpdateBudgetDTO extends Partial<CreateBudgetDTO> {}

class BudgetService {
  async createBudget(budgetData: CreateBudgetDTO): Promise<Budget> {
    const response = await api.post('/budgets', budgetData);
    return response.data.data;
  }

  async getBudgets(period?: string): Promise<Budget[]> {
    try {
      const response = await api.get('/budgets', {
        params: { period, includeSpending: true }
      });
      console.log('Budget API Response:', response.data);
      
      // Parse date strings into Date objects
      const budgets = response.data.data || [];
      return budgets.map((budget: any) => ({
        ...budget,
        startDate: new Date(budget.startDate),
        endDate: new Date(budget.endDate),
        createdAt: new Date(budget.createdAt),
        updatedAt: new Date(budget.updatedAt)
      }));
    } catch (error) {
      console.error('Error fetching budgets:', error);
      return [];
    }
  }

  async getBudgetWithSpending(budgetId: string): Promise<Budget | null> {
    try {
      const response = await api.get(`/budgets/${budgetId}?includeSpending=true`);
      const budget = response.data.data;
      
      if (!budget) return null;
      
      return {
        ...budget,
        startDate: new Date(budget.startDate),
        endDate: new Date(budget.endDate),
        createdAt: new Date(budget.createdAt),
        updatedAt: new Date(budget.updatedAt)
      };
    } catch (error) {
      console.error(`Error fetching budget ${budgetId}:`, error);
      return null;
    }
  }

  async refreshBudgetSpending(): Promise<boolean> {
    try {
      await api.post('/budgets/refresh-spending');
      return true;
    } catch (error) {
      console.error('Error refreshing budget spending:', error);
      return false;
    }
  }

  async updateBudget(budgetId: string, updates: UpdateBudgetDTO): Promise<Budget> {
    const response = await api.patch(`/budgets/${budgetId}`, updates);
    return response.data.data;
  }

  async deleteBudget(budgetId: string): Promise<void> {
    await api.delete(`/budgets/${budgetId}`);
  }
}

export const budgetService = new BudgetService();

export default budgetService; 