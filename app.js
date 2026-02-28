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
const IOS_INSTALL_DISMISSED_KEY = "iphone_install_prompt_dismissed";
const ANDROID_INSTALL_DISMISSED_KEY = "android_install_prompt_dismissed";
let currentUser = requestUserNameOnStart();
let deferredInstallPrompt = null;

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // ignore service worker registration errors
    });
  });
}

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

function requestUserNameOnStart(){
  const savedName = (storageGet(USER_NAME_KEY) || "").trim();
  if(savedName) return savedName;
  const entered = prompt("Введите ваше имя:");
  const name = (entered || "Без имени").trim() || "Без имени";
  storageSet(USER_NAME_KEY, name);
  return name;
}

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

function showInstallPrompt(promptEl){
  setTimeout(() => {
    promptEl.classList.add("show");
  }, 800);
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
      <div class="line">
        <div class="name">${item.name}</div>
        <div class="type">${typeLabel}</div>
        <input class="qty" type="number" step="${step}" value="${item.qty}" onchange="changeQty('${secKey}','${id}',this.value)">
        <input class="status-check" type="checkbox" ${item.status==="ok"?"checked":""} onchange="toggleStatus('${secKey}','${id}',this.checked)" title="Есть в наличии">
        <button class="btn-delete" onclick="deleteItem('${secKey}','${id}')">×</button>
      </div>
      <div class="timer ${item.status==="out"?"show":""}" data-out-since="${item.outSince || ""}">${getTimerLabel(item)}</div>
      <div class="meta">${getStatusMetaLabel(item)}</div>
    `;
    box.appendChild(div);

    if(isNew){
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
function setStatus(secKey,id,status){
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
function deleteItem(secKey,id){
  if(!confirm("Удалить позицию?")) return;
  db.ref(`${secKey}/${id}`).remove();
}

// ===== Добавление =====
function addItem(secKey){
  const nameEl = document.getElementById(secKey+"-name");
  const name = nameEl.value.trim();
  if(!name) return;
  let type = "unit";
  if(secKey==="bar") type = document.getElementById(secKey+"-type").value;

  db.ref(secKey).push({
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
  nameEl.value="";
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
