"""
NN Company CRM — Telegram Bot
Aiogram 3 + FastAPI + Supabase REST API (via httpx, no supabase-py)
"""

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
BOT_TOKEN       = os.environ.get("BOT_TOKEN", "").strip()
WEBHOOK_SECRET  = os.environ.get("WEBHOOK_SECRET", "secret").strip()
SUPABASE_URL    = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
BOT_WEBHOOK_URL = os.environ.get("BOT_WEBHOOK_URL", "").strip().rstrip("/")
MINI_APP_URL    = os.environ.get("MINI_APP_URL", "https://example.com").strip()
NOTIFY_SECRET   = os.environ.get("NOTIFY_SECRET", "notify_secret").strip()

# ─── Startup validation ────────────────────────────────────────────────────────
missing = [k for k, v in {
    "BOT_TOKEN":           BOT_TOKEN,
    "SUPABASE_URL":        SUPABASE_URL,
    "SUPABASE_SERVICE_KEY": SUPABASE_KEY,
}.items() if not v]

if missing:
    raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")

log.info(f"Config OK — SUPABASE_URL={SUPABASE_URL}")
log.info(f"MINI_APP_URL={MINI_APP_URL}")
log.info(f"BOT_WEBHOOK_URL={BOT_WEBHOOK_URL or '(not set, polling mode)'}")

# ─── Supabase REST helpers (no supabase-py library needed) ────────────────────
SUPA_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}


async def supa_get(table: str, params: dict = None) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, headers=SUPA_HEADERS, params=params or {})
        r.raise_for_status()
        return r.json()


async def supa_upsert(table: str, data: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {**SUPA_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(url, headers=headers, json=data)
        r.raise_for_status()


# ─── Helpers ───────────────────────────────────────────────────────────────────
def fmt_money(amount) -> str:
    try:
        n = float(amount)
        formatted = f"{n:,.0f}".replace(",", " ")
        return f"{formatted} ₽"
    except Exception:
        return f"{amount} ₽"


async def get_all_user_ids() -> list[int]:
    try:
        rows = await supa_get("telegram_users", {"select": "id"})
        return [row["id"] for row in rows]
    except Exception as e:
        log.error(f"Failed to fetch telegram_users: {e}")
        return []


async def broadcast(text: str) -> None:
    user_ids = await get_all_user_ids()
    if not user_ids:
        log.warning("No registered users to notify")
        return
    for uid in user_ids:
        try:
            await bot.send_message(uid, text, parse_mode="HTML")
            log.info(f"Notified user {uid}")
        except Exception as e:
            log.warning(f"Failed to send to {uid}: {e}")


# ─── Aiogram setup ─────────────────────────────────────────────────────────────
bot    = Bot(token=BOT_TOKEN)
dp     = Dispatcher()
router = Router()
dp.include_router(router)

USER_DISPLAY_NAMES = {
    "tsvetkovnv": "Босс",
    "haaaaaaav":  "Тритон",
}


# ─── Telegram handlers ────────────────────────────────────────────────────────

@router.message(Command("start"))
async def cmd_start(message: types.Message) -> None:
    user     = message.from_user
    username = (user.username or "").lower()
    display_name = USER_DISPLAY_NAMES.get(username, user.first_name or username or "Пользователь")

    try:
        await supa_upsert("telegram_users", {
            "id":           user.id,
            "username":     username,
            "first_name":   user.first_name or "",
            "display_name": display_name,
        })
        log.info(f"Registered: {user.id} @{username} → {display_name}")
    except Exception as e:
        log.error(f"Failed to register user {user.id}: {e}")

    try:
        await bot.set_chat_menu_button(
            chat_id=user.id,
            menu_button=MenuButtonWebApp(
                text="📊 CRM",
                web_app=WebAppInfo(url=MINI_APP_URL),
            ),
        )
    except Exception as e:
        log.warning(f"Could not set menu button: {e}")

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


# ─── FastAPI app ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    if BOT_WEBHOOK_URL:
        webhook_url = f"{BOT_WEBHOOK_URL}/telegram/{WEBHOOK_SECRET}"
        try:
            await bot.set_webhook(webhook_url, drop_pending_updates=True)
            log.info(f"Webhook set → {webhook_url}")
        except Exception as e:
            log.error(f"Failed to set webhook: {e}")
    else:
        log.warning("BOT_WEBHOOK_URL not set — bot won't receive updates until set")
    yield
    try:
        await bot.delete_webhook()
    except Exception:
        pass
    await bot.session.close()


app = FastAPI(title="NN Company CRM Bot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
async def health():
    return {"status": "ok", "service": "NN Company CRM Bot"}


@app.post("/telegram/{secret}")
async def telegram_webhook(secret: str, request: Request):
    if secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        body   = await request.json()
        update = types.Update(**body)
        await dp.feed_update(bot=bot, update=update)
    except Exception as e:
        log.error(f"Error processing update: {e}")
    return {"ok": True}


@app.post("/notify")
async def notify(payload: NotifyRequest, x_notify_secret: str = Header(None)):
    if x_notify_secret != NOTIFY_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.type == "new_lead" and payload.new_lead:
        d    = payload.new_lead
        text = (
            "➕ <b>Новый лид добавлен</b>\n"
            f"👤 {d.full_name}\n"
            f"📋 Оффер: {d.offer}\n"
            f"💰 Доход: {fmt_money(d.revenue)}\n"
            f"💸 Выплата: {fmt_money(d.payout)}\n"
            f"👥 Добавил: {d.added_by}"
        )
        await broadcast(text)

    elif payload.type == "status_change" and payload.status_change:
        d    = payload.status_change
        text = (
            "🔄 <b>Статус изменён</b>\n"
            f"👤 {d.full_name}\n"
            f"📋 Оффер: {d.offer}\n"
            f"📌 Новый статус: <b>{d.new_status}</b>\n"
            f"👥 Изменил: {d.changed_by}"
        )
        await broadcast(text)

    else:
        raise HTTPException(status_code=400, detail="Unknown notification type")

    return {"ok": True}


# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
