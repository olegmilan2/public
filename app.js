// ===== Firebase конфиг =====
const firebaseConfig = {
  apiKey: "AIzaSyA8VJCylVRlIXgMKZlHWe8pAmu9ZslEPmk",
  authDomain: "check-c1174.firebaseapp.com",
  projectId: "check-c1174",
  storageBucket: "check-c1174.firebasestorage.app",
  messagingSenderId: "620822198863",
  appId: "1:620822198863:web:ab8954aa72bd6cafc1483a",
  measurementId: "G-QWRB5L1N94",
  databaseURL: "https://check-c1174-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== Секции =====
const sections=[
  {name:"🍹 Бар", key:"bar"},
  {name:"🍳 Кухня", key:"kitchen"},
];

const defaultItems = {};
const USER_NAME_KEY = "stoplist_user_name";
const THEME_KEY = "stoplist_theme";
const ACTIVE_VIEW_KEY = "stoplist_active_view";
const IOS_INSTALL_DISMISSED_KEY = "iphone_install_prompt_dismissed";
const ANDROID_INSTALL_DISMISSED_KEY = "android_install_prompt_dismissed";
const NEW_ITEM_NOTIFICATIONS_KEY = "new_item_notifications_enabled";
const FCM_VAPID_KEY = "BJZ5GUE1xVHehU4Mx1e9XX-6GFtFK7YL1i52rtA80ki-fW0KCslTcWS3hxj_mIci0L1fnQH_ykENBMSznD4LGE4";
let currentUser = requestUserNameOnStart();
let deferredInstallPrompt = null;

const SPLASH_SHOWN_KEY = "stoplist_splash_shown_session";

function hideSplashScreen(){
  const splash = document.getElementById("splash-screen");
  if(!splash || splash.classList.contains("hide")) return;
  splash.classList.add("hide");
  document.body.classList.remove("splash-open");
  setTimeout(() => {
    splash.remove();
  }, 460);
}

function shouldShowSplash(){
  try {
    if(sessionStorage.getItem(SPLASH_SHOWN_KEY) === "1") return false;
    const nav = performance.getEntriesByType("navigation")[0];
    if(nav && nav.type === "reload") return false;
  } catch (e) {
    // ignore
  }
  return true;
}

function showSplashScreen(){
  const splash = document.getElementById("splash-screen");
  if(!splash) return;

  if(!shouldShowSplash()){
    // No flash on refresh: remove immediately.
    splash.remove();
    return;
  }

  try {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, "1");
  } catch (e) {
    // ignore
  }

  splash.classList.add("show");
  document.body.classList.add("splash-open");
}

showSplashScreen();

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // ignore service worker registration errors
    });
  });
}

window.addEventListener("load", () => {
  const splash = document.getElementById("splash-screen");
  if(!splash) return;
  setTimeout(hideSplashScreen, 620);
}, { once: true });

function storageGet(key){
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function storageSet(key, value){
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // ignore storage errors in private mode
  }
}

function isLightTheme(){
  return document.documentElement.dataset.theme === "light";
}

function updateThemeMeta(){
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if(themeColor){
    themeColor.setAttribute("content", isLightTheme() ? "#f6f7fb" : "#0b1020");
  }
}

function syncThemeToggle(){
  const toggle = document.getElementById("theme-toggle");
  if(!toggle) return;
  const light = isLightTheme();
  toggle.setAttribute("aria-checked", light ? "true" : "false");
  toggle.setAttribute("aria-label", light ? "Тёмная тема" : "Светлая тема");
}

function setTheme(theme){
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  storageSet(THEME_KEY, next);
  updateThemeMeta();
  syncThemeToggle();
}

function initThemeToggle(){
  const toggle = document.getElementById("theme-toggle");
  if(!toggle) return;

  // Fallback if the early inline script couldn't read localStorage.
  if(document.documentElement.dataset.theme !== "light" && document.documentElement.dataset.theme !== "dark"){
    const saved = (storageGet(THEME_KEY) || "").trim();
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  }

  updateThemeMeta();
  syncThemeToggle();

  toggle.addEventListener("click", () => {
    setTheme(isLightTheme() ? "dark" : "light");
  });
}

function encodeDbKey(value){
  return encodeURIComponent(value).replace(/\./g, "%2E");
}

function requestUserNameOnStart(){
  const savedName = (storageGet(USER_NAME_KEY) || "").trim();
  if(savedName) return savedName;
  const entered = prompt("Введите ваше имя:");
  const name = (entered || "Без имени").trim() || "Без имени";
  storageSet(USER_NAME_KEY, name);
  return name;
}

initThemeToggle();

function isIphoneSafari(){
  const ua = navigator.userAgent || "";
  return /iPhone/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

function isIphone(){
  return /iPhone/i.test(navigator.userAgent || "");
}

function isAndroidChrome(){
  const ua = navigator.userAgent || "";
  return /Android/i.test(ua) && /Chrome\//i.test(ua) && !/EdgA|OPR|SamsungBrowser|UCBrowser|YaBrowser/i.test(ua);
}

async function openCurrentInSafari(){
  const href = window.location.href;
  try {
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(href);
    }
  } catch (e) {
    // ignore clipboard failures
  }
  alert("iOS не дает открыть Safari автоматически.\nСсылка скопирована.\nОткройте Safari и вставьте ссылку.");
}

async function installViaChrome(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if(choice && choice.outcome === "accepted"){
    storageSet(ANDROID_INSTALL_DISMISSED_KEY, "1");
    const promptEl = document.getElementById("android-install-prompt");
    if(promptEl) promptEl.classList.remove("show");
  }
}

function isStandaloneMode(){
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateDeviceInfo(){
  const el = document.getElementById("deviceInfo");
  if(!el) return;

  const isStandalone = isStandaloneMode();
  const iphone = isIphone();
  const safari = isIphoneSafari();

  let result = "";
  if(isStandalone){
    result = "✅ Запущено как приложение (APP mode)";
  } else if(iphone && safari){
    result = "📱 iPhone Safari (можно установить как APP)";
  } else if(iphone && !safari){
    result = "📱 iPhone, но НЕ Safari (Google/Chrome)";
  } else {
    result = "💻 ПК или Android";
  }

  el.textContent = result;
}

function showInstallPrompt(promptEl){
  setTimeout(() => {
    promptEl.classList.add("show");
  }, 800);
}

function getSectionName(secKey){
  const sec = sections.find(item => item.key === secKey);
  return sec ? sec.name : secKey;
}

async function requestNotificationPermission(){
  if(!("Notification" in window)) return;
  try {
    const permission = await Notification.requestPermission();
    if(permission === "granted"){
      storageSet(NEW_ITEM_NOTIFICATIONS_KEY, "1");
      initFcmToken();
    }
  } catch (e) {
    // ignore permission errors
  }
}

function initNotificationPermissionAuto(){
  if(!("Notification" in window)) return;

  if(Notification.permission === "granted"){
    storageSet(NEW_ITEM_NOTIFICATIONS_KEY, "1");
    initFcmToken();
    return;
  }

  if(Notification.permission !== "default") return;

  const askOnFirstGesture = () => {
    requestNotificationPermission();
  };

  window.addEventListener("pointerdown", askOnFirstGesture, { once: true, passive: true });
}

async function initFcmToken(){
  if(!FCM_VAPID_KEY) return;
  if(!("Notification" in window) || Notification.permission !== "granted") return;
  if(!("serviceWorker" in navigator)) return;
  if(!firebase.messaging) return;

  try {
    const messaging = firebase.messaging();
    const registration = await navigator.serviceWorker.ready;
    const token = await messaging.getToken({
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    if(!token) return;

    const key = encodeDbKey(token);
    await db.ref(`pushTokens/${key}`).set({
      token,
      user: currentUser,
      platform: navigator.userAgent || "",
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });

    messaging.onMessage(payload => {
      if(Notification.permission !== "granted") return;
      const title = payload?.notification?.title || "Стоп лист";
      const body = payload?.notification?.body || "Новое уведомление";
      new Notification(title, {
        body,
        icon: "./app-icon-512.png",
        badge: "./app-icon-512.png"
      });
    });
  } catch (e) {
    // ignore FCM initialization errors
  }
}

function notifyNewItem(secKey, item){
  if(!("Notification" in window)) return;
  if(Notification.permission !== "granted") return;
  if(storageGet(NEW_ITEM_NOTIFICATIONS_KEY) !== "1") return;

  const title = "Новая позиция";
  const body = `${getSectionName(secKey)}: ${item.name || "Без названия"}`;
  try {
    new Notification(title, {
      body,
      icon: "./app-icon-512.png",
      badge: "./app-icon-512.png"
    });
  } catch (e) {
    // ignore notification errors
  }
}

function initNewItemNotifications(){
  // Не запрашиваем разрешение автоматически, чтобы не мешать вводу в полях.
  if("Notification" in window && Notification.permission === "granted"){
    storageSet(NEW_ITEM_NOTIFICATIONS_KEY, "1");
    initFcmToken();
  }

  sections.forEach(sec => {
    let initialLoaded = false;
    const ref = db.ref(sec.key);

    ref.once("value", () => {
      initialLoaded = true;
    });

    ref.on("child_added", snapshot => {
      if(!initialLoaded) return;
      const item = snapshot.val() || {};
      if(item.createdBy && item.createdBy === currentUser) return;
      notifyNewItem(sec.key, item);
    });
  });
}

function initIphoneInstallPrompt(){
  const promptEl = document.getElementById("iphone-install-prompt");
  const closeEl = document.getElementById("iphone-install-close");
  const openSafariEl = document.getElementById("open-in-safari");
  const actionsEl = promptEl ? promptEl.querySelector(".ios-install-actions") : null;
  const stepsEl = promptEl ? promptEl.querySelector(".ios-install-steps") : null;
  if(!promptEl || !closeEl || !stepsEl || !actionsEl || !openSafariEl) return;

  const dismissed = storageGet(IOS_INSTALL_DISMISSED_KEY) === "1";
  const iphone = isIphone();
  const safari = isIphoneSafari();
  if(!iphone || isStandaloneMode() || dismissed) return;

  if(safari){
    actionsEl.classList.add("hide");
    openSafariEl.classList.add("hide");
    stepsEl.textContent = "Tap Share → Add to Home Screen";
  } else {
    actionsEl.classList.remove("hide");
    openSafariEl.classList.remove("hide");
    openSafariEl.textContent = "Скопировать ссылку для Safari";
    stepsEl.textContent = "Open via Safari, then Tap Share → Add to Home Screen";
  }

  closeEl.addEventListener("click", () => {
    storageSet(IOS_INSTALL_DISMISSED_KEY, "1");
    promptEl.classList.remove("show");
  });

  openSafariEl.addEventListener("click", openCurrentInSafari);
  showInstallPrompt(promptEl);
}

function initAndroidInstallPrompt(){
  const promptEl = document.getElementById("android-install-prompt");
  const closeEl = document.getElementById("android-install-close");
  const installChromeEl = document.getElementById("install-in-chrome");
  if(!promptEl || !closeEl || !installChromeEl) return;

  const dismissed = storageGet(ANDROID_INSTALL_DISMISSED_KEY) === "1";
  if(!isAndroidChrome() || isStandaloneMode() || dismissed) return;

  installChromeEl.disabled = !deferredInstallPrompt;

  closeEl.addEventListener("click", () => {
    storageSet(ANDROID_INSTALL_DISMISSED_KEY, "1");
    promptEl.classList.remove("show");
  });

  installChromeEl.addEventListener("click", installViaChrome);
  showInstallPrompt(promptEl);
}

function actorMeta(){
  return {
    updatedBy: currentUser,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };
}

function formatOutDuration(outSince){
  const diffMs = Math.max(0, Date.now() - Number(outSince || 0));
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if(days > 0) return `${days}д ${hours}ч ${minutes}м`;
  if(hours > 0) return `${hours}ч ${minutes}м ${seconds}с`;
  return `${minutes}м ${seconds}с`;
}

function getTimerLabel(item){
  if(item.status !== "out") return "";
  if(!item.outSince) return "Нет: только что";
  return `Нет: ${formatOutDuration(item.outSince)}`;
}

function formatDateTime(ts){
  const date = new Date(Number(ts || 0));
  if(Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusMetaLabel(item){
  const who = item.statusBy || item.updatedBy;
  if(!who) return "";
  const when = item.statusAt || item.updatedAt;
  const whenLabel = when ? ` • ${formatDateTime(when)}` : "";
  return `Изменил: ${who}${whenLabel}`;
}

function updateTimers(){
  const nodes = document.querySelectorAll(".timer[data-out-since]");
  nodes.forEach(node => {
    const outSince = node.dataset.outSince;
    if(!outSince) return;
    node.textContent = `Нет: ${formatOutDuration(outSince)}`;
  });
}

function updateHeaderTime(){
  const el = document.getElementById("header-time");
  if(!el) return;
  el.textContent = new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function weatherCodeToText(code){
  if(code === 0) return "Ясно";
  if([1,2,3].includes(code)) return "Облачно";
  if([45,48].includes(code)) return "Туман";
  if([51,53,55,56,57].includes(code)) return "Морось";
  if([61,63,65,66,67,80,81,82].includes(code)) return "Дождь";
  if([71,73,75,77,85,86].includes(code)) return "Снег";
  if([95,96,99].includes(code)) return "Гроза";
  return "Погода";
}

async function updateHeaderWeather(){
  const el = document.getElementById("header-weather");
  if(!el) return;
  try {
    const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=46.4825&longitude=30.7233&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto";
    const seaUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=46.4825&longitude=30.7233&current=sea_surface_temperature&timezone=auto";
    const [weatherResponse, seaResponse] = await Promise.all([
      fetch(weatherUrl),
      fetch(seaUrl)
    ]);
    if(!weatherResponse.ok) throw new Error("weather fetch failed");
    const data = await weatherResponse.json();
    const seaData = seaResponse.ok ? await seaResponse.json() : {};
    const current = data.current || {};
    const seaCurrent = seaData.current || {};
    const temp = Math.round(Number(current.temperature_2m || 0));
    const wind = Math.round(Number(current.wind_speed_10m || 0));
    const code = Number(current.weather_code);
    const seaTempRaw = Number(seaCurrent.sea_surface_temperature);
    const seaTemp = Number.isFinite(seaTempRaw) ? Math.round(seaTempRaw) : null;
    const seaPart = seaTemp===null ? "" : `, вода в Черном море ${seaTemp}°C`;
    el.textContent = `Одесса: ${temp}°C, ${weatherCodeToText(code)}, ветер ${wind} км/ч${seaPart}`;
  } catch (e) {
    el.textContent = "Одесса: погода/вода недоступны";
  }
}

// ===== Рейтинг и статистика =====
const RATING_LIMIT = 20;

function normalizeItemName(name){
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е");
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scrollChatToBottom(){
  const listEl = document.getElementById("chat-messages");
  if(!listEl) return;
  listEl.scrollTop = listEl.scrollHeight;
}

function setActiveView(view){
  const stoplistTab = document.getElementById("tab-stoplist");
  const chatTab = document.getElementById("tab-chat");
  const stoplistView = document.getElementById("view-stoplist");
  const chatView = document.getElementById("view-chat");
  if(!stoplistTab || !chatTab || !stoplistView || !chatView) return;

  const next = view === "chat" ? "chat" : "stoplist";
  storageSet(ACTIVE_VIEW_KEY, next);

  const isChat = next === "chat";
  stoplistTab.setAttribute("aria-selected", isChat ? "false" : "true");
  chatTab.setAttribute("aria-selected", isChat ? "true" : "false");
  stoplistView.hidden = isChat;
  chatView.hidden = !isChat;

  if(isChat){
    // Ensure the latest message is visible when entering chat.
    requestAnimationFrame(() => requestAnimationFrame(scrollChatToBottom));
    try { chatTab.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
}

function initViewTabs(){
  const stoplistTab = document.getElementById("tab-stoplist");
  const chatTab = document.getElementById("tab-chat");
  if(stoplistTab) stoplistTab.addEventListener("click", () => setActiveView("stoplist"));
  if(chatTab) chatTab.addEventListener("click", () => setActiveView("chat"));

  const saved = (storageGet(ACTIVE_VIEW_KEY) || "").trim();
  setActiveView(saved === "chat" ? "chat" : "stoplist");
}

function initChat(){
  const listEl = document.getElementById("chat-messages");
  const formEl = document.getElementById("chat-form");
  const inputEl = document.getElementById("chat-input");
  const sendEl = document.getElementById("chat-send");
  const replyEl = document.getElementById("chat-reply");
  const replyMetaEl = document.getElementById("chat-reply-meta");
  const replySnippetEl = document.getElementById("chat-reply-snippet");
  const replyCancelEl = document.getElementById("chat-reply-cancel");
  if(!listEl || !formEl || !inputEl || !sendEl) return;

  const likeKey = encodeDbKey(currentUser || "Без имени");
  const ref = db.ref("chat/messages").orderByChild("ts").limitToLast(200);
  let currentReply = null;
  const messageIndex = new Map();

  function shouldStickToBottom(){
    const delta = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
    return delta < 32;
  }

  function scrollToBottom(){
    listEl.scrollTop = listEl.scrollHeight;
  }

  function sanitizeSnippet(text){
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 140);
  }

  function clearReply(){
    currentReply = null;
    if(replyEl) replyEl.hidden = true;
    if(replyMetaEl) replyMetaEl.textContent = "";
    if(replySnippetEl) replySnippetEl.textContent = "";
    inputEl.placeholder = "Сообщение";
  }

  function setReplyTo(messageId){
    const msg = messageIndex.get(messageId);
    if(!msg) return;
    currentReply = {
      id: msg.id,
      user: msg.user || "Без имени",
      text: sanitizeSnippet(msg.text)
    };
    if(replyMetaEl) replyMetaEl.textContent = `Ответ: ${currentReply.user}`;
    if(replySnippetEl) replySnippetEl.textContent = currentReply.text || "…";
    if(replyEl) replyEl.hidden = false;
    inputEl.placeholder = "Ответ...";
    inputEl.focus();
  }

  if(replyCancelEl){
    replyCancelEl.addEventListener("click", clearReply);
  }

  ref.on("value", snapshot => {
    const stick = shouldStickToBottom();
    const data = snapshot.val() || {};
    const messages = Object.entries(data)
      .map(([id, msg]) => ({
        id,
        text: String(msg?.text || ""),
        user: String(msg?.user || ""),
        ts: Number(msg?.ts || 0),
        likes: (msg?.likes && typeof msg.likes === "object") ? msg.likes : null,
        reply: (msg?.reply && typeof msg.reply === "object") ? msg.reply : null
      }))
      .filter(m => m.text.trim())
      .sort((a, b) => a.ts - b.ts);

    messageIndex.clear();
    messages.forEach(m => messageIndex.set(m.id, m));

    if(!messages.length){
      listEl.innerHTML = `<div class="chat-empty">Пока нет сообщений. Напишите первое.</div>`;
      return;
    }

    listEl.innerHTML = messages.map(m => {
      const mine = m.user && m.user === currentUser;
      const safeUser = escapeHtml(m.user || "Без имени");
      const safeText = escapeHtml(m.text).replace(/\n/g, "<br>");
      const time = m.ts ? escapeHtml(formatDateTime(m.ts)) : "";
      const meta = mine ? (time || "") : (time ? `${safeUser} • ${time}` : safeUser);
      const likesObj = (m.likes && typeof m.likes === "object") ? m.likes : {};
      const likeCount = Object.keys(likesObj).length;
      const liked = !!likesObj[likeKey];
      const replyUser = m.reply && m.reply.user ? escapeHtml(String(m.reply.user)) : "";
      const replyText = m.reply && m.reply.text ? escapeHtml(String(m.reply.text)) : "";
      const replyId = m.reply && m.reply.id ? escapeHtml(String(m.reply.id)) : "";
      return `
        <div class="chat-msg ${mine ? "mine" : "other"}" data-id="${escapeHtml(m.id)}">
          <div class="chat-bubble">
            ${replyUser || replyText ? `
              <button class="chat-reply-block" type="button" data-reply-id="${replyId}" aria-label="Перейти к сообщению">
                <div class="chat-reply-who">${replyUser ? `Ответ: ${replyUser}` : "Ответ"}</div>
                <div class="chat-reply-quote">${replyText || "…"}</div>
              </button>
            ` : ``}
            <div class="chat-text">${safeText}</div>
            <div class="chat-footer">
              ${meta ? `<div class="chat-meta">${meta}</div>` : `<div></div>`}
              <button class="chat-like-btn ${liked ? "liked" : ""}" type="button" data-id="${escapeHtml(m.id)}" aria-label="Лайк">
                <svg class="chat-like-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 21s-7-4.6-9.5-8.9C.5 8.4 2.4 5.7 5.4 5.2c1.7-.3 3.4.4 4.4 1.7 1-1.3 2.7-2 4.4-1.7 3 .5 4.9 3.2 2.9 6.9C19 16.4 12 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${likeCount > 0 ? `<span class="chat-like-count">${likeCount}</span>` : ``}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if(stick) scrollToBottom();
  });

  async function toggleLike(messageId){
    if(!messageId) return;
    const likesRef = db.ref(`chat/messages/${messageId}/likes`);
    try {
      await likesRef.transaction(current => {
        const obj = (current && typeof current === "object") ? current : {};
        const next = { ...obj };
        if(next[likeKey]){
          delete next[likeKey];
        } else {
          next[likeKey] = true;
        }
        return Object.keys(next).length ? next : null;
      });
    } catch (e) {
      // ignore toggle errors (rules/offline)
    }
  }

  listEl.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(".chat-like-btn") : null;
    if(!btn) return;
    e.preventDefault();
    toggleLike(btn.dataset.id);
  });

  listEl.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(".chat-reply-block") : null;
    if(!btn) return;
    const replyId = btn.dataset.replyId;
    if(!replyId) return;
    const node = Array.from(listEl.querySelectorAll(".chat-msg[data-id]")).find(el => el.dataset.id === replyId);
    if(!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    node.classList.add("chat-highlight");
    setTimeout(() => node.classList.remove("chat-highlight"), 900);
  });

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = String(inputEl.value || "").trim();
    if(!text) return;
    inputEl.value = "";
    sendEl.disabled = true;
    try {
      await db.ref("chat/messages").push({
        text,
        user: currentUser,
        ts: firebase.database.ServerValue.TIMESTAMP,
        ...(currentReply ? { reply: currentReply } : {})
      });
      clearReply();
    } catch (err) {
      console.error("Chat send error:", err);
      alert("Не удалось отправить сообщение. Проверьте интернет/правила Firebase.");
      inputEl.value = text;
    } finally {
      sendEl.disabled = false;
      inputEl.focus();
    }
  });

  inputEl.addEventListener("focus", () => {
    setTimeout(() => {
      listEl.scrollTop = listEl.scrollHeight;
    }, 50);
  });

  // Long-press to reply (iOS-like). Avoids interfering with scroll.
  let pressTimer = null;
  let pressStartX = 0;
  let pressStartY = 0;
  let pressTargetId = null;
  let pressed = false;

  function clearPress(){
    if(pressTimer){
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    pressed = false;
    pressTargetId = null;
  }

  listEl.addEventListener("pointerdown", (e) => {
    if(e.button != null && e.button !== 0) return;
    if(e.target && e.target.closest && e.target.closest("input, textarea, select, button")) return;
    const msgEl = e.target && e.target.closest ? e.target.closest(".chat-msg[data-id]") : null;
    if(!msgEl) return;

    pressed = true;
    pressStartX = e.clientX;
    pressStartY = e.clientY;
    pressTargetId = msgEl.dataset.id;
    pressTimer = setTimeout(() => {
      if(!pressed || !pressTargetId) return;
      setReplyTo(pressTargetId);
      try { window.navigator.vibrate && window.navigator.vibrate(8); } catch (err) { /* ignore */ }
      clearPress();
    }, 420);
  }, { passive: true });

  listEl.addEventListener("pointermove", (e) => {
    if(!pressed) return;
    const dx = e.clientX - pressStartX;
    const dy = e.clientY - pressStartY;
    if(Math.abs(dx) > 10 || Math.abs(dy) > 10){
      clearPress();
    }
  }, { passive: true });

  listEl.addEventListener("pointerup", clearPress, { passive: true });
  listEl.addEventListener("pointercancel", clearPress, { passive: true });
}


function ratingItemKey(name){
  return encodeDbKey(normalizeItemName(name));
}

async function incrementSimpleCounter(path){
  await db.ref(path).transaction(current => Number(current || 0) + 1);
}

async function incrementStatsOnAdd(secKey){
  await Promise.all([
    incrementSimpleCounter("stats/added/total"),
    incrementSimpleCounter(`stats/added/bySection/${secKey}`)
  ]);
}

async function incrementRatingOnAdd(secKey, rawName){
  const displayName = String(rawName || "").trim();
  const normalizedName = normalizeItemName(rawName);
  if(!normalizedName) return;
  const key = ratingItemKey(rawName);
  const ref = db.ref(`ratingItems/${key}`);

  await ref.transaction(current => {
    const prev = current || {};
    const prevCount = Number(prev.count || 0);
    const prevBySection = (prev.bySection && typeof prev.bySection === "object") ? prev.bySection : {};
    const nextSectionCount = Number(prevBySection[secKey] || 0) + 1;

    return {
      name: displayName || prev.name || normalizedName,
      normalizedName,
      count: prevCount + 1,
      bySection: {
        ...prevBySection,
        [secKey]: nextSectionCount
      },
      lastAddedAt: Date.now(),
      lastAddedBy: currentUser
    };
  });

  await incrementStatsOnAdd(secKey);
}

function renderRatingSummary(stats){
  const el = document.getElementById("rating-summary");
  if(!el) return;

  const total = Number(stats?.total || 0);
  const bySection = stats?.bySection || {};
  const parts = [];
  sections.forEach(sec => {
    const n = Number(bySection?.[sec.key] || 0);
    if(n > 0) parts.push(`${sec.name}: ${n}`);
  });

  if(total <= 0){
    el.textContent = "";
    return;
  }

  const bySectionLabel = parts.length ? ` • ${parts.join(" • ")}` : "";
  el.textContent = `Добавлений всего: ${total}${bySectionLabel}`;
}

function renderRatingList(items){
  const listEl = document.getElementById("rating-list");
  if(!listEl) return;

  if(!items.length){
    listEl.innerHTML = `<div class="rating-empty">Пока нет данных. Добавьте позицию в стоп лист, и она появится в рейтинге.</div>`;
    return;
  }

  listEl.innerHTML = items.map((item, index) => {
    const name = item.name || item.normalizedName || "Без названия";
    const count = Number(item.count || 0);
    const bySection = item.bySection || {};
    const metaParts = [];
    sections.forEach(sec => {
      const n = Number(bySection?.[sec.key] || 0);
      if(n > 0) metaParts.push(`${sec.name}: ${n}`);
    });
    const meta = metaParts.join(" • ");
    const safeName = escapeHtml(name);
    const safeMeta = escapeHtml(meta);

    return `
      <div class="rating-row">
        <div class="rating-left">
          <div class="rating-rank">#${index + 1}</div>
          <div class="rating-text">
            <div class="rating-name">${safeName}</div>
            <div class="rating-meta">${safeMeta}</div>
          </div>
        </div>
        <div class="rating-count">${count}</div>
      </div>
    `;
  }).join("");
}

function initRating(){
  const listEl = document.getElementById("rating-list");
  if(!listEl) return;

  db.ref("ratingItems")
    .orderByChild("count")
    .limitToLast(RATING_LIMIT)
    .on("value", snapshot => {
      const data = snapshot.val() || {};
      const items = Object.values(data)
        .filter(item => item && typeof item === "object")
        .map(item => ({
          name: item.name,
          normalizedName: item.normalizedName,
          count: Number(item.count || 0),
          bySection: item.bySection || {}
        }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);

      renderRatingList(items);
    });

  db.ref("stats/added").on("value", snapshot => {
    renderRatingSummary(snapshot.val() || {});
  });
}

let openSwipeItem = null;

function closeSwipeItem(itemEl){
  if(!itemEl) return;
  itemEl.classList.remove("swipe-open", "swiping");
  const content = itemEl.querySelector(".item-swipe-content");
  if(content) content.style.transform = "";
  if(openSwipeItem === itemEl) openSwipeItem = null;
}

function closeAnyOpenSwipe(exceptEl){
  if(openSwipeItem && openSwipeItem !== exceptEl){
    closeSwipeItem(openSwipeItem);
  }
}

function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

function attachSwipeToDelete(itemEl, secKey, id){
  if(!itemEl || itemEl.dataset.swipeBound === "1") return;
  itemEl.dataset.swipeBound = "1";

  const MAX_SWIPE = 160;      // px
  const OPEN_SWIPE = 88;      // px
  const OPEN_THRESHOLD = 70;  // px
  const DELETE_THRESHOLD = 140; // px

  let startX = 0;
  let startY = 0;
  let active = false;
  let dragging = false;
  let dx = 0;

  function getContent(){
    return itemEl.querySelector(".item-swipe-content");
  }

  function setDx(nextDx){
    dx = clamp(nextDx, -MAX_SWIPE, 0);
    const content = getContent();
    if(content) content.style.transform = `translateX(${dx}px)`;
  }

  function snapTo(target){
    itemEl.classList.remove("swiping");
    const content = getContent();
    if(content) content.style.transform = "";
    if(target === "open"){
      itemEl.classList.add("swipe-open");
      openSwipeItem = itemEl;
    } else {
      itemEl.classList.remove("swipe-open");
      if(openSwipeItem === itemEl) openSwipeItem = null;
    }
  }

  itemEl.addEventListener("pointerdown", (e) => {
    if(e.button != null && e.button !== 0) return;

    // Don't start swipe from controls.
    const t = e.target;
    if(t && t.closest && t.closest("input, select, textarea, button")) return;

    closeAnyOpenSwipe(itemEl);
    active = true;
    dragging = false;
    dx = 0;
    startX = e.clientX;
    startY = e.clientY;
    itemEl.classList.add("swiping");
    try { itemEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }, { passive: true });

  itemEl.addEventListener("pointermove", (e) => {
    if(!active) return;

    const moveX = e.clientX - startX;
    const moveY = e.clientY - startY;

    // If user scrolls vertically, abort swipe.
    if(!dragging && Math.abs(moveY) > 8 && Math.abs(moveY) > Math.abs(moveX)){
      active = false;
      itemEl.classList.remove("swiping");
      return;
    }

    if(!dragging && Math.abs(moveX) > 6){
      dragging = true;
    }
    if(!dragging) return;

    // Prevent "ghost clicks" after a drag.
    itemEl.dataset.swipeBlockClick = "1";
    e.preventDefault();

    setDx(moveX);
  }, { passive: false });

  itemEl.addEventListener("pointerup", async () => {
    if(!active){
      closeAnyOpenSwipe(null);
      return;
    }
    active = false;

    if(!dragging){
      itemEl.classList.remove("swiping");
      return;
    }

    const absDx = Math.abs(dx);
    if(absDx >= DELETE_THRESHOLD){
      closeSwipeItem(itemEl);
      await deleteItem(secKey, id);
      return;
    }

    if(absDx >= OPEN_THRESHOLD){
      snapTo("open");
      return;
    }

    snapTo("closed");
  });

  itemEl.addEventListener("pointercancel", () => {
    active = false;
    if(itemEl.classList.contains("swipe-open")){
      snapTo("open");
    } else {
      snapTo("closed");
    }
  });

  // Tap-to-delete on the revealed underlay.
  itemEl.addEventListener("click", async (e) => {
    if(itemEl.dataset.swipeBlockClick === "1"){
      itemEl.dataset.swipeBlockClick = "0";
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const deleteBtn = e.target && e.target.closest ? e.target.closest(".item-swipe-delete") : null;
    if(!deleteBtn) return;
    closeSwipeItem(itemEl);
    await deleteItem(secKey, id);
  });
}

document.addEventListener("pointerdown", (e) => {
  if(!openSwipeItem) return;
  if(openSwipeItem.contains(e.target)) return;
  closeSwipeItem(openSwipeItem);
}, { passive: true });

// ===== Рендер =====
function renderSection(secKey, data){
  const box=document.getElementById(secKey+"-box");
  if(!box) return;
  const existingNodes = new Map(
    Array.from(box.querySelectorAll(".item[data-id]")).map(node => [node.dataset.id, node])
  );
  const actualIds = new Set(Object.keys(data));
  for(const id in data){
    const item = data[id];
    let div = existingNodes.get(id);
    const isNew = !div;
    if(!div){
      div = document.createElement("div");
      div.dataset.id = id;
      div.className = "item";
    }
    if(item.status==="out") div.classList.add("out");
    if(item.status==="ok") div.classList.add("ok");
    if(item.status!=="out") div.classList.remove("out");
    if(item.status!=="ok") div.classList.remove("ok");
    div.classList.remove("item-leave");

    const typeLabel = secKey==="bar" ? (item.type==="portion"?"🥃 Порционно":"🧴 Бутылки") : "";
    const step=item.type==="portion"?"0.01":"1";

    div.innerHTML=`
      <div class="item-swipe-under" aria-hidden="true">
        <button class="item-swipe-delete" type="button" tabindex="-1">Удалить</button>
      </div>
      <div class="item-swipe-content">
        <div class="line">
          <div class="name">${item.name}</div>
          <div class="type">${typeLabel}</div>
          <input class="qty" type="number" step="${step}" value="${item.qty}" onchange="changeQty('${secKey}','${id}',this.value)">
          <input class="status-check" type="checkbox" ${item.status==="ok"?"checked":""} onchange="toggleStatus('${secKey}','${id}',this.checked)" title="Есть в наличии">
          <button class="btn-delete" onclick="deleteItem('${secKey}','${id}')">×</button>
        </div>
        <div class="timer ${item.status==="out"?"show":""}" data-out-since="${item.outSince || ""}">${getTimerLabel(item)}</div>
        <div class="meta">${getStatusMetaLabel(item)}</div>
      </div>
    `;
    box.appendChild(div);

    if(isNew){
      attachSwipeToDelete(div, secKey, id);
      div.classList.add("item-enter");
      requestAnimationFrame(() => {
        div.classList.add("item-enter-active");
      });
      setTimeout(() => {
        div.classList.remove("item-enter", "item-enter-active");
      }, 230);
    }
  }

  existingNodes.forEach((node, id) => {
    if(actualIds.has(id) || node.classList.contains("item-leave")) return;
    node.classList.add("item-leave");
    setTimeout(() => {
      if(node.classList.contains("item-leave")) node.remove();
    }, 230);
  });
}

function ensureOutSince(secKey, data){
  const updates = {};
  let hasUpdates = false;
  for(const id in data){
    const item = data[id];
    if(!item) continue;
    if(item.status === "out" && !item.outSince){
      updates[`${id}/outSince`] = firebase.database.ServerValue.TIMESTAMP;
      hasUpdates = true;
    }
    if(item.status === "ok" && item.outSince){
      updates[`${id}/outSince`] = null;
      hasUpdates = true;
    }
  }
  if(hasUpdates) db.ref(secKey).update(updates);
}

// ===== Загрузка данных =====
function loadData(secKey){
  db.ref(secKey).on('value', snapshot => {
    const data = snapshot.val() || {};
    if (Object.keys(data).length === 0 && defaultItems[secKey]) {
      db.ref(secKey).update(defaultItems[secKey]);
      return;
    }
    ensureOutSince(secKey, data);
    renderSection(secKey, data);
  });
}

// ===== Изменения =====
function changeQty(secKey,id,value){
  db.ref(`${secKey}/${id}`).update({
    qty: value,
    ...actorMeta()
  });
}
async function setStatus(secKey,id,status){
  db.ref(`${secKey}/${id}`).update({
    status,
    outSince: status==="out" ? firebase.database.ServerValue.TIMESTAMP : null,
    statusBy: currentUser,
    statusAt: firebase.database.ServerValue.TIMESTAMP,
    ...actorMeta()
  });
}
function toggleStatus(secKey,id,isChecked){
  setStatus(secKey,id,isChecked ? "ok" : "out");
}
async function deleteItem(secKey,id){
  if(!confirm("Удалить позицию?")) return;
  db.ref(`${secKey}/${id}`).remove();
}

// ===== Добавление =====
async function addItem(secKey){
  const nameEl = document.getElementById(secKey+"-name");
  const name = nameEl.value.trim();
  if(!name) return;
  let type = "unit";
  if(secKey==="bar") type = document.getElementById(secKey+"-type").value;

  try {
    await db.ref(secKey).push({
      name:name,
      qty:0,
      status:"out",
      outSince: firebase.database.ServerValue.TIMESTAMP,
      statusBy: currentUser,
      statusAt: firebase.database.ServerValue.TIMESTAMP,
      createdBy: currentUser,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      ...actorMeta(),
      type:type
    });
    try {
      await incrementRatingOnAdd(secKey, name);
    } catch (e) {
      console.warn("Rating/stats update failed:", e);
    }
  } catch (err) {
    console.error("Add item error:", err);
    alert("Ошибка сохранения. Проверьте интернет/правила Firebase.");
    return;
  } finally {
    nameEl.value="";
  }
}

async function clearStopListWithPassword(){
  const pass = prompt("Введите пароль для удаления стоп листа:");
  if(pass === null) return;
  if(pass.trim() !== "1"){
    alert("Неверный пароль");
    return;
  }
  if(!confirm("Удалить весь стоп лист? Это действие необратимо.")) return;

  try {
    await Promise.all([
      db.ref("bar").remove(),
      db.ref("kitchen").remove()
    ]);
    alert("Стоп лист удален");
  } catch (e) {
    alert("Ошибка удаления. Проверьте интернет.");
  }
}

function initDangerActions(){
  const clearBtn = document.getElementById("clear-stop-list");
  if(clearBtn){
    clearBtn.addEventListener("click", clearStopListWithPassword);
  }
}

// ===== Инициализация UI =====
const app=document.getElementById("app");
sections.forEach(sec=>{
  const box=document.createElement("div");
  box.className=`section section-${sec.key}`;
  box.innerHTML=`<h2 class="section-title">${sec.name}</h2><div id="${sec.key}-box" class="items-box"></div>`;
  app.appendChild(box);

  const addForm=document.createElement("div");
  addForm.className="add-form";
  addForm.innerHTML=`
    <div class="form-grid">
      <input id="${sec.key}-name" placeholder="Название позиции">
      ${sec.key==="bar"?`
      <select id="${sec.key}-type">
        <option value="bottle">🧴 Бутылки</option>
        <option value="portion">🥃 Порционно</option>
      </select>` : ""}
    </div>
    <button class="btn-add" onclick="addItem('${sec.key}')">Добавить позицию</button>
  `;
  box.appendChild(addForm);
  const nameInput = addForm.querySelector(`#${sec.key}-name`);
  if(nameInput){
    nameInput.addEventListener("keydown", event => {
      if(event.key !== "Enter") return;
      event.preventDefault();
      addItem(sec.key);
    });
  }

  loadData(sec.key);
});

setInterval(updateTimers, 1000);
updateHeaderTime();
setInterval(updateHeaderTime, 1000);
updateHeaderWeather();
setInterval(updateHeaderWeather, 600000);

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const installBtn = document.getElementById("install-in-chrome");
  if(installBtn) installBtn.disabled = false;
});

window.addEventListener("appinstalled", () => {
  storageSet(ANDROID_INSTALL_DISMISSED_KEY, "1");
  const promptEl = document.getElementById("android-install-prompt");
  if(promptEl) promptEl.classList.remove("show");
});

initIphoneInstallPrompt();
initAndroidInstallPrompt();
updateDeviceInfo();
initViewTabs();
initChat();
initNewItemNotifications();
initDangerActions();
initRating();
