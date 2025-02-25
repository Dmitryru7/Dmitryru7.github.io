// Заглушка для Telegram Web App
const tg = window.Telegram?.WebApp || {
  initDataUnsafe: { user: { id: "test_user" } },
  ready: () => console.log("Telegram Web App is ready"),
};
tg.ready();

// Конфигурация
const MODE_DURATION = 24 * 60 * 60; // 24 часа в секундах
let isTimerRunning = false;
let startTimestamp = 0;
let accumulatedTime = 0;
let globalTime = 0;

// Элементы интерфейса
const timerElement = document.getElementById('timer');
const claimButton = document.getElementById('claimButton');
const globalTimerElement = document.getElementById('globalTimer');

// Инициализация пользователя
const userId = tg.initDataUnsafe.user?.id || "default_user"; // Используем Telegram ID
let userData = null;

// Загрузка данных с сервера
async function loadUserData() {
  console.log("Загрузка данных для пользователя:", userId);
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) throw new Error("Ошибка загрузки данных");
    const data = await response.json();
    console.log("Данные загружены:", data);
    userData = data;
    accumulatedTime = calculateAccumulatedTime(userData);
    globalTime = userData.globalTime || 0;

    if (userData.isTimerRunning) {
      startTimer();
    } else if (accumulatedTime >= MODE_DURATION) {
      showClaimButton();
    }
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    userData = {
      userId,
      accumulatedTime: 0,
      globalTime: 0,
      isTimerRunning: false,
      lastUpdate: Date.now(),
    };
    await saveUserDataToServer(userData); // Сохраняем начальные данные
  }

  updateUI();
}

// Сохранение данных на сервере
async function saveUserDataToServer(data) {
  console.log("Сохранение данных для пользователя:", userId, data);
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Ошибка сохранения данных");
    return await response.json();
  } catch (error) {
    console.error("Ошибка:", error);
    return null;
  }
}

// Запуск таймера
function startTimer() {
  if (isTimerRunning) return;

  isTimerRunning = true;
  startTimestamp = Date.now();
  claimButton.disabled = true;
  claimButton.textContent = 'Таймер запущен';

  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    accumulatedTime = Math.min(elapsed + (userData?.accumulatedTime || 0), MODE_DURATION);

    if (accumulatedTime >= MODE_DURATION) {
      clearInterval(interval);
      isTimerRunning = false;
      showClaimButton();
    }

    updateUI();
    saveProgress();
  }, 1000);
}

// Показать кнопку "Забрать"
function showClaimButton() {
  claimButton.disabled = false;
  claimButton.textContent = `Забрать ${formatTime(MODE_DURATION)}!`;
  claimButton.onclick = claimReward;
}

// Забрать награду
async function claimReward() {
  globalTime += MODE_DURATION;
  accumulatedTime = 0;
  isTimerRunning = false;

  userData = {
    userId,
    accumulatedTime: 0,
    globalTime,
    isTimerRunning: false,
    lastUpdate: Date.now(),
  };

  await saveProgress();
  updateUI();
  claimButton.textContent = 'Старт';
  claimButton.onclick = startTimer;
}

// Сохранение прогресса
async function saveProgress() {
  console.log("Сохранение прогресса для пользователя:", userId, {
    accumulatedTime,
    globalTime,
    isTimerRunning,
  });
  userData.accumulatedTime = accumulatedTime;
  userData.globalTime = globalTime;
  userData.isTimerRunning = isTimerRunning;
  userData.lastUpdate = Date.now();

  await saveUserDataToServer(userData);
}

// Форматирование времени
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Обновление интерфейса
function updateUI() {
  const remaining = MODE_DURATION - accumulatedTime;
  timerElement.textContent = formatTime(remaining);
  globalTimerElement.textContent = `Накоплено: ${formatTime(globalTime)}`;
}

// Навигация
const navButtons = document.querySelectorAll('.navbar button');
navButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetPageId = button.getAttribute('data-page');
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
      if (page.id === targetPageId) {
        page.classList.add('active');
      } else {
        page.classList.remove('active');
      }
    });
  });
});

// Инициализация кнопки "Старт"
claimButton.onclick = startTimer;

// Запуск приложения
loadUserData();