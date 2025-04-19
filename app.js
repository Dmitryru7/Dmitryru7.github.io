const API = 'https://sahar.mist.net.ru';

// DOM элементы
const authPage = document.getElementById('auth-page');
const appContent = document.getElementById('app-content');
const timerElement = document.getElementById('timer');
const timerProgress = document.getElementById('timerProgress');
const claimButton = document.getElementById('claimButton');
const globalTimerElement = document.getElementById('globalTimer');
const sessionTimerElement = document.getElementById('sessionTimer');
const levelElement = document.getElementById('level');
const xpProgressElement = document.getElementById('xpProgress');
const xpFillElement = document.getElementById('xpFill');
const switchTo24Hours = document.getElementById('switchTo24Hours');
const switchTo160Hours = document.getElementById('switchTo160Hours');
const navbarButtons = document.querySelectorAll('.nav-button');
const leaderboard = document.getElementById('leaderboard');
const userPositionElement = document.getElementById('userPosition');
const userRankElement = document.getElementById('userRank');
const referralsCountElements = document.querySelectorAll('#referralsCount');
const pendingBonusElement = document.getElementById('pendingBonus');
const totalEarnedElement = document.getElementById('totalEarned');
const claimBonusBtn = document.getElementById('claimBonusBtn');
const nextClaimInfo = document.getElementById('nextClaimInfo');
const referralsContainer = document.getElementById('referralsContainer');
const taskList = document.getElementById('taskList');
const achievementsList = document.getElementById('achievementsList');
const pages = document.querySelectorAll('.page');
const timerModeLabel = document.getElementById('timerModeLabel');

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
        try {
            await initTelegramApp();
        } catch (error) {
            console.error('Init error:', error);
            showNotification('Ошибка инициализации', 'error');
            showAuthPage();
        }
    } else {
        showAuthPage();
    }
});

function checkPlatform() {
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    if (!isMobile && !window.Telegram?.WebApp) {
        document.body.classList.add('desktop');
    }
}

function showAuthPage() {
    authPage.style.display = 'flex';
    appContent.style.display = 'none';
}

async function initTelegramApp() {
    const tgWebApp = Telegram.WebApp;
    
    if (!tgWebApp.initData) {
        throw new Error("Telegram initData not available");
    }

    tgWebApp.expand();
    tgWebApp.enableClosingConfirmation();
    updateTelegramTheme();
    
    const response = await fetch(`${API}/tg-auth`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ 
            initData: tgWebApp.initData,
            referralCode: getReferralCodeFromUrl()
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Auth error: ${errorText}`);
    }
    
    const data = await response.json();
    currentUser = data.user;
    
    authPage.style.display = 'none';
    appContent.style.display = 'block';
    
    initButtons();
    loadUserData();
    showPage('home');
    
    if (data.user.isNewUser) {
        showNotification('Добро пожаловать в NotTime!', 'success');
    }
}

function initButtons() {
    claimButton.addEventListener('click', handleTimerAction);
    
    switchTo24Hours.addEventListener('click', () => switchTimerMode('24Hours'));
    switchTo160Hours.addEventListener('click', () => switchTimerMode('160Hours'));
    
    navbarButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.dataset.page;
            showPage(pageId);
            setActiveNavButton(button);
        });
    });
    
    claimBonusBtn.addEventListener('click', async () => {
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
    });
}

function showPage(pageId) {
    pages.forEach(page => page.classList.remove('active'));
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active');
        
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

function setActiveNavButton(activeBtn) {
    navbarButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.querySelector('i').style.color = '';
        btn.querySelector('span').style.color = '';
    });
    
    activeBtn.classList.add('active');
    activeBtn.querySelector('i').style.color = 'var(--tg-theme-button-color)';
    activeBtn.querySelector('span').style.color = 'var(--tg-theme-button-color)';
}

async function handleTimerAction() {
    if (isTimerRunning()) {
        try {
            const status = await fetch(`${API}/status/${currentUser.username}`).then(r => r.json());
            
            if (status.remainingTime <= 0) {
                showConfirmation('Завершить таймер и получить награду?', claimTime);
            } else {
                showNotification('Таймер еще не завершен! Дождитесь окончания.', 'error');
                triggerHapticFeedback('error');
            }
        } catch (error) {
            console.error('Timer check error:', error);
            showNotification('Ошибка проверки таймера', 'error');
        }
    } else {
        showConfirmation(`Запустить ${currentTimerMode === '24Hours' ? '24-часовой' : '160-часовой'} таймер?`, startTimer);
    }
}

function switchTimerMode(mode) {
    if (isTimerRunning()) {
        showNotification('Нельзя менять режим во время работы таймера', 'error');
        return;
    }
    
    currentTimerMode = mode;
    updateTimerModeUI();
    timerElement.textContent = mode === '24Hours' ? '24:00:00' : '160:00:00';
    timerProgress.style.width = '0%';
    timerModeLabel.textContent = mode === '24Hours' ? '24-часовой режим' : '160-часовой режим';
}

function updateTimerModeUI() {
    switchTo24Hours.classList.toggle('active', currentTimerMode === '24Hours');
    switchTo160Hours.classList.toggle('active', currentTimerMode === '160Hours');
}

function isTimerRunning() {
    return timerElement.classList.contains('running');
}

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
        updateUserStats(status);
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
        
        // Fallback данные
        updateTimerDisplay(0, 0, false);
        updateLeaderboard([]);
    }
}

function updateUserStats(status) {
    levelElement.textContent = status.level || 1;
    userRankElement.textContent = status.rank || '-';
    
    const xpPercentage = Math.min((status.xp / status.xpToNextLevel) * 100, 100);
    xpProgressElement.textContent = `${status.xp}/${status.xpToNextLevel} XP`;
    xpFillElement.style.width = `${xpPercentage}%`;
}

function updateTimerDisplay(accumulatedTime, remainingTime, isRunning) {
    const totalTime = TIMER_DURATIONS[currentTimerMode];
    const progress = isRunning ? ((totalTime - remainingTime) / totalTime) * 100 : 0;
    
    timerProgress.style.width = `${progress}%`;
    timerElement.textContent = isRunning ? formatTime(remainingTime) : 
        (currentTimerMode === '24Hours' ? '24:00:00' : '160:00:00');
    
    if (isRunning) {
        timerElement.classList.add('running');
        claimButton.innerHTML = '<i class="fas fa-stop"></i> Забрать';
        claimButton.disabled = remainingTime > 0;
        disableTimerModeSwitcher();
    } else {
        timerElement.classList.remove('running');
        claimButton.innerHTML = '<i class="fas fa-play"></i> Старт';
        claimButton.disabled = false;
        enableTimerModeSwitcher();
    }
    
    globalTimerElement.textContent = formatTime(accumulatedTime);
    const sessionTime = isRunning ? totalTime - remainingTime : 0;
    sessionTimerElement.textContent = formatTime(sessionTime);
}

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
            
            if (!status.isRunning || status.remainingTime <= 0) {
                clearInterval(pollingInterval);
                if (status.remainingTime <= 0) {
                    claimButton.disabled = false;
                    showNotification('Таймер завершен! Нажмите "Забрать" для получения награды', 'success');
                }
            }
        } catch (error) {
            console.error('Ошибка опроса:', error);
            clearInterval(pollingInterval);
        }
    }, 5000);
}

async function startTimer() {
    try {
        const response = await fetch(`${API}/start`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
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
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка запуска таймера:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
        triggerHapticFeedback('error');
    }
}

async function claimTime() {
    try {
        const status = await fetch(`${API}/status/${currentUser.username}`).then(r => r.json());
        
        if (status.remainingTime > 0) {
            throw new Error('Таймер еще не завершен');
        }
        
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
        showNotification(error.message || 'Ошибка завершения таймера', 'error');
    }
}

async function loadLeaderboard() {
    try {
        const [leaders, userPosition] = await Promise.all([
            fetch(`${API}/leaders`).then(r => r.json()),
            fetch(`${API}/user-position/${currentUser.username}`).then(r => r.json())
        ]);
        
        updateLeaderboard(leaders);
        updateUserPosition(userPosition);
    } catch (error) {
        console.error('Ошибка загрузки лидеров:', error);
        showNotification('Ошибка загрузки таблицы лидеров', 'error');
        updateLeaderboard([]);
    }
}

function updateLeaderboard(leaders) {
    if (!leaders || leaders.length === 0) {
        leaders = [
            { username: "Пример1", accumulatedTime: 86400000 },
            { username: "Пример2", accumulatedTime: 43200000 }
        ];
    }
    
    leaderboard.innerHTML = leaders.map((user, index) => `
        <li>
            <span class="leader-position">${index + 1}.</span>
            <span class="leader-name">${user.username || 'Аноним'}</span>
            <span class="leader-time">${formatTime(user.accumulatedTime || 0)}</span>
        </li>
    `).join('');
}

function updateUserPosition(position) {
    if (position && position.rank) {
        userPositionElement.innerHTML = `
            <span>Ваша позиция: <strong>${position.rank}</strong></span>
            <span class="position-time">${formatTime(position.accumulatedTime)}</span>
        `;
    } else {
        userPositionElement.innerHTML = '<span>Ваша позиция: не в топе</span>';
    }
}

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

function renderFriendsPage(data) {
    pendingBonusElement.textContent = formatTime(data.pendingBonus || 0);
    totalEarnedElement.textContent = formatTime(data.totalEarned || 0);
    
    referralsCountElements.forEach(el => {
        el.textContent = data.referrals.length || 0;
    });
    
    const canClaim = data.canClaim && data.pendingBonus > 0;
    claimBonusBtn.disabled = !canClaim;
    
    if (canClaim) {
        claimBonusBtn.innerHTML = '<i class="fas fa-gift"></i> Получить 10%';
        nextClaimInfo.style.display = 'none';
    } else {
        const nextClaimTime = data.nextClaimIn ? formatSeconds(data.nextClaimIn) : '00:00:00';
        nextClaimInfo.innerHTML = `
            <i class="fas fa-clock"></i>
            <span>Следующее получение: <strong>${nextClaimTime}</strong></span>
        `;
        nextClaimInfo.style.display = 'flex';
    }
    
    if (data.referrals.length > 0) {
        referralsContainer.classList.remove('empty-state');
        referralsContainer.innerHTML = `
            <ul class="referral-items">
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
        `;
    } else {
        referralsContainer.classList.add('empty-state');
        referralsContainer.innerHTML = `
            <i class="fas fa-user-plus"></i>
            <p>Пригласите друзей и получайте 10% от их времени</p>
        `;
    }
    
    const referralLink = document.getElementById('referralLink');
    if (referralLink) {
        referralLink.value = generateReferralLink();
    }
}

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
        <div class="achievement-item ${ach.completed ? 'unlocked' : 'locked'}">
            <i class="fas ${ach.completed ? 'fa-check-circle' : 'fa-lock'}"></i>
            <div>
                <h3>${ach.title}</h3>
                <p>${ach.description}</p>
            </div>
        </div>
    `).join('');
}

function generateReferralLink() {
    if (!currentUser?.referralCode) return 'Загрузка...';
    
    if (window.Telegram?.WebApp) {
        const botUsername = Telegram.WebApp.initDataUnsafe.user?.username || 'bigdik30cm_bot';
        const startParam = `ref_${currentUser.referralCode}`;
        return `https://t.me/${botUsername}?startapp=${startParam}`;
    }
    
    return `https://t.me/bigdik30cm_bot?start=ref_${currentUser.referralCode}`;
}

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

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function disableTimerModeSwitcher() {
    switchTo24Hours.disabled = true;
    switchTo160Hours.disabled = true;
}

function enableTimerModeSwitcher() {
    switchTo24Hours.disabled = false;
    switchTo160Hours.disabled = false;
}

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

function triggerHapticFeedback(type) {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
}

function getReferralCodeFromUrl() {
    if (window.Telegram?.WebApp) {
        const startParam = Telegram.WebApp.initDataUnsafe.start_param;
        if (startParam && startParam.startsWith('ref_')) {
            return startParam.substring(4);
        }
    }
    return null;
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showConfirmation(message, callback) {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.showConfirm(message, (confirmed) => {
            if (confirmed) callback();
        });
    } else if (confirm(message)) {
        callback();
    }
}
