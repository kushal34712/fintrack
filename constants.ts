
import { UserSettings } from './types';

export const DEFAULT_ACCOUNTS = [
  "Cash In Wallet", "G Pay UPI", "Phone Pe UPI", "UPI Lite", "Recharge Cash",
  "Fam Pay Wallet", "Mobikwik", "Amazon Wallet", "Cash In Saving", "Fam Pay Saving"
];

export const DEFAULT_EXP_CATS = ["General", "Food", "Shopping", "Bills", "Travel", "Medical", "Other"];
export const DEFAULT_INC_CATS = ["Pocket Money", "Salary", "Bonus", "Refund", "Gift"];
export const DEFAULT_REM_CATS = ["Jio Fiber", "Self Phone", "Netflix", "Mummy Phone", "Jio Hotstar", "Sony Liv", "Prime Video"];

export const INITIAL_SETTINGS: UserSettings = {
  peopleList: ["Sanchi", "Mummy"],
  accounts: DEFAULT_ACCOUNTS,
  accountLockSettings: {},
  expenseCats: DEFAULT_EXP_CATS,
  incomeCats: DEFAULT_INC_CATS,
  reminderCats: DEFAULT_REM_CATS,
  balancePin: null,
  autoPays: [],
  profile: { name: '', email: '', phone: '', address: '' },
  theme: 'dark',
  showExternal: true,
  paidByList: ["Self", "Friend", "Company"],
  events: [
    { id: 'default-event', name: 'General Event' }
  ]
};
