"""
NN Company CRM — Telegram Bot
Aiogram 3 (polling) + FastAPI (/notify endpoint)
Polling mode: no webhook needed, bot always responds
"""

import asyncio
import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from aiogram import Bot, Dispatcher, Router, types
from aiogram.filters import Command
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    MenuButtonWebApp,
)

load_dotenv()

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

# ─── Config ────────────────────────────────────────────────────────────────────
BOT_TOKEN     = os.environ.get("BOT_TOKEN",            "8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU").strip()
SUPABASE_URL  = os.environ.get("SUPABASE_URL",         "https://lkthwgntdaduitqnfvem.supabase.co").strip().rstrip("/")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E").strip()
MINI_APP_URL  = os.environ.get("MINI_APP_URL",         "https://nn-company-qe1w.vercel.app").strip()
NOTIFY_SECRET = os.environ.get("NOTIFY_SECRET",        "nn_notify_secret_x9k2p7m4").strip()

log.info(f"Starting bot | MINI_APP_URL={MINI_APP_URL}")

# ─── Supabase REST ─────────────────────────────────────────────────────────────
SUPA_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
}


async def supa_select(table: str, params: dict = None) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(url, headers=SUPA_HEADERS, params=params or {})
        r.raise_for_status()
        return r.json()


async def supa_upsert(table: str, data: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    h   = {**SUPA_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(url, headers=h, json=data)
        r.raise_for_status()


# ─── Helpers ───────────────────────────────────────────────────────────────────
def fmt_money(amount) -> str:
    try:
        return f"{float(amount):,.0f} ₽".replace(",", " ")
    except Exception:
        return f"{amount} ₽"


USER_NAMES = {"tsvetkovnv": "Босс", "haaaaaaav": "Тритон"}


async def get_user_ids() -> list[int]:
    try:
        rows = await supa_select("telegram_users", {"select": "id"})
        return [r["id"] for r in rows]
    except Exception as e:
        log.error(f"get_user_ids failed: {e}")
        return []


async def broadcast(text: str) -> None:
    ids = await get_user_ids()
    if not ids:
        log.warning("No users to notify")
        return
    for uid in ids:
        try:
            await bot.send_message(uid, text, parse_mode="HTML")
        except Exception as e:
            log.warning(f"Cannot send to {uid}: {e}")


# ─── Aiogram ──────────────────────────────────────────────────────────────────
bot    = Bot(token=BOT_TOKEN)
dp     = Dispatcher()
router = Router()
dp.include_router(router)


@router.message(Command("start"))
async def cmd_start(message: types.Message) -> None:
    user         = message.from_user
    username     = (user.username or "").lower()
    display_name = USER_NAMES.get(username, user.first_name or username or "Пользователь")

    try:
        await supa_upsert("telegram_users", {
            "id":           user.id,
            "username":     username,
            "first_name":   user.first_name or "",
            "display_name": display_name,
        })
        log.info(f"Registered {user.id} @{username} → {display_name}")
    except Exception as e:
        log.error(f"Upsert user failed: {e}")

    try:
        await bot.set_chat_menu_button(
            chat_id=user.id,
            menu_button=MenuButtonWebApp(
                text="📊 CRM",
                web_app=WebAppInfo(url=MINI_APP_URL),
            ),
        )
    except Exception as e:
        log.warning(f"set_chat_menu_button failed: {e}")

    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📊 Открыть CRM",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )
    ]])
    await message.answer(
        f"Привет, <b>{display_name}</b>! 👋\n\n"
        f"Ты зарегистрирован в <b>NN Company CRM</b>.\n"
        f"Теперь будешь получать уведомления о лидах.\n\n"
        f"Нажми кнопку чтобы открыть приложение 👇",
        reply_markup=kb,
        parse_mode="HTML",
    )


@router.message(Command("app"))
async def cmd_app(message: types.Message) -> None:
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📊 Открыть CRM",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )
    ]])
    await message.answer("Открыть приложение:", reply_markup=kb)


@router.message(Command("help"))
async def cmd_help(message: types.Message) -> None:
    await message.answer(
        "<b>NN Company CRM Bot</b>\n\n"
        "/start — зарегистрироваться\n"
        "/app — открыть мини-приложение\n"
        "/help — справка",
        parse_mode="HTML",
    )


# ─── Pydantic models ──────────────────────────────────────────────────────────

class NewLeadPayload(BaseModel):
    full_name: str
    offer:     str
    revenue:   float
    payout:    float
    added_by:  str


class StatusChangePayload(BaseModel):
    full_name:  str
    offer:      str
    new_status: str
    changed_by: str


class NotifyRequest(BaseModel):
    type:          str
    new_lead:      Optional[NewLeadPayload]      = None
    status_change: Optional[StatusChangePayload] = None


# ─── FastAPI ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Delete any old webhook, then start polling in background
    await bot.delete_webhook(drop_pending_updates=True)
    polling_task = asyncio.create_task(
        dp.start_polling(bot, handle_signals=False)
    )
    log.info("Bot polling started")
    yield
    polling_task.cancel()
    try:
        await polling_task
    except asyncio.CancelledError:
        pass
    await bot.session.close()
    log.info("Bot stopped")


app = FastAPI(title="NN Company CRM Bot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
async def health():
    return {"status": "ok", "bot": "polling"}


@app.post("/notify")
async def notify(payload: NotifyRequest, x_notify_secret: str = Header(None)):
    if x_notify_secret != NOTIFY_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.type == "new_lead" and payload.new_lead:
        d = payload.new_lead
        await broadcast(
            "➕ <b>Новый лид добавлен</b>\n"
            f"👤 {d.full_name}\n"
            f"📋 Оффер: {d.offer}\n"
            f"💰 Доход: {fmt_money(d.revenue)}\n"
            f"💸 Выплата: {fmt_money(d.payout)}\n"
            f"👥 Добавил: {d.added_by}"
        )
    elif payload.type == "status_change" and payload.status_change:
        d = payload.status_change
        await broadcast(
            "🔄 <b>Статус изменён</b>\n"
            f"👤 {d.full_name}\n"
            f"📋 Оффер: {d.offer}\n"
            f"📌 Новый статус: <b>{d.new_status}</b>\n"
            f"👥 Изменил: {d.changed_by}"
        )
    else:
        raise HTTPException(status_code=400, detail="Unknown type")

    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
