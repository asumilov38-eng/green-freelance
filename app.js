// ==========================================
// GREENFREELANCE v2 — SUPABASE REALTIME
// ==========================================

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#16A34A');
    tg.setBackgroundColor('#F0FDF4');
    tg.MainButton.hide();
}

// Supabase клиент
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Состояние приложения
const STATE = {
    isLoggedIn: false,
    user: null,
    tasks: [],
    reviews: [],
    usersCache: {},
    banner: null,
};

// ==========================================
// ЗАГРУЗКА ДАННЫХ
// ==========================================
async function loadUser() {
    const saved = localStorage.getItem('gfUser');
    if (saved) {
        STATE.user = JSON.parse(saved);
        STATE.isLoggedIn = true;
    }
}

async function loadTasks() {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
    if (!error) STATE.tasks = data;
}

async function loadBanner() {
    const { data } = await supabase
        .from('banner')
        .select('*')
        .eq('id', 1)
        .single();
    STATE.banner = data;
}

async function loadAllData() {
    await Promise.all([loadTasks(), loadBanner()]);
}

async function getUserById(id) {
    if (!id) return null;
    if (STATE.usersCache[id]) return STATE.usersCache[id];
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
    if (data) STATE.usersCache[id] = data;
    return data;
}

async function getUserRating(userId) {
    if (!userId) return 0;
    const { data } = await supabase
        .from('reviews')
        .select('rating')
        .eq('user_id', userId);
    if (!data || data.length === 0) return 0;
    const sum = data.reduce((s, r) => s + r.rating, 0);
    return Math.round((sum / data.length) * 10) / 10;
}

async function getUserReviewCount(userId) {
    if (!userId) return 0;
    const { count } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
    return count || 0;
}

function formatPrice(n) {
    if (!n) return '0';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDate(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    return new Date(ts).toLocaleDateString('ru-RU');
}

function isCreator() {
    return STATE.user && STATE.user.phone === CREATOR_PHONE;
}

// ==========================================
// ПОДПИСКА НА REALTIME
// ==========================================
function subscribeToRealtime() {
    supabase
        .channel('tasks-realtime')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'tasks' }, 
            () => { loadTasks().then(() => render()); }
        )
        .subscribe();

    supabase
        .channel('banner-realtime')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'banner' }, 
            () => { loadBanner().then(() => render()); }
        )
        .subscribe();
}

// ==========================================
// РЕНДЕР
// ==========================================
async function render() {
    const app = document.getElementById('app');
    showLoading(app);
    
    if (!STATE.isLoggedIn) {
        app.innerHTML = renderAuth();
    } else {
        await loadAllData();
        app.innerHTML = await renderMain();
    }
    bindEvents();
}

function showLoading(app) {
    app.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100vh;">
            <div style="text-align:center;">
                <div style="width:48px; height:48px; border:4px solid #DCFCE7; border-top-color:#22C55E; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 16px;"></div>
                <p style="color:#16A34A; font-weight:600;">Загрузка...</p>
            </div>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
    `;
}

// ==========================================
// ЭКРАН АВТОРИЗАЦИИ
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
async function renderMain() {
    const user = STATE.user;
    const rating = await getUserRating(user.id);
    const reviewCount = await getUserReviewCount(user.id);
    
    // Задания
    const tasks = [...STATE.tasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    let tasksHTML = '';
    for (const task of tasks) {
        const cust = await getUserById(task.customer_id);
        const custRating = cust ? await getUserRating(cust.id) : 0;
        const custName = cust ? cust.username : 'Пользователь';
        const initial = custName[0].toUpperCase();
        
        tasksHTML += `
        <div class="task-card" data-task-id="${task.id}">
            <div class="task-top-row">
                <div class="task-title">${escapeHTML(task.title)}</div>
                <div class="task-price">${formatPrice(task.price)} ₽</div>
            </div>
            <div class="task-desc">${escapeHTML(task.description)}</div>
            <div class="task-meta">
                <div class="task-customer">
                    <div class="customer-avatar-mini">${initial}</div>
                    <span class="customer-name">${escapeHTML(custName)}</span>
                    <span style="color:#F59E0B; font-size:12px;">★ ${custRating}</span>
                </div>
                <span class="task-date">${formatDate(task.created_at)}</span>
            </div>
        </div>`;
    }

    // Баннер
    const bannerHTML = STATE.banner ? `
        <div class="sticky-banner" id="sticky-banner">
            ${STATE.banner.image ? `<img class="sticky-banner-image" src="${STATE.banner.image}" alt="${escapeHTML(STATE.banner.title)}">` : ''}
            <div class="sticky-banner-body">
                <div class="sticky-banner-title">${escapeHTML(STATE.banner.title)}</div>
                <div class="sticky-banner-desc">${escapeHTML(STATE.banner.description)}</div>
                <div class="sticky-banner-price-row">
                    <div class="sticky-banner-price">${formatPrice(STATE.banner.price)} ₽</div>
                    <button class="sticky-banner-btn" id="btn-banner-click">ОТКЛИКНУТЬСЯ</button>
                </div>
            </div>
        </div>
    ` : '';

    // Кнопка баннера для создателя
    const bannerBtn = isCreator() ? `
        <div class="action-card" id="btn-manage-banner" style="border:2px solid var(--green-400); background:linear-gradient(135deg, #f0fdf4, #dcfce7);">
            <div class="action-card-icon" style="background:var(--green-400);">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
            </div>
            <div class="action-card-title">${STATE.banner ? 'Изменить баннер' : 'Добавить баннер'}</div>
        </div>
    ` : '';

    return `
    <div class="app-container">
        ${bannerHTML}
        
        <div class="user-header">
            <div class="user-header-top">
                <div class="user-avatar" id="btn-my-profile">${user.username[0].toUpperCase()}</div>
                <div class="user-greeting">
                    <div class="user-name">${escapeHTML(user.username)}</div>
                    <div class="user-role-badge">${user.role === 'executor' ? 'Исполнитель' : user.role === 'customer' ? 'Заказчик' : 'Исполнитель и заказчик'}</div>
                </div>
                <div class="user-rating-mini">★ ${rating}</div>
            </div>
        </div>
        
        <div class="actions-grid">
            <div class="action-card" id="btn-create-task">
                <div class="action-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </div>
                <div class="action-card-title">Создать задание</div>
            </div>
            <div class="action-card" id="btn-profile-card">
                <div class="action-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </div>
                <div class="action-card-title">Мой профиль</div>
            </div>
            ${bannerBtn}
        </div>
        
        <div class="section-header">
            <div class="section-title">Все задания</div>
            <div class="task-count">${tasks.length} заданий</div>
        </div>
        
        <div id="tasks-container">
            ${tasksHTML || '<div class="empty-state">Нет активных заданий. Создайте первое!</div>'}
        </div>
        
        <div class="bottom-nav">
            <button class="nav-btn active" data-screen="home">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                Главная
            </button>
            <button class="nav-btn" data-screen="tasks">
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
// ЭКРАНИРОВАНИЕ HTML
// ==========================================
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==========================================
// МОДАЛЬНЫЕ ОКНА
// ==========================================
function showModal(title, html) {
    document.querySelectorAll('.modal-overlay').forEach(e => {
        e.style.opacity = '0';
        setTimeout(() => e.remove(), 200);
    });
    
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

// ==========================================
// МОДАЛКА СОЗДАНИЯ ЗАДАНИЯ
// ==========================================
function showCreateTask() {
    showModal('Создать задание', `
        <div class="input-group">
            <label class="input-label">Название</label>
            <input class="input-field" id="mt-title" placeholder="Название задания" maxlength="200">
        </div>
        <div class="input-group">
            <label class="input-label">Описание</label>
            <textarea class="input-field" id="mt-desc" placeholder="Подробное описание" rows="4" maxlength="2000"></textarea>
        </div>
        <div class="input-group">
            <label class="input-label">Цена (от 5 ₽)</label>
            <input class="input-field" id="mt-price" type="number" placeholder="5000" min="5">
        </div>
        <button class="btn btn-primary" id="btn-submit-task">ОПУБЛИКОВАТЬ</button>
        <button class="btn btn-outline" onclick="closeModal()">ОТМЕНА</button>
    `);
    document.getElementById('btn-submit-task').addEventListener('click', createTask);
}

// ==========================================
// МОДАЛКА БАННЕРА (ТОЛЬКО ДЛЯ СОЗДАТЕЛЯ)
// ==========================================
function showManageBanner() {
    const banner = STATE.banner;
    showModal(banner ? 'Изменить баннер' : 'Создать баннер', `
        <div class="input-group">
            <label class="input-label">Изображение (необязательно)</label>
            <div class="image-upload-area" id="banner-img-area">
                ${banner?.image 
                    ? `<img src="${banner.image}" alt="">` 
                    : `<div class="image-upload-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#bbb" stroke-width="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <div>Нажмите для загрузки</div>
                       </div>`
                }
            </div>
            <input type="file" id="banner-img-input" accept="image/*" style="display:none;">
        </div>
        <div class="input-group">
            <label class="input-label">Название</label>
            <input class="input-field" id="mb-title" value="${escapeHTML(banner?.title || '')}" placeholder="Заголовок">
        </div>
        <div class="input-group">
            <label class="input-label">Описание</label>
            <textarea class="input-field" id="mb-desc" rows="2" placeholder="Описание">${escapeHTML(banner?.description || '')}</textarea>
        </div>
        <div class="input-group">
            <label class="input-label">Цена (от 5 ₽)</label>
            <input class="input-field" id="mb-price" type="number" value="${banner?.price || ''}" placeholder="1000" min="5">
        </div>
        <button class="btn btn-primary" id="btn-save-banner">СОХРАНИТЬ</button>
        ${banner ? '<button class="btn btn-outline" id="btn-delete-banner" style="color:#ef4444; border-color:#fecaca;">УДАЛИТЬ БАННЕР</button>' : ''}
        <button class="btn btn-outline" onclick="closeModal()">ОТМЕНА</button>
    `);

    let bannerImage = banner?.image || null;

    document.getElementById('banner-img-area').addEventListener('click', () => {
        document.getElementById('banner-img-input').click();
    });

    document.getElementById('banner-img-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.size > 5 * 1024 * 1024) {
            alert('Изображение слишком большое. Максимум 5 МБ.');
            return;
        }
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                bannerImage = ev.target.result;
                document.getElementById('banner-img-area').innerHTML = `<img src="${bannerImage}" alt="">`;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('btn-save-banner').addEventListener('click', async () => {
        const title = document.getElementById('mb-title').value.trim();
        const desc = document.getElementById('mb-desc').value.trim();
        const price = parseInt(document.getElementById('mb-price').value);
        
        if (!title) { alert('Введите название'); return; }
        if (!price || price < 5) { alert('Цена от 5 ₽'); return; }

        if (bannerImage && bannerImage.length > 3 * 1024 * 1024) {
            alert('Изображение слишком большое. Уменьшите размер.');
            return;
        }

        const { error } = await supabase.from('banner').upsert({ 
            id: 1, 
            title, 
            description: desc, 
            price, 
            image: bannerImage 
        });
        
        if (error) { alert('Ошибка: ' + error.message); return; }
        
        closeModal();
        await loadBanner();
        render();
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    });

    document.getElementById('btn-delete-banner')?.addEventListener('click', async () => {
        if (!confirm('Удалить баннер?')) return;
        const { error } = await supabase.from('banner').delete().eq('id', 1);
        if (error) { alert('Ошибка'); return; }
        closeModal();
        await loadBanner();
        render();
    });
}

// ==========================================
// ДЕТАЛИ ЗАДАНИЯ
// ==========================================
async function showTaskDetail(taskId) {
    const task = STATE.tasks.find(t => t.id == taskId);
    if (!task) { alert('Задание не найдено'); return; }
    
    const cust = await getUserById(task.customer_id);
    const rating = cust ? await getUserRating(cust.id) : 0;
    const isOwner = task.customer_id === STATE.user?.id;

    showModal(escapeHTML(task.title), `
        <div style="font-size:26px; font-weight:800; color:#16A34A; margin:8px 0;">${formatPrice(task.price)} ₽</div>
        <p style="color:#555; line-height:1.6; margin-bottom:14px; white-space:pre-wrap;">${escapeHTML(task.description)}</p>
        <div style="display:flex; align-items:center; gap:10px; padding:12px; background:#F0FDF4; border-radius:14px; margin-bottom:14px; cursor:pointer;" id="btn-view-customer" data-customer-id="${task.customer_id}">
            <div class="customer-avatar-mini" style="width:36px; height:36px; font-size:16px;">${cust?.username?.[0]?.toUpperCase() || '?'}</div>
            <div>
                <div style="font-weight:600;">${escapeHTML(cust?.username || 'Пользователь')}</div>
                <div style="color:#F59E0B; font-size:13px;">★ ${rating}</div>
            </div>
        </div>
        ${!isOwner ? '<button class="btn btn-primary" id="btn-respond-detail">ОТКЛИКНУТЬСЯ</button>' : ''}
        <button class="btn btn-outline" onclick="closeModal()">ЗАКРЫТЬ</button>
    `);

    document.getElementById('btn-respond-detail')?.addEventListener('click', () => {
        closeModal();
        alert('Отклик отправлен заказчику!');
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    });

    document.getElementById('btn-view-customer')?.addEventListener('click', () => {
        closeModal();
        setTimeout(() => showProfile(task.customer_id), 300);
    });
}

// ==========================================
// ОТЗЫВ
// ==========================================
function showReviewModal(taskId) {
    const task = STATE.tasks.find(t => t.id == taskId);
    if (!task) return;

    showModal('Оставить отзыв', `
        <p style="text-align:center; color:#888; font-size:13px; margin-bottom:14px;">${escapeHTML(task.title)}</p>
        <div class="stars-row" id="review-stars">
            ${[1,2,3,4,5].map(i => `<button class="star-btn active" data-star="${i}"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></button>`).join('')}
        </div>
        <div class="input-group">
            <label class="input-label">Комментарий</label>
            <textarea class="input-field" id="mr-comment" rows="2" placeholder="Ваш отзыв"></textarea>
        </div>
        <button class="btn btn-primary" id="btn-submit-review">ОСТАВИТЬ ОТЗЫВ</button>
        <button class="btn btn-outline" onclick="closeModal()">ОТМЕНА</button>
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

    document.getElementById('btn-submit-review').addEventListener('click', async () => {
        const comment = document.getElementById('mr-comment').value.trim();
        const { error } = await supabase.from('reviews').insert({
            task_id: taskId,
            reviewer_id: STATE.user.id,
            user_id: task.customer_id,
            rating,
            comment
        });
        if (error) {
            alert('Ошибка: ' + (error.message === 'duplicate key value violates unique constraint' ? 'Вы уже оставили отзыв' : error.message));
        } else {
            closeModal();
            render();
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        }
    });
}

// ==========================================
// ПРОФИЛЬ
// ==========================================
async function showProfile(userId) {
    const user = userId ? await getUserById(userId) : STATE.user;
    if (!user) { alert('Пользователь не найден'); return; }

    const rating = await getUserRating(user.id);
    const reviewCount = await getUserReviewCount(user.id);

    const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

    let reviewsHTML = '';
    if (reviews && reviews.length > 0) {
        for (const r of reviews) {
            const rev = await getUserById(r.reviewer_id);
            reviewsHTML += `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-author">${escapeHTML(rev?.username || 'Пользователь')}</span>
                    <span class="review-stars-small">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
                </div>
                ${r.comment ? `<div class="review-comment">${escapeHTML(r.comment)}</div>` : ''}
            </div>`;
        }
    }

    const isSelf = user.id === STATE.user?.id;
    const userTasksCount = STATE.tasks.filter(t => t.customer_id === user.id).length;

    showModal('Профиль', `
        <div class="profile-card">
            <div class="profile-avatar-large">${user.username[0].toUpperCase()}</div>
            <div class="profile-name">${escapeHTML(user.username)}</div>
            <div class="profile-role">${user.role === 'executor' ? 'Исполнитель' : user.role === 'customer' ? 'Заказчик' : 'Исполнитель и заказчик'}</div>
            ${user.description ? `<div class="profile-desc">${escapeHTML(user.description)}</div>` : ''}
            <div class="profile-rating-display">★ ${rating} (${reviewCount} отзывов) · ${userTasksCount} заданий</div>
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
async function register() {
    const phone = document.getElementById('reg-phone').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const nick = document.getElementById('reg-nick').value.trim();
    const desc = document.getElementById('reg-desc').value.trim();
    const role = document.getElementById('reg-role').value;

    if (!phone || !pass || !nick) { alert('Заполните обязательные поля'); return; }
    if (pass.length < 4) { alert('Пароль минимум 4 символа'); return; }

    const { data: exists } = await supabase.from('users').select('id').or(`phone.eq.${phone},username.eq.${nick}`).single();
    if (exists) { alert('Телефон или ник уже заняты'); return; }

    const { data, error } = await supabase.from('users').insert({
        phone, password: pass, username: nick, description: desc, role
    }).select().single();

    if (error) { alert('Ошибка регистрации: ' + error.message); return; }

    STATE.user = data;
    STATE.isLoggedIn = true;
    localStorage.setItem('gfUser', JSON.stringify(data));
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    render();
}

async function login() {
    const phone = document.getElementById('login-phone').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    if (!phone || !pass) { alert('Заполните все поля'); return; }

    const { data, error } = await supabase.from('users').select('*').eq('phone', phone).eq('password', pass).single();

    if (error || !data) { alert('Неверный телефон или пароль'); return; }

    STATE.user = data;
    STATE.isLoggedIn = true;
    localStorage.setItem('gfUser', JSON.stringify(data));
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    render();
}

async function createTask() {
    const title = document.getElementById('mt-title').value.trim();
    const desc = document.getElementById('mt-desc').value.trim();
    const price = parseInt(document.getElementById('mt-price').value);

    if (!title || !desc || !price) { alert('Все поля обязательны'); return; }
    if (price < 5) { alert('Минимальная цена — 5 ₽'); return; }

    const { error } = await supabase.from('tasks').insert({
        title,
        description: desc,
        price,
        customer_id: STATE.user.id,
        status: 'open'
    });

    if (error) { alert('Ошибка: ' + error.message); return; }

    closeModal();
    await loadTasks();
    render();
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}

// ==========================================
// ПРИВЯЗКА СОБЫТИЙ
// ==========================================
function bindEvents() {
    // Регистрация
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

    // Главный экран
    document.getElementById('btn-my-profile')?.addEventListener('click', () => showProfile());
    document.getElementById('btn-profile-card')?.addEventListener('click', () => showProfile());
    document.getElementById('btn-create-task')?.addEventListener('click', showCreateTask);
    document.getElementById('btn-create-center')?.addEventListener('click', showCreateTask);
    document.getElementById('btn-manage-banner')?.addEventListener('click', showManageBanner);
    
    document.getElementById('sticky-banner')?.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            alert(escapeHTML(STATE.banner?.title || 'Рекламный баннер'));
        }
    });
    document.getElementById('btn-banner-click')?.addEventListener('click', (e) => {
        e.stopPropagation();
        alert('Отклик отправлен!');
    });

    // Карточки заданий
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('click', () => showTaskDetail(card.dataset.taskId));
    });

    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const screen = btn.dataset.screen;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (screen === 'home') render();
            else if (screen === 'profile') showProfile();
            else if (screen === 'tasks') render();
        });
    });
}

// ==========================================
// ЗАПУСК
// ==========================================
(async function init() {
    await loadUser();
    if (STATE.isLoggedIn) {
        // Обновляем данные пользователя из базы
        const { data } = await supabase.from('users').select('*').eq('id', STATE.user.id).single();
        if (data) {
            STATE.user = data;
            localStorage.setItem('gfUser', JSON.stringify(data));
        }
        subscribeToRealtime();
    }
    render();
})();