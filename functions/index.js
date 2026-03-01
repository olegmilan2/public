"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const SECTION_LABELS = {
  bar: "🍹 Бар",
  kitchen: "🍳 Кухня"
};

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

exports.notifyNewItemBar = functions.database.ref("/bar/{itemId}").onCreate(async (snap) => {
  const item = snap.val() || {};
  try {
    await sendNewItemPush({ sectionKey: "bar", item });
  } catch (e) {
    console.error("notifyNewItemBar failed:", e);
  }
});

exports.notifyNewItemKitchen = functions.database.ref("/kitchen/{itemId}").onCreate(async (snap) => {
  const item = snap.val() || {};
  try {
    await sendNewItemPush({ sectionKey: "kitchen", item });
  } catch (e) {
    console.error("notifyNewItemKitchen failed:", e);
  }
});

