
export type TransactionType = 'expense' | 'income' | 'credit' | 'repayment' | 'transfer' | 'reminder' | 'adjustment' | 'external';

export interface AppEvent {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  account: string;
  toAccount?: string;
  person?: string;
  category: string;
  date: string;
  dueDate?: string;
  note: string;
  timestamp: number;
  isAuto?: boolean;
  autoPayId?: string;
  personAdjustment?: boolean;
  // External Specific
  paidBy?: string;
  paymentMethod?: 'Cash' | 'Wallet' | 'UPI';
  billImage?: string;
  eventId?: string;
}

export interface ProfileInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface AutoPayRule {
  id: string;
  amount: number;
  day: string;
  purpose: string;
  account: string;
  type: 'expense' | 'income';
}

export interface UserSettings {
  peopleList: string[];
  accounts: string[];
  accountLockSettings: Record<string, boolean>;
  expenseCats: string[];
  incomeCats: string[];
  reminderCats: string[];
  balancePin: string | null;
  autoPays: AutoPayRule[];
  profile: ProfileInfo;
  theme: 'light' | 'dark';
  // Feature Toggles
  showExternal: boolean;
  paidByList: string[];
  events: AppEvent[];
}
