const authPage = document.getElementById('auth-page');
const appContent = document.getElementById('app-content');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const timerElement = document.getElementById('timer');
const claimButton = document.getElementById('claimButton');
const globalTimerElement = document.getElementById('globalTimer');
const logoutButton = document.getElementById('logoutButton');
const leaderboardElement = document.getElementById('leaderboard');
const navbarButtons = document.querySelectorAll('.navbar button');
const referralToggle = document.getElementById('referralToggle');
const referralInput = document.getElementById('referralCode');
const taskListElement = document.getElementById('taskList');
const historyButton = document.getElementById('historyButton');
const levelDisplay = document.getElementById('level');
let API = 'http://212.113.102.87:3000';
//let API = 'http://212.113.102.87:3000';

let currentUser = null;
let pollingInterval = null;
let currentTimerMode = '24Hours';
const TIMER_DURATIONS = {
    '24Hours': 24 * 60 * 60 * 1000,
    '160Hours': 160 * 60 * 60 * 1000
};

i18next.init({
    lng: 'ru',
    resources: {
        ru: {
            translation: {
                authTitle: "Авторизация",
                invitedButton: "Меня пригласили",
                loginButton: "Войти",
                homeTitle: "Домашняя страница",
                startButton: "Старт",
                claimButton: "Забрать",
                accumulatedTime: "Накоплено: {{time}}",
                historyButton: "История операций",
                logoutButton: "Выйти",
                leadersTitle: "Лидеры",
                friendsTitle: "Друзья",
                getReferralLink: "Получить реферальную ссылку",
                yourReferrals: "Ваши рефералы",
                tasksTitle: "Задания",
                achievementsTitle: "Достижения",
                noviceAchievement: "Новичок",
                timeMasterAchievement: "Мастер времени",
                socialMagnetAchievement: "Социальный магнат",
                historyTitle: "История операций",
                homeNav: "Домашняя",
                leadersNav: "Лидеры",
                friendsNav: "Друзья",
                tasksNav: "Задания",
                timeClaimed: "Время успешно добавлено!"
            }
        },
        en: {
            translation: {
                authTitle: "Authorization",
                invitedButton: "I was invited",
                loginButton: "Login",
                homeTitle: "Home",
                startButton: "Start",
                claimButton: "Claim",
                accumulatedTime: "Accumulated: {{time}}",
                historyButton: "History",
                logoutButton: "Logout",
                leadersTitle: "Leaders",
                friendsTitle: "Friends",
                getReferralLink: "Get referral link",
                yourReferrals: "Your referrals",
                tasksTitle: "Tasks",
                achievementsTitle: "Achievements",
                noviceAchievement: "Novice",
                timeMasterAchievement: "Time Master",
                socialMagnetAchievement: "Social Magnet",
                historyTitle: "History",
                homeNav: "Home",
                leadersNav: "Leaders",
                friendsNav: "Friends",
                tasksNav: "Tasks",
                timeClaimed: "Time successfully claimed!"
            }
        }
    }
});

function updateText() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = i18next.t(key, { time: globalTimerElement.textContent.split(': ')[1] });
    });
}

document.getElementById('switchToRu').addEventListener('click', () => {
    i18next.changeLanguage('ru', updateText);
});

document.getElementById('switchToEn').addEventListener('click', () => {
    i18next.changeLanguage('en', updateText);
});

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
        claimButton.textContent = i18next.t('claimButton');
        claimButton.disabled = remainingTime > 0;
        disableTimerModeSwitcher();
    } else {
        timerElement.textContent = currentTimerMode === '24Hours' ? '24:00:00' : '160:00:00';
        claimButton.textContent = i18next.t('startButton');
        claimButton.disabled = false;
        enableTimerModeSwitcher();
    }
    globalTimerElement.textContent = i18next.t('accumulatedTime', { time: formatTime(accumulatedTime) });
}

async function fetchTimerStatus() {
    try {
        const response = await fetch(`http://212.113.102.87:3000/status/${currentUser}`);
        if (!response.ok) throw new Error('Ошибка при запросе статуса');
        const data = await response.json();
        
        if (!data.isRunning) {
            data.remainingTime = 0;
        }
        
        return data;
    } catch (error) {
        console.error('Ошибка:', error);
        return { isRunning: false, accumulatedTime: 0, remainingTime: 0, tasks: { timerStarts: 0, referralsCount: 0, accumulatedTimeGoal: 0 } };
    }
}

async function startTimer() {
    const response = await fetch('http://212.113.102.87:3000/start', {
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
    }
}

async function claimTime() {
    const response = await fetch('http://212.113.102.87:3000/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser }),
    });
    if (response.ok) {
        if (pollingInterval) clearInterval(pollingInterval);
        const status = await fetchTimerStatus();
        updateTimerDisplay(status.accumulatedTime, status.remainingTime, status.isRunning);
        showNotification(i18next.t('timeClaimed'), 'success');
        enableTimerModeSwitcher();
    }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        const status = await fetchTimerStatus();
        updateTimerDisplay(status.accumulatedTime, status.remainingTime, status.isRunning);
    }, 1000);
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

function updateTimerModeButtons() {
    document.querySelectorAll('.timer-mode-switcher button').forEach(button => {
        button.classList.remove('active');
    });
    document.getElementById(`switchTo${currentTimerMode}`).classList.add('active');
}

async function loadLeaderboard() {
    const response = await fetch('http://212.113.102.87:3000/leaders');
    const leaders = await response.json();
    leaderboardElement.innerHTML = leaders
        .map((user, index) => `
            <li>
                <span>${index + 1}. ${user.username}</span>
                <span>${formatTime(user.accumulatedTime)}</span>
            </li>
        `).join('');
}

async function loadReferrals() {
    const response = await fetch(`http://212.113.102.87:3000/referrals/${currentUser}`);
    const data = await response.json();
    const referralsList = document.getElementById('referrals');
    referralsList.innerHTML = data.referrals
        .map(user => `<li>${user.username} - ${formatTime(user.accumulatedTime)}</li>`)
        .join('');
}

async function loadTasks() {
    try {
        const response = await fetch(`http://212.113.102.87:3000/status/${currentUser}`);
        const data = await response.json();

        taskListElement.innerHTML = `
            <li>
                <span>Запусти таймер 5 раз (${data.tasks.timerStarts}/5)</span>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${(data.tasks.timerStarts / 5) * 100}%"></div>
                </div>
                <button id="completeTimerTask" ${data.tasks.timerStarts >= 5 && !data.tasks.completed.timerStarts ? '' : 'disabled'}>
                    ${data.tasks.completed.timerStarts ? i18next.t('completed') : i18next.t('claimButton')}
                </button>
            </li>
            <li>
                <span>Пригласи 3 друзей (${data.tasks.referralsCount}/3)</span>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${(data.tasks.referralsCount / 3) * 100}%"></div>
                </div>
                <button id="completeReferralTask" ${data.tasks.referralsCount >= 3 && !data.tasks.completed.referralsCount ? '' : 'disabled'}>
                    ${data.tasks.completed.referralsCount ? i18next.t('completed') : i18next.t('claimButton')}
                </button>
            </li>
            <li>
                <span>Накопи 60 минут (${formatTime(data.accumulatedTime)}/01:00:00)</span>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${(data.accumulatedTime / (60 * 60 * 1000)) * 100}%"></div>
                </div>
                <button id="completeTimeTask" ${data.accumulatedTime >= 60 * 60 * 1000 && !data.tasks.completed.accumulatedTimeGoal ? '' : 'disabled'}>
                    ${data.tasks.completed.accumulatedTimeGoal ? i18next.t('completed') : i18next.t('claimButton')}
                </button>
            </li>
        `;

        document.getElementById('completeTimerTask')?.addEventListener('click', async () => {
            await completeTask('timerStarts');
        });
        document.getElementById('completeReferralTask')?.addEventListener('click', async () => {
            await completeTask('referralsCount');
        });
        document.getElementById('completeTimeTask')?.addEventListener('click', async () => {
            await completeTask('accumulatedTimeGoal');
        });
    } catch (error) {
        console.error('Ошибка при загрузке заданий:', error);
    }
}

async function loadAchievements() {
    try {
        const response = await fetch(`http://212.113.102.87:3000/achievements/${currentUser}`);
        const data = await response.json();

        document.getElementById('noviceStatus').textContent = data.achievements.novice ? i18next.t('completed') : i18next.t('notCompleted');
        document.getElementById('timeMasterStatus').textContent = data.achievements.timeMaster ? i18next.t('completed') : i18next.t('notCompleted');
        document.getElementById('socialMagnetStatus').textContent = data.achievements.socialMagnet ? i18next.t('completed') : i18next.t('notCompleted');

        if (data.achievements.novice) {
            document.getElementById('noviceStatus').parentElement.classList.add('achievement-completed');
        }
        if (data.achievements.timeMaster) {
            document.getElementById('timeMasterStatus').parentElement.classList.add('achievement-completed');
        }
        if (data.achievements.socialMagnet) {
            document.getElementById('socialMagnetStatus').parentElement.classList.add('achievement-completed');
        }
    } catch (error) {
        console.error('Ошибка при загрузке достижений:', error);
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`http://212.113.102.87:3000/history/${currentUser}`);
        const data = await response.json();
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = data.history
            .map(entry => `
                <li>
                    <span>${new Date(entry.time).toLocaleString()}</span>
                    <span>${entry.action}</span>
                    <span>${entry.details || ''}</span>
                </li>
            `)
            .join('');
    } catch (error) {
        console.error('Ошибка при загрузке истории:', error);
    }
}

async function completeTask(taskType) {
    try {
        const response = await fetch('http://212.113.102.87:3000/complete-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, taskType }),
        });
        if (response.ok) {
            const data = await response.json();
            showNotification(data.message, 'success');
            loadTasks();
            const status = await fetchTimerStatus();
            updateTimerDisplay(status.accumulatedTime, status.remainingTime, status.isRunning);
        } else {
            const error = await response.json();
            showNotification(error.message, 'error');
        }
    } catch (error) {
        console.error('Ошибка при выполнении задания:', error);
    }
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    localStorage.setItem('currentPage', pageId);
    
    if (pageId === 'tasks') {
        loadTasks();
        loadAchievements();
    } else if (pageId === 'friends') {
        loadReferrals();
    } else if (pageId === 'history') {
        loadHistory();
    }
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const referralCode = referralInput.value.trim();
    
    if (!username) return alert(i18next.t('enterUsername'));
    const loginResponse = await fetch('http://212.113.102.87:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    });
    
    if (loginResponse.ok) {
        currentUser = username;
        localStorage.setItem('username', username);
        authPage.style.display = 'none';
        appContent.style.display = 'block';

        await checkDailyBonus();

        const status = await fetchTimerStatus();
        updateTimerDisplay(status.accumulatedTime, status.remainingTime, status.isRunning);
        if (status.isRunning) startPolling();

        loadLeaderboard();
        showPage(localStorage.getItem('currentPage') || 'home');
    } else {
        const registerResponse = await fetch('http://212.113.102.87:3000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, referrerCode: referralCode }),
        });
        
        if (!registerResponse.ok) {
            const error = await registerResponse.json();
            return alert(error.message);
        }
        
        currentUser = username;
        localStorage.setItem('username', username);
        authPage.style.display = 'none';
        appContent.style.display = 'block';

        await checkDailyBonus();

        const status = await fetchTimerStatus();
        updateTimerDisplay(status.accumulatedTime, status.remainingTime, status.isRunning);
        if (status.isRunning) startPolling();

        loadLeaderboard();
        showPage(localStorage.getItem('currentPage') || 'home');
    }
});

referralToggle.addEventListener('click', () => {
    referralInput.style.display = referralInput.style.display === 'none' ? 'block' : 'none';
});

logoutButton.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('username');
    authPage.style.display = 'flex';
    appContent.style.display = 'none';
    if (pollingInterval) clearInterval(pollingInterval);
});

claimButton.addEventListener('click', () => {
    claimButton.textContent === i18next.t('claimButton') ? claimTime() : startTimer();
});

navbarButtons.forEach(button => {
    button.addEventListener('click', () => showPage(button.dataset.page));
});

historyButton?.addEventListener('click', () => {
    showPage('history');
});

const savedUsername = localStorage.getItem('username');
if (savedUsername) {
    currentUser = savedUsername;
    authPage.style.display = 'none';
    appContent.style.display = 'block';
    fetchTimerStatus().then(status => {
        updateTimerDisplay(status.accumulatedTime, status.remainingTime, status.isRunning);
        if (status.isRunning) startPolling();
    });
    loadLeaderboard();
    showPage(localStorage.getItem('currentPage') || 'home');
} else {
    authPage.style.display = 'flex';
    appContent.style.display = 'none';
}

async function checkDailyBonus() {
    try {
        const response = await fetch('http://212.113.102.87:3000/daily-bonus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser }),
        });
        if (response.ok) {
            const data = await response.json();
            showNotification(data.message, 'success');
        } else {
            const error = await response.json();
            showNotification(error.message, 'error');
        }
    } catch (error) {
        console.error('Ошибка при проверке ежедневного бонуса:', error);
    }
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