"""
NN Company CRM — Railway bot
Расписание (МСК):
  10:00 — проверка зависших лидов
  11:00 — утренняя мотивация
  15:00 — дневная мотивация
  23:00 — ежедневный отчёт
  вс 21:00 — еженедельный отчёт
  последний день 22:00 — ежемесячный отчёт
"""
import os
import random
import httpx
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

BOT_TOKEN    = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
SUPABASE_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'
TG           = f'https://api.telegram.org/bot{BOT_TOKEN}'
SB_H         = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}
MSK          = timezone(timedelta(hours=3))

MONTH_NAMES = {
    1: 'январь', 2: 'февраль', 3: 'март', 4: 'апрель',
    5: 'май',    6: 'июнь',    7: 'июль', 8: 'август',
    9: 'сентябрь', 10: 'октябрь', 11: 'ноябрь', 12: 'декабрь',
}

# ─── Фразы ────────────────────────────────────────────────────────────────────

MORNING_MSGS = [
    "☀️ <b>Утренний пинок</b>\n\nНикитос, Хасл — пора ебашить.\nКлиенты сами себя не найдут 💪",
    "🌅 <b>11 утра</b>\n\nКто ещё не в деле — теряет деньги прямо сейчас.\nПогнали! 🔥",
    "💰 <b>Напоминание</b>\n\nПока вы читаете это — кто-то другой закрывает лиды.\nНе будьте тем другим 😤",
    "⚡️ <b>Доброе утро</b>\n\nДень не будет ждать. Лиды сами себя не добавят.\nВключаем рабочий режим 🚀",
    "🎯 <b>Цель на сегодня</b>\n\nМинимум 2 лида. Это немного. Это реально.\nДавайте уже 💪",
    "😤 <b>Хватит листать</b>\n\nУже 11 часов. Деньги не зарабатываются в телефоне.\nЕбашим! 💸",
    "🔥 <b>Время работать</b>\n\nЛучший момент добавить лида — сейчас.\nВторой лучший момент — тоже сейчас 🚀",
    "💎 <b>Утро богатых людей</b>\n\nБогатые люди не читают мотивационные сообщения.\nОни уже работают. Намёк понят? 😏",
]

AFTERNOON_MSGS = [
    "🔥 <b>Разгар дня!</b>\n\nПол дня прошло. Что сделали?\nЕщё есть время — не сливайте его 💪",
    "⚡️ <b>15:00 — жжём дальше</b>\n\nСамые жирные лиды закрываются после обеда.\nНе расслабляться 🚀",
    "💪 <b>Второй тайм</b>\n\nПервая половина дня позади. Рано подводить итоги.\nЕбашим дальше 🔥",
    "📈 <b>Дневной пинок</b>\n\nЕсли с утра был ноль — сейчас исправляй.\nЕсли лиды есть — не останавливайся 💸",
    "😈 <b>15:00</b>\n\nКто устал — держись. Деньги любят тех кто не останавливается.\nДавай ещё 💪",
    "🎯 <b>Середина дня</b>\n\nПроверь базу. Позвони зависшим. Добавь нового.\nПростые действия — большой результат 🔥",
    "💀 <b>Отдыхать будем в воскресенье</b>\n\nСейчас — работаем.\nКто первый добавит лида — тот молодец 🏆",
    "🛠 <b>Не ной, работай</b>\n\nВсе устали. Никому не интересно.\nДобавь лида и станет лучше 😤",
]

EMPTY_DAY_MSGS = [
    "😤 <b>Хуёвый день — 0 лидов</b>\nЗавтра отыграемся 💪",
    "💀 <b>0 лидов за день</b>\nДаже комментировать не хочу. Завтра лучше.",
    "🤡 <b>Итоги дня: ничего</b>\nАбсолютно ничего. Поздравляю.",
    "😴 <b>0 лидов</b>\nВы вообще работали сегодня? Вопрос риторический.",
    "🪦 <b>RIP сегодняшний день</b>\nЗахоронен без лидов. Пусть земля ему будет пухом.",
    "🫥 <b>Ноль. Зеро. Нихуя.</b>\nЗавтра исправляемся или я начну присылать по 10 сообщений в день.",
    "📭 <b>Пусто</b>\nКак в холодильнике в конце месяца. Работаем!",
]

EMPTY_WEEK_MSGS = [
    "😤 <b>Пустая неделя — 0 лидов</b>\nНа следующей надо взяться! 💪",
    "💀 <b>Нулевая неделя</b>\nЭто как? Серьёзно — как так вышло?",
    "🪦 <b>Неделя прошла впустую</b>\nСледующая — исправляемся или позор.",
    "😶 <b>0 лидов за неделю</b>\nМолчу. Просто молчу.",
]

EMPTY_MONTH_MSGS = [
    "😤 <b>Месяц — 0 лидов</b>\nЭто вообще как?? 💀",
    "🤯 <b>Нулевой месяц</b>\nЯ даже не знаю что сказать. Это исторически плохо.",
    "💀 <b>0 лидов за месяц</b>\nСледующий месяц — начинаем 1 числа, не 15-го.",
]


def profit_comment(profit):
    if profit >= 500_000:
        return random.choice([
            "ЭТО ПОЖАР 🔥🔥🔥 Вот так и надо работать!",
            "КОСМОС! Такими темпами скоро на яхту 🛥",
            "Я горжусь вами, черти 🏆",
            "Вот ЭТО результат. Уважаю 👑",
        ])
    elif profit >= 200_000:
        return random.choice([
            "Хорошая работа. Но мы знаем что можем больше 🔥",
            "Достойно! Завтра ещё больше 💪",
            "Красиво. Так держать 👊",
        ])
    elif profit >= 50_000:
        return random.choice([
            "Норм, но можно лучше.",
            "Средненько. Тянемся вверх.",
            "Сойдёт. Но мы знаем что можем больше.",
            "Неплохо. Завтра жёстче 💪",
        ])
    else:
        return random.choice([
            f"Ну... хоть что-то.",
            "Маловато будет.",
            "Это цена одного нормального ужина. Работаем лучше.",
            "Слабовато. Завтра исправляемся 😤",
        ])


# ─── Утилиты ──────────────────────────────────────────────────────────────────

def fmt(n):
    return f"{int(round(float(n or 0))):,}".replace(',', ' ') + ' ₽'


async def get_users():
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f'{SUPABASE_URL}/rest/v1/telegram_users?select=id', headers=SB_H)
        return [row['id'] for row in (r.json() if r.is_success else [])]


async def send_all(text, reply_markup=None):
    ids = await get_users()
    payload = {'parse_mode': 'HTML', 'text': text}
    if reply_markup:
        payload['reply_markup'] = reply_markup
    async with httpx.AsyncClient(timeout=10) as c:
        for uid in ids:
            try:
                await c.post(f'{TG}/sendMessage', json={'chat_id': uid, **payload})
            except Exception:
                pass


async def fetch_leads(start_iso, end_iso):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f'{SUPABASE_URL}/rest/v1/leads',
            headers=SB_H,
            params={
                'select':     'status,revenue,payout',
                'created_at': [f'gte.{start_iso}', f'lte.{end_iso}'],
            },
        )
        return r.json() if r.is_success else []


def build_report(leads, title):
    active  = [l for l in leads if l['status'] != 'Отказ']
    revenue = sum(float(l.get('revenue') or 0) for l in active)
    payout  = sum(float(l.get('payout')  or 0) for l in active)
    profit  = revenue - payout

    by_status = {}
    for l in leads:
        by_status[l['status']] = by_status.get(l['status'], 0) + 1
    status_lines = '\n'.join(f'  • {s}: {n}' for s, n in by_status.items() if n > 0)

    emoji   = '🏆' if profit > 500_000 else ('🔥' if profit > 50_000 else '📊')
    comment = profit_comment(profit)

    return (
        f'{emoji} <b>{title}</b>\n\n'
        f'👥 Лидов: <b>{len(leads)}</b>\n'
        f'{status_lines}\n\n'
        f'💰 Доход: <b>{fmt(revenue)}</b>\n'
        f'💸 Выплаты: <b>{fmt(payout)}</b>\n'
        f'📈 Прибыль: <b>{fmt(profit)}</b>\n\n'
        f'<i>{comment}</i>'
    )


# ─── Задачи ───────────────────────────────────────────────────────────────────

async def stale_leads_check():
    """10:00 МСК — зависшие лиды (3+ дней в 'В работе')"""
    now            = datetime.now(MSK)
    three_days_ago = (now - timedelta(days=3)).replace(hour=23, minute=59, second=59).isoformat()

    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f'{SUPABASE_URL}/rest/v1/leads',
            headers=SB_H,
            params={
                'select':     'full_name,created_at',
                'status':     'eq.В работе',
                'created_at': f'lte.{three_days_ago}',
                'order':      'created_at.asc',
            },
        )
        leads = r.json() if r.is_success else []

    if not leads:
        return

    lines = []
    for l in leads[:7]:
        created = datetime.fromisoformat(l['created_at'].replace('Z', '+00:00'))
        days    = (now - created.astimezone(MSK)).days
        lines.append(f'  • {l["full_name"]} — уже <b>{days} дн.</b>')

    more  = f'\n  ...и ещё {len(leads) - 7}' if len(leads) > 7 else ''
    intro = random.choice([
        f'⏰ <b>Зависшие лиды ({len(leads)} шт.)</b>\n\nЭти ребята давно ждут:',
        f'👀 <b>{len(leads)} лида висят в работе</b>\n\nМожет пора позвонить?',
        f'😬 <b>Напоминание</b>\n\nВот кто давно без движения:',
    ])
    await send_all(f'{intro}\n\n' + '\n'.join(lines) + more + '\n\nПора с ними что-то сделать 👆')


async def morning_motivation():
    """11:00 МСК"""
    await send_all(random.choice(MORNING_MSGS))


async def afternoon_motivation():
    """15:00 МСК"""
    await send_all(random.choice(AFTERNOON_MSGS))


async def daily_report():
    """23:00 МСК"""
    now   = datetime.now(MSK)
    start = now.replace(hour=0,  minute=0,  second=0,  microsecond=0)
    end   = now.replace(hour=23, minute=59, second=59, microsecond=0)
    date  = now.strftime('%-d %B').lower()

    leads = await fetch_leads(start.isoformat(), end.isoformat())

    if not leads:
        await send_all(random.choice(EMPTY_DAY_MSGS))
        return

    await send_all(build_report(leads, f'Итоги дня — {date}'))


async def weekly_report():
    """Воскресенье 21:00 МСК"""
    now   = datetime.now(MSK)
    start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    end   = now.replace(hour=23, minute=59, second=59, microsecond=0)

    leads = await fetch_leads(start.isoformat(), end.isoformat())

    if not leads:
        await send_all(random.choice(EMPTY_WEEK_MSGS))
        return

    await send_all(build_report(leads, 'Итоги недели'))


async def monthly_report():
    """Последний день месяца 22:00 МСК"""
    now   = datetime.now(MSK)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end   = now.replace(hour=23, minute=59, second=59, microsecond=0)
    month = MONTH_NAMES[now.month]

    leads = await fetch_leads(start.isoformat(), end.isoformat())

    if not leads:
        await send_all(random.choice(EMPTY_MONTH_MSGS))
        return

    await send_all(build_report(leads, f'Итоги месяца — {month}'))


# ─── Планировщик ──────────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler(timezone='UTC')
scheduler.add_job(stale_leads_check,  'cron',                    hour=7,  minute=0)   # 10:00 МСК
scheduler.add_job(morning_motivation,  'cron',                    hour=8,  minute=0)   # 11:00 МСК
scheduler.add_job(afternoon_motivation,'cron',                    hour=12, minute=0)   # 15:00 МСК
scheduler.add_job(daily_report,        'cron',                    hour=20, minute=0)   # 23:00 МСК
scheduler.add_job(weekly_report,       'cron', day_of_week='sun', hour=18, minute=0)   # 21:00 МСК вс
scheduler.add_job(monthly_report,      'cron', day='last',        hour=19, minute=0)   # 22:00 МСК посл. день


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])


@app.get('/')
async def health():
    return {
        'status': 'ok',
        'schedule': {
            '10:00 MSK': 'stale leads check',
            '11:00 MSK': 'morning motivation',
            '15:00 MSK': 'afternoon motivation',
            '23:00 MSK': 'daily report',
            'Sun 21:00 MSK': 'weekly report',
            'Last day 22:00 MSK': 'monthly report',
        }
    }


@app.get('/trigger')
async def trigger(type: str = 'daily'):
    """Ручной запуск для теста. ?type=daily|weekly|monthly|morning|afternoon|stale"""
    jobs = {
        'daily':     daily_report,
        'weekly':    weekly_report,
        'monthly':   monthly_report,
        'morning':   morning_motivation,
        'afternoon': afternoon_motivation,
        'stale':     stale_leads_check,
    }
    fn = jobs.get(type)
    if not fn:
        return {'error': f'Unknown type. Use: {list(jobs.keys())}'}
    await fn()
    return {'ok': True, 'triggered': type}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=int(os.environ.get('PORT', 8000)))
