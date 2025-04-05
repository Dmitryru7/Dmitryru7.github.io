const API = 'https://sahar.mist.net.ru'; // Замените на ваш API URL

// DOM элементы
const authPage = document.getElementById('auth-page');
const appContent = document.getElementById('app-content');
const timerElement = document.getElementById('timer');
const claimButton = document.getElementById('claimButton');
const globalTimerElement = document.getElementById('globalTimer');
const navbarButtons = document.querySelectorAll('.navbar button');

let currentUser = null;
let pollingInterval = null;
let currentTimerMode = '24Hours';
const TIMER_DURATIONS = {
    '24Hours': 24 * 60 * 60 * 1000,
    '160Hours': 160 * 60 * 60 * 1000
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    if (window.Telegram?.WebApp) {
        await initTelegramApp();
    } else {
        showAuthPage();
    }
});

// Инициализация Telegram WebApp
async function initTelegramApp() {
    try {
        const tgWebApp = Telegram.WebApp;
        tgWebApp.expand();
        tgWebApp.enableClosingConfirmation();
        
        const response = await fetch(`${API}/tg-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                initData: tgWebApp.initData,
                referralCode: getReferralCodeFromUrl()
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        currentUser = data.user.username;
        localStorage.setItem('username', currentUser);
        
        authPage.style.display = 'none';
        appContent.style.display = 'block';
        
        initApp();
        updateTelegramTheme();
        
        if (data.user.isNewUser) {
            showNotification('Добро пожаловать в NotTime!', 'success');
        }
    } catch (error) {
        console.error('Telegram init error:', error);
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
}

// Инициализация основного функционала
function initApp() {
    // Загрузка данных пользователя
    loadUserData();
    
    // Настройка навигации
    navbarButtons.forEach(button => {
        button.addEventListener('click', () => showPage(button.dataset.page));
    });
    
    // Настройка таймера
    document.getElementById('switchTo24Hours').addEventListener('click', () => {
        currentTimerMode = '24Hours';
        updateTimerModeButtons();
        timerElement.textContent = '24:00:00';
    });
    
    document.getElementById('switchTo160Hours').addEventListener('click', () => {
        currentTimerMode = '160Hours';
        updateTimerModeButtons();
        timerElement.textContent = '160:00:00';
    });
    
    claimButton.addEventListener('click', () => {
        claimButton.textContent === 'Забрать' ? claimTime() : startTimer();
    });
    
    // Показываем сохраненную страницу или домашнюю
    showPage(localStorage.getItem('currentPage') || 'home');
}

// Загрузка данных пользователя
async function loadUserData() {
    try {
        const [status, leaders] = await Promise.all([
            fetch(`${API}/status/${currentUser}`).then(r => r.json()),
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
        loadTasks();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Таймер и его отображение
function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTimerDisplay(accumulatedTime, remainingTime, isRunning) {
    if (isRunning) {
        timerElement.textContent = formatTime(remainingTime);
        claimButton.textContent = 'Забрать';
        claimButton.disabled = remainingTime > 0;
        disableTimerModeSwitcher();
    } else {
        timerElement.textContent = currentTimerMode === '24Hours' ? '24:00:00' : '160:00:00';
        claimButton.textContent = 'Старт';
        claimButton.disabled = false;
        enableTimerModeSwitcher();
    }
    globalTimerElement.textContent = `Накоплено: ${formatTime(accumulatedTime)}`;
}

// Работа с таймером
async function startTimer() {
    try {
        const response = await fetch(`${API}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: currentUser,
                duration: TIMER_DURATIONS[currentTimerMode]
            }),
        });
        
        if (response.ok) {
            startPolling();
            disableTimerModeSwitcher();
            showNotification('Таймер запущен!', 'success');
        }
    } catch (error) {
        showNotification('Ошибка запуска таймера', 'error');
    }
}

async function claimTime() {
    try {
        const response = await fetch(`${API}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser }),
        });
        
        if (response.ok) {
            const data = await response.json();
            clearInterval(pollingInterval);
            updateTimerDisplay(data.accumulatedTime, 0, false);
            showNotification(`Получено ${formatTime(data.earned)}!`, 'success');
            loadUserData();
        }
    } catch (error) {
        showNotification('Ошибка получения времени', 'error');
    }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        const status = await fetch(`${API}/status/${currentUser}`).then(r => r.json());
        updateTimerDisplay(
            status.accumulatedTime,
            status.remainingTime,
            status.isRunning
        );
    }, 1000);
}

// Реферальная система
async function loadFriendsPage() {
    try {
        const response = await fetch(`${API}/referrals/${currentUser}`);
        const data = await response.json();
        
        let referrerInfo = '';
        if (data.referrer) {
            referrerInfo = `<p>Вас пригласил: <strong>${data.referrer}</strong></p>`;
        }
        
        const nextClaimTime = data.nextClaimIn ? 
            formatSeconds(data.nextClaimIn) : 'Готово к получению';
        
        document.getElementById('friends-content').innerHTML = `
            <div class="referral-card">
                <h3>Реферальная программа</h3>
                ${referrerInfo}
                <div class="referral-stats">
                    <div class="stat-row">
                        <span>Доступно:</span>
                        <span class="highlight">${formatTime(data.pendingBonus)}</span>
                    </div>
                    <div class="stat-row">
                        <span>Всего получено:</span>
                        <span>${formatTime(data.totalEarned)}</span>
                    </div>
                    <button id="claimBonusBtn" class="tg-button" ${data.canClaim ? '' : 'disabled'}>
                        ${data.canClaim ? 'Получить 10%' : `Доступно через: ${nextClaimTime}`}
                    </button>
                </div>
                
                <div class="referral-link-section">
                    <p>Ваша реферальная ссылка:</p>
                    <div class="input-group">
                        <input type="text" id="referralLink" value="https://t.me/bigdik30ccm_bot?startapp=ref_${data.referralCode}" readonly>
                        <button onclick="copyReferralLink()">Копировать</button>
                    </div>
                    <button onclick="shareReferralLink()" class="tg-button">
                        <i class="fas fa-share-alt"></i> Поделиться
                    </button>
                </div>
            </div>
            
            <div class="referrals-list">
                <h4>Ваши рефералы (${data.referrals.length})</h4>
                <ul>
                    ${data.referrals.map(ref => `
                        <li>
                            <span>${ref.username}</span>
                            <span>+${formatTime(ref.earned)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        
        document.getElementById('claimBonusBtn')?.addEventListener('click', claimReferralBonus);
    } catch (error) {
        console.error('Error loading friends page:', error);
    }
}

function formatSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function claimReferralBonus() {
    try {
        const response = await fetch(`${API}/claim-referral-bonus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(`Получено +${formatTime(result.bonus)}!`, 'success');
            loadFriendsPage();
            
            if (window.Telegram?.WebApp) {
                Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        showNotification('Ошибка при получении бонуса', 'error');
    }
}

function copyReferralLink() {
    const input = document.getElementById('referralLink');
    input.select();
    document.execCommand('copy');
    showNotification('Ссылка скопирована!', 'success');
    
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}

function shareReferralLink() {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.shareUrl(
            document.getElementById('referralLink').value,
            'Присоединяйся к NotTime и получай бонусы!'
        );
    } else {
        copyReferralLink();
    }
}

// Вспомогательные функции
function getReferralCodeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref');
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    localStorage.setItem('currentPage', pageId);
    
    if (pageId === 'friends') {
        loadFriendsPage();
    } else if (pageId === 'tasks') {
        loadTasks();
    }
}

function updateTimerModeButtons() {
    document.querySelectorAll('.timer-mode-switcher button').forEach(button => {
        button.classList.remove('active');
    });
    document.getElementById(`switchTo${currentTimerMode}`).classList.add('active');
}

function disableTimerModeSwitcher() {
    document.querySelectorAll('.timer-mode-switcher button').forEach(button => {
        button.disabled = true;
    });
}

function enableTimerModeSwitcher() {
    document.querySelectorAll('.timer-mode-switcher button').forEach(button => {
        button.disabled = false;
    });
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Глобальные функции для использования в HTML
window.copyReferralLink = copyReferralLink;
window.shareReferralLink = shareReferralLink;
