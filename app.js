const API = 'https://sahar.mist.net.ru'; // Замените на ваш API URL

// DOM элементы
const authPage = document.getElementById('auth-page');
const appContent = document.getElementById('app-content');
const timerElement = document.getElementById('timer');
const timerProgress = document.getElementById('timerProgress');
const claimButton = document.getElementById('claimButton');
const globalTimerElement = document.getElementById('globalTimer');
const levelElement = document.getElementById('level');
const navbarButtons = document.querySelectorAll('.nav-button');
const switchTo24Hours = document.getElementById('switchTo24Hours');
const switchTo160Hours = document.getElementById('switchTo160Hours');

let currentUser = null;
let pollingInterval = null;
let currentTimerMode = '24Hours';
const TIMER_DURATIONS = {
    '24Hours': 24 * 60 * 60 * 1000,
    '160Hours': 160 * 60 * 60 * 1000
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    checkPlatform();
    
    if (window.Telegram?.WebApp) {
        await initTelegramApp();
    } else {
        showAuthPage();
    }
    
    // Инициализация переключателя режимов таймера
    switchTo24Hours.addEventListener('click', () => {
        currentTimerMode = '24Hours';
        updateTimerModeButtons();
        if (!isTimerRunning()) {
            timerElement.textContent = '24:00:00';
        }
    });
    
    switchTo160Hours.addEventListener('click', () => {
        currentTimerMode = '160Hours';
        updateTimerModeButtons();
        if (!isTimerRunning()) {
            timerElement.textContent = '160:00:00';
        }
    });
    
    // Инициализация навигации
    navbarButtons.forEach(button => {
        button.addEventListener('click', () => {
            showPage(button.dataset.page);
            navbarButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
});

// Проверка платформы
function checkPlatform() {
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    if (!isMobile && !window.Telegram?.WebApp) {
        document.body.classList.add('desktop');
    }
}

// Показать страницу авторизации
function showAuthPage() {
    authPage.style.display = 'flex';
    appContent.style.display = 'none';
}

// Инициализация Telegram WebApp
async function initTelegramApp() {
    try {
        const tgWebApp = Telegram.WebApp;
        
        // Инициализация WebApp
        tgWebApp.expand();
        tgWebApp.enableClosingConfirmation();
        
        // Настройка темы
        updateTelegramTheme();
        
        // Авторизация
        const response = await fetch(`${API}/tg-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                initData: tgWebApp.initData,
                referralCode: getReferralCodeFromUrl()
            })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка авторизации');
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        // Показываем интерфейс приложения
        authPage.style.display = 'none';
        appContent.style.display = 'block';
        
        // Загружаем данные пользователя
        loadUserData();
        
        // Показываем приветственное сообщение для новых пользователей
        if (data.user.isNewUser) {
            showNotification('Добро пожаловать в NotTime!', 'success');
        }
        
    } catch (error) {
        console.error('Ошибка инициализации Telegram:', error);
        showAuthPage();
    }
}

// Обновление темы Telegram
function updateTelegramTheme() {
    if (!window.Telegram?.WebApp) return;
    
    document.documentElement.style.setProperty(
        '--tg-theme-bg-color', Telegram.WebApp.themeParams.bg_color || '#1e1e1e'
    );
    document.documentElement.style.setProperty(
        '--tg-theme-text-color', Telegram.WebApp.themeParams.text_color || '#ffffff'
    );
    document.documentElement.style.setProperty(
        '--tg-theme-button-color', Telegram.WebApp.themeParams.button_color || '#2ea6ff'
    );
    document.documentElement.style.setProperty(
        '--tg-theme-button-text-color', Telegram.WebApp.themeParams.button_text_color || '#ffffff'
    );
    document.documentElement.style.setProperty(
        '--tg-theme-secondary-bg-color', Telegram.WebApp.themeParams.secondary_bg_color || '#2e2e2e'
    );
    document.documentElement.style.setProperty(
        '--tg-theme-hint-color', Telegram.WebApp.themeParams.hint_color || '#aaaaaa'
    );
}

// Загрузка данных пользователя
async function loadUserData() {
    try {
        const [status, leaders] = await Promise.all([
            fetch(`${API}/status/${currentUser.username}`).then(r => r.json()),
            fetch(`${API}/leaders`).then(r => r.json())
        ]);
        
        updateTimerDisplay(
            status.accumulatedTime,
            status.remainingTime,
            status.isRunning
        );
        
        if (status.isRunning) {
            startPolling();
        }
        
        updateLeaderboard(leaders);
        updateLevel(status.level || 1);
        
        // Показываем домашнюю страницу
        showPage('home');
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Форматирование времени
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Обновление отображения таймера
function updateTimerDisplay(accumulatedTime, remainingTime, isRunning) {
    if (isRunning) {
        const totalTime = TIMER_DURATIONS[currentTimerMode];
        const progress = ((totalTime - remainingTime) / totalTime) * 100;
        timerProgress.style.width = `${progress}%`;
        
        timerElement.textContent = formatTime(remainingTime);
        timerElement.classList.add('running');
        claimButton.innerHTML = '<i class="fas fa-stop"></i> Забрать';
        disableTimerModeSwitcher();
    } else {
        timerProgress.style.width = '0%';
        timerElement.textContent = currentTimerMode === '24Hours' ? '24:00:00' : '160:00:00';
        timerElement.classList.remove('running');
        claimButton.innerHTML = '<i class="fas fa-play"></i> Старт';
        enableTimerModeSwitcher();
    }
    
    globalTimerElement.textContent = formatTime(accumulatedTime);
}

// Обновление таблицы лидеров
function updateLeaderboard(leaders) {
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = leaders && leaders.length > 0
        ? leaders.map((user, index) => `
            <li>
                <span class="leader-position">${index + 1}.</span>
                <span class="leader-name">${user.username || 'Аноним'}</span>
                <span class="leader-time">${formatTime(user.accumulatedTime || 0)}</span>
            </li>
        `).join('')
        : '<li class="empty">Пока никто не участвовал</li>';
}

// Обновление уровня
function updateLevel(level) {
    levelElement.textContent = level;
}

// Запуск таймера
async function startTimer() {
    try {
        const response = await fetch(`${API}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: currentUser.username,
                duration: TIMER_DURATIONS[currentTimerMode]
            }),
        });
        
        if (response.ok) {
            startPolling();
            showNotification('Таймер запущен!', 'success');
            triggerHapticFeedback('light');
        } else {
            throw new Error('Ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка запуска таймера:', error);
        showNotification('Ошибка запуска таймера', 'error');
    }
}

// Завершение таймера
async function claimTime() {
    try {
        const response = await fetch(`${API}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username }),
        });
        
        if (response.ok) {
            const data = await response.json();
            clearInterval(pollingInterval);
            updateTimerDisplay(data.accumulatedTime, 0, false);
            showNotification(`Получено ${formatTime(data.earned)}!`, 'success');
            triggerHapticFeedback('success');
            loadUserData();
        } else {
            throw new Error('Ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка завершения таймера:', error);
        showNotification('Ошибка завершения таймера', 'error');
    }
}

// Опрос статуса таймера
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        try {
            const status = await fetch(`${API}/status/${currentUser.username}`).then(r => r.json());
            updateTimerDisplay(
                status.accumulatedTime,
                status.remainingTime,
                status.isRunning
            );
            
            if (!status.isRunning) {
                clearInterval(pollingInterval);
            }
        } catch (error) {
            console.error('Ошибка опроса:', error);
            clearInterval(pollingInterval);
        }
    }, 1000);
}

// Переключение страниц
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    document.getElementById(pageId).classList.add('active');
    localStorage.setItem('currentPage', pageId);
    
    // Загружаем данные для страницы
    if (pageId === 'friends') {
        loadFriendsPage();
    } else if (pageId === 'tasks') {
        loadTasksPage();
    }
}

// Загрузка страницы друзей
async function loadFriendsPage() {
    try {
        const response = await fetch(`${API}/referrals/${currentUser.username}`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const data = await response.json();
        renderFriendsPage(data);
    } catch (error) {
        console.error('Ошибка загрузки друзей:', error);
        showNotification('Ошибка загрузки друзей', 'error');
    }
}

// Отображение страницы друзей
function renderFriendsPage(data) {
    const friendsContent = document.getElementById('friends-content');
    
    let referrerInfo = '';
    if (data.referrer) {
        referrerInfo = `
            <div class="info-box">
                <i class="fas fa-user-plus"></i>
                <span>Вас пригласил: <strong>${data.referrer}</strong></span>
            </div>
        `;
    }
    
    const nextClaimTime = data.nextClaimIn ? 
        formatSeconds(data.nextClaimIn) : 'Готово к получению';
    
    friendsContent.innerHTML = `
        <div class="referral-stats">
            ${referrerInfo}
            
            <div class="stats-row">
                <div class="stat-box">
                    <span class="stat-label">Доступно</span>
                    <span class="stat-value highlight">${formatTime(data.pendingBonus)}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Всего получено</span>
                    <span class="stat-value">${formatTime(data.totalEarned)}</span>
                </div>
            </div>
            
            <button id="claimBonusBtn" class="action-button primary" ${data.canClaim ? '' : 'disabled'}>
                <i class="fas fa-coins"></i>
                ${data.canClaim ? 'Получить 10%' : `Доступно через: ${nextClaimTime}`}
            </button>
        </div>
        
        <div class="referral-link-section">
            <h3><i class="fas fa-link"></i> Ваша реферальная ссылка</h3>
            <div class="input-group">
                <input type="text" id="referralLink" value="${generateReferralLink()}" readonly>
                <button onclick="copyReferralLink()" class="action-button">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <button onclick="shareReferralLink()" class="action-button secondary">
                <i class="fas fa-share-alt"></i> Поделиться
            </button>
        </div>
        
        <div class="referrals-list">
            <h3><i class="fas fa-users"></i> Ваши рефералы (${data.referrals.length})</h3>
            <ul>
                ${data.referrals.map(ref => `
                    <li class="referral-item">
                        <div class="user-info">
                            <div class="user-avatar">${ref.username.charAt(0).toUpperCase()}</div>
                            <span>${ref.username}</span>
                        </div>
                        <span class="referral-bonus">+${formatTime(ref.earned)}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    
    // Назначаем обработчик кнопки получения бонуса
    document.getElementById('claimBonusBtn')?.addEventListener('click', claimReferralBonus);
}

// Генерация реферальной ссылки
function generateReferralLink() {
    if (!currentUser?.referralCode) return '';
    
    if (window.Telegram?.WebApp) {
        const tg = Telegram.WebApp;
        const botUsername = tg.initDataUnsafe.user?.username || 'your_bot';
        const startParam = `ref_${currentUser.referralCode}`;
        return `https://t.me/${botUsername}?startapp=${startParam}`;
    }
    
    return `https://t.me/your_bot?start=ref_${currentUser.referralCode}`;
}

// Получение реферального бонуса
async function claimReferralBonus() {
    try {
        const response = await fetch(`${API}/claim-referral-bonus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Получено +${formatTime(result.bonus)}!`, 'success');
            triggerHapticFeedback('success');
            loadFriendsPage();
            loadUserData();
        } else {
            throw new Error('Ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка получения бонуса:', error);
        showNotification('Ошибка получения бонуса', 'error');
    }
}

// Вспомогательные функции
function getReferralCodeFromUrl() {
    if (window.Telegram?.WebApp) {
        const startParam = Telegram.WebApp.initDataUnsafe.start_param;
        if (startParam && startParam.startsWith('ref_')) {
            return startParam.substring(4);
        }
    }
    return null;
}

function formatSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isTimerRunning() {
    return timerElement.classList.contains('running');
}

function updateTimerModeButtons() {
    const buttons = {
        '24Hours': switchTo24Hours,
        '160Hours': switchTo160Hours
    };
    
    Object.values(buttons).forEach(btn => btn.classList.remove('active'));
    buttons[currentTimerMode].classList.add('active');
}

function disableTimerModeSwitcher() {
    switchTo24Hours.disabled = true;
    switchTo160Hours.disabled = true;
}

function enableTimerModeSwitcher() {
    switchTo24Hours.disabled = false;
    switchTo160Hours.disabled = false;
}

function triggerHapticFeedback(type) {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
}

// Глобальные функции для использования в HTML
window.copyReferralLink = function() {
    const input = document.getElementById('referralLink');
    input.select();
    document.execCommand('copy');
    showNotification('Ссылка скопирована!', 'success');
    triggerHapticFeedback('light');
};

window.shareReferralLink = function() {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.shareUrl(
            document.getElementById('referralLink').value,
            'Присоединяйся к NotTime и получай бонусы!'
        );
    } else {
        window.copyReferralLink();
    }
};

// Уведомления
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Инициализация кнопки таймера
function toggleTimer() {
    if (isTimerRunning()) {
        showConfirmation('Завершить таймер и получить награду?', claimTime);
    } else {
        showConfirmation('Запустить таймер?', startTimer);
    }
}

// Функция подтверждения действий
function showConfirmation(message, callback) {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.showConfirm(message, (confirmed) => {
            if (confirmed) callback();
        });
    } else if (confirm(message)) {
        callback();
    }
}
