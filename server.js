require('dotenv').config(); // Загружаем переменные окружения из .env
const { Driver, getCredentialsFromEnv } = require('ydb-sdk'); // Импортируем YDB SDK
const express = require('express'); // Импортируем Express

const app = express();
const PORT = process.env.PORT || 3000; // Порт сервера

// Настройки YDB
const driver = new Driver({
  endpoint: process.env.YDB_ENDPOINT, // Endpoint YDB
  database: process.env.YDB_DATABASE, // Идентификатор базы данных
  authService: getCredentialsFromEnv(), // Аутентификация через сервисный аккаунт
});

// Функция для инициализации подключения к YDB
async function initYDB() {
  try {
    if (!await driver.ready(10000)) { // Ожидаем подключения к YDB
      console.error("Failed to connect to YDB");
      process.exit(1); // Завершаем процесс, если подключение не удалось
    }
    console.log("Connected to YDB"); // Успешное подключение
  } catch (err) {
    console.error("YDB connection error:", err);
    process.exit(1);
  }
}

// Инициализация YDB
initYDB();

// Пример маршрута для проверки подключения
app.get('/', async (req, res) => {
  try {
    await driver.tableClient.withSession(async (session) => {
      const query = `SELECT 1 AS value`; // Простой тестовый запрос
      const result = await session.executeQuery(query);
      res.json(result); // Отправляем результат клиенту
    });
  } catch (err) {
    console.error('YDB query error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
