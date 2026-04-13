// @ts-nocheck
import '../style.css';
import '../responsive.css';
import './budget';
import { supabase } from './supabase';
import { healthianPrompt, healthianConfirm } from './prompt';
import { initSPA } from './router';

const state = {
    id: localStorage.getItem('healthian_id') || null,
    viewDate: new Date().toISOString().split('T')[0],
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    daily: {} as Record<string, any>, 
    waterGoal: 4.0,
    stepsGoal: 8000,
    waterGoal: 2.0,
    height: "6'0\"",
    weightMin: 72,
    weightMax: 82,
    heartRate: 82,
    wellnessScore: 8.5,
    workoutExIdx: 0,
    workoutTimer: 0,
    workoutRunning: false,
    streak: 12,
    prs: { deadlift: 140, squat: 110, bench: 85, run: "22:30" },
    muscles: { chest: 30, back: 75, legs: 90 }
};

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const exList = ["Treadmill", "Jumping Jacks", "Sprint Interval", "Burpees", "Bodyweight Squats", "Pushup Flow", "Core Plank", "Yoga Stretch", "Recovery", "Cool Down"];

function formatTime(s: number): string {
    const mins = Math.floor(s / 60), secs = (s % 60).toString().padStart(2, '0');
    return mins + ":" + secs;
}

// --- SYNC & CACHE ---
function showToast(msg: string, isError = true) {
    let t = document.getElementById('sys-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'sys-toast';
        t.className = 'toast';
        document.body.appendChild(t);
    }
    const icon = isError 
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><polyline points="20 6 9 17 4 12"/></svg>';
    t.innerHTML = icon + msg;
    t.style.background = isError ? '#ff4757' : '#2ed573';
    t.classList.add('show');
    
    if ((window as any).toastTimer) clearTimeout((window as any).toastTimer);
    (window as any).toastTimer = setTimeout(() => { t?.classList.remove('show'); }, 4000);
}

async function sync() {
    localStorage.setItem('healthian_cache', JSON.stringify({ 
        daily: state.daily, hr: state.heartRate, well: state.wellnessScore, 
        wIdx: state.workoutExIdx, wTime: state.workoutTimer, wRun: state.workoutRunning,
        streak: state.streak, prs: state.prs, muscles: state.muscles,
        sG: state.stepsGoal, wG: state.waterGoal, ht: state.height, wMin: state.weightMin, wMax: state.weightMax
    }));
    try {
        const d = state.daily[state.viewDate] || de();
        await supabase.from('daily_stats').upsert({
            date: state.viewDate, ...d
        });
        const res = await supabase.from('user_stats').upsert({
            id: state.id || undefined, heart_rate: state.heartRate, wellness_score: state.wellnessScore, 
            workout_timer: state.workoutTimer, workout_ex_idx: state.workoutExIdx, workout_running: state.workoutRunning, last_date: new Date().toLocaleDateString(),
            streak: state.streak, pr_deadlift: state.prs.deadlift, pr_squat: state.prs.squat, pr_bench: state.prs.bench, pr_run: state.prs.run,
            muscle_chest: state.muscles.chest, muscle_back: state.muscles.back, muscle_legs: state.muscles.legs,
            height: state.height, weight_min: state.weightMin, weight_max: state.weightMax, water_goal: state.waterGoal, steps_goal: state.stepsGoal
        }).select();
        
        if (res.data && res.data[0]) {
            state.id = res.data[0].id;
            localStorage.setItem('healthian_id', state.id);
        }
    } catch (e) {
        showToast("You are offline. Changes saved locally.", true);
    }
}

const workoutLibrary = [
    { title: "Morning Stretching", desc: "Stretch. Breathe. Wake up.", time: "15 min", img: "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?auto=format&fit=crop&w=150&q=80" },
    { title: "HIIT Cardio", desc: "High intensity fat burning.", time: "25 min", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=150&q=80" },
    { title: "Yoga Flow", desc: "Mindfulness and flexibility.", time: "40 min", img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=150&q=80" },
    { title: "Lower Body", desc: "Legs, glutes and core.", time: "30 min", img: "https://images.unsplash.com/photo-1434682881908-b43d0467b798?auto=format&fit=crop&w=150&q=80" },
    { title: "Upper Body", desc: "Chest, back and arms.", time: "35 min", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=150&q=80" },
    { title: "Core Power", desc: "Abs and stability work.", time: "20 min", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=150&q=80" }
];

const masterRoutine: any = {
    'Monday': workoutLibrary[0],
    'Tuesday': workoutLibrary[1],
    'Wednesday': workoutLibrary[2],
    'Thursday': workoutLibrary[3],
    'Friday': workoutLibrary[4],
    'Saturday': workoutLibrary[5],
    'Sunday': { title: "Recovery Walk", desc: "Easy pace, fresh air.", time: "20 min", img: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=150&q=80" }
};

function de() { return { steps: 0, water: 0, weight: 75.2, glucose: 65, completed: [], bp_sys: 118, bp_dia: 78, spo2: 98, sleep_h: 7, sleep_m: 24, temp: 98.4, carbs: 180, protein: 120, fat: 62, meds: [], symptoms: [], exercises: [], notifications: [] }; }

async function load() {
    const cache = localStorage.getItem('healthian_cache');
    if (cache) {
        const c = JSON.parse(cache);
        state.daily = c.daily || {}; state.heartRate = c.hr || 82; state.wellnessScore = c.well || 8.5;
        state.workoutExIdx = c.wIdx !== undefined ? c.wIdx : 0; state.workoutTimer = c.wTime !== undefined ? c.wTime : 0; state.workoutRunning = c.wRun !== undefined ? c.wRun : false;
        state.streak = c.streak || 12; state.prs = c.prs || state.prs; state.muscles = c.muscles || state.muscles;
        state.stepsGoal = c.sG || 8000; state.waterGoal = c.wG || 2.0; state.height = c.ht || "6'0\""; state.weightMin = c.wMin || 72; state.weightMax = c.wMax || 82;
        renderAll(); document.body.classList.add('ready');
    }
    try {
        let query = supabase.from('user_stats').select('*').limit(1);
        if (state.id) query = query.eq('id', state.id);
        
        const { data: user } = await query.single();
        if (user) { 
            state.id = user.id; localStorage.setItem('healthian_id', state.id);
            state.heartRate = user.heart_rate ?? state.heartRate; 
            state.wellnessScore = user.wellness_score ?? state.wellnessScore; 
            // Ensure DB doesn't overwrite our local selections if they are active
            if (!cache) {
                state.workoutExIdx = user.workout_ex_idx ?? state.workoutExIdx; 
                state.workoutTimer = user.workout_timer ?? state.workoutTimer;
                state.workoutRunning = user.workout_running ?? state.workoutRunning;
                state.stepsGoal = user.steps_goal || state.stepsGoal;
                state.waterGoal = user.water_goal || state.waterGoal;
                state.height = user.height || state.height;
                state.weightMin = user.weight_min || state.weightMin;
                state.weightMax = user.weight_max || state.weightMax;
            }
            state.streak = user.streak ?? state.streak;
            state.prs.deadlift = user.pr_deadlift ?? state.prs.deadlift;
            state.prs.squat = user.pr_squat ?? state.prs.squat;
            state.prs.bench = user.pr_bench ?? state.prs.bench;
            state.prs.run = user.pr_run ?? state.prs.run;
            state.muscles.chest = user.muscle_chest ?? state.muscles.chest;
            state.muscles.back = user.muscle_back ?? state.muscles.back;
            state.muscles.legs = user.muscle_legs ?? state.muscles.legs;
        }
        const { data: all } = await supabase.from('daily_stats').select('*');
        if (all) all.forEach(d => { state.daily[d.date] = { ...d }; });
        renderAll(); document.body.classList.add('ready');
    } catch (e) { renderAll(); document.body.classList.add('ready'); }
}

function ensure(d: string) { if (!state.daily[d]) state.daily[d] = de(); }

function renderAll() {
    ensure(state.viewDate);
    updateWaterUI(); updateStepsUI(); updateWellnessUI(); updateExercisesUI(); updateChartUI(); updateHeartUI(); renderWorkoutUI(); updateOtherStatsUI();
    renderCalendarRow(); renderModalCalendar(); updateHealthPageUI(); updateExercisesPageUI();
    
    // Live Top Bar Date Sync
    const d = new Date(state.viewDate);
    const dateBtnLabel = document.querySelector('.live-date-text');
    if (dateBtnLabel) dateBtnLabel.textContent = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

    // Dynamic Goal Injection
    const htBadge = document.querySelector('.badge-height'); if (htBadge) htBadge.textContent = state.height;
    const wtCards = document.querySelectorAll('.stats-card');
    if (wtCards.length >= 2) {
        const wtDesc = wtCards[1].querySelector('.stat-desc');
        if (wtDesc && wtCards[1].querySelector('.stat-name')?.textContent === 'Weight') {
            wtDesc.textContent = `Healthy weight is ${state.weightMin}-${state.weightMax}kg`;
        }
    }
    const waterCard = document.querySelector('.water-card');
    if (waterCard) {
        const waterDesc = waterCard.querySelector('.stat-desc');
        if (waterDesc) waterDesc.textContent = `Need to drink ${state.waterGoal}l p/d`;
    }
}

function updateWaterUI() {
    const d = state.daily[state.viewDate];
    const label = document.querySelector('.water-card .icon-circle + div');
    if (label) label.textContent = d.water.toFixed(1) + "l";
    document.querySelectorAll('.water-bar-seg').forEach((seg, i) => {
        const f = Math.floor((d.water / state.waterGoal) * 8); i < f ? seg.classList.remove('empty') : seg.classList.add('empty');
    });
}

function updateStepsUI() {
    const d = state.daily[state.viewDate];
    const kcal = Math.floor(d.steps * 0.04), dist = (d.steps * 0.0007).toFixed(2), pts = Math.floor(d.steps / 50);
    const map = {
        '.hero-steps-val': d.steps.toLocaleString() + ' <span style="font-size:18px; color:#bbb; font-weight:700;">/ ' + state.stepsGoal.toLocaleString() + '</span>',
        '.chart-small-steps': d.steps.toLocaleString(), '.chart-small-kcal': kcal.toLocaleString(), '.steps-dist': dist + " km", '.steps-kcal': kcal.toLocaleString(), '.steps-pts': pts.toLocaleString()
    };
    Object.entries(map).forEach(([s, v]) => { const el = document.querySelector(s); if (el) el.innerHTML = v; });
    const ring = document.querySelector('.steps-ring path:last-child');
    if (ring) ring.setAttribute('stroke-dasharray', Math.min((d.steps / state.stepsGoal) * 100, 100) + ", 100");
}

function updateOtherStatsUI() {
    const d = state.daily[state.viewDate];
    const wEl = document.querySelector('.stats-card:nth-child(2) .stat-val'); if (wEl) wEl.innerHTML = d.weight.toFixed(1) + ' <span>kg</span>';
    const gEl = document.querySelector('.stats-card:nth-child(4) .stat-val'); if (gEl) gEl.innerHTML = d.glucose + ' <span>mg/dl</span>';
    const cEl = document.querySelector('.stats-card:nth-child(1) .stat-val'); if (cEl) cEl.innerHTML = (1290 + Math.floor(d.steps * 0.04)) + ' <span>/2340Kcal</span>';
}

function updateHealthPageUI() {
    const d = state.daily[state.viewDate];
    if (!d) return;
    
    // BP
    const bpEl = document.querySelector('.stats-grid .stats-card:nth-child(1) .stat-val');
    if (bpEl && location.pathname.includes('health')) bpEl.innerHTML = `${d.bp_sys}<span>/${d.bp_dia}</span>`;
    
    // SpO2
    const spo2El = document.querySelector('.stats-grid .stats-card:nth-child(2) .stat-val');
    if (spo2El && location.pathname.includes('health')) spo2El.innerHTML = `${d.spo2}<span>%</span>`;
    
    // Sleep
    const sleepEl = document.querySelector('.sleep-bottom div:last-child');
    if (sleepEl) sleepEl.innerHTML = `${d.sleep_h}<span style="font-size:15px; color:#888;">h</span> ${d.sleep_m}<span style="font-size:15px; color:#888;">m</span>`;
    
    // Temp
    const tempEl = document.querySelector('.stats-grid:nth-of-type(2) .stats-card:nth-child(1) .stat-val');
    if (tempEl) tempEl.innerHTML = `${d.temp}<span>°F</span>`;

    // Macros
    const totalMacro = d.carbs*4 + d.protein*4 + d.fat*9;
    const totalEl = document.querySelector('.macros-card .steps-icon-inner span:first-child');
    if (totalEl) totalEl.textContent = totalMacro.toString();
    
    const carbEl = document.querySelector('.macro-stat:nth-child(1) span'); if (carbEl) carbEl.textContent = d.carbs + "g";
    const protEl = document.querySelector('.macro-stat:nth-child(2) span'); if (protEl) protEl.textContent = d.protein + "g";
    const fatEl = document.querySelector('.macro-stat:nth-child(3) span'); if (fatEl) fatEl.textContent = d.fat + "g";

    // Dynamic SVG Ring Geometry & Labels
    const circum = 100.531;
    const pC = totalMacro > 0 ? (d.carbs*4 / totalMacro)*circum : 0;
    const pP = totalMacro > 0 ? (d.protein*4 / totalMacro)*circum : 0;
    const pF = totalMacro > 0 ? (d.fat*9 / totalMacro)*circum : 0;

    const rC = document.getElementById('ring-carbs'); if (rC) rC.setAttribute('stroke-dasharray', `${pC}, ${circum}`);
    const rP = document.getElementById('ring-prot'); if (rP) { rP.setAttribute('stroke-dasharray', `${pP}, ${circum}`); rP.setAttribute('stroke-dashoffset', `-${pC}`); }
    const rF = document.getElementById('ring-fats'); if (rF) { rF.setAttribute('stroke-dasharray', `${pF}, ${circum}`); rF.setAttribute('stroke-dashoffset', `-${pC + pP}`); }

    const pctC = totalMacro > 0 ? (d.carbs*4 / totalMacro)*100 : 0;
    const pctP = totalMacro > 0 ? (d.protein*4 / totalMacro)*100 : 0;
    const pctF = totalMacro > 0 ? (d.fat*9 / totalMacro)*100 : 0;

    const labC = document.querySelector('.macro-stat:nth-child(1) div:last-child'); if (labC) labC.textContent = `Carbs (${Math.round(pctC)}%)`;
    const labP = document.querySelector('.macro-stat:nth-child(2) div:last-child'); if (labP) labP.textContent = `Protein (${Math.round(pctP)}%)`;
    const labF = document.querySelector('.macro-stat:nth-child(3) div:last-child'); if (labF) labF.textContent = `Fats (${Math.round(pctF)}%)`;


    // Meds
    const medItems = document.querySelectorAll('.med-item');
    const totalMeds = medItems.length;
    let takenMeds = 0;
    
    medItems.forEach(item => {
        const name = (item.querySelector('.med-name')?.textContent || "").trim();
        const isDone = (d.meds || []).includes(name);
        if(isDone) takenMeds++;
        const btn = item.querySelector('.check-btn');
        (item as HTMLElement).style.opacity = isDone ? '0.5' : '1';
        isDone ? btn?.classList.remove('outline') : btn?.classList.add('outline');
    });

    const medHead = document.querySelector('.meds-card .section-header span:last-child');
    if (medHead) medHead.textContent = `${takenMeds}/${totalMeds} Taken`;

    // Symptoms
    const list = document.getElementById('symptoms-list');
    if (list) {
        list.innerHTML = '';
        (d.symptoms || []).forEach((s: any) => {
            const div = document.createElement('div');
            div.className = 'exercise-item' + (s.highlight ? ' highlight' : '');
            if(s.highlight) div.style.background = '#fff3e0';
            div.innerHTML = `
                <div class="check-btn outline" style="color:${s.color || '#e03070'}; border-color:${s.color || '#e03070'};">
                    <svg width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                </div>
                <div class="ex-info">
                    <div class="ex-title" style="font-size:16px;">${s.title}</div>
                    <div class="ex-desc">${s.desc}</div>
                </div>
                <div style="font-weight:800; font-size:13px; color:#aaa;">${s.time}</div>
            `;
            list.appendChild(div);
        });
    }
}

function updateExercisesPageUI() {
    if (!location.pathname.includes('exercises')) return;
    const d = state.daily[state.viewDate];
    if (!d) return;

    // Active Burn
    const burnEl = document.querySelector('.col-1 .stats-grid .stats-card:nth-child(1) .stat-val');
    if (burnEl) burnEl.innerHTML = `${Math.floor(d.steps * 0.04)} <span>Kcal</span>`;

    // Streak
    const streakEl = document.querySelector('.col-1 .stats-grid .stats-card:nth-child(2) .stat-val');
    if (streakEl) streakEl.innerHTML = `${state.streak} <span>Days</span>`;

    // HR Zone
    const hrEl = document.querySelector('.hr-zone-card .hr-zone-value');
    if (hrEl) hrEl.innerHTML = `${state.heartRate} <span style="font-size:16px; font-weight:700; color:rgba(255,255,255,0.8);">bpm</span>`;

    // Muscle Recovery
    const mbGroups = document.querySelectorAll('.muscle-bar-group');
    if (mbGroups.length >= 3) {
        const chestEl = mbGroups[0]; const backEl = mbGroups[1]; const legsEl = mbGroups[2];
        const chestVal = chestEl.querySelector('.mb-top span:last-child'); const chestFill = chestEl.querySelector('.mb-fill') as HTMLElement;
        if (chestVal && chestFill) { chestVal.textContent = state.muscles.chest + '%'; chestFill.style.width = state.muscles.chest + '%'; }
        const backVal = backEl.querySelector('.mb-top span:last-child'); const backFill = backEl.querySelector('.mb-fill') as HTMLElement;
        if (backVal && backFill) { backVal.textContent = state.muscles.back + '%'; backFill.style.width = state.muscles.back + '%'; }
        const legsVal = legsEl.querySelector('.mb-top span:last-child'); const legsFill = legsEl.querySelector('.mb-fill') as HTMLElement;
        if (legsVal && legsFill) { legsVal.textContent = state.muscles.legs + '%'; legsFill.style.width = state.muscles.legs + '%'; }
    }

    // PRs
    const prItems = document.querySelectorAll('.pr-item');
    if (prItems.length >= 4) {
        const deadliftEl = prItems[0].querySelector('.pr-val'); if(deadliftEl) deadliftEl.innerHTML = `${state.prs.deadlift} <span>kg</span>`;
        const squatEl = prItems[1].querySelector('.pr-val'); if(squatEl) squatEl.innerHTML = `${state.prs.squat} <span>kg</span>`;
        const benchEl = prItems[2].querySelector('.pr-val'); if(benchEl) benchEl.innerHTML = `${state.prs.bench} <span>kg</span>`;
        const runEl = prItems[3].querySelector('.pr-val'); if(runEl) runEl.innerHTML = `${state.prs.run} <span>min</span>`;
    }
}

function updateChartUI() {
    const current = new Date(state.viewDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(new Date(state.viewDate).setDate(diff));
    
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    
    const dateLabel = document.querySelector('.chart-date');
    if (dateLabel) {
        const opts: any = { day: 'numeric', month: 'short' };
        dateLabel.textContent = `${monday.toLocaleDateString('en-US', opts)} - ${sunday.toLocaleDateString('en-US', opts)}`;
    }

    let weeklySteps = 0, weeklyKcal = 0;
    const darkBars = document.querySelectorAll<HTMLElement>('.bar.dark');
    const lightBars = document.querySelectorAll<HTMLElement>('.bar.light');
    const labels = document.querySelectorAll<HTMLElement>('.bar-label');
    const tips = document.querySelectorAll<HTMLElement>('.bar-tip');

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        const stats = state.daily[ds] || { steps: 0 };
        const steps = stats.steps || 0;
        const kcal = Math.floor(steps * 0.04);
        
        weeklySteps += steps;
        weeklyKcal += kcal;

        if (darkBars[i]) darkBars[i].style.setProperty('--fill-h', Math.min((steps / state.stepsGoal) * 100, 100) + "%");
        if (lightBars[i]) lightBars[i].style.setProperty('--fill-h', Math.min((kcal / (state.stepsGoal * 0.04)) * 100, 100) + "%");
        if (labels[i]) labels[i].textContent = d.toLocaleDateString('en-US', { weekday: 'short' });

        if (tips[i]) {
            if (steps > 0) {
                const pct = Math.round((steps / state.stepsGoal) * 100);
                tips[i].textContent = (pct >= 100 ? "Goal!" : `+${pct}%`);
                tips[i].style.display = 'block';
            } else {
                tips[i].style.display = 'none';
            }
        }
    }

    const stepsTotalEl = document.querySelector('.chart-small-steps');
    const kcalTotalEl = document.querySelector('.chart-small-kcal');
    if (stepsTotalEl) stepsTotalEl.textContent = weeklySteps.toLocaleString();
    if (kcalTotalEl) kcalTotalEl.textContent = weeklyKcal.toLocaleString();
}

function updateWellnessUI() {
    const gauge = document.querySelector('.gauge-area path:last-child');
    const scoreVal = document.querySelector('.gauge-area div:nth-child(2)');
    if (gauge && scoreVal) {
        gauge.setAttribute('stroke-dashoffset', (207 - (state.wellnessScore / 10 * 207)).toString());
        scoreVal.innerHTML = state.wellnessScore.toFixed(1) + '<span style="font-size:22px; color:#aaa;">/10</span>';
    }
}

function updateExercisesUI() {
    const list = document.getElementById('exercise-list');
    if (!list) return;
    
    const d = state.daily[state.viewDate];
    if (!d) return;

    list.innerHTML = '';
    
    // 1. Calculate the two days
    const currentViewDate = new Date(state.viewDate);
    
    const prevDate = new Date(currentViewDate); prevDate.setDate(prevDate.getDate() - 1);
    const prevDs = prevDate.toISOString().split('T')[0];
    const prevDayName = prevDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    // 2. Resolve Today's Exercise (Manual override or Routine)
    const todayDayName = currentViewDate.toLocaleDateString('en-US', { weekday: 'long' });
    const todayEx = d.manualExercise || masterRoutine[todayDayName] || workoutLibrary[0];
    
    // 3. Resolve Yesterday's Exercise (Always from Routine for simplicity/history)
    const yesterdayEx = state.daily[prevDs]?.manualExercise || masterRoutine[prevDayName] || workoutLibrary[0];

    const renderExCard = (ex: any, label: string, isToday: boolean) => {
        const isDone = d.completed?.includes(ex.title);
        const div = document.createElement('div');
        div.className = 'exercise-item' + (isToday ? ' highlight' : '');
        if(isDone) div.style.opacity = '0.5';
        div.innerHTML = `
            <div class="ex-info">
                <div class="ex-title"><span>${label}</span> ${ex.title}</div>
                <div class="ex-desc">${ex.desc}</div>
                <div class="ex-time">${ex.time}</div>
            </div>
            <img src="${ex.img}" class="ex-img">
            <div class="check-btn ${isDone ? '' : 'outline'}"><svg width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        `;
        list.appendChild(div);

        if(isToday) {
            div.querySelector('.check-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                ensure(state.viewDate);
                if(!state.daily[state.viewDate].completed) state.daily[state.viewDate].completed = [];
                const completed = state.daily[state.viewDate].completed;
                if(completed.includes(ex.title)) {
                    state.daily[state.viewDate].completed = completed.filter((c:string) => c !== ex.title);
                    notify('🏃 Exercise Unmarked', `${ex.title} removed from today's log`, 'info');
                } else {
                    state.daily[state.viewDate].completed = [...completed, ex.title];
                    notify('💪 Exercise Complete!', `${ex.title} (${ex.time}) — Great work! 🎉`, 'meds');
                }
                updateExercisesUI();
                sync();
            });
        }

    };

    // Render Previous Day first
    renderExCard(yesterdayEx, 'Yesterday', false);
    // Render Current Day (Highlighted)
    renderExCard(todayEx, 'Today', true);
}

function updateHeartUI() {
    const bpmVal = document.querySelector('.heart-bottom div:last-child');
    if (bpmVal) bpmVal.innerHTML = state.heartRate + ' <span style="font-size:15px; color:#888;">bpm</span>';
    
    // High Heart Rate Alert
    if(state.heartRate > 120) {
        const lastNotif = state.daily[state.viewDate].notifications?.find((n:any) => n.title.includes("High Heart Rate"));
        if(!lastNotif) {
            notify("High Heart Rate Alert", `Your heart rate is currently ${state.heartRate} BPM. Please rest.`, "alert");
        }
    }
}

function renderWorkoutUI() {
    const cardioBtn = document.querySelector<HTMLElement>('.cardio-btn');
    if (cardioBtn) {
        cardioBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            '<span class="workout-text-content">' + exList[state.workoutExIdx] + ' ' + formatTime(state.workoutTimer) + '</span>' +
            '<div class="pause-icon">' + 
                (state.workoutRunning ? '<svg viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="3" height="8" rx="1"/><rect x="7" y="2" width="3" height="8" rx="1"/></svg>' : '<svg viewBox="0 0 12 12" fill="currentColor"><polygon points="3,2 10,6 3,10"/></svg>') +
            '</div>';
    }

    document.querySelectorAll('.dropdown-item').forEach((item, i) => {
        item.classList.remove('active');
        const span = item.querySelector('span'); if (span) span.remove();
        if (i === state.workoutExIdx) {
            item.classList.add('active');
            item.innerHTML += ' <span>Current</span>';
        }
    });
}

function renderCalendarRow() {
    const row = document.querySelector('.cal-row-view'); if (!row) return;
    row.innerHTML = '';
    const current = new Date(state.viewDate);
    const month = document.querySelector('.month-nav span'); if (month) month.textContent = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    for (let i = -3; i <= 3; i++) {
        const d = new Date(current); d.setDate(current.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        const item = document.createElement('div');
        item.className = 'cal-item' + (ds === state.viewDate ? ' active' : '') + (state.daily[ds]?.steps > 0 ? ' has-data' : '');
        item.innerHTML = `<span class="cal-day-label">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span><div class="cal-day-num">${d.getDate()}</div>`;
        item.onclick = () => { state.viewDate = ds; renderAll(); sync(); };
        row.appendChild(item);
    }
}

function renderModalCalendar() {
    const modalLabels = document.querySelectorAll('.m-label, .card > .section-header > .month-nav > span');
    modalLabels.forEach(label => label.textContent = months[state.viewMonth] + " " + state.viewYear);
    
    document.querySelectorAll('.modal-cal-grid, .card > .cal-grid').forEach(grid => {
        grid.innerHTML = '<div class="cal-head">S</div><div class="cal-head">M</div><div class="cal-head">T</div><div class="cal-head">W</div><div class="cal-head">T</div><div class="cal-head">F</div><div class="cal-head">S</div>';
        const first = new Date(state.viewYear, state.viewMonth, 1).getDay();
        const total = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
        for (let i = 0; i < first; i++) grid.appendChild(document.createElement('div'));
        for (let d = 1; d <= total; d++) {
            const ds = `${state.viewYear}-${String(state.viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const el = document.createElement('div'); el.className = 'cal-day' + (ds === state.viewDate ? ' active-ring' : '');
            el.textContent = d.toString(); 
            if (state.daily[ds]?.steps > 0) { el.style.color = 'var(--olive)'; el.style.fontWeight = '900'; }
            el.onclick = () => { state.viewDate = ds; renderAll(); sync(); document.getElementById('calendar-modal')?.classList.remove('show'); };
            grid.appendChild(el);
        }
    });
}

async function notify(title:string, msg:string, type:string = 'alert') {
    ensure(state.viewDate);
    const notif = {
        id: Date.now(),
        title,
        msg,
        type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
    };
    if(!state.daily[state.viewDate].notifications) state.daily[state.viewDate].notifications = [];
    state.daily[state.viewDate].notifications.unshift(notif);
    updateNotifUI();
    showToast(`Notification: ${title}`, false);
    sync();
}

function updateNotifUI() {
    const d = state.daily[state.viewDate];
    const panel = document.getElementById('notification-center');
    const backdrop = document.getElementById('notif-backdrop');
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('unread-count');
    const pill = document.getElementById('unread-count-pill');
    if(!list || !d) return;

    const notifs = d.notifications || [];
    const unreadCount = notifs.filter((n:any) => !n.read).length;

    if(badge) {
        badge.textContent = unreadCount.toString();
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    if(pill) pill.textContent = unreadCount.toString();

    if(notifs.length === 0) {
        list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
        return;
    }

    list.innerHTML = notifs.map((n:any) => `
        <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
            <div class="notif-icon-box ${n.type}">
                ${n.type === 'alert' ? '☢️' : n.type === 'meds' ? '💊' : '💰'}
            </div>
            <div class="notif-content-area">
                <div class="notif-title-text">${n.title}</div>
                <div class="notif-message-text">${n.msg}</div>
                <div class="notif-timestamp">${n.time}</div>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.getAttribute('data-id') || '0');
            const found = d.notifications.find((n:any) => n.id === id);
            if(found) found.read = true;
            updateNotifUI();
            sync();
        });
    });
}

function init() {
    load();
    
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

    document.querySelector('.water-card')?.addEventListener('click', () => {
        ensure(state.viewDate);
        state.daily[state.viewDate].water += 0.25;
        const w = state.daily[state.viewDate].water;
        updateWaterUI();
        sync();
        notify(`💧 Water Updated`, `You've logged ${w.toFixed(2)}L today. Goal: ${state.waterGoal}L`, 'meds');
    });
    document.querySelector('.wellness-card')?.addEventListener('click', () => {
        state.wellnessScore = (Math.random()*3)+7;
        updateWellnessUI();
        sync();
        notify('📊 Wellness Recalculated', `Your wellness score is now ${state.wellnessScore.toFixed(1)}/10`, 'info');
    });
    
    // Interactions
    if (!(window as any)._mainDocClickBound) {
        document.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const card = target.closest('.stats-card');
            if (card) {
                const name = card.querySelector('.stat-name')?.textContent || "";
                if (state.viewDate && state.daily[state.viewDate]) {
                    const d = state.daily[state.viewDate];
                    if (name === "Weight") { const v = await healthianPrompt("Weight (kg):", d.weight.toString()); if(v){d.weight=parseFloat(v); renderAll(); sync(); notify('⚖️ Weight Updated', `Logged ${parseFloat(v)}kg. Healthy range: ${state.weightMin}-${state.weightMax}kg`, 'alert');} }
                    if (name === "Glucose") { const v = await healthianPrompt("Glucose (mg/dl):", d.glucose.toString()); if(v){d.glucose=parseFloat(v); renderAll(); sync(); const g=parseFloat(v); notify('🩸 Glucose Updated', `${g} mg/dl — ${g<54?'Too Low ⚠️':g>62?'Slightly High':'Normal ✅'}`, g>120?'alert':'meds');} }
                    if (name === "Blood Pressure") { const sys = await healthianPrompt("Systolic:", d.bp_sys.toString()); const dia = await healthianPrompt("Diastolic:", d.bp_dia.toString()); if(sys && dia){d.bp_sys=parseInt(sys); d.bp_dia=parseInt(dia); renderAll(); sync(); notify('🫀 BP Updated', `${sys}/${dia} mmHg — ${parseInt(sys)>140?'High BP ⚠️':'Looking good ✅'}`, parseInt(sys)>140?'alert':'meds');} }
                    if (name === "Blood Oxygen") { const v = await healthianPrompt("SpO2 %:", d.spo2.toString()); if(v){d.spo2=parseInt(v); renderAll(); sync(); const o=parseInt(v); notify('🫁 SpO2 Updated', `${o}% — ${o<95?'Low — consider rest ⚠️':'Normal ✅'}`, o<95?'alert':'meds');} }
                    if (name === "Body Temp") { const v = await healthianPrompt("Temp °F:", d.temp.toString()); if(v){d.temp=parseFloat(v); renderAll(); sync(); const t=parseFloat(v); notify('🌡️ Temperature Updated', `${t}°F — ${t>99.5?'Elevated ⚠️':'Normal ✅'}`, t>99.5?'alert':'meds');} }
                }
            }
            
            const macros = target.closest('.macros-card');
            if (macros && state.viewDate && state.daily[state.viewDate]) {
                const d = state.daily[state.viewDate];
                const c = await healthianPrompt("Carbs (g):", d.carbs.toString()); 
                const p = await healthianPrompt("Protein (g):", d.protein.toString()); 
                const f = await healthianPrompt("Fat (g):", d.fat.toString());
                if(c && p && f){ d.carbs=parseInt(c); d.protein=parseInt(p); d.fat=parseInt(f); renderAll(); sync(); notify('🥗 Macros Updated', `Carbs: ${c}g | Protein: ${p}g | Fat: ${f}g`, 'info'); }
            }

        const prItem = target.closest('.pr-item');
        if (prItem) {
            const name = prItem.querySelector('.pr-name')?.textContent || "";
            if (name === "Deadlift") { const v = await healthianPrompt("Deadlift PR (kg):", state.prs.deadlift.toString()); if(v){state.prs.deadlift=parseInt(v); renderAll(); sync(); notify('🏋️ New PR!', `Deadlift: ${v}kg — Personal Record logged!`, 'info');} }
            if (name === "Squat") { const v = await healthianPrompt("Squat PR (kg):", state.prs.squat.toString()); if(v){state.prs.squat=parseInt(v); renderAll(); sync(); notify('🏋️ New PR!', `Squat: ${v}kg — Personal Record logged!`, 'info');} }
            if (name === "Bench Press") { const v = await healthianPrompt("Bench PR (kg):", state.prs.bench.toString()); if(v){state.prs.bench=parseInt(v); renderAll(); sync(); notify('🏋️ New PR!', `Bench Press: ${v}kg — Personal Record logged!`, 'info');} }
            if (name === "5K Run") { const v = await healthianPrompt("5K Run PR (min):", state.prs.run); if(v){state.prs.run=v; renderAll(); sync(); notify('🏃 New PR!', `5K Run: ${v} min — Personal Record logged!`, 'info');} }
        }

        const muscleGroup = target.closest('.muscle-bar-group');
        if (muscleGroup) {
            const name = muscleGroup.querySelector('.mb-top span:first-child')?.textContent || "";
            if (name.includes("Chest")) { const v = await healthianPrompt("Chest Recovery %:", state.muscles.chest.toString()); if(v){state.muscles.chest=parseInt(v); renderAll(); sync(); notify('💪 Muscle Updated', `Chest recovery: ${v}%`, 'meds');} }
            if (name.includes("Back")) { const v = await healthianPrompt("Back Recovery %:", state.muscles.back.toString()); if(v){state.muscles.back=parseInt(v); renderAll(); sync(); notify('💪 Muscle Updated', `Back recovery: ${v}%`, 'meds');} }
            if (name.includes("Legs")) { const v = await healthianPrompt("Legs Recovery %:", state.muscles.legs.toString()); if(v){state.muscles.legs=parseInt(v); renderAll(); sync(); notify('💪 Muscle Updated', `Legs recovery: ${v}%`, 'meds');} }
        }
        
        const streakCard = target.closest('.col-1 .stats-grid .stats-card');
        if (streakCard) {
            const name = streakCard.querySelector('.stat-name')?.textContent || "";
            if (name === "Streak") { const v = await healthianPrompt("Workout Streak (Days):", state.streak.toString()); if(v){state.streak=parseInt(v); renderAll(); sync(); notify('🔥 Streak Updated', `Your workout streak is now ${v} days — Keep it up!`, 'info');} }
        }
    });
    (window as any)._mainDocClickBound = true;
}
    document.querySelector('.cal-trigger')?.addEventListener('click', () => document.getElementById('calendar-modal')?.classList.add('show'));
    document.querySelector('.close-modal')?.addEventListener('click', () => document.getElementById('calendar-modal')?.classList.remove('show'));

    // Notification Modal Controls
    const openNotif = () => {
        document.getElementById('notification-center')?.classList.add('show');
        updateNotifUI();
    };
    const closeNotif = () => {
        document.getElementById('notification-center')?.classList.remove('show');
    };

    document.getElementById('bell-trigger')?.addEventListener('click', openNotif);
    document.getElementById('close-notif')?.addEventListener('click', closeNotif);
    
    // Close modal on background click
    if (!(window as any)._mainWinClickBound) {
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('notification-center')) closeNotif();
        });
        (window as any)._mainWinClickBound = true;
    }

    document.getElementById('mark-all-read')?.addEventListener('click', (e) => {
        e.stopPropagation();
        ensure(state.viewDate);
        state.daily[state.viewDate].notifications?.forEach((n:any) => n.read = true);
        updateNotifUI();
        sync();
    });

    // Mock welcome
    setTimeout(() => {
        ensure(state.viewDate);
        if(!state.daily[state.viewDate].notifications?.length) {
            notify("System Active", "Healthian AI is monitoring your biometric streams.", "meds");
        }
    }, 1500);
    
    // Settings Binding
    document.getElementById('settings-trigger')?.addEventListener('click', () => {
        (document.getElementById('inp-height') as HTMLInputElement).value = state.height;
        (document.getElementById('inp-wt-min') as HTMLInputElement).value = state.weightMin.toString();
        (document.getElementById('inp-wt-max') as HTMLInputElement).value = state.weightMax.toString();
        (document.getElementById('inp-water') as HTMLInputElement).value = state.waterGoal.toString();
        (document.getElementById('inp-steps') as HTMLInputElement).value = state.stepsGoal.toString();
        document.getElementById('settings-modal')?.classList.add('show');
    });
    
    document.querySelector('.close-settings')?.addEventListener('click', () => document.getElementById('settings-modal')?.classList.remove('show'));
    
    document.getElementById('save-settings-btn')?.addEventListener('click', () => {
        state.height = (document.getElementById('inp-height') as HTMLInputElement).value || state.height;
        state.weightMin = parseFloat((document.getElementById('inp-wt-min') as HTMLInputElement).value) || state.weightMin;
        state.weightMax = parseFloat((document.getElementById('inp-wt-max') as HTMLInputElement).value) || state.weightMax;
        state.waterGoal = parseFloat((document.getElementById('inp-water') as HTMLInputElement).value) || state.waterGoal;
        state.stepsGoal = parseFloat((document.getElementById('inp-steps') as HTMLInputElement).value) || state.stepsGoal;
        
        document.getElementById('settings-modal')?.classList.remove('show');
        renderAll();
        sync();
        showToast("Settings Updated Globally", false);
        notify('⚙️ Settings Saved', `Goals updated — Steps: ${state.stepsGoal.toLocaleString()}, Water: ${state.waterGoal}L`, 'info');
    });

    document.querySelector('.next-m')?.addEventListener('click', () => { state.viewMonth++; if(state.viewMonth>11){state.viewMonth=0; state.viewYear++;} renderModalCalendar(); });
    
    // Chart Navigation
    const chartBtns = document.querySelectorAll('.chart-nav-btn');
    if (chartBtns.length === 2) {
        chartBtns[0].addEventListener('click', () => {
            const d = new Date(state.viewDate); d.setDate(d.getDate() - 7);
            state.viewDate = d.toISOString().split('T')[0];
            renderAll(); sync();
        });
        chartBtns[1].addEventListener('click', () => {
            const d = new Date(state.viewDate); d.setDate(d.getDate() + 7);
            state.viewDate = d.toISOString().split('T')[0];
            renderAll(); sync();
        });
    }

    // Symptom Binding
    document.getElementById('add-symptom-btn')?.addEventListener('click', () => document.getElementById('symptom-modal')?.classList.add('show'));
    document.querySelector('.close-symptom')?.addEventListener('click', () => document.getElementById('symptom-modal')?.classList.remove('show'));
    
    // Med Binding (Delegation)
    document.querySelector('.meds-card')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.check-btn');
        if (!btn) return;
        const item = btn.closest('.med-item');
        const name = item?.querySelector('.med-name')?.textContent?.trim();
        if (!name) return;

        ensure(state.viewDate);
        if (!state.daily[state.viewDate].meds) state.daily[state.viewDate].meds = [];
        const meds = state.daily[state.viewDate].meds;
        if (meds.includes(name)) {
            state.daily[state.viewDate].meds = meds.filter((m: string) => m !== name);
            notify('💊 Medication Unmarked', `${name} marked as not taken`, 'meds');
        } else {
            state.daily[state.viewDate].meds = [...meds, name];
            notify('💊 Medication Taken', `${name} logged as taken ✅`, 'meds');
        }
        updateHealthPageUI();
        sync();
    });

    document.getElementById('save-symptom-btn')?.addEventListener('click', () => {
        const title = (document.getElementById('inp-symp-title') as HTMLInputElement).value;
        const desc = (document.getElementById('inp-symp-desc') as HTMLTextAreaElement).value;
        if (!title) return;

        ensure(state.viewDate);
        if (!state.daily[state.viewDate].symptoms) {
            state.daily[state.viewDate].symptoms = [];
        }
        
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        
        state.daily[state.viewDate].symptoms.push({
            title, desc, time: timeStr, color: '#e03070', highlight: false
        });

        document.getElementById('symptom-modal')?.classList.remove('show');
        (document.getElementById('inp-symp-title') as HTMLInputElement).value = '';
        (document.getElementById('inp-symp-desc') as HTMLTextAreaElement).value = '';
        
        updateHealthPageUI();
        sync();
        showToast("Condition Logged", false);
    });

    // Dynamically build dropdown items
    const dd = document.querySelector('.workout-dropdown');
    if (dd) {
        const header = dd.querySelector('.dropdown-header');
        dd.innerHTML = '';
        if(header) dd.appendChild(header);
        exList.forEach((ex, i) => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = ex;
            div.addEventListener('click', () => { state.workoutExIdx = i; state.workoutTimer = 0; state.workoutRunning = true; renderWorkoutUI(); sync(); document.querySelector('.workout-dropdown')?.classList.remove('show'); });
            dd.appendChild(div);
        });
        renderWorkoutUI();
    }

    setInterval(() => {
        if (state.workoutRunning) {
            state.workoutTimer++; if (state.workoutTimer >= 1800) { state.workoutTimer = 0; state.workoutExIdx = (state.workoutExIdx+1)%exList.length; }
            renderWorkoutUI(); if (state.workoutTimer % 5 === 0) sync();
        }
    }, 1000);

    document.querySelector('.cardio-btn')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.pause-icon')) { e.stopPropagation(); state.workoutRunning = !state.workoutRunning; renderWorkoutUI(); sync(); return; }
        document.querySelector('.workout-dropdown')?.classList.toggle('show');
    });

    setInterval(() => { state.heartRate = Math.max(60,Math.min(180,state.heartRate+(Math.floor(Math.random()*5)-2))); updateHeartUI(); }, 3000);

    
    if (!(window as any)._mainNetBound) {
        window.addEventListener('offline', () => showToast("Network lost. Working offline.", true));
        window.addEventListener('online', () => { showToast("Back online! Syncing now...", false); sync(); });
        (window as any)._mainNetBound = true;
    }

    // Exercise Choice / Add Routine
    const exTrigger = document.getElementById('add-exercise-btn');
    const exMenu = document.getElementById('exercise-dropdown-menu');
    exTrigger?.addEventListener('click', () => exMenu?.classList.toggle('show'));
    
    if (exMenu) {
        workoutLibrary.forEach(ex => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = ex.title;
            div.onclick = () => {
                ensure(state.viewDate);
                state.daily[state.viewDate].manualExercise = ex;
                updateExercisesUI();
                sync();
                exMenu.classList.remove('show');
                showToast(`Switched to ${ex.title}`, false);
            };
            exMenu.appendChild(div);
        });
    }

    // Exercise Completion
    document.getElementById('exercise-list')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.check-btn');
        if (!btn) return;
        const item = btn.closest('.exercise-item');
        const title = item?.querySelector('.ex-title')?.textContent?.replace('Today', '').trim();
        if(!title) return;

        ensure(state.viewDate);
        if(!state.daily[state.viewDate].completed) state.daily[state.viewDate].completed = [];
        const completed = state.daily[state.viewDate].completed;
        if(completed.includes(title)) {
            state.daily[state.viewDate].completed = completed.filter((t:string) => t !== title);
        } else {
            state.daily[state.viewDate].completed.push(title);
        }
        updateExercisesUI();
        sync();
    });

    // Premium Floating Nav: Show/Hide on Scroll
    // Premium Floating Nav: Show/Hide on Scroll
    if (!(window as any)._mainScrollBound) {
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
        (window as any)._mainScrollBound = true;
    }
}

(window as any).initMain = init;
document.addEventListener('DOMContentLoaded', () => {
    init();
    initSPA();
});
