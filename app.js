// ==========================================
// GREENFREELANCE - ЧИСТАЯ ВЕРСИЯ
// ==========================================

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#16A34A');
    tg.setBackgroundColor('#F0FDF4');
    tg.MainButton.hide();
}

// ID создателя (ваш номер телефона)
const CREATOR_PHONE = '+79049584282';

// Состояние
const STATE = {
    isLoggedIn: false,
    user: null,
    users: [],
    tasks: [],
    reviews: [],
    stickyBanner: null, // Рекламный баннер (может создать только создатель)
};

// Загрузка данных
function loadData() {
    const data = localStorage.getItem('gfData');
    if (data) {
        const parsed = JSON.parse(data);
        STATE.users = parsed.users || [];
        STATE.tasks = parsed.tasks || [];
        STATE.reviews = parsed.reviews || [];
        STATE.stickyBanner = parsed.stickyBanner || null;
    }
    
    const savedUser = localStorage.getItem('gfUser');
    if (savedUser) {
        STATE.user = JSON.parse(savedUser);
        STATE.isLoggedIn = true;
    }
}

function saveAllData() {
    localStorage.setItem('gfData', JSON.stringify({
        users: STATE.users,
        tasks: STATE.tasks,
        reviews: STATE.reviews,
        stickyBanner: STATE.stickyBanner,
    }));
}

function saveUser() {
    if (STATE.user) localStorage.setItem('gfUser', JSON.stringify(STATE.user));
}

function genId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function findUser(id) {
    return STATE.users.find(u => u.id === id) || null;
}

function findTask(id) {
    return STATE.tasks.find(t => t.id === id) || null;
}

function getUserRating(userId) {
    const reviews = STATE.reviews.filter(r => r.userId === userId);
    if (reviews.length === 0) return 0;
    return Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
}

function formatPrice(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDate(ts) {
    const diff = Date.now() - ts;
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    return new Date(ts).toLocaleDateString('ru-RU');
}

function isCreator() {
    return STATE.user && STATE.user.phone === CREATOR_PHONE;
}

// ==========================================
// РЕНДЕР
// ==========================================
function render() {
    const app = document.getElementById('app');
    if (!STATE.isLoggedIn) {
        app.innerHTML = renderAuth();
    } else {
        app.innerHTML = renderMain();
    }
    bindEvents();
}

// ==========================================
// АВТОРИЗАЦИЯ
// ==========================================
function renderAuth() {
    return `
    <div class="app-container auth-screen">
        <div class="auth-header">
            <div class="auth-icon">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="9" cy="7" r="4" stroke="white" stroke-width="2"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <h1 class="auth-title">GreenFreelance</h1>
            <p class="auth-subtitle">Биржа фриланса</p>
        </div>
        
        <div class="auth-form-container" id="reg-form">
            <div class="form-title">Регистрация</div>
            <div class="input-group">
                <label class="input-label">Номер телефона</label>
                <input class="input-field" type="tel" id="reg-phone" placeholder="+7 (000) 000-00-00">
            </div>
            <div class="input-group">
                <label class="input-label">Пароль</label>
                <input class="input-field" type="password" id="reg-pass" placeholder="Придумайте пароль">
            </div>
            <div class="input-group">
                <label class="input-label">Никнейм</label>
                <input class="input-field" type="text" id="reg-nick" placeholder="Ваш никнейм">
            </div>
            <div class="input-group">
                <label class="input-label">Описание</label>
                <input class="input-field" type="text" id="reg-desc" placeholder="Например: Дизайнер, 5 лет опыта">
            </div>
            <div class="input-group">
                <label class="input-label">Роль</label>
                <select class="select-field" id="reg-role">
                    <option value="executor">Исполнитель</option>
                    <option value="customer">Заказчик</option>
                    <option value="both">Исполнитель и заказчик</option>
                </select>
            </div>
            <button class="btn btn-primary" id="btn-reg">СОЗДАТЬ АККАУНТ</button>
            <p class="link-text">Уже есть аккаунт? <span id="show-login">Войти</span></p>
        </div>
        
        <div class="auth-form-container" id="login-form" style="display:none;">
            <div class="form-title">Вход</div>
            <div class="input-group">
                <label class="input-label">Номер телефона</label>
                <input class="input-field" type="tel" id="login-phone" placeholder="+7 (000) 000-00-00">
            </div>
            <div class="input-group">
                <label class="input-label">Пароль</label>
                <input class="input-field" type="password" id="login-pass" placeholder="Ваш пароль">
            </div>
            <button class="btn btn-primary" id="btn-login">ВОЙТИ</button>
            <p class="link-text">Нет аккаунта? <span id="show-reg">Зарегистрироваться</span></p>
        </div>
    </div>`;
}

// ==========================================
// ГЛАВНЫЙ ЭКРАН
// ==========================================
function renderMain() {
    const user = STATE.user;
    const rating = getUserRating(user.id);
    const reviewCount = STATE.reviews.filter(r => r.userId === user.id).length;
    const myTasksCount = STATE.tasks.filter(t => t.customerId === user.id).length;
    
    const tasks = STATE.tasks.filter(t => t.status === 'open');
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    
    const tasksHTML = tasks.map((task, i) => {
        const cust = findUser(task.customerId);
        const custRating = cust ? getUserRating(cust.id) : 0;
        const custName = cust ? cust.username : 'Неизвестный';
        const initial = custName[0].toUpperCase();
        return `
        <div class="task-card" data-task-id="${task.id}">
            <div class="task-top-row">
                <div class="task-title">${task.title}</div>
                <div class="task-price">${formatPrice(task.price)} ₽</div>
            </div>
            <div class="task-desc">${task.description}</div>
            <div class="task-meta">
                <div class="task-customer">
                    <div class="customer-avatar-mini">${initial}</div>
                    <span class="customer-name">${custName}</span>
                    <span style="color:#F59E0B; font-size:12px;">★ ${custRating}</span>
                </div>
                <span class="task-date">${formatDate(task.createdAt)}</span>
            </div>
        </div>`;
    }).join('');
    
    // Баннер (только если есть)
    const bannerHTML = STATE.stickyBanner ? `
        <div class="sticky-banner" id="sticky-banner">
            ${STATE.stickyBanner.image ? `<img class="sticky-banner-image" src="${STATE.stickyBanner.image}" alt="${STATE.stickyBanner.title}">` : ''}
            <div class="sticky-banner-body">
                <div class="sticky-banner-title">${STATE.stickyBanner.title}</div>
                <div class="sticky-banner-desc">${STATE.stickyBanner.description}</div>
                <div class="sticky-banner-price-row">
                    <div class="sticky-banner-price">${formatPrice(STATE.stickyBanner.price)} ₽</div>
                    <button class="sticky-banner-btn" id="btn-banner-click">ОТКЛИКНУТЬСЯ</button>
                </div>
            </div>
        </div>
    ` : '';
    
    // Кнопка управления баннером (только для создателя)
    const bannerManageBtn = isCreator() ? `
        <div class="action-card" id="btn-manage-banner" style="border:2px solid var(--green-400); background:linear-gradient(135deg, #f0fdf4, #dcfce7);">
            <div class="action-card-icon" style="background:var(--green-400);">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
            </div>
            <div class="action-card-title">${STATE.stickyBanner ? 'Изменить баннер' : 'Добавить баннер'}</div>
        </div>
    ` : '';
    
    return `
    <div class="app-container">
        ${bannerHTML}
        
        <div class="user-header">
            <div class="user-header-top">
                <div class="user-avatar" id="btn-my-profile">${user.username[0].toUpperCase()}</div>
                <div class="user-greeting">
                    <div class="user-name">${user.username}</div>
                    <div class="user-role-badge">${user.role === 'executor' ? 'Исполнитель' : user.role === 'customer' ? 'Заказчик' : 'Исполнитель и заказчик'}</div>
                </div>
                <div class="user-rating-mini">★ ${rating}</div>
            </div>
        </div>
        
        <div class="actions-grid">
            <div class="action-card" id="btn-create-task">
                <div class="action-card-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                        <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="action-card-title">Создать задание</div>
            </div>
            <div class="action-card" id="btn-my-tasks">
                <div class="action-card-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" stroke-width="2"/>
                        <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="2"/>
                        <path d="M9 14l2 2 4-4" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div class="action-card-title">Мои задания (${myTasksCount})</div>
            </div>
            ${bannerManageBtn}
        </div>
        
        <div class="section-header">
            <div class="section-title">Все задания</div>
            <div class="task-count">${tasks.length} заданий</div>
        </div>
        
        <div id="tasks-container">
            ${tasksHTML || '<div class="empty-state">Нет активных заданий</div>'}
        </div>
        
        <div class="bottom-nav">
            <button class="nav-btn active" data-screen="home">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                Главная
            </button>
            <button class="nav-btn" data-screen="alltasks">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                Задания
            </button>
            <button class="nav-btn nav-btn-center" id="btn-create-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Создать
            </button>
            <button class="nav-btn" data-screen="profile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                Профиль
            </button>
        </div>
    </div>`;
}

// ==========================================
// МОДАЛЬНЫЕ ОКНА
// ==========================================
function showModal(title, html) {
    document.querySelectorAll('.modal-overlay').forEach(e => e.remove());
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><h2>${title}</h2>${html}</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
}

function closeModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s';
        setTimeout(() => overlay.remove(), 200);
    }
}

function showCreateTask() {
    showModal('Создать задание', `
        <div class="input-group"><label class="input-label">Название</label><input class="input-field" id="mt-title" placeholder="Название задания"></div>
        <div class="input-group"><label class="input-label">Описание</label><textarea class="input-field" id="mt-desc" placeholder="Подробное описание" rows="3"></textarea></div>
        <div class="input-group"><label class="input-label">Цена (₽)</label><input class="input-field" id="mt-price" type="number" placeholder="5000"></div>
        <button class="btn btn-primary" id="btn-submit-task">ОПУБЛИКОВАТЬ</button>
    `);
    document.getElementById('btn-submit-task').addEventListener('click', createTask);
}

function showManageBanner() {
    const banner = STATE.stickyBanner;
    showModal(banner ? 'Изменить рекламный баннер' : 'Создать рекламный баннер', `
        <div class="input-group"><label class="input-label">Изображение</label>
            <div class="image-upload-area" id="banner-img-area">
                ${banner?.image ? `<img src="${banner.image}" alt="">` : '<div class="image-upload-placeholder"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Нажмите для загрузки</div>'}
            </div>
            <input type="file" id="banner-img-input" accept="image/*" style="display:none;">
        </div>
        <div class="input-group"><label class="input-label">Название</label><input class="input-field" id="mb-title" placeholder="Заголовок баннера" value="${banner?.title || ''}"></div>
        <div class="input-group"><label class="input-label">Описание</label><textarea class="input-field" id="mb-desc" placeholder="Описание" rows="2">${banner?.description || ''}</textarea></div>
        <div class="input-group"><label class="input-label">Цена (₽)</label><input class="input-field" id="mb-price" type="number" placeholder="5000" value="${banner?.price || ''}"></div>
        <button class="btn btn-primary" id="btn-save-banner">СОХРАНИТЬ БАННЕР</button>
        ${banner ? '<button class="btn btn-outline" id="btn-delete-banner" style="color:#ef4444; border-color:#fecaca;">УДАЛИТЬ БАННЕР</button>' : ''}
        <button class="btn btn-outline" onclick="closeModal()">ОТМЕНА</button>
    `);
    
    let bannerImage = banner?.image || null;
    
    document.getElementById('banner-img-area').addEventListener('click', () => {
        document.getElementById('banner-img-input').click();
    });
    
    document.getElementById('banner-img-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                bannerImage = ev.target.result;
                document.getElementById('banner-img-area').innerHTML = `<img src="${bannerImage}" alt="">`;
            };
            reader.readAsDataURL(file);
        }
    });
    
    document.getElementById('btn-save-banner').addEventListener('click', () => {
        const title = document.getElementById('mb-title').value.trim();
        const desc = document.getElementById('mb-desc').value.trim();
        const price = parseInt(document.getElementById('mb-price').value);
        if (!title || !price) { alert('Заполните название и цену'); return; }
        STATE.stickyBanner = { title, description: desc, price, image: bannerImage };
        saveAllData();
        closeModal();
        render();
    });
    
    document.getElementById('btn-delete-banner')?.addEventListener('click', () => {
        STATE.stickyBanner = null;
        saveAllData();
        closeModal();
        render();
    });
}

function showTaskDetail(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    const cust = findUser(task.customerId);
    const rating = cust ? getUserRating(cust.id) : 0;
    
    showModal(task.title, `
        <div style="font-size:24px; font-weight:800; color:#16A34A; margin:8px 0;">${formatPrice(task.price)} ₽</div>
        <p style="color:#666; line-height:1.6; margin-bottom:12px;">${task.description}</p>
        <div style="display:flex; align-items:center; gap:8px; padding:10px; background:#F0FDF4; border-radius:12px; margin-bottom:12px;">
            <div class="customer-avatar-mini" style="width:34px; height:34px; font-size:15px;">${cust?.username?.[0]?.toUpperCase() || '?'}</div>
            <div><div style="font-weight:600; font-size:14px;">${cust?.username || 'Неизвестный'}</div><div style="color:#F59E0B; font-size:13px;">★ ${rating}</div></div>
        </div>
        <button class="btn btn-primary" id="btn-respond-detail">ОТКЛИКНУТЬСЯ</button>
        ${task.customerId === STATE.user?.id ? '<button class="btn btn-outline" id="btn-leave-review">ОСТАВИТЬ ОТЗЫВ ЗАКАЗЧИКУ</button>' : ''}
        <button class="btn btn-outline" onclick="closeModal()">ЗАКРЫТЬ</button>
    `);
    
    document.getElementById('btn-respond-detail').addEventListener('click', () => {
        closeModal();
        alert('Отклик отправлен!');
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    });
    
    document.getElementById('btn-leave-review')?.addEventListener('click', () => {
        closeModal();
        setTimeout(() => showReviewModal(taskId), 300);
    });
}

function showReviewModal(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    const cust = findUser(task.customerId);
    
    showModal('Отзыв о заказчике', `
        <p style="text-align:center; color:#666; margin-bottom:4px;">Заказчик: <strong>${cust?.username}</strong></p>
        <p style="text-align:center; color:#999; font-size:12px; margin-bottom:12px;">${task.title}</p>
        <div class="stars-row" id="review-stars">
            ${[1,2,3,4,5].map(i => `<button class="star-btn active" data-star="${i}"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></button>`).join('')}
        </div>
        <div class="input-group"><label class="input-label">Комментарий</label><textarea class="input-field" id="mr-comment" placeholder="Ваш отзыв" rows="2"></textarea></div>
        <button class="btn btn-primary" id="btn-submit-review">ОСТАВИТЬ ОТЗЫВ</button>
        <button class="btn btn-outline" onclick="closeModal()">ОТМЕНА</button>
        <input type="hidden" id="mr-task-id" value="${taskId}">
    `);
    
    let rating = 5;
    document.querySelectorAll('#review-stars .star-btn').forEach((btn, i) => {
        btn.addEventListener('click', () => {
            rating = i + 1;
            document.querySelectorAll('#review-stars .star-btn').forEach((b, j) => {
                b.classList.toggle('active', j < rating);
            });
        });
    });
    
    document.getElementById('btn-submit-review').addEventListener('click', () => {
        const comment = document.getElementById('mr-comment').value.trim();
        const exists = STATE.reviews.find(r => r.taskId === taskId && r.reviewerId === STATE.user.id);
        if (exists) { alert('Вы уже оставляли отзыв'); return; }
        STATE.reviews.push({ id: genId(), taskId, rating, comment, reviewerId: STATE.user.id, userId: task.customerId, createdAt: Date.now() });
        saveAllData();
        closeModal();
        render();
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    });
}

function showProfile(userId) {
    const user = userId ? findUser(userId) : STATE.user;
    if (!user) return;
    const rating = getUserRating(user.id);
    const reviews = STATE.reviews.filter(r => r.userId === user.id);
    const reviewsHTML = reviews.slice(0, 10).map(r => {
        const rev = findUser(r.reviewerId);
        return `<div class="review-item">
            <div class="review-header"><span class="review-author">${rev?.username || 'Пользователь'}</span><span class="review-stars-small">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div>
            ${r.comment ? `<div class="review-comment">${r.comment}</div>` : ''}
        </div>`;
    }).join('');
    
    const isSelf = user.id === STATE.user?.id;
    
    showModal('Профиль', `
        <div class="profile-card">
            <div class="profile-avatar-large">${user.username[0].toUpperCase()}</div>
            <div class="profile-name">${user.username}</div>
            <div class="profile-role">${user.role === 'executor' ? 'Исполнитель' : user.role === 'customer' ? 'Заказчик' : 'Исполнитель и заказчик'}</div>
            ${user.description ? `<div class="profile-desc">${user.description}</div>` : ''}
            <div class="profile-rating-display">★ ${rating} (${reviews.length} отзывов)</div>
            ${isCreator() && isSelf ? '<div style="margin-top:10px; background:#F0FDF4; padding:6px 12px; border-radius:10px; font-size:12px; color:#16A34A; font-weight:600;">Создатель платформы</div>' : ''}
        </div>
        <div style="font-size:15px; font-weight:700; margin:12px 0 8px;">Отзывы</div>
        ${reviewsHTML || '<div class="empty-state">Пока нет отзывов</div>'}
        ${isSelf ? '<button class="btn btn-outline" id="btn-logout" style="margin-top:12px;">ВЫЙТИ</button>' : ''}
        <button class="btn btn-outline" onclick="closeModal()">ЗАКРЫТЬ</button>
    `);
    
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        STATE.isLoggedIn = false;
        STATE.user = null;
        localStorage.removeItem('gfUser');
        closeModal();
        render();
    });
}

// ==========================================
// ДЕЙСТВИЯ
// ==========================================
function register() {
    const phone = document.getElementById('reg-phone').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const nick = document.getElementById('reg-nick').value.trim();
    const desc = document.getElementById('reg-desc').value.trim();
    const role = document.getElementById('reg-role').value;
    
    if (!phone || !pass || !nick) { alert('Заполните обязательные поля'); return; }
    if (pass.length < 4) { alert('Пароль минимум 4 символа'); return; }
    if (STATE.users.find(u => u.phone === phone)) { alert('Этот номер уже зарегистрирован'); return; }
    if (STATE.users.find(u => u.username === nick)) { alert('Этот ник занят'); return; }
    
    const user = { id: genId(), phone, password: pass, username: nick, description: desc, role, avatar: null, createdAt: Date.now() };
    STATE.users.push(user);
    STATE.user = user;
    STATE.isLoggedIn = true;
    saveAllData();
    saveUser();
    render();
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}

function login() {
    const phone = document.getElementById('login-phone').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const user = STATE.users.find(u => u.phone === phone && u.password === pass);
    if (!user) { alert('Неверный телефон или пароль'); return; }
    STATE.user = user;
    STATE.isLoggedIn = true;
    saveUser();
    render();
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}

function createTask() {
    const title = document.getElementById('mt-title').value.trim();
    const desc = document.getElementById('mt-desc').value.trim();
    const price = parseInt(document.getElementById('mt-price').value);
    if (!title || !desc || !price) { alert('Все поля обязательны'); return; }
    if (price < 100) { alert('Минимальная цена 100₽'); return; }
    STATE.tasks.unshift({ id: genId(), title, description: desc, price, customerId: STATE.user.id, cover: null, status: 'open', createdAt: Date.now() });
    saveAllData();
    closeModal();
    render();
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}

// ==========================================
// ПРИВЯЗКА СОБЫТИЙ
// ==========================================
function bindEvents() {
    // Auth
    document.getElementById('btn-reg')?.addEventListener('click', register);
    document.getElementById('btn-login')?.addEventListener('click', login);
    document.getElementById('show-login')?.addEventListener('click', () => {
        document.getElementById('reg-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    document.getElementById('show-reg')?.addEventListener('click', () => {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('reg-form').style.display = 'block';
    });
    
    // Main
    document.getElementById('btn-my-profile')?.addEventListener('click', () => showProfile());
    document.getElementById('btn-create-task')?.addEventListener('click', showCreateTask);
    document.getElementById('btn-create-center')?.addEventListener('click', showCreateTask);
    document.getElementById('btn-my-tasks')?.addEventListener('click', () => alert('Раздел в разработке'));
    document.getElementById('btn-manage-banner')?.addEventListener('click', showManageBanner);
    document.getElementById('sticky-banner')?.addEventListener('click', (e) => {
        if (!e.target.closest('.sticky-banner-btn')) {
            alert('Баннер создателя платформы');
        }
    });
    document.getElementById('btn-banner-click')?.addEventListener('click', (e) => {
        e.stopPropagation();
        alert('Отклик на баннер отправлен!');
    });
    
    // Task cards
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            showTaskDetail(card.dataset.taskId);
        });
    });
    
    // Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const screen = btn.dataset.screen;
            if (screen === 'home') render();
            else if (screen === 'profile') showProfile();
            else if (screen === 'alltasks') render();
        });
    });
}

// Старт
loadData();
render();