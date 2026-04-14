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

interface BudgetState {
    monthlyBudget: number;
    categories: Record<string, BudgetSubsystem>;
    expenses: Expense[];
    savingsGoal: number;
    savingsProgress: number;
    goalTitle: string;
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
    savingsGoal: 25000,
    savingsProgress: 12500,
    goalTitle: 'Peloton Bike+',
};

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
    try {
        await supabase.from('budget_data').upsert({
            id: 'user_budget',
            data: state,
            updated_at: new Date().toISOString()
        });
    } catch (e) { /* offline fallback */ }
}

async function loadFromCloud() {
    const local = loadLocal();
    try {
        const { data } = await supabase.from('budget_data').select('data').eq('id', 'user_budget').single();
        if (data?.data) {
            state = { ...state, ...data.data };
        } else if (local) {
            state = { ...state, ...local };
        }
    } catch {
        if (local) state = { ...state, ...local };
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

    const recent = [...state.expenses].sort((a, b) => b.id - a.id).slice(0, 5);

    if (recent.length === 0) {
        list.innerHTML = `<div style="padding:40px 0; text-align:center; color:#aaa; font-weight:800; font-size:14px;">No expenses yet. Tap "Add Expense" to start tracking.</div>`;
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

    const data: { label: string, spent: number }[] = [];
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

        data.push({
            label: d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
            spent
        });
    }

    const html = data.map(d => {
        const pct = Math.min((d.spent / dailyLimit) * 100, 100);
        const overLimit = d.spent > dailyLimit;
        
        return `
            <div class="bar-group">
                <div class="bars">
                    <div class="bar saving-bar ${overLimit ? 'over' : ''}" style="height: 120px; --fill-h: ${pct}%;"></div>
                </div>
                <div class="bar-label">${d.label}</div>
            </div>
        `;
    }).join('');

    chartEl.innerHTML = html;

    const totalEl = document.querySelector('.chart-stats div:last-child div:last-child');
    if (totalEl) totalEl.textContent = `₹${getTotalSpent().toLocaleString()}`;
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

    themeToggle?.addEventListener('change', () => {
        const targetTheme = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', targetTheme);
        localStorage.setItem('healthian_theme', targetTheme);
        showToast(`Switched to ${targetTheme} mode`, false);
    });

    // Settings Binding
    document.getElementById('settings-trigger')?.addEventListener('click', () => {
        // We might not have all state here, but we can at least toggle theme
        document.getElementById('settings-modal')?.classList.add('show');
    });
    
    document.querySelector('.close-settings')?.addEventListener('click', () => document.getElementById('settings-modal')?.classList.remove('show'));

    renderAll();

    // Add Expense Button
    document.getElementById('add-expense-trigger')?.addEventListener('click', openAddExpense);
    document.querySelector('.close-expense')?.addEventListener('click', closeAddExpense);

    document.getElementById('save-expense-btn')?.addEventListener('click', () => {
        const nameEl = document.getElementById('inp-exp-name') as HTMLInputElement;
        const amtEl = document.getElementById('inp-exp-amount') as HTMLInputElement;
        const catEl = document.getElementById('inp-exp-cat') as HTMLSelectElement;
        if (!nameEl.value || !amtEl.value) return;
        addExpense(nameEl.value, parseFloat(amtEl.value), catEl.value);
        nameEl.value = ''; amtEl.value = '';
        closeAddExpense();
    });

    // Edit Budget on balance card click
    document.querySelector('.bal-btn')?.addEventListener('click', async () => {
        const v = await healthianPrompt('Set Monthly Budget (₹):', state.monthlyBudget.toString());
        if (v) {
            state.monthlyBudget = parseFloat(v);
            renderAll();
            syncToCloud();
            showToast('Budget updated!');
        }
    });

    // Edit category limits
    document.getElementById('cat-list')?.addEventListener('click', async (e) => {
        const row = (e.target as HTMLElement).closest('.cat-row');
        if (!row) return;
        const catName = row.getAttribute('data-cat');
        if (!catName || !state.categories[catName]) return;
        const v = await healthianPrompt(`Set limit for ${catName} (₹):`, state.categories[catName].limit.toString());
        if (v) {
            state.categories[catName].limit = parseFloat(v);
            renderAll();
            syncToCloud();
            showToast(`${catName} limit updated!`);
        }
    });

    // Savings goal click
    document.querySelector('.goal-card')?.addEventListener('click', async () => {
        const v = await healthianPrompt('Add to savings (₹):', '100');
        if (v) {
            state.savingsProgress = Math.min(state.savingsProgress + parseFloat(v), state.savingsGoal);
            renderAll();
            syncToCloud();
            showToast(`₹${v} added to ${state.goalTitle} goal!`);
        }
    });

    // Delete expense (long press or click on txn)
    document.getElementById('txn-list')?.addEventListener('click', async (e) => {
        const item = (e.target as HTMLElement).closest('.txn-item');
        if (!item) return;
        const id = parseInt(item.getAttribute('data-id') || '0');
        if (!id) return;
        if (await healthianConfirm('Delete Expense?', 'Are you sure you want to remove this expense record?')) {
            state.expenses = state.expenses.filter(ex => ex.id !== id);
            renderAll();
            syncToCloud();
            showToast('Expense deleted');
        }
    });

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

    document.body.classList.add('ready');
}

(window as any).initBudget = init;
(window as any).customAddExpense = addExpense;
