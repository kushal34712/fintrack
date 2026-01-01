
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Wallet, ArrowUpRight, ArrowDownLeft, Bell, History, User, 
  PieChart, Trash2, X, Loader2, ChevronLeft, RotateCcw, Sparkles, 
  BellRing, AlarmClockPlus, UserPlus, Users, Lock, Unlock, ShieldCheck, 
  Smartphone, Eye, EyeOff, AlertCircle, ReceiptText, Activity, 
  CheckCircle2, ChevronRight, Tags, CreditCard, FileDown, AlertTriangle, 
  Moon, Sun, Calendar, CalendarDays, Download, Share2, Camera, 
  ToggleLeft, ToggleRight, Edit2, Check, Search, Save, SlidersHorizontal, Layers, Briefcase,
  Contact
} from 'lucide-react';
import { 
  Transaction, TransactionType, UserSettings, AutoPayRule, AppEvent 
} from './types.ts';
import { 
  INITIAL_SETTINGS 
} from './constants.ts';
import { enhanceTransactionDetails } from './services/gemini.ts';

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
  const [recordSuccess, setRecordSuccess] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [calAnimating, setCalAnimating] = useState(false);

  // Form States
  const [formData, setFormData] = useState<Partial<Transaction>>({
    type: 'expense', amount: 0, account: '', toAccount: '', person: '', category: 'General',
    date: new Date().toISOString().split('T')[0], note: '',
    paidBy: 'Self', paymentMethod: 'Cash', billImage: '', eventId: ''
  });
  const [expenseAsCredit, setExpenseAsCredit] = useState(false);
  
  const [newItemName, setNewItemName] = useState("");
  
  // Filtering States
  const [typeFilter, setTypeFilter] = useState('All');
  const [accountFilter, setAccountFilter] = useState('All');
  
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPersonDetail, setSelectedPersonDetail] = useState<string | null>(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState<string | null>(null);

  // Security Logic
  const [showTotalBalance, setShowTotalBalance] = useState(false);
  const [revealedAccounts, setRevealedAccounts] = useState<Record<string, boolean>>({});
  const [pinEntryMode, setPinEntryMode] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinSuccessAction, setPinSuccessAction] = useState<{ type: string; payload?: any } | null>(null);

  // Overlays
  const [showAutoPayManager, setShowAutoPayManager] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showEventCenter, setShowEventCenter] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const STORAGE_KEY = 'fintrack_pro_v20_stable';

  // --- Initialization ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setSettings({ ...INITIAL_SETTINGS, ...parsed.settings });
      } catch (e) { console.error("Restore failed", e); }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, settings }));
    }
  }, [transactions, settings, loading]);

  const todayStr = new Date().toISOString().split('T')[0];

  // --- Computed Balances ---
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    settings.accounts.forEach(acc => balances[acc] = 0);
    transactions.forEach(t => {
      if (t.type === 'reminder' || t.type === 'external') return;
      const amt = Math.abs(t.amount);
      if (t.type === 'income' || t.type === 'repayment') balances[t.account] += amt;
      else if (t.type === 'expense' || t.type === 'credit') balances[t.account] -= amt;
      else if (t.type === 'transfer') {
        balances[t.account] -= amt;
        if (t.toAccount) balances[t.toAccount] += amt;
      }
    });
    return balances;
  }, [transactions, settings.accounts]);

  const personCredits = useMemo(() => {
    const credits: Record<string, number> = {};
    settings.peopleList.forEach(p => credits[p] = 0);
    transactions.forEach(t => {
      if (!t.person || t.type === 'external' || t.type === 'reminder') return;
      const amt = Math.abs(t.amount);
      if (t.type === 'credit') credits[t.person] += amt;
      else if (t.type === 'repayment') credits[t.person] -= amt;
    });
    return credits;
  }, [transactions, settings.peopleList]);

  const eventStats = useMemo(() => {
    const stats: Record<string, number> = {};
    settings.events.forEach(ev => stats[ev.id] = 0);
    transactions.forEach(t => {
      if (t.eventId && t.type === 'external') {
        stats[t.eventId] += Math.abs(t.amount);
      }
    });
    return stats;
  }, [transactions, settings.events]);

  // Fix: Explicitly typed reduce parameters to avoid "unknown" operator error.
  const totalBalance = useMemo(() => Object.values(accountBalances).reduce((a: number, b: number) => a + b, 0), [accountBalances]);
  // Fix: Explicitly typed reduce parameters to avoid "unknown" operator error.
  const totalNetCredit = useMemo(() => Object.values(personCredits).reduce((a: number, b: number) => a + b, 0), [personCredits]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchType = typeFilter === 'All' || t.type === typeFilter;
      const matchAccount = accountFilter === 'All' || t.account === accountFilter || t.toAccount === accountFilter;
      return matchType && matchAccount;
    }).sort((a,b) => b.timestamp - a.timestamp);
  }, [transactions, typeFilter, accountFilter]);

  // --- Handlers ---
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = Math.abs(formData.amount || 0);
    if (cleanAmount <= 0 && formData.type !== 'reminder' && formData.type !== 'external') return;
    
    let effectiveType: TransactionType = formData.type as TransactionType;
    if (formData.type === 'expense' && expenseAsCredit) {
      effectiveType = 'credit';
    }

    const newTrans: Transaction = {
      id: crypto.randomUUID(),
      type: effectiveType,
      amount: cleanAmount,
      account: formData.account || settings.accounts[0],
      person: formData.person || '',
      category: formData.category || 'General',
      date: formData.date || todayStr,
      note: formData.note || '',
      timestamp: Date.now(),
      billImage: formData.billImage,
      eventId: formData.eventId,
      paidBy: formData.paidBy || 'Self'
    };

    setTransactions(prev => [newTrans, ...prev]);
    setRecordSuccess(true);
    setTimeout(() => {
      setRecordSuccess(false);
      setActiveTab('dashboard');
      setFormData({ type: 'expense', amount: 0, account: settings.accounts[0], category: 'General', date: todayStr });
      setExpenseAsCredit(false);
    }, 1200);
  };

  const requestPin = (type: string) => {
    if (!settings.balancePin) {
      if (type === 'balance') setShowTotalBalance(true);
      return;
    }
    setPinSuccessAction({ type });
    setPinEntryMode(true);
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === settings.balancePin) {
      if (pinSuccessAction?.type === 'balance') setShowTotalBalance(true);
      setPinEntryMode(false);
      setPinError(false);
      setEnteredPin("");
    } else {
      setPinError(true);
      setEnteredPin("");
    }
  };

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>;

  return (
    <div className="min-h-screen pb-32 max-w-2xl mx-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-80 bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-b-[60px] shadow-2xl z-0"></div>

      <header className="relative z-10 px-6 pt-10 pb-8 text-white animate-fade-in">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-xl border border-white/20 shadow-xl">
              <Wallet size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tight uppercase">FinTrack <span className="text-indigo-300">Pro</span></h1>
          </div>
          <button onClick={() => setShowNotificationModal(true)} className="relative p-3 bg-white/10 rounded-2xl border border-white/10">
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-indigo-700 animate-pulse"></span>
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-3xl rounded-[36px] p-8 border border-white/20 shadow-2xl ring-1 ring-white/10 animate-tab-entry">
          <div className="grid grid-cols-2 gap-6 divide-x divide-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 opacity-60 uppercase tracking-widest text-[10px] font-black">
                <span>Net Assets</span>
                <button onClick={() => showTotalBalance ? setShowTotalBalance(false) : requestPin('balance')}><Eye size={14} /></button>
              </div>
              <p className="text-3xl font-black font-mono">{showTotalBalance ? formatINR(totalBalance) : "₹ ••••••••"}</p>
            </div>
            <div className="pl-8 space-y-1">
              <p className="opacity-60 uppercase tracking-widest text-[10px] font-black">Ledger Outflow</p>
              <p className="text-3xl font-black font-mono">{formatINR(totalNetCredit)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 space-y-8 mt-2">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-tab-entry">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setFormData({...formData, type: 'reminder'}); setActiveTab('add'); }} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center gap-3 active:scale-95 transition-all">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                  <AlarmClockPlus size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reminders</span>
              </button>
              <button onClick={() => setShowAutoPayManager(true)} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center gap-3 active:scale-95 transition-all">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                  <Activity size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auto-Pay</span>
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2">Asset Map</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {settings.accounts.map((acc) => {
                  const isLocked = settings.accountLockSettings[acc];
                  return (
                    <div key={acc} className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group animate-card-pop">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                          {acc} {isLocked && <Lock size={8} className="text-rose-400" />}
                        </p>
                        <p className={`text-xl font-black font-mono tracking-tight ${accountBalances[acc] >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
                          {(!isLocked || revealedAccounts[acc]) ? formatINR(accountBalances[acc]) : "₹ ••••"}
                        </p>
                      </div>
                      <button onClick={() => setRevealedAccounts(p => ({...p, [acc]: !p[acc]}))} className={`p-3 bg-slate-50 dark:bg-slate-800 rounded-xl active:scale-90 ${!isLocked && 'opacity-30 cursor-not-allowed'}`}>
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
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[44px] shadow-2xl border border-indigo-50 dark:border-slate-800 space-y-8">
              <div className="flex flex-wrap p-1.5 bg-slate-50 dark:bg-slate-800 rounded-2xl gap-1 shadow-inner overflow-x-auto no-scrollbar">
                {['expense', 'income', 'reminder', 'transfer', 'credit', 'repayment', 'external'].map(t => (
                  <button 
                    key={t} type="button" 
                    onClick={() => { setFormData(p => ({ ...p, type: t as TransactionType })); setExpenseAsCredit(false); }}
                    className={`flex-1 min-w-[28%] py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${formData.type === t ? 'bg-indigo-600 shadow-xl text-white' : 'text-slate-400 dark:text-slate-500'}`}
                  >
                    {t === 'external' ? 'Event' : t}
                  </button>
                ))}
              </div>

              <div className="space-y-2 text-center">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Transaction Volume</label>
                <input required type="text" inputMode="decimal" placeholder="0.00" className="w-full text-center text-6xl font-black bg-transparent border-none p-2 focus:ring-0 text-indigo-600 dark:text-indigo-400 font-mono tracking-tighter" value={getMaskedINR(formData.amount || "")} onChange={(e) => setFormData(p => ({ ...p, amount: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 }))} />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="relative bg-slate-50 dark:bg-slate-800 p-6 rounded-[28px] border-2 border-indigo-50 dark:border-slate-800 shadow-inner group flex items-center justify-between transition-all overflow-hidden">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Calendar size={12} className="text-indigo-400" /> Interaction Date</label>
                    <p className="text-xl font-black text-slate-800 dark:text-slate-200">{new Date(formData.date || "").toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <input type="date" className="absolute inset-0 opacity-0 cursor-pointer z-20" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
                </div>

                {formData.type === 'expense' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800 rounded-[28px] border border-slate-100 dark:border-slate-700">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-500">Expense as Credit</p>
                        <p className="text-[8px] font-black text-slate-400 opacity-60">Redirect cost to personal ledger</p>
                      </div>
                      <button type="button" onClick={() => setExpenseAsCredit(!expenseAsCredit)}>
                        {expenseAsCredit ? <ToggleRight className="text-indigo-600" size={36} /> : <ToggleLeft className="text-slate-300" size={36} />}
                      </button>
                    </div>
                    {expenseAsCredit && (
                      <div className="space-y-2 animate-card-pop">
                        <label className="text-[10px] font-black uppercase text-slate-400 pl-3">Target Ledger</label>
                        <select required={expenseAsCredit} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold dark:text-slate-200 shadow-inner" value={formData.person} onChange={e => setFormData(p => ({ ...p, person: e.target.value }))}>
                          <option value="">Choose identity...</option>
                          {settings.peopleList.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 pl-3">Expense Category</label>
                      <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold dark:text-slate-200 shadow-inner" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                        {settings.expenseCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {formData.type === 'income' && (
                  <div className="space-y-2 animate-fade-in">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-3">Logic Source (Income)</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold dark:text-slate-200 shadow-inner" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                      {settings.incomeCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                )}

                {formData.type === 'reminder' && (
                  <div className="space-y-2 animate-fade-in">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-3">Alert Protocol</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold dark:text-slate-200 shadow-inner" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                      {settings.reminderCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                )}

                {formData.type === 'external' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 pl-3">Select Event Registry</label>
                      <select required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold dark:text-slate-200 shadow-inner" value={formData.eventId} onChange={e => setFormData(p => ({ ...p, eventId: e.target.value }))}>
                        <option value="">Choose event...</option>
                        {settings.events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {formData.type !== 'external' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-3">Asset Link</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 font-bold dark:text-slate-200 shadow-inner" value={formData.account} onChange={e => setFormData(p => ({ ...p, account: e.target.value }))}>
                      {settings.accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 pl-3">Metadata Note</label>
                  <div className="relative">
                    <textarea placeholder="Write log details..." rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 dark:text-slate-200 shadow-inner font-medium" value={formData.note} onChange={e => setFormData(p => ({ ...p, note: e.target.value }))} />
                    <button 
                      type="button" 
                      onClick={() => { setIsEnhancing(true); enhanceTransactionDetails(formData.note || '', settings.expenseCats).then(r => { if(r) setFormData(p => ({...p, note: r.cleanNote, category: r.suggestedCategory})); setIsEnhancing(false); }); }}
                      className="absolute right-3 bottom-3 p-3 bg-indigo-600 text-white rounded-xl shadow-xl"
                    >
                      {isEnhancing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button type="submit" className={`w-full py-5 rounded-[24px] text-sm font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${recordSuccess ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
                  {recordSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
                  {recordSuccess ? 'Logic Confirmed' : 'Authorize Record'}
                </button>
                {formData.type === 'external' && (
                  <button type="button" onClick={() => setShowEventCenter(true)} className="w-full py-4 bg-white dark:bg-slate-900 text-indigo-600 rounded-[24px] font-black uppercase text-[10px] border border-indigo-100 dark:border-slate-800 shadow-sm flex items-center justify-center gap-2 active:scale-95">
                    <History size={16}/> Access Event History
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-tab-entry pb-20">
            <div className="flex justify-between items-center sticky top-0 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl py-4 z-20 px-2">
              <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em]">Global Log</h2>
              <button onClick={() => setShowFilterModal(true)} className={`p-3 rounded-xl transition-all ${typeFilter !== 'All' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'}`}>
                <SlidersHorizontal size={18} />
              </button>
            </div>
            <div className="space-y-4 px-2">
              {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm flex justify-between items-center group border border-transparent dark:border-slate-800/50 cursor-pointer hover:border-indigo-200">
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 flex items-center justify-center rounded-[22px] ${
                      t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 
                      t.type === 'external' ? 'bg-purple-50 text-purple-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {['income', 'repayment'].includes(t.type) ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 dark:text-slate-100 text-sm">{t.note || t.category}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.account}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-black font-mono ${['income', 'repayment'].includes(t.type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {['income', 'repayment'].includes(t.type) ? '+' : '-'}{formatINR(t.amount).replace('₹ ', '')}
                    </p>
                    <p className="text-[8px] font-black text-slate-300 uppercase">{t.date}</p>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center opacity-40 font-black uppercase text-xs">Registry Empty</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'credit' && (
          <div className="space-y-6 animate-tab-entry pb-20 px-2">
             {!selectedPersonDetail ? (
               <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-10 rounded-[44px] shadow-sm border border-indigo-50 dark:border-slate-800 text-center space-y-3 relative">
                    <Users size={32} className="mx-auto text-indigo-600 mb-2" />
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">Ledger Matrix</h2>
                    <p className="text-3xl font-black font-mono text-indigo-600">{formatINR(totalNetCredit)}</p>
                    <button onClick={() => setShowAddPersonModal(true)} className="absolute top-4 right-4 p-4 bg-indigo-600 text-white rounded-2xl shadow-xl"><UserPlus size={20}/></button>
                  </div>
                  <div className="space-y-4">
                    {settings.peopleList.map(person => (
                      <div key={person} onClick={() => setSelectedPersonDetail(person)} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm flex justify-between items-center cursor-pointer active:scale-95 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center font-black">{person.charAt(0)}</div>
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
                  <div className="bg-white dark:bg-slate-900 p-10 rounded-[44px] shadow-sm flex flex-col items-center gap-5 border border-indigo-50 dark:border-slate-800">
                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-[24px] flex items-center justify-center text-2xl font-black">{selectedPersonDetail.charAt(0)}</div>
                    <p className="text-4xl font-black font-mono text-indigo-600">{formatINR(personCredits[selectedPersonDetail])}</p>
                    <div className="flex gap-4 w-full">
                      <button onClick={() => { setFormData({...formData, person: selectedPersonDetail, type: 'repayment'}); setActiveTab('add'); }} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Settle</button>
                      <button onClick={() => { setFormData({...formData, person: selectedPersonDetail, type: 'credit'}); setActiveTab('add'); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Credit</button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {transactions.filter(t => t.person === selectedPersonDetail).map(t => (
                      <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white dark:bg-slate-900 p-5 rounded-[32px] shadow-sm flex justify-between items-center cursor-pointer border border-transparent dark:border-slate-800/50">
                        <div>
                          <p className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase">{t.note || t.category}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase">{t.date}</p>
                        </div>
                        <p className={`font-mono font-black ${t.type === 'repayment' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'repayment' ? '+' : '-'}{formatINR(t.amount).replace('₹ ', '')}</p>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-[800] pb-8 px-6">
        <div className="max-w-2xl mx-auto bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-3xl px-8 py-5 rounded-[40px] flex justify-between items-center shadow-2xl border border-white/10">
          {[
            { id: 'dashboard', icon: PieChart, label: 'HUB' },
            { id: 'history', icon: History, label: 'LOGS' },
            { id: 'add', icon: Plus, label: 'ENTRY', fab: true },
            { id: 'credit', icon: User, label: 'LEDGER' },
            { id: 'profile', icon: Contact, label: 'SYSTEM' }
          ].map(tab => (
            tab.fab ? (
              <button key={tab.id} onClick={() => setActiveTab('add')} className={`w-16 h-16 -mt-12 rounded-[22px] flex items-center justify-center shadow-2xl transition-all ${activeTab === 'add' ? 'bg-white text-indigo-600 rotate-45 scale-110' : 'bg-indigo-600 text-white'}`}>
                <Plus size={32} />
              </button>
            ) : (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === tab.id ? 'text-indigo-400 scale-110' : 'text-slate-500'}`}>
                <tab.icon size={22} />
                <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            )
          ))}
        </div>
      </nav>

      {/* Overlays */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[1000] flex items-end justify-center animate-fade-in" onClick={() => setShowFilterModal(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[50px] shadow-2xl p-10 space-y-8 animate-card-pop" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase text-slate-800 dark:text-slate-100">Filters</h2>
              <button onClick={() => setShowFilterModal(false)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl"><X size={24}/></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transaction Modality</p>
                <div className="flex flex-wrap gap-2">
                  {['All', 'expense', 'income', 'external', 'reminder', 'credit', 'repayment', 'transfer'].map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${typeFilter === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
               <button onClick={() => { setTypeFilter('All'); setAccountFilter('All'); setShowFilterModal(false); }} className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-[24px] font-black uppercase text-xs tracking-widest">Reset</button>
               <button onClick={() => setShowFilterModal(false)} className="flex-[2] bg-indigo-600 text-white py-5 rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {viewingTransaction && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[2000] flex items-end justify-center animate-fade-in" onClick={() => setViewingTransaction(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[50px] p-10 space-y-8 animate-tab-entry" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-3">
               <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto text-indigo-600 mb-2">
                  <ReceiptText size={32}/>
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewingTransaction.type}</p>
               <p className={`text-5xl font-black font-mono tracking-tighter ${['income', 'repayment'].includes(viewingTransaction.type) ? 'text-emerald-600' : 'text-rose-600'}`}>{formatINR(viewingTransaction.amount)}</p>
               <div className="flex items-center justify-center gap-3">
                 <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-slate-500">{viewingTransaction.date}</span>
                 <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-slate-500">{viewingTransaction.account}</span>
               </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 text-center">
              <p className="text-sm font-medium italic text-slate-500 dark:text-slate-400 leading-relaxed">"{viewingTransaction.note || 'No metadata description provided'}"</p>
            </div>
            <button onClick={() => setViewingTransaction(null)} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase tracking-widest">Close Record</button>
          </div>
        </div>
      )}

      {showEventCenter && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[1500] flex flex-col animate-fade-in no-print">
          <div className="p-10 flex items-center justify-between border-b border-white/10">
             <div className="flex items-center gap-4">
                <Briefcase className="text-purple-400" size={28}/>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Event Hub</h2>
             </div>
             <button onClick={() => { setShowEventCenter(false); setSelectedEventDetail(null); }} className="p-4 bg-white/10 rounded-[20px] text-white"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
            {!selectedEventDetail ? (
              <div className="grid grid-cols-1 gap-4">
                {settings.events.map(ev => (
                  <button key={ev.id} onClick={() => setSelectedEventDetail(ev.id)} className="p-8 bg-white/5 border border-white/10 rounded-[40px] flex justify-between items-center group active:scale-[0.98] transition-all">
                    <p className="font-black text-white uppercase text-sm tracking-widest">{ev.name}</p>
                    <p className="font-mono font-black text-purple-400 text-xl">{formatINR(eventStats[ev.id])}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                 <button onClick={() => setSelectedEventDetail(null)} className="flex items-center gap-2 text-indigo-400 font-black uppercase text-[11px] tracking-widest"><ChevronLeft size={16}/> Back to Hub</button>
                 <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-10 rounded-[44px] text-white shadow-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Cumulative Consumption</p>
                    <h3 className="text-4xl font-black font-mono tracking-tighter mt-1">{formatINR(eventStats[selectedEventDetail])}</h3>
                 </div>
                 <div className="space-y-4">
                   {transactions.filter(t => t.eventId === selectedEventDetail).map(t => (
                     <div key={t.id} onClick={() => setViewingTransaction(t)} className="bg-white/5 border border-white/10 p-6 rounded-[32px] flex justify-between items-center cursor-pointer">
                        <p className="font-black text-white text-xs uppercase tracking-widest">{t.note || t.category}</p>
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[50px] p-12 shadow-2xl text-center space-y-10 animate-card-pop border border-indigo-50 dark:border-slate-800">
            <Lock size={44} className={`mx-auto ${pinError ? 'text-rose-600 animate-shake' : 'text-indigo-600'}`} />
            <form onSubmit={handleVerifyPin} className="space-y-8">
              <h2 className="text-2xl font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Auth PIN</h2>
              <input autoFocus type="password" inputMode="numeric" maxLength={4} className="w-full text-center text-6xl font-black bg-slate-50 dark:bg-slate-800 rounded-3xl p-8 tracking-[0.5em] border-none focus:ring-0" value={enteredPin} onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ''))} />
              <div className="flex flex-col gap-4">
                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black uppercase tracking-widest shadow-xl">Grant Access</button>
                <button type="button" onClick={() => setPinEntryMode(false)} className="text-[10px] font-black uppercase text-slate-400">Abort Protocol</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddPersonModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[50px] p-10 space-y-8 animate-card-pop shadow-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tight text-center text-slate-800 dark:text-slate-100">Identity Matrix</h2>
            <div className="space-y-6">
              <input autoFocus type="text" placeholder="Identity Name..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-6 font-bold dark:text-slate-200 shadow-inner" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
              <div className="flex gap-4">
                <button onClick={() => setShowAddPersonModal(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-[24px] font-black uppercase text-[10px]">Cancel</button>
                <button onClick={() => { if(newItemName) { setSettings(s => ({...s, peopleList: [...new Set([...s.peopleList, newItemName])]})); setNewItemName(""); setShowAddPersonModal(false); } }} className="flex-1 py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase text-[10px] shadow-xl">Register</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
