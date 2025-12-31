
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Wallet, ArrowUpRight, ArrowDownLeft, Bell, History, User, 
  PieChart, Trash2, X, Loader2, ChevronLeft, RotateCcw, Sparkles, 
  BellRing, AlarmClockPlus, UserPlus, Users, Lock, Unlock, ShieldCheck, 
  Smartphone, Eye, EyeOff, AlertCircle, ReceiptText, Activity, 
  CheckCircle2, ChevronRight, Tags, CreditCard, FileDown, AlertTriangle, 
  Moon, Sun, Calendar, CalendarDays, Download, Share2, Camera, 
  ToggleLeft, ToggleRight, Edit2, Check, Search, SlidersHorizontal, Layers, Briefcase,
  Contact
} from 'lucide-react';
import { 
  Transaction, TransactionType, UserSettings, AutoPayRule, AppEvent 
} from './types';
import { 
  INITIAL_SETTINGS 
} from './constants';
import { enhanceTransactionDetails } from './services/gemini';

// --- Helpers ---
const formatINR = (amount: number, forceSign: string = "") => {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(absAmount).replace('₹', '₹ ');
  
  if (forceSign) return `${forceSign}${formatted}`;
  return amount < 0 ? `- ${formatted}` : formatted;
};

const getMaskedINR = (val: string | number) => {
  if (!val && val !== 0) return "";
  const strVal = val.toString();
  const parts = strVal.split('.');
  let integerPart = parts[0].replace(/[^0-9-]/g, ''); 
  const decimalPart = parts.length > 1 ? '.' + parts[1].substring(0, 2) : '';
  if (integerPart === "" || integerPart === "-") return integerPart + decimalPart;
  const isNegative = integerPart.startsWith('-');
  const absInteger = isNegative ? integerPart.substring(1) : integerPart;
  let lastThree = absInteger.substring(absInteger.length - 3);
  let otherNumbers = absInteger.substring(0, absInteger.length - 3);
  if (otherNumbers !== '') lastThree = ',' + lastThree;
  let res = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return (isNegative ? "-" : "") + res + decimalPart;
};

const App: React.FC = () => {
  // --- States ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<UserSettings>(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profileView, setProfileView] = useState('menu');

  // UI Feedback States
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [recordSuccess, setRecordSuccess] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [calAnimating, setCalAnimating] = useState(false);

  // Form States
  const [formData, setFormData] = useState<Partial<Transaction>>({
    type: 'expense', amount: 0, account: '', toAccount: '', person: '', category: 'General',
    date: new Date().toISOString().split('T')[0], note: '',
    paidBy: 'Self', paymentMethod: 'Cash', billImage: '', eventId: ''
  });
  const [markAsCredit, setMarkAsCredit] = useState(false);
  
  const [autoPayDraft, setAutoPayDraft] = useState<Partial<AutoPayRule>>({
    type: 'expense', amount: 0, day: '1', purpose: '', account: ''
  });

  const [newItemName, setNewItemName] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventName, setEditingEventName] = useState("");
  const [editingPaidByIdx, setEditingPaidByIdx] = useState<number | null>(null);
  const [editingPaidByName, setEditingPaidByName] = useState("");
  
  // Filtering States
  const [typeFilter, setTypeFilter] = useState('All');
  const [accountFilter, setAccountFilter] = useState('All');
  
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPersonDetail, setSelectedPersonDetail] = useState<string | null>(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState<string | null>(null);
  const [categoryTypeTab, setCategoryTypeTab] = useState<'expense' | 'income' | 'reminder'>('expense');

  // Security Logic
  const [showTotalBalance, setShowTotalBalance] = useState(false);
  const [revealedAccounts, setRevealedAccounts] = useState<Record<string, boolean>>({});
  const [pinEntryMode, setPinEntryMode] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinSuccessAction, setPinSuccessAction] = useState<{ type: string; payload?: any } | null>(null);
  const [newPinInput, setNewPinInput] = useState("");
  const [adjustmentTarget, setAdjustmentTarget] = useState<{ type: 'account' | 'person', id: string } | null>(null);

  // Overlays
  const [showAutoPayManager, setShowAutoPayManager] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showEventCenter, setShowEventCenter] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  const longPressTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const STORAGE_KEY = 'fintrack_pro_v16_stable';

  // --- Initialization & Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setSettings({ ...INITIAL_SETTINGS, ...parsed.settings });
      } catch (e) { console.error("Restore failed", e); }
    } else {
        if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, settings }));
    }
  }, [transactions, settings, loading]);

  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings.theme]);

  const todayStr = new Date().toISOString().split('T')[0];

  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    settings.accounts.forEach(acc => balances[acc] = 0);
    transactions.forEach(t => {
      if (t.type === 'reminder' || t.type === 'external') return;
      if (t.isAuto && t.date > todayStr) return; 

      const amt = Math.abs(t.amount);
      if (t.type === 'income' || t.type === 'repayment') {
        balances[t.account] = (balances[t.account] || 0) + amt;
      } else if (t.type === 'expense' || t.type === 'credit') {
        balances[t.account] = (balances[t.account] || 0) - amt;
      } else if (t.type === 'transfer') {
        balances[t.account] = (balances[t.account] || 0) - amt;
        if (t.toAccount) balances[t.toAccount] = (balances[t.toAccount] || 0) + amt;
      } else if (t.type === 'adjustment') {
        if (!t.personAdjustment) balances[t.account] = (balances[t.account] || 0) + t.amount; 
      }
    });
    return balances;
  }, [transactions, settings.accounts, todayStr]);

  const personCredits = useMemo(() => {
    const credits: Record<string, number> = {};
    settings.peopleList.forEach(p => credits[p] = 0);
    transactions.forEach(t => {
      if (!t.person || t.type === 'external' || t.type === 'reminder') return;
      if (t.isAuto && t.date > todayStr) return;
      const amt = Math.abs(t.amount);
      if (t.type === 'credit') credits[t.person] += amt;
      else if (t.type === 'repayment') credits[t.person] -= amt;
      else if (t.type === 'adjustment' && t.personAdjustment) credits[t.person] += t.amount;
    });
    return credits;
  }, [transactions, settings.peopleList, todayStr]);

  const eventStats = useMemo(() => {
    const stats: Record<string, number> = {};
    settings.events.forEach(ev => stats[ev.id] = 0);
    transactions.forEach(t => {
      if (t.eventId && t.type === 'external') {
        stats[t.eventId] = (stats[t.eventId] || 0) + Math.abs(t.amount);
      }
    });
    return stats;
  }, [transactions, settings.events]);

  const totalBalance = useMemo(() => Object.values(accountBalances).reduce((a: number, b: number) => a + b, 0), [accountBalances]);
  const totalNetCredit = useMemo(() => Object.values(personCredits).reduce((a: number, b: number) => a + b, 0), [personCredits]);

  const dueReminders = useMemo(() => {
    return transactions.filter(t => t.type === 'reminder' || t.dueDate)
      .sort((a,b) => new Date(a.dueDate || a.date).getTime() - new Date(b.dueDate || b.date).getTime());
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchType = typeFilter === 'All' || t.type === typeFilter;
      const matchAccount = accountFilter === 'All' || t.account === accountFilter || t.toAccount === accountFilter;
      return matchType && matchAccount;
    }).sort((a,b) => b.timestamp - a.timestamp);
  }, [transactions, typeFilter, accountFilter]);

  const ledgerHistory = useMemo(() => {
    if (!selectedPersonDetail) return [];
    return transactions.filter(t => t.person === selectedPersonDetail && (t.type === 'credit' || t.type === 'repayment' || t.personAdjustment))
      .sort((a,b) => b.timestamp - a.timestamp);
  }, [transactions, selectedPersonDetail]);

  const eventTransactions = useMemo(() => {
    if (!selectedEventDetail) return [];
    return transactions.filter(t => t.eventId === selectedEventDetail)
      .sort((a,b) => b.timestamp - a.timestamp);
  }, [transactions, selectedEventDetail]);

  // --- Handlers ---
  const requestPin = (type: string, payload?: any) => {
    if (!settings.balancePin) {
      handlePinSuccess(type, payload);
      return;
    }
    setPinSuccessAction({ type, payload });
    setPinEntryMode(true);
    setEnteredPin("");
    setPinError(false);
  };

  const handlePinSuccess = (type: string, payload?: any) => {
    if (type === 'balance') setShowTotalBalance(true);
    if (type === 'reveal_account') setRevealedAccounts(prev => ({ ...prev, [payload]: true }));
    if (type === 'delete') setTransactions(prev => prev.filter(t => t.id !== payload));
    if (type === 'reset_pin') { setActiveTab('profile'); setProfileView('security'); }
    setPinEntryMode(false);
    setPinSuccessAction(null);
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === settings.balancePin) {
      if (pinSuccessAction) handlePinSuccess(pinSuccessAction.type, pinSuccessAction.payload);
    } else { setPinError(true); setEnteredPin(""); }
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = Math.abs(formData.amount || 0);
    if (cleanAmount <= 0 && formData.type !== 'reminder' && formData.type !== 'external') return;
    
    let finalAmount = cleanAmount;
    let isPersonAdjustment = false;
    let effectiveType: TransactionType = formData.type as TransactionType;
    let effectiveNote = formData.note || '';
    
    // Expense as Credit logic
    if (formData.type === 'expense' && markAsCredit) {
      effectiveType = 'credit';
    }

    if (formData.type === 'adjustment') {
      if (adjustmentTarget?.type === 'account') {
        const currentAccBal = accountBalances[adjustmentTarget.id] || 0;
        finalAmount = (formData.amount || 0) - currentAccBal;
        effectiveType = finalAmount >= 0 ? 'income' : 'expense';
        effectiveNote = `Sync: ${adjustmentTarget.id}`;
      } else if (adjustmentTarget?.type === 'person') {
        const currentPersonCredit = personCredits[adjustmentTarget.id] || 0;
        finalAmount = (formData.amount || 0) - currentPersonCredit;
        isPersonAdjustment = true;
        effectiveType = 'adjustment';
        effectiveNote = `Sync Ledger: ${adjustmentTarget.id}`;
      }
    }

    const newTrans: Transaction = {
      id: crypto.randomUUID(),
      type: effectiveType,
      amount: Math.abs(finalAmount),
      account: formData.account || settings.accounts[0],
      toAccount: formData.toAccount,
      person: formData.person || '',
      category: formData.category || 'General',
      date: formData.date || todayStr,
      note: effectiveNote,
      timestamp: Date.now(),
      paidBy: formData.paidBy,
      paymentMethod: formData.paymentMethod,
      billImage: formData.billImage,
      eventId: formData.eventId,
      personAdjustment: isPersonAdjustment
    };

    setTransactions(prev => [newTrans, ...prev]);
    setRecordSuccess(true);
    setTimeout(() => {
      setRecordSuccess(false);
      setActiveTab('dashboard');
      setFormData({ 
        type: 'expense', amount: 0, account: settings.accounts[0], category: 'General', 
        date: new Date().toISOString().split('T')[0], note: '',
        paidBy: 'Self', paymentMethod: 'Cash', billImage: '', eventId: settings.events[0]?.id || ''
      });
      setMarkAsCredit(false);
      setAdjustmentTarget(null);
    }, 1200);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, billImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerCalAnimation = () => {
      setCalAnimating(true);
      setTimeout(() => setCalAnimating(false), 400);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;

  return (
    <div className={`min-h-screen pb-32 max-w-2xl mx-auto bg-[#F8FAFC] dark:bg-slate-950 relative overflow-x-hidden shadow-2xl transition-colors duration-300`}>
      <div className="absolute top-0 left-0 w-full h-72 bg-indigo-600 dark:bg-indigo-900 rounded-b-[40px] z-0 shadow-2xl transition-all duration-700 no-print"></div>

      <header className="relative z-10 px-6 pt-10 pb-6 text-white animate-fade-in no-print">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-2xl border border-white/20 shadow-xl active:scale-90">
              <Wallet size={24} />
            </div>
            <h1 className="text-xl font-black tracking-tight uppercase leading-none">FinTrack <span className="text-indigo-200">Pro</span></h1>
          </div>
          <button onClick={() => setShowNotificationModal(true)} className="relative p-2.5 bg-white/10 rounded-xl border border-white/10 active:scale-95">
            <Bell size={20} />
            {dueReminders.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-indigo-600 animate-pulse"></span>}
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-3xl rounded-[28px] p-6 border border-white/20 shadow-2xl ring-1 ring-white/10 animate-tab-entry">
          <div className="grid grid-cols-2 gap-4 divide-x divide-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 opacity-70 uppercase tracking-[0.1em] text-[10px] font-black">
                <span>Net Assets</span>
                <button onClick={() => showTotalBalance ? setShowTotalBalance(false) : requestPin('balance')}><Eye size={14} /></button>
              </div>
              <p className="text-2xl font-black font-mono tracking-tighter">{showTotalBalance ? formatINR(totalBalance) : "₹ ••••••••"}</p>
            </div>
            <div className="pl-6 space-y-1">
              <p className="opacity-70 uppercase tracking-[0.1em] text-[10px] font-black">Ledger Credit</p>
              <p className="text-2xl font-black font-mono tracking-tighter">{formatINR(totalNetCredit)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 space-y-8 mt-4 no-print">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-tab-entry">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setFormData({...formData, type: 'reminder'}); setActiveTab('add'); }} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center gap-2 hover:shadow-xl active:scale-90 animate-card-pop">
                <AlarmClockPlus className="text-indigo-600" size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reminders</span>
              </button>
              <button onClick={() => setShowAutoPayManager(true)} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center gap-2 hover:shadow-xl active:scale-90 animate-card-pop stagger-1">
                <Activity className="text-emerald-600" size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auto-Pay</span>
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 px-2 animate-fade-in">System Map</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {settings.accounts.map((acc) => {
                  const isLocked = settings.accountLockSettings[acc];
                  return (
                    <div key={acc} className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group animate-card-pop stagger-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                          {acc} {isLocked && <Lock size={8} className="text-rose-400" />}
                        </p>
                        <p className={`text-xl font-black font-mono tracking-tight ${accountBalances[acc] >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
                          {(!isLocked || revealedAccounts[acc]) ? formatINR(accountBalances[acc]) : "₹ ••••"}
                        </p>
                      </div>
                      <button onClick={() => revealedAccounts[acc] ? setRevealedAccounts(p => ({...p, [acc]: false})) : (isLocked ? requestPin('reveal_account', acc) : null)} className={`p-3 bg-slate-50 dark:bg-slate-800 rounded-xl active:scale-90 ${!isLocked && 'opacity-30 cursor-not-allowed'}`}>
                        {revealedAccounts[acc] ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <form onSubmit={handleAddTransaction} className="space-y-6 animate-card-pop">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[40px] shadow-2xl border border-indigo-50 dark:border-slate-800 space-y-8">
              
              <div className="flex flex-wrap p-1.5 bg-slate-50 dark:bg-slate-800 rounded-2xl gap-1 shadow-inner overflow-x-auto no-scrollbar">
                {['expense', 'income', 'reminder', 'transfer', 'credit', 'repayment', ...(settings.showExternal ? ['external'] : [])].map(t => (
                  <button 
                    key={t} type="button" 
                    onClick={() => { setFormData(p => ({ ...p, type: t as TransactionType })); setMarkAsCredit(false); }}
                    className={`flex-1 min-w-[28%] py-2 text-[10px] font-black uppercase rounded-xl transition-all ${formData.type === t ? 'bg-indigo-600 shadow-xl text-white scale-105' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}
                  >
                    {t === 'external' ? 'Event' : t}
                  </button>
                ))}
              </div>

              <div className="space-y-2 text-center">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">Amount</label>
                <input 
                  required={formData.type !== 'reminder'}
                  type="text" inputMode="decimal" placeholder="0.00"
                  className="w-full text-center text-5xl sm:text-6xl font-black bg-transparent border-none p-2 focus:ring-0 text-indigo-600 dark:text-indigo-400 font-mono tracking-tighter"
                  value={getMaskedINR(formData.amount || "")}
                  onChange={(e) => setFormData(p => ({ ...p, amount: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <div className={`relative bg-slate-50 dark:bg-slate-800 p-6 rounded-[28px] border-2 border-indigo-50 dark:border-slate-800 shadow-inner group flex items-center justify-between transition-all overflow-hidden ${calAnimating ? 'animate-calendar-active calendar-glow' : ''}`}>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 flex items-center gap-2 tracking-widest leading-none">
                        <Calendar size={12} className="text-indigo-400" /> Interaction Date
                      </label>
                      <p className="text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">
                        {new Date(formData.date || "").toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm text-indigo-500">
                      <CalendarDays size={22} />
                    </div>
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer z-20 date-input-overlay" value={formData.date} onClick={triggerCalAnimation} onChange={e => { setFormData(p => ({ ...p, date: e.target.value })); triggerCalAnimation(); }} />
                  </div>
                </div>

                {formData.type === 'expense' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400">Expense as credit</p>
                        <p className="text-[8px] font-black text-slate-500 opacity-60">Charge this to a person's ledger</p>
                      </div>
                      <button type="button" onClick={() => setMarkAsCredit(!markAsCredit)}>
                        {markAsCredit ? <ToggleRight className="text-indigo-600" size={32} /> : <ToggleLeft className="text-slate-300" size={32} />}
                      </button>
                    </div>
                    
                    {markAsCredit && (
                      <div className="space-y-2 animate-card-pop">
                        <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Person Select</label>
                        <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner" value={formData.person} onChange={e => setFormData(p => ({ ...p, person: e.target.value }))}>
                          <option value="">Choose party...</option>
                          {settings.peopleList.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Capture Bill</label>
                       <div className="flex items-center gap-4">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden">
                          {formData.billImage ? <img src={formData.billImage} className="w-full h-full object-cover" /> : <Camera size={24} />}
                        </button>
                        <span className="text-[9px] font-black uppercase text-slate-400">{formData.billImage ? 'Receipt Attached' : 'Snap Receipt'}</span>
                       </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Category</label>
                      <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                        {settings.expenseCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {formData.type === 'income' && (
                  <div className="space-y-2 animate-fade-in">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Income Category</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                      {settings.incomeCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                )}

                {formData.type === 'reminder' && (
                  <div className="space-y-2 animate-fade-in">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Reminder Category</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                      {settings.reminderCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                )}

                {formData.type === 'external' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Event Registry</label>
                      <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner" value={formData.eventId} onChange={e => setFormData(p => ({ ...p, eventId: e.target.value }))}>
                        <option value="">Select event...</option>
                        {settings.events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {formData.type !== 'external' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Asset Source</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner" value={formData.account} onChange={e => setFormData(p => ({ ...p, account: e.target.value }))}>
                      {settings.accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Metadata Note</label>
                  <div className="relative">
                    <textarea placeholder="Write details..." rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 dark:text-slate-200 shadow-inner" value={formData.note} onChange={e => setFormData(p => ({ ...p, note: e.target.value }))} />
                    <button type="button" onClick={() => { setIsEnhancing(true); enhanceTransactionDetails(formData.note || '', settings.expenseCats).then(r => { if(r) setFormData(p => ({...p, note: r.cleanNote, category: r.suggestedCategory})); setIsEnhancing(false); }); }} className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-xl shadow-xl active:scale-90">
                      {isEnhancing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button type="submit" className={`w-full py-5 rounded-2xl text-sm font-black uppercase tracking-[0.1em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${recordSuccess ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
                  {recordSuccess ? <CheckCircle2 size={20} /> : null}
                  {recordSuccess ? 'Logic Confirmed' : 'Authorize Log'}
                </button>
                {formData.type === 'external' && (
                  <button type="button" onClick={() => setShowEventCenter(true)} className="w-full py-4 bg-white dark:bg-slate-900 text-indigo-600 rounded-2xl font-black uppercase text-[10px] border border-indigo-100 dark:border-slate-800 shadow-sm flex items-center justify-center gap-2 active:scale-95">
                    <Briefcase size={16}/> Access Event History
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-tab-entry pb-20">
            <div className="flex justify-between items-center sticky top-0 bg-[#F8FAFC]/90 dark:bg-slate-950/90 backdrop-blur-xl py-4 z-20 px-2">
              <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest leading-none">Global Log</h2>
              <button onClick={() => setShowFilterModal(true)} className={`p-3 rounded-xl transition-all active:scale-90 ${typeFilter !== 'All' || accountFilter !== 'All' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'}`}>
                <SlidersHorizontal size={18} />
              </button>
            </div>
            <div className="space-y-4 px-2">
              {filteredTransactions.map((t) => (
                <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white dark:bg-slate-900 p-5 rounded-[32px] shadow-sm flex justify-between items-center group active:scale-[0.98] border border-transparent dark:border-slate-800/50 animate-card-pop cursor-pointer">
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 flex items-center justify-center rounded-[22px] ${
                      t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 
                      t.type === 'external' ? 'bg-purple-50 text-purple-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {t.type === 'income' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="font-black text-slate-800 dark:text-slate-100 text-sm truncate">{t.note || t.category}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{t.account}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-black font-mono tracking-tighter ${['income', 'repayment'].includes(t.type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {['income', 'repayment'].includes(t.type) ? '+' : '-'}{formatINR(t.amount).replace('₹ ', '')}
                    </p>
                    <p className="text-[8px] font-black text-slate-300 uppercase">{t.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'credit' && (
          <div className="space-y-6 animate-tab-entry pb-20 px-2">
             {!selectedPersonDetail ? (
               <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-indigo-50 dark:border-slate-800 text-center space-y-2 relative">
                    <Users size={32} className="mx-auto text-indigo-600 mb-2" />
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">Ledger Matrix</h2>
                    <p className="text-3xl font-black font-mono text-indigo-600">{formatINR(totalNetCredit)}</p>
                    <button onClick={() => setShowAddPersonModal(true)} className="absolute top-4 right-4 p-4 bg-indigo-600 text-white rounded-2xl"><UserPlus size={20}/></button>
                  </div>
                  <div className="space-y-4">
                    {settings.peopleList.map(person => (
                      <div key={person} onClick={() => setSelectedPersonDetail(person)} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm flex justify-between items-center group active:scale-[0.98] cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center font-black">{person.charAt(0)}</div>
                          <p className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase">{person}</p>
                        </div>
                        <p className={`text-base font-black font-mono ${personCredits[person] >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatINR(personCredits[person])}</p>
                      </div>
                    ))}
                  </div>
               </div>
             ) : (
               <div className="space-y-6">
                  <button onClick={() => setSelectedPersonDetail(null)} className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-indigo-600 active:scale-90"><ChevronLeft size={20}/></button>
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-[24px] flex items-center justify-center text-2xl font-black">{selectedPersonDetail.charAt(0)}</div>
                    <p className="text-3xl font-black font-mono text-indigo-600">{formatINR(personCredits[selectedPersonDetail])}</p>
                    <div className="flex gap-4 w-full">
                      <button onClick={() => { setFormData({...formData, person: selectedPersonDetail, type: 'repayment'}); setActiveTab('add'); }} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px]">Settle</button>
                      <button onClick={() => { setFormData({...formData, person: selectedPersonDetail, type: 'credit'}); setActiveTab('add'); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px]">Credit</button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {ledgerHistory.map(t => (
                      <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white dark:bg-slate-900 p-5 rounded-[32px] shadow-sm flex justify-between items-center cursor-pointer">
                        <p className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase">{t.note || t.category}</p>
                        <p className={`font-mono font-black ${t.type === 'repayment' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'repayment' ? '+' : '-'}{formatINR(t.amount).replace('₹ ', '')}</p>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'profile' && profileView === 'menu' && (
          <div className="space-y-6 animate-tab-entry px-2">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-indigo-50 dark:border-slate-800 flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-indigo-600 text-white rounded-[28px] flex items-center justify-center text-3xl font-black shadow-xl">
                {settings.profile.name.charAt(0) || <User size={40}/>}
              </div>
              <div className="text-center">
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">{settings.profile.name || "System User"}</h2>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{settings.profile.email || "No email linked"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { label: 'Security & Privacy', icon: ShieldCheck, view: 'security', color: 'text-indigo-600' },
                { label: 'Asset Management', icon: Wallet, view: 'accounts', color: 'text-emerald-600' },
                { label: 'Categorization', icon: Tags, view: 'categories', color: 'text-purple-600' },
                { label: 'System Theme', icon: settings.theme === 'dark' ? Sun : Moon, action: () => setSettings(s => ({...s, theme: s.theme === 'dark' ? 'light' : 'dark'})), color: 'text-amber-500' }
              ].map(item => (
                <button 
                  key={item.label} 
                  onClick={() => item.action ? item.action() : setProfileView(item.view!)}
                  className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm flex justify-between items-center active:scale-[0.98] border border-transparent dark:border-slate-800/50"
                >
                  <div className="flex items-center gap-4">
                    <item.icon className={item.color} size={20} />
                    <span className="font-black text-slate-700 dark:text-slate-200 uppercase text-xs tracking-widest">{item.label}</span>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-[800] pb-6 px-6 no-print">
        <div className="max-w-2xl mx-auto bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-3xl px-6 py-4 rounded-[32px] flex justify-between items-center shadow-2xl border border-white/10 ring-1 ring-white/5">
          {[
            { id: 'dashboard', icon: PieChart, label: 'HUB' },
            { id: 'history', icon: History, label: 'LOGS' },
            { id: 'add', icon: Plus, label: 'ENTRY', fab: true },
            { id: 'credit', icon: User, label: 'LEDGER' },
            { id: 'profile', icon: Contact, label: 'SYSTEM' }
          ].map(tab => (
            tab.fab ? (
              <button key={tab.id} onClick={() => setActiveTab('add')} className={`w-14 h-14 -mt-10 rounded-2xl flex items-center justify-center shadow-2xl ${activeTab === 'add' ? 'bg-white text-indigo-600 scale-110 rotate-45' : 'bg-indigo-600 text-white'}`}>
                <Plus size={28} />
              </button>
            ) : (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setProfileView('menu'); }} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === tab.id ? 'text-indigo-400 scale-110' : 'text-slate-500'}`}>
                <tab.icon size={20} />
                <span className="text-[7px] font-black uppercase tracking-[0.15em]">{tab.label}</span>
              </button>
            )
          ))}
        </div>
      </nav>

      {/* Overlays */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[1000] flex items-end justify-center animate-fade-in" onClick={() => setShowFilterModal(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[40px] shadow-2xl p-8 space-y-8 animate-card-pop" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black uppercase text-slate-800 dark:text-slate-100">Global Filters</h2>
              <button onClick={() => setShowFilterModal(false)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><X size={20}/></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transaction Type</p>
                <div className="flex flex-wrap gap-2">
                  {['All', 'expense', 'income', 'external', 'reminder', 'credit', 'repayment'].map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Asset Link</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setAccountFilter('All')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${accountFilter === 'All' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>All Assets</button>
                  {settings.accounts.map(acc => (
                    <button key={acc} onClick={() => setAccountFilter(acc)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${accountFilter === acc ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{acc}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setShowFilterModal(false)} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase">Verify Parameters</button>
          </div>
        </div>
      )}

      {viewingTransaction && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[2000] flex items-end justify-center animate-fade-in" onClick={() => setViewingTransaction(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[40px] p-8 space-y-8 animate-tab-entry" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewingTransaction.type}</p>
               <p className={`text-5xl font-black font-mono ${['income', 'repayment'].includes(viewingTransaction.type) ? 'text-emerald-600' : 'text-rose-600'}`}>{formatINR(viewingTransaction.amount)}</p>
               <p className="text-xs font-black uppercase text-slate-500">{viewingTransaction.date} • {viewingTransaction.account}</p>
            </div>
            {viewingTransaction.billImage && <img src={viewingTransaction.billImage} className="w-full rounded-[32px] shadow-xl" />}
            <p className="text-center text-sm font-medium italic text-slate-500">"{viewingTransaction.note || 'No metadata attached'}"</p>
            <button onClick={() => setViewingTransaction(null)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase">Close Evidence</button>
          </div>
        </div>
      )}

      {showEventCenter && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[1500] flex flex-col animate-fade-in no-print">
          <div className="p-8 flex items-center justify-between border-b border-white/10">
             <div className="flex items-center gap-3">
                <Briefcase className="text-purple-400" size={24}/>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Event Center</h2>
             </div>
             <button onClick={() => { setShowEventCenter(false); setSelectedEventDetail(null); }} className="p-3 bg-white/10 rounded-2xl text-white active:scale-90"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
            {!selectedEventDetail ? (
              <div className="grid grid-cols-1 gap-4">
                {settings.events.map(ev => (
                  <button key={ev.id} onClick={() => setSelectedEventDetail(ev.id)} className="p-6 bg-white/5 border border-white/10 rounded-[32px] flex justify-between items-center group active:scale-[0.98]">
                    <p className="font-black text-white uppercase text-sm tracking-widest">{ev.name}</p>
                    <p className="font-mono font-black text-purple-400 text-lg">{formatINR(eventStats[ev.id])}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                 <button onClick={() => setSelectedEventDetail(null)} className="flex items-center gap-2 text-indigo-400 font-black uppercase text-[10px]"><ChevronLeft size={14}/> Registry List</button>
                 <div className="bg-purple-600 p-8 rounded-[40px] text-white shadow-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Event Logic Volume</p>
                    <h3 className="text-3xl font-black font-mono mt-1">{formatINR(eventStats[selectedEventDetail])}</h3>
                 </div>
                 <div className="space-y-3">
                   {eventTransactions.map(t => (
                     <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white/5 border border-white/10 p-5 rounded-[32px] flex justify-between items-center cursor-pointer">
                        <p className="font-black text-white text-xs uppercase">{t.note || t.category}</p>
                        <p className="font-mono font-black text-sm text-purple-400">{formatINR(t.amount).replace('₹ ', '')}</p>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {pinEntryMode && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[2000] flex items-center justify-center p-6 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center space-y-8 animate-card-pop">
            <Lock size={36} className={`mx-auto ${pinError ? 'text-rose-600 animate-shake' : 'text-indigo-600 animate-bounce'}`} />
            <form onSubmit={handleVerifyPin} className="space-y-6">
              <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Verification PIN</h2>
              <input autoFocus type="password" inputMode="numeric" maxLength={4} className="w-full text-center text-5xl font-black bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 tracking-[0.4em] border-none focus:ring-0" value={enteredPin} onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ''))} />
              <div className="flex flex-col gap-3">
                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase shadow-xl">Authorize Access</button>
                <button type="button" onClick={() => setPinEntryMode(false)} className="text-[10px] font-black uppercase text-slate-400">Abort</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddPersonModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-8 space-y-6 animate-card-pop">
            <h2 className="text-xl font-black uppercase tracking-tight text-center text-slate-800 dark:text-slate-100">Identity Registry</h2>
            <div className="space-y-4">
              <input autoFocus type="text" placeholder="Legal Name..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold dark:text-slate-200 shadow-inner" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={() => setShowAddPersonModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Cancel</button>
                <button onClick={() => { if(newItemName) { setSettings(s => ({...s, peopleList: [...new Set([...s.peopleList, newItemName])]})); setNewItemName(""); setShowAddPersonModal(false); } }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px]">Register</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
