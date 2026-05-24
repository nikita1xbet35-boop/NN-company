"""
NN Company CRM — Railway bot
- Ежедневный отчёт в 23:00 МСК
- Еженедельный отчёт в воскресенье в 21:00 МСК
- Ежемесячный отчёт в последний день месяца в 22:00 МСК
"""
import os
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
    emoji = '🏆' if profit > 500_000 else ('🔥' if profit > 50_000 else '📊')

    return (
        f'{emoji} <b>{title}</b>\n\n'
        f'👥 Лидов: <b>{len(leads)}</b>\n'
        f'{status_lines}\n\n'
        f'💰 Доход: <b>{fmt(revenue)}</b>\n'
        f'💸 Выплаты: <b>{fmt(payout)}</b>\n'
        f'📈 Прибыль: <b>{fmt(profit)}</b>'
    )


# ─── Ежедневный отчёт — 23:00 МСК ────────────────────────────────────────────

async def daily_report():
    now   = datetime.now(MSK)
    start = now.replace(hour=0,  minute=0,  second=0,  microsecond=0)
    end   = now.replace(hour=23, minute=59, second=59, microsecond=0)
    date  = now.strftime('%-d %B').lower()

    leads = await fetch_leads(start.isoformat(), end.isoformat())

    if not leads:
        await send_all('😤 <b>Хуевый день, 0 лидов</b>\nЗавтра отыграемся 💪')
        return

    await send_all(build_report(leads, f'Итоги дня — {date}'))


# ─── Еженедельный отчёт — воскресенье 21:00 МСК ──────────────────────────────

async def weekly_report():
    now   = datetime.now(MSK)
    start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    end   = now.replace(hour=23, minute=59, second=59, microsecond=0)

    leads = await fetch_leads(start.isoformat(), end.isoformat())

    if not leads:
        await send_all('😤 <b>Пустая неделя — 0 лидов</b>\nНа следующей надо взяться! 💪')
        return

    await send_all(build_report(leads, 'Итоги недели'))


# ─── Ежемесячный отчёт — последний день месяца 22:00 МСК ─────────────────────

async def monthly_report():
    now   = datetime.now(MSK)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end   = now.replace(hour=23, minute=59, second=59, microsecond=0)
    month = MONTH_NAMES[now.month]

    leads = await fetch_leads(start.isoformat(), end.isoformat())

    if not leads:
        await send_all(f'😤 <b>Месяц {month} — 0 лидов</b>\nЭто вообще как?? 💀')
        return

    await send_all(build_report(leads, f'Итоги месяца — {month}'))


# ─── Планировщик ──────────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler(timezone='UTC')
scheduler.add_job(daily_report,   'cron',                    hour=20, minute=0)   # 23:00 МСК
scheduler.add_job(weekly_report,  'cron', day_of_week='sun', hour=18, minute=0)   # 21:00 МСК вс
scheduler.add_job(monthly_report, 'cron', day='last',        hour=19, minute=0)   # 22:00 МСК посл. день


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])


@app.get('/')
async def health():
    return {'status': 'ok', 'schedules': 'daily 23:00 / weekly Sun 21:00 / monthly last day 22:00 MSK'}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=int(os.environ.get('PORT', 8000)))
