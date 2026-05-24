# NN Company CRM — Telegram Mini App

Внутренняя CRM для управления лидами по финансовым офферам. Telegram Mini App + Bot.

## Стек

| Компонент | Технология |
|-----------|-----------|
| Frontend  | React + Vite |
| Database  | Supabase |
| Bot       | Python + aiogram 3 + FastAPI |
| Хостинг бота | Railway |
| Хостинг Mini App | Vercel |

---

## 🗄️ Шаг 1: Настройка Supabase

1. Открой [Supabase Dashboard](https://app.supabase.com/) → твой проект
2. Перейди в **SQL Editor**
3. Скопируй и выполни содержимое файла `supabase/migrations/001_initial.sql`

---

## 🤖 Шаг 2: Деплой бота на Railway

1. Зайди на [railway.app](https://railway.app/)
2. Нажми **New Project** → **Deploy from GitHub repo** → выбери этот репозиторий
3. Выбери папку **`bot`** как root директорию
4. Добавь переменные окружения:

```
BOT_TOKEN=8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU
WEBHOOK_SECRET=nn_company_webhook_secret_2024
SUPABASE_URL=https://lkthwgntdaduitqnfvem.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
NOTIFY_SECRET=nn_notify_secret_x9k2p7m4
MINI_APP_URL=https://<твой-домен-mini-app>.vercel.app
```

5. После деплоя скопируй URL (например `https://nn-company-bot.up.railway.app`)
6. Добавь его в переменную `BOT_WEBHOOK_URL` в Railway

---

## 📱 Шаг 3: Деплой Mini App на Vercel

1. Зайди на [vercel.com](https://vercel.com/)
2. **New Project** → выбери этот репозиторий
3. **Root Directory** → `mini-app`
4. **Framework Preset** → Vite
5. Добавь переменные окружения:

```
VITE_SUPABASE_URL=https://lkthwgntdaduitqnfvem.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_BOT_URL=https://<railway-bot-url>
VITE_NOTIFY_SECRET=nn_notify_secret_x9k2p7m4
```

6. Задеплой и скопируй URL

---

## ⚙️ Шаг 4: Обновить BOT_WEBHOOK_URL в Railway

После деплоя Mini App обнови переменную `MINI_APP_URL` в Railway на реальный Vercel URL.

---

## 🔔 Шаг 5: Регистрация пользователей в боте

Каждый пользователь должен один раз написать боту `/start`:

- **@tsvetkovnv** → пишет `/start` → регистрируется как **Босс**
- **@haaaaaaav** → пишет `/start` → регистрируется как **Тритон**

После этого оба будут получать уведомления.

---

## 🤖 Шаг 6: Настройка кнопки Mini App в BotFather

```
/setmenubutton
@<имя_бота>
📊 CRM
https://<твой-домен>.vercel.app
```

Или просто нажми кнопку "📊 CRM" которая появится после `/start`.

---

## Структура проекта

```
NN-company/
├── supabase/
│   └── migrations/
│       └── 001_initial.sql     # Схема БД
├── bot/
│   ├── main.py                 # Бот + API уведомлений
│   ├── requirements.txt
│   ├── Procfile
│   ├── railway.json
│   └── .env.example
├── mini-app/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── config.js       # Офферы, статусы, цвета
│   │   │   ├── supabase.js     # Все запросы к БД
│   │   │   ├── api.js          # Уведомления в бот
│   │   │   └── telegram.js     # Telegram Web App SDK
│   │   ├── components/
│   │   │   ├── BottomNav.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── LeadCard.jsx
│   │   │   └── Modal.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # Дашборд со статистикой
│   │   │   ├── Leads.jsx       # Список лидов + фильтры
│   │   │   ├── AddLead.jsx     # Форма добавления лида
│   │   │   └── LeadDetail.jsx  # Карточка лида + история
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Функционал

- **Дашборд**: статистика за период (день/неделя/месяц/год/произвольный)
- **Лиды**: список с поиском и фильтрами по офферу/статусу
- **Добавить**: форма создания нового лида
- **Карточка лида**: полная инфо, смена статуса, история, комментарий
- **Уведомления**: бот шлёт сообщение обоим при добавлении лида и смене статуса
