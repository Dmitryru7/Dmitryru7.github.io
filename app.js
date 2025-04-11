const API = 'https://sahar.mist.net.ru';

// DOM элементы
const authPage = document.getElementById('auth-page');
const appContent = document.getElementById('app-content');
const timerElement = document.getElementById('timer');
const timerProgress = document.getElementById('timerProgress');
const claimButton = document.getElementById('claimButton');
const globalTimerElement = document.getElementById('globalTimer');
const levelElement = document.getElementById('level');
const switchTo24Hours = document.getElementById('switchTo24Hours');
const switchTo160Hours = document.getElementById('switchTo160Hours');
const navbarButtons = document.querySelectorAll('.nav-button');
const leaderboard = document.getElementById('leaderboard');
const friendsContent = document.getElementById('friends-content');
const taskList = document.getElementById('taskList');
const achievementsList = document.getElementById('achievementsList');
const pages = document.querySelectorAll('.page');

// Состояние приложения
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
        
        tgWebApp.expand();
        tgWebApp.enableClosingConfirmation();
        updateTelegramTheme();
        
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
        
        authPage.style.display = 'none';
        appContent.style.display = 'block';
        
        initButtons();
        loadUserData();
        showPage('home'); // Показываем домашнюю страницу по умолчанию
        
        if (data.user.isNewUser) {
            showNotification('Добро пожаловать в NotTime!', 'success');
        }
        
    } catch (error) {
        console.error('Ошибка инициализации Telegram:', error);
        showAuthPage();
    }
}

// Инициализация кнопок
function initButtons() {
    // Кнопка Старт/Забрать
    claimButton.addEventListener('click', handleTimerAction);
    
    // Переключатели режимов
    switchTo24Hours.addEventListener('click', () => switchTimerMode('24Hours'));
    switchTo160Hours.addEventListener('click', () => switchTimerMode('160Hours'));
    
    // Навигация
    navbarButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.dataset.page;
            showPage(pageId);
            setActiveNavButton(button);
        });
    });
}

// Показать страницу
function showPage(pageId) {
    // Скрыть все страницы
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Показать выбранную страницу
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active');
        
        // Загружаем данные для страницы при ее открытии
        switch(pageId) {
            case 'leaders':
                loadLeaderboard();
                break;
            case 'friends':
                loadFriendsPage();
                break;
            case 'tasks':
                loadTasksPage();
                break;
        }
    }
}

// Загрузка таблицы лидеров
async function loadLeaderboard() {
    try {
        const leaders = await fetch(`${API}/leaders`).then(r => r.json());
        updateLeaderboard(leaders);
    } catch (error) {
        console.error('Ошибка загрузки лидеров:', error);
        showNotification('Ошибка загрузки таблицы лидеров', 'error');
    }
}

// Обработчик основной кнопки таймера
async function handleTimerAction() {
    if (isTimerRunning()) {
        showConfirmation('Завершить таймер и получить награду?', claimTime);
    } else {
        showConfirmation(`Запустить ${currentTimerMode === '24Hours' ? '24-часовой' : '160-часовой'} таймер?`, startTimer);
    }
}

// Переключение режимов таймера
function switchTimerMode(mode) {
    if (isTimerRunning()) {
        showNotification('Нельзя менять режим во время работы таймера', 'error');
        return;
    }
    
    currentTimerMode = mode;
    updateTimerModeUI();
    timerElement.textContent = mode === '24Hours' ? '24:00:00' : '160:00:00';
    timerProgress.style.width = '0%';
}

// Обновление UI переключателей
function updateTimerModeUI() {
    switchTo24Hours.classList.toggle('active', currentTimerMode === '24Hours');
    switchTo160Hours.classList.toggle('active', currentTimerMode === '160Hours');
}

// Установка активной кнопки навигации
function setActiveNavButton(activeBtn) {
    navbarButtons.forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
}

// Проверка работает ли таймер
function isTimerRunning() {
    return timerElement.classList.contains('running');
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
    const totalTime = TIMER_DURATIONS[currentTimerMode];
    const progress = isRunning ? ((totalTime - remainingTime) / totalTime) * 100 : 0;
    
    timerProgress.style.width = `${progress}%`;
    timerElement.textContent = isRunning ? formatTime(remainingTime) : 
        (currentTimerMode === '24Hours' ? '24:00:00' : '160:00:00');
    
    if (isRunning) {
        timerElement.classList.add('running');
        claimButton.innerHTML = '<i class="fas fa-stop"></i> Забрать';
        disableTimerModeSwitcher();
    } else {
        timerElement.classList.remove('running');
        claimButton.innerHTML = '<i class="fas fa-play"></i> Старт';
        enableTimerModeSwitcher();
    }
    
    globalTimerElement.textContent = formatTime(accumulatedTime);
}

// Блокировка переключателей при работе таймера
function disableTimerModeSwitcher() {
    switchTo24Hours.disabled = true;
    switchTo160Hours.disabled = true;
}

// Разблокировка переключателей
function enableTimerModeSwitcher() {
    switchTo24Hours.disabled = false;
    switchTo160Hours.disabled = false;
}

// Обновление таблицы лидеров
function updateLeaderboard(leaders) {
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
    const nextClaimTime = data.nextClaimIn ? 
        formatSeconds(data.nextClaimIn) : 'Готово к получению';
    
    friendsContent.innerHTML = `
        <div class="referral-stats">
            ${data.referrer ? `
                <div class="info-box">
                    <i class="fas fa-user-plus"></i>
                    <span>Вас пригласил: <strong>${data.referrer}</strong></span>
                </div>
            ` : ''}
            
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
    
    document.getElementById('claimBonusBtn')?.addEventListener('click', claimReferralBonus);
}

// Загрузка страницы заданий
async function loadTasksPage() {
    try {
        const response = await fetch(`${API}/tasks/${currentUser.username}`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const data = await response.json();
        renderTasksPage(data);
    } catch (error) {
        console.error('Ошибка загрузки заданий:', error);
        showNotification('Ошибка загрузки заданий', 'error');
    }
}

// Отображение страницы заданий
function renderTasksPage(data) {
    taskList.innerHTML = data.tasks.map(task => `
        <li class="task-item ${task.completed ? 'completed' : ''}">
            <div class="task-info">
                <h3>${task.title}</h3>
                <p>${task.description}</p>
                <div class="task-progress">
                    <progress value="${task.progress}" max="${task.required}"></progress>
                    <span>${task.progress}/${task.required}</span>
                </div>
            </div>
            <button class="claim-task-btn" ${task.canClaim ? '' : 'disabled'}>
                ${task.reward} XP
            </button>
        </li>
    `).join('');

    achievementsList.innerHTML = data.achievements.map(ach => `
        <li class="achievement-item ${ach.completed ? 'unlocked' : 'locked'}">
            <i class="fas ${ach.completed ? 'fa-check-circle' : 'fa-lock'}"></i>
            <div>
                <h3>${ach.title}</h3>
                <p>${ach.description}</p>
            </div>
        </li>
    `).join('');
}

// Генерация реферальной ссылки
function generateReferralLink() {
    if (!currentUser?.referralCode) return '';
    
    if (window.Telegram?.WebApp) {
        const botUsername = Telegram.WebApp.initDataUnsafe.user?.username || 'bigdik30cm_bot';
        const startParam = `ref_${currentUser.referralCode}`;
        return `https://t.me/${botUsername}?startapp=${startParam}`;
    }
    
    return `https://t.me/bigdik30cm_bot?start=ref_${currentUser.referralCode}`;
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

// Глобальные функции для HTML
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

// Форматирование секунд в HH:MM:SS
function formatSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Обновление темы Telegram
function updateTelegramTheme() {
    if (!window.Telegram?.WebApp) return;
    
    const theme = Telegram.WebApp.themeParams;
    document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color || '#1e1e1e');
    document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-button-color', theme.button_color || '#2ea6ff');
    document.documentElement.style.setProperty('--tg-theme-button-text-color', theme.button_text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color || '#2e2e2e');
    document.documentElement.style.setProperty('--tg-theme-hint-color', theme.hint_color || '#aaaaaa');
}

// Тактильная отдача
function triggerHapticFeedback(type) {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
}

// Получение реферального кода из URL
function getReferralCodeFromUrl() {
    if (window.Telegram?.WebApp) {
        const startParam = Telegram.WebApp.initDataUnsafe.start_param;
        if (startParam && startParam.startsWith('ref_')) {
            return startParam.substring(4);
        }
    }
    return null;
}

// Показ уведомлений
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Подтверждение действий
function showConfirmation(message, callback) {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.showConfirm(message, (confirmed) => {
            if (confirmed) callback();
        });
    } else if (confirm(message)) {
        callback();
    }
}
