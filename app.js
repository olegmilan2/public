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
  {name:"🍳 Кухня", key:"kitchen"},
  {name:"🍹 Бар", key:"bar"},
  {name:"💨 Кальянная", key:"hookah"}
];

// ===== Рендер =====
function renderSection(secKey, data){
  const box=document.getElementById(secKey+"-box");
  if(!box) return;
  box.innerHTML="";
  for(const id in data){
    const item = data[id];
    const div=document.createElement("div");
    div.className="item";
    if(item.status==="out") div.classList.add("out");
    if(item.status==="ok") div.classList.add("ok");

    const typeLabel = secKey==="bar" ? (item.type==="portion"?"🥃 Порционно":"🧴 Бутылки") : "";
    const step=item.type==="portion"?"0.01":"1";

    div.innerHTML=`
      <div class="line">
        <div class="name">${item.name}</div>
        <div class="type">${typeLabel}</div>
        <input class="qty" type="number" step="${step}" value="${item.qty}" onchange="changeQty('${secKey}','${id}',this.value)">
        <button class="btn-delete" onclick="deleteItem('${secKey}','${id}')">🗑</button>
      </div>
      <div class="row">
        <button class="btn-out" onclick="setStatus('${secKey}','${id}','out')">Нет</button>
        <button class="btn-ok" onclick="setStatus('${secKey}','${id}','ok')">Есть</button>
      </div>
    `;
    box.appendChild(div);
  }
}

// ===== Загрузка данных =====
function loadData(secKey){
  db.ref(secKey).on('value', snapshot => {
    const data = snapshot.val() || {};
    renderSection(secKey, data);
  });
}

// ===== Изменения =====
function changeQty(secKey,id,value){
  db.ref(`${secKey}/${id}/qty`).set(value);
}
function setStatus(secKey,id,status){
  db.ref(`${secKey}/${id}/status`).set(status);
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

  db.ref(secKey).push({name:name, qty:0, status:"ok", type:type});
  nameEl.value="";
}

// ===== Инициализация UI =====
const app=document.getElementById("app");
sections.forEach(sec=>{
  const box=document.createElement("div");
  box.className="section";
  box.innerHTML=`<h2 class="section-title">${sec.name}</h2><div id="${sec.key}-box"></div>`;
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
