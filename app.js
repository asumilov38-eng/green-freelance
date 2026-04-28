"use stict";

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#16A34A'); tg.setBackgroundColor('#F0FDF4'); }

var supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
const BANNER_INTERVAL = 30;
const BUCKET_URL = window.SUPABASE_URL + '/storage/v1/object/public/images/';
const CREATOR_ID = 'GF-000-777';

const STATE = {
    isLoggedIn: false, user: null, tasks: [], myTasks: [], usersCache: {},
    banners: [], currentBanner: 0, bannerTimer: null,
    currentScreen: 'home', categories: [],
    searchQuery: '', searchResults: null
};

// ==========================================
// ЗАГРУЗКА
// ==========================================
async function loadUser() {
    const saved = localStorage.getItem('gfUser');
    if (saved) {
        STATE.user = JSON.parse(saved); STATE.isLoggedIn = true;
        const { data } = await supabase.from('users').select('*').eq('id', STATE.user.id).single();
        if (data) { STATE.user = data; localStorage.setItem('gfUser', JSON.stringify(data)); }
        else { STATE.isLoggedIn = false; STATE.user = null; localStorage.removeItem('gfUser'); }
    }
}

async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('status', 'open').order('created_at', { ascending: false });
    STATE.tasks = data || [];
    if (STATE.user) STATE.myTasks = STATE.tasks.filter(t => t.customer_id === STATE.user.id);
}

async function loadBanners() {
    const { data } = await supabase.from('banner').select('*').gt('expires_at', new Date().toISOString()).order('position');
    STATE.banners = data || [];
}

async function loadCategories() {
    const { data } = await supabase.from('categories').select('*');
    STATE.categories = data || [];
}

async function loadAllData() { await Promise.all([loadTasks(), loadBanners(), loadCategories()]); }

async function getUserById(id) {
    if (!id) return null;
    if (STATE.usersCache[id]) return STATE.usersCache[id];
    const { data } = await supabase.from('users').select('*').eq('id', id).single();
    if (data) STATE.usersCache[id] = data;
    return data;
}

async function getUserRating(uid) {
    if (!uid) return 0;
    const { data } = await supabase.from('reviews').select('rating').eq('user_id', uid);
    if (!data?.length) return 0;
    return Math.round((data.reduce((s, r) => s + r.rating, 0) / data.length) * 10) / 10;
}

async function getUserReviewCount(uid) {
    if (!uid) return 0;
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', uid);
    return count || 0;
}

async function searchUsers(query) {
    if (!query || query.length < 2) return [];
    const { data } = await supabase.from('users').select('*').or(`username.ilike.%${query}%,custom_id.ilike.%${query}%`).limit(20);
    return data || [];
}

function formatPrice(n) { return n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '0'; }
function formatDate(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    return new Date(ts).toLocaleDateString('ru-RU');
}
function formatTimeLeft(ts) {
    const diff = new Date(ts).getTime() - Date.now();
    if (diff <= 0) return 'Истекло';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}ч ${m}мин`;
}
function escapeHTML(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function isCreator() { return STATE.user?.custom_id === CREATOR_ID || STATE.user?.phone === CREATOR_PHONE; }

// ==========================================
// КАРУСЕЛЬ БАННЕРОВ
// ==========================================
function startBannerCarousel() {
    stopBannerCarousel();
    if (STATE.banners.length <= 1) return;
    STATE.currentBanner = 0;
    STATE.bannerTimer = setInterval(() => {
        STATE.currentBanner = (STATE.currentBanner + 1) % STATE.banners.length;
        updateBannerDisplay();
    }, BANNER_INTERVAL * 1000);
}

function stopBannerCarousel() {
    if (STATE.bannerTimer) { clearInterval(STATE.bannerTimer); STATE.bannerTimer = null; }
}

function updateBannerDisplay() {
    const el = document.getElementById('sticky-banner');
    if (!el || !STATE.banners.length) return;
    const b = STATE.banners[STATE.currentBanner];
    const imgEl = el.querySelector('.sticky-banner-image');
    if (imgEl) imgEl.src = b.image ? BUCKET_URL + b.image : '';
    const titleEl = el.querySelector('.sticky-banner-title');
    if (titleEl) titleEl.textContent = b.title;
    const descEl = el.querySelector('.sticky-banner-desc');
    if (descEl) descEl.textContent = b.description;
    const priceEl = el.querySelector('.sticky-banner-price');
    if (priceEl) priceEl.textContent = formatPrice(b.price) + ' ₽';
    el.onclick = (e) => {
        if (e.target.closest('.sticky-banner-btn')) {
            window.open(b.telegram_link || 'https://t.me/FBK_MiniBusiness', '_blank');
        }
    };
}

async function deleteExpiredBanners() {
    const { data } = await supabase.from('banner').select('id').lte('expires_at', new Date().toISOString());
    if (data?.length) for (const b of data) await supabase.from('banner').delete().eq('id', b.id);
}

async function uploadImage(file, path) {
    const ext = file.name.split('.').pop();
    const fileName = path + '_' + Date.now() + '.' + ext;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file, { upsert: true, contentType: file.type });
    if (error) { alert('Ошибка загрузки: ' + error.message); return null; }
    return fileName;
}

// ==========================================
// РЕНДЕР
// ==========================================
function render() {
    document.getElementById('app').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#16A34A;font-weight:600;">Загрузка...</div>';
    STATE.isLoggedIn ? loadAllData().then(() => { deleteExpiredBanners(); renderHome(); }) : renderAuth();
}

// ==========================================
// АВТОРИЗАЦИЯ
// ==========================================
function renderAuth() {
    document.getElementById('app').innerHTML = `
    <div class="app-container auth-screen">
        <div class="auth-header"><div class="auth-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="white" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="white" stroke-width="2"/></svg></div><h1 class="auth-title">GreenFreelance</h1><p class="auth-subtitle">Биржа фриланса</p></div>
        <div class="auth-form-container" id="reg-form">
            <div class="form-title">Регистрация</div>
            <div class="input-group"><label class="input-label">Телефон</label><input class="input-field" type="tel" id="reg-phone" placeholder="+79049584282"></div>
            <div class="input-group"><label class="input-label">Пароль</label><input class="input-field" type="password" id="reg-pass" placeholder="Минимум 4 символа"></div>
            <div class="input-group"><label class="input-label">Никнейм</label><input class="input-field" type="text" id="reg-nick" placeholder="Ваш ник"></div>
            <div class="input-group"><label class="input-label">Описание</label><input class="input-field" type="text" id="reg-desc" placeholder="О себе"></div>
            <div class="input-group"><label class="input-label">Аватарка</label>
                <div class="image-upload-area" id="reg-avatar-area" style="height:100px;"><div class="image-upload-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="#bbb" width="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Загрузить</div></div>
                <input type="file" id="reg-avatar-input" accept="image/*" style="display:none;">
            </div>
            <div class="input-group"><label class="input-label">Роль</label><select class="select-field" id="reg-role"><option value="executor">Исполнитель</option><option value="customer">Заказчик</option><option value="both">Исполнитель и заказчик</option></select></div>
            <p style="font-size:11px;color:#f59e0b;text-align:center;margin:8px 0;">Установите @username в Telegram перед регистрацией!</p>
            <button class="btn btn-primary" id="btn-reg">СОЗДАТЬ АККАУНТ</button>
            <p class="link-text">Уже есть аккаунт? <span id="show-login">Войти</span></p>
        </div>
        <div class="auth-form-container" id="login-form" style="display:none;">
            <div class="form-title">Вход</div>
            <div class="input-group"><label class="input-label">Телефон</label><input class="input-field" type="tel" id="login-phone" placeholder="+79049584282"></div>
            <div class="input-group"><label class="input-label">Пароль</label><input class="input-field" type="password" id="login-pass" placeholder="Пароль"></div>
            <button class="btn btn-primary" id="btn-login">ВОЙТИ</button>
            <p class="link-text">Нет аккаунта? <span id="show-reg">Регистрация</span></p>
        </div>
    </div>`;
    bindAuth();
}

function bindAuth() {
    let avatarFile = null;
    document.getElementById('reg-avatar-area')?.addEventListener('click', () => document.getElementById('reg-avatar-input').click());
    document.getElementById('reg-avatar-input')?.addEventListener('change', e => {
        avatarFile = e.target.files[0];
        if (avatarFile) {
            const r = new FileReader(); r.onload = ev => document.getElementById('reg-avatar-area').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`;
            r.readAsDataURL(avatarFile);
        }
    });
    document.getElementById('btn-reg')?.addEventListener('click', async () => {
        const ph = document.getElementById('reg-phone').value.trim();
        const pw = document.getElementById('reg-pass').value.trim();
        const nn = document.getElementById('reg-nick').value.trim();
        const ds = document.getElementById('reg-desc').value.trim();
        const rl = document.getElementById('reg-role').value;
        if (!ph || !pw || !nn) { alert('Заполните поля!'); return; }
        if (pw.length < 4) { alert('Пароль от 4 символов'); return; }

        let tgUser = '';
        if (tg?.initDataUnsafe?.user?.username) tgUser = tg.initDataUnsafe.user.username;

        let avatarPath = '';
        if (avatarFile) avatarPath = await uploadImage(avatarFile, 'avatars/' + ph);

        const { data, error } = await supabase.from('users').insert({ phone: ph, password: pw, username: nn, description: ds, role: rl, avatar: avatarPath, telegram_username: tgUser }).select().single();
        if (error) { alert('Ошибка: ' + error.message); return; }

        const { data: updated } = await supabase.from('users').select('*').eq('id', data.id).single();
        STATE.user = updated; STATE.isLoggedIn = true;
        localStorage.setItem('gfUser', JSON.stringify(updated));
        render();
    });
    document.getElementById('btn-login')?.addEventListener('click', async () => {
        const ph = document.getElementById('login-phone').value.trim();
        const pw = document.getElementById('login-pass').value.trim();
        if (!ph || !pw) { alert('Заполните поля!'); return; }
        const { data, error } = await supabase.from('users').select('*').eq('phone', ph).eq('password', pw).maybeSingle();
        if (error || !data) { alert('Неверные данные!'); return; }
        STATE.user = data; STATE.isLoggedIn = true;
        localStorage.setItem('gfUser', JSON.stringify(data));
        render();
    });
    document.getElementById('show-login')?.addEventListener('click', () => { document.getElementById('reg-form').style.display = 'none'; document.getElementById('login-form').style.display = 'block'; });
    document.getElementById('show-reg')?.addEventListener('click', () => { document.getElementById('login-form').style.display = 'none'; document.getElementById('reg-form').style.display = 'block'; });
}

function logout() { STATE.isLoggedIn = false; STATE.user = null; localStorage.removeItem('gfUser'); stopBannerCarousel(); render(); }

// ==========================================
// ГЛАВНЫЙ ЭКРАН (без заданий)
// ==========================================
async function renderHome() {
    STATE.currentScreen = 'home'; stopBannerCarousel();
    STATE.searchResults = null; STATE.searchQuery = '';
    const user = STATE.user;
    const rating = await getUserRating(user.id);

    const banners = STATE.banners;
    const bannerHTML = banners.length ? `
        <div class="sticky-banner" id="sticky-banner" style="cursor:pointer;">
            ${banners[0]?.image ? `<img class="sticky-banner-image" src="${BUCKET_URL}${banners[0].image}" alt="">` : ''}
            <div class="sticky-banner-body">
                <div class="sticky-banner-title">${escapeHTML(banners[0].title)}</div>
                <div class="sticky-banner-desc">${escapeHTML(banners[0].description)}</div>
                <div class="sticky-banner-price-row"><div class="sticky-banner-price">${formatPrice(banners[0].price)} ₽</div><button class="sticky-banner-btn">ПЕРЕЙТИ</button></div>
            </div>
        </div>` : '';

    document.getElementById('app').innerHTML = `
    <div class="app-container">
        ${bannerHTML}
        <div class="user-header"><div class="user-header-top"><div class="user-avatar" id="btn-profile">${user.avatar ? `<img src="${BUCKET_URL}${user.avatar}" style="width:100%;height:100%;border-radius:15px;object-fit:cover;">` : user.username[0].toUpperCase()}</div><div class="user-greeting"><div class="user-name">${escapeHTML(user.username)}</div><div class="user-role-badge">${user.role==='executor'?'Исполнитель':user.role==='customer'?'Заказчик':'Исполнитель и заказчик'}</div></div><div class="user-rating-mini">★ ${rating}</div></div></div>
        <div class="actions-grid">
            <div class="action-card" id="btn-create"><div class="action-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div class="action-card-title">Создать задание</div></div>
            <div class="action-card" id="btn-my-profile"><div class="action-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="action-card-title">Мой профиль</div></div>
            ${isCreator() ? `<div class="action-card" id="btn-banners-manage"><div class="action-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div><div class="action-card-title">Баннеры</div></div>` : ''}
        </div>
        <div class="bottom-nav">
            <button class="nav-btn active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Главная</button>
            <button class="nav-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>Биржа</button>
            <button class="nav-btn nav-btn-center" id="btn-create-center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Создать</button>
            <button class="nav-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>Мои задания</button>
            <button class="nav-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Профиль</button>
        </div>
    </div>`;
    bindHome();
    if (banners.length > 1) startBannerCarousel();
}

function bindHome() {
    document.getElementById('btn-profile')?.addEventListener('click', () => showProfile());
    document.getElementById('btn-my-profile')?.addEventListener('click', () => showProfile());
    document.getElementById('btn-create')?.addEventListener('click', showCreateModal);
    document.getElementById('btn-create-center')?.addEventListener('click', showCreateModal);
    document.getElementById('btn-banners-manage')?.addEventListener('click', renderBannerManagement);

    document.querySelectorAll('.nav-btn').forEach((b, i) => {
        b.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            if (i === 0) renderHome();
            else if (i === 1) renderBirzha();
            else if (i === 2) showCreateModal();
            else if (i === 3) renderMyTasks();
            else if (i === 4) showProfile();
        });
    });
}

// ==========================================
// БИРЖА (все задания)
// ==========================================
async function renderBirzha() {
    STATE.currentScreen = 'birzha'; stopBannerCarousel();
    await loadTasks();
    const tasks = [...STATE.tasks].filter(t => t.customer_id !== STATE.user?.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let th = '';
    for (const t of tasks) {
        const c = await getUserById(t.customer_id);
        const cr = c ? await getUserRating(c.id) : 0;
        th += `<div class="task-card" data-id="${t.id}" style="position:relative;overflow:hidden;${t.cover ? 'min-height:120px;' : ''}">
            ${t.cover ? `<img src="${BUCKET_URL}${t.cover}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.5);z-index:0;">` : ''}
            <div style="position:relative;z-index:1;">
                <div class="task-top-row"><div class="task-title" style="${t.cover ? 'color:white;text-shadow:0 1px 3px rgba(0,0,0,0.5);' : ''}">${escapeHTML(t.title)}</div><div class="task-price">${formatPrice(t.price)} ₽</div></div>
                <div class="task-desc" style="${t.cover ? 'color:rgba(255,255,255,0.8);' : ''}">${escapeHTML(t.description)}</div>
                <div class="task-meta"><div class="task-customer"><div class="customer-avatar-mini">${c?.avatar ? `<img src="${BUCKET_URL}${c.avatar}" style="width:100%;height:100%;border-radius:9px;object-fit:cover;">` : (c?.username||'?')[0].toUpperCase()}</div><span class="customer-name" style="${t.cover ? 'color:rgba(255,255,255,0.9);' : ''}">${escapeHTML(c?.username||'Пользователь')}</span><span style="color:#F59E0B;font-size:12px;">★ ${cr}</span></div><span class="task-date" style="${t.cover ? 'color:rgba(255,255,255,0.7);' : ''}">${formatDate(t.created_at)}</span></div>
            </div>
        </div>`;
    }

    document.getElementById('app').innerHTML = `
    <div class="app-container">
        <div style="display:flex;gap:8px;margin-bottom:12px;">
            <div style="flex:1;position:relative;"><input class="input-field" id="search-input" placeholder="Поиск по ID или нику..." style="padding-right:40px;"><span style="position:absolute;right:12px;top:14px;color:#999;">🔍</span></div>
            <select class="select-field" id="filter-category" style="width:auto;min-width:130px;"><option value="all">Все</option>${STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</select>
        </div>
        ${STATE.searchResults ? `
            <div style="margin-bottom:12px;"><div class="section-title" style="margin:8px 0;">Результаты поиска</div>
            ${STATE.searchResults.map(u => `
                <div class="task-card" id="search-user-${u.id}" style="cursor:pointer;padding:10px 14px;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div class="customer-avatar-mini" style="width:36px;height:36px;font-size:14px;">${u.avatar ? `<img src="${BUCKET_URL}${u.avatar}" style="width:100%;height:100%;border-radius:9px;object-fit:cover;">` : u.username[0].toUpperCase()}</div>
                        <div style="flex:1;"><div style="font-weight:600;">${escapeHTML(u.username)}</div><div style="font-size:11px;color:#999;">ID: ${u.custom_id}</div></div>
                    </div>
                </div>`).join('')}
            </div>` : ''}
        <div class="section-header"><div class="section-title">Все задания</div><div class="task-count">${tasks.length} заданий</div></div>
        <div>${th || '<div class="empty-state">Нет заданий</div>'}</div>
        <div class="bottom-nav">
            <button class="nav-btn" onclick="renderHome()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Главная</button>
            <button class="nav-btn active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>Биржа</button>
            <button class="nav-btn nav-btn-center" onclick="showCreateModal()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Создать</button>
            <button class="nav-btn" onclick="renderMyTasks()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>Мои задания</button>
            <button class="nav-btn" onclick="showProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Профиль</button>
        </div>
    </div>`;
    document.querySelectorAll('.task-card').forEach(c => c.addEventListener('click', () => showTaskDetail(c.dataset.id)));
    document.querySelectorAll('[id^="search-user-"]').forEach(el => el.addEventListener('click', () => showProfile(el.id.replace('search-user-', ''))));

    let searchTimeout;
    document.getElementById('search-input')?.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        setTimeout(async () => {
            const q = this.value.trim();
            STATE.searchResults = q.length >= 2 ? await searchUsers(q) : null;
            renderBirzha();
        }, 400);
    });

    document.getElementById('filter-category')?.addEventListener('change', async function () {
        const cat = this.value;
        STATE.tasks = cat === 'all' ? (await supabase.from('tasks').select('*').eq('status', 'open').order('created_at', { ascending: false })).data || []
            : (await supabase.from('tasks').select('*').eq('status', 'open').eq('category', cat).order('created_at', { ascending: false })).data || [];
        renderBirzha();
    });
}

// ==========================================
// МОИ ЗАДАНИЯ
// ==========================================
async function renderMyTasks() {
    STATE.currentScreen = 'mytasks'; stopBannerCarousel();
    await loadTasks();
    const my = STATE.myTasks;
    let th = '';
    for (const t of my) {
        th += `<div class="task-card">
            <div class="task-top-row"><div class="task-title">${escapeHTML(t.title)}</div><div class="task-price">${formatPrice(t.price)} ₽</div></div>
            <div class="task-desc">${escapeHTML(t.description)}</div>
            <div class="task-meta"><span class="task-date">${formatDate(t.created_at)}</span><span style="background:#fef2f2;color:#ef4444;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;" class="btn-delete-task" data-id="${t.id}">Удалить</span></div>
        </div>`;
    }
    document.getElementById('app').innerHTML = `
    <div class="app-container">
        <div class="user-header"><div class="user-header-top"><div class="user-name">Мои задания</div><div class="user-role-badge">${my.length} из 5 сегодня</div></div></div>
        <div>${th || '<div class="empty-state">У вас нет заданий</div>'}</div>
        <div class="bottom-nav">
            <button class="nav-btn" onclick="renderHome()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Главная</button>
            <button class="nav-btn" onclick="renderBirzha()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>Биржа</button>
            <button class="nav-btn nav-btn-center" onclick="showCreateModal()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Создать</button>
            <button class="nav-btn active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>Мои задания</button>
            <button class="nav-btn" onclick="showProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Профиль</button>
        </div>
    </div>`;
    document.querySelectorAll('.btn-delete-task').forEach(b => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Удалить задание?')) { await supabase.from('tasks').delete().eq('id', b.dataset.id); await loadTasks(); renderMyTasks(); }
    }));
}

// ==========================================
// УПРАВЛЕНИЕ БАННЕРАМИ
// ==========================================
async function renderBannerManagement() {
    STATE.currentScreen = 'banners'; stopBannerCarousel();
    await loadBanners();
    const active = STATE.banners.filter(b => new Date(b.expires_at) > new Date());
    let bh = '';
    for (const b of active) {
        bh += `<div class="task-card">
            <div class="task-top-row"><div class="task-title">${escapeHTML(b.title)}</div><div class="task-price">${formatPrice(b.price)} ₽</div></div>
            <div class="task-desc">${escapeHTML(b.description)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                <span style="color:#F59E0B;font-weight:600;">⏳ ${formatTimeLeft(b.expires_at)}</span>
                <div><button class="btn-del-banner" data-id="${b.id}" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:8px;font-size:12px;">Удалить</button></div>
            </div>
        </div>`;
    }
    document.getElementById('app').innerHTML = `
    <div class="app-container">
        <button class="btn btn-primary" id="btn-add-banner" style="margin-bottom:12px;">+ ДОБАВИТЬ БАННЕРЫ</button>
        <div>${bh || '<div class="empty-state">Нет активных баннеров</div>'}</div>
        <div class="bottom-nav">
            <button class="nav-btn" onclick="renderHome()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Главная</button>
            <button class="nav-btn" onclick="renderBirzha()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>Биржа</button>
            <button class="nav-btn nav-btn-center" onclick="showCreateModal()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Создать</button>
            <button class="nav-btn" onclick="renderMyTasks()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>Мои задания</button>
            <button class="nav-btn" onclick="showProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Профиль</button>
        </div>
    </div>`;
    document.getElementById('btn-add-banner')?.addEventListener('click', showBannerModal);
    document.querySelectorAll('.btn-del-banner').forEach(b => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Удалить баннер?')) { await supabase.from('banner').delete().eq('id', b.dataset.id); await loadBanners(); renderBannerManagement(); }
    }));
}

// ==========================================
// МОДАЛКИ (СВАЙП-ЗАКРЫТИЕ)
// ==========================================
let touchStartY = 0;
function showModal(title, html) {
    document.querySelectorAll('.modal-overlay').forEach(e => e.remove());
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" id="modal-content"><div class="modal-handle"></div><h2>${title}</h2>${html}</div>`;
    o.addEventListener('click', e => { if (e.target === o) closeModal(); });
    
    const modal = o.querySelector('.modal');
    modal.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; });
    modal.addEventListener('touchmove', e => {
        const diff = e.touches[0].clientY - touchStartY;
        if (diff > 80) closeModal();
    });
    
    document.body.appendChild(o);
}
function closeModal() { document.querySelectorAll('.modal-overlay').forEach(e => { e.style.opacity = '0'; setTimeout(() => e.remove(), 200); }); }

function showCreateModal() {
    showModal('Создать задание', `
        <div class="input-group"><label class="input-label">Обложка</label>
            <div class="image-upload-area" id="task-cover-area" style="height:120px;"><div class="image-upload-placeholder">Загрузить обложку</div></div>
            <input type="file" id="task-cover-input" accept="image/*" style="display:none;">
        </div>
        <div class="input-group"><label class="input-label">Название</label><input class="input-field" id="mt-title" maxlength="200"></div>
        <div class="input-group"><label class="input-label">Категория</label><select class="select-field" id="mt-category">${STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</select></div>
        <div class="input-group"><label class="input-label">Описание</label><textarea class="input-field" id="mt-desc" rows="3" maxlength="2000"></textarea></div>
        <div class="input-group"><label class="input-label">Цена (от 5₽)</label><input class="input-field" id="mt-price" type="number" min="5" placeholder="5000"></div>
        <button class="btn btn-primary" id="btn-submit">ОПУБЛИКОВАТЬ</button><button class="btn btn-outline" onclick="closeModal()">ОТМЕНА</button>
    `);
    let coverFile = null;
    document.getElementById('task-cover-area')?.addEventListener('click', () => document.getElementById('task-cover-input').click());
    document.getElementById('task-cover-input')?.addEventListener('change', e => {
        coverFile = e.target.files[0];
        if (coverFile) { const r = new FileReader(); r.onload = ev => document.getElementById('task-cover-area').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`; r.readAsDataURL(coverFile); }
    });
    document.getElementById('btn-submit').addEventListener('click', async () => {
        const t = document.getElementById('mt-title').value.trim();
        const d = document.getElementById('mt-desc').value.trim();
        const p = parseInt(document.getElementById('mt-price').value);
        const cat = document.getElementById('mt-category').value;
        if (!t || !d || !p || p < 5) { alert('Заполните все поля. Цена от 5₽'); return; }
        const today = new Date(); today.setHours(0,0,0,0);
        const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('customer_id', STATE.user.id).gte('created_at', today.toISOString());
        if (count >= 5) { alert('Лимит 5 заданий в день!'); return; }
        let coverPath = '';
        if (coverFile) coverPath = await uploadImage(coverFile, 'covers/' + Date.now());
        await supabase.from('tasks').insert({ title: t, description: d, price: p, category: cat, cover: coverPath, customer_id: STATE.user.id, status: 'open' });
        closeModal(); loadTasks().then(() => renderHome());
    });
}

function showBannerModal() {
    showModal('Добавить баннеры', `
        <div class="input-group"><label class="input-label">Количество баннеров</label><input class="input-field" id="mb-count" type="number" min="1" max="100" value="1"></div>
        <div id="banner-forms"><div class="banner-form" data-index="0" style="padding:0;">
            <div class="input-group"><label class="input-label">Изображение</label><div class="image-upload-area banner-img-area" style="height:100px;"><div class="image-upload-placeholder">Загрузить</div></div><input type="file" class="banner-img-input" accept="image/*" style="display:none;"></div>
            <div class="input-group"><label class="input-label">Название</label><input class="input-field bf-title"></div>
            <div class="input-group"><label class="input-label">Описание</label><textarea class="input-field bf-desc" rows="2"></textarea></div>
            <div class="input-group"><label class="input-label">Цена (от 5₽)</label><input class="input-field bf-price" type="number" min="5" placeholder="50"></div>
            <div class="input-group"><label class="input-label">Telegram-ссылка</label><input class="input-field bf-link" placeholder="https://t.me/username"></div>
            <hr style="margin:12px 0;border-color:#ddd;">
        </div></div>
        <button class="btn btn-primary" id="btn-save-banners">СОХРАНИТЬ ВСЕ</button><button class="btn btn-outline" onclick="closeModal()">ОТМЕНА</button>
    `);
    const bannerFiles = [];
    document.getElementById('mb-count').addEventListener('change', function () {
        const count = parseInt(this.value) || 1;
        const container = document.getElementById('banner-forms');
        const forms = container.querySelectorAll('.banner-form');
        while (forms.length < count) {
            const clone = forms[0].cloneNode(true);
            clone.dataset.index = forms.length;
            clone.querySelectorAll('input, textarea').forEach(inp => inp.value = '');
            clone.querySelector('.banner-img-area').innerHTML = '<div class="image-upload-placeholder">Загрузить</div>';
            bannerFiles[forms.length] = null;
            container.appendChild(clone);
        }
        while (forms.length > count) { container.removeChild(forms[forms.length - 1]); bannerFiles.pop(); }
        rebindBannerForms();
    });
    function rebindBannerForms() {
        document.querySelectorAll('.banner-form').forEach((form, idx) => {
            if (!bannerFiles[idx]) bannerFiles[idx] = null;
            form.querySelector('.banner-img-area').addEventListener('click', () => form.querySelector('.banner-img-input').click());
            form.querySelector('.banner-img-input').addEventListener('change', function (e) {
                const file = e.target.files[0];
                if (file) { bannerFiles[idx] = file; const r = new FileReader(); r.onload = ev => form.querySelector('.banner-img-area').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`; r.readAsDataURL(file); }
            });
        });
    }
    rebindBannerForms();
    document.getElementById('btn-save-banners').addEventListener('click', async () => {
        const count = parseInt(document.getElementById('mb-count').value) || 1;
        const forms = document.querySelectorAll('.banner-form');
        for (let i = 0; i < count; i++) {
            const f = forms[i];
            const title = f.querySelector('.bf-title').value.trim();
            const desc = f.querySelector('.bf-desc').value.trim();
            const price = parseInt(f.querySelector('.bf-price').value) || 50;
            const link = f.querySelector('.bf-link').value.trim() || 'https://t.me/FBK_MiniBusiness';
            if (!title) { alert(`Баннер ${i+1}: введите название`); return; }
            let imgPath = '';
            if (bannerFiles[i]) imgPath = await uploadImage(bannerFiles[i], 'banners/' + Date.now());
            await supabase.from('banner').insert({ title, description: desc, price, image: imgPath, telegram_link: link, position: i, expires_at: new Date(Date.now() + 86400000).toISOString() });
        }
        closeModal(); loadBanners().then(() => renderBannerManagement());
    });
}

async function showTaskDetail(taskId) {
    const task = STATE.tasks.find(t => t.id == taskId);
    if (!task) return;
    const cust = await getUserById(task.customer_id);
    const rating = cust ? await getUserRating(cust.id) : 0;
    showModal(escapeHTML(task.title), `
        <div style="font-size:24px;font-weight:800;color:#16A34A;margin:8px 0;">${formatPrice(task.price)} ₽</div>
        <p style="color:#555;line-height:1.6;margin-bottom:12px;">${escapeHTML(task.description)}</p>
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#F0FDF4;border-radius:12px;margin-bottom:12px;cursor:pointer;" id="btn-cust" data-cid="${task.customer_id}">
            <div class="customer-avatar-mini" style="width:34px;height:34px;">${cust?.avatar ? `<img src="${BUCKET_URL}${cust.avatar}" style="width:100%;height:100%;border-radius:9px;object-fit:cover;">` : (cust?.username||'?')[0].toUpperCase()}</div>
            <div><div style="font-weight:600;">${escapeHTML(cust?.username||'Пользователь')}</div><div style="color:#F59E0B;">★ ${rating}</div></div>
        </div>
        <button class="btn btn-primary" id="btn-resp">ОТКЛИКНУТЬСЯ</button>
        ${task.customer_id === STATE.user?.id ? '<button class="btn btn-outline" id="btn-review">ОСТАВИТЬ ОТЗЫВ</button>' : ''}
        <button class="btn btn-outline" onclick="closeModal()">ЗАКРЫТЬ</button>
    `);
    document.getElementById('btn-resp')?.addEventListener('click', () => { closeModal(); setTimeout(() => showProfile(task.customer_id), 300); });
    document.getElementById('btn-cust')?.addEventListener('click', () => { closeModal(); setTimeout(() => showProfile(task.customer_id), 300); });
    document.getElementById('btn-review')?.addEventListener('click', () => { closeModal(); setTimeout(() => showReviewModal(taskId), 300); });
}

function showReviewModal(taskId) {
    const task = STATE.tasks.find(t => t.id == taskId);
    if (!task) return;
    showModal('Отзыв', `
        <div class="stars-row" id="stars">${[1,2,3,4,5].map(i => `<button class="star-btn active" data-s="${i}"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></button>`).join('')}</div>
        <div class="input-group"><label class="input-label">Комментарий</label><textarea class="input-field" id="mr-comment" rows="2"></textarea></div>
        <button class="btn btn-primary" id="btn-submit-r">ОСТАВИТЬ</button><button class="btn btn-outline" onclick="closeModal()">ОТМЕНА</button>
    `);
    let rat=5;
    document.querySelectorAll('#stars .star-btn').forEach((b,i)=>{b.addEventListener('click',()=>{rat=i+1;document.querySelectorAll('#stars .star-btn').forEach((x,j)=>x.classList.toggle('active',j<rat));});});
    document.getElementById('btn-submit-r').addEventListener('click',async()=>{
        const c=document.getElementById('mr-comment').value.trim();
        const {error}=await supabase.from('reviews').insert({task_id:taskId,reviewer_id:STATE.user.id,user_id:task.customer_id,rating:rat,comment:c});
        if(error){alert('Ошибка или отзыв уже оставлен.');return;}
        closeModal();renderHome();
    });
}

async function showProfile(uid) {
    const user = uid ? await getUserById(uid) : STATE.user;
    if (!user) return;
    const rating = await getUserRating(user.id);
    const rcount = await getUserReviewCount(user.id);
    const { data: reviews } = await supabase.from('reviews').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
    let rh = '';
    if (reviews) for (const r of reviews) { const rv = await getUserById(r.reviewer_id); rh += `<div class="review-item"><div class="review-header"><span class="review-author">${escapeHTML(rv?.username||'Пользователь')}</span><span class="review-stars-small">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div>${r.comment?`<div class="review-comment">${escapeHTML(r.comment)}</div>`:''}</div>`; }
    const self = user.id === STATE.user?.id;
    showModal('Профиль', `
        <div class="profile-card">
            <div class="profile-avatar-large">${user.avatar ? `<img src="${BUCKET_URL}${user.avatar}" style="width:100%;height:100%;border-radius:20px;object-fit:cover;">` : user.username[0].toUpperCase()}</div>
            <div class="profile-name">${escapeHTML(user.username)}</div>
            <div class="profile-role">${user.role==='executor'?'Исполнитель':user.role==='customer'?'Заказчик':'Исполнитель и заказчик'}</div>
            ${user.description?`<div class="profile-desc">${escapeHTML(user.description)}</div>`:''}
            <div class="profile-rating-display">★ ${rating} (${rcount} отзывов)</div>
            <div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <span style="background:#F0FDF4;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;">ID: ${user.custom_id||'Нет'}</span>
                <span style="background:#4ADE80;color:white;padding:6px 12px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-copy-id-profile">📋 Копировать ID</span>
                ${user.telegram_username?`<span style="background:#E0F2FE;padding:6px 12px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-open-tg">@${user.telegram_username}</span>`:''}
            </div>
            <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
                <div style="background:#F8FAFC;padding:8px;border-radius:8px;">📤 Откликов: <b>${user.tasks_responded||0}</b></div>
                <div style="background:#F8FAFC;padding:8px;border-radius:8px;">✅ Выполнено: <b>${user.tasks_completed||0}</b></div>
            </div>
        </div>
        <div style="font-weight:700;margin:12px 0;">Отзывы</div>${rh||'<div class="empty-state">Нет отзывов</div>'}
        ${self?`<button class="btn btn-outline" id="btn-change-avatar" style="margin-top:8px;">СМЕНИТЬ АВАТАРКУ</button><button class="btn btn-outline" id="btn-logout" style="color:#ef4444;">ВЫЙТИ</button>`:''}
        <button class="btn btn-outline" onclick="closeModal()">ЗАКРЫТЬ</button>
    `);
    document.getElementById('btn-logout')?.addEventListener('click',()=>{closeModal();logout();});
    document.getElementById('btn-copy-id-profile')?.addEventListener('click',()=>{
        navigator.clipboard?.writeText(user.custom_id);
        alert('ID скопирован: '+user.custom_id);
    });
    document.getElementById('btn-open-tg')?.addEventListener('click',()=>{window.open('https://t.me/'+user.telegram_username,'_blank');});
    document.getElementById('btn-change-avatar')?.addEventListener('click',()=>{
        const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
        inp.addEventListener('change',async e=>{
            const f=e.target.files[0];if(!f)return;
            const path=await uploadImage(f,'avatars/'+STATE.user.phone);
            if(path){await supabase.from('users').update({avatar:path}).eq('id',STATE.user.id);STATE.user.avatar=path;localStorage.setItem('gfUser',JSON.stringify(STATE.user));closeModal();showProfile();}
        });
        inp.click();
    });
}

(async function(){await loadUser();render();})();
