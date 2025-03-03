const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  accumulatedTime: { type: Number, default: 0 },
  globalTime: { type: Number, default: 0 },
  isTimerRunning: { type: Boolean, default: false },
  lastUpdate: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

// API Endpoints
app.get('/api/users/:userId', async (req, res) => {
  console.log("Получен запрос на загрузку данных для пользователя:", req.params.userId);
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(user);
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/users/:userId', async (req, res) => {
  console.log("Получен запрос на обновление данных для пользователя:", req.params.userId, req.body);
  try {
    const updatedUser = await User.findOneAndUpdate(
      { userId: req.params.userId },
      req.body,
      { new: true, upsert: true } // Создаем пользователя, если он не существует
    );
    res.json(updatedUser);
  } catch (error) {
    console.error("Ошибка обновления данных:", error);
    res.status(400).json({ error: 'Ошибка обновления данных' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));