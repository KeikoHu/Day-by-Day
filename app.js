// =============================
// Day by Day – Full JS + Firebase
// =============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";

// ---------- Firebase Config ----------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// -----------------------------
// State
// -----------------------------
const LS_KEY = "daybyday_final_v2";
let state = { habits: [], completions: {} };
if(localStorage.getItem(LS_KEY)) state = JSON.parse(localStorage.getItem(LS_KEY));

let weekOffset = 0;
let query = "";
let userId = null;

// -----------------------------
// Elements
// -----------------------------
const habitTable = document.getElementById("habitTable");
const weekLabel = document.getElementById("weekLabel");
const weeklyPct = document.getElementById("weeklyPct");
const progressFill = document.getElementById("progressFill");
const doneCount = document.getElementById("doneCount");
const xpValue = document.getElementById("xpValue");
const levelBadge = document.getElementById("levelBadge");
const nextLevel = document.getElementById("nextLevel");
const levelFill = document.getElementById("levelFill");
const searchInput = document.getElementById("searchInput");
const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");
const thisWeekBtn = document.getElementById("thisWeekBtn");
const addHabitBtn = document.getElementById("addHabitBtn");
const resetWeekBtn = document.getElementById("resetWeekBtn");
const loginBtn = document.getElementById("loginBtn");
const tabs = document.querySelectorAll(".tab-btn");
const pages = document.querySelectorAll(".page");
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// -----------------------------
// Utils
// -----------------------------
const saveToLocal = () => localStorage.setItem(LS_KEY, JSON.stringify(state));
const save = async () => {
  saveToLocal();
  if(!userId) return;
  await setDoc(doc(db,"users",userId), state);
};
const startOfWeek = (d=new Date()) => {
  d=new Date(d); const day=d.getDay();
  const diff=(day===0?-6:1)-day;
  d.setDate(d.getDate()+diff); d.setHours(0,0,0,0); return d;
};
const addDays=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const fmtKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const getWeekStart=()=>addDays(startOfWeek(), weekOffset*7);
const getWeekKeys=()=>Array.from({length:7},(_,i)=>fmtKey(addDays(getWeekStart(),i)));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const difficultyMult=d=>d==="hard"?2:d==="medium"?1.5:1;

// -----------------------------
// Core
// -----------------------------
const isChecked=(hid,key)=>!!state.completions[hid]?.[key];
const toggleCell=(hid,key)=>{
  if(!state.completions[hid]) state.completions[hid]={};
  state.completions[hid][key]=!state.completions[hid][key];
  save(); render();
};
const calcStreak=hid=>{
  let s=0;
  for(let i=0;i<30;i++){
    const k=fmtKey(addDays(new Date(),-i));
    if(isChecked(hid,k)) s++; else break;
  } return s;
};

// -----------------------------
// Render
// -----------------------------
let lineChart, barChart, histLine, histBar;
function render(){
  const weekKeys=getWeekKeys();
  weekLabel.textContent=`${getWeekStart().toLocaleDateString()} – ${addDays(getWeekStart(),6).toLocaleDateString()}`;

  // ---------- TABLE ----------
  habitTable.innerHTML="";
  const thead=document.createElement("thead");
  const trh=document.createElement("tr");
  ["Habit","Mon","Tue","Wed","Thu","Fri","Sat","Sun","Streak","Delete"].forEach((t,i)=>{
    const th=document.createElement("th"); th.textContent=t; if(i===0) th.className="habit-col"; trh.appendChild(th);
  });
  thead.appendChild(trh); habitTable.appendChild(thead);

  const tbody=document.createElement("tbody");
  const habits=query ? state.habits.filter(h=>h.name.toLowerCase().includes(query)) : state.habits;

  habits.forEach(h=>{
    const tr=document.createElement("tr");
    const tdH=document.createElement("td"); tdH.className="habit-col";
    const nameDiv=document.createElement("div"); nameDiv.textContent=`${h.emoji} ${h.name} `;
    tdH.appendChild(nameDiv);

    ["easy","medium","hard"].forEach(level=>{
      const btn=document.createElement("button"); btn.textContent=level; btn.className="btn "+(h.difficulty===level?"primary":""); btn.style.fontSize="10px";
      btn.onclick=()=>{ h.difficulty=level; save(); render(); };
      tdH.appendChild(btn);
    });
    tr.appendChild(tdH);

    weekKeys.forEach(k=>{
      const td=document.createElement("td");
      const btn=document.createElement("button"); btn.className="cell-btn";
      if(isChecked(h.id,k)){ btn.classList.add("checked"); btn.textContent="✓"; }
      btn.onclick=()=>toggleCell(h.id,k); td.appendChild(btn); tr.appendChild(td);
    });

    const tdS=document.createElement("td"); tdS.textContent=calcStreak(h.id); tdS.style.fontWeight="800"; tr.appendChild(tdS);

    const tdDel=document.createElement("td");
    const delBtn=document.createElement("button"); delBtn.textContent="🗑"; delBtn.className="btn danger";
    delBtn.onclick=()=>{
      if(confirm(`Delete habit "${h.name}"?`)){
        state.habits=state.habits.filter(x=>x.id!==h.id); delete state.completions[h.id]; save(); render();
      }
    }; tdDel.appendChild(delBtn); tr.appendChild(tdDel);

    tbody.appendChild(tr);
  });
  habitTable.appendChild(tbody);

  // ---------- PROGRESS ----------
  const total=state.habits.length*7;
  let done=0,xp=0;
  state.habits.forEach(h=>{
    weekKeys.forEach(k=>{ if(isChecked(h.id,k)){ done++; xp+=10*difficultyMult(h.difficulty); }});
    const streak=calcStreak(h.id);
    if(streak>=7) xp+=100; else if(streak>=5) xp+=50; else if(streak>=3) xp+=20;
  });

  const pct=total?done/total*100:0;
  progressFill.style.width=`${pct}%`;
  let status="Needs focus ⚠"; if(pct>=80) status="On Fire 🔥"; else if(pct>=50) status="Stable 🙂";
  weeklyPct.textContent=`${pct.toFixed(1)}% — ${status}`;
  doneCount.textContent=`Done ${done} / ${total}`;

  animateNumber(xpValue, Math.round(xp));
  const level=Math.floor(xp/250)+1;
  levelBadge.textContent=`Level ${level}`;
  nextLevel.textContent=`${xp} / ${level*250}`;
  levelFill.style.width=`${clamp(xp/(level*250)*100,0,100)}%`;

  renderCharts();
}

// -----------------------------
// Charts
function renderCharts(){
  const weekKeys=getWeekKeys();
  const dailyPct=weekKeys.map(k=>state.habits.length?Math.round(state.habits.filter(h=>isChecked(h.id,k)).length/state.habits.length*100):0);

  lineChart?.destroy();
  lineChart=new Chart(document.getElementById("lineChart"),{
    type:"line",
    data:{labels:DAYS,datasets:[{data:dailyPct,label:"Daily Consistency (%)",fill:true}]},
    options:{scales:{y:{min:0,max:100}},plugins:{legend:{display:false}}}
  });

  const habitStats=state.habits.map(h=>{
    const d=weekKeys.filter(k=>isChecked(h.id,k)).length;
    return {name:h.name,pct:Math.round(d/7*100)};
  }).sort((a,b)=>a.pct-b.pct);

  barChart?.destroy();
  barChart=new Chart(document.getElementById("barChart"),{
    type:"bar",
    data:{labels:habitStats.map(h=>h.name),datasets:[{data:habitStats.map(h=>h.pct),label:"Habit Success (%)"}]},
    options:{scales:{y:{min:0,max:100}},plugins:{legend:{display:false}}}
  });

  // Historical Charts
  const histLabels=[], histData=[];
  for(let w=-5; w<=0; w++){
    const ws=addDays(getWeekStart(),w*7);
    const keys=Array.from({length:7},(_,i)=>fmtKey(addDays(ws,i)));
    const possible=state.habits.length*7;
    const done=state.habits.reduce((a,h)=>a+keys.filter(k=>isChecked(h.id,k)).length,0);
    histLabels.push(ws.toLocaleDateString(undefined,{month:"short",day:"numeric"}));
    histData.push(possible?Math.round(done/possible*100):0);
  }

  histLine?.destroy();
  histLine=new Chart(document.getElementById("histLineChart"),{
    type:"line",
    data:{labels:histLabels,datasets:[{label:"Historical Consistency (%)",data:histData,fill:true,backgroundColor:"rgba(34,197,94,0.15)",borderColor:"rgba(34,197,94,0.8)",tension:0.3}]},
    options:{scales:{y:{min:0,max:100}},plugins:{legend:{display:false}}}
  });

  histBar?.destroy();
  histBar=new Chart(document.getElementById("histBarChart"),{
    type:"bar",
    data:{labels:histLabels,datasets:[{label:"Historical Consistency (%)",data:histData,backgroundColor:"rgba(34,197,94,0.6)"}]},
    options:{scales:{y:{min:0,max:100}},plugins:{legend:{display:false}}}
  });
}

// -----------------------------
// Animate number
function animateNumber(el,target){
  const start=Number(el.textContent)||0;
  const diff=target-start; let f=0; const frames=20;
  const tick=()=>{ f++; el.textContent=Math.round(start+diff*(f/frames)); if(f<frames) requestAnimationFrame(tick); };
  tick();
}

// -----------------------------
// Events
searchInput.oninput=e=>{ query=e.target.value.toLowerCase(); render(); }
prevWeekBtn.onclick=()=>{ weekOffset--; render(); }
nextWeekBtn.onclick=()=>{ weekOffset++; render(); }
thisWeekBtn.onclick=()=>{ weekOffset=0; render(); }

addHabitBtn.onclick=()=>{
  const name=prompt("Habit name?");
  if(!name) return;
  state.habits.push({id:Date.now().toString(),name,emoji:"🔥",difficulty:"easy"});
  save(); render();
};

resetWeekBtn.onclick=()=>{
  if(!confirm("Reset this week?")) return;
  getWeekKeys().forEach(k=>state.habits.forEach(h=>delete state.completions[h.id]?.[k]));
  save(); render();
};

tabs.forEach(t=>{
  t.onclick=()=>{
    tabs.forEach(x=>x.classList.remove("active"));
    pages.forEach(p=>p.classList.add("hidden"));
    t.classList.add("active");
    document.getElementById(t.dataset.page).classList.remove("hidden");
    renderCharts();
  };
});

// -----------------------------
// Firebase login
loginBtn.onclick=async()=>{
  try{
    const result=await signInWithPopup(auth,provider);
    userId=result.user.uid;
    loginBtn.style.display="none"; // hide after login
    const docRef=doc(db,"users",userId);
    const docSnap=await getDoc(docRef);
    if(docSnap.exists()) state=docSnap.data();
    render();
  }catch(e){console.error(e);}
};

// -----------------------------
render();
