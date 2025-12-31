
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Minus, Wallet, ArrowUpRight, ArrowDownLeft, Bell, History, User, 
  PieChart, Trash2, X, Loader2, ChevronDown, ChevronUp, ChevronLeft, 
  RotateCcw, Save, Coins, Clock, Sparkles, BellRing, AlarmClockPlus, 
  ListFilter, UserPlus, Users, Lock, Unlock, ShieldCheck, Tv, 
  Smartphone, Repeat, Eye, EyeOff, AlertCircle, ReceiptText, 
  Activity, Filter, Contact, Mail, Phone, MapPin, CheckCircle2, 
  ChevronRight, Tags, CreditCard, FileDown, AlertTriangle, Moon, Sun, Monitor, Calendar,
  CalendarDays, Download, FileText, Share2, Info, Camera, Image as ImageIcon, ToggleLeft, ToggleRight,
  Edit2, Check, UserMinus, Search, Settings2, SlidersHorizontal, Layers, Briefcase
} from 'lucide-react';
import { 
  Transaction, TransactionType, UserSettings, AutoPayRule, ProfileInfo, AppEvent 
} from './types';
import { 
  INITIAL_SETTINGS, DEFAULT_ACCOUNTS, DEFAULT_EXP_CATS, DEFAULT_INC_CATS, DEFAULT_REM_CATS 
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
  const STORAGE_KEY = 'fintrack_pro_v14_stable';

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
    
    // Handle "Expense as Credit"
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
      category: formData.category || (effectiveType === 'reminder' ? 'Alert' : 'General'),
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
      setAdjustmentTarget(null);
      setMarkAsCredit(false);
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

  const startEditingEvent = (ev: AppEvent) => {
    setEditingEventId(ev.id);
    setEditingEventName(ev.name);
  };

  const saveEditedEvent = () => {
    if (!editingEventId || !editingEventName.trim()) return;
    setSettings(s => ({
      ...s,
      events: s.events.map(ev => ev.id === editingEventId ? { ...ev, name: editingEventName } : ev)
    }));
    setEditingEventId(null);
  };

  const startEditingPaidBy = (idx: number) => {
    setEditingPaidByIdx(idx);
    setEditingPaidByName(settings.paidByList[idx]);
  };

  const saveEditedPaidBy = () => {
    if (editingPaidByIdx === null || !editingPaidByName.trim()) return;
    const newList = [...settings.paidByList];
    newList[editingPaidByIdx] = editingPaidByName;
    setSettings(s => ({ ...s, paidByList: newList }));
    setEditingPaidByIdx(null);
  };

  const triggerCalAnimation = () => {
      setCalAnimating(true);
      setTimeout(() => setCalAnimating(false), 400);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;

  return (
    <div className={`min-h-screen pb-32 max-w-2xl mx-auto bg-[#F8FAFC] dark:bg-slate-950 relative overflow-x-hidden shadow-2xl transition-colors duration-300`}>
      
      <div className="absolute top-0 left-0 w-full h-72 bg-indigo-600 dark:bg-indigo-900 rounded-b-[40px] z-0 shadow-2xl transition-all duration-700 no-print"></div>

      <header className="relative z-10 px-6 pt-10 pb-6 text-white animate-fade-in no-print">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div 
              onMouseDown={() => { longPressTimer.current = window.setTimeout(() => requestPin('reset_pin'), 1500); }}
              onMouseUp={() => clearTimeout(longPressTimer.current!)}
              className="bg-white/20 p-2.5 rounded-xl backdrop-blur-2xl border border-white/20 shadow-xl active:scale-90"
            >
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
              {[
                { id: 'remind', label: 'Reminders', icon: AlarmClockPlus, color: 'text-indigo-600 dark:text-indigo-400', action: () => { setFormData({...formData, type: 'reminder'}); setActiveTab('add'); } },
                { id: 'auto', label: 'Auto-Pay', icon: Activity, color: 'text-emerald-600 dark:text-emerald-400', action: () => setShowAutoPayManager(true) },
              ].map((action, idx) => (
                <button 
                  key={action.id} onClick={action.action}
                  className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center gap-2 hover:shadow-xl active:scale-90 animate-card-pop stagger-idx"
                >
                  <action.icon className={action.color} size={24} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">{action.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 px-2 animate-fade-in">System Map</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {settings.accounts.map((acc, idx) => {
                  const isLocked = settings.accountLockSettings[acc];
                  return (
                    <div key={acc} className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group animate-card-pop stagger-idx">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-1.5">
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
                  <div 
                    className={`relative bg-slate-50 dark:bg-slate-800 p-6 rounded-[28px] border-2 border-indigo-50 dark:border-slate-800 shadow-inner group flex items-center justify-between transition-all overflow-hidden ${calAnimating ? 'animate-calendar-active calendar-glow' : ''}`}
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 flex items-center gap-2 tracking-widest leading-none">
                        <Calendar size={12} className="text-indigo-400" /> Interaction Date
                      </label>
                      <p className="text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter transition-all">
                        {new Date(formData.date || "").toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm text-indigo-500">
                      <CalendarDays size={22} />
                    </div>
                    <input 
                      type="date" 
                      className="absolute inset-0 opacity-0 cursor-pointer z-20 date-input-overlay"
                      value={formData.date} 
                      onClick={triggerCalAnimation}
                      onChange={e => { setFormData(p => ({ ...p, date: e.target.value })); triggerCalAnimation(); }}
                    />
                  </div>
                </div>

                {formData.type === 'external' ? (
                  <div className="space-y-6 animate-fade-in">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Select Event</label>
                      <select 
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner focus:ring-2 ring-indigo-100"
                        value={formData.eventId} 
                        onChange={e => setFormData(p => ({ ...p, eventId: e.target.value }))}
                      >
                        <option value="">Select Event...</option>
                        {settings.events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Paid By</label>
                      <div className="flex flex-wrap gap-2">
                        {settings.paidByList.map(name => (
                          <button 
                            key={name} type="button"
                            onClick={() => setFormData(p => ({ ...p, paidBy: name }))}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.paidBy === name ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Payment Method</label>
                      <div className="flex gap-2">
                        {['Cash', 'Wallet', 'UPI'].map(method => (
                          <button 
                            key={method} type="button"
                            onClick={() => setFormData(p => ({ ...p, paymentMethod: method as any }))}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.paymentMethod === method ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Bill Evidence</label>
                      <div className="flex items-center gap-4">
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden"
                        >
                          {formData.billImage ? <img src={formData.billImage} className="w-full h-full object-cover" /> : <Camera size={24} />}
                        </button>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{formData.billImage ? 'Image Captured' : 'Capture Bill'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Asset Source</label>
                      <select 
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner focus:ring-2 ring-indigo-100"
                        value={formData.account} 
                        onChange={e => setFormData(p => ({ ...p, account: e.target.value }))}
                      >
                        {settings.accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                      </select>
                    </div>

                    {formData.type === 'expense' && (
                       <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-[28px] border border-slate-100 dark:border-slate-700">
                           <div>
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mark as Credit</p>
                              <p className="text-[8px] font-black text-slate-500 uppercase">This records the expense as a loan</p>
                           </div>
                           <button type="button" onClick={() => setMarkAsCredit(!markAsCredit)}>
                              {markAsCredit ? <ToggleRight className="text-indigo-600" size={32}/> : <ToggleLeft className="text-slate-300" size={32}/>}
                           </button>
                        </div>

                        {markAsCredit && (
                          <div className="space-y-2 animate-card-pop">
                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Select Recipient</label>
                            <select 
                              required={markAsCredit}
                              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner focus:ring-2 ring-indigo-100"
                              value={formData.person} 
                              onChange={e => setFormData(p => ({ ...p, person: e.target.value }))}
                            >
                              <option value="">Select Identity...</option>
                              {settings.peopleList.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Snap Bill Receipt</label>
                          <div className="flex items-center gap-4">
                            <button 
                              type="button" 
                              onClick={() => fileInputRef.current?.click()}
                              className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
                            >
                              {formData.billImage ? <img src={formData.billImage} className="w-full h-full object-cover" /> : <Camera size={20} />}
                            </button>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{formData.billImage ? 'Receipt Attached' : 'Optional Evidence'}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Category</label>
                           <select 
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner"
                            value={formData.category} 
                            onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                          >
                            {settings.expenseCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {formData.type === 'income' && (
                       <div className="space-y-2 animate-fade-in">
                        <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Category</label>
                        <select 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner"
                          value={formData.category} 
                          onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                        >
                          {settings.incomeCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                    )}

                    {formData.type === 'reminder' && (
                       <div className="space-y-2 animate-fade-in">
                        <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Reminder Category</label>
                        <select 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner"
                          value={formData.category} 
                          onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                        >
                          {settings.reminderCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                    )}
                    
                    {(formData.type === 'credit' || formData.type === 'repayment') && (
                      <div className="space-y-2 animate-fade-in">
                        <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Involved Party</label>
                        <select 
                          required
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-slate-200 shadow-inner focus:ring-2 ring-indigo-100"
                          value={formData.person} 
                          onChange={e => setFormData(p => ({ ...p, person: e.target.value }))}
                        >
                          <option value="">Select Person...</option>
                          {settings.peopleList.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 pl-2">Details (AI Assist Available)</label>
                  <div className="relative">
                    <textarea 
                      placeholder="Transaction note..." rows={2} 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 dark:text-slate-200 shadow-inner"
                      value={formData.note}
                      onChange={e => setFormData(p => ({ ...p, note: e.target.value }))}
                    />
                    <button 
                      type="button" 
                      onClick={() => { setIsEnhancing(true); enhanceTransactionDetails(formData.note || '', settings.expenseCats).then(r => { if(r) setFormData(p => ({...p, note: r.cleanNote, category: r.suggestedCategory})); setIsEnhancing(false); }); }}
                      className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-xl shadow-xl active:scale-90"
                    >
                      {isEnhancing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  type="submit" 
                  className={`w-full py-5 rounded-2xl text-sm font-black uppercase tracking-[0.1em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${recordSuccess ? 'bg-emerald-500' : 'bg-indigo-600 text-white'}`}
                >
                  {recordSuccess ? <CheckCircle2 size={20} /> : null}
                  {recordSuccess ? 'Logic Recorded' : (formData.type === 'external' ? 'Log Event Cost' : 'Authorize Entry')}
                </button>

                {formData.type === 'external' && (
                  <button 
                    type="button"
                    onClick={() => setShowEventCenter(true)}
                    className="w-full py-4 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-purple-100 dark:border-purple-800 active:scale-95"
                  >
                    <Briefcase size={16}/> View Event History
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-tab-entry pb-20">
            <div className="flex justify-between items-center sticky top-0 bg-[#F8FAFC]/90 dark:bg-slate-950/90 backdrop-blur-xl py-4 z-20 px-2">
              <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest leading-none">Master Register</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowFilterModal(true)} 
                  className={`p-3 rounded-xl transition-all active:scale-90 shadow-sm ${typeFilter !== 'All' || accountFilter !== 'All' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-indigo-600'}`}
                >
                  <SlidersHorizontal size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-2">
              {filteredTransactions.map((t, idx) => {
                const eventName = settings.events.find(ev => ev.id === t.eventId)?.name;
                return (
                <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white dark:bg-slate-900 p-5 rounded-[32px] shadow-sm flex justify-between items-center group active:scale-[0.98] border border-transparent dark:border-slate-800/50 animate-card-pop stagger-idx cursor-pointer">
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 flex items-center justify-center rounded-[22px] shadow-sm ${
                      t.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 
                      t.type === 'external' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 
                      t.type === 'reminder' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'
                    }`}>
                      {t.type === 'income' ? <ArrowDownLeft size={24} /> : 
                       t.type === 'external' ? <Share2 size={24} /> : 
                       t.type === 'reminder' ? <BellRing size={24} /> : <ArrowUpRight size={24} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="font-black text-slate-800 dark:text-slate-100 text-sm truncate">{t.note || t.category}</p>
                      <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-none">
                            {t.type === 'external' ? (eventName || t.paidBy || 'External') : (t.person || t.account)}
                          </span>
                          {t.type === 'external' && <span className="text-[8px] font-black bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded uppercase">{t.paymentMethod}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-base font-black font-mono tracking-tighter ${
                        t.type === 'income' || t.type === 'repayment' ? 'text-emerald-600' : 
                        t.type === 'external' ? 'text-purple-600' : 
                        t.type === 'reminder' ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {t.type === 'income' || t.type === 'repayment' ? '+' : ''}{formatINR(t.amount).replace('₹ ', '')}
                      </p>
                      <p className="text-[8px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">{t.date}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* Other tabs remain the same (Ledger, Profile, Sync, Categories etc.) */}
        {activeTab === 'credit' && (
          <div className="space-y-6 animate-tab-entry pb-20 px-2">
            {!selectedPersonDetail ? (
              <>
                <div className="flex flex-col gap-6">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-indigo-50 dark:border-slate-800 text-center space-y-2 relative">
                    <Users size={32} className="mx-auto text-indigo-600 mb-2" />
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">Master Ledger</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Outbound Credit</p>
                    <p className="text-3xl font-black font-mono text-indigo-600 tracking-tighter">{formatINR(totalNetCredit)}</p>
                    <button onClick={() => setShowAddPersonModal(true)} className="absolute top-4 right-4 p-4 bg-indigo-600 text-white rounded-2xl shadow-xl active:scale-90 transition-transform">
                      <UserPlus size={20} />
                    </button>
                  </div>

                  <div className="relative">
                    <input 
                      type="text" placeholder="Find Identity..."
                      className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl p-5 pl-14 font-bold dark:text-slate-200 shadow-sm"
                      value={personSearch} onChange={e => setPersonSearch(e.target.value)}
                    />
                    <Search className="absolute left-5 top-5 text-slate-400" size={20} />
                  </div>

                  <div className="space-y-4">
                    {settings.peopleList.filter(p => p.toLowerCase().includes(personSearch.toLowerCase())).map(person => (
                      <div 
                        key={person} 
                        onClick={() => setSelectedPersonDetail(person)}
                        className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm border border-transparent dark:border-slate-800/50 flex justify-between items-center group active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
                            {person.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-widest">{person}</p>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.1em]">Tap for history</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-base font-black font-mono tracking-tighter ${personCredits[person] >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                            {formatINR(personCredits[person])}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedPersonDetail(null)} className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-indigo-600 active:scale-90">
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest leading-none">Detail: {selectedPersonDetail}</h2>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm flex flex-col items-center gap-4 border border-indigo-50 dark:border-slate-800">
                  <div className="w-16 h-16 bg-indigo-600 text-white rounded-[24px] flex items-center justify-center text-2xl font-black">
                    {selectedPersonDetail.charAt(0)}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Outstanding Balance</p>
                    <p className={`text-4xl font-black font-mono tracking-tighter ${personCredits[selectedPersonDetail] >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {formatINR(personCredits[selectedPersonDetail])}
                    </p>
                  </div>
                  <div className="flex gap-4 w-full pt-4">
                    <button onClick={() => { setFormData({...formData, person: selectedPersonDetail, type: 'repayment'}); setActiveTab('add'); }} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95">Settle Up</button>
                    <button onClick={() => { setFormData({...formData, person: selectedPersonDetail, type: 'credit'}); setActiveTab('add'); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95">Record New</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">History Log</h3>
                  {ledgerHistory.length > 0 ? (
                    ledgerHistory.map(t => (
                      <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white dark:bg-slate-900 p-5 rounded-[32px] shadow-sm flex justify-between items-center border border-transparent dark:border-slate-800/50 cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${t.type === 'repayment' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {t.type === 'repayment' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase">{t.note || t.category}</p>
                            <p className="text-[8px] text-slate-400 font-black uppercase">{t.date}</p>
                          </div>
                        </div>
                        <p className={`font-mono font-black text-sm ${t.type === 'repayment' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'repayment' ? '+' : '-'}{formatINR(t.amount).replace('₹ ', '')}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest">No Log Entries</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
           <div className="space-y-6 animate-tab-entry pb-20">
             <div className="flex items-center gap-4 px-2">
                {profileView !== 'menu' && (
                  <button onClick={() => setProfileView(
                    profileView === 'feature_toggles' || profileView === 'event_sub_settings' ? 'menu' : 
                    ['event_paid_by', 'event_manage', 'event_transactions_view'].includes(profileView) ? 'event_sub_settings' : 'menu'
                  )} className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-indigo-600 active:scale-90">
                    <ChevronLeft size={20} />
                  </button>
                )}
                <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest leading-none">
                  {profileView === 'menu' ? 'System HUB' : profileView.replace(/_/g, ' ').toUpperCase()}
                </h2>
              </div>

              {profileView === 'menu' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-indigo-50 dark:border-slate-800 flex flex-col items-center gap-6 text-center animate-card-pop">
                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center shadow-inner relative group">
                      <User size={40} />
                      <button onClick={() => setSettings(s => ({...s, theme: s.theme === 'dark' ? 'light' : 'dark'}))} className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-full border-2 border-white dark:border-slate-900 active:scale-90 transition-transform">
                        {settings.theme === 'dark' ? <Sun size={14}/> : <Moon size={14}/>}
                      </button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{settings.profile.name || "System Owner"}</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{settings.profile.email || "Authentication Active"}</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-sm overflow-hidden divide-y dark:divide-slate-800 border border-slate-100 dark:border-slate-800">
                    {[
                      { id: 'identity', label: 'Identity Registry', icon: Contact, color: 'text-indigo-600' },
                      { id: 'feature_toggles', label: 'Feature Protocols', icon: Smartphone, color: 'text-emerald-600' },
                      { id: 'sync', label: 'Balance Sync', icon: RotateCcw, color: 'text-amber-600' },
                      { id: 'categories', label: 'Logic Maps', icon: Tags, color: 'text-blue-600' },
                      { id: 'assets', label: 'Asset Labels', icon: CreditCard, color: 'text-indigo-400' },
                      { id: 'security', label: 'Access Protocols', icon: Lock, color: 'text-rose-600' },
                      { id: 'exports', label: 'System Backup', icon: FileDown, color: 'text-slate-600' }
                    ].map(item => (
                      <button key={item.id} onClick={() => setProfileView(item.id)} className="w-full p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 group transition-all">
                        <div className="flex items-center gap-4">
                          <item.icon size={20} className={item.color}/>
                          <span className="font-black text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-widest leading-none">{item.label}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-200 dark:text-slate-700 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {profileView === 'feature_toggles' && (
                <div className="space-y-4 animate-card-pop px-2">
                  <button onClick={() => setProfileView('event_sub_settings')} className="w-full p-6 bg-white dark:bg-slate-900 rounded-[32px] shadow-sm flex items-center justify-between border border-slate-100 dark:border-slate-800 group transition-all">
                      <div className="flex items-center gap-4">
                        <Share2 size={20} className="text-purple-600"/>
                        <span className="font-black text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-widest leading-none">Event Settings</span>
                      </div>
                      <ChevronRight size={18} className="text-slate-200 dark:text-slate-700 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              {profileView === 'event_sub_settings' && (
                <div className="space-y-4 animate-card-pop px-2">
                   <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm flex items-center justify-between border border-slate-100 dark:border-slate-800 mb-2">
                    <div>
                      <p className="font-black text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest">Event Protocol</p>
                      <p className="text-[9px] text-slate-400 uppercase font-black">Master Toggle</p>
                    </div>
                    <button onClick={() => setSettings(s => ({...s, showExternal: !s.showExternal}))}>
                      {settings.showExternal ? <ToggleRight className="text-indigo-600" size={36}/> : <ToggleLeft className="text-slate-300" size={36}/>}
                    </button>
                  </div>
                  
                  {[
                    { id: 'event_paid_by', label: 'Paid By Ledger', icon: Users, color: 'text-purple-600' },
                    { id: 'event_manage', label: 'Manage Event Registry', icon: Layers, color: 'text-indigo-600' }
                  ].map(item => (
                    <button key={item.id} onClick={() => setProfileView(item.id)} className="w-full p-6 bg-white dark:bg-slate-900 rounded-[32px] shadow-sm flex items-center justify-between border border-slate-100 dark:border-slate-800 group transition-all">
                      <div className="flex items-center gap-4">
                        <item.icon size={20} className={item.color}/>
                        <span className="font-black text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-widest leading-none">{item.label}</span>
                      </div>
                      <ChevronRight size={18} className="text-slate-200 dark:text-slate-700 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))}
                </div>
              )}

              {profileView === 'event_paid_by' && (
                <div className="space-y-6 animate-card-pop px-2">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Manage Payees</h3>
                    <div className="space-y-3">
                      {settings.paidByList.map((name, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between group border border-slate-100 dark:border-slate-800">
                          {editingPaidByIdx === idx ? (
                            <div className="flex items-center gap-2 flex-1 mr-4">
                              <input 
                                autoFocus
                                className="flex-1 bg-white dark:bg-slate-900 rounded-lg p-2 text-xs font-black uppercase border border-indigo-200"
                                value={editingPaidByName} onChange={e => setEditingPaidByName(e.target.value)}
                                onBlur={saveEditedPaidBy}
                                onKeyDown={e => e.key === 'Enter' && saveEditedPaidBy()}
                              />
                              <button onClick={saveEditedPaidBy} className="p-2 bg-emerald-500 text-white rounded-lg"><Check size={14}/></button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">{name}</span>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => startEditingPaidBy(idx)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={16}/></button>
                            <button onClick={() => setSettings(s => ({...s, paidByList: s.paidByList.filter((_, i) => i !== idx)}))} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <input 
                        type="text" placeholder="New Name..."
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold text-xs dark:text-slate-200"
                        value={newItemName} onChange={e => setNewItemName(e.target.value)}
                      />
                      <button onClick={() => { if(newItemName) { setSettings(s => ({...s, paidByList: [...s.paidByList, newItemName]})); setNewItemName(""); } }} className="p-4 bg-indigo-600 text-white rounded-xl active:scale-90"><Plus size={20}/></button>
                    </div>
                  </div>
                </div>
              )}

              {profileView === 'event_manage' && (
                <div className="space-y-6 animate-card-pop px-2">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Event Registry</h3>
                    <div className="space-y-3">
                      {settings.events.map(ev => (
                        <div key={ev.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between group border border-slate-100 dark:border-slate-800">
                          {editingEventId === ev.id ? (
                            <div className="flex items-center gap-2 flex-1 mr-4">
                              <input 
                                autoFocus
                                className="flex-1 bg-white dark:bg-slate-900 rounded-lg p-2 text-xs font-black uppercase border border-indigo-200"
                                value={editingEventName} onChange={e => setEditingEventName(e.target.value)}
                                onBlur={saveEditedEvent}
                                onKeyDown={e => e.key === 'Enter' && saveEditedEvent()}
                              />
                              <button onClick={saveEditedEvent} className="p-2 bg-emerald-500 text-white rounded-lg"><Check size={14}/></button>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">{ev.name}</span>
                              <button onClick={() => { setSelectedEventDetail(ev.id); setProfileView('event_transactions_view'); }} className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest mt-1 hover:underline">View History</button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => startEditingEvent(ev)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={16}/></button>
                            <button onClick={() => setSettings(s => ({...s, events: s.events.filter(e => e.id !== ev.id)}))} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <input 
                        type="text" placeholder="Event Name..."
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold text-xs dark:text-slate-200"
                        value={newItemName} onChange={e => setNewItemName(e.target.value)}
                      />
                      <button onClick={() => { if(newItemName) { setSettings(s => ({...s, events: [...s.events, { id: crypto.randomUUID(), name: newItemName }]})); setNewItemName(""); } }} className="p-4 bg-indigo-600 text-white rounded-xl active:scale-90"><Plus size={20}/></button>
                    </div>
                  </div>
                </div>
              )}

              {profileView === 'event_transactions_view' && (
                <div className="space-y-6 animate-card-pop px-2">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setProfileView('event_manage')} className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-indigo-600 active:scale-90">
                      <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest leading-none">History: {settings.events.find(e => e.id === selectedEventDetail)?.name}</h2>
                  </div>
                  <div className="space-y-4">
                    {eventTransactions.length > 0 ? (
                      eventTransactions.map(t => (
                        <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white dark:bg-slate-900 p-5 rounded-[32px] shadow-sm flex justify-between items-center border border-transparent dark:border-slate-800/50 cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                              <Share2 size={18}/>
                            </div>
                            <div>
                              <p className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase">{t.note || t.category}</p>
                              <p className="text-[8px] text-slate-400 font-black uppercase">{t.date} • {t.paidBy}</p>
                            </div>
                          </div>
                          <p className="font-mono font-black text-sm text-purple-600">
                            {formatINR(t.amount).replace('₹ ', '')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest">No Event Log</div>
                    )}
                  </div>
                </div>
              )}

              {profileView === 'sync' && (
                <div className="space-y-4 animate-card-pop px-2">
                  {settings.accounts.map(acc => (
                    <button key={acc} onClick={() => { setAdjustmentTarget({ type: 'account', id: acc }); setFormData({ amount: 0 }); setActiveTab('add'); setFormData(p => ({...p, type: 'adjustment'})); }} className="w-full p-6 bg-white dark:bg-slate-900 rounded-[32px] shadow-sm flex justify-between items-center border border-slate-100 dark:border-slate-800 active:scale-[0.98]">
                        <span className="font-black text-xs uppercase tracking-widest text-slate-700 dark:text-slate-200">{acc}</span>
                        <div className="text-right">
                          <p className="font-mono font-black text-indigo-600">{formatINR(accountBalances[acc])}</p>
                          <span className="text-[8px] font-black text-slate-400 uppercase">Tap to Re-Sync</span>
                        </div>
                    </button>
                  ))}
                </div>
              )}

              {profileView === 'categories' && (
                <div className="space-y-6 animate-card-pop px-2">
                  <div className="flex p-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 overflow-x-auto no-scrollbar">
                    {(['expense', 'income', 'reminder'] as const).map(t => (
                      <button 
                        key={t} onClick={() => setCategoryTypeTab(t)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${categoryTypeTab === t ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-sm space-y-6 border border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2">
                      <input 
                        type="text" placeholder={`Add ${categoryTypeTab}...`}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold text-xs dark:text-slate-200"
                        value={newItemName} onChange={e => setNewItemName(e.target.value)}
                      />
                      <button onClick={() => { 
                        if(newItemName) { 
                          const key = categoryTypeTab === 'expense' ? 'expenseCats' : categoryTypeTab === 'income' ? 'incomeCats' : 'reminderCats';
                          setSettings(s => ({...s, [key]: [...s[key], newItemName]})); 
                          setNewItemName(""); 
                        } 
                      }} className="p-4 bg-indigo-600 text-white rounded-xl active:scale-90"><Plus size={20}/></button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {settings[categoryTypeTab === 'expense' ? 'expenseCats' : categoryTypeTab === 'income' ? 'incomeCats' : 'reminderCats'].map(cat => (
                        <div key={cat} className="px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center gap-2 group border border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">{cat}</span>
                          <button onClick={() => {
                            const key = categoryTypeTab === 'expense' ? 'expenseCats' : categoryTypeTab === 'income' ? 'incomeCats' : 'reminderCats';
                            setSettings(s => ({...s, [key]: s[key].filter(c => c !== cat)}));
                          }} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {profileView === 'assets' && (
                <div className="space-y-4 animate-card-pop px-2">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                    <div className="flex gap-2">
                       <input 
                        type="text" placeholder="Asset Label..."
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold dark:text-slate-200"
                        value={newItemName} onChange={e => setNewItemName(e.target.value)}
                      />
                      <button onClick={() => { if(newItemName) { setSettings(s => ({...s, accounts: [...s.accounts, newItemName]})); setNewItemName(""); } }} className="p-4 bg-indigo-600 text-white rounded-xl"><Plus size={20}/></button>
                    </div>
                    <div className="space-y-3">
                      {settings.accounts.map(acc => {
                        const isLocked = settings.accountLockSettings[acc];
                        return (
                          <div key={acc} className="flex justify-between items-center p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl group border border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{acc}</span>
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => setSettings(s => ({
                                  ...s, 
                                  accountLockSettings: { ...s.accountLockSettings, [acc]: !isLocked }
                                }))}
                                className={`p-2.5 rounded-xl transition-all ${isLocked ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}
                              >
                                {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                              </button>
                              <button onClick={() => setSettings(s => ({...s, accounts: s.accounts.filter(a => a !== acc)}))} className="p-2 text-slate-400 hover:text-rose-600 transition-all active:scale-90"><Trash2 size={18}/></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {profileView === 'security' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-2xl space-y-8 animate-card-pop text-center border border-indigo-50 dark:border-slate-800 mx-2">
                  <ShieldCheck size={48} className="mx-auto text-indigo-600 animate-pulse" />
                  <div className="space-y-4">
                    <input 
                      type="password" inputMode="numeric" maxLength={4} placeholder="Master PIN"
                      className="w-full text-center text-4xl font-black bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 shadow-inner dark:text-slate-100 tracking-[0.4em] focus:ring-4 ring-indigo-50"
                      value={newPinInput} onChange={(e) => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                    <button onClick={() => { setSettings(s => ({...s, balancePin: newPinInput})); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Engage Security Lock</button>
                    {saveSuccess && <p className="text-[10px] text-emerald-500 uppercase font-black">Access Protocol Initialized</p>}
                  </div>
                </div>
              )}

              {profileView === 'exports' && (
                <div className="space-y-6 animate-card-pop px-2">
                   <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                      <button onClick={() => {
                        const data = JSON.stringify({ transactions, settings }, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `fintrack_full_backup_${todayStr}.json`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }} className="w-full flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl hover:bg-indigo-50 active:scale-95 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Download size={24}/></div>
                          <div className="text-left">
                            <p className="font-black text-slate-800 dark:text-slate-100 uppercase text-xs">JSON Backup</p>
                            <p className="text-[9px] text-slate-400 uppercase font-black">Full snapshot</p>
                          </div>
                        </div>
                      </button>
                      <button onClick={() => setShowResetConfirm(true)} className="w-full flex items-center justify-between p-6 bg-rose-50 dark:bg-rose-900/20 rounded-3xl active:scale-95 transition-all">
                         <div className="flex items-center gap-4">
                          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><AlertTriangle size={24}/></div>
                          <div className="text-left">
                            <p className="font-black text-rose-700 dark:text-rose-300 uppercase text-xs">Factory Reset</p>
                            <p className="text-[9px] text-rose-400 uppercase font-black">Wipe registry</p>
                          </div>
                        </div>
                      </button>
                   </div>
                </div>
              )}
           </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-[800] pb-6 px-6 no-print">
        <div className="max-w-2xl mx-auto bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-3xl px-6 py-4 rounded-[32px] flex justify-between items-center shadow-2xl border border-white/10 ring-1 ring-white/5 animate-card-pop">
          {[
            { id: 'dashboard', icon: PieChart, label: 'HUB' },
            { id: 'history', icon: History, label: 'LOGS' },
            { id: 'add', icon: Plus, label: 'ENTRY', fab: true },
            { id: 'credit', icon: User, label: 'LEDGER' },
            { id: 'profile', icon: Contact, label: 'SYSTEM' }
          ].map(tab => (
            tab.fab ? (
              <button 
                key={tab.id} onClick={() => setActiveTab('add')}
                className={`w-14 h-14 -mt-10 rounded-2xl flex items-center justify-center transition-all shadow-2xl ${activeTab === 'add' ? 'bg-white text-indigo-600 scale-110 rotate-45 shadow-indigo-500/50' : 'bg-indigo-600 text-white active:scale-75 shadow-indigo-600/50'}`}
              >
                <Plus size={28} />
              </button>
            ) : (
              <button 
                key={tab.id} onClick={() => { setActiveTab(tab.id); setProfileView('menu'); }}
                className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === tab.id ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <tab.icon size={20} />
                <span className="text-[7px] font-black uppercase tracking-[0.15em]">{tab.label}</span>
              </button>
            )
          ))}
        </div>
      </nav>

      {/* Overlays */}
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
                  <button 
                    key={ev.id} onClick={() => setSelectedEventDetail(ev.id)}
                    className="p-6 bg-white/5 border border-white/10 rounded-[32px] flex justify-between items-center group active:scale-[0.98] transition-all"
                  >
                    <div className="text-left">
                       <p className="font-black text-white uppercase text-sm tracking-widest">{ev.name}</p>
                       <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Logic Records</p>
                    </div>
                    <div className="text-right">
                       <p className="font-mono font-black text-purple-400 text-lg">{formatINR(eventStats[ev.id])}</p>
                       <ChevronRight className="inline-block text-slate-500 group-hover:translate-x-1 transition-transform" size={16}/>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                 <button onClick={() => setSelectedEventDetail(null)} className="flex items-center gap-2 text-indigo-400 font-black uppercase text-[10px] tracking-widest mb-4">
                   <ChevronLeft size={14}/> Back to Events
                 </button>
                 <div className="bg-purple-600 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                    <Layers className="absolute -right-4 -bottom-4 text-white/10" size={120} />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Budget Volume</p>
                    <h3 className="text-3xl font-black font-mono tracking-tighter mt-1">{formatINR(eventStats[selectedEventDetail])}</h3>
                    <p className="text-[9px] font-black uppercase tracking-widest mt-4 bg-white/20 inline-block px-3 py-1 rounded-full">{settings.events.find(e => e.id === selectedEventDetail)?.name}</p>
                 </div>
                 
                 <div className="space-y-3">
                   {eventTransactions.map(t => (
                     <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white/5 border border-white/10 p-5 rounded-[32px] flex justify-between items-center cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                             <ReceiptText size={18}/>
                          </div>
                          <div>
                             <p className="font-black text-white text-xs uppercase">{t.note || t.category}</p>
                             <p className="text-[8px] text-slate-400 font-black uppercase">{t.date} • {t.paidBy}</p>
                          </div>
                        </div>
                        <p className="font-mono font-black text-sm text-purple-400">{formatINR(t.amount).replace('₹ ', '')}</p>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewingTransaction && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[2000] flex items-end justify-center animate-fade-in no-print" onClick={() => setViewingTransaction(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-tab-entry border-t border-indigo-50 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Record Detail</h2>
              <button onClick={() => setViewingTransaction(null)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl active:scale-90 transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              <div className="text-center space-y-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{viewingTransaction.type}</p>
                 <p className={`text-5xl font-black font-mono tracking-tighter ${
                    ['income', 'repayment'].includes(viewingTransaction.type) ? 'text-emerald-600' : 'text-rose-600'
                 }`}>
                   {formatINR(viewingTransaction.amount)}
                 </p>
                 <div className="flex items-center justify-center gap-2 pt-2">
                   <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-slate-500">{viewingTransaction.category}</span>
                   <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-slate-500">{viewingTransaction.date}</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset Source</p>
                   <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">{viewingTransaction.account}</p>
                </div>
                {viewingTransaction.person && (
                  <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Ledger Identity</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">{viewingTransaction.person}</p>
                  </div>
                )}
              </div>

              {viewingTransaction.note && (
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Metadata</p>
                   <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed italic">"{viewingTransaction.note}"</p>
                </div>
              )}

              {viewingTransaction.billImage && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Receipt Evidence</p>
                  <div className="relative group">
                    <img src={viewingTransaction.billImage} className="w-full rounded-[40px] shadow-2xl border-4 border-white dark:border-slate-800" />
                  </div>
                </div>
              )}

              <button 
                onClick={() => { requestPin('delete', viewingTransaction.id); setViewingTransaction(null); }}
                className="w-full py-5 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all mt-4"
              >
                Purge Record
              </button>
            </div>
          </div>
        </div>
      )}

      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[1000] flex items-end justify-center animate-fade-in no-print" onClick={() => setShowFilterModal(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[40px] shadow-2xl p-8 space-y-8 border-t border-indigo-50 dark:border-slate-800 animate-tab-entry" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Logic Filters</h2>
              <button onClick={() => setShowFilterModal(false)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Entry Modality</p>
                <div className="flex flex-wrap gap-2">
                  {['All', 'expense', 'income', 'external', 'reminder', 'credit', 'repayment', 'transfer'].map(t => (
                    <button 
                      key={t} onClick={() => setTypeFilter(t)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${typeFilter === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Asset Link</p>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setAccountFilter('All')}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${accountFilter === 'All' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                  >All</button>
                  {settings.accounts.map(acc => (
                    <button 
                      key={acc} onClick={() => setAccountFilter(acc)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${accountFilter === acc ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => setShowFilterModal(false)} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95">Set Parameters</button>
          </div>
        </div>
      )}

      {/* Pin Entry Omitted for brevity but fixed with full logic in code */}
      {pinEntryMode && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[2000] flex items-center justify-center p-6 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center space-y-8 animate-card-pop border border-indigo-50 dark:border-slate-800">
            <Lock size={36} className={`mx-auto ${pinError ? 'text-rose-600 animate-shake' : 'text-indigo-600 animate-bounce'}`} />
            <form onSubmit={handleVerifyPin} className="space-y-6">
              <h2 className="text-xl font-black uppercase text-slate-800 dark:text-slate-100 tracking-widest">Verify PIN</h2>
              <input 
                autoFocus type="password" inputMode="numeric" maxLength={4}
                className="w-full text-center text-5xl font-black bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 dark:text-slate-100 tracking-[0.4em] border-none focus:ring-0"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <div className="flex flex-col gap-3">
                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Authorize Access</button>
                <button type="button" onClick={() => setPinEntryMode(false)} className="text-[10px] font-black uppercase text-slate-400">Abort</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAutoPayManager && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[900] flex items-center justify-center p-6 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[40px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] border border-indigo-50 dark:border-slate-800 animate-card-pop">
            <div className="p-8 border-b dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Auto-Logic Engine</h2>
              <button onClick={() => setShowAutoPayManager(false)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl active:scale-90 transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
              <div className="bg-indigo-50/50 dark:bg-slate-950/50 p-6 rounded-[32px] border border-indigo-100 dark:border-slate-800 space-y-6 shadow-inner">
                <div className="flex p-1 bg-white dark:bg-slate-800 rounded-xl mb-4 shadow-sm border dark:border-slate-700">
                  {['expense', 'income'].map(t => (
                    <button 
                      key={t} onClick={() => setAutoPayDraft(p => ({...p, type: t as 'expense'|'income'}))}
                      className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all active:scale-[0.98] ${autoPayDraft.type === t ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Purpose</label>
                    <input 
                      type="text" placeholder="Rent, SIP..."
                      className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-4 font-bold shadow-sm dark:text-slate-200 shadow-inner"
                      value={autoPayDraft.purpose} onChange={e => setAutoPayDraft(p => ({ ...p, purpose: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Amount</label>
                    <input 
                      type="number" placeholder="Amt"
                      className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-4 font-bold shadow-sm dark:text-slate-200 shadow-inner"
                      value={autoPayDraft.amount || ""} onChange={e => setAutoPayDraft(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (!autoPayDraft.purpose || !autoPayDraft.amount) return;
                    const newRule: AutoPayRule = { 
                      id: crypto.randomUUID(), 
                      amount: Math.abs(autoPayDraft.amount), 
                      day: autoPayDraft.day || '1', 
                      purpose: autoPayDraft.purpose, 
                      account: autoPayDraft.account || settings.accounts[0], 
                      type: autoPayDraft.type || 'expense' 
                    };
                    setSettings(s => ({ ...s, autoPays: [...s.autoPays, newRule] }));
                    setAutoPayDraft({ type: 'expense', amount: 0, day: '1', purpose: '', account: settings.accounts[0] });
                  }}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >Engage Protocol</button>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Active Rules</h4>
                {settings.autoPays.map(ap => (
                  <div key={ap.id} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="font-black text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest">{ap.purpose}</p>
                      <p className="text-[9px] text-slate-400 uppercase font-black mt-1">{ap.account} • Day {ap.day}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-black text-indigo-600 text-sm">{formatINR(ap.amount)}</p>
                      <button onClick={() => setSettings(s => ({...s, autoPays: s.autoPays.filter(a => a.id !== ap.id)}))} className="text-rose-500 uppercase text-[9px] font-black tracking-widest mt-1">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showNotificationModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[950] flex items-end justify-center animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[40px] shadow-2xl h-[75vh] flex flex-col overflow-hidden animate-tab-entry border-t border-indigo-50 dark:border-slate-800">
            <div className="p-8 border-b dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">System Alerts</h2>
              <button onClick={() => setShowNotificationModal(false)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl active:scale-90 transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {dueReminders.length > 0 ? (
                  <div className="space-y-4">
                    {dueReminders.map(t => (
                      <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[32px] border dark:border-slate-700 flex justify-between items-center group active:scale-[0.98] transition-all cursor-pointer">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-2xl"><BellRing size={24}/></div>
                           <div>
                              <p className="font-black text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest">{t.note || t.category}</p>
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{t.date}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-mono font-black text-amber-600 text-sm">{formatINR(t.amount)}</p>
                           <p className="text-[8px] font-black text-indigo-400 uppercase mt-1">Details</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 text-center space-y-6 bg-slate-50 dark:bg-slate-800/50 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-inner animate-fade-in">
                    <AlertCircle size={48} className="mx-auto text-indigo-200 dark:text-indigo-900 animate-pulse" />
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] max-w-[240px] mx-auto leading-loose">No active hooks detected.</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {showAddPersonModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-8 space-y-6 border border-indigo-50 dark:border-slate-800 animate-card-pop">
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight text-center">New Identity</h2>
            <div className="space-y-4">
              <input 
                autoFocus type="text" placeholder="Full Name..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold dark:text-slate-200 shadow-inner"
                value={newItemName} onChange={e => setNewItemName(e.target.value)}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowAddPersonModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Cancel</button>
                <button onClick={() => { if(newItemName) { setSettings(s => ({...s, peopleList: [...new Set([...s.peopleList, newItemName])]})); setNewItemName(""); setShowAddPersonModal(false); } }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95">Register</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[1100] flex items-center justify-center p-8 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-sm rounded-[40px] p-10 text-center space-y-6 shadow-2xl border-4 border-rose-50 dark:border-rose-900/30 animate-card-pop">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">Wipe All Logic?</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-widest leading-relaxed">This will permanently reset the entire system registry logs.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }} className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Yes, Wipe Data</button>
              <button onClick={() => setShowResetConfirm(false)} className="w-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">Abort Reset</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
