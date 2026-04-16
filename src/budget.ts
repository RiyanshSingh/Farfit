import { supabase } from './supabase';
import { healthianPrompt, healthianConfirm } from './prompt';

/* ── Budget State ── */
const BUDGET_KEY = 'healthian_budget';

interface Expense {
    id: number;
    category: string;
    name: string;
    amount: number;
    date: string;
    time: string;
}

interface BudgetSubsystem {
    limit: number;
    color: string;
    icon: string;
}

interface BillReminder {
    id: number;
    name: string;
    amount: number;
    dueDate: string;
    dueTime: string;
    notifiedOn?: string | null;
    lastReminderAt?: string | null;
}

interface BudgetState {
    monthlyBudget: number;
    categories: Record<string, BudgetSubsystem>;
    expenses: Expense[];
    bills: BillReminder[];
    savingsGoal: number;
    savingsProgress: number;
    goalTitle: string;
    notifications: any[];
}

const CATEGORIES: Record<string, BudgetSubsystem> = {
    'Gym & Fitness':   { limit: 2500, color: '#f07f4c', icon: '<path d="M6 7.5v10m6-10v10m6-10v10M3 7.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2m-18 10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2" />' },
    'Supplements':     { limit: 1500, color: '#c5d57b', icon: '<path d="M10.5 20.5 4 14l10-10 6.5 6.5-10 10Z"/><path d="m14 6-6 6"/>' },
    'Nutrition':       { limit: 5000, color: '#8dd8e6', icon: '<path d="M12 21.001a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0-18v18M3 12h18"/>' },
    'Medical':         { limit: 3000, color: '#6ec6d8', icon: '<path d="M19 14c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3H5C3.343 2 2 3.343 2 5v6c0 1.657 1.343 3 3 3h14Z"/><path d="M12 2v20M7 7h10"/>' },
    'Wellness':        { limit: 1500, color: '#a0d8e6', icon: '<circle cx="12" cy="12" r="10"/><path d="M8 14.5c.5-1 2-1.5 4-1.5s3.5.5 4 1.5"/>' },
    'Equipment':       { limit: 4000, color: '#12121a', icon: '<path d="M20.5 13.5l-7 7a2 2 0 0 1-2.8 0L2 12V2h10l8.5 8.5a2 2 0 0 1 0 2.8z"/>' },
};

let state: BudgetState = {
    monthlyBudget: 15000,
    categories: { ...CATEGORIES },
    expenses: [],
    bills: [],
    savingsGoal: 25000,
    savingsProgress: 12500,
    goalTitle: 'Peloton Bike+',
    notifications: []
};

function createDefaultBills(): BillReminder[] {
    const today = new Date();
    const inTwoDays = new Date(today);
    inTwoDays.setDate(today.getDate() + 2);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return [
        {
            id: 101,
            name: 'Health Insurance',
            amount: 2500,
            dueDate: getLocalDateKey(inTwoDays),
            dueTime: '09:00',
            notifiedOn: null,
            lastReminderAt: null
        },
        {
            id: 102,
            name: 'Personal Trainer',
            amount: 4000,
            dueDate: getLocalDateKey(nextWeek),
            dueTime: '18:00',
            notifiedOn: null,
            lastReminderAt: null
        }
    ];
}

/* ── Persistence ── */
function loadLocal(): BudgetState | null {
    const raw = localStorage.getItem(BUDGET_KEY);
    return raw ? JSON.parse(raw) : null;
}

function saveLocal() {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(state));
}

async function syncToCloud() {
    saveLocal();
    const userId = localStorage.getItem('healthian_id');
    try {
        await (supabase.from('budget_data').upsert({
            id: userId || 'user_budget',
            data: state,
            updated_at: new Date().toISOString()
        }) as any);
    } catch (e) { /* offline fallback */ }
}

async function loadFromCloud() {
    const local = loadLocal();
    const userId = localStorage.getItem('healthian_id');
    try {
        const { data } = await (supabase.from('budget_data').select('data').eq('id', userId || 'user_budget').single() as any);
        if (data?.data) {
            state = { ...state, ...data.data };
        } else if (local) {
            state = { ...state, ...local };
        }
    } catch {
        if (local) state = { ...state, ...local };
    }

    if (!state.bills || state.bills.length === 0) {
        state.bills = createDefaultBills();
    }
}

/* ── Calculations & Helpers ── */
function getIconCircle(catName: string, size: number = 24) {
    const baseCat = CATEGORIES[catName] || { color: '#888', icon: '<path d="M12 2v20M7 7h10"/>' };
    return `<div class="cat-icon" style="background:${baseCat.color}; color:#fff;">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${baseCat.icon}
        </svg>
    </div>`;
}

function getMonthExpenses(): Expense[] {
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    return state.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === m && d.getFullYear() === y;
    });
}

function getTotalSpent(): number {
    return getMonthExpenses().reduce((s, e) => s + e.amount, 0);
}

function getCategorySpent(cat: string): number {
    return getMonthExpenses().filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
}

function getLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Centralized notification handler - uses the global notify from main.ts if available,
 * otherwise falls back to local storage for background persistence.
 */
function storeGlobalNotification(title: string, msg: string, type: string = 'alert') {
    if ((window as any).notify) {
        (window as any).notify(title, msg, type);
        return;
    }
    
    const globalRaw = localStorage.getItem('healthian_global_notifs');
    const notifs: any[] = globalRaw ? JSON.parse(globalRaw) : [];
    const now = Date.now();
    
    const notif = {
        id: now,
        title,
        msg,
        type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
    };

    notifs.unshift(notif);
    localStorage.setItem('healthian_global_notifs', JSON.stringify(notifs.slice(0, 50)));
}


function getBillIconMarkup(index: number) {
    const palette = [
        { bg: 'rgba(240, 127, 76, 0.15)', color: '#f07f4c', icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
        { bg: 'rgba(245, 166, 35, 0.15)', color: '#f5a623', icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
        { bg: 'rgba(141, 216, 230, 0.18)', color: '#4aa6b8', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
        { bg: 'rgba(197, 213, 123, 0.18)', color: '#879b36', icon: '<path d="M12 2v20M2 12h20"/>' }
    ];
    const item = palette[index % palette.length];
    return `
        <div class="txn-icon" style="background:${item.bg}; color:${item.color};">
            <svg width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${item.icon}</svg>
        </div>
    `;
}

function getBillDueLabel(bill: BillReminder) {
    const billDate = new Date(`${bill.dueDate}T${bill.dueTime || '09:00'}`);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfBillDay = new Date(billDate.getFullYear(), billDate.getMonth(), billDate.getDate());
    const diffMs = startOfBillDay.getTime() - startOfToday.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    const timeLabel = billDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (diffDays < 0) {
        return { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} • ${timeLabel}`, urgent: true };
    }
    if (diffDays === 0) {
        return { label: `Due today • ${timeLabel}`, urgent: true };
    }
    if (diffDays === 1) {
        return { label: `Due tomorrow • ${timeLabel}`, urgent: false };
    }
    return { label: `Due in ${diffDays} days • ${timeLabel}`, urgent: false };
}

function getBillDueTimestamp(bill: BillReminder) {
    return new Date(`${bill.dueDate}T${bill.dueTime || '09:00'}`).getTime();
}

function getBudgetSnapshot(): BudgetState {
    const local = loadLocal();
    const snapshot = local ? { ...state, ...local } : { ...state };
    if (!snapshot.bills || snapshot.bills.length === 0) {
        snapshot.bills = createDefaultBills();
    }
    return snapshot;
}

function persistBudgetSnapshot(snapshot: BudgetState) {
    state = { ...state, ...snapshot };
    saveLocal();
}

function bindBudgetListener(
    element: Element | null,
    key: string,
    event: string,
    handler: EventListener
) {
    if (!(element instanceof HTMLElement)) return;
    const flag = `healthianBound${key}`;
    if (element.dataset[flag]) return;
    element.dataset[flag] = 'true';
    element.addEventListener(event, handler);
}

export function getBillsDueSoon(hours: number = 48): BillReminder[] {
    const snapshot = getBudgetSnapshot();
    const nowMs = Date.now();
    const thresholdMs = nowMs + hours * 60 * 60 * 1000;

    return [...snapshot.bills]
        .filter((bill) => getBillDueTimestamp(bill) <= thresholdMs)
        .sort((a, b) => getBillDueTimestamp(a) - getBillDueTimestamp(b))
        .slice(0, 4);
}

function renderBills() {
    const list = document.getElementById('bill-list');
    if (!list) return;

    const bills = [...state.bills]
        .sort((a, b) => new Date(`${a.dueDate}T${a.dueTime}`).getTime() - new Date(`${b.dueDate}T${b.dueTime}`).getTime())
        .slice(0, 4);

    if (bills.length === 0) {
        list.innerHTML = '<div style="padding:36px 0; text-align:center; color:#aaa; font-weight:800; font-size:14px;">No upcoming bills yet. Add up to 4.</div>';
        return;
    }

    list.innerHTML = bills.map((bill, index) => {
        const due = getBillDueLabel(bill);
        return `
            <div class="txn-item bill-item" data-id="${bill.id}" style="padding:12px 0;${index === bills.length - 1 ? ' border-bottom:none;' : ''}">
                <div style="display:flex; align-items:center; gap:14px;">
                    ${getBillIconMarkup(index)}
                    <div class="txn-info">
                        <div class="txn-name" style="font-size:15px;">${bill.name}</div>
                        <div class="txn-date" style="${due.urgent ? 'color:#e03070; font-weight:900;' : ''}">${due.label}</div>
                    </div>
                </div>
                <div class="txn-amt" style="font-size:15px; color:var(--text-dark);">₹${bill.amount.toLocaleString()}</div>
            </div>
        `;
    }).join('');
}

export function checkDueBills(now: Date = new Date()) {
    const snapshot = getBudgetSnapshot();
    const nowMs = now.getTime();
    const todayKey = getLocalDateKey(now);
    const reminderWindowMs = 4 * 60 * 60 * 1000;
    let changed = false;
    const triggeredBills: BillReminder[] = [];

    snapshot.bills.forEach((bill) => {
        const dueTimestamp = getBillDueTimestamp(bill);
        const lastReminderMs = bill.lastReminderAt ? new Date(bill.lastReminderAt).getTime() : 0;

        if (bill.dueDate === todayKey && nowMs >= dueTimestamp && (!bill.lastReminderAt || nowMs - lastReminderMs >= reminderWindowMs)) {
            storeGlobalNotification('Bill Due Today', `${bill.name} for ₹${bill.amount.toLocaleString()} is due today at ${bill.dueTime || '09:00'}.`, 'alert');
            bill.notifiedOn = todayKey;
            bill.lastReminderAt = now.toISOString();
            changed = true;
            triggeredBills.push(bill);
        }
    });

    if (changed) {
        persistBudgetSnapshot(snapshot);
    }

    return triggeredBills;
}


/* ── Toast ── */
function showToast(msg: string, isError = false) {
    let t = document.getElementById('budget-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'budget-toast';
        t.className = 'toast';
        document.body.appendChild(t);
    }
    const icon = isError 
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:18px;height:18px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:18px;height:18px;"><polyline points="20 6 9 17 4 12"/></svg>';
    
    t.innerHTML = `<div class="toast-icon-wrapper">${icon}</div><div class="toast-msg">${msg}</div>`;
    
    t.classList.remove('success', 'error', 'info', 'show');
    t.classList.add(isError ? 'error' : 'success');
    
    void t.offsetWidth;
    t.classList.add('show');
    
    if ((window as any).budgetToastTimer) clearTimeout((window as any).budgetToastTimer);
    (window as any).budgetToastTimer = setTimeout(() => { t?.classList.remove('show'); }, 3000);
}

/* ── Render All ── */
function renderAll() {
    renderBalance();
    renderTransactions();
    renderChart();
    renderCategories();
    renderGoal();
    renderBills();
}

/* ── Balance Card ── */
function renderBalance() {
    const total = getTotalSpent();
    const remaining = state.monthlyBudget - total;
    const pct = Math.round((total / state.monthlyBudget) * 100);

    const balVal = document.querySelector('.bal-val');
    if (balVal) balVal.innerHTML = `₹${remaining.toLocaleString()}<span style="font-size:24px; color:#999;">.00</span>`;

    const balTitle = document.querySelector('.bal-title');
    if (balTitle) balTitle.textContent = `Remaining of ₹${state.monthlyBudget.toLocaleString()} Budget`;

    const contribEl = document.querySelector('.bal-bottom div:first-child');
    if (contribEl) {
        contribEl.innerHTML = `
            <div style="font-size:13px; font-weight:800; color:#999; text-transform:uppercase;">Spent This Month</div>
            <div style="font-size:20px; font-weight:900;">₹${total.toLocaleString()} <span style="font-size:12px; color:var(--olive); background:rgba(197, 213, 123, 0.15); padding:2px 8px; border-radius:10px;">${pct}%</span></div>
        `;
    }
}

/* ── Transactions List ── */
function renderTransactions() {
    const list = document.getElementById('txn-list');
    if (!list) return;

    // Show all expenses with internal scroll
    const recent = [...state.expenses].sort((a, b) => b.id - a.id);

    if (recent.length === 0) {
        list.innerHTML = `<div style="height: 200px; display: flex; align-items: center; justify-content: center; text-align:center; color:#aaa; font-weight:800; font-size:14px; padding: 0 20px;">No expenses yet. Tap "Add Expense" to start tracking.</div>`;
        return;
    }

    list.innerHTML = recent.map(e => `
            <div class="txn-item" data-id="${e.id}">
                <div style="display:flex; align-items:center; gap:16px;">
                    ${getIconCircle(e.category, 20)}
                    <div class="txn-info">
                        <div class="txn-name">${e.name}</div>
                        <div class="txn-date">${e.category} · ${e.date}</div>
                    </div>
                </div>
                <div class="txn-amt">-₹${e.amount.toLocaleString()}</div>
            </div>
        `).join('');
}

/* ── Spending Chart ── */
function renderChart() {
    const chartEl = document.getElementById('spending-chart');
    if (!chartEl) return;

    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyLimit = Math.max(Math.round(state.monthlyBudget / daysInMonth), 1);

    const data: { label: string, spent: number, isToday: boolean }[] = [];
    let totalWindowSpent = 0;
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dayStr = `${y}-${m}-${day}`;
        
        let spent = 0;
        state.expenses.forEach(e => {
            if (e.date.startsWith(dayStr)) {
                spent += e.amount;
            }
        });

        totalWindowSpent += spent;

        data.push({
            label: d.toLocaleDateString('en-US', { weekday: 'short' }),
            spent,
            isToday: i === 0
        });
    }

    const html = data.map(d => {
        const pct = Math.min((d.spent / dailyLimit) * 100, 100);
        return `
            <div class="bar-premium-group ${d.isToday ? 'highlight' : ''}">
                <div class="bar-premium-pill">
                    <div class="bar-premium-fill" style="height: ${pct}%;"></div>
                </div>
                <div class="bar-premium-label">${d.label.charAt(0)}</div>
            </div>
        `;
    }).join('');

    chartEl.innerHTML = html;

    // Update Stats
    const statsContainer = document.querySelector('.chart-stats-premium');
    if (statsContainer) {
        const totalVal = statsContainer.querySelector('.stat-block:first-child .value');
        const avgVal = statsContainer.querySelector('.stat-block:last-child .value');
        
        const totalThisMonth = getTotalSpent();
        if (totalVal) totalVal.textContent = `₹${totalThisMonth.toLocaleString()}`;
        if (avgVal) {
            const avg = Math.round(totalThisMonth / today.getDate());
            avgVal.textContent = `₹${avg.toLocaleString()}`;
        }
    }
}

/* ── Category Breakdown ── */
function renderCategories() {
    const container = document.getElementById('cat-list');
    if (!container) return;

    container.innerHTML = Object.entries(state.categories).map(([name, cat]) => {
        const spent = getCategorySpent(name);
        const pct = Math.min(Math.round((spent / cat.limit) * 100), 100);
        const over = spent > cat.limit;
        const baseCat = CATEGORIES[name] || { color: '#888' };
        return `
            <div class="cat-row" data-cat="${name}">
                <div class="cat-left">
                    ${getIconCircle(name, 22)}
                    <div>
                        <div class="cat-name">${name}</div>
                        <div class="cat-sub">₹${spent.toLocaleString()} / ₹${cat.limit.toLocaleString()}</div>
                    </div>
                </div>
                <div class="cat-right">
                    <div class="cat-pct ${over ? 'over' : ''}">${pct}%</div>
                    <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${pct}%; background:${over ? '#f07f4c' : baseCat.color};"></div></div>
                </div>
            </div>
        `;
    }).join('');
}


/* ── Savings Goal ── */
function renderGoal() {
    const pct = Math.round((state.savingsProgress / state.savingsGoal) * 100);
    const goalTitle = document.querySelector('.goal-card .goal-title');
    const goalSub = document.querySelector('.goal-card .goal-sub');
    const goalPct = document.querySelector('.goal-card .goal-pct');
    const fill = document.querySelector<HTMLElement>('.g-progress-fill');

    if (goalTitle) goalTitle.textContent = state.goalTitle;
    if (goalSub) goalSub.textContent = `₹${state.savingsProgress.toLocaleString()} / ₹${state.savingsGoal.toLocaleString()} saved`;
    if (goalPct) goalPct.textContent = pct + '%';
    if (fill) fill.style.width = pct + '%';
}



/* ── Add Expense Modal ── */
function openAddExpense() {
    document.getElementById('expense-modal')?.classList.add('show');
}
function closeAddExpense() {
    document.getElementById('expense-modal')?.classList.remove('show');
}

function addExpense(name: string, amount: number, category: string) {
    const now = new Date();
    state.expenses.push({
        id: Date.now(),
        category,
        name,
        amount,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    renderAll();
    syncToCloud();
    showToast(`₹${amount} added to ${category}`);
}

function openBillModal() {
    if (state.bills.length >= 4) {
        showToast('You can track up to 4 bills at a time.', true);
        return;
    }
    const dateEl = document.getElementById('inp-bill-date') as HTMLInputElement | null;
    const timeEl = document.getElementById('inp-bill-time') as HTMLInputElement | null;
    if (dateEl && !dateEl.value) dateEl.value = getLocalDateKey(new Date());
    if (timeEl && !timeEl.value) timeEl.value = '09:00';
    document.getElementById('bill-modal')?.classList.add('show');
}

function closeBillModal() {
    document.getElementById('bill-modal')?.classList.remove('show');
}

function addBill(name: string, amount: number, dueDate: string, dueTime: string) {
    if (state.bills.length >= 4) {
        showToast('Maximum of 4 upcoming bills reached.', true);
        return;
    }

    state.bills.push({
        id: Date.now(),
        name,
        amount,
        dueDate,
        dueTime,
        notifiedOn: null,
        lastReminderAt: null
    });

    renderAll();
    syncToCloud();
    storeGlobalNotification('Bill Added', `${name} is scheduled for ${dueDate} at ${dueTime}.`, 'info');
    showToast(`Bill added: ${name}`, false);
}

/* ── Init ── */
async function init() {
    await loadFromCloud();
    
    // Theme System
    const themeToggle = document.getElementById('dark-mode-toggle') as HTMLInputElement;
    const currentTheme = localStorage.getItem('healthian_theme') || 'light';
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.checked = true;
    }

    // Setup global event delegation for robust interaction across SPA view swaps
    if (!(window as any)._budgetGlobalInit) {
        document.body.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;

            // Open/Close Add Expense
            if (target.closest('#add-expense-trigger')) {
                e.preventDefault();
                openAddExpense();
            }
            if (target.closest('.close-expense')) {
                e.preventDefault();
                closeAddExpense();
            }

            // Open/Close Add Bill
            if (target.closest('#add-bill-trigger')) {
                e.preventDefault();
                openBillModal();
            }
            if (target.closest('.close-bill')) {
                e.preventDefault();
                closeBillModal();
            }

            // Save Expense
            if (target.closest('#save-expense-btn')) {
                e.preventDefault();
                const nameEl = document.getElementById('inp-exp-name') as HTMLInputElement;
                const amtEl = document.getElementById('inp-exp-amount') as HTMLInputElement;
                const catEl = document.getElementById('inp-exp-cat') as HTMLSelectElement;
                if (!nameEl || !amtEl || !catEl || !nameEl.value || !amtEl.value) return;
                
                addExpense(nameEl.value, parseFloat(amtEl.value), catEl.value);
                nameEl.value = ''; 
                amtEl.value = '';
                closeAddExpense();
            }

            // Save Bill
            if (target.closest('#save-bill-btn')) {
                e.preventDefault();
                const nameEl = document.getElementById('inp-bill-name') as HTMLInputElement;
                const amtEl = document.getElementById('inp-bill-amount') as HTMLInputElement;
                const dateEl = document.getElementById('inp-bill-date') as HTMLInputElement;
                const timeEl = document.getElementById('inp-bill-time') as HTMLInputElement;

                if (!nameEl?.value || !amtEl?.value || !dateEl?.value || !timeEl?.value) {
                    showToast('Please fill in bill name, amount, date, and time.', true);
                    return;
                }

                addBill(nameEl.value, parseFloat(amtEl.value), dateEl.value, timeEl.value);
                nameEl.value = ''; amtEl.value = ''; dateEl.value = ''; timeEl.value = '';
                closeBillModal();
                if ((window as any).updateNotifUI) (window as any).updateNotifUI();
                return;
            }

            // Edit Budget on balance card click
            if (target.closest('.bal-btn') && !target.hasAttribute('onclick')) {
                e.preventDefault();
                const v = await healthianPrompt('Set Monthly Budget (₹):', state.monthlyBudget.toString());
                if (v) {
                    state.monthlyBudget = parseFloat(v);
                    renderAll();
                    syncToCloud();
                    showToast('Budget updated!', false);
                }
                return;
            }

            // Edit category limits
            const catRow = target.closest('.cat-row');
            if (catRow && target.closest('#cat-list')) {
                const catName = catRow.getAttribute('data-cat');
                if (catName && state.categories[catName]) {
                    const v = await healthianPrompt(`Set limit for ${catName} (₹):`, state.categories[catName].limit.toString());
                    if (v) {
                        state.categories[catName].limit = parseFloat(v);
                        renderAll();
                        syncToCloud();
                        showToast(`${catName} limit updated!`, false);
                    }
                }
                return;
            }

            // Delete expense (long press or click on txn)
            const txnItem = target.closest('.txn-item');
            if (txnItem && target.closest('#txn-list')) {
                const id = parseInt(txnItem.getAttribute('data-id') || '0');
                if (id) {
                    if (await healthianConfirm('Delete Expense?', 'Are you sure you want to remove this expense record?')) {
                        state.expenses = state.expenses.filter(ex => ex.id !== id);
                        renderAll();
                        syncToCloud();
                        showToast('Expense deleted', false);
                    }
                }
                return;
            }

            // Mark bill as paid
            const billItem = target.closest('.bill-item');
            if (billItem && target.closest('#bill-list')) {
                const id = parseInt(billItem.getAttribute('data-id') || '0');
                if (id) {
                    if (await healthianConfirm('Mark Bill As Paid?', 'This will remove the bill reminder from Upcoming Bills.')) {
                        const bill = state.bills.find((entry) => entry.id === id);
                        state.bills = state.bills.filter((entry) => entry.id !== id);
                        renderAll();
                        syncToCloud();
                        showToast(bill ? `${bill.name} marked paid` : 'Bill marked as paid', false);
                    }
                }
                return;
            }

            // Savings goal click
            if (target.closest('.goal-card')) {
                const v = await healthianPrompt('Add to savings (₹):', '100');
                if (v) {
                    state.savingsProgress = Math.min(state.savingsProgress + parseFloat(v), state.savingsGoal);
                    renderAll();
                    syncToCloud();
                    showToast(`₹${v} added to ${state.goalTitle} goal!`, false);
                }
                return;
            }
        });
        (window as any)._budgetGlobalInit = true;
    }

    if ((window as any).updateNotifUI) (window as any).updateNotifUI();
    const dueBills = checkDueBills();
    if (dueBills.length > 0) {
        showToast(`${dueBills[0].name} is due now`, false);
        if ((window as any).updateNotifUI) (window as any).updateNotifUI();
    }
    renderAll();




    // Premium Floating Nav: Show/Hide on Scroll
    if (!(window as any)._budgetScrollBound) {
        let lastScroll = window.pageYOffset;
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            const nav = document.querySelector('.bottom-nav');
            if (!nav) return;

            if (currentScroll > lastScroll && currentScroll > 80) {
                nav.classList.add('hide');
            } else {
                nav.classList.remove('hide');
            }
            lastScroll = currentScroll;
        }, { passive: true });
        (window as any)._budgetScrollBound = true;
    }

   // ...

}

export function initBudget() {
    return init();
}

(window as any).initBudget = initBudget;
(window as any).customAddExpense = addExpense;
