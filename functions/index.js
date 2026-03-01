"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SECTION_LABELS = {
  bar: "🍹 Бар",
  kitchen: "🍳 Кухня"
};

function getTelegramSecrets() {
  try {
    const cfg = (typeof functions.config === "function" ? functions.config() : null) || null;
    const token =
      (process.env.TELEGRAM_BOT_TOKEN ? String(process.env.TELEGRAM_BOT_TOKEN) : "") ||
      (cfg && cfg.telegram && cfg.telegram.bot_token ? String(cfg.telegram.bot_token) : "");
    const chatId =
      (process.env.TELEGRAM_CHAT_ID ? String(process.env.TELEGRAM_CHAT_ID) : "") ||
      (cfg && cfg.telegram && cfg.telegram.chat_id ? String(cfg.telegram.chat_id) : "");
    return { token: token.trim(), chatId: chatId.trim() };
  } catch (e) {
    const token = process.env.TELEGRAM_BOT_TOKEN ? String(process.env.TELEGRAM_BOT_TOKEN) : "";
    const chatId = process.env.TELEGRAM_CHAT_ID ? String(process.env.TELEGRAM_CHAT_ID) : "";
    return { token: token.trim(), chatId: chatId.trim() };
  }
}

async function isTelegramEnabled() {
  const snap = await admin.database().ref("settings/telegram/enabled").once("value");
  const v = snap.val();
  if (v === null || v === undefined) {
    const { token, chatId } = getTelegramSecrets();
    return !!token && !!chatId; // default: enabled if configured
  }
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v.trim() === "1" || v.trim().toLowerCase() === "true";
  return false;
}

async function sendTelegramHtml(text) {
  const { token, chatId } = getTelegramSecrets();
  if (!token || !chatId) return { ok: false, skipped: "not_configured" };

  const message = String(text || "").trim();
  if (!message) return { ok: false, skipped: "empty_message" };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await resp.json();
  } catch (e) {
    // ignore
  }

  if (!resp.ok || !data || data.ok !== true) {
    const errText = data && data.description ? String(data.description) : `HTTP ${resp.status}`;
    throw new Error(`Telegram send failed: ${errText}`);
  }

  return { ok: true };
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function isInvalidTokenError(code) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

async function sendNewItemPush({ sectionKey, item }) {
  const itemName = (item && item.name ? String(item.name) : "").trim() || "Без названия";
  const createdBy = (item && item.createdBy ? String(item.createdBy) : "").trim();

  const sectionLabel = SECTION_LABELS[sectionKey] || sectionKey;
  const title = "Новая позиция";
  const body = `${sectionLabel}: ${itemName}`;
  const url = "./";

  const tokensSnap = await admin.database().ref("pushTokens").once("value");
  const tokensObj = tokensSnap.val() || {};

  const tokens = [];
  const tokenKeys = [];
  for (const [key, record] of Object.entries(tokensObj)) {
    const token = record && record.token ? String(record.token) : "";
    const user = record && record.user ? String(record.user) : "";
    if (!token) continue;
    if (createdBy && user && user === createdBy) continue; // don't notify the author
    tokens.push(token);
    tokenKeys.push(key);
  }

  if (!tokens.length) return { sent: 0, removed: 0 };

  const messaging = admin.messaging();

  let sent = 0;
  let removed = 0;

  // FCM multicast limit is 500.
  const chunks = chunk(tokens.map((t, i) => ({ token: t, key: tokenKeys[i] })), 500);
  for (const part of chunks) {
    const message = {
      tokens: part.map(x => x.token),
      notification: { title, body },
      data: { url, section: sectionKey, type: "new_item" },
      webpush: {
        fcmOptions: { link: url },
        notification: {
          title,
          body,
          icon: "app-icon-512.png",
          badge: "app-icon-512.png"
        }
      }
    };

    const resp = await messaging.sendEachForMulticast(message);
    sent += resp.successCount;

    const invalidKeys = [];
    resp.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = r.error && r.error.code ? String(r.error.code) : "";
      if (isInvalidTokenError(code)) invalidKeys.push(part[idx].key);
    });

    if (invalidKeys.length) {
      const updates = {};
      for (const k of invalidKeys) updates[`pushTokens/${k}`] = null;
      await admin.database().ref().update(updates);
      removed += invalidKeys.length;
    }
  }

  return { sent, removed };
}

async function sendNewItemTelegram({ sectionKey, item }) {
  const enabled = await isTelegramEnabled();
  if (!enabled) return { ok: false, skipped: "disabled" };

  const itemName = (item && item.name ? String(item.name) : "").trim() || "Без названия";
  const createdBy = (item && item.createdBy ? String(item.createdBy) : "").trim() || "Без имени";
  const sectionLabel = SECTION_LABELS[sectionKey] || sectionKey;

  const message =
    `🚨 <b>СТОП-ЛИСТ ОБНОВЛЕН</b>\n\n` +
    `📦 Секция: <b>${escapeHtml(sectionLabel)}</b>\n` +
    `❌ Позиция: <b>${escapeHtml(itemName)}</b>\n` +
    `👤 Кто: <b>${escapeHtml(createdBy)}</b>`;

  return sendTelegramHtml(message);
}

exports.notifyNewItemBar = functions.database.ref("/bar/{itemId}").onCreate(async (snap) => {
  const item = snap.val() || {};
  try {
    await sendNewItemPush({ sectionKey: "bar", item });
  } catch (e) {
    console.error("notifyNewItemBar failed:", e);
  }
  try {
    await sendNewItemTelegram({ sectionKey: "bar", item });
  } catch (e) {
    console.error("notifyNewItemBar telegram failed:", e);
  }
});

exports.notifyNewItemKitchen = functions.database.ref("/kitchen/{itemId}").onCreate(async (snap) => {
  const item = snap.val() || {};
  try {
    await sendNewItemPush({ sectionKey: "kitchen", item });
  } catch (e) {
    console.error("notifyNewItemKitchen failed:", e);
  }
  try {
    await sendNewItemTelegram({ sectionKey: "kitchen", item });
  } catch (e) {
    console.error("notifyNewItemKitchen telegram failed:", e);
  }
});

exports.telegramTestRequest = functions.database
  .ref("/settings/telegram/testRequests/{requestId}")
  .onCreate(async (snap, ctx) => {
    const req = snap.val() || {};
    try {
      const enabled = await isTelegramEnabled();
      if (!enabled) return;
      const who = req && req.user ? String(req.user) : "Без имени";
      await sendTelegramHtml(`✅ <b>Тест</b>: Telegram уведомления работают\nПользователь: <b>${escapeHtml(who)}</b>`);
    } catch (e) {
      console.error("telegramTestRequest failed:", e);
    } finally {
      // Best-effort cleanup to avoid accumulating requests.
      try {
        await admin.database().ref(`/settings/telegram/testRequests/${ctx.params.requestId}`).remove();
      } catch (e) {
        // ignore
      }
    }
  });
