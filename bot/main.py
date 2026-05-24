"""
NN Company CRM — Telegram Bot
Aiogram 3 + FastAPI + Supabase
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
from supabase import create_client, Client

load_dotenv()

# ─── Config ────────────────────────────────────────────────────────────────────
BOT_TOKEN       = os.environ.get("BOT_TOKEN", "")
WEBHOOK_SECRET  = os.environ.get("WEBHOOK_SECRET", "secret")
SUPABASE_URL    = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "")
BOT_WEBHOOK_URL = os.environ.get("BOT_WEBHOOK_URL", "")
MINI_APP_URL    = os.environ.get("MINI_APP_URL", "https://example.com")
NOTIFY_SECRET   = os.environ.get("NOTIFY_SECRET", "notify_secret")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN environment variable is not set")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_KEY environment variable is not set")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

# ─── Supabase client ───────────────────────────────────────────────────────────
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    log.info("Supabase client initialized")
except Exception as e:
    log.error(f"Failed to init Supabase: {e}")
    raise

# ─── Aiogram setup ─────────────────────────────────────────────────────────────
bot = Bot(token=BOT_TOKEN)
dp  = Dispatcher()
router = Router()
dp.include_router(router)

# ─── Helpers ───────────────────────────────────────────────────────────────────

def fmt_money(amount) -> str:
    """Format number as Russian currency string."""
    try:
        n = float(amount)
        return f"{n:,.0f} ₽".replace(",", " ")
    except Exception:
        return f"{amount} ₽"


async def get_all_user_ids() -> list[int]:
    """Fetch all registered Telegram user IDs from Supabase."""
    try:
        res = supabase.table("telegram_users").select("id").execute()
        return [row["id"] for row in (res.data or [])]
    except Exception as e:
        log.error(f"Failed to fetch telegram_users: {e}")
        return []


async def broadcast(text: str) -> None:
    """Send a message to all registered users."""
    user_ids = await get_all_user_ids()
    if not user_ids:
        log.warning("No registered users to notify.")
        return
    for uid in user_ids:
        try:
            await bot.send_message(uid, text, parse_mode="HTML")
        except Exception as e:
            log.warning(f"Failed to send to {uid}: {e}")


# ─── Telegram Handlers ────────────────────────────────────────────────────────

@router.message(Command("start"))
async def cmd_start(message: types.Message) -> None:
    """Register user and show the Mini App button."""
    user = message.from_user

    # Determine display name
    username = user.username or ""
    display_name_map = {
        "tsvetkovnv": "Босс",
        "haaaaaaav":  "Тритон",
    }
    display_name = display_name_map.get(username, user.first_name or username or "Пользователь")

    # Upsert user into Supabase
    try:
        supabase.table("telegram_users").upsert({
            "id":           user.id,
            "username":     username,
            "first_name":   user.first_name or "",
            "display_name": display_name,
        }).execute()
        log.info(f"Registered user: {user.id} (@{username}) as '{display_name}'")
    except Exception as e:
        log.error(f"Failed to upsert user {user.id}: {e}")

    # Set menu button to open Mini App
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

    # Reply
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📊 Открыть CRM",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )
    ]])
    await message.answer(
        f"Привет, <b>{display_name}</b>! 👋\n\n"
        f"Ты зарегистрирован в <b>NN Company CRM</b>.\n"
        f"Теперь ты будешь получать уведомления о лидах.\n\n"
        f"Нажми кнопку ниже чтобы открыть приложение 👇",
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
        "/start — зарегистрироваться и получить кнопку приложения\n"
        "/app — открыть мини-приложение\n"
        "/help — это сообщение",
        parse_mode="HTML",
    )


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class NewLeadPayload(BaseModel):
    full_name:  str
    offer:      str
    revenue:    float
    payout:     float
    added_by:   str


class StatusChangePayload(BaseModel):
    full_name:  str
    offer:      str
    new_status: str
    changed_by: str


class NotifyRequest(BaseModel):
    type:       str          # "new_lead" | "status_change"
    new_lead:   Optional[NewLeadPayload]    = None
    status_change: Optional[StatusChangePayload] = None


# ─── FastAPI App ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Set webhook on startup
    if BOT_WEBHOOK_URL:
        webhook_url = f"{BOT_WEBHOOK_URL.rstrip('/')}/telegram/{WEBHOOK_SECRET}"
        try:
            await bot.set_webhook(webhook_url, drop_pending_updates=True)
            log.info(f"Webhook set: {webhook_url}")
        except Exception as e:
            log.error(f"Failed to set webhook: {e}")
    else:
        log.warning("BOT_WEBHOOK_URL not set — webhook not configured")
    yield
    # Cleanup
    try:
        await bot.delete_webhook()
    except Exception:
        pass
    await bot.session.close()


app = FastAPI(title="NN Company CRM Bot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict to MINI_APP_URL in production if needed
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
async def health():
    return {"status": "ok", "service": "NN Company CRM Bot"}


@app.post("/telegram/{secret}")
async def telegram_webhook(secret: str, request: Request):
    """Handle Telegram webhook updates."""
    if secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        body = await request.json()
        update = types.Update(**body)
        await dp.feed_update(bot=bot, update=update)
    except Exception as e:
        log.error(f"Error processing update: {e}")
    return {"ok": True}


@app.post("/notify")
async def notify(payload: NotifyRequest, x_notify_secret: str = Header(None)):
    """
    Called by the Mini App to send Telegram notifications.
    Header: X-Notify-Secret: <NOTIFY_SECRET>
    """
    if x_notify_secret != NOTIFY_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.type == "new_lead" and payload.new_lead:
        d = payload.new_lead
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
        d = payload.status_change
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
