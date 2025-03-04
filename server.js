require('dotenv').config();
const express = require('express');
const { Driver, IamAuthService } = require('ydb-sdk');
const fs = require('fs');

// Загружаем ключ сервисного аккаунта
const saKeyFile = process.env.YDB_SA_KEY_FILE;
const saKey = JSON.parse(fs.readFileSync(saKeyFile, 'utf8'));

// Создаем драйвер для подключения к YDB
const driver = new Driver({
  endpoint: process.env.YDB_ENDPOINT,
  database: process.env.YDB_DATABASE,
  authService: new IamAuthService(saKey),
});

// Проверяем подключение к YDB
(async () => {
  try {
    await driver.ready(5000); // Ожидаем подключения (5 секунд)
    console.log('Подключение к YDB успешно установлено!');
  } catch (error) {
    console.error('Ошибка подключения к YDB:', error);
    process.exit(1); // Завершаем процесс, если подключение не удалось
  }
})();

// Создаем Express-приложение
const app = express();
const port = process.env.PORT || 3000;

// Middleware для обработки JSON
app.use(express.json());

// Пример маршрута для проверки работы сервера
app.get('/', (req, res) => {
  res.send('Сервер работает!');
});

// Пример маршрута для работы с YDB
app.get('/data', async (req, res) => {
  try {
    // Пример выполнения запроса к YDB
    const query = 'SELECT 1 AS value;';
    const result = await driver.tableClient.withSession(async (session) => {
      return session.executeQuery(query);
    });

    res.json(result);
  } catch (error) {
    console.error('Ошибка при выполнении запроса к YDB:', error);
    res.status(500).send('Ошибка при выполнении запроса к YDB');
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
