// ==========================================
// GREENFREELANCE - ГЛАВНЫЙ СКРИПТ
// ==========================================

// ---------- ИНИЦИАЛИЗАЦИЯ TELEGRAM ----------
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#16A34A');
    tg.setBackgroundColor('#F0FDF4');
    tg.MainButton.hide();
    tg.BackButton.hide();
}

// ---------- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ----------
const STATE = {
    currentScreen: 'home',
    isLoggedIn: false,
    user: null,
    users: [], // База пользователей
    tasks: [], // База заданий
    reviews: [], // База отзывов
};

// ---------- ЗАГРУЗКА ДАННЫХ ----------
function loadData() {
    const saved = localStorage.getItem('greenFreelanceData');
    if (saved) {
        const data = JSON.parse(saved);
        STATE.users = data.users || [];
        STATE.tasks = data.tasks || [];
        STATE.reviews = data.reviews || [];
    }
    
    const savedUser = localStorage.getItem('greenFreelanceUser');
    if (savedUser) {
        STATE.user = JSON.parse(savedUser);
        STATE.isLoggedIn = true;
    }
    
    // Демо-задания если пусто
    if (STATE.tasks.length === 0) {
        STATE.tasks = [
            {
                id: 'task_1',
                title: 'Дизайн логотипа для кофейни',
                description: 'Нужен современный минималистичный логотип для кофейни. Стиль: скандинавский минимализм.',
                price: 3000,
                customerId: 'user_demo_1',
                cover: null,
                status: 'open',
                isPromoted: true,
                promotionType: 'top',
                promotionExpires: Date.now() + 86400000,
                createdAt: Date.now() - 3600000
            },
            {
                id: 'task_2',
                title: 'Настроить таргет ВКонтакте',
                description: 'Настройка и запуск рекламной кампании в ВК. Бюджет на рекламу предоставлю.',
                price: 5000,
                customerId: 'user_demo_2',
                cover: null,
                status: 'open',
                isPromoted: true,
                promotionType: 'banner',
                promotionExpires: Date.now() + 86400000,
                createdAt: Date.now() - 7200000
            },
            {
                id: 'task_3',
                title: 'Написать 3 статьи про криптовалюты',
                description: 'Объем каждой статьи 5000-7000 знаков. Темы предоставлю. Нужен опыт в теме.',
                price: 4500,
                customerId: 'user_demo_3',
                cover: null,
                status: 'open',
                isPromoted: false,
                promotionType: null,
                promotionExpires: null,
                createdAt: Date.now() - 10800000
            },
            {
                id: 'task_4',
                title: 'Сверстать лендинг на Tilda',
                description: 'Есть готовый дизайн в Figma. Нужно перенести на Tilda, 6 блоков.',
                price: 8000,
                customerId: 'user_demo_4',
                cover: null,
                status: 'open',
                isPromoted: false,
                promotionType: null,
                promotionExpires: null,
                createdAt: Date.now() - 14400000
            },
            {
                id: 'task_5',
                title: 'Монтаж видео для YouTube',
                description: 'Исходники на 40 минут. Нужно сделать ролик на 12-15 минут с эффектами.',
                price: 6000,
                customerId: 'user_demo_5',
                cover: null,
                status: 'open',
                isPromoted: false,
                promotionType: null,
                promotionExpires: null,
                createdAt: Date.now() - 18000000
            }
        ];
    }
}

function saveData() {
    localStorage.setItem('greenFreelanceData', JSON.stringify({
        users: STATE.users,
        tasks: STATE.tasks,
        reviews: STATE.reviews
    }));
}

function saveUser() {
    if (STATE.user) {
        localStorage.setItem('greenFreelanceUser', JSON.stringify(STATE.user));
    }
}

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
}

function formatDate(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    return d.toLocaleDateString('ru-RU');
}

function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ---------- РЕНДЕР ПРИЛОЖЕНИЯ ----------
function render() {
    const app = document.getElementById('app');
    
    if (!STATE.isLoggedIn) {
        app.innerHTML = renderAuthScreen();
    } else {
        app.innerHTML = renderMainLayout();
    }
    
    bindEvents();
}

// ---------- ЭКРАН АВТОРИЗАЦИИ ----------
function renderAuthScreen() {
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
            
            <div class="auth-form-container" id="auth-form">
                <h2 style="font-size:18px; font-weight:700; margin-bottom:20px; text-align:center;">Регистрация</h2>
                
                <div class="input-group">
                    <label class="input-label">Номер телефона</label>
                    <input class="input-field" type="tel" id="reg-phone" placeholder="+7 (999) 000-00-00">
                </div>
                
                <div class="input-group">
                    <label class="input-label">Пароль</label>
                    <input class="input-field" type="password" id="reg-password" placeholder="Придумайте пароль">
                </div>
                
                <div class="input-group">
                    <label class="input-label">Никнейм</label>
                    <input class="input-field" type="text" id="reg-username" placeholder="Ваш никнейм">
                </div>
                
                <div class="input-group">
                    <label class="input-label">Описание (необязательно)</label>
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
                
                <button class="btn btn-primary" id="btn-register" style="margin-top:8px;">
                    СОЗДАТЬ АККАУНТ
                </button>
                
                <p style="text-align:center; margin-top:16px; font-size:13px; color:#888;">
                    Уже есть аккаунт? 
                    <span id="show-login" style="color:#16A34A; font-weight:600; cursor:pointer;">Войти</span>
                </p>
            </div>
            
            <div class="auth-form-container" id="login-form" style="display:none;">
                <h2 style="font-size:18px; font-weight:700; margin-bottom:20px; text-align:center;">Вход</h2>
                
                <div class="input-group">
                    <label class="input-label">Номер телефона</label>
                    <input class="input-field" type="tel" id="login-phone" placeholder="+7 (999) 000-00-00">
                </div>
                
                <div class="input-group">
                    <label class="input-label">Пароль</label>
                    <input class="input-field" type="password" id="login-password" placeholder="Ваш пароль">
                </div>
                
                <button class="btn btn-primary" id="btn-login" style="margin-top:8px;">
                    ВОЙТИ
                </button>
                
                <p style="text-align:center; margin-top:16px; font-size:13px; color:#888;">
                    Нет аккаунта? 
                    <span id="show-register" style="color:#16A34A; font-weight:600; cursor:pointer;">Зарегистрироваться</span>
                </p>
            </div>
        </div>
    `;
}

// ---------- ГЛАВНЫЙ ЭКРАН ----------
function renderMainLayout() {
    const user = STATE.user;
    const userRating = getUserRating(user.id);
    const reviewCount = STATE.reviews.filter(r => r.userId === user.id).length;
    
    // Сортируем задания: продвинутые сверху
    let visibleTasks = [...STATE.tasks].filter(t => t.status === 'open');
    visibleTasks.sort((a, b) => {
        if (a.isPromoted && !b.isPromoted) return -1;
        if (!a.isPromoted && b.isPromoted) return 1;
        return b.createdAt - a.createdAt;
    });
    
    // Проверяем наличие активного баннера
    const activeBanner = STATE.tasks.find(t => 
        t.isPromoted && t.promotionType === 'banner' && t.promotionExpires > Date.now()
    );
    
    const tasksHTML = visibleTasks.map((task, index) => {
        const customer = findUser(task.customerId);
        const customerRating = customer ? getUserRating(customer.id) : 0;
        const customerName = customer ? customer.username : 'Неизвестный';
        const customerInitial = customerName[0].toUpperCase();
        
        return `
            <div class="task-card" data-task-id="${task.id}" id="task-${task.id}">
                ${task.isPromoted ? '<span class="task-badge">ТОП</span>' : ''}
                <div class="task-top-row">
                    <div class="task-title">${task.title}</div>
                    <div class="task-price">${formatPrice(task.price)} ₽</div>
                </div>
                <div class="task-desc">${task.description}</div>
                <div class="task-bottom-row">
                    <div class="task-customer">
                        <div class="customer-avatar-mini">${customerInitial}</div>
                        <span class="customer-name">${customerName}</span>
                        <span class="rating">★ ${customerRating}</span>
                    </div>
                    <button class="task-respond-btn" data-action="respond" data-task-id="${task.id}">
                        Откликнуться
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="app-container">
            ${activeBanner ? renderBanner(activeBanner) : renderDefaultBanner()}
            
            <!-- Блок пользователя -->
            <div class="user-header">
                <div class="user-header-top">
                    <div class="user-avatar" id="btn-profile">
                        ${user.username[0].toUpperCase()}
                    </div>
                    <div class="balance-block">
                        <div class="balance-label">Баланс</div>
                        <div class="balance-amount">${user.balance || 0} <span class="balance-currency">₽</span></div>
                    </div>
                </div>
                <div class="user-stats">
                    <div class="stat-item">
                        <div class="stat-value">★ ${userRating}</div>
                        <div class="stat-label">Рейтинг</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${reviewCount}</div>
                        <div class="stat-label">Отзывов</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${STATE.tasks.filter(t => t.customerId === user.id).length}</div>
                        <div class="stat-label">Заданий</div>
                    </div>
                </div>
            </div>
            
            <!-- Сетка действий -->
            <div class="actions-grid">
                <div class="action-card" id="btn-create">
                    <div class="action-card-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="action-card-title">Создать задание</div>
                </div>
                <div class="action-card" id="btn-mytasks">
                    <div class="action-card-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" stroke-width="2"/>
                            <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="2"/>
                            <path d="M9 14l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="action-card-title">Мои задания</div>
                </div>
                <div class="action-card" id="btn-promo">
                    <div class="action-card-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="action-card-title">Продвижение</div>
                </div>
            </div>
            
            <!-- Заголовок -->
            <div class="section-header">
                <div class="section-title">Актуальные задания</div>
                <span class="section-link" id="btn-alltasks">Все</span>
            </div>
            
            <!-- Список заданий -->
            <div id="tasks-container">
                ${tasksHTML || '<p style="text-align:center; color:#999; padding:40px;">Нет активных заданий</p>'}
            </div>
            
            <!-- Навигация -->
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
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    Задания
                </button>
                <button class="nav-btn nav-btn-center" data-screen="create">
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
        </div>
    `;
}

// ---------- БАННЕРЫ ----------
function renderBanner(task) {
    return `
        <div class="promo-banner" data-task-id="${task.id}">
            <div class="promo-icon">📢</div>
            <div class="promo-info">
                <div class="promo-title">${task.title}</div>
                <div class="promo-desc">Заказчик ищет исполнителя</div>
            </div>
            <div class="promo-badge">${formatPrice(task.price)} ₽</div>
        </div>
    `;
}

function renderDefaultBanner() {
    return `
        <div class="promo-banner" id="btn-promo-banner">
            <div class="promo-icon">🚀</div>
            <div class="promo-info">
                <div class="promo-title">Продвиньте задание!</div>
                <div class="promo-desc">Больше откликов за 24 часа</div>
            </div>
            <div class="promo-badge">от 50 ₽</div>
        </div>
    `;
}

// ---------- МОДАЛЬНЫЕ ОКНА ----------
function showModal(title, contentHTML) {
    // Удаляем старые модалки
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-handle"></div>
            <h2>${title}</h2>
            ${contentHTML}
        </div>
    `;
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
    
    document.body.appendChild(overlay);
}

function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(el => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.2s';
        setTimeout(() => el.remove(), 200);
    });
}

// Модалка создания задания
function showCreateTaskModal() {
    showModal('Создать задание', `
        <div class="input-group">
            <label class="input-label">Название</label>
            <input class="input-field" id="modal-task-title" placeholder="Название задания">
        </div>
        <div class="input-group">
            <label class="input-label">Описание</label>
            <textarea class="input-field" id="modal-task-desc" placeholder="Подробное описание" rows="3" style="resize:vertical;"></textarea>
        </div>
        <div class="input-group">
            <label class="input-label">Цена (₽)</label>
            <input class="input-field" id="modal-task-price" type="number" placeholder="5000">
        </div>
        <button class="btn btn-primary" id="btn-submit-task">ОПУБЛИКОВАТЬ</button>
    `);
    
    document.getElementById('btn-submit-task').addEventListener('click', createTask);
}

// Модалка продвижения
function showPromoModal(taskId = null) {
    const taskOptions = STATE.tasks
        .filter(t => t.customerId === STATE.user.id && t.status === 'open')
        .map(t => `<option value="${t.id}">${t.title}</option>`)
        .join('');
    
    showModal('Продвижение задания', `
        <p style="color:#666; font-size:14px; margin-bottom:16px;">
            Ваше задание увидят больше исполнителей
        </p>
        
        ${taskOptions ? `
            <div class="input-group">
                <label class="input-label">Выберите задание</label>
                <select class="select-field" id="modal-promo-task">
                    ${taskOptions}
                </select>
            </div>
        ` : '<p style="color:#999; text-align:center; margin:16px 0;">У вас нет активных заданий</p>'}
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px;">
            <div style="background:white; border:2px solid var(--green-200); border-radius:16px; padding:16px; text-align:center; cursor:pointer;" id="promo-top">
                <div style="font-size:24px; margin-bottom:8px;">📌</div>
                <div style="font-weight:700; font-size:15px;">ТОП списка</div>
                <div style="font-size:12px; color:#666; margin:4px 0;">24 часа</div>
                <div style="font-size:22px; font-weight:800; color:#16A34A;">50 ₽</div>
            </div>
            <div style="background:white; border:2px solid var(--green-200); border-radius:16px; padding:16px; text-align:center; cursor:pointer;" id="promo-banner-opt">
                <div style="font-size:24px; margin-bottom:8px;">📢</div>
                <div style="font-weight:700; font-size:15px;">Баннер</div>
                <div style="font-size:12px; color:#666; margin:4px 0;">24 часа</div>
                <div style="font-size:22px; font-weight:800; color:#16A34A;">100 ₽</div>
            </div>
        </div>
        
        <button class="btn btn-outline" style="margin-top:12px;" onclick="closeModal()">ОТМЕНА</button>
    `);
    
    document.getElementById('promo-top')?.addEventListener('click', () => {
        const taskId = document.getElementById('modal-promo-task')?.value || taskId;
        if (taskId) activatePromotion(taskId, 'top', 50);
    });
    
    document.getElementById('promo-banner-opt')?.addEventListener('click', () => {
        const taskId = document.getElementById('modal-promo-task')?.value || taskId;
        if (taskId) activatePromotion(taskId, 'banner', 100);
    });
}

// Модалка отзыва
function showReviewModal(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    
    const customer = findUser(task.customerId);
    
    showModal('Оставить отзыв', `
        <p style="text-align:center; margin-bottom:8px; color:#666;">Заказчик: <strong>${customer?.username || 'Неизвестный'}</strong></p>
        <p style="text-align:center; margin-bottom:16px; color:#888; font-size:13px;">Задание: ${task.title}</p>
        
        <div class="stars-row" id="review-stars">
            ${[1,2,3,4,5].map(i => `
                <button class="star-btn" data-star="${i}">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </button>
            `).join('')}
        </div>
        
        <div class="input-group" style="margin-top:12px;">
            <label class="input-label">Комментарий (необязательно)</label>
            <textarea class="input-field" id="modal-review-comment" placeholder="Ваш отзыв" rows="2" style="resize:vertical;"></textarea>
        </div>
        
        <button class="btn btn-primary" id="btn-submit-review">ОСТАВИТЬ ОТЗЫВ</button>
        
        <input type="hidden" id="modal-review-task-id" value="${taskId}">
    `);
    
    let selectedRating = 5;
    
    document.querySelectorAll('#review-stars .star-btn').forEach((btn, i) => {
        btn.addEventListener('click', () => {
            selectedRating = i + 1;
            document.querySelectorAll('#review-stars .star-btn').forEach((b, j) => {
                b.classList.toggle('active', j < selectedRating);
            });
        });
        if (i < selectedRating) btn.classList.add('active');
    });
    
    document.getElementById('btn-submit-review').addEventListener('click', () => {
        const comment = document.getElementById('modal-review-comment').value;
        submitReview(taskId, selectedRating, comment);
    });
}

// Модалка профиля
function showProfileModal(userId = null) {
    const user = userId ? findUser(userId) : STATE.user;
    if (!user) return;
    
    const rating = getUserRating(user.id);
    const reviews = STATE.reviews.filter(r => r.userId === user.id);
    const userTasks = STATE.tasks.filter(t => t.customerId === user.id);
    
    const reviewsHTML = reviews.slice(0, 5).map(r => {
        const reviewer = findUser(r.reviewerId);
        return `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-author">${reviewer?.username || 'Пользователь'}</span>
                    <span class="review-stars-small">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
                </div>
                ${r.comment ? `<div class="review-comment">${r.comment}</div>` : ''}
            </div>
        `;
    }).join('');
    
    showModal('Профиль', `
        <div class="profile-card">
            <div class="profile-avatar-large">${user.username[0].toUpperCase()}</div>
            <div class="profile-name">${user.username}</div>
            <div class="profile-role">${user.role === 'executor' ? 'Исполнитель' : user.role === 'customer' ? 'Заказчик' : 'Исполнитель и заказчик'}</div>
            ${user.description ? `<p style="color:#666; font-size:14px; margin-bottom:12px;">${user.description}</p>` : ''}
            <div class="profile-rating-display">★ ${rating} (${reviews.length} отзывов)</div>
        </div>
        
        ${reviewsHTML ? `
            <h3 style="font-size:16px; font-weight:700; margin:16px 0 12px;">Отзывы</h3>
            ${reviewsHTML}
        ` : '<p style="text-align:center; color:#999; margin:16px 0;">Пока нет отзывов</p>'}
        
        ${userId ? '' : '<button class="btn btn-outline" style="margin-top:16px;" id="btn-logout">ВЫЙТИ</button>'}
        <button class="btn btn-outline" style="margin-top:8px;" onclick="closeModal()">ЗАКРЫТЬ</button>
    `);
    
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        STATE.isLoggedIn = false;
        STATE.user = null;
        localStorage.removeItem('greenFreelanceUser');
        closeModal();
        render();
    });
}

// ---------- ДЕЙСТВИЯ ----------
function registerUser() {
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const description = document.getElementById('reg-desc').value.trim();
    const role = document.getElementById('reg-role').value;
    
    if (!phone || !password || !username) {
        showAlert('Заполните все обязательные поля');
        return;
    }
    
    if (password.length < 4) {
        showAlert('Пароль должен быть не менее 4 символов');
        return;
    }
    
    // Проверка на существующего
    const exists = STATE.users.find(u => u.phone === phone || u.username === username);
    if (exists) {
        showAlert('Пользователь с таким телефоном или ником уже существует');
        return;
    }
    
    const newUser = {
        id: generateId(),
        phone,
        password,
        username,
        description,
        role,
        avatar: null,
        balance: 0,
        createdAt: Date.now()
    };
    
    STATE.users.push(newUser);
    STATE.user = newUser;
    STATE.isLoggedIn = true;
    
    saveData();
    saveUser();
    render();
    
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function loginUser() {
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    const user = STATE.users.find(u => u.phone === phone && u.password === password);
    
    if (!user) {
        showAlert('Неверный телефон или пароль');
        return;
    }
    
    STATE.user = user;
    STATE.isLoggedIn = true;
    saveUser();
    render();
    
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function createTask() {
    const title = document.getElementById('modal-task-title').value.trim();
    const description = document.getElementById('modal-task-desc').value.trim();
    const price = parseInt(document.getElementById('modal-task-price').value);
    
    if (!title || !description || !price) {
        showAlert('Заполните все поля');
        return;
    }
    
    if (price < 100) {
        showAlert('Минимальная цена: 100 ₽');
        return;
    }
    
    const task = {
        id: generateId(),
        title,
        description,
        price,
        customerId: STATE.user.id,
        cover: null,
        status: 'open',
        isPromoted: false,
        promotionType: null,
        promotionExpires: null,
        createdAt: Date.now()
    };
    
    STATE.tasks.unshift(task);
    saveData();
    closeModal();
    render();
    
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function activatePromotion(taskId, type, price) {
    const user = STATE.user;
    
    if (user.balance < price) {
        showAlert(`Недостаточно средств. Нужно ${price}₽, у вас ${user.balance}₽`);
        return;
    }
    
    user.balance -= price;
    
    const task = findTask(taskId);
    if (task) {
        // Деактивируем все старые баннеры
        STATE.tasks.forEach(t => {
            if (t.promotionType === 'banner') {
                t.isPromoted = false;
                t.promotionType = null;
                t.promotionExpires = null;
            }
        });
        
        task.isPromoted = true;
        task.promotionType = type;
        task.promotionExpires = Date.now() + 86400000; // 24 часа
    }
    
    STATE.user = user;
    saveData();
    saveUser();
    closeModal();
    render();
    
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function respondToTask(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    
    if (task.customerId === STATE.user.id) {
        showAlert('Вы не можете откликнуться на своё задание');
        return;
    }
    
    showAlert('Отклик отправлен! Заказчик получит уведомление');
    
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function submitReview(taskId, rating, comment) {
    const task = findTask(taskId);
    if (!task) return;
    
    // Проверка: уже оставлял отзыв
    const exists = STATE.reviews.find(r => r.taskId === taskId && r.reviewerId === STATE.user.id);
    if (exists) {
        showAlert('Вы уже оставили отзыв к этому заданию');
        return;
    }
    
    const review = {
        id: generateId(),
        taskId,
        rating,
        comment,
        reviewerId: STATE.user.id,
        userId: task.customerId,
        createdAt: Date.now()
    };
    
    STATE.reviews.push(review);
    saveData();
    closeModal();
    render();
    
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function showAlert(message) {
    if (tg?.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

// ---------- ПРИВЯЗКА СОБЫТИЙ ----------
function bindEvents() {
    // Регистрация
    document.getElementById('btn-register')?.addEventListener('click', registerUser);
    document.getElementById('btn-login')?.addEventListener('click', loginUser);
    
    document.getElementById('show-login')?.addEventListener('click', () => {
        document.getElementById('auth-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    
    document.getElementById('show-register')?.addEventListener('click', () => {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('auth-form').style.display = 'block';
    });
    
    // Главный экран
    document.getElementById('btn-create')?.addEventListener('click', showCreateTaskModal);
    document.getElementById('btn-mytasks')?.addEventListener('click', () => showAlert('Раздел в разработке'));
    document.getElementById('btn-promo')?.addEventListener('click', () => showPromoModal());
    document.getElementById('btn-promo-banner')?.addEventListener('click', () => showPromoModal());
    document.getElementById('btn-profile')?.addEventListener('click', () => showProfileModal());
    document.getElementById('btn-alltasks')?.addEventListener('click', () => showAlert('Все задания'));
    
    // Карточки заданий
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const taskId = card.dataset.taskId;
            if (taskId && !e.target.closest('.task-respond-btn')) {
                showTaskDetail(taskId);
            }
        });
    });
    
    // Кнопки отклика
    document.querySelectorAll('[data-action="respond"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            respondToTask(btn.dataset.taskId);
        });
    });
    
    // Промо баннер
    document.querySelector('.promo-banner')?.addEventListener('click', (e) => {
        const taskId = e.currentTarget.dataset.taskId;
        if (taskId) {
            showTaskDetail(taskId);
        }
    });
    
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const screen = btn.dataset.screen;
            handleNavClick(screen);
        });
    });
}

function showTaskDetail(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    
    const customer = findUser(task.customerId);
    const rating = customer ? getUserRating(customer.id) : 0;
    
    showModal(task.title, `
        <div style="margin-bottom:16px;">
            ${task.isPromoted ? '<span class="task-badge" style="margin-bottom:8px; display:inline-block;">ПРОДВИНУТО</span>' : ''}
            <div style="font-size:24px; font-weight:700; color:#16A34A; margin:8px 0;">${formatPrice(task.price)} ₽</div>
            <p style="color:#666; line-height:1.6;">${task.description}</p>
        </div>
        
        <div style="display:flex; align-items:center; gap:8px; padding:12px; background:#F0FDF4; border-radius:12px; margin-bottom:12px;">
            <div class="customer-avatar-mini" style="width:36px; height:36px; font-size:16px;">${customer?.username?.[0]?.toUpperCase() || '?'}</div>
            <div>
                <div style="font-weight:600;">${customer?.username || 'Неизвестный'}</div>
                <div class="rating">★ ${rating}</div>
            </div>
        </div>
        
        <button class="btn btn-primary" id="btn-respond-detail">ОТКЛИКНУТЬСЯ</button>
        ${task.customerId !== STATE.user?.id ? '' : '<button class="btn btn-outline" style="margin-top:8px;" id="btn-leave-review">ОСТАВИТЬ ОТЗЫВ</button>'}
        <button class="btn btn-outline" style="margin-top:8px;" onclick="closeModal()">ЗАКРЫТЬ</button>
    `);
    
    document.getElementById('btn-respond-detail')?.addEventListener('click', () => {
        respondToTask(taskId);
        closeModal();
    });
    
    document.getElementById('btn-leave-review')?.addEventListener('click', () => {
        closeModal();
        setTimeout(() => showReviewModal(taskId), 300);
    });
}

function handleNavClick(screen) {
    STATE.currentScreen = screen;
    
    // Активируем нужную кнопку
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.screen === screen);
    });
    
    switch(screen) {
        case 'home':
            render();
            break;
        case 'tasks':
            showAlert('Все задания');
            break;
        case 'create':
            showCreateTaskModal();
            break;
        case 'profile':
            showProfileModal();
            break;
    }
}

// ---------- ЗАПУСК ----------
loadData();
render();