/* =====================
   app.js — логіка додатку v3
   Нові фічі: YouTube-акордеон з рандомним відео, темна тема, відмітка тренувань
   ===================== */

let activeDay = 0;
/* Зберігаємо поточний відкритий акордеон {dayIdx, exIdx} */
let openAccordion = null;

/* ---- Ініціалізація ---- */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initOfflineBanner();
  renderSched();
  selectDay(getTodayIndex());
  renderNutrition(1);
  updateDoneCount();
  registerServiceWorker();
});

/* =====================
   ТЕМНА ТЕМА
   ===================== */
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved ? saved === 'dark' : prefersDark);
}

function toggleTheme() {
  setTheme(!document.body.classList.contains('dark'));
}

function setTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.getElementById('icon-sun').style.display  = isDark ? 'block' : 'none';
  document.getElementById('icon-moon').style.display = isDark ? 'none'  : 'block';
  document.getElementById('theme-color-meta').content = isDark ? '#141413' : '#1D9E75';
}

/* =====================
   ВІДМІТКА ТРЕНУВАНЬ
   ===================== */
function getTodayKey(dayIndex) {
  const today = new Date();
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const target = new Date(monday);
  target.setDate(monday.getDate() + dayIndex);
  const yyyy = target.getFullYear();
  const mm   = String(target.getMonth() + 1).padStart(2, '0');
  const dd   = String(target.getDate()).padStart(2, '0');
  return `done_${yyyy}-${mm}-${dd}_${dayIndex}`;
}

function isDone(dayIndex) {
  return localStorage.getItem(getTodayKey(dayIndex)) === 'true';
}

function toggleDone(dayIndex) {
  const key     = getTodayKey(dayIndex);
  const current = localStorage.getItem(key) === 'true';
  localStorage.setItem(key, String(!current));
  renderSched();
  renderWorkout();
  updateDoneCount();
  showToast(current ? 'Відмітку знято' : '✓ Тренування виконано!');
}

function updateDoneCount() {
  let count = 0;
  for (let i = 0; i < 7; i++) { if (isDone(i)) count++; }
  document.getElementById('stat-done-val').textContent = count;
}

/* =====================
   ТИЖНЕВИЙ РОЗКЛАД
   ===================== */
function getTodayIndex() {
  const dow = new Date().getDay();
  return dow === 0 ? 6 : dow - 1;
}

function renderSched() {
  const container = document.getElementById('week-sched');
  container.innerHTML = DAYS_META.map((d, i) => {
    const done    = isDone(i);
    const classes = ['day-pill', i === activeDay ? 'active' : '', done ? 'done' : ''].join(' ').trim();
    return `
      <div class="${classes}" onclick="selectDay(${i})">
        <div class="dp-label">${d.label}</div>
        <div class="dp-dot dot-${d.type}"></div>
        <div class="dp-short">${d.short}</div>
      </div>`;
  }).join('');
}

function selectDay(index) {
  if (activeDay !== index) openAccordion = null; /* скидаємо акордеон при зміні дня */
  activeDay = index;
  renderSched();
  renderWorkout();
}

/* =====================
   YOUTUBE АКОРДЕОН
   ===================== */

/* Рандомно обирає один відеоID з масиву */
function pickRandomVideo(videos) {
  return videos[Math.floor(Math.random() * videos.length)];
}

function toggleExercise(exIndex) {
  const w = WORKOUTS[activeDay];
  const ex = w.exercises[exIndex];
  if (!ex.videos || ex.videos.length === 0) return;

  /* Якщо цей самий акордеон вже відкритий — закриваємо */
  const isSame = openAccordion && openAccordion.day === activeDay && openAccordion.ex === exIndex;
  openAccordion = isSame ? null : { day: activeDay, ex: exIndex };

  renderWorkout();

  /* Скролимо до відкритого акордеону */
  if (openAccordion) {
    setTimeout(() => {
      const el = document.getElementById(`acc-${exIndex}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }
}

/* =====================
   РЕНДЕР ТРЕНУВАННЯ
   ===================== */
function renderWorkout() {
  const w         = WORKOUTS[activeDay];
  const done      = isDone(activeDay);
  const isRestDay = w.type === 'gray';
  const iconMap   = { teal: 'icon-teal', blue: 'icon-blue', coral: 'icon-coral', gray: 'icon-gray' };
  const cardClass = done ? 'card done-card' : 'card';

  const exercisesHTML = w.exercises.map((e, i) => {
    const hasVideo    = e.videos && e.videos.length > 0;
    const isOpen      = openAccordion && openAccordion.day === activeDay && openAccordion.ex === i;
    const rowClass    = ['ex-row', hasVideo ? 'has-video' : '', isOpen ? 'active' : ''].join(' ').trim();
    const videoId     = (isOpen && hasVideo) ? pickRandomVideo(e.videos) : null;

    const accordionHTML = (isOpen && videoId) ? `
      <div class="ex-accordion open" id="acc-${i}">
        <div class="yt-wrap">
          <iframe
            src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1"
            title="Техніка виконання: ${e.name}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            loading="lazy">
          </iframe>
        </div>
        ${e.tip ? `<p class="ex-tip"><span class="ex-tip-icon">💡</span>${e.tip}</p>` : ''}
        <button class="ex-reload-btn" onclick="event.stopPropagation(); reloadVideo(${i})">
          ↻ Інше відео
        </button>
      </div>` : `<div class="ex-accordion" id="acc-${i}"></div>`;

    return `
      <div class="${rowClass}" onclick="${hasVideo ? `toggleExercise(${i})` : ''}">
        <span class="ex-name">${e.name}</span>
        <div class="ex-right">
          <span class="ex-sets">${e.sets}</span>
          ${hasVideo ? '<span class="ex-arrow">▾</span>' : ''}
        </div>
      </div>
      ${accordionHTML}`;
  }).join('');

  const doneBtn = isRestDay ? '' : `
    <button class="done-btn ${done ? 'marked' : ''}" onclick="toggleDone(${activeDay})">
      ${done
        ? '<span>✓</span> Виконано — натисни щоб скасувати'
        : '<span>○</span> Відмітити як виконане'}
    </button>`;

  document.getElementById('workout-content').innerHTML = `
    <div class="${cardClass}">
      <div class="card-header">
        <div class="card-icon ${iconMap[w.type]}">${w.icon}</div>
        <div>
          <div class="card-title">${w.title}</div>
          <div class="card-sub">${w.sub}</div>
        </div>
      </div>
      <p class="video-hint">Натисни на вправу ▾ щоб переглянути відео техніки</p>
      ${exercisesHTML}
      ${doneBtn}
    </div>`;
}

/* Перезавантажує відео (обирає нове рандомне) */
function reloadVideo(exIndex) {
  /* Просто ре-рендеримо — pickRandomVideo дасть новий ID */
  renderWorkout();
  setTimeout(() => {
    const el = document.getElementById(`acc-${exIndex}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

/* =====================
   ХАРЧУВАННЯ
   ===================== */
function renderNutrition(weekNum) {
  const data = weekNum === 1 ? WEEK1 : WEEK2;
  document.getElementById('nutrition-content').innerHTML = data.map(d => `
    <div class="card">
      <div class="card-title" style="margin-bottom:10px">${d.day}</div>
      <div class="meal-grid">
        ${d.meals.map(m => `
          <div class="meal-card">
            <div class="meal-time">${m.t}</div>
            <div class="meal-name">${m.n}</div>
            <div class="meal-desc">${m.d}</div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function showWeek(n) {
  document.getElementById('btn-w1').classList.toggle('active', n === 1);
  document.getElementById('btn-w2').classList.toggle('active', n === 2);
  renderNutrition(n);
}

/* =====================
   ВКЛАДКИ
   ===================== */
function switchTab(name) {
  const tabNames = ['workout', 'nutrition', 'tips'];
  document.querySelectorAll('.tab').forEach((btn, i) => {
    btn.classList.toggle('active', tabNames[i] === name);
  });
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
}

/* =====================
   ОФЛАЙН БАНЕР
   ===================== */
function initOfflineBanner() {
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.id = 'offline-banner';
  banner.textContent = '⚡ Офлайн-режим — відео недоступні, решта працює';
  document.body.prepend(banner);
  window.addEventListener('offline', () => document.getElementById('offline-banner').classList.add('show'));
  window.addEventListener('online',  () => {
    document.getElementById('offline-banner').classList.remove('show');
    showToast("З'єднання відновлено 🌐");
  });
  if (!navigator.onLine) banner.classList.add('show');
}

/* =====================
   SERVICE WORKER
   ===================== */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW зареєстровано:', reg.scope))
      .catch(err => console.warn('SW помилка:', err));
  }
}

/* =====================
   КАЛЕНДАР (.ICS)
   ===================== */
function openCalModal() {
  const today = new Date();
  const dow   = today.getDay();
  const diff  = dow === 0 ? 1 : (8 - dow) % 7 || 7;
  const next  = new Date(today);
  next.setDate(today.getDate() + diff);
  document.getElementById('start-date').value = next.toISOString().slice(0, 10);
  document.getElementById('cal-modal').classList.add('open');
}

function closeCalModal() { document.getElementById('cal-modal').classList.remove('open'); }
function closeIfOverlay(e) { if (e.target === document.getElementById('cal-modal')) closeCalModal(); }

function pad(n) { return String(n).padStart(2, '0'); }
function toICSDate(date) {
  return date.getFullYear() + pad(date.getMonth()+1) + pad(date.getDate()) +
    'T' + pad(date.getHours()) + pad(date.getMinutes()) + '00';
}

function generateICS() {
  const startVal = document.getElementById('start-date').value;
  if (!startVal) { alert('Вкажи дату початку'); return; }
  const startDate = new Date(startVal + 'T07:00:00');
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Fitness Plan//UK',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:Тренування','X-WR-TIMEZONE:Europe/Kiev',
  ];
  for (let w = 0; w < 12; w++) {
    for (const ev of CAL_EVENTS) {
      const start = new Date(startDate);
      start.setDate(start.getDate() + w*7 + ev.dayOffset);
      start.setHours(7, 0, 0, 0);
      const end = new Date(start.getTime() + ev.dur * 60000);
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:fitness-w${w}-d${ev.dayOffset}-${Date.now()}@fitplan`);
      lines.push('DTSTART:' + toICSDate(start));
      lines.push('DTEND:'   + toICSDate(end));
      lines.push('SUMMARY:' + ev.title);
      lines.push('DESCRIPTION:' + CAL_DESCRIPTIONS[ev.descKey].replace(/\n/g,'\\n'));
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'trenuvanya.ics'; a.click();
  URL.revokeObjectURL(url);
  closeCalModal();
  showToast('Файл завантажено! Відкрий на iPhone 📅');
}

/* =====================
   TOAST
   ===================== */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}
