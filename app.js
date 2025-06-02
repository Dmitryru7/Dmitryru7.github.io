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
const switchTo1Min = document.getElementById('switchTo1Min');
const switchTo2Min = document.getElementById('switchTo2Min');
const navbarButtons = document.querySelectorAll('.nav-button');
const leaderboard = document.getElementById('leaderboard');
const userPositionElement = document.getElementById('userPosition');
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
let currentTimerMode = '1Min';
const TIMER_DURATIONS = {
    '1Min': 1 * 1 * 60 * 1000,
    '2Min': 1 * 2 * 60 * 1000
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
        showPage('home');

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
    claimButton.addEventListener('click', handleTimerAction);

    switchTo1Min.addEventListener('click', () => switchTimerMode('1Min'));
    switchTo2Min.addEventListener('click', () => switchTimerMode('2Min'));

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
    pages.forEach(page => page.classList.remove('active'));
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active');

        switch (pageId) {
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

// Установка активной кнопки навигации
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

// Обработчик основной кнопки таймера
async function handleTimerAction() {
    if (isTimerRunning()) {
        const status = await fetch(`${API}/status/${currentUser.username}`).then(r => r.json());

        if (status.remainingTime <= 0) {
            showConfirmation('Завершить таймер и получить награду?', claimTime);
        } else {
            showNotification('Таймер еще не завершен! Дождитесь окончания.', 'error');
            triggerHapticFeedback('error');
        }
    } else {
        showConfirmation(`Запустить ${currentTimerMode === '1Min' ? 'минутный' : '2 минутный'} таймер?`, startTimer);
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
    timerElement.textContent = mode === '1Min' ? '00:01:00' : '00:02:00';
    timerProgress.style.width = '0%';
    timerModeLabel.textContent = mode === '1Min' ? 'минутный режим' : '2 минутный режим';
}

// Обновление UI переключателей
function updateTimerModeUI() {
    switchTo1Min.classList.toggle('active', currentTimerMode === '1Min');
    switchTo2Min.classList.toggle('active', currentTimerMode === '2Min');
}

// Проверка работает ли таймер
function isTimerRunning() {
    return timerElement.classList.contains('running');
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

// Обновление позиции пользователя
async function updateUserPosition() {
    try {
        const response = await fetch(`${API}/user-position/${currentUser.username}`);
        if (!response.ok) throw new Error('Ошибка загрузки позиции');

        const position = await response.json();
        const rank = position.rank || 0;
        const rankText = rank > 0 ? rank : '-';

        document.querySelectorAll('.user-rank-display').forEach(el => {
            el.textContent = rankText;
        });

        if (userPositionElement) {
            userPositionElement.innerHTML = `
                <span>Ваша позиция: <strong>${rankText}</strong></span>
                ${position.accumulatedTime ? `<span class="position-time">${formatTime(position.accumulatedTime)}</span>` : ''}
            `;
        }

    } catch (error) {
        console.error('Ошибка загрузки позиции:', error);
        document.querySelectorAll('.user-rank-display').forEach(el => {
            el.textContent = '-';
        });
        if (userPositionElement) {
            userPositionElement.innerHTML = '<span>Ваша позиция: -</span>';
        }
    }
}

// Обновление статистики пользователя
function updateUserStats(status) {
    levelElement.textContent = status.level || 1;

    // Обновление прогресса XP
    const xpPercentage = Math.min((status.xp / status.xpToNextLevel) * 100, 100);
    xpProgressElement.textContent = `${status.xp || 0}/${status.xpToNextLevel || 1000} XP`;
    xpFillElement.style.width = `${xpPercentage}%`;
}

// Загрузка данных пользователя
async function loadUserData() {
    try {
        // Параллельно загружаем статус и таблицу лидеров
        const [status, leaders] = await Promise.all([
            fetch(`${API}/status/${currentUser.username}`).then(r => r.json()),
            fetch(`${API}/leaders`).then(r => r.json()),
            updateUserPosition() // Обновляем позицию в рейтинге
        ]);

        // Обработка автоматического завершения таймера
        if (status.isRunning && status.remainingTime <= 0) {
            console.log('Обнаружен завершенный таймер, запускаем claimTime()');
            await claimTime();
            
            // После завершения загружаем обновленные данные
            const newStatus = await fetch(`${API}/status/${currentUser.username}`).then(r => r.json());
            updateTimerDisplay(
                newStatus.accumulatedTime,
                0,
                false
            );
            return; // Прерываем дальнейшее выполнение
        }

        // Обновляем отображение таймера
        updateTimerDisplay(
            status.accumulatedTime,
            status.remainingTime,
            status.isRunning
        );

        // Запускаем опрос статуса если таймер активен
        if (status.isRunning && status.remainingTime > 0) {
            startPolling();
        }

        // Обновляем таблицу лидеров
        updateLeaderboard(leaders);

        // Обновляем статистику пользователя
        updateUserStats(status);

        // Обновляем реферальные данные (если открыта страница друзей)
        if (document.getElementById('friends').classList.contains('active')) {
            await loadFriendsPage();
        }

        // Логирование для отладки
        console.log('Данные пользователя загружены:', {
            accumulatedTime: status.accumulatedTime,
            remainingTime: status.remainingTime,
            isRunning: status.isRunning,
            level: status.level
        });

    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных. Попробуйте обновить страницу', 'error');
        
        // Восстанавливаем кнопку в случае ошибки
        claimButton.innerHTML = '<i class="fas fa-play"></i> Старт';
        claimButton.disabled = false;
    }
}

// Обновление отображения таймера
function updateTimerDisplay(accumulatedTime, remainingTime, isRunning) {
    const totalTime = TIMER_DURATIONS[currentTimerMode];
    const progress = isRunning ? ((totalTime - remainingTime) / totalTime) * 100 : 0;
    
    // Добавляем проверку на завершенный таймер
    const isFinished = isRunning && remainingTime <= 0;
    
    timerProgress.style.width = `${progress}%`;
    timerElement.textContent = isFinished ? '00:00:00' : 
        (isRunning ? formatTime(remainingTime) : 
        (currentTimerMode === '1Min' ? '00:01:00' : '00:02:00'));

    if (isRunning && !isFinished) {
        timerElement.classList.add('running');
        claimButton.innerHTML = '<i class="fas fa-stop"></i> Забрать';
        claimButton.disabled = remainingTime > 0;
        disableTimerModeSwitcher();
    } else {
        timerElement.classList.remove('running');
        claimButton.innerHTML = isFinished ? '<i class="fas fa-gift"></i> Забрать' : '<i class="fas fa-play"></i> Старт';
        claimButton.disabled = false;
        enableTimerModeSwitcher();
    }

    // Всегда обновляем глобальное время
    globalTimerElement.textContent = formatTime(accumulatedTime);

    // Обновление времени текущего сеанса
    const sessionTime = isRunning && !isFinished 
        ? Math.min(totalTime, Math.max(0, totalTime - remainingTime))
        : 0;
    sessionTimerElement.textContent = formatTime(sessionTime);
    
    // Если таймер завершен, показываем кнопку "Забрать"
    if (isFinished) {
        claimButton.style.display = 'block';
    }
}

// Опрос статуса таймера
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        try {
            const status = await fetch(`${API}/status/${currentUser.username}`).then(r => r.json());
            
            // Добавляем флаг завершения
            const isFinished = status.isRunning && status.remainingTime <= 0;
            
            updateTimerDisplay(
                status.accumulatedTime,
                status.remainingTime,
                status.isRunning
            );

            if (isFinished) {
                clearInterval(pollingInterval);
                claimButton.disabled = false;
                showNotification('Таймер завершен! Нажмите "Забрать" для получения награды', 'success');
                // Принудительно обновляем данные пользователя
                await loadUserData();
            }
        } catch (error) {
            console.error('Ошибка опроса:', error);
            clearInterval(pollingInterval);
        }
    }, 1000);
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
            loadTasksPage(); // Обновляем страницу заданий
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
        // Принудительно запрашиваем свежий статус
        const status = await fetch(`${API}/status/${currentUser.username}`).then(r => r.json());
        
        if (status.remainingTime <= 0) {
            // Показываем лоадер
            claimButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
            claimButton.disabled = true;
            
            const response = await fetch(`${API}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: currentUser.username,
                    force: true // Флаг для принудительного завершения
                }),
            });

            if (!response.ok) throw new Error('Ошибка сервера');

            const result = await response.json();
            
            // Обновляем интерфейс
            updateTimerDisplay(
                result.newAccumulatedTime || status.accumulatedTime + (status.timerEndTime - status.startTime),
                0,
                false
            );
            
            showNotification(`Получено ${formatTime(result.earned)}!`, 'success');
            
            // Обновляем все данные
            await Promise.all([
                loadUserData(),
                loadFriendsPage()
            ]);
            
        } else {
            showNotification('Таймер еще не завершен!', 'error');
        }
    } catch (error) {
        console.error('Ошибка завершения таймера:', error);
        showNotification(error.message || 'Ошибка завершения таймера', 'error');
    } finally {
        claimButton.innerHTML = '<i class="fas fa-play"></i> Старт';
        claimButton.disabled = false;
    }
}

// Загрузка таблицы лидеров
async function loadLeaderboard() {
    try {
        const response = await fetch(`${API}/leaders`);
        if (!response.ok) throw new Error('Ошибка загрузки');

        const leaders = await response.json();
        updateLeaderboard(leaders);
        await updateUserPosition();
    } catch (error) {
        console.error('Ошибка загрузки лидерборда:', error);
        showNotification('Ошибка загрузки таблицы лидеров', 'error');
    }
}

// Загрузка страницы друзей
async function loadFriendsPage() {
    try {
        const response = await fetch(`${API}/referrals/${currentUser.username}`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const data = await response.json();
        console.log('Referral data:', data); // Для отладки
        
        if (!data.referrals) {
            throw new Error('Некорректные данные рефералов');
        }
        
        renderFriendsPage(data);
        
        // Сохраняем генерацию реферальной ссылки
        const referralLinkInput = document.getElementById('referralLink');
        referralLinkInput.value = generateReferralLink();
        
    } catch (error) {
        console.error('Ошибка загрузки друзей:', error);
        showNotification(error.message || 'Ошибка загрузки рефералов', 'error');
    }
}

// Отображение страницы друзей
function renderFriendsPage(data) {
    // Обновляем статистику
    document.getElementById('pendingBonus').textContent = formatTime(data.pendingBonus || 0);
    document.getElementById('totalEarned').textContent = formatTime(data.totalEarned || 0);

    // Обновляем счетчик рефералов
    document.querySelectorAll('#referralsCount').forEach(el => {
        el.textContent = data.referrals.length || 0;
    });

    // Получаем элементы из HTML
    const claimBonusBtn = document.getElementById('claimBonusBtn');
    const nextClaimInfo = document.getElementById('nextClaimInfo');
    const referralsContainer = document.getElementById('referralsContainer');

    // Проверяем условия для активации кнопки
    const canClaim = data.canClaim && data.pendingBonus > 0;
    
    // Устанавливаем состояние кнопки (используем существующую кнопку из HTML)
    claimBonusBtn.disabled = !canClaim;
    claimBonusBtn.classList.toggle('disabled', !canClaim);

    // Обновляем информацию о следующем получении
    if (canClaim) {
        nextClaimInfo.style.display = 'none';
    } else {
        const nextClaimTime = data.nextClaimIn ? formatSeconds(data.nextClaimIn) : '24:00:00';
        nextClaimInfo.innerHTML = `
            <i class="fas fa-clock"></i>
            <span>Следующее получение: <strong>${nextClaimTime}</strong></span>
        `;
        nextClaimInfo.style.display = 'flex';
    }

    // Обновляем список рефералов
    if (data.referrals.length > 0) {
        referralsContainer.innerHTML = `
            <div class="referral-list-header">
                <span>Реферал</span>
                <span>Заработано</span>
            </div>
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
        referralsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-plus"></i>
                <p>Пригласите друзей и получайте 10% от их времени</p>
            </div>
        `;
    }

    // Вешаем обработчик на существующую кнопку из HTML
    claimBonusBtn.onclick = async function() {
        if (this.disabled) return;
        
        const originalText = this.innerHTML;
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
        
        try {
            const response = await fetch(`${API}/claim-referral-bonus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username })
            });

            const result = await response.json();
            
            if (!response.ok) throw new Error(result.message || 'Ошибка сервера');

            showNotification(`Получено ${formatTime(result.bonus)}!`, 'success');
            triggerHapticFeedback('success');
            
            // Обновляем данные
            await loadFriendsPage();
            await loadUserData();
            
        } catch (error) {
            console.error('Ошибка получения бонуса:', error);
            showNotification(error.message || 'Не удалось получить бонус', 'error');
            claimBonusBtn.disabled = false;
            claimBonusBtn.innerHTML = originalText;
        }
    };
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
            <button class="claim-task-btn" ${task.canClaim ? '' : 'disabled'}
                    onclick="claimTaskReward('${task.title}', ${task.reward})">
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

// Генерация реферальной ссылки
// Генерация реферальной ссылки
function generateReferralLink() {
    if (!currentUser?.referralCode) {
        console.error('Referral code not available');
        return 'Ошибка загрузки';
    }
    
    const botUsername = 'bigdik30cm_bot/bigdik'; // Убедитесь, что это правильный username бота
    const refCode = currentUser.referralCode;
    
    return `https://t.me/${botUsername}?start=${refCode}`;
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

// Получение XP (новая функция)
async function claimXP() {
    try {
        const response = await fetch(`${API}/claim-xp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера: ${errorText}`);
        }

        const data = await response.json();

        // Обновляем интерфейс после успешного получения XP
        updateUserStats(data);
        showNotification(`Получено ${data.reward} XP!`, 'success');
        triggerHapticFeedback('success');

    } catch (error) {
        console.error('Ошибка при получении XP:', error);
        showNotification(error.message || 'Ошибка при получении XP', 'error');
    }
}

    // Глобальные функции для HTML
    window.copyReferralLink = function () {
        // ... существующий код ...
    };

    // Получение награды за задание
    window.claimTaskReward = async function (taskTitle, reward) {
        try {
            console.log(`Пытаемся получить награду за задание: ${taskTitle}`);

            const response = await fetch(`${API}/claim-task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    username: currentUser.username,
                    taskTitle: taskTitle
                })
            });

            // Проверяем Content-Type ответа
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Сервер вернул не JSON:', text);
                throw new Error(`Сервер вернул неожиданный ответ: ${text.substring(0, 100)}`);
            }

            const data = await response.json();

            if (!response.ok) {
                console.error('Ошибка сервера:', data);
                throw new Error(data.message || 'Ошибка сервера');
            }

            console.log('Успешно получена награда:', data);
            showNotification(`Получено +${reward} XP!`, 'success');
            triggerHapticFeedback('success');
            loadTasksPage();
            loadUserData();
        } catch (error) {
            console.error('Ошибка при получении награды:', error);
            showNotification(error.message || 'Ошибка получения награды', 'error');
        }
    };

    window.copyReferralLink = function () {
        const input = document.getElementById('referralLink');
        input.select();
        document.execCommand('copy');
        showNotification('Ссылка скопирована!', 'success');
        triggerHapticFeedback('light');
    };

    window.shareReferralLink = function () {
        if (window.Telegram?.WebApp) {
            Telegram.WebApp.shareUrl(
                document.getElementById('referralLink').value,
                'Присоединяйся к NotTime и получай бонусы!'
            );
        } else {
            window.copyReferralLink();
        }
    };

    // Форматирование времени
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

    // Блокировка переключателей при работе таймера
    function disableTimerModeSwitcher() {
        switchTo1Min.disabled = true;
        switchTo2Min.disabled = true;
    }

    // Разблокировка переключателей
    function enableTimerModeSwitcher() {
        switchTo1Min.disabled = false;
        switchTo2Min.disabled = false;
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
