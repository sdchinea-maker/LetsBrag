// ============================================================
//  LetsBrag — Sailor Achievement Tracker
//  Firebase Auth + Firestore + Offline + Voice Dictation
// ============================================================

import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ─── FIREBASE (loaded via CDN scripts injected below) ─────────────────────────
// We use dynamic import so this works in StackBlitz without npm install
let auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
    getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc;

async function initFirebase() {
  const app    = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const authMod= await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
  const fsMod  = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  const firebaseApp = app.initializeApp({
    apiKey:            "AIzaSyDZsr048cWcLdmREovQ4t9p2PANwilGyew",
    authDomain:        "letsbrag.firebaseapp.com",
    projectId:         "letsbrag",
    storageBucket:     "letsbrag.firebasestorage.app",
    messagingSenderId: "196979143235",
    appId:             "1:196979143235:web:91521873aa86e4958b5af6"
  });

  auth              = authMod.getAuth(firebaseApp);
  signInWithPopup   = authMod.signInWithPopup;
  signOut           = authMod.signOut;
  onAuthStateChanged= authMod.onAuthStateChanged;
  googleProvider    = new authMod.GoogleAuthProvider();

  db          = fsMod.getFirestore(firebaseApp);
  doc         = fsMod.doc;
  setDoc      = fsMod.setDoc;
  getDoc      = fsMod.getDoc;
  collection  = fsMod.collection;
  getDocs     = fsMod.getDocs;
  deleteDoc   = fsMod.deleteDoc;

  return true;
}

// ─── STYLES / TOKENS ─────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');`;

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #060E1C; font-family: 'DM Sans', sans-serif; color: #E8EDF5; -webkit-font-smoothing: antialiased; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: #0D1829; }
::-webkit-scrollbar-thumb { background: #2A3A54; border-radius: 3px; }
input, textarea, select, button { font-family: 'DM Sans', sans-serif; }
a { color: inherit; text-decoration: none; }

@keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
@keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:.4; } }
@keyframes spin     { to { transform: rotate(360deg); } }

.fade-up   { animation: fadeUp  .35s ease both; }
.fade-in   { animation: fadeIn  .25s ease both; }
.pulse-rec { animation: pulse 1.4s ease infinite; }
.spin      { animation: spin .8s linear infinite; }
.card-hover { transition: transform .18s ease, box-shadow .18s ease; }
.card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,.35) !important; }

@media (max-width: 640px) {
  .hide-sm    { display: none !important; }
  .two-col    { grid-template-columns: 1fr !important; }
  .three-col  { grid-template-columns: 1fr 1fr !important; }
  .stat-grid  { grid-template-columns: 1fr 1fr !important; }
  .modal-cols { grid-template-columns: 1fr !important; }
  .brag-grid  { grid-template-columns: 1fr !important; }
  .tab-text   { display: none !important; }
}
@media (min-width: 641px) {
  .show-sm-only { display: none !important; }
}
`;

const C = {
  navy:"#060E1C", navyMid:"#0D1829", navyCard:"#111E32", navyBorder:"#1C2E48",
  red:"#CE3334", redLight:"#FF4E4F", gold:"#F5A623", blue:"#3E89FF", green:"#2ECC71",
  text:"#E8EDF5", textDim:"#7A8FA8", textFaint:"#3A4E68",
};

const PIE = {
  P:{ bg:"rgba(124,99,255,.15)", color:"#A78BFA", border:"rgba(124,99,255,.4)", label:"Performance",      desc:"Job duties, quals, watch standing" },
  I:{ bg:"rgba(62,137,255,.15)", color:"#60A5FA", border:"rgba(62,137,255,.4)", label:"Self-Improvement", desc:"Education, certs, advancement, PFA" },
  E:{ bg:"rgba(46,204,113,.15)", color:"#4ADE80", border:"rgba(46,204,113,.4)", label:"Exposure",         desc:"Awards, boards, volunteering" },
};

const STATUS = {
  "Complete":    { bg:"rgba(46,204,113,.12)",  color:"#4ADE80", dot:"#2ECC71" },
  "In Progress": { bg:"rgba(62,137,255,.12)",  color:"#60A5FA", dot:"#3E89FF" },
  "On Hold":     { bg:"rgba(206,51,52,.12)",   color:"#FCA5A5", dot:"#CE3334" },
  "Not Started": { bg:"rgba(122,143,168,.12)", color:"#7A8FA8", dot:"#5A7080" },
};

const PRIORITY = {
  "High":   { bg:"rgba(206,51,52,.15)",  color:"#FCA5A5" },
  "Medium": { bg:"rgba(245,166,35,.15)", color:"#FCD34D" },
  "Low":    { bg:"rgba(122,143,168,.12)",color:"#7A8FA8" },
};

const SKILLS_OPTIONS = ["Leadership","Tactical Proficiency","Damage Control","Watch Standing","Training & Mentorship","Administrative","Seamanship","Navigation","Communications","Maintenance & Logistics","Physical Readiness","Community Service","Education"];
const VISIBILITY_OPT = ["Division Officer only","Department Head","XO","CO","Group/Squadron","Fleet/TYCOM","Community-wide"];
const EVAL_PERIODS   = ["Periodic","Detachment","Promotion","Fitness Report","CHIEFEVAL"];
const QUARTERS       = ["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"];
const Q_SHORT        = {"Q1 (Jan–Mar)":"Q1","Q2 (Apr–Jun)":"Q2","Q3 (Jul–Sep)":"Q3","Q4 (Oct–Dec)":"Q4"};
const CMD_OBJ        = ["Mission Readiness","Force Multiplication","Sailor Development","Community Outreach","Administrative Excellence","Safety","Retention"];
const PAYGRADES      = ["E-1","E-2","E-3","E-4","E-5","E-6","E-7","E-8","E-9","W-1","W-2","W-3","W-4","W-5","O-1","O-2","O-3","O-4","O-5","O-6"];
const ILOVE_CATS     = ["Award Certificate","Commendation Letter","Photo — Ceremony","Photo — Event / Underway","Qualification Card","NEC Certificate","Other"];
const DOC_CATS       = ["Career Roadmap","Rate Training Manual","NAVADMIN / Directive","PRD / Orders","Transfer Docs","Personal Statement / Bio","Resume / Package","Other"];

const SAMPLE_TASKS = [
  { id:1, name:"DC Training Program Overhaul", status:"Complete", priority:"High", pie:"P", quarter:"Q1 (Jan–Mar)", evalPeriod:"Periodic", requestor:"LT Ramirez, DCA", commandObjective:"Mission Readiness", description:"Redesigned the ship's DC qual card system and created 12 new hands-on drills.", impact:"DC qual rate increased from 54% to 91% across 47 Sailors in 8 weeks. Zero INSURV discrepancies — first time in 6 years.", visibility:"CO", evidence:"", feedback:'"Single-handedly transformed our DC program." — LT Ramirez', skills:["Leadership","Damage Control","Training & Mentorship"], createdAt:"2026-01-20" },
  { id:2, name:"E-6 Advancement Exam — Scored 74.5 (Top 8%)", status:"Complete", priority:"High", pie:"I", quarter:"Q1 (Jan–Mar)", evalPeriod:"Promotion", requestor:"Self / ESO", commandObjective:"Sailor Development", description:"Self-studied 6+ hours/week over 3 months. Mentored 2 junior Sailors for E-5 simultaneously.", impact:"Top 8% Navy-wide. Both mentored Sailors also advanced.", visibility:"Department Head", evidence:"", feedback:'"Sets the gold standard for personal advancement." — Chief Alvarez', skills:["Tactical Proficiency","Training & Mentorship"], createdAt:"2026-02-10" },
  { id:3, name:"Battle Group Logistics — COMPTUEX", status:"Complete", priority:"High", pie:"E", quarter:"Q2 (Apr–Jun)", evalPeriod:"Periodic", requestor:"LCDR Nguyen, Supply Officer", commandObjective:"Mission Readiness", description:"Primary liaison between USS [Ship] and three allied warships for 18-day exercise.", impact:"Zero supply shortfalls. Resolved billing discrepancy saving $47,000.", visibility:"Group/Squadron", evidence:"", feedback:'"Performed at the O-4 level." — LCDR Nguyen', skills:["Administrative","Maintenance & Logistics"], createdAt:"2026-04-15" },
  { id:4, name:"Command Fitness Leader Certification", status:"In Progress", priority:"Medium", pie:"I", quarter:"Q2 (Apr–Jun)", evalPeriod:"Fitness Report", requestor:"Self / CFC", commandObjective:"Sailor Development", description:"Completing CFL certification to lead command PT for 180+ Sailors.", impact:"", visibility:"XO", evidence:"", feedback:"", skills:["Physical Readiness","Training & Mentorship"], createdAt:"2026-05-01" },
  { id:5, name:"Junior Sailor of the Quarter — Q3", status:"Complete", priority:"High", pie:"E", quarter:"Q3 (Jul–Sep)", evalPeriod:"Periodic", requestor:"CMC / Advancement Board", commandObjective:"Retention", description:"Selected from 12 nominees across all departments.", impact:"1-of-1 from 12 nominees. Basis for Early Promote recommendation.", visibility:"CO", evidence:"", feedback:'"A future Chief." — CMC Robinson', skills:["Leadership","Community Service"], createdAt:"2026-07-20" },
  { id:6, name:"Naval Station Food Drive Lead", status:"Complete", priority:"Low", pie:"E", quarter:"Q3 (Jul–Sep)", evalPeriod:"Periodic", requestor:"MWR / Chapel", commandObjective:"Community Outreach", description:"Organized ship-wide food drive across 4 departments.", impact:"1,847 lbs collected — largest single-ship contribution in base history.", visibility:"Community-wide", evidence:"", feedback:'"Selfless service." — CAPT Wallace', skills:["Community Service","Leadership"], createdAt:"2026-08-05" },
];

const EMPTY_TASK    = { name:"", status:"Not Started", priority:"Medium", pie:"P", quarter:"Q1 (Jan–Mar)", evalPeriod:"Periodic", requestor:"", commandObjective:"Mission Readiness", description:"", impact:"", visibility:"Division Officer only", evidence:"", feedback:"", skills:[], createdAt:"" };
const EMPTY_PROFILE = { name:"", paygrade:"E-5", rate:"", ship:"", command:"", prd:"", bio:"" };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const dateStr = () => new Date().toISOString().slice(0,10);
const clamp   = (v,lo,hi) => Math.min(hi,Math.max(lo,v));

function useLocalStorage(key, init) {
  const [val, setVal] = useState(()=>{ try{ const s=localStorage.getItem(key); return s?JSON.parse(s):init; }catch{ return init; } });
  const set = useCallback(v=>{ setVal(v); try{ localStorage.setItem(key,JSON.stringify(v)); }catch{} },[key]);
  return [val,set];
}

// ─── SMALL UI COMPONENTS ──────────────────────────────────────────────────────

function Bar({ value, max, color=C.red, h=6 }) {
  const pct = max===0?0:clamp(Math.round((value/max)*100),0,100);
  return <div style={{ background:C.navyBorder, borderRadius:99, height:h, overflow:"hidden", flex:1 }}><div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width .6s ease" }} /></div>;
}

function StatusBadge({ value, small }) {
  const s=STATUS[value]||STATUS["Not Started"], p=small?"2px 8px":"3px 11px", fs=small?10:11;
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:s.bg, color:s.color, borderRadius:99, padding:p, fontSize:fs, fontWeight:600, whiteSpace:"nowrap" }}><span style={{ width:6,height:6,borderRadius:"50%",background:s.dot,flexShrink:0 }}/>{value}</span>;
}

function PriBadge({ value, small }) {
  const s=PRIORITY[value]||PRIORITY["Low"], p=small?"2px 8px":"3px 11px", fs=small?10:11;
  return <span style={{ background:s.bg, color:s.color, borderRadius:99, padding:p, fontSize:fs, fontWeight:600, whiteSpace:"nowrap" }}>{value}</span>;
}

function PieBadge({ value, small }) {
  const s=PIE[value]||PIE.P, p=small?"2px 8px":"3px 9px", fs=small?10:11;
  return <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:99, padding:p, fontSize:fs, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", whiteSpace:"nowrap" }}>{value}</span>;
}

function StatCard({ label, value, sub, accent=C.red, icon, delay=0 }) {
  return (
    <div className="fade-up" style={{ background:C.navyCard, borderRadius:12, padding:"16px 18px", borderTop:`3px solid ${accent}`, animationDelay:`${delay}ms` }}>
      {icon&&<div style={{ fontSize:20, marginBottom:8 }}>{icon}</div>}
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:30, color:C.text, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:12, color:C.textDim, marginTop:5 }}>{label}</div>
      {sub&&<div style={{ fontSize:11, color:C.textFaint, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function VoiceBtn({ onResult }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef();
  const toggle = () => {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR){ alert("Voice dictation not supported. Try Chrome on Android or Safari on iOS."); return; }
    if (listening){ recRef.current?.stop(); setListening(false); return; }
    const rec=new SR(); rec.lang="en-US"; rec.continuous=false; rec.interimResults=false;
    rec.onresult=e=>{ onResult(e.results[0][0].transcript); setListening(false); };
    rec.onerror=()=>setListening(false); rec.onend=()=>setListening(false);
    recRef.current=rec; rec.start(); setListening(true);
  };
  return (
    <button onClick={toggle} style={{ position:"absolute", right:10, top:10, width:30, height:30, borderRadius:"50%", border:`1.5px solid ${listening?C.red:C.navyBorder}`, background:listening?"rgba(206,51,52,.15)":C.navyMid, color:listening?C.redLight:C.textDim, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
      <span className={listening?"pulse-rec":""}>🎙️</span>
    </button>
  );
}

function OfflineBanner() {
  const [offline,setOffline]=useState(!navigator.onLine);
  useEffect(()=>{ const on=()=>setOffline(false),off=()=>setOffline(true); window.addEventListener("online",on); window.addEventListener("offline",off); return()=>{ window.removeEventListener("online",on); window.removeEventListener("offline",off); }; },[]);
  if (!offline) return null;
  return <div style={{ background:"rgba(245,166,35,.15)", borderBottom:`1px solid rgba(245,166,35,.3)`, padding:"7px 18px", display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.gold }}><span>📵</span><span><strong>You're offline</strong> — LetsBrag still works. Data syncs when you reconnect.</span></div>;
}

// ─── FILE CARD ────────────────────────────────────────────────────────────────
function FileCard({ file, onDelete, onEdit }) {
  const isImg=file.dataUrl&&file.type?.startsWith("image/"), isPDF=file.type==="application/pdf";
  const iconBg=isPDF?"rgba(206,51,52,.2)":isImg?"rgba(62,137,255,.2)":"rgba(124,99,255,.2)";
  const iconCol=isPDF?C.redLight:isImg?"#60A5FA":"#A78BFA";
  return (
    <div className="card-hover fade-up" style={{ background:C.navyCard, borderRadius:12, overflow:"hidden", border:`1px solid ${C.navyBorder}` }}>
      <div style={{ height:120, background:C.navyMid, overflow:"hidden", cursor:file.dataUrl?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:6 }} onClick={()=>file.dataUrl&&window.open(file.dataUrl,"_blank")}>
        {isImg?<img src={file.dataUrl} alt={file.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />:<><div style={{ width:44,height:44,borderRadius:10,background:iconBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{isPDF?"📄":"📁"}</div><span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,color:iconCol,letterSpacing:1 }}>{file.name?.split(".").pop().toUpperCase()}</span></>}
      </div>
      <div style={{ padding:"10px 12px" }}>
        <div style={{ fontWeight:600,fontSize:12,color:C.text,marginBottom:3,wordBreak:"break-word" }}>{file.title||file.name}</div>
        <div style={{ fontSize:10,color:C.blue,fontWeight:600,marginBottom:4 }}>{file.category}</div>
        {file.notes&&<div style={{ fontSize:11,color:C.textDim,lineHeight:1.5,marginBottom:4 }}>{file.notes}</div>}
        <div style={{ fontSize:10,color:C.textFaint }}>{file.addedDate}</div>
      </div>
      <div style={{ display:"flex", borderTop:`1px solid ${C.navyBorder}` }}>
        <button onClick={onEdit}   style={{ flex:1,padding:"8px",background:"none",border:"none",fontSize:12,color:C.blue,fontWeight:600,cursor:"pointer" }}>Edit</button>
        <button onClick={onDelete} style={{ flex:1,padding:"8px",background:"none",border:"none",fontSize:12,color:C.redLight,fontWeight:600,cursor:"pointer" }}>Remove</button>
      </div>
    </div>
  );
}

// ─── FILE MODAL ───────────────────────────────────────────────────────────────
function FileModal({ existing, categories, onSave, onClose }) {
  const [title,setTitle]=useState(existing?.title||""), [category,setCategory]=useState(existing?.category||categories[0]);
  const [notes,setNotes]=useState(existing?.notes||""), [fileData,setFileData]=useState(existing||null), [dragging,setDragging]=useState(false);
  const fileRef=useRef();
  const handleFile=f=>{ if(!f)return; const r=new FileReader(); r.onload=e=>{ setFileData({name:f.name,type:f.type,dataUrl:e.target.result}); if(!title)setTitle(f.name.replace(/\.[^.]+$/,"")); }; r.readAsDataURL(f); };
  const inp={ fontSize:13,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"9px 11px",width:"100%",background:C.navyMid,outline:"none",color:C.text };
  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:460,maxHeight:"92vh",overflow:"auto",border:`1px solid ${C.navyBorder}` }}>
        <div style={{ padding:"16px 18px",borderBottom:`1px solid ${C.navyBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:C.text }}>{existing?"Edit File":"Upload File"}</span>
          <button onClick={onClose} style={{ background:C.navyMid,border:"none",color:C.textDim,width:28,height:28,borderRadius:"50%",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:18,display:"flex",flexDirection:"column",gap:13 }}>
          <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}} onClick={()=>fileRef.current.click()}
            style={{ border:`2px dashed ${dragging?C.red:C.navyBorder}`,borderRadius:10,padding:"22px 14px",textAlign:"center",cursor:"pointer",background:dragging?"rgba(206,51,52,.05)":C.navyMid }}>
            <input ref={fileRef} type="file" style={{ display:"none" }} accept="image/*,.pdf,.doc,.docx" onChange={e=>handleFile(e.target.files[0])} />
            {fileData?<div><div style={{ fontSize:24,marginBottom:6 }}>{fileData.type?.startsWith("image/")?"🖼️":"📄"}</div><div style={{ fontSize:13,fontWeight:600,color:C.text }}>{fileData.name}</div><div style={{ fontSize:11,color:C.textDim,marginTop:2 }}>Tap to replace</div></div>
              :<div><div style={{ fontSize:28,marginBottom:8 }}>📎</div><div style={{ fontSize:13,fontWeight:600,color:C.textDim }}>Tap to upload or drag & drop</div><div style={{ fontSize:11,color:C.textFaint,marginTop:3 }}>Images, PDF, Word docs</div></div>}
          </div>
          <div><label style={{ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 }}>Title</label><input style={inp} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Navy Achievement Medal — Apr 2026" /></div>
          <div><label style={{ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 }}>Category</label><select style={{...inp,cursor:"pointer"}} value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label style={{ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 }}>Notes (optional)</label><textarea style={{...inp,height:58,resize:"vertical"}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Context, source, what it's for..." /></div>
          <div style={{ display:"flex",gap:9,paddingTop:6,borderTop:`1px solid ${C.navyBorder}` }}>
            <button onClick={onClose} style={{ flex:1,padding:"10px",background:C.navyMid,color:C.textDim,border:"none",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>Cancel</button>
            <button onClick={()=>{ if(title.trim()||fileData) onSave({...fileData,title:title||fileData?.name||"Untitled",category,notes,addedDate:existing?.addedDate||new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}); }}
              style={{ flex:1,padding:"10px",background:C.red,color:"#fff",border:"none",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ACHIEVEMENT MODAL ────────────────────────────────────────────────────────
function AchModal({ task, onSave, onDelete, onClose, isEdit }) {
  const [form,setForm]=useState(task);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const appendVoice=(k,v)=>setForm(f=>({...f,[k]:f[k]?f[k]+" "+v:v}));
  const toggle=s=>set("skills",form.skills.includes(s)?form.skills.filter(x=>x!==s):[...form.skills,s]);
  const inp={ fontSize:13,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"9px 11px",width:"100%",background:C.navyMid,outline:"none",color:C.text };
  const sl={...inp,cursor:"pointer"};
  const lbl={ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 };
  const Sec=({title,children})=><div style={{ marginBottom:20 }}><div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.red,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${C.navyBorder}` }}>{title}</div><div className="modal-cols" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:11 }}>{children}</div></div>;
  const F=({label,full,children})=><div style={{ gridColumn:full?"1/-1":undefined }}><label style={lbl}>{label}</label>{children}</div>;
  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:740,maxHeight:"95vh",overflow:"auto",border:`1px solid ${C.navyBorder}` }}>
        <div style={{ background:C.navy,padding:"15px 18px",borderBottom:`1px solid ${C.navyBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10 }}>
          <div><div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>{isEdit?"Edit Achievement":"Log New Achievement"}</div><div style={{ fontSize:11,color:C.textFaint,marginTop:1 }}>🎙️ Tap mic on any field to dictate by voice</div></div>
          <button onClick={onClose} style={{ background:C.navyMid,border:"none",color:C.textDim,width:30,height:30,borderRadius:"50%",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:18 }}>
          <Sec title="Achievement Details">
            <F label="Achievement Name *" full><div style={{ position:"relative" }}><input style={{...inp,paddingRight:46}} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Write it like an EVAL bullet..." /><VoiceBtn onResult={v=>set("name",v)} /></div></F>
            <F label="Status"><select style={sl} value={form.status} onChange={e=>set("status",e.target.value)}>{Object.keys(STATUS).map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="Priority"><select style={sl} value={form.priority} onChange={e=>set("priority",e.target.value)}>{["High","Medium","Low"].map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="PIE Category"><select style={sl} value={form.pie} onChange={e=>set("pie",e.target.value)}><option value="P">P — Performance</option><option value="I">I — Self-Improvement</option><option value="E">E — Exposure</option></select></F>
            <F label="Quarter"><select style={sl} value={form.quarter} onChange={e=>set("quarter",e.target.value)}>{QUARTERS.map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="EVAL Period"><select style={sl} value={form.evalPeriod} onChange={e=>set("evalPeriod",e.target.value)}>{EVAL_PERIODS.map(s=><option key={s}>{s}</option>)}</select></F>
          </Sec>
          <Sec title="Command Context">
            <F label="Who Can Validate"><input style={inp} value={form.requestor} onChange={e=>set("requestor",e.target.value)} placeholder="Name, Rate/Rank" /></F>
            <F label="Command Objective"><select style={sl} value={form.commandObjective} onChange={e=>set("commandObjective",e.target.value)}>{CMD_OBJ.map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="Visibility"><select style={sl} value={form.visibility} onChange={e=>set("visibility",e.target.value)}>{VISIBILITY_OPT.map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="Evidence / Link"><input style={inp} value={form.evidence} onChange={e=>set("evidence",e.target.value)} placeholder="NDAWS, award orders, link..." /></F>
          </Sec>
          <Sec title="Narrative & Impact">
            <F label="What You Did" full><div style={{ position:"relative" }}><textarea style={{...inp,height:72,resize:"vertical",paddingRight:46}} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="What was the situation? What did YOU do?" /><VoiceBtn onResult={v=>appendVoice("description",v)} /></div></F>
            <F label="⭐ Quantifiable Impact — YOUR MOST IMPORTANT FIELD" full>
              <div style={{ position:"relative" }}><textarea style={{...inp,height:90,resize:"vertical",borderColor:C.red,paddingRight:46,background:"rgba(206,51,52,.05)"}} value={form.impact} onChange={e=>set("impact",e.target.value)} placeholder="e.g. 'Increased DC qual rate from 54% to 91% across 47 Sailors in 8 weeks. Zero INSURV discrepancies.'" /><VoiceBtn onResult={v=>appendVoice("impact",v)} /></div>
              <div style={{ fontSize:11,color:C.red,marginTop:4,fontWeight:600 }}>How many Sailors? What % improved? $$ saved? How fast?</div>
            </F>
            <F label="Feedback / Exact Quotes" full><div style={{ position:"relative" }}><textarea style={{...inp,height:56,resize:"vertical",paddingRight:46}} value={form.feedback} onChange={e=>set("feedback",e.target.value)} placeholder='"Quote here" — Chief Smith, LPO' /><VoiceBtn onResult={v=>appendVoice("feedback",v)} /></div></F>
          </Sec>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.red,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${C.navyBorder}` }}>Core Competencies</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>{SKILLS_OPTIONS.map(s=><button key={s} onClick={()=>toggle(s)} style={{ padding:"6px 12px",borderRadius:99,border:`1.5px solid ${form.skills.includes(s)?C.red:C.navyBorder}`,background:form.skills.includes(s)?"rgba(206,51,52,.15)":C.navyMid,color:form.skills.includes(s)?C.redLight:C.textDim,fontSize:12,fontWeight:600,cursor:"pointer" }}>{s}</button>)}</div>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14,borderTop:`1px solid ${C.navyBorder}` }}>
            <div>{isEdit&&<button onClick={()=>{ if(window.confirm("Delete this achievement? This cannot be undone.")) onDelete(task.id); }} style={{ background:"rgba(206,51,52,.15)",color:C.redLight,border:`1px solid rgba(206,51,52,.3)`,padding:"9px 15px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>🗑 Delete Achievement</button>}</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={onClose} style={{ background:C.navyMid,color:C.textDim,border:"none",padding:"9px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>Cancel</button>
              <button onClick={()=>{ if(form.name.trim()) onSave({...form,createdAt:form.createdAt||dateStr()}); }} style={{ background:C.red,color:"#fff",border:"none",padding:"9px 22px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer" }}>{isEdit?"Save Changes":"Log It"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ACHIEVEMENT TABLE ────────────────────────────────────────────────────────
function AchTable({ tasks, onRowClick }) {
  const th={ padding:"11px 13px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color:C.textDim,letterSpacing:1,textAlign:"left",whiteSpace:"nowrap",background:C.navyMid,borderBottom:`1px solid ${C.navyBorder}` };
  if (!tasks.length) return <div style={{ background:C.navyCard,borderRadius:12,padding:"40px 20px",textAlign:"center",border:`1px solid ${C.navyBorder}` }}><div style={{ fontSize:32,marginBottom:10 }}>⚓</div><div style={{ fontSize:13,color:C.textDim }}>No achievements here yet.</div></div>;
  return (
    <div style={{ background:C.navyCard,borderRadius:12,overflow:"hidden",border:`1px solid ${C.navyBorder}` }}>
      <table style={{ width:"100%",borderCollapse:"collapse" }}>
        <thead><tr><th style={th}></th><th style={th}>Achievement</th><th style={th} className="hide-sm">Status</th><th style={th} className="hide-sm">PIE</th><th style={th} className="hide-sm">Quarter</th><th style={th} className="hide-sm">Priority</th></tr></thead>
        <tbody>{tasks.map((t,i)=>(
          <tr key={t.id} onClick={()=>onRowClick(t)} style={{ cursor:"pointer",borderBottom:`1px solid ${C.navyBorder}`,animationDelay:`${i*30}ms` }} className="fade-up"
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.03)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <td style={{ padding:"11px 13px",width:30 }}><div style={{ width:18,height:18,borderRadius:5,border:`2px solid ${t.status==="Complete"?C.green:C.navyBorder}`,background:t.status==="Complete"?"rgba(46,204,113,.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>{t.status==="Complete"&&<span style={{ color:C.green,fontSize:11 }}>✓</span>}</div></td>
            <td style={{ padding:"11px 13px" }}><div style={{ fontWeight:600,fontSize:13,color:C.text }}>{t.name}</div>{t.commandObjective&&<div style={{ fontSize:11,color:C.textFaint,marginTop:2 }}>{t.commandObjective}</div>}<div className="show-sm-only" style={{ marginTop:5 }}><StatusBadge value={t.status} small /></div></td>
            <td style={{ padding:"11px 13px" }} className="hide-sm"><StatusBadge value={t.status} /></td>
            <td style={{ padding:"11px 13px" }} className="hide-sm"><PieBadge value={t.pie} /></td>
            <td style={{ padding:"11px 13px",fontSize:12,color:C.textDim }} className="hide-sm">{Q_SHORT[t.quarter]||t.quarter}</td>
            <td style={{ padding:"11px 13px" }} className="hide-sm"><PriBadge value={t.priority} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ─── FILE GALLERY ─────────────────────────────────────────────────────────────
function FileGallery({ files, setFiles, categories, emptyIcon, emptyMsg }) {
  const [showModal,setShowModal]=useState(false), [editing,setEditing]=useState(null), [filterCat,setFilterCat]=useState("All");
  const nextId=()=>Math.max(0,...files.map(f=>f.id||0))+1;
  const displayed=filterCat==="All"?files:files.filter(f=>f.category===filterCat);
  const saveFile=data=>{ editing?setFiles(fs=>fs.map(f=>f.id===editing.id?{...data,id:editing.id}:f)):setFiles(fs=>[...fs,{...data,id:nextId()}]); setShowModal(false); setEditing(null); };
  const sel={ fontSize:12,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"7px 10px",background:C.navyMid,cursor:"pointer",outline:"none",color:C.text };
  return (
    <div>
      <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
        <select style={sel} value={filterCat} onChange={e=>setFilterCat(e.target.value)}><option>All</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
        <span style={{ fontSize:12,color:C.textFaint }}>{displayed.length} file{displayed.length!==1?"s":""}</span>
        <div style={{ flex:1 }} />
        <button onClick={()=>{setEditing(null);setShowModal(true);}} style={{ background:C.red,color:"#fff",border:"none",padding:"9px 16px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>+ Upload</button>
      </div>
      {displayed.length===0
        ?<div style={{ background:C.navyCard,borderRadius:12,padding:"50px 20px",textAlign:"center",border:`1px solid ${C.navyBorder}` }}><div style={{ fontSize:40,marginBottom:10 }}>{emptyIcon}</div><div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:C.text,marginBottom:6 }}>Nothing here yet</div><div style={{ fontSize:13,color:C.textDim,marginBottom:16 }}>{emptyMsg}</div><button onClick={()=>setShowModal(true)} style={{ background:C.red,color:"#fff",border:"none",padding:"10px 20px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>Upload First File</button></div>
        :<div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:13 }}>{displayed.map(f=><FileCard key={f.id} file={f} onDelete={()=>setFiles(fs=>fs.filter(x=>x.id!==f.id))} onEdit={()=>{setEditing(f);setShowModal(true);}} />)}</div>
      }
      {showModal&&<FileModal existing={editing} categories={categories} onSave={saveFile} onClose={()=>{setShowModal(false);setEditing(null);}} />}
    </div>
  );
}

// ─── QUICK LOG ────────────────────────────────────────────────────────────────
function QuickLog({ onSave }) {
  const [open,setOpen]=useState(false), [name,setName]=useState(""), [pie,setPie]=useState("P"), [listening,setListening]=useState(false);
  const recRef=useRef();
  const startVoice=()=>{ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){alert("Voice not supported on this browser.");return;} if(listening){recRef.current?.stop();setListening(false);return;} const rec=new SR(); rec.lang="en-US"; rec.continuous=false; rec.interimResults=false; rec.onresult=e=>{setName(e.results[0][0].transcript);setListening(false);}; rec.onerror=()=>setListening(false); rec.onend=()=>setListening(false); recRef.current=rec; rec.start(); setListening(true); };
  const save=()=>{ if(!name.trim())return; onSave({...EMPTY_TASK,id:Date.now(),name,pie,status:"Not Started",createdAt:dateStr()}); setName(""); setOpen(false); };
  if (!open) return <button onClick={()=>setOpen(true)} style={{ position:"fixed",bottom:24,right:24,width:56,height:56,borderRadius:"50%",background:C.red,border:"none",color:"#fff",fontSize:22,cursor:"pointer",boxShadow:"0 6px 24px rgba(206,51,52,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>;
  return (
    <div className="fade-in" style={{ position:"fixed",bottom:24,right:24,background:C.navyCard,borderRadius:16,padding:16,width:300,boxShadow:"0 12px 40px rgba(0,0,0,.5)",border:`1px solid ${C.navyBorder}`,zIndex:200 }}>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text,marginBottom:11 }}>⚡ Quick Log a Win</div>
      <div style={{ position:"relative",marginBottom:10 }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="What did you accomplish?" onKeyDown={e=>e.key==="Enter"&&save()} style={{ fontSize:13,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"9px 44px 9px 11px",width:"100%",background:C.navyMid,outline:"none",color:C.text }} />
        <button onClick={startVoice} style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:listening?C.red:C.textFaint }}><span className={listening?"pulse-rec":""}>{listening?"🔴":"🎙️"}</span></button>
      </div>
      <div style={{ display:"flex",gap:7,marginBottom:12 }}>{Object.entries(PIE).map(([k,v])=><button key={k} onClick={()=>setPie(k)} style={{ flex:1,padding:"6px 4px",borderRadius:8,border:`1.5px solid ${pie===k?v.color:C.navyBorder}`,background:pie===k?v.bg:C.navyMid,color:pie===k?v.color:C.textFaint,fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,cursor:"pointer" }}>{k}</button>)}</div>
      <div style={{ display:"flex",gap:7 }}>
        <button onClick={()=>setOpen(false)} style={{ flex:1,padding:"9px",background:C.navyMid,color:C.textDim,border:"none",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>Cancel</button>
        <button onClick={save} style={{ flex:2,padding:"9px",background:C.red,color:"#fff",border:"none",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>Log It</button>
      </div>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileScreen({ profile, setProfile, user, onLogout, appYear, setAppYear }) {
  const [editing,setEditing]=useState(false), [form,setForm]=useState(profile);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=()=>{ setProfile(form); setEditing(false); };
  const inp={ fontSize:13,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"9px 11px",width:"100%",background:C.navyMid,outline:"none",color:C.text };
  const lbl={ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 };
  return (
    <div className="fade-up">
      <div style={{ background:`linear-gradient(135deg,${C.navyCard},rgba(206,51,52,.1))`,borderRadius:16,padding:24,marginBottom:20,border:`1px solid ${C.navyBorder}`,position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",right:-10,top:-10,fontSize:100,opacity:.05,userSelect:"none" }}>⚓</div>
        <div style={{ display:"flex",alignItems:"center",gap:16 }}>
          {user?.photoURL?<img src={user.photoURL} alt="avatar" style={{ width:60,height:60,borderRadius:14,border:`2px solid ${C.red}` }} />:<div style={{ width:60,height:60,borderRadius:14,background:`linear-gradient(135deg,${C.red},#8B0000)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>⚓</div>}
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:C.text,lineHeight:1 }}>{profile.name||user?.displayName||"Your Name"}</div>
            <div style={{ fontSize:13,color:C.textDim,marginTop:4 }}>{[profile.paygrade,profile.rate].filter(Boolean).join(" ")}{profile.ship&&<span> · {profile.ship}</span>}</div>
            {user?.email&&<div style={{ fontSize:11,color:C.textFaint,marginTop:2 }}>{user.email}</div>}
          </div>
        </div>
        {profile.prd&&<div style={{ marginTop:14,padding:"8px 12px",background:"rgba(245,166,35,.1)",borderRadius:8,border:`1px solid rgba(245,166,35,.2)`,fontSize:12,color:C.gold }}>📅 PRD: {profile.prd}</div>}
      </div>
      {!editing?(
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={()=>{setForm(profile);setEditing(true);}} style={{ flex:1,padding:"11px",background:C.red,color:"#fff",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer" }}>Edit Profile</button>
          <button onClick={onLogout} style={{ padding:"11px 16px",background:C.navyMid,color:C.textDim,border:`1px solid ${C.navyBorder}`,borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer" }}>Sign Out</button>
        </div>
      ):(
        <div style={{ background:C.navyCard,borderRadius:14,padding:20,border:`1px solid ${C.navyBorder}` }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text,marginBottom:16 }}>Edit Profile</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
            <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Full Name</label><input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Petty Officer Jane Smith" /></div>
            <div><label style={lbl}>Paygrade</label><select style={{...inp,cursor:"pointer"}} value={form.paygrade} onChange={e=>set("paygrade",e.target.value)}>{PAYGRADES.map(p=><option key={p}>{p}</option>)}</select></div>
            <div><label style={lbl}>Rate / Designator</label><input style={inp} value={form.rate} onChange={e=>set("rate",e.target.value)} placeholder="IT, BM, HM..." /></div>
            <div><label style={lbl}>Ship / Unit</label><input style={inp} value={form.ship} onChange={e=>set("ship",e.target.value)} placeholder="USS [Ship Name]" /></div>
            <div><label style={lbl}>Command</label><input style={inp} value={form.command} onChange={e=>set("command",e.target.value)} placeholder="Command name" /></div>
            <div style={{ gridColumn:"1/-1" }}><label style={lbl}>PRD</label><input style={{...inp,maxWidth:200}} type="date" value={form.prd} onChange={e=>set("prd",e.target.value)} /></div>
            <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Bio (optional)</label><textarea style={{...inp,height:70,resize:"vertical"}} value={form.bio} onChange={e=>set("bio",e.target.value)} placeholder="Career focus and goals..." /></div>
            <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Current Year (shown in app header)</label><select style={{...inp,cursor:"pointer",maxWidth:160}} value={appYear} onChange={e=>setAppYear(Number(e.target.value))}>{[2024,2025,2026,2027,2028,2029,2030].map(y=><option key={y}>{y}</option>)}</select></div>
          </div>
          <div style={{ display:"flex",gap:9 }}>
            <button onClick={()=>setEditing(false)} style={{ flex:1,padding:"10px",background:C.navyMid,color:C.textDim,border:"none",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>Cancel</button>
            <button onClick={save} style={{ flex:2,padding:"10px",background:C.red,color:"#fff",border:"none",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer" }}>Save Profile</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onGoogleLogin, onDemo, loading }) {
  return (
    <div className="fade-in" style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,background:C.navy,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,backgroundImage:`radial-gradient(circle at 20% 20%, rgba(206,51,52,.08) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(62,137,255,.06) 0%, transparent 60%)`,pointerEvents:"none" }} />
      <div style={{ position:"absolute",fontSize:300,opacity:.03,userSelect:"none",pointerEvents:"none",lineHeight:1 }}>⚓</div>
      <div style={{ position:"relative",textAlign:"center",maxWidth:380,width:"100%" }}>
        <div style={{ width:72,height:72,borderRadius:18,background:`linear-gradient(135deg,${C.red},#8B0000)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 20px",boxShadow:"0 8px 32px rgba(206,51,52,.4)" }}>⚓</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:52,color:C.text,letterSpacing:-1,lineHeight:1 }}>LetsBrag</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,fontSize:16,color:C.textDim,letterSpacing:3,textTransform:"uppercase",marginTop:4,marginBottom:8 }}>for U.S. Sailors</div>
        <div style={{ fontSize:14,color:C.textDim,lineHeight:1.7,marginBottom:32 }}>Your year-round achievement log.<br/>Built for EVAL season. Used all year.</div>

        <button onClick={onGoogleLogin} disabled={loading} style={{ width:"100%",padding:"14px 20px",background:"#fff",color:"#111",border:"none",borderRadius:10,fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12,boxShadow:"0 4px 16px rgba(0,0,0,.3)",opacity:loading?0.7:1 }}>
          {loading?<span className="spin" style={{ display:"inline-block",width:18,height:18,border:"2px solid #ccc",borderTopColor:"#333",borderRadius:"50%" }} />
            :<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>}
          {loading?"Signing in...":"Continue with Google"}
        </button>

        <button onClick={onDemo} style={{ width:"100%",padding:"12px 20px",background:"transparent",color:C.textDim,border:`1px solid ${C.navyBorder}`,borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer",marginBottom:24 }}>Try Demo (no login)</button>

        <div style={{ fontSize:11,color:C.textFaint,lineHeight:1.6 }}>🔒 Your data is private and encrypted.<br/>Works offline — log wins anywhere, anytime.</div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS=[
  {id:"overview", icon:"📊",label:"Overview"},
  {id:"tasks",    icon:"✅",label:"Achievements"},
  {id:"byquarter",icon:"📅",label:"By Quarter"},
  {id:"brag",     icon:"⭐",label:"Brag Doc"},
  {id:"iloveme",  icon:"🎖️", label:"I Love Me"},
  {id:"docs",     icon:"📂",label:"Career Docs"},
  {id:"profile",  icon:"👤",label:"Profile"},
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [user,          setUser]          = useState(null);
  const [authLoading,   setAuthLoading]   = useState(false);
  const [loggedIn,      setLoggedIn]      = useLocalStorage("lb_loggedIn", false);
  const [tasks,         setTasks]         = useLocalStorage("lb_tasks",    SAMPLE_TASKS);
  const [profile,       setProfile]       = useLocalStorage("lb_profile",  EMPTY_PROFILE);
  const [ilovemeFiles,  setIlovemeFiles]  = useLocalStorage("lb_ilove",    []);
  const [docFiles,      setDocFiles]      = useLocalStorage("lb_docs",     []);
  const [appYear,       setAppYear]       = useLocalStorage("lb_year",     new Date().getFullYear());
  const [activeTab,     setActiveTab]     = useState("overview");
  const [modal,         setModal]         = useState(null);
  const [filters,       setFilters]       = useState({status:"All",pie:"All",quarter:"All"});

  // Init Firebase on mount
  useEffect(()=>{ initFirebase().then(()=>{ setFirebaseReady(true); onAuthStateChanged(auth, u=>{ if(u){ setUser(u); setLoggedIn(true); } else { setUser(null); } }); }); },[]);

  // Google login
  const handleGoogleLogin = async () => {
    if (!firebaseReady) return;
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user); setLoggedIn(true);
    } catch(e) {
      console.error(e);
      alert("Sign-in failed: "+e.message);
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    if (firebaseReady) await signOut(auth);
    setUser(null); setLoggedIn(false);
  };

  // Task CRUD
  const nextId    = ()=>Math.max(0,...tasks.map(t=>t.id||0))+1;
  const openAdd   = ()=>setModal({task:{...EMPTY_TASK,id:nextId()},isEdit:false});
  const openEdit  = t =>setModal({task:{...t},isEdit:true});
  const closeModal= ()=>setModal(null);
  const saveTask  = form=>{ modal.isEdit?setTasks(ts=>ts.map(t=>t.id===form.id?form:t)):setTasks(ts=>[...ts,form]); closeModal(); };
  const delTask   = id =>{ setTasks(ts=>ts.filter(t=>t.id!==id)); closeModal(); };
  const quickSave = form=>setTasks(ts=>[...ts,{...form,id:nextId()}]);

  const filtered=useMemo(()=>tasks.filter(t=>{ const qs=Q_SHORT[t.quarter]||t.quarter; if(filters.status!=="All"&&t.status!==filters.status)return false; if(filters.pie!=="All"&&t.pie!==filters.pie)return false; if(filters.quarter!=="All"&&qs!==filters.quarter)return false; return true; }),[tasks,filters]);

  const done=tasks.filter(t=>t.status==="Complete"), inProg=tasks.filter(t=>t.status==="In Progress");
  const withImpact=tasks.filter(t=>t.impact?.trim()), doneNoImpact=done.filter(t=>!t.impact?.trim());
  const total=tasks.length;
  const pieCount={P:tasks.filter(t=>t.pie==="P").length,I:tasks.filter(t=>t.pie==="I").length,E:tasks.filter(t=>t.pie==="E").length};
  const qData=QUARTERS.map(q=>({q:Q_SHORT[q]||q,total:tasks.filter(t=>t.quarter===q).length,done:tasks.filter(t=>t.quarter===q&&t.status==="Complete").length}));

  if (!loggedIn) return (
    <div><style>{FONTS+CSS}</style>
      <LoginScreen onGoogleLogin={handleGoogleLogin} onDemo={()=>setLoggedIn(true)} loading={authLoading} />
    </div>
  );

  const fsel={ fontSize:12,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"7px 10px",background:C.navyMid,cursor:"pointer",outline:"none",color:C.text };

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif",background:C.navy,minHeight:"100vh",paddingBottom:80 }}>
      <style>{FONTS+CSS}</style>
      <OfflineBanner />

      {/* NAV */}
      <div style={{ background:C.navyMid,borderBottom:`1px solid ${C.navyBorder}`,position:"sticky",top:0,zIndex:100 }}>
        <div style={{ padding:"12px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:34,height:34,borderRadius:8,background:`linear-gradient(135deg,${C.red},#8B0000)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>⚓</div>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text,letterSpacing:-.5,lineHeight:1 }}>LetsBrag <span style={{ color:C.red,fontSize:14 }}>{appYear}</span></div>
              {(user?.displayName||profile.name)&&<div style={{ fontSize:10,color:C.textFaint,lineHeight:1 }}>{profile.paygrade} {profile.rate} {(profile.name||user?.displayName||"").split(" ").slice(-1)[0]}</div>}
            </div>
          </div>
          <button onClick={openAdd} style={{ background:C.red,color:"#fff",border:"none",padding:"8px 14px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",whiteSpace:"nowrap" }}>+ Log Win</button>
        </div>
        <div style={{ display:"flex",overflowX:"auto",padding:"8px 10px 0",gap:2,scrollbarWidth:"none" }}>
          {TABS.map(({id,icon,label})=>(
            <button key={id} onClick={()=>setActiveTab(id)} style={{ padding:"8px 12px",borderRadius:"7px 7px 0 0",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,background:activeTab===id?C.navy:"transparent",color:activeTab===id?C.text:"rgba(122,143,168,.7)",whiteSpace:"nowrap",flexShrink:0,transition:"all .15s",display:"flex",alignItems:"center",gap:5,borderBottom:activeTab===id?`2px solid ${C.red}`:"2px solid transparent" }}>
              <span>{icon}</span><span className="tab-text">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"20px 18px" }}>

        {activeTab==="overview"&&<>
          {doneNoImpact.length>0&&<div className="fade-up" style={{ background:"rgba(245,166,35,.1)",border:`1px solid rgba(245,166,35,.25)`,borderRadius:10,padding:"11px 14px",marginBottom:18,display:"flex",alignItems:"flex-start",gap:9 }}><span style={{ fontSize:16,flexShrink:0 }}>⚠️</span><div style={{ fontSize:12,color:C.gold }}><strong>EVAL bullets need numbers — </strong>{doneNoImpact.length} completed achievement{doneNoImpact.length>1?"s":""} missing impact: <em>{doneNoImpact.map(t=>t.name).join(", ")}</em></div></div>}
          <div className="stat-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18 }}>
            <StatCard label="Total Logged"  value={total}             sub="all quarters"  delay={0} />
            <StatCard label="Complete"      value={done.length}       sub={`${total?Math.round(done.length/total*100):0}%`} accent={C.green} delay={60} />
            <StatCard label="In Progress"   value={inProg.length}     accent={C.blue}     delay={120} />
            <StatCard label="EVAL-Ready"    value={withImpact.length} sub="have #s" accent="#A78BFA" delay={180} />
          </div>
          <div className="two-col" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18 }}>
            <div className="fade-up" style={{ background:C.navyCard,borderRadius:14,padding:20,border:`1px solid ${C.navyBorder}`,animationDelay:"80ms" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text,marginBottom:2 }}>PIE Framework</div>
              <div style={{ fontSize:11,color:C.textFaint,marginBottom:16 }}>Performance · Self-Improvement · Exposure</div>
              {Object.entries(PIE).map(([k,v])=>(
                <div key={k} style={{ marginBottom:13 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7 }}><span style={{ background:v.bg,color:v.color,border:`1px solid ${v.border}`,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif" }}>{k}</span><span style={{ fontSize:12,color:C.textDim }}>{v.label}</span></div>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:v.color }}>{pieCount[k]}</span>
                  </div>
                  <Bar value={pieCount[k]} max={total||1} color={v.color} />
                </div>
              ))}
              <div style={{ background:"rgba(62,137,255,.08)",borderRadius:9,padding:"11px 13px",marginTop:14,borderLeft:`3px solid ${C.blue}` }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,color:C.blue,marginBottom:3,letterSpacing:1 }}>⚓ GUIDANCE</div>
                <div style={{ fontSize:11,color:C.textDim,lineHeight:1.65 }}>Aim for <strong style={{ color:C.text }}>~60% P</strong>, <strong style={{ color:C.text }}>~25% I</strong>, <strong style={{ color:C.text }}>~15% E</strong>. Chiefs look at all three.</div>
              </div>
            </div>
            <div className="fade-up" style={{ background:C.navyCard,borderRadius:14,padding:20,border:`1px solid ${C.navyBorder}`,animationDelay:"140ms" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text,marginBottom:2 }}>Quarterly Progress</div>
              <div style={{ fontSize:11,color:C.textFaint,marginBottom:16 }}>Completed vs. logged per quarter</div>
              {qData.map(({q,total:qt,done:qd})=>(
                <div key={q} style={{ marginBottom:13 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}><span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:C.text }}>{q}</span><span style={{ fontSize:11,color:C.textDim }}>{qd}/{qt}{qt>0&&<span style={{ color:C.blue,fontWeight:600 }}> ({Math.round(qd/qt*100)}%)</span>}</span></div>
                  <Bar value={qd} max={qt||1} color={C.blue} />
                </div>
              ))}
              <div style={{ background:"rgba(206,51,52,.08)",borderRadius:9,padding:"11px 13px",marginTop:14,borderLeft:`3px solid ${C.red}` }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,color:C.red,marginBottom:3,letterSpacing:1 }}>💡 PRO TIP</div>
                <div style={{ fontSize:11,color:C.textDim,lineHeight:1.65 }}>Log wins <strong style={{ color:C.text }}>right after they happen</strong> — use 🎙️ to dictate in 10 seconds.</div>
              </div>
            </div>
          </div>
          <div className="three-col fade-up" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,animationDelay:"200ms" }}>
            {[["⭐",tasks.filter(t=>t.status==="Complete"&&t.priority==="High").length,"High-priority wins",C.red],[" 🎖️",ilovemeFiles.length,"I Love Me files","#A78BFA"],["📂",docFiles.length,"Career docs",C.blue]].map(([icon,val,lbl,accent])=>(
              <div key={lbl} style={{ background:C.navyCard,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.navyBorder}`,display:"flex",gap:12,alignItems:"center" }}>
                <span style={{ fontSize:22 }}>{icon}</span>
                <div><div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:C.text }}>{val}</div><div style={{ fontSize:11,color:C.textDim }}>{lbl}</div></div>
              </div>
            ))}
          </div>
        </>}

        {activeTab==="tasks"&&<>
          <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
            <select style={fsel} value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>{["All","Not Started","In Progress","On Hold","Complete"].map(o=><option key={o}>{o}</option>)}</select>
            <select style={fsel} value={filters.pie}    onChange={e=>setFilters(f=>({...f,pie:e.target.value}))}>{["All","P","I","E"].map(o=><option key={o}>{o}</option>)}</select>
            <select style={fsel} value={filters.quarter} onChange={e=>setFilters(f=>({...f,quarter:e.target.value}))}>{["All","Q1","Q2","Q3","Q4"].map(o=><option key={o}>{o}</option>)}</select>
            <span style={{ fontSize:12,color:C.textFaint }}>{filtered.length} entr{filtered.length!==1?"ies":"y"}</span>
            <div style={{ flex:1 }} />
            <button onClick={openAdd} style={{ background:C.red,color:"#fff",border:"none",padding:"8px 14px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer" }}>+ Log Achievement</button>
          </div>
          <AchTable tasks={filtered} onRowClick={openEdit} />
        </>}

        {activeTab==="byquarter"&&<>
          {QUARTERS.map(q=>{ const qt=tasks.filter(t=>t.quarter===q); if(!qt.length)return null; const qd=qt.filter(t=>t.status==="Complete").length; return(
            <div key={q} style={{ marginBottom:28 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>{Q_SHORT[q]||q}</div>
                <div style={{ fontSize:11,color:C.textFaint }}>({q.replace(/Q\d /,"")})</div>
                <div style={{ height:1,flex:1,background:C.navyBorder }} />
                <span style={{ fontSize:11,color:C.textDim }}>{qd}/{qt.length} complete</span>
              </div>
              <AchTable tasks={qt} onRowClick={openEdit} />
            </div>
          );})}
        </>}

        {activeTab==="brag"&&(()=>{
          // ── copy-to-clipboard helper ──
          const buildExportText = () => {
            const sailor = [profile.paygrade, profile.rate, profile.name].filter(Boolean).join(" ");
            const ship   = [profile.ship, profile.command].filter(Boolean).join(" | ");
            const date   = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
            let out = "";
            out += "════════════════════════════════════════════════════════
";
            out += "                        BRAG SHEET
";
            out += "════════════════════════════════════════════════════════
";
            if (sailor) out += `Sailor : ${sailor}
`;
            if (ship)   out += `Command: ${ship}
`;
            out += `Date   : ${date}
`;
            out += "════════════════════════════════════════════════════════

";

            const sections = [
              { key:"P", title:"PERFORMANCE", subtitle:"Job Duties · Qualifications · Watch Standing · Mission Impact" },
              { key:"I", title:"SELF-IMPROVEMENT", subtitle:"Education · Advancement · Certifications · Physical Readiness" },
              { key:"E", title:"EXPOSURE", subtitle:"Awards · Boards · Volunteering · Cross-Functional Visibility" },
            ];

            sections.forEach(({ key, title, subtitle }) => {
              const items = done.filter(t => t.pie === key);
              if (!items.length) return;
              out += `
────────────────────────────────────────────────────────
`;
              out += `  ${title}
`;
              out += `  ${subtitle}
`;
              out += `────────────────────────────────────────────────────────

`;
              items.forEach((t, i) => {
                out += `${i+1}. ${t.name.toUpperCase()}
`;
                if (t.commandObjective) out += `   Objective : ${t.commandObjective}
`;
                if (t.quarter)          out += `   Quarter   : ${Q_SHORT[t.quarter]||t.quarter}  |  EVAL Period: ${t.evalPeriod}
`;
                if (t.visibility)       out += `   Visibility: ${t.visibility}
`;
                if (t.description)      out += `
   What I Did:
   ${t.description}
`;
                if (t.impact)           out += `
   ★ Impact:
   ${t.impact}
`;
                else                    out += `
   ★ Impact: [ADD NUMBERS HERE — your chief needs this]
`;
                if (t.feedback)         out += `
   Feedback:
   ${t.feedback}
`;
                if (t.skills?.length)   out += `
   Competencies: ${t.skills.join(" · ")}
`;
                if (t.requestor)        out += `   Validated by: ${t.requestor}
`;
                out += "
";
              });
            });

            out += "
════════════════════════════════════════════════════════
";
            out += "Generated by LetsBrag | letsbrag.netlify.app
";
            out += "════════════════════════════════════════════════════════
";
            return out;
          };

          const [copied, setCopied] = useState(false);
          const copyAll = () => {
            const text = buildExportText();
            navigator.clipboard.writeText(text).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2500); }).catch(()=>{ const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setCopied(true); setTimeout(()=>setCopied(false),2500); });
          };

          return <>
          <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:18,border:`1px solid ${C.navyBorder}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text }}>Brag Doc — EVAL Ready ⭐</div>
                <div style={{ fontSize:12,color:C.textDim,marginTop:2 }}>Organized by PIE category. Copy and paste into an email or Word doc to send to your Chief.</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:C.red }}>{done.length} <span style={{ fontSize:12,fontWeight:600,color:C.textFaint }}>completed</span></div>
                <button onClick={copyAll} style={{ background:copied?"rgba(46,204,113,.2)":C.red,color:copied?"#4ADE80":"#fff",border:copied?`1px solid rgba(46,204,113,.4)`:"none",padding:"10px 18px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",gap:7,transition:"all .3s",whiteSpace:"nowrap" }}>
                  {copied ? "✓ Copied!" : "📋 Copy Full Brag Doc"}
                </button>
              </div>
            </div>
            {done.length > 0 && (
              <div style={{ marginTop:12,padding:"9px 12px",background:"rgba(62,137,255,.08)",borderRadius:8,border:`1px solid rgba(62,137,255,.2)`,fontSize:11,color:"#60A5FA",lineHeight:1.6 }}>
                💡 <strong>How to use:</strong> Tap <strong>"Copy Full Brag Doc"</strong> → open an email or Word doc → paste. Your achievements will be neatly organized into Performance, Self-Improvement, and Exposure sections with all your impact statements and quotes included.
              </div>
            )}
          </div>

          {/* PIE sections */}
          {[
            { key:"P", title:"Performance", subtitle:"Job Duties · Qualifications · Watch Standing · Mission Impact", color:"#A78BFA", bg:"rgba(124,99,255,.1)", border:"rgba(124,99,255,.3)" },
            { key:"I", title:"Self-Improvement", subtitle:"Education · Advancement · Certifications · Physical Readiness", color:"#60A5FA", bg:"rgba(62,137,255,.1)", border:"rgba(62,137,255,.3)" },
            { key:"E", title:"Exposure", subtitle:"Awards · Boards · Volunteering · Cross-Functional Visibility", color:"#4ADE80", bg:"rgba(46,204,113,.1)", border:"rgba(46,204,113,.3)" },
          ].map(({ key, title, subtitle, color, bg, border }) => {
            const sectionTasks = done.filter(t => t.pie === key);
            if (!sectionTasks.length) return null;
            return (
              <div key={key} style={{ marginBottom:28 }} className="fade-up">
                {/* Section header */}
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
                  <div style={{ background:bg,border:`1px solid ${border}`,borderRadius:10,padding:"8px 16px",display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color,letterSpacing:.5 }}>{key}</span>
                    <div><div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color,lineHeight:1 }}>{title}</div><div style={{ fontSize:10,color:C.textDim,marginTop:2 }}>{subtitle}</div></div>
                  </div>
                  <div style={{ height:1,flex:1,background:border }} />
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color }}>{sectionTasks.length} achievement{sectionTasks.length!==1?"s":""}</span>
                </div>

                <div className="brag-grid" style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:13 }}>
                  {sectionTasks.map((task,i)=>{ const mi=!task.impact?.trim(); return(
                    <div key={task.id} onClick={()=>openEdit(task)} className="card-hover fade-up" style={{ background:`linear-gradient(145deg,${C.navyCard},#0D1829)`,borderRadius:14,padding:18,cursor:"pointer",position:"relative",boxShadow:"0 4px 20px rgba(0,0,0,.25)",border:`1px solid ${mi?"rgba(245,166,35,.4)":C.navyBorder}`,animationDelay:`${i*40}ms` }}>
                      {mi&&<div style={{ position:"absolute",top:12,right:12,background:C.gold,color:"#000",borderRadius:99,padding:"2px 9px",fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700 }}>⚠ ADD NUMBERS</div>}
                      <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" }}>
                        <span style={{ background:"rgba(255,255,255,.05)",color:C.textDim,borderRadius:99,padding:"2px 8px",fontSize:10 }}>{Q_SHORT[task.quarter]||task.quarter}</span>
                        <span style={{ background:"rgba(255,255,255,.05)",color:C.textDim,borderRadius:99,padding:"2px 8px",fontSize:10 }}>{task.evalPeriod}</span>
                        {task.priority==="High"&&<span style={{ background:"rgba(206,51,52,.2)",color:C.redLight,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:600 }}>HIGH PRI</span>}
                      </div>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text,marginBottom:4,lineHeight:1.3 }}>{task.name}</div>
                      {task.commandObjective&&<div style={{ fontSize:10,color:C.textFaint,marginBottom:12,textTransform:"uppercase",letterSpacing:.5 }}>↳ {task.commandObjective}</div>}
                      {task.impact?<div style={{ background:"rgba(206,51,52,.1)",borderRadius:9,padding:"10px 12px",marginBottom:11,borderLeft:`3px solid ${C.red}` }}><div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:9,color:C.redLight,marginBottom:3,letterSpacing:1 }}>MEASURABLE IMPACT</div><div style={{ fontSize:12,color:"rgba(232,237,245,.88)",lineHeight:1.6 }}>{task.impact}</div></div>
                        :<div style={{ background:"rgba(245,166,35,.08)",borderRadius:9,padding:"9px 12px",marginBottom:11,borderLeft:`3px solid ${C.gold}` }}><div style={{ fontSize:12,color:C.gold,fontStyle:"italic" }}>No numbers yet — tap to add.</div></div>}
                      {task.feedback&&<div style={{ background:"rgba(255,255,255,.04)",borderRadius:9,padding:"9px 12px",marginBottom:10 }}><div style={{ fontSize:11,color:"rgba(232,237,245,.65)",lineHeight:1.55,fontStyle:"italic" }}>{task.feedback}</div></div>}
                      {task.skills?.length>0&&<div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:8 }}>{task.skills.map(s=><span key={s} style={{ background:"rgba(62,137,255,.15)",color:"#60A5FA",borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:600 }}>{s}</span>)}</div>}
                            <div style={{ display:"flex",justifyContent:"space-between",marginTop:8 }}>
                        {task.requestor?<div style={{ fontSize:10,color:C.textFaint }}>✓ {task.requestor}</div>:<div/>}
                        <div style={{ fontSize:10,color:C.textFaint }}>{task.visibility}</div>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            );
          })}
          {done.length===0&&<div style={{ textAlign:"center",padding:50,color:C.textDim,fontSize:13,background:C.navyCard,borderRadius:12,border:`1px solid ${C.navyBorder}` }}><div style={{ fontSize:32,marginBottom:10 }}>⚓</div>No completed achievements yet.<br/><span style={{ fontSize:12,color:C.textFaint }}>Mark achievements Complete to build your Brag Doc.</span></div>}
          </>;
        })()}

        {activeTab==="iloveme"&&<>
          <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:18,borderLeft:`3px solid ${C.red}`,border:`1px solid ${C.navyBorder}` }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text,marginBottom:2 }}>🎖️ I Love Me Book</div>
            <div style={{ fontSize:12,color:C.textDim,lineHeight:1.6 }}>Upload awards, commendation letters, ceremony photos, qual cards, and NEC certs. Everything in one place — for boards, packages, and your own pride.</div>
          </div>
          <FileGallery files={ilovemeFiles} setFiles={setIlovemeFiles} categories={ILOVE_CATS} emptyIcon="🎖️" emptyMsg="Upload your awards, certs, photos, and commendation letters here." />
        </>}

        {activeTab==="docs"&&<>
          <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:18,borderLeft:`3px solid ${C.blue}`,border:`1px solid ${C.navyBorder}` }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text,marginBottom:2 }}>📂 Career Documents</div>
            <div style={{ fontSize:12,color:C.textDim,lineHeight:1.6 }}>Store your career roadmap, rate training manual, NAVADMINs, orders, transfer docs, personal statement, and anything you need on the go.</div>
          </div>
          <FileGallery files={docFiles} setFiles={setDocFiles} categories={DOC_CATS} emptyIcon="📂" emptyMsg="Upload your career roadmap, rate manual, orders, and important career documents." />
        </>}

        {activeTab==="profile"&&<ProfileScreen profile={profile} setProfile={setProfile} user={user} onLogout={handleLogout} appYear={appYear} setAppYear={setAppYear} />}

      </div>

      {activeTab!=="profile"&&<QuickLog onSave={quickSave} />}
      {modal&&<AchModal task={modal.task} isEdit={modal.isEdit} onSave={saveTask} onDelete={delTask} onClose={closeModal} />}
    </div>
  );
}