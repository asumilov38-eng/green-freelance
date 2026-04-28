"use strict";

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#16A34A'); tg.setBackgroundColor('#F0FDF4'); }

var supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
const BANNER_INTERVAL = 10;
const BUCKET_URL = window.SUPABASE_URL + '/storage/v1/object/public/images/';

const STATE = {
    isLoggedIn: false, user: null, tasks: [], myTasks: [], usersCache: {},
    banners: [], currentBanner: 0, bannerTimer: null,
    currentScreen: 'home', categories: [], searchResults: null
};

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

async function loadAllData() { await Promise.all([loadTasks(), loadBanners()]); }

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
    return Math.floor(diff / 3600000) + 'ч ' + Math.floor((diff % 3600000) / 60000) + 'мин';
}
function escapeHTML(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function isCreator() { return STATE.user?.phone === '+79049584282' || STATE.user?.custom_id === 'GF-000-777'; }

function startBannerCarousel() {
    stopBannerCarousel();
    if (STATE.banners.length <= 1) return;
    STATE.currentBanner = 0;
    STATE.bannerTimer = setInterval(() => {
        STATE.currentBanner = (STATE.currentBanner + 1) % STATE.banners.length;
        updateBannerDisplay();
    }, BANNER_INTERVAL * 1000);
}
function stopBannerCarousel() { if (STATE.bannerTimer) { clearInterval(STATE.bannerTimer); STATE.bannerTimer = null; } }

function updateBannerDisplay() {
    const el = document.getElementById('sticky-banner');
    if (!el || !STATE.banners.length) return;
    const b = STATE.banners[STATE.currentBanner];
    const imgEl = el.querySelector('.sticky-banner-image');
    if (imgEl) {
    if (b.image) {
        imgEl.src = BUCKET_URL + b.image;
        imgEl.style.display = 'block';
        el.querySelector('.sticky-banner-body').style.position = 'relative';
        el.querySelector('.sticky-banner-body').style.zIndex = '1';
        if (el.querySelector('.sticky-banner-title')) el.querySelector('.sticky-banner-title').style.color = 'white';
        if (el.querySelector('.sticky-banner-desc')) el.querySelector('.sticky-banner-desc').style.color = 'rgba(255,255,255,0.85)';
        if (el.querySelector('.sticky-banner-price')) el.querySelector('.sticky-banner-price').style.color = 'white';
    } else {
        imgEl.style.display = 'none';
        if (el.querySelector('.sticky-banner-title')) el.querySelector('.sticky-banner-title').style.color = '';
        if (el.querySelector('.sticky-banner-desc')) el.querySelector('.sticky-banner-desc').style.color = '';
        if (el.querySelector('.sticky-banner-price')) el.querySelector('.sticky-banner-price').style.color = '';
    }
}
    const titleEl = el.querySelector('.sticky-banner-title');
    if (titleEl) titleEl.textContent = b.title;
    const descEl = el.querySelector('.sticky-banner-desc');
    if (descEl) descEl.textContent = b.description;
    const priceEl = el.querySelector('.sticky-banner-price');
    if (priceEl) priceEl.textContent = formatPrice(b.price) + ' ₽';
    
    // Обновляем кнопку ПЕРЕЙТИ
    const btnEl = el.querySelector('.sticky-banner-btn');
    if (btnEl) {
        btnEl.onclick = function(e) {
            e.stopPropagation();
            window.open(b.telegram_link || 'https://t.me/FBK_MiniBusiness', '_blank');
        };
    }
}

async function deleteExpiredBanners() {
    const { data } = await supabase.from('banner').select('id').lte('expires_at', new Date().toISOString());
    if (data?.length) for (const b of data) await supabase.from('banner').delete().eq('id', b.id);
}

async function uploadImage(file, path) {
    const ext = file.name.split('.').pop();
    const fileName = path + '_' + Date.now() + '.' + ext;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file, { upsert: true });
    if (error) { alert('Ошибка загрузки: ' + error.message); return null; }
    return data?.path || fileName;
}

function render() {
    document.getElementById('app').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#16A34A;font-weight:600;">Загрузка...</div>';
    STATE.isLoggedIn ? loadAllData().then(() => { deleteExpiredBanners(); renderHome(); }) : renderAuth();
}

function renderAuth() {
    document.getElementById('app').innerHTML = `<div class="app-container auth-screen">
        <div class="auth-header"><div class="auth-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" stroke="white" fill="none" stroke-width="2"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" fill="none" stroke-width="2"/></svg></div><h1 class="auth-title">GreenFreelance</h1><p class="auth-subtitle">Биржа фриланса</p></div>
        <div class="auth-form-container" id="reg-form">
            <div class="form-title">Регистрация</div>
            <div class="input-group"><label class="input-label">Телефон</label><input class="input-field" id="reg-phone" placeholder="+79049584282"></div>
            <div class="input-group"><label class="input-label">Пароль</label><input class="input-field" type="password" id="reg-pass" placeholder="Минимум 4 символа"></div>
            <div class="input-group"><label class="input-label">Никнейм</label><input class="input-field" id="reg-nick" placeholder="Ваш ник"></div>
            <div class="input-group"><label class="input-label">Описание</label><input class="input-field" id="reg-desc" placeholder="О себе"></div>
            <div class="input-group"><label class="input-label">Аватарка</label><div class="image-upload-area" id="reg-avatar" style="height:100px;"><div class="image-upload-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="#bbb" width="24"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>Загрузить</div></div><input type="file" id="reg-avatar-input" accept="image/*" style="display:none;"></div>
            <div class="input-group"><label class="input-label">Роль</label><select class="select-field" id="reg-role"><option value="executor">Исполнитель</option><option value="customer">Заказчик</option><option value="both">Исполнитель и заказчик</option></select></div>
            <button class="btn btn-primary" id="btn-reg">СОЗДАТЬ АККАУНТ</button>
            <p class="link-text">Уже есть аккаунт? <span id="show-login">Войти</span></p>
        </div>
        <div class="auth-form-container" id="login-form" style="display:none;">
            <div class="form-title">Вход</div>
            <div class="input-group"><label class="input-label">Телефон</label><input class="input-field" id="login-phone" placeholder="+79049584282"></div>
            <div class="input-group"><label class="input-label">Пароль</label><input class="input-field" type="password" id="login-pass"></div>
            <button class="btn btn-primary" id="btn-login">ВОЙТИ</button>
            <p class="link-text">Нет аккаунта? <span id="show-reg">Регистрация</span></p>
        </div>
    </div>`;
    bindAuth();
}

function bindAuth() {
    let avatarFile = null;
    document.getElementById('reg-avatar')?.addEventListener('click', () => document.getElementById('reg-avatar-input').click());
    document.getElementById('reg-avatar-input')?.addEventListener('change', e => {
        avatarFile = e.target.files[0];
        if (avatarFile) { const r = new FileReader(); r.onload = ev => document.getElementById('reg-avatar').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`; r.readAsDataURL(avatarFile); }
    });
    document.getElementById('btn-reg')?.addEventListener('click', async () => {
        const ph = document.getElementById('reg-phone').value.trim();
        const pw = document.getElementById('reg-pass').value.trim();
        const nn = document.getElementById('reg-nick').value.trim();
        const ds = document.getElementById('reg-desc').value.trim();
        const rl = document.getElementById('reg-role').value;
        if (!ph||!pw||!nn) { alert('Заполните поля!'); return; }
        let tgUser = tg?.initDataUnsafe?.user?.username || '';
        let avatarPath = '';
        if (avatarFile) avatarPath = await uploadImage(avatarFile, 'avatars/' + Date.now());
        const { data, error } = await supabase.from('users').insert({ phone: ph, password: pw, username: nn, description: ds, role: rl, avatar: avatarPath, telegram_username: tgUser }).select().single();
        if (error) { alert('Ошибка: ' + error.message); return; }
        STATE.user = data; STATE.isLoggedIn = true;
        localStorage.setItem('gfUser', JSON.stringify(data));
        render();
    });
    document.getElementById('btn-login')?.addEventListener('click', async () => {
        const ph = document.getElementById('login-phone').value.trim();
        const pw = document.getElementById('login-pass').value.trim();
        const { data } = await supabase.from('users').select('*').eq('phone', ph).eq('password', pw).maybeSingle();
        if (!data) { alert('Неверные данные!'); return; }
        STATE.user = data; STATE.isLoggedIn = true;
        localStorage.setItem('gfUser', JSON.stringify(data));
        render();
    });
    document.getElementById('show-login')?.addEventListener('click', () => { document.getElementById('reg-form').style.display='none'; document.getElementById('login-form').style.display='block'; });
    document.getElementById('show-reg')?.addEventListener('click', () => { document.getElementById('login-form').style.display='none'; document.getElementById('reg-form').style.display='block'; });
}

function logout() { STATE.isLoggedIn = false; STATE.user = null; localStorage.removeItem('gfUser'); stopBannerCarousel(); render(); }

function showModal(title, html) {
    document.querySelectorAll('.modal-overlay').forEach(e => e.remove());
    const o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><h2 style="margin:0;">${title}</h2><span style="font-size:24px;cursor:pointer;color:#999;line-height:1;" onclick="closeModal()">✕</span></div>${html}</div>`;
    o.addEventListener('click', e => { if (e.target === o) closeModal(); });
    document.body.appendChild(o);
}
function closeModal() { document.querySelectorAll('.modal-overlay').forEach(e => { e.style.opacity = '0'; setTimeout(() => e.remove(), 200); }); }

function showCreateModal() {
    showModal('Создать задание', `
        <div class="input-group"><label class="input-label">Обложка</label><div class="image-upload-area" id="cover-area" style="height:140px;"><div class="image-upload-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="#bbb" width="28"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div style="margin-top:4px;">Загрузить обложку</div></div></div><input type="file" id="cover-input" accept="image/*" style="display:none;"></div>
        <div class="input-group"><label class="input-label">Название</label><input class="input-field" id="mt-title" maxlength="200"></div>
        <div class="input-group"><label class="input-label">Описание</label><textarea class="input-field" id="mt-desc" rows="3" maxlength="2000"></textarea></div>
        <div class="input-group"><label class="input-label">Цена (от 5₽)</label><input class="input-field" id="mt-price" type="number" min="5" placeholder="5000"></div>
        <button class="btn btn-primary" id="btn-submit">ОПУБЛИКОВАТЬ</button>
    `);
    let cf = null;
    document.getElementById('cover-area')?.addEventListener('click', () => document.getElementById('cover-input').click());
    document.getElementById('cover-input')?.addEventListener('change', e => { cf = e.target.files[0]; if (cf) { const r = new FileReader(); r.onload = ev => document.getElementById('cover-area').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`; r.readAsDataURL(cf); } });
    document.getElementById('btn-submit').addEventListener('click', async () => {
        const t = document.getElementById('mt-title').value.trim();
        const d = document.getElementById('mt-desc').value.trim();
        const p = parseInt(document.getElementById('mt-price').value);
        if (!t||!d||!p||p<5) { alert('Заполните поля!'); return; }
        let cover = '';
        if (cf) cover = await uploadImage(cf, 'covers/' + Date.now());
        await supabase.from('tasks').insert({ title: t, description: d, price: p, cover, customer_id: STATE.user.id, status: 'open' });
        closeModal(); loadAllData().then(() => renderHome());
    });
}

function showBannerModal() {
    showModal('Добавить баннер', `
        <div class="input-group"><label class="input-label">Изображение (необязательно)</label><div class="image-upload-area" id="b-img" style="height:120px;"><div class="image-upload-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="#bbb" width="28"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div style="margin-top:4px;">Загрузить</div></div></div><input type="file" id="b-img-input" accept="image/*" style="display:none;"></div>
        <div class="input-group"><label class="input-label">Название</label><input class="input-field" id="mb-title"></div>
        <div class="input-group"><label class="input-label">Описание</label><textarea class="input-field" id="mb-desc" rows="2"></textarea></div>
        <div class="input-group"><label class="input-label">Цена (от 5₽)</label><input class="input-field" id="mb-price" type="number" min="5" placeholder="50"></div>
        <div class="input-group"><label class="input-label">Telegram-ссылка</label><input class="input-field" id="mb-link" placeholder="https://t.me/username"></div>
        <button class="btn btn-primary" id="btn-save">СОХРАНИТЬ</button>
    `);
    let bf = null;
    document.getElementById('b-img')?.addEventListener('click', () => document.getElementById('b-img-input').click());
    document.getElementById('b-img-input')?.addEventListener('change', e => { bf = e.target.files[0]; if (bf) { const r = new FileReader(); r.onload = ev => document.getElementById('b-img').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`; r.readAsDataURL(bf); } });
    document.getElementById('btn-save').addEventListener('click', async () => {
        const title = document.getElementById('mb-title').value.trim();
        const desc = document.getElementById('mb-desc').value.trim();
        const price = parseInt(document.getElementById('mb-price').value) || 50;
        const link = document.getElementById('mb-link').value.trim() || 'https://t.me/FBK_MiniBusiness';
        if (!title) { alert('Введите название!'); return; }
        
        let img = '';
        if (bf) {
            img = await uploadImage(bf, 'banners/' + Date.now());
            if (!img) { alert('Ошибка загрузки изображения!'); return; }
        }
        
        const { error } = await supabase.from('banner').insert({ 
            title: title, 
            description: desc, 
            price: price, 
            telegram_link: link, 
            image: img, 
            position: STATE.banners.length, 
            expires_at: new Date(Date.now() + 86400000).toISOString() 
        });
        
        if (error) { alert('Ошибка сохранения: ' + error.message); return; }
        
        await loadBanners();
        closeModal();
        renderHome();
    });
}

// ==========================================
// НАВИГАЦИЯ (фиксированная, без дрожания)
// ==========================================
function renderNav(screen) {
    const screens = ['home','birzha','create','mytasks','profile'];
    const icons = [
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    ];
    const labels = ['Главная','Биржа','','Мои','Профиль'];
    const idx = screens.indexOf(screen);
    let html = '';
    for (let i = 0; i < 5; i++) {
        const isCenter = i === 2;
        html += `<button class="nav-btn ${isCenter ? 'nav-btn-center' : ''} ${i === idx ? 'active' : ''}" data-screen="${screens[i]}">${icons[i]}${isCenter ? '' : `<span>${labels[i]}</span>`}</button>`;
    }
    return `<div class="bottom-nav">${html}</div>`;
}

function bindNav(screen) {
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.addEventListener('click', () => {
            const s = b.dataset.screen;
            if (s === 'home') renderHome();
            else if (s === 'birzha') renderBirzha();
            else if (s === 'create') showCreateModal();
            else if (s === 'mytasks') renderMyTasks();
            else if (s === 'profile') showProfile();
        });
    });
}

async function renderHome() {
    STATE.currentScreen = 'home'; stopBannerCarousel();
    await loadAllData(); await deleteExpiredBanners();
    const u = STATE.user;
    const rating = await getUserRating(u.id);
    
    document.getElementById('app').innerHTML = `<div class="app-container">
        <div class="user-header"><div class="user-header-top"><div class="user-avatar" id="btn-profile">${u.avatar?`<img src="${BUCKET_URL}${u.avatar}" style="width:100%;height:100%;border-radius:15px;object-fit:cover;">`:u.username[0].toUpperCase()}</div><div class="user-greeting"><div class="user-name">${escapeHTML(u.username)}</div><div class="user-role-badge">${u.role==='executor'?'Исполнитель':u.role==='customer'?'Заказчик':'Исполнитель и заказчик'}</div></div><div class="user-rating-mini">★ ${rating}</div></div></div>
        <div class="actions-grid">
            <div class="action-card" id="btn-create"><div class="action-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div class="action-card-title">Создать задание</div></div>
            <div class="action-card" id="btn-my-profile"><div class="action-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg></div><div class="action-card-title">Мой профиль</div></div>
            ${isCreator()?`<div class="action-card" id="btn-banners"><div class="action-card-icon" style="background:#4ADE80;"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div><div class="action-card-title">Баннеры</div></div>`:''}
        </div>
        ${renderNav('home')}
    </div>`;
    bindNav('home');
    if (STATE.banners.length > 1) startBannerCarousel();
    document.getElementById('btn-profile')?.addEventListener('click', () => showProfile());
    document.getElementById('btn-my-profile')?.addEventListener('click', () => showProfile());
    document.getElementById('btn-create')?.addEventListener('click', showCreateModal);
    document.getElementById('btn-banners')?.addEventListener('click', renderBannerManagement);
}

async function renderBirzha() {
    STATE.currentScreen = 'birzha'; stopBannerCarousel();
    await loadBanners(); await loadTasks();
    const tasks = STATE.tasks;
    
    const bannerHTML = STATE.banners.length ? `<div class="sticky-banner" id="sticky-banner" style="position:relative;overflow:hidden;">${STATE.banners[0]?.image?`<img class="sticky-banner-image" src="${BUCKET_URL}${STATE.banners[0].image}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.4);z-index:0;">`:''}<div class="sticky-banner-body" style="position:relative;z-index:1;">${STATE.banners[0]?.image?`<div class="sticky-banner-title" style="color:white;text-shadow:0 1px 3px rgba(0,0,0,0.6);">${escapeHTML(STATE.banners[0]?.title||'')}</div><div class="sticky-banner-desc" style="color:rgba(255,255,255,0.85);">${escapeHTML(STATE.banners[0]?.description||'')}</div>`:`<div class="sticky-banner-title">${escapeHTML(STATE.banners[0]?.title||'')}</div><div class="sticky-banner-desc">${escapeHTML(STATE.banners[0]?.description||'')}</div>`}<div class="sticky-banner-price-row"><div class="sticky-banner-price" style="${STATE.banners[0]?.image?'color:white;':''}">${formatPrice(STATE.banners[0]?.price||0)} ₽</div><button class="sticky-banner-btn" id="btn-banner-go">ПЕРЕЙТИ</button></div></div></div>` : '';
    
    let th = '';
    for (const t of tasks) {
        const c = await getUserById(t.customer_id);
        const cr = c ? await getUserRating(c.id) : 0;
        th += `<div class="task-card" data-id="${t.id}" style="position:relative;overflow:hidden;${t.cover ? 'min-height:130px;' : ''}">
            ${t.cover ? `<img src="${BUCKET_URL}${t.cover}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.35);z-index:0;">` : ''}
            <div style="position:relative;z-index:1;">
                <div class="task-top-row"><div class="task-title" style="${t.cover ? 'color:white;text-shadow:0 1px 3px rgba(0,0,0,0.6);' : ''}">${escapeHTML(t.title)}</div><div class="task-price">${formatPrice(t.price)} ₽</div></div>
                <div class="task-desc" style="${t.cover ? 'color:rgba(255,255,255,0.85);' : ''}">${escapeHTML(t.description)}</div>
                <div class="task-meta"><div class="task-customer"><div class="customer-avatar-mini">${c?.avatar ? `<img src="${BUCKET_URL}${c.avatar}" style="width:100%;height:100%;border-radius:9px;object-fit:cover;">` : (c?.username || '?')[0].toUpperCase()}</div><span class="customer-name" style="${t.cover ? 'color:rgba(255,255,255,0.9);' : ''}">${escapeHTML(c?.username || 'Пользователь')}</span><span style="color:#F59E0B;font-size:12px;">★ ${cr}</span></div><span class="task-date" style="${t.cover ? 'color:rgba(255,255,255,0.7);' : ''}">${formatDate(t.created_at)}</span></div>
            </div>
        </div>`;
    }
    document.getElementById('app').innerHTML = `<div class="app-container">
        ${bannerHTML}
        <div class="section-header"><div class="section-title">Все задания</div><div class="task-count">${tasks.length} заданий</div></div>
        <div>${th || '<div class="empty-state">Нет заданий</div>'}</div>
        ${renderNav('birzha')}
    </div>`;
    bindNav('birzha');
    
    // Кнопка ПЕРЕЙТИ в баннере
    document.getElementById('btn-banner-go')?.addEventListener('click', function(e) {
        e.stopPropagation();
        var link = STATE.banners[STATE.currentBanner]?.telegram_link || 'https://t.me/FBK_MiniBusiness';
        window.open(link, '_blank');
    });
    
    // Карусель баннеров
    if (STATE.banners.length > 1) startBannerCarousel();
    
    document.querySelectorAll('.task-card').forEach(c => c.addEventListener('click', () => showTaskDetail(c.dataset.id)));
}

async function renderMyTasks() {
    STATE.currentScreen = 'mytasks'; stopBannerCarousel();
    await loadTasks();
    let th = '';
    for (const t of STATE.myTasks) {
        th += `<div class="task-card" style="position:relative;overflow:hidden;${t.cover ? 'min-height:130px;' : ''}">
            ${t.cover ? `<img src="${BUCKET_URL}${t.cover}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.35);z-index:0;">` : ''}
            <div style="position:relative;z-index:1;">
                <div class="task-top-row"><div class="task-title" style="${t.cover ? 'color:white;text-shadow:0 1px 3px rgba(0,0,0,0.6);' : ''}">${escapeHTML(t.title)}</div><div class="task-price">${formatPrice(t.price)} ₽</div></div>
                <div class="task-desc" style="${t.cover ? 'color:rgba(255,255,255,0.85);' : ''}">${escapeHTML(t.description)}</div>
                <div class="task-meta"><span class="task-date" style="${t.cover ? 'color:rgba(255,255,255,0.7);' : ''}">${formatDate(t.created_at)}</span><span style="background:#fef2f2;color:#ef4444;padding:4px 10px;border-radius:8px;font-size:12px;cursor:pointer;" class="btn-del" data-id="${t.id}">Удалить</span></div>
            </div>
        </div>`;
    }
    document.getElementById('app').innerHTML = `<div class="app-container">
        <div class="user-header"><div class="user-name" style="color:white;font-weight:700;font-size:18px;">Мои задания</div></div>
        <div>${th || '<div class="empty-state">Нет заданий</div>'}</div>
        ${renderNav('mytasks')}
    </div>`;
    bindNav('mytasks');
    document.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', async e => { e.stopPropagation(); if (confirm('Удалить?')) { await supabase.from('tasks').delete().eq('id', b.dataset.id); await loadTasks(); renderMyTasks(); } }));
}

async function renderBannerManagement() {
    STATE.currentScreen = 'banners'; stopBannerCarousel();
    await loadBanners();
    const active = STATE.banners.filter(b => new Date(b.expires_at) > new Date());
    let bh = '';
    for (const b of active) {
        bh += `<div class="task-card"><div class="task-top-row"><div class="task-title">${escapeHTML(b.title)}</div><div class="task-price">${formatPrice(b.price)} ₽</div></div><div class="task-desc">${escapeHTML(b.description)}<br>${b.telegram_link ? `<span style="color:#4ADE80;">@${b.telegram_link.replace('https://t.me/','')}</span>` : ''}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;"><span style="color:#F59E0B;font-weight:600;">${formatTimeLeft(b.expires_at)}</span><button class="btn-del" data-id="${b.id}" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:8px;font-size:12px;">Удалить</button></div></div>`;
    }
    document.getElementById('app').innerHTML = `<div class="app-container">
        <button class="btn btn-primary" id="btn-add" style="margin-bottom:12px;">+ ДОБАВИТЬ БАННЕР</button>
        <div>${bh || '<div class="empty-state">Нет баннеров</div>'}</div>
        ${renderNav('profile')}
    </div>`;
    bindNav('profile');
    document.getElementById('btn-add')?.addEventListener('click', showBannerModal);
    document.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', async e => { e.stopPropagation(); if (confirm('Удалить?')) { await supabase.from('banner').delete().eq('id', b.dataset.id); await loadBanners(); renderBannerManagement(); } }));
}

async function showTaskDetail(taskId) {
    const t = STATE.tasks.find(x => x.id == taskId); if (!t) return;
    const c = await getUserById(t.customer_id);
    const r = c ? await getUserRating(c.id) : 0;
    showModal(escapeHTML(t.title), `
        ${t.cover ? `<div style="width:100%;height:180px;border-radius:12px;overflow:hidden;margin-bottom:12px;"><img src="${BUCKET_URL}${t.cover}" style="width:100%;height:100%;object-fit:cover;"></div>` : ''}
        <div style="font-size:24px;font-weight:800;color:#16A34A;margin:8px 0;">${formatPrice(t.price)} ₽</div>
        <p style="color:#555;line-height:1.6;margin-bottom:12px;">${escapeHTML(t.description)}</p>
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#F0FDF4;border-radius:12px;margin-bottom:12px;cursor:pointer;" id="btn-cust">
            <div class="customer-avatar-mini" style="width:34px;height:34px;">${c?.avatar ? `<img src="${BUCKET_URL}${c.avatar}" style="width:100%;height:100%;border-radius:9px;object-fit:cover;">` : (c?.username || '?')[0].toUpperCase()}</div>
            <div><div style="font-weight:600;">${escapeHTML(c?.username || 'Пользователь')}</div><div style="color:#F59E0B;">★ ${r}</div></div>
        </div>
        <button class="btn btn-primary" id="btn-resp">ОТКЛИКНУТЬСЯ</button>
    `);
    document.getElementById('btn-resp')?.addEventListener('click', () => { closeModal(); setTimeout(() => showProfile(t.customer_id), 300); });
    document.getElementById('btn-cust')?.addEventListener('click', () => { closeModal(); setTimeout(() => showProfile(t.customer_id), 300); });
}

async function showProfile(uid) {
    const u = uid ? await getUserById(uid) : STATE.user; if (!u) return;
    const rating = await getUserRating(u.id);
    const { data: reviews } = await supabase.from('reviews').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(20);
    let rh = '';
    if (reviews) for (const r of reviews) { const rv = await getUserById(r.reviewer_id); rh += `<div class="review-item"><div class="review-header"><span>${escapeHTML(rv?.username || 'Пользователь')}</span><span style="color:#FBBF24;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></div>${r.comment ? `<div>${escapeHTML(r.comment)}</div>` : ''}</div>`; }
    const self = u.id === STATE.user?.id;
    showModal('Профиль', `<div class="profile-card">
        <div class="profile-avatar-large">${u.avatar ? `<img src="${BUCKET_URL}${u.avatar}" style="width:100%;height:100%;border-radius:20px;object-fit:cover;">` : u.username[0].toUpperCase()}</div>
        <div class="profile-name">${escapeHTML(u.username)}</div>
        <div class="profile-role">${u.role === 'executor' ? 'Исполнитель' : u.role === 'customer' ? 'Заказчик' : 'Исполнитель и заказчик'}</div>
        ${u.description ? `<div class="profile-desc">${escapeHTML(u.description)}</div>` : ''}
        <div class="profile-rating-display">★ ${rating}</div>
        <div style="margin-top:8px;"><span style="background:#F0FDF4;padding:6px 12px;border-radius:8px;">ID: ${u.custom_id || 'Нет'}</span></div>
        <div style="margin-top:6px;display:flex;gap:6px;justify-content:center;">
            <span style="background:#4ADE80;color:white;padding:6px 14px;border-radius:8px;cursor:pointer;" id="btn-copy">Копировать ID</span>
            ${u.telegram_username ? `<span style="background:#E0F2FE;padding:6px 14px;border-radius:8px;cursor:pointer;" id="btn-tg">@${u.telegram_username}</span>` : ''}
        </div>
    </div>
    <div style="font-weight:700;margin:12px 0;">Отзывы</div>${rh || '<div class="empty-state">Нет отзывов</div>'}
    ${self ? `<button class="btn btn-outline" id="btn-avatar">СМЕНИТЬ АВАТАРКУ</button><button class="btn btn-outline" id="btn-logout" style="color:#ef4444;">ВЫЙТИ</button>` : ''}`);
    document.getElementById('btn-copy')?.addEventListener('click', () => { navigator.clipboard?.writeText(u.custom_id); alert('ID скопирован: ' + u.custom_id); });
    document.getElementById('btn-tg')?.addEventListener('click', () => window.open('https://t.me/' + u.telegram_username, '_blank'));
    document.getElementById('btn-logout')?.addEventListener('click', () => { closeModal(); logout(); });
    document.getElementById('btn-avatar')?.addEventListener('click', () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.addEventListener('change', async e => {
            const f = e.target.files[0]; if (!f) return;
            const path = await uploadImage(f, 'avatars/' + Date.now());
            if (path) { await supabase.from('users').update({ avatar: path }).eq('id', STATE.user.id); STATE.user.avatar = path; localStorage.setItem('gfUser', JSON.stringify(STATE.user)); closeModal(); showProfile(); }
        }); inp.click();
    });
}

(async function () { await loadUser(); render(); })();
