// ============================================================
//  LetsBrag™ — Military Career Achievement Tracker
//  Supabase Auth + Database + Stripe Payments
// ============================================================

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  © 2026 LetsBrag — All Rights Reserved
//  Unauthorized copying, distribution, or sale of this
//  application or its source code is strictly prohibited.
//  Protected under U.S. Copyright Law (17 U.S.C. § 101).
//  letsbrag.netlify.app
// ============================================================

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://sfaobiaypwobqilnfdxj.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmYW9iaWF5cHdvYnFpbG5mZHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTg2NDYsImV4cCI6MjA5MTgzNDY0Nn0.tPgYMakCJFpm1SeMjBT8nGqUX97xKqd3Tr91UePWnZk";
const supabase      = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── AI CONFIGURATION ────────────────────────────────────────────────────────
// Each user provides their own free Anthropic API key.
// Keys are stored only in their own browser — never shared or sent anywhere else.
// Get a free key at: console.anthropic.com (free tier = $5 credit, plenty for personal use)
const getApiKey = () => { try { return localStorage.getItem("lb_apikey") || ""; } catch { return ""; } };
const AI_ENABLED = () => getApiKey().startsWith("sk-ant");
const AI_HEADERS = () => ({
  "Content-Type": "application/json",
  "x-api-key": getApiKey(),
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});



// ─── LIGHT MODE TOKENS ───────────────────────────────────────────────────────
const CL = {
  navy:"#F0F4FF", navyMid:"#E2E8F4", navyCard:"#FFFFFF", navyBorder:"#CBD5E8",
  red:"#DC2626", redLight:"#EF4444", gold:"#D97706", blue:"#2563EB", green:"#16A34A",
  text:"#0F172A", textDim:"#475569", textFaint:"#94A3B8",
};

// ─── TIER CONFIGURATION ──────────────────────────────────────────────────────
const STRIPE_MONTHLY = "price_1TLQU4KLDAImwgiP8gA8S8pm";
const STRIPE_ANNUAL  = "price_1TLQV7KLDAImwgiPyyNR0wJ3";
const STRIPE_PAYMENT_LINK_MONTHLY = "https://buy.stripe.com/monthly"; // update after creating payment link
const STRIPE_PAYMENT_LINK_ANNUAL  = "https://buy.stripe.com/annual";  // update after creating payment link

const TIERS = {
  free: {
    id:"free", name:"Free Trial", badge:"FREE", color:"#7A8FA8",
    monthlyPrice:0, annualPrice:0,
    tabs:["overview","goals","tasks","byquarter","brag","iloveme","docs","profile","pricing","help"],
    description:"Try LetsBrag free",
    features:["Overview dashboard","Up to 5 achievements","Goals tracker","Basic brag doc"],
  },
  pro: {
    id:"pro", name:"LetsBrag Pro", badge:"PRO", color:"#3E89FF",
    monthlyPrice:4.99, annualPrice:39.99,
    stripePriceMonthly: STRIPE_MONTHLY,
    stripePriceAnnual:  STRIPE_ANNUAL,
    tabs:["overview","goals","tasks","byquarter","brag","awards","dates","coach","timeline","transition","package","iloveme","docs","profile","pricing","help"],
    description:"Full access to everything",
    features:[
      "Unlimited achievements",
      "Goals tracker",
      "Full brag doc with PIE framework",
      "AI Career Coach",
      "Career Timeline",
      "Transition Assistant",
      "Package Builder",
      "I Love Me Book",
      "Career Docs",
      "All 6 military branches",
      "Voice dictation",
      "AI bullet generator",
    ],
  },
}

// During beta/test phase — set this to "promax" to give everyone full access
const BETA_TIER = "promax";
const BETA_MODE = false; // Stripe is live — subscription required after trial

const getUserTier = () => {
  if (BETA_MODE) return BETA_TIER;
  try { return localStorage.getItem("lb_tier") || "free"; } catch { return "free"; }
};

const hasAccess = (tabId) => {
  const tier = TIERS[getUserTier()] || TIERS.free;
  return tier.tabs.includes(tabId);
};

const hasAI = () => {
  if (BETA_MODE) return true;
  const tier = TIERS[getUserTier()] || TIERS.free;
  return tier.aiFeatures;
};


// ─── STRIPE CONFIGURATION ────────────────────────────────────────────────────
const STRIPE_KEY    = import.meta.env.VITE_STRIPE_KEY;
const STRIPE_PRICES = {
  monthly: import.meta.env.VITE_STRIPE_MONTHLY,
  annual:  import.meta.env.VITE_STRIPE_ANNUAL,
};
const APP_URL = "https://letsbrag.netlify.app";

// Dynamically load Stripe.js and open checkout
async function goToCheckout(priceId) {
  // Load stripe.js if not already loaded
  if (!window.Stripe) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const stripe = window.Stripe(STRIPE_KEY);
  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    successUrl: APP_URL + "?subscribed=true",
    cancelUrl:  APP_URL + "?checkout=cancelled",
    billingAddressCollection: "auto",
    allowPromotionCodes: true,
    subscriptionData: {
      trial_period_days: 7,
      trial_settings: {
        end_behavior: {
          missing_payment_method: "cancel"
        }
      }
    },
  });
  if (error) alert("Checkout error: " + error.message);
}

// ─── FIREBASE AUTHENTICATION ─────────────────────────────────────────────────
// Firebase loaded via script tags in index.html for maximum compatibility
const FB_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        "letsbrag.firebaseapp.com",
  projectId:         "letsbrag",
  storageBucket:     "letsbrag.firebasestorage.app",
  messagingSenderId: "196979143235",
  appId:             "1:196979143235:web:91521873aa86e4958b5af6"
};

let _auth = null;
let _db   = null;
let _provider = null;
let _fbLoaded = false;
let _fbLoadingPromise = null;

function loadFirebaseScripts() {
  return new Promise((resolve) => {
    if (window.firebase && window.firebase.auth) { resolve(); return; }
    const scripts = [
      "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
      "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
    ];
    let loaded = 0;
    scripts.forEach(src => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => { loaded++; if (loaded === scripts.length) resolve(); };
      s.onerror = () => { loaded++; if (loaded === scripts.length) resolve(); };
      document.head.appendChild(s);
    });
  });
}

async function loadFirebase() {
  if (_fbLoaded) return { auth: _auth, db: _db };
  if (_fbLoadingPromise) return _fbLoadingPromise;
  _fbLoadingPromise = (async () => {
  try {
    await loadFirebaseScripts();
    if (!window.firebase) throw new Error("Firebase scripts failed to load");
    if (!window.firebase.apps?.length) {
      window.firebase.initializeApp(FB_CONFIG);
    }
    _auth     = window.firebase.auth();
    _db       = window.firebase.firestore();
    _provider = new window.firebase.auth.GoogleAuthProvider();
    _provider.setCustomParameters({ prompt: "select_account" });
    _provider.addScope("email");
    _provider.addScope("profile");
    _fbLoaded = true;
    console.log("Firebase loaded OK ✅");
    return { auth: _auth, db: _db };
  } catch(e) {
    console.error("Firebase load error:", e);
    _fbLoadingPromise = null;
    return null;
  }
  })();
  return _fbLoadingPromise;
}

// ── FIRESTORE HELPERS ────────────────────────────────────────────────────────
// Save user data to Firestore — called after any change
async function saveUserData(uid, data) {
  if (!uid) return;
  try {
    const fb = await loadFirebase();
    if (!fb?.db || !fb?.auth?.currentUser) return; // Only save if authenticated
    await fb.db.collection("users").doc(uid).set({
      ...data,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      uid,
    }, { merge: true });
  } catch(e) {
    console.warn("Firestore save error:", e.message);
  }
}

// Load user data from Firestore — called on login
async function loadUserData(uid) {
  try {
    const fb = await loadFirebase();
    if (!fb?.db) return null;
    const snap = await fb.db.collection("users").doc(uid).get();
    return snap.exists ? snap.data() : null;
  } catch(e) {
    console.warn("Firestore load error:", e.message);
    return null;
  }
}

async function signInWithGoogle() {
  const fb = await loadFirebase();
  if (!fb) throw new Error("Firebase failed to load.");
  try {
    return await fb.auth.signInWithPopup(_provider);
  } catch(e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
      await fb.auth.signInWithRedirect(_provider);
      return null;
    }
    throw e;
  }
}

async function checkRedirectResult() {
  try {
    const fb = await loadFirebase();
    if (!fb) return null;
    return await fb.auth.getRedirectResult();
  } catch(e) {
    console.warn("Redirect result error:", e);
    return null;
  }
}

async function signOutUser() {
  const fb = await loadFirebase();
  if (!fb) return;
  return fb.auth.signOut();
}

async function onAuthReady(callback) {
  const fb = await loadFirebase();
  if (!fb) { callback(null); return ()=>{}; }
  return fb.auth.onAuthStateChanged(callback);
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
  navy:"#0A1628", navyMid:"#111E35", navyCard:"#152240", navyBorder:"#1E3050",
  red:"#DC2626", redLight:"#EF4444", gold:"#F59E0B", blue:"#3E89FF", green:"#2ECC71",
  text:"#E8EDF5", textDim:"#8FA3BC", textFaint:"#3A4E68",
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

const EMPTY_TASK    = { name:"", status:"Not Started", priority:"Medium", pie:"P", quarter:"Q1 (Jan–Mar)", evalPeriod:"Periodic", requestor:"", commandObjective:"Mission Readiness", description:"", impact:"", visibility:"Division Officer only", evidence:"", feedback:"", skills:[], receipts:[], createdAt:"" };
const EMPTY_PROFILE = { name:"", paygrade:"E-5", rate:"", ship:"", command:"", prd:"", bio:"" };
const EMPTY_GOAL    = { id:0, goal:"", description:"", startDate:"", completionDate:"", priority:"Medium", status:"In Progress" };


// ─── BRANCH CONFIGURATION ────────────────────────────────────────────────────
const BRANCHES = {

  // ── NAVY ──────────────────────────────────────────────────────────────────
  Navy: {
    name:"Navy", emoji:"⚓", color:"#003087", accent:"#CE3334",
    memberTitle:"Sailor", membersTitle:"Sailors",
    evalDoc:"EVAL / FITREP",
    evalSystem:`U.S. Navy uses the Enlisted Evaluation Report (EVAL) for E1–E6 and the Fitness Report (FITREP) for E7+ and Officers. EVALs assess performance in areas including Professional Knowledge, Quality of Work, Military Bearing, Teamwork, and Leadership. Graded on a 1–5 scale. The top block (5.0) is critical for advancement. FITREPs assess mission accomplishment, professional attributes, and promotion potential. Competitive rankings among peers are used for selection boards.`,
    evalTypes:["Periodic","Detachment of Individual","Special","Promotion/Frocking","Separation/Retirement","CHIEFEVAL"],
    evalGrades:["5.0 — Early Promote / #1 of peers","4.0 — Must Promote","3.8 — Promotable","3.6 — Progressing","Below 3.6 — Significant Problems"],
    rankLabel:"Rate / Rating", unitLabel:"Ship / Command", locationLabel:"Homeport",
    paygradeGroups:{
      juniorEnlisted:["E-1 Seaman Recruit","E-2 Seaman Apprentice","E-3 Seaman"],
      seniorEnlisted:["E-4 Petty Officer 3rd Class","E-5 Petty Officer 2nd Class","E-6 Petty Officer 1st Class"],
      chiefEnlisted: ["E-7 Chief Petty Officer","E-8 Senior Chief Petty Officer","E-9 Master Chief Petty Officer"],
      warrantOfficer:["W-1 Warrant Officer","W-2 CWO2","W-3 CWO3","W-4 CWO4","W-5 CWO5"],
      officer:       ["O-1 Ensign","O-2 LTJG","O-3 Lieutenant","O-4 LCDR","O-5 Commander","O-6 Captain","O-7 RDML","O-8 RADM","O-9 VADM","O-10 Admiral"],
    },
    paygrades:["E-1 Seaman Recruit","E-2 Seaman Apprentice","E-3 Seaman","E-4 Petty Officer 3rd Class","E-5 Petty Officer 2nd Class","E-6 Petty Officer 1st Class","E-7 Chief Petty Officer","E-8 Senior Chief","E-9 Master Chief","W-1","W-2","W-3","W-4","W-5","O-1 Ensign","O-2 LTJG","O-3 Lieutenant","O-4 LCDR","O-5 Commander","O-6 Captain","O-7 RDML","O-8 RADM","O-9 VADM","O-10 Admiral"],
    visibility:["Division Officer only","Department Head","XO","CO","Group/Squadron","Fleet/TYCOM","Community-wide"],
    objectives:["Mission Readiness","Force Multiplication","Sailor Development","Community Outreach","Administrative Excellence","Safety","Retention"],
    skills:["Leadership","Tactical Proficiency","Damage Control","Watch Standing","Training & Mentorship","Administrative","Seamanship","Navigation","Communications","Maintenance & Logistics","Physical Readiness","Community Service","Education"],
    iloveCats:["EVAL/FITREP Copy","Award Certificate","Commendation Letter","Photo — Ceremony","Photo — Underway","Qualification Card","NEC Certificate","Training Certificate","Other"],
    docCats:["Career Roadmap","Rate Training Manual","NAVADMIN / Directive","PRD / Orders","Transfer Docs","Personal Statement / Bio","Advancement Study Guide","Resume / Package","Other"],
    pieGuidance:"Aim for ~60% Performance, ~25% Self-Improvement, ~15% Exposure. Your reporting senior looks at all three areas. Top-block EVALs require demonstrated performance AND visible growth.",
    bragIntro:"Submit to your LPO or Chief 4–6 weeks before your EVAL close-out date.",
    advancementTips:[
      "Pass the Navy-wide advancement exam (E4–E6)",
      "Earn Performance Mark Average (PMA) from EVALs",
      "Complete required Professional Military Education (PME)",
      "Earn warfare qualification (Surface, Air, Sub, etc.)",
      "Complete all required NEC courses",
    ],
    sampleTasks:[
      {id:1,name:"DC Training Program Overhaul",status:"Complete",priority:"High",pie:"P",quarter:"Q1 (Jan–Mar)",evalPeriod:"Periodic",requestor:"LT Ramirez, DCA",commandObjective:"Mission Readiness",description:"Redesigned DC qual card system and created 12 new hands-on drills.",impact:"DC qual rate increased from 54% to 91% across 47 Sailors in 8 weeks. Zero INSURV discrepancies.",visibility:"CO",evidence:"",feedback:'"Single-handedly transformed our DC program." — LT Ramirez',skills:["Leadership","Damage Control"],receipts:[],createdAt:"2026-01-20"},
      {id:2,name:"E-6 Advancement Exam — Scored 74.5 (Top 8%)",status:"Complete",priority:"High",pie:"I",quarter:"Q1 (Jan–Mar)",evalPeriod:"Promotion",requestor:"Self / ESO",commandObjective:"Sailor Development",description:"Self-studied 6+ hours/week. Mentored 2 junior Sailors simultaneously.",impact:"Top 8% Navy-wide. Both mentored Sailors also advanced.",visibility:"Department Head",evidence:"",feedback:'"Sets the gold standard." — Chief Alvarez',skills:["Education","Training & Mentorship"],receipts:[],createdAt:"2026-02-10"},
    ]
  },

  // ── ARMY ──────────────────────────────────────────────────────────────────
  Army: {
    name:"Army", emoji:"⭐", color:"#4B5320", accent:"#FFD700",
    memberTitle:"Soldier", membersTitle:"Soldiers",
    evalDoc:"NCOER / OER",
    evalSystem:`The Army uses three distinct evaluation systems based on rank. E1–E4 do NOT receive formal evaluations — progress is tracked through DA Form 4856 Counseling Statements, the Army Career Tracker (ACT), and the Promotion Points System. Points are earned through military education, civilian education, weapons qualification, physical fitness, and awards. E5–E9 receive the Noncommissioned Officer Evaluation Report (NCOER) which assesses five attributes: Character (Army Values, empathy, warrior ethos), Presence (military bearing, fitness, confidence), Intellect (mental agility, innovation, judgment), Leads (leads others, extends influence, builds trust), Develops (develops others, stewardship, creates positive climate), and Achieves (gets results). Rated Exceeds Standard, Met Standard, or Did Not Meet Standard. Officers and Warrant Officers use the Officer Evaluation Report (OER) which focuses on Army leadership attributes, mission accomplishment, and potential for increased responsibility.`,
    evalTypes:["Annual","Change of Rater","Relief for Cause","Complete the Record","60-Day Rater","Temporary Duty"],
    evalGrades:["Exceeds Standard — Highly Qualified","Met Standard — Qualified","Did Not Meet Standard — Not Qualified"],
    rankLabel:"MOS", unitLabel:"Unit / Installation", locationLabel:"Installation",
    paygradeGroups:{
      juniorEnlisted:["E-1 Private","E-2 Private 2nd Class","E-3 Private 1st Class","E-4 Specialist / Corporal"],
      seniorEnlisted:["E-5 Sergeant","E-6 Staff Sergeant","E-7 Sergeant First Class","E-8 Master Sergeant / 1SG","E-9 Sergeant Major / CSM / SMA"],
      warrantOfficer:["W-1 WO1","W-2 CW2","W-3 CW3","W-4 CW4","W-5 CW5"],
      officer:       ["O-1 2LT","O-2 1LT","O-3 Captain","O-4 Major","O-5 LTC","O-6 Colonel","O-7 BG","O-8 MG","O-9 LTG","O-10 General"],
    },
    paygrades:["E-1 Private","E-2 Private 2nd Class","E-3 Private 1st Class","E-4 Specialist/Corporal","E-5 Sergeant","E-6 Staff Sergeant","E-7 Sergeant First Class","E-8 Master Sergeant/1SG","E-9 Sergeant Major/CSM/SMA","W-1 WO1","W-2 CW2","W-3 CW3","W-4 CW4","W-5 CW5","O-1 2LT","O-2 1LT","O-3 Captain","O-4 Major","O-5 LTC","O-6 Colonel","O-7 BG","O-8 MG","O-9 LTG","O-10 General"],
    visibility:["Platoon Leader only","Company Commander","Battalion Commander","Brigade Commander","Division/Corps","Army-wide","Community-wide"],
    objectives:["Mission Readiness","Force Multiplication","Soldier Development","Community Outreach","Administrative Excellence","Safety","Retention"],
    skills:["Leadership","Tactical Proficiency","Warrior Tasks","Character & Presence","Training & Mentorship","Administrative","Land Navigation","Communications","Maintenance & Logistics","Physical Readiness","Community Service","Education","Counseling"],
    iloveCats:["NCOER / OER Copy","DA Form 4856 Counseling","Award Certificate","Commendation Letter","Photo — Ceremony","Photo — Deployment","Qualification Badge","Training Certificate","Other"],
    docCats:["Career Roadmap","MOS Training Manual","ALARACT / Directive","PCS Orders","Transfer Docs","Personal Statement / Bio","Promotion Points Worksheet","Resume / Package","Other"],
    pieGuidance:"E1–E4: Focus on Promotion Points (weapons qual, PT, education, awards, military ed). E5+: NCOER looks at Character, Presence, Intellect, Leads, Develops, and Achieves. All six attributes matter for Exceeds Standard.",
    bragIntro:"Submit your input to your Rater and Senior Rater 4–6 weeks before your NCOER/OER close-out date. E1–E4: bring this to your counseling sessions.",
    advancementTips:[
      "E1–E4: Maximize promotion points (education, weapons qual, physical fitness, military education, awards)",
      "Complete required Professional Military Education (WLC, ALC, SLC, SGM-A)",
      "Maintain Army Physical Fitness Test (APFT/ACFT) above standard",
      "Complete DA Form 4856 counseling with your chain of command",
      "Earn additional certifications and civilian education credits",
    ],
    juniorEnlistedNote:"E1–E4 do not receive formal NCOERs. Track your progress through DA Form 4856 counseling statements, promotion points, and Army Career Tracker (ACT). Log your achievements here to prepare for counseling sessions and promotion boards.",
    sampleTasks:[
      {id:1,name:"Squad Tactical Readiness — Pre-Deployment Certification",status:"Complete",priority:"High",pie:"P",quarter:"Q1 (Jan–Mar)",evalPeriod:"Annual",requestor:"CPT Williams, Platoon Leader",commandObjective:"Mission Readiness",description:"Led squad readiness training for all 9 Soldiers. Coordinated weapons quals, land nav, and medical readiness checks.",impact:"Squad achieved 100% combat readiness. Zero medical or equipment holds at deployment muster.",visibility:"Battalion Commander",evidence:"",feedback:'"SGT Johnson set the standard for the company." — CPT Williams',skills:["Leadership","Tactical Proficiency"],receipts:[],createdAt:"2026-01-15"},
      {id:2,name:"Warrior Leader Course — Commandant's List",status:"Complete",priority:"High",pie:"I",quarter:"Q2 (Apr–Jun)",evalPeriod:"Change of Rater",requestor:"Self / S1",commandObjective:"Soldier Development",description:"Completed WLC and graduated on Commandant's List. Top performer in land navigation and leadership exercises.",impact:"Top 10% of 48-Soldier class. Selected for early promotion consideration.",visibility:"Company Commander",evidence:"",feedback:'"One of the strongest WLC graduates we have seen." — 1SG Torres',skills:["Leadership","Education"],receipts:[],createdAt:"2026-04-20"},
    ]
  },

  // ── MARINES ───────────────────────────────────────────────────────────────
  Marines: {
    name:"Marines", emoji:"🦅", color:"#8B0000", accent:"#FFD700",
    memberTitle:"Marine", membersTitle:"Marines",
    evalDoc:"PRO/CON · FITREP",
    evalSystem:`The Marine Corps uses three distinct evaluation systems. E1–E3 receive Proficiency and Conduct Marks (PRO/CON) — two numerical scores on a 0.0–5.0 scale. Proficiency (0–5.0) measures job performance, knowledge, and technical ability. Conduct (0–5.0) measures discipline, bearing, character, and adherence to the UCMJ. These marks directly impact promotion eligibility and are averaged over time. E4–E9 (Corporals through Sergeant Major) receive Performance Evaluations (PEREVAL) similar in structure to the Navy EVAL, but with a strong emphasis on leadership, mission accomplishment, character, and the warfighting mindset. The Marine Corps places unique emphasis on the warrior ethos, combined arms proficiency, and the ability to function in austere conditions. Officers receive the Fitness Report (FITREP) which focuses on command potential, leadership under pressure, decision-making in complex environments, and combat readiness. Comparative assessments among peers are central to officer promotion selection.`,
    evalTypes:["PRO/CON Marks (E1–E3)","Annual","Change of Reporting Senior","Promotion/Frocking","Separation","Special","Relief for Cause"],
    evalGrades:["PRO/CON: 5.0 / 5.0 — Outstanding","PRO/CON: 4.0+ / 4.0+ — Above Average","Outstanding — Promote immediately","Excellent — Promote","Above Average — Promote","Average","Below Average"],
    proConNote:"E1–E3 receive Proficiency (0–5.0) and Conduct (0–5.0) marks. Proficiency = job performance. Conduct = discipline and character. Both scores directly affect promotion eligibility.",
    rankLabel:"MOS (Military Occupational Specialty)", unitLabel:"Unit / Command", locationLabel:"Station",
    paygradeGroups:{
      juniorEnlisted:["E-1 Private","E-2 Private First Class","E-3 Lance Corporal"],
      seniorEnlisted:["E-4 Corporal","E-5 Sergeant","E-6 Staff Sergeant","E-7 Gunnery Sergeant","E-8 Master Sgt / 1st Sgt","E-9 Master Gunnery Sgt / SgtMaj"],
      warrantOfficer:["W-1 WO1","W-2 CWO2","W-3 CWO3","W-4 CWO4","W-5 CWO5"],
      officer:       ["O-1 2ndLt","O-2 1stLt","O-3 Captain","O-4 Major","O-5 LtCol","O-6 Colonel","O-7 BGen","O-8 MajGen","O-9 LtGen","O-10 General"],
    },
    paygrades:["E-1 Private","E-2 Private First Class","E-3 Lance Corporal","E-4 Corporal","E-5 Sergeant","E-6 Staff Sergeant","E-7 Gunnery Sergeant","E-8 Master Sgt/1st Sgt","E-9 Master Gunnery Sgt/SgtMaj","W-1 WO1","W-2 CWO2","W-3 CWO3","W-4 CWO4","W-5 CWO5","O-1 2ndLt","O-2 1stLt","O-3 Captain","O-4 Major","O-5 LtCol","O-6 Colonel","O-7 BGen","O-8 MajGen","O-9 LtGen","O-10 General"],
    visibility:["Squad Leader only","Platoon Commander","Company Commander","Battalion Commander","Regiment/MEU","Marine Corps-wide","Community-wide"],
    objectives:["Mission Readiness","Force Multiplication","Marine Development","Community Outreach","Administrative Excellence","Safety","Retention"],
    skills:["Leadership","Tactical Proficiency","Marksmanship","Warfighting Mindset","Training & Mentorship","Administrative","Amphibious Operations","Communications","Maintenance & Logistics","Physical Fitness","Community Service","Education","Character & Discipline"],
    iloveCats:["FITREP Copy","PRO/CON Marks Record","Award Certificate","Commendation Letter","Photo — Ceremony","Photo — Deployment","Qualification Badge","Training Certificate","Other"],
    docCats:["Career Roadmap","MOS Training Manual","MARADMIN / Directive","PCS Orders","Transfer Docs","Personal Statement / Bio","Advancement Study Guide","Resume / Package","Other"],
    pieGuidance:"E1–E3: PRO/CON marks directly affect promotion. Maximize both scores through technical excellence and impeccable conduct. E4+: Evaluations emphasize warfighting mindset, leadership, and mission accomplishment. Character matters as much as performance.",
    bragIntro:"Submit your input to your Reporting Senior 4–6 weeks before your FITREP close-out date. E1–E3: bring this documentation to support your PRO/CON marks.",
    juniorEnlistedNote:"E1–E3 receive Proficiency and Conduct Marks (PRO/CON) — two scores on a 5.0 scale. Proficiency measures your job skills. Conduct measures your discipline and character. Log achievements here to maximize both scores.",
    advancementTips:[
      "E1–E3: Maximize PRO/CON marks through technical proficiency and discipline",
      "Complete required Military Occupational Specialty (MOS) training",
      "Maintain physical fitness above minimum standards (PFT/CFT)",
      "Complete required Professional Military Education (Corporal's Course, Sergeant's Course)",
      "Earn combat and service awards — each matters for promotion selection",
    ],
    sampleTasks:[
      {id:1,name:"Pre-Deployment Readiness — 100% Certification",status:"Complete",priority:"High",pie:"P",quarter:"Q1 (Jan–Mar)",evalPeriod:"Annual",requestor:"1stLt Rivera, Platoon Commander",commandObjective:"Mission Readiness",description:"Led pre-deployment readiness for 13-Marine squad. Coordinated weapons quals, comms checks, and medical readiness.",impact:"100% combat readiness certification. Zero holds at deployment muster.",visibility:"Battalion Commander",evidence:"",feedback:'"Cpl Martinez performed above grade." — 1stLt Rivera',skills:["Leadership","Tactical Proficiency"],receipts:[],createdAt:"2026-01-10"},
    ]
  },

  // ── AIR FORCE ─────────────────────────────────────────────────────────────
  "Air Force": {
    name:"Air Force", emoji:"✈️", color:"#00308F", accent:"#7FB2E5",
    memberTitle:"Airman", membersTitle:"Airmen",
    evalDoc:"EPB / OPB",
    evalSystem:`The Air Force uses two primary performance brief systems. The Enlisted Performance Brief (EPB) replaced the traditional EPR in 2022. It applies to all enlisted Airmen and documents performance across three areas: Performance (job performance, mission impact, technical expertise), Leadership (influence, development of others, teamwork), and Impact (results, innovations, contributions beyond primary duties). EPBs are used for promotions, assignments, and career development boards. The Officer Performance Brief (OPB) applies to officers and focuses on Leadership (mission impact, vision, command climate), Mission Impact (results achieved, innovation, efficiency), and Potential (readiness for increased responsibility, strategic thinking, development). The Performance Reporting Form (PRF) is used for senior officers and focuses specifically on leadership qualities, mission impact at the strategic level, and promotion potential to senior grades. Both EPB and OPB use a narrative format with specific performance statements rather than numerical scores.`,
    evalTypes:["Annual","Closeout","Stratification","Firewall 5 Referral","Promotion","Officer PRF"],
    evalGrades:["Promote — Clearly Exceeds Standards","Must Promote","Promote","Do Not Promote Now","Do Not Promote"],
    rankLabel:"AFSC (Air Force Specialty Code)", unitLabel:"Squadron / Wing", locationLabel:"Base",
    paygradeGroups:{
      juniorEnlisted:["E-1 Airman Basic","E-2 Airman","E-3 Airman First Class","E-4 Senior Airman"],
      seniorEnlisted:["E-5 Staff Sergeant","E-6 Technical Sergeant","E-7 Master Sergeant","E-8 Senior Master Sergeant","E-9 Chief Master Sergeant"],
      officer:       ["O-1 2nd Lt","O-2 1st Lt","O-3 Captain","O-4 Major","O-5 Lt Colonel","O-6 Colonel","O-7 Brig General","O-8 Maj General","O-9 Lt General","O-10 General"],
    },
    paygrades:["E-1 Airman Basic","E-2 Airman","E-3 Airman First Class","E-4 Senior Airman","E-5 Staff Sergeant","E-6 Technical Sergeant","E-7 Master Sergeant","E-8 Senior Master Sergeant","E-9 Chief Master Sergeant","O-1 2nd Lt","O-2 1st Lt","O-3 Captain","O-4 Major","O-5 Lt Colonel","O-6 Colonel","O-7 Brig General","O-8 Maj General","O-9 Lt General","O-10 General"],
    visibility:["Flight Commander only","Squadron Commander","Group Commander","Wing Commander","MAJCOM","Air Force-wide","Community-wide"],
    objectives:["Mission Readiness","Force Multiplication","Airman Development","Community Outreach","Administrative Excellence","Safety","Innovation & Efficiency"],
    skills:["Leadership","Mission Planning","Sortie Execution","Innovation","Training & Mentorship","Administrative","Communications","Maintenance & Logistics","Physical Readiness","Community Service","Education","Technical Expertise"],
    iloveCats:["EPB / OPB Copy","Award Certificate","Commendation Letter","Photo — Ceremony","Photo — TDY/Deployment","Qualification Badge","AFSC Certificate","Training Certificate","Other"],
    docCats:["Career Roadmap","AFSC Training Manual","AFMAN / Directive","PCS Orders","Transfer Docs","Personal Statement / Bio","Decoration Package","Resume / Package","Other"],
    pieGuidance:"EPB/OPB focuses on Performance, Leadership, and Impact — aligning closely with PIE. Narrative bullets must be specific and quantifiable. Stratification (ranking among peers) is critical for promotion to E-7 and above.",
    bragIntro:"Submit your performance inputs to your supervisor 4–6 weeks before your EPB/OPB close-out date. Strong bullets use specific numbers and show mission impact.",
    advancementTips:[
      "Write strong EPB bullets: Action + Result + Impact format",
      "Earn stratification ranking (top %) — critical for E-7+ promotion",
      "Complete required Professional Military Education (Airman Leadership School, NCOA, SNCOA)",
      "Maintain physical fitness standards (Physical Fitness Assessment)",
      "Complete college education — Air Force rewards degree completion",
    ],
    sampleTasks:[
      {id:1,name:"Sortie Generation Rate Improvement — Q1",status:"Complete",priority:"High",pie:"P",quarter:"Q1 (Jan–Mar)",evalPeriod:"Annual",requestor:"Capt Chen, Flight Commander",commandObjective:"Mission Readiness",description:"Led maintenance initiative to reduce aircraft turnaround time through improved pre-flight procedures.",impact:"Sortie generation rate improved 22%. Squadron achieved highest MC rate in wing for Q1.",visibility:"Wing Commander",evidence:"",feedback:'"SSgt Davis is the definition of a mission-first Airman." — Capt Chen',skills:["Leadership","Maintenance & Logistics"],receipts:[],createdAt:"2026-01-18"},
    ]
  },

  // ── SPACE FORCE ───────────────────────────────────────────────────────────
  "Space Force": {
    name:"Space Force", emoji:"🚀", color:"#1C2951", accent:"#40C4FF",
    memberTitle:"Guardian", membersTitle:"Guardians",
    evalDoc:"EPB / OPB",
    evalSystem:`The Space Force uses the same Enlisted Performance Brief (EPB) and Officer Performance Brief (OPB) system as the Air Force, from which most Space Force members transitioned. The EPB covers Performance, Leadership, and Impact for enlisted Guardians. The OPB covers Leadership, Mission Impact, and Potential for officers. Given the unique nature of Space Force missions — satellite operations, orbital mechanics, cyber operations, and space domain awareness — performance narratives should emphasize technical depth, innovation, and the strategic impact of space capabilities. The Space Force is the newest and smallest branch with under 10,000 Guardians, making individual contributions highly visible. Every achievement has outsized impact on this tight-knit force.`,
    evalTypes:["Annual","Closeout","Stratification","Promotion","Special","Separation"],
    evalGrades:["Promote — Clearly Exceeds Standards","Must Promote","Promote","Do Not Promote Now","Do Not Promote"],
    rankLabel:"Specialty Code", unitLabel:"Squadron / Delta", locationLabel:"Garrison",
    paygradeGroups:{
      juniorEnlisted:["E-1 Specialist 1","E-2 Specialist 2","E-3 Specialist 3","E-4 Specialist 4"],
      seniorEnlisted:["E-5 Sergeant","E-6 Technical Sergeant","E-7 Master Sergeant","E-8 Senior Master Sergeant","E-9 Chief Master Sergeant"],
      officer:       ["O-1 2nd Lt","O-2 1st Lt","O-3 Captain","O-4 Major","O-5 Lt Colonel","O-6 Colonel","O-7 Brig General","O-8 Maj General","O-9 Lt General","O-10 General"],
    },
    paygrades:["E-1 Specialist 1","E-2 Specialist 2","E-3 Specialist 3","E-4 Specialist 4","E-5 Sergeant","E-6 Technical Sergeant","E-7 Master Sergeant","E-8 Senior Master Sergeant","E-9 Chief Master Sergeant","O-1 2nd Lt","O-2 1st Lt","O-3 Captain","O-4 Major","O-5 Lt Colonel","O-6 Colonel","O-7 Brig General","O-8 Maj General","O-9 Lt General","O-10 General"],
    visibility:["Flight Commander only","Squadron Commander","Delta Commander","Field Command","Space Force-wide","DoD-wide","Community-wide"],
    objectives:["Mission Readiness","Space Domain Awareness","Guardian Development","Innovation","Administrative Excellence","Safety","Cyber / Technical Excellence"],
    skills:["Leadership","Space Operations","Orbital Mechanics","Cyber Operations","Training & Mentorship","Administrative","Communications","Intelligence","Mission Planning","Physical Readiness","Community Service","Education","Innovation & Technology"],
    iloveCats:["EPB / OPB Copy","Award Certificate","Commendation Letter","Photo — Ceremony","Photo — Mission","Qualification Badge","Specialty Certificate","Training Certificate","Other"],
    docCats:["Career Roadmap","Specialty Training Manual","SPACEFOR Directive","PCS Orders","Transfer Docs","Personal Statement / Bio","Decoration Package","Resume / Package","Other"],
    pieGuidance:"Space Force EPB/OPB rewards technical depth and innovation alongside traditional leadership. Given the small force size, every Guardian's performance is highly visible. Emphasize space-specific technical achievements and cross-domain impact.",
    bragIntro:"Submit your performance inputs to your supervisor 4–6 weeks before your EPB/OPB close-out date. Highlight technical innovation and mission impact on the space domain.",
    advancementTips:[
      "Write EPB bullets emphasizing space domain impact and technical innovation",
      "Complete Space Force Professional Military Education requirements",
      "Earn technical certifications in your specialty area",
      "Demonstrate cross-functional contributions — Space Force rewards versatility",
      "Maintain physical fitness standards (Physical Fitness Assessment)",
    ],
    sampleTasks:[
      {id:1,name:"Satellite C2 Readiness Certification",status:"Complete",priority:"High",pie:"P",quarter:"Q1 (Jan–Mar)",evalPeriod:"Annual",requestor:"Capt Okonkwo, Flight Commander",commandObjective:"Mission Readiness",description:"Led C2 readiness review for assigned satellite constellation. Identified and corrected 3 critical procedure gaps.",impact:"100% C2 readiness certified. Zero anomalies during on-orbit operations for 90 consecutive days.",visibility:"Delta Commander",evidence:"",feedback:'"Sgt Park operates at a level well above grade." — Capt Okonkwo',skills:["Space Operations","Leadership"],receipts:[],createdAt:"2026-01-22"},
    ]
  },

  // ── COAST GUARD ───────────────────────────────────────────────────────────
  "Coast Guard": {
    name:"Coast Guard", emoji:"🛡️", color:"#003087", accent:"#FF6600",
    memberTitle:"Coast Guardsman", membersTitle:"Coast Guardsmen",
    evalDoc:"EER / OER",
    evalSystem:`The Coast Guard uses two evaluation systems based on rank. E1–E3 do NOT receive formal Enlisted Evaluation Reports (EERs). Progress is tracked through qualifications, supervisor input, and the advancement exam system. Competency in rate-specific skills, physical fitness standards, and completion of required training are the primary advancement factors for junior enlisted. E4–E9 receive the Enlisted Employee Review (EER) which evaluates performance against specific competencies scored numerically: Leadership (influence, developing subordinates, initiative), Professional/Specialty Knowledge (technical skills, rate-specific expertise), Results/Effectiveness (mission accomplishment, quality of work), Communication (written, verbal, interpersonal), and Military Readiness (bearing, fitness, adherence to standards). Officers and Chief Warrant Officers receive the Officer Evaluation Report (OER) which focuses on leadership impact, command potential, decision-making under pressure, and long-term potential for increased responsibility. The Coast Guard is unique in its law enforcement, search and rescue, maritime security, and environmental protection missions — performance narratives should reflect these diverse mission areas.`,
    evalTypes:["Periodic","Detachment","Promotion","Special","Enlisted Employee Review","Officer Evaluation Report"],
    evalGrades:["Exceeds Standards — Promote Ahead of Peers","Meets Standards — Promote","Does Not Meet Standards"],
    rankLabel:"Rate / Rating", unitLabel:"Cutter / Sector", locationLabel:"Sector",
    paygradeGroups:{
      juniorEnlisted:["E-1 Seaman Recruit","E-2 Seaman Apprentice","E-3 Seaman"],
      seniorEnlisted:["E-4 Petty Officer 3rd Class","E-5 Petty Officer 2nd Class","E-6 Petty Officer 1st Class","E-7 Chief Petty Officer","E-8 Senior Chief Petty Officer","E-9 Master Chief Petty Officer"],
      warrantOfficer:["W-2 CWO2","W-3 CWO3","W-4 CWO4"],
      officer:       ["O-1 Ensign","O-2 LTJG","O-3 Lieutenant","O-4 LCDR","O-5 Commander","O-6 Captain","O-7 RDML","O-8 RADM","O-9 VADM","O-10 Admiral"],
    },
    paygrades:["E-1 Seaman Recruit","E-2 Seaman Apprentice","E-3 Seaman","E-4 Petty Officer 3rd Class","E-5 Petty Officer 2nd Class","E-6 Petty Officer 1st Class","E-7 Chief Petty Officer","E-8 Senior Chief","E-9 Master Chief","W-2 CWO2","W-3 CWO3","W-4 CWO4","O-1 Ensign","O-2 LTJG","O-3 Lieutenant","O-4 LCDR","O-5 Commander","O-6 Captain","O-7 RDML","O-8 RADM","O-9 VADM","O-10 Admiral"],
    visibility:["Division Officer only","Department Head","XO","CO","District/Sector","Coast Guard-wide","Community-wide"],
    objectives:["Mission Readiness","Search & Rescue","Maritime Law Enforcement","Coast Guardsman Development","Community Outreach","Environmental Protection","Safety"],
    skills:["Leadership","Search & Rescue","Maritime Law Enforcement","Seamanship","Training & Mentorship","Administrative","Navigation","Communications","Maintenance & Logistics","Physical Readiness","Community Service","Education","Incident Command"],
    iloveCats:["EER / OER Copy","Award Certificate","Commendation Letter","Photo — Ceremony","Photo — Patrol/Underway","Qualification Card","Rate Certificate","Training Certificate","Other"],
    docCats:["Career Roadmap","Rate Training Manual","ALCOAST / Directive","PCS Orders","Transfer Docs","Personal Statement / Bio","Advancement Study Guide","Resume / Package","Other"],
    pieGuidance:"EER competencies map directly to PIE: Leadership and Military Readiness → Performance. Professional Knowledge and Communication → Self-Improvement. Results/Effectiveness and community contributions → Exposure. Score consistently across all five competency areas.",
    bragIntro:"Submit your input to your Supervisor 4–6 weeks before your EER close-out date. E1–E3: bring this documentation to your supervisor for input into the advancement system.",
    juniorEnlistedNote:"E1–E3 do not receive formal EERs. Your advancement is tracked through rate qualifications, training completion, physical fitness, and supervisor input. Log achievements here to demonstrate readiness for advancement and to bring to supervisor counseling.",
    advancementTips:[
      "Pass the Service-Wide Exam (SWE) for E4–E6 advancement",
      "Complete all required rate qualifications and training",
      "Maintain physical fitness above minimum standards",
      "Complete required Professional Development (BLET, Pertinent courses)",
      "Earn performance marks in all five EER competency areas",
    ],
    sampleTasks:[
      {id:1,name:"SAR Case — Successful Rescue 47nm Offshore",status:"Complete",priority:"High",pie:"P",quarter:"Q1 (Jan–Mar)",evalPeriod:"Periodic",requestor:"LT Nguyen, Operations Officer",commandObjective:"Search & Rescue",description:"Served as on-scene coordinator for 47nm offshore distress case in deteriorating weather. Coordinated air and surface assets.",impact:"4 persons rescued with zero injuries. Case closed in 3.2 hours — 40% faster than sector average.",visibility:"CO",evidence:"",feedback:'"BM2 Santos performed exceptionally under pressure." — LT Nguyen',skills:["Search & Rescue","Leadership"],receipts:[],createdAt:"2026-01-12"},
    ]
  },
};
const OPSEC_RULES = [
  "Do NOT include specific unit locations, coordinates, or deployment destinations",
  "Do NOT include classified information, mission details, or sensitive operations",
  "Do NOT include names of sources, methods, or intelligence activities",
  "Do NOT include specific troop numbers, equipment quantities, or readiness levels",
  "Do NOT include future operation plans, timelines, or movement schedules",
  "Focus on YOUR personal contributions, skills, and quantifiable impact",
  "When in doubt — leave it out. Your chain of command can add context.",
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const dateStr = () => new Date().toISOString().slice(0,10);
const clamp   = (v,lo,hi) => Math.min(hi,Math.max(lo,v));

function useLocalStorage(key, init) {
  const [val, setVal] = useState(()=>{
    try { const s=localStorage.getItem(key); return s?JSON.parse(s):init; }
    catch { return init; }
  });
  const set = useCallback(v=>{
    setVal(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch(e) {
      // QuotaExceededError — storage full (often from large file uploads)
      if (e.name==="QuotaExceededError"||e.code===22) {
        console.warn("Storage full for key:", key, "— files may not persist after refresh.");
      }
    }
  },[key]);
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
  const isImg = file.dataUrl && file.type?.startsWith("image/");
  const isPDF = file.type === "application/pdf";
  const hasData = !!(file.dataUrl);
  const iconBg=isPDF?"rgba(206,51,52,.2)":isImg?"rgba(62,137,255,.2)":"rgba(124,99,255,.2)";
  const iconCol=isPDF?C.redLight:isImg?"#60A5FA":"#A78BFA";
  return (
    <div className="card-hover fade-up" style={{ background:C.navyCard, borderRadius:12, overflow:"hidden", border:`1px solid ${C.navyBorder}` }}>
      <div style={{ height:120, background:C.navyMid, overflow:"hidden", cursor:file.dataUrl?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:6 }} onClick={()=>{
          if (file.dataUrl) {
            try {
              const a=document.createElement("a"); a.href=file.dataUrl; a.target="_blank"; a.rel="noopener noreferrer"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            } catch(e) { window.open(file.dataUrl,"_blank"); }
          } else {
            alert("File not available — may have been too large for browser storage. Please re-upload.");
          }
        }}>
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
function AchModal({ task, onSave, onDelete, onClose, isEdit, B }) {
  const [form,setForm]=useState({...task, receipts: task.receipts||[]});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const appendVoice=(k,v)=>setForm(f=>({...f,[k]:f[k]?f[k]+" "+v:v}));
  const toggle=s=>set("skills",form.skills.includes(s)?form.skills.filter(x=>x!==s):[...form.skills,s]);
  const fileRef = useRef();

  const addReceipt = (file) => {
    if (!file) return;
    const MAX = 2 * 1024 * 1024;
    if (file.size > MAX) {
      const go = window.confirm(`This file is ${(file.size/1024/1024).toFixed(1)}MB. Files over 2MB may not persist after refresh. Continue?`);
      if (!go) return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const receipt = { id: Date.now(), name: file.name, type: file.type, size: file.size, dataUrl: e.target.result };
      setForm(f => ({...f, receipts: [...(f.receipts||[]), receipt]}));
    };
    reader.onerror = () => alert("Could not read file. Please try again.");
    reader.readAsDataURL(file);
  };

  const removeReceipt = (id) => {
    setForm(f => ({...f, receipts: (f.receipts||[]).filter(r => r.id !== id)}));
  };

  const openReceipt = (r) => {
    if (!r.dataUrl) { alert("File data not available. Please re-upload."); return; }
    try {
      const a = document.createElement("a");
      a.href = r.dataUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch(e) { window.open(r.dataUrl, "_blank"); }
  };
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
            <F label={`${B?.evalDoc||"EVAL"} Period`}><select style={sl} value={form.evalPeriod} onChange={e=>set("evalPeriod",e.target.value)}>{(B.evalTypes||EVAL_PERIODS).map(s=><option key={s}>{s}</option>)}</select></F>
          </Sec>
          <Sec title="Command Context">
            <F label="Who Can Validate"><input style={inp} value={form.requestor} onChange={e=>set("requestor",e.target.value)} placeholder={`Name, ${B?.rankLabel||"Rate/Rank"}`} /></F>
            <F label={`${B?.name||"Command"} Objective`}><select style={sl} value={form.commandObjective} onChange={e=>set("commandObjective",e.target.value)}>{(B.objectives||CMD_OBJ).map(s=><option key={s}>{s}</option>)}</select></F>
            <F label={`Visibility`}><select style={sl} value={form.visibility} onChange={e=>set("visibility",e.target.value)}>{(B.visibility||VISIBILITY_OPT).map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="Evidence / Link"><input style={inp} value={form.evidence} onChange={e=>set("evidence",e.target.value)} placeholder="NDAWS, award orders, link..." /></F>
          </Sec>
          <Sec title="Narrative & Impact">
            <F label="What You Did" full><div style={{ position:"relative" }}><textarea style={{...inp,height:72,resize:"vertical",paddingRight:46}} value={form.description} onChange={e=>set("description",e.target.value)} placeholder={`What was the situation? What did YOU specifically do as a ${B?.memberTitle||"service member"}?`} /><VoiceBtn onResult={v=>appendVoice("description",v)} /></div></F>
            <F label="⭐ Quantifiable Impact — YOUR MOST IMPORTANT FIELD" full>
              <div style={{ position:"relative" }}><textarea style={{...inp,height:90,resize:"vertical",borderColor:C.red,paddingRight:46,background:"rgba(206,51,52,.05)"}} value={form.impact} onChange={e=>set("impact",e.target.value)} placeholder="e.g. 'Increased DC qual rate from 54% to 91% across 47 Sailors in 8 weeks. Zero INSURV discrepancies.'" /><VoiceBtn onResult={v=>appendVoice("impact",v)} /></div>
              <div style={{ fontSize:11,color:C.red,marginTop:4,fontWeight:600 }}>How many affected? What % improved? $$ saved? How fast?</div>
            </F>
            <F label="Feedback / Exact Quotes" full><div style={{ position:"relative" }}><textarea style={{...inp,height:56,resize:"vertical",paddingRight:46}} value={form.feedback} onChange={e=>set("feedback",e.target.value)} placeholder='"Quote here" — Chief Smith, LPO' /><VoiceBtn onResult={v=>appendVoice("feedback",v)} /></div></F>
          </Sec>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.red,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${C.navyBorder}` }}>Core Competencies</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>{(B?.skills||SKILLS_OPTIONS).map(s=><button key={s} onClick={()=>toggle(s)} style={{ padding:"6px 12px",borderRadius:99,border:`1.5px solid ${form.skills.includes(s)?C.red:C.navyBorder}`,background:form.skills.includes(s)?"rgba(206,51,52,.15)":C.navyMid,color:form.skills.includes(s)?C.redLight:C.textDim,fontSize:12,fontWeight:600,cursor:"pointer" }}>{s}</button>)}</div>
          </div>
          {/* ── RECEIPTS / EVIDENCE FILES ── */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.red,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${C.navyBorder}` }}>
              📎 Evidence Files <span style={{ fontSize:10,color:C.textFaint,fontWeight:400,letterSpacing:0,textTransform:"none" }}> — receipts, orders, certificates, photos</span>
            </div>

            {/* Uploaded receipts */}
            {(form.receipts||[]).length > 0 && (
              <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:12 }}>
                {(form.receipts||[]).map(r => {
                  const isImg = r.type?.startsWith("image/");
                  const isPDF = r.type === "application/pdf";
                  const ext = r.name?.split(".").pop().toUpperCase() || "FILE";
                  const kb = r.size ? `${(r.size/1024).toFixed(0)}KB` : "";
                  return (
                    <div key={r.id} style={{ display:"flex",alignItems:"center",gap:10,background:C.navyMid,borderRadius:9,padding:"9px 12px",border:`1px solid ${C.navyBorder}` }}>
                      {/* Thumbnail or icon */}
                      <div onClick={()=>openReceipt(r)} style={{ width:36,height:36,borderRadius:7,background:C.navyCard,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",overflow:"hidden",border:`1px solid ${C.navyBorder}` }}>
                        {isImg && r.dataUrl
                          ? <img src={r.dataUrl} alt={r.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                          : <span style={{ fontSize:18 }}>{isPDF ? "📄" : "📎"}</span>}
                      </div>
                      {/* File info */}
                      <div style={{ flex:1,minWidth:0 }}>
                        <div onClick={()=>openReceipt(r)} style={{ fontSize:12,fontWeight:600,color:C.text,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.name}</div>
                        <div style={{ fontSize:10,color:C.textFaint,marginTop:1 }}>{ext} {kb && `· ${kb}`}</div>
                      </div>
                      {/* Open + Remove */}
                      <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                        <button onClick={()=>openReceipt(r)} style={{ background:"rgba(62,137,255,.15)",color:"#60A5FA",border:"none",borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer" }}>Open</button>
                        <button onClick={()=>removeReceipt(r.id)} style={{ background:"rgba(206,51,52,.12)",color:C.redLight,border:"none",borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer" }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upload button */}
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.txt" style={{ display:"none" }}
              onChange={e=>{ if(e.target.files[0]) addReceipt(e.target.files[0]); e.target.value=""; }} />
            <button onClick={()=>fileRef.current?.click()}
              style={{ width:"100%",padding:"10px",background:"rgba(62,137,255,.08)",color:"#60A5FA",border:`1.5px dashed rgba(62,137,255,.3)`,borderRadius:9,fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <span style={{ fontSize:16 }}>📎</span>
              {(form.receipts||[]).length > 0 ? `Add Another File (${(form.receipts||[]).length} attached)` : "Attach Evidence File"}
            </button>
            <div style={{ fontSize:10,color:C.textFaint,marginTop:5,textAlign:"center" }}>
              Images, PDFs, Word docs, or text files · Max 2MB recommended · Files saved with this achievement
            </div>
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
            <td style={{ padding:"11px 13px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                <div style={{ fontWeight:600,fontSize:13,color:C.text }}>{t.name}</div>
                {t.receipts?.length>0&&<span style={{ background:"rgba(62,137,255,.15)",color:"#60A5FA",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:600,flexShrink:0 }}>📎 {t.receipts.length}</span>}
              </div>
              {t.commandObjective&&<div style={{ fontSize:11,color:C.textFaint,marginTop:2 }}>{t.commandObjective}</div>}
              <div className="show-sm-only" style={{ marginTop:5 }}><StatusBadge value={t.status} small /></div>
            </td>
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
function ProfileScreen({ profile, setProfile, user, onLogout, appYear, setAppYear, B, onChangeBranch, apiEnabled, onOpenApiSetup, subscribed, subBilling, setSubBilling, handleCheckout, checkingOut, onSyncNow, syncStatus }) {
  const [editing,setEditing]=useState(false), [form,setForm]=useState(profile);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=()=>{
    setProfile(form);
    try { localStorage.setItem("lb_profile", JSON.stringify(form)); } catch(e) {}
    setEditing(false);
    // Trigger immediate cloud save via profile prop update
  };
  const inp={ fontSize:13,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"9px 11px",width:"100%",background:C.navyMid,outline:"none",color:C.text };
  const lbl={ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 };
  return (
    <div className="fade-up">
      <div style={{ background:`linear-gradient(135deg,${C.navyCard},rgba(206,51,52,.1))`,borderRadius:16,padding:24,marginBottom:20,border:`1px solid ${C.navyBorder}`,position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",right:-10,top:-10,fontSize:100,opacity:.05,userSelect:"none" }}>⚓</div>
        <div style={{ display:"flex",alignItems:"center",gap:16 }}>
          {user?.photoURL?<img src={user.photoURL} alt="avatar" style={{ width:60,height:60,borderRadius:14,border:`2px solid ${C.red}` }} />:<div style={{ width:60,height:60,borderRadius:14,background:`linear-gradient(135deg,${C.red},#8B0000)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>{B.emoji}</div>}
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:C.text,lineHeight:1 }}>{profile.name||user?.displayName||"Your Name"}</div>
            <div style={{ fontSize:13,color:C.textDim,marginTop:4 }}>{[profile.paygrade,profile.rate].filter(Boolean).join(" ")}{profile.ship&&<span> · {profile.ship}</span>}</div>
            {user?.email&&<div style={{ fontSize:11,color:C.textFaint,marginTop:2 }}>✓ Signed in · {user.email}</div>}
          </div>
        </div>
        {profile.prd&&<div style={{ marginTop:14,padding:"8px 12px",background:"rgba(245,166,35,.1)",borderRadius:8,border:`1px solid rgba(245,166,35,.2)`,fontSize:12,color:C.gold }}>📅 PRD: {profile.prd}</div>}
      </div>

      {/* ── SUBSCRIPTION CARD ── */}
      <div style={{ background:C.navyCard,borderRadius:14,padding:20,marginBottom:16,border:`1px solid ${subscribed?"rgba(46,204,113,.3)":C.navyBorder}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:10 }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,color:C.text,marginBottom:2 }}>
              {subscribed ? "✅ LetsBrag™ Basic — Active" : "💳 Subscribe to LetsBrag™"}
            </div>
            <div style={{ fontSize:12,color:C.textDim,lineHeight:1.5 }}>
              {subscribed
                ? `${subBilling==="annual"?"$39.99/year":"$4.99/month"} · Thank you for supporting LetsBrag™`
                : "Unlimited achievements, goals, brag doc, awards, key dates, and more."}
            </div>
          </div>
          {subscribed&&<span style={{ background:"rgba(46,204,113,.15)",color:C.green,borderRadius:99,padding:"4px 12px",fontSize:11,fontWeight:700,border:"1px solid rgba(46,204,113,.3)" }}>ACTIVE</span>}
        </div>

        {!subscribed&&(
          <>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
              {[
                {label:"Monthly",price:"$4.99",sub:"per month",billing:"monthly",popular:false},
                {label:"Annual", price:"$39.99",sub:"per year · save 33%",billing:"annual",popular:true},
              ].map(({label,price,sub,billing,popular})=>(
                <div key={billing} style={{ background:C.navyMid,borderRadius:10,padding:"14px",border:`1px solid ${popular?C.red:C.navyBorder}`,position:"relative",cursor:"pointer",transition:"all .15s" }}
                  onClick={()=>{ setSubBilling(billing); }}>
                  {popular&&<div style={{ position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:C.red,color:"#fff",borderRadius:99,padding:"2px 10px",fontSize:9,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,whiteSpace:"nowrap" }}>BEST VALUE</div>}
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                    <div style={{ width:16,height:16,borderRadius:"50%",border:`2px solid ${subBilling===billing?C.red:C.navyBorder}`,background:subBilling===billing?"rgba(220,38,38,.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      {subBilling===billing&&<div style={{ width:8,height:8,borderRadius:"50%",background:C.red }} />}
                    </div>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:C.text }}>{label}</span>
                  </div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:popular?C.red:C.text }}>{price}</div>
                  <div style={{ fontSize:11,color:C.textDim,marginTop:1 }}>{sub}</div>
                </div>
              ))}
            </div>

            <button
              onClick={()=>handleCheckout(subBilling)}
              disabled={checkingOut}
              style={{ width:"100%",padding:"13px",background:checkingOut?"rgba(220,38,38,.4)":C.red,color:"#fff",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,cursor:checkingOut?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all .2s",marginBottom:10 }}>
              {checkingOut
                ? <><span className="spin" style={{ display:"inline-block",width:18,height:18,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%" }} /> Opening Checkout...</>
                : <>🔒 Subscribe {subBilling==="annual"?"— $39.99/year":"— $4.99/month"} · 7-Day Free Trial</>}
            </button>
            <div style={{ textAlign:"center",fontSize:11,color:C.textFaint,lineHeight:1.7 }}>
              Secure checkout powered by Stripe · Cancel anytime · No commitment
            </div>
          </>
        )}

        {subscribed&&(
          <div style={{ display:"flex",gap:9,flexWrap:"wrap" }}>
            <button
              onClick={()=>{ window.open("https://billing.stripe.com/p/login/test_28o8yk6bMcMV2dy288","_blank"); }}
              style={{ padding:"9px 16px",background:C.navyMid,color:C.textDim,border:`1px solid ${C.navyBorder}`,borderRadius:8,fontWeight:600,fontSize:12,cursor:"pointer" }}>
              Manage Billing →
            </button>
            <button
              onClick={()=>{ if(window.confirm("Are you sure you want to cancel? You will lose access at the end of your billing period.")) { setSubscribed(false); } }}
              style={{ padding:"9px 16px",background:"none",color:C.textFaint,border:"none",fontSize:11,cursor:"pointer",textDecoration:"underline" }}>
              Cancel Subscription
            </button>
          </div>
        )}
      </div>
      {!editing?(
        <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
          <button onClick={()=>{setForm(profile);setEditing(true);}} style={{ flex:1,padding:"11px",background:C.red,color:"#fff",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer" }}>Edit Profile</button>
          <button onClick={()=>alert("AI features — including the Career Coach, Eval Bullet Generator, and Package Builder — are coming in the next version of LetsBrag. Stay tuned!")} style={{ padding:"11px 14px",background:"rgba(124,99,255,.1)",color:"#A78BFA",border:"1px solid rgba(124,99,255,.2)",borderRadius:10,fontWeight:600,fontSize:12,cursor:"pointer",whiteSpace:"nowrap" }}>🤖 AI — Coming Soon</button>
          <button onClick={onChangeBranch} style={{ padding:"11px 14px",background:C.navyMid,color:C.textDim,border:`1px solid ${C.navyBorder}`,borderRadius:10,fontWeight:600,fontSize:12,cursor:"pointer" }}>{B.emoji} Change Branch</button>
          {onSyncNow&&<button onClick={onSyncNow} style={{ padding:"11px 14px",background:"rgba(46,204,113,.12)",color:C.green,border:`1px solid rgba(46,204,113,.25)`,borderRadius:10,fontWeight:600,fontSize:12,cursor:"pointer",whiteSpace:"nowrap" }}>{syncStatus==="syncing"?"⟳ Syncing...":syncStatus==="synced"?"✓ Synced":"☁ Sync Now"}</button>}
          <button onClick={onLogout} style={{ padding:"11px 14px",background:C.navyMid,color:C.textDim,border:`1px solid ${C.navyBorder}`,borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer" }}>Sign Out</button>
        </div>
      ):(
        <div style={{ background:C.navyCard,borderRadius:14,padding:20,border:`1px solid ${C.navyBorder}` }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text,marginBottom:16 }}>Edit Profile</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
            <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Full Name</label><input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Petty Officer Jane Smith" /></div>
            <div><label style={lbl}>Paygrade</label><select style={{...inp,cursor:"pointer"}} value={form.paygrade} onChange={e=>set("paygrade",e.target.value)}>{(B.paygrades||PAYGRADES).map(p=><option key={p}>{p}</option>)}</select></div>
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





// ─── PRICING PAGE ─────────────────────────────────────────────────────────────
function PricingPage({ currentTier, onClose }) {
  const [billing, setBilling] = useState("annual");
  const isPro = currentTier?.id === "pro";

  const monthlyUrl = "https://buy.stripe.com/14AaEY1wIcoB0MR02M38403";
  const annualUrl  = "https://buy.stripe.com/28EeVegrC1JX7bf6ra38402";

  const goToStripe = () => {
    const url = billing === "annual" ? annualUrl : monthlyUrl;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const features = [
    "Unlimited achievements",
    "Goals tracker",
    "Full PIE brag doc",
    "AI Career Coach",
    "Career Timeline",
    "Transition Assistant (resume + LinkedIn)",
    "Package Builder",
    "I Love Me Book",
    "Career Docs storage",
    "All 6 military branches",
    "Voice dictation on all fields",
    "AI bullet generator",
  ];

  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:C.navyCard,borderRadius:20,width:"100%",maxWidth:460,border:`1px solid ${C.navyBorder}`,overflow:"auto",maxHeight:"94vh" }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,#0B1120,#1C2942)`,padding:"28px 24px 20px",textAlign:"center",borderBottom:`1px solid ${C.navyBorder}` }}>
          {onClose&&<button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:C.navyMid,border:"none",color:C.textDim,width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:16 }}>✕</button>}
          <div style={{ fontSize:36,marginBottom:8 }}>🎖️</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:C.text }}>LetsBrag Pro</div>
          <div style={{ fontSize:13,color:C.textDim,marginTop:4 }}>Everything you need to own your military career</div>
        </div>

        <div style={{ padding:"20px 24px" }}>

          {/* Billing toggle */}
          <div style={{ display:"flex",background:C.navyMid,borderRadius:99,padding:3,marginBottom:20,border:`1px solid ${C.navyBorder}` }}>
            {[["monthly","Monthly"],["annual","Annual"]].map(([val,lbl])=>(
              <button key={val} onClick={()=>setBilling(val)}
                style={{ flex:1,padding:"8px 0",borderRadius:99,border:"none",fontWeight:700,fontSize:13,cursor:"pointer",
                  background:billing===val?C.red:"transparent",
                  color:billing===val?"#fff":C.textDim }}>
                {lbl}{val==="annual"&&<span style={{ marginLeft:6,background:"rgba(46,204,113,.2)",color:"#4ADE80",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:700 }}>SAVE 33%</span>}
              </button>
            ))}
          </div>

          {/* Price */}
          <div style={{ textAlign:"center",marginBottom:20 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:52,color:C.text,lineHeight:1 }}>
              {billing==="annual"?"$3.33":"$4.99"}
              <span style={{ fontSize:18,color:C.textDim,fontWeight:400 }}>/mo</span>
            </div>
            {billing==="annual"&&<div style={{ fontSize:12,color:C.textDim,marginTop:4 }}>Billed as $39.99/year</div>}
            {billing==="monthly"&&<div style={{ fontSize:12,color:C.textDim,marginTop:4 }}>Billed monthly · cancel anytime</div>}
          </div>

          {/* Features list */}
          <div style={{ background:C.navyMid,borderRadius:12,padding:"14px 16px",marginBottom:20,border:`1px solid ${C.navyBorder}` }}>
            {features.map(f=>(
              <div key={f} style={{ display:"flex",alignItems:"center",gap:10,padding:"5px 0",fontSize:13,color:C.text }}>
                <span style={{ color:"#4ADE80",fontSize:14,flexShrink:0 }}>✓</span>{f}
              </div>
            ))}
          </div>

          {/* CTA */}
          {isPro ? (
            <div style={{ background:"rgba(46,204,113,.1)",border:"1px solid rgba(46,204,113,.3)",borderRadius:12,padding:"14px",textAlign:"center",color:"#4ADE80",fontWeight:700,fontSize:15 }}>
              ✓ You're on LetsBrag Pro!
            </div>
          ) : (
            <button onClick={goToStripe}
              style={{ width:"100%",background:C.red,color:"#fff",border:"none",padding:"14px",borderRadius:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,cursor:"pointer",marginBottom:10 }}>
              Get LetsBrag Pro →
            </button>
          )}

          <div style={{ textAlign:"center",fontSize:11,color:C.textFaint,marginTop:8 }}>
            🔒 Secure payment via Stripe · Cancel anytime
          </div>

        </div>
      </div>
    </div>
  );
}


function UpgradePrompt({ featureName, requiredTier, onUpgrade, onClose }) {
  const tier = TIERS[requiredTier] || TIERS.nco;
  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:420,border:`1px solid ${C.navyBorder}`,overflow:"hidden" }}>
        <div style={{ background:`linear-gradient(135deg,${tier.color}30,${C.navyMid})`,padding:"24px 20px",textAlign:"center",borderBottom:`1px solid ${C.navyBorder}` }}>
          <div style={{ fontSize:36,marginBottom:8 }}>🔒</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:C.text,marginBottom:4 }}>{featureName}</div>
          <div style={{ fontSize:12,color:C.textDim,lineHeight:1.5 }}>This feature is included in the <strong style={{ color:tier.color }}>{tier.name}</strong> plan and above.</div>
        </div>
        <div style={{ padding:"18px 20px" }}>
          <div style={{ marginBottom:14 }}>
            {tier.features.slice(0,4).map((f,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:7 }}>
                <span style={{ color:tier.color,fontSize:13 }}>✓</span>
                <span style={{ fontSize:12,color:C.textDim }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center",marginBottom:8 }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:tier.color }}>${tier.monthlyPrice}</span>
            <span style={{ fontSize:12,color:C.textDim }}>/month · 7-day free trial</span>
          </div>
          <button onClick={onUpgrade} style={{ width:"100%",padding:"12px",background:tier.color,color:"#fff",border:"none",borderRadius:9,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer",marginBottom:8 }}>
            Upgrade to {tier.name} →
          </button>
          <button onClick={onClose} style={{ width:"100%",padding:"9px",background:"none",color:C.textDim,border:"none",fontSize:12,cursor:"pointer" }}>Maybe later</button>
        </div>
      </div>
    </div>
  );
}

// ─── TERMS OF SERVICE MODAL ───────────────────────────────────────────────────
function TosModal({ onAccept }) {
  const [scrolled, setScrolled] = useState(false);
  const bodyRef = useRef();
  const handleScroll = () => {
    const el = bodyRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolled(true);
  };
  const TOS_SECTIONS = [
    ["1. OWNERSHIP & COPYRIGHT", "LetsBrag and all associated content, design, code, features, and intellectual property are the exclusive property of LetsBrag and its creator. © 2026 LetsBrag. All rights reserved. Unauthorized copying, reproduction, distribution, modification, or sale of this application or any portion thereof is strictly prohibited and will be prosecuted to the full extent of the law under applicable federal copyright statutes (17 U.S.C. § 101 et seq.)."],
    ["2. LICENSE TO USE", "LetsBrag grants you a personal, non-transferable, non-exclusive, revocable license to use this application for your individual military career tracking purposes only. You may not sublicense, sell, resell, transfer, assign, or commercially exploit this application or any content within it."],
    ["3. PROHIBITED USES", "You agree NOT to copy, clone, or replicate this application for distribution or sale; reverse engineer or decompile the source code for commercial use; remove any copyright or proprietary notices; store classified or operationally restricted information; or represent this application as your own creation."],
    ["4. OPSEC & INFORMATION SECURITY", "You are solely responsible for ensuring that any information you enter complies with your branch's security policies and applicable federal law. Do not enter classified, SCI, CUI, or operationally sensitive data. LetsBrag is not an official DoD product and is not connected to any military personnel systems."],
    ["5. PRIVACY & DATA", "Your personal data, achievements, and uploaded files are stored locally on your device. LetsBrag does not collect, transmit, or sell your personal information. AI features use your own API key and communicate directly with Anthropic — LetsBrag does not intercept or store these communications."],
    ["6. DISCLAIMER OF WARRANTIES", "LetsBrag is provided as-is without warranty of any kind. We do not guarantee the application will be error-free or uninterrupted. LetsBrag is not responsible for any career outcomes, promotion decisions, or evaluation results based on use of this application."],
    ["7. INTELLECTUAL PROPERTY ENFORCEMENT", "Any unauthorized use, copying, or distribution of LetsBrag will result in immediate termination of your license and may result in civil and/or criminal liability. LetsBrag actively monitors for unauthorized copies and reserves all available legal remedies."],
    ["8. GOVERNING LAW", "These Terms are governed by the laws of the United States of America. Any disputes shall be resolved in the appropriate federal court."],
  ];
  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:560,maxHeight:"92vh",display:"flex",flexDirection:"column",border:`1px solid ${C.navyBorder}`,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ background:C.navy,padding:"16px 20px",borderRadius:"16px 16px 0 0",borderBottom:`1px solid ${C.navyBorder}`,flexShrink:0,display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:38,height:38,borderRadius:9,background:`linear-gradient(135deg,${C.red},#8B0000)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🎖️</div>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:C.text }}>Terms of Service & Privacy Policy</div>
            <div style={{ fontSize:11,color:C.textFaint,marginTop:1 }}>Read and accept before using LetsBrag</div>
          </div>
        </div>
        <div ref={bodyRef} onScroll={handleScroll} style={{ flex:1,overflowY:"auto",padding:"18px 20px" }}>
          {TOS_SECTIONS.map(([title, body], i) => (
            <div key={i} style={{ marginBottom:16 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.text,marginBottom:5,letterSpacing:.3 }}>{title}</div>
              <div style={{ fontSize:12,color:C.textDim,lineHeight:1.75 }}>{body}</div>
            </div>
          ))}
          <div style={{ background:"rgba(206,51,52,.08)",borderRadius:8,padding:"12px 14px",border:`1px solid rgba(206,51,52,.2)`,marginTop:4,marginBottom:16 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color:C.red,marginBottom:4 }}>NOT AN OFFICIAL DoD PRODUCT</div>
            <div style={{ fontSize:11,color:C.textDim,lineHeight:1.65 }}>LetsBrag is an independent application. It is not affiliated with, endorsed by, or connected to the Department of Defense, any branch of the U.S. Armed Forces, or any government agency.</div>
          </div>
          <div style={{ textAlign:"center",fontSize:10,color:C.textFaint,paddingBottom:8 }}>© 2026 LetsBrag · All Rights Reserved · letsbrag.netlify.app</div>
        </div>
        <div style={{ padding:"14px 20px",borderTop:`1px solid ${C.navyBorder}`,flexShrink:0,background:C.navyMid,borderRadius:"0 0 16px 16px" }}>
          {!scrolled&&<div style={{ fontSize:11,color:C.textFaint,textAlign:"center",marginBottom:8 }}>↓ Scroll to read the full terms before accepting</div>}
          <button onClick={scrolled?onAccept:()=>bodyRef.current?.scrollBy({top:280,behavior:"smooth"})}
            style={{ width:"100%",padding:"13px",background:scrolled?C.red:"rgba(206,51,52,.3)",color:"#fff",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,cursor:scrolled?"pointer":"default",transition:"background .3s" }}>
            {scrolled?"I Accept — Enter LetsBrag":"↓ Keep Scrolling to Accept"}
          </button>
          <div style={{ textAlign:"center",marginTop:7,fontSize:10,color:C.textFaint }}>By accepting you agree to the Terms of Service above · © 2026 LetsBrag</div>
        </div>
      </div>
    </div>
  );
}

// ─── OPSEC MODAL ─────────────────────────────────────────────────────────────
function OpsecModal({ onAccept }) {
  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:520,border:`2px solid ${C.gold}`,boxShadow:`0 0 40px rgba(245,166,35,.3)` }}>
        <div style={{ background:"rgba(245,166,35,.15)",padding:"16px 20px",borderRadius:"14px 14px 0 0",borderBottom:`1px solid rgba(245,166,35,.3)`,display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:28 }}>⚠️</span>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.gold }}>OPSEC REMINDER</div>
            <div style={{ fontSize:11,color:"rgba(245,166,35,.7)",marginTop:1 }}>Operational Security — Read Before Continuing</div>
          </div>
        </div>
        <div style={{ padding:"18px 20px" }}>
          <div style={{ fontSize:13,color:C.textDim,lineHeight:1.7,marginBottom:16 }}>
            LetsBrag is designed for <strong style={{ color:C.text }}>unclassified personal achievement tracking only.</strong> Before logging any information, remember:
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:18 }}>
            {OPSEC_RULES.map((rule,i)=>(
              <div key={i} style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                <span style={{ color:C.gold,flexShrink:0,marginTop:1 }}>⚠</span>
                <span style={{ fontSize:12,color:C.textDim,lineHeight:1.5 }}>{rule}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"rgba(206,51,52,.1)",borderRadius:8,padding:"10px 14px",marginBottom:18,borderLeft:`3px solid ${C.red}`,fontSize:12,color:"rgba(232,237,245,.8)",lineHeight:1.6 }}>
            This app stores data on your personal device. <strong style={{ color:C.text }}>Never enter classified, sensitive, or operationally sensitive information.</strong> If you are unsure whether something is appropriate to log, consult your chain of command.
          </div>
          <button onClick={onAccept} style={{ width:"100%",padding:"13px",background:C.gold,color:"#000",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,cursor:"pointer",letterSpacing:.5 }}>
            I UNDERSTAND — CONTINUE TO APP
          </button>
          <div style={{ textAlign:"center",fontSize:10,color:C.textFaint,marginTop:10 }}>This reminder appears on first launch and can be reviewed in Settings.</div>
        </div>
      </div>
    </div>
  );
}

// ─── BRANCH SELECTION MODAL ───────────────────────────────────────────────────
function BranchModal({ onSelect }) {
  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:1900,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:500,border:`1px solid ${C.navyBorder}` }}>
        <div style={{ padding:"20px 20px 14px",textAlign:"center" }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:C.text,marginBottom:4 }}>Select Your Branch</div>
          <div style={{ fontSize:13,color:C.textDim }}>LetsBrag will use the right terminology and eval format for your service.</div>
        </div>
        <div style={{ padding:"0 16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          {Object.entries(BRANCHES).map(([key, b])=>(
            <button key={key} onClick={()=>onSelect(key)}
              style={{ background:C.navyMid,border:`1px solid ${C.navyBorder}`,borderRadius:12,padding:"16px 12px",cursor:"pointer",textAlign:"center",transition:"all .2s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=b.accent;e.currentTarget.style.background="rgba(255,255,255,.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.navyBorder;e.currentTarget.style.background=C.navyMid;}}>
              <div style={{ fontSize:28,marginBottom:6 }}>{b.emoji}</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text }}>{b.name}</div>
              <div style={{ fontSize:10,color:C.textDim,marginTop:2 }}>{b.evalDoc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── AI BULLET GENERATOR MODAL ────────────────────────────────────────────────
function BulletModal({ task, branch, onClose, onApply }) {
  const B = branch && BRANCHES[branch] ? BRANCHES[branch] : BRANCHES.Navy;
  const [input,    setInput]    = useState(task ? task.name + (task.impact ? ". " + task.impact : "") : "");
  const [bullets,  setBullets]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [offline,  setOffline]  = useState(!navigator.onLine);

  useEffect(()=>{
    const on=()=>setOffline(false), off=()=>setOffline(true);
    window.addEventListener("online",on); window.addEventListener("offline",off);
    return()=>{ window.removeEventListener("online",on); window.removeEventListener("offline",off); };
  },[]);

  const generate = async () => {
    if (!input.trim()) return;
    if (!AI_ENABLED()) { setError("⚙️ AI features need an API key. Add your Anthropic API key to the ANTHROPIC_API_KEY constant at the top of App.tsx. Get a free key at console.anthropic.com"); return; }
    if (offline) { setError("No internet connection. Your achievement is saved — generate bullets when back online."); return; }
    setLoading(true); setError(""); setBullets([]);
    try {
      const prompt = `You are a military career advisor expert in writing ${B.evalDoc} evaluation bullets for the U.S. ${B.name}.

Convert this plain-English achievement into 3 polished ${B.evalDoc} evaluation bullets. Each bullet must:
- Start with a strong action verb (past tense)
- Include specific quantifiable results (numbers, percentages, dollar amounts, people affected)
- Follow proper military eval format: ACTION; RESULT/IMPACT
- Be concise (under 20 words ideally)
- Be unclassified and OPSEC-safe
- Use ${B.name}-appropriate terminology

Achievement: "${input}"

Return ONLY a JSON array of 3 strings, no other text. Example format:
["Bullet 1 here", "Bullet 2 here", "Bullet 3 here"]`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:AI_HEADERS(),
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:500,
          messages:[{role:"user",content:prompt}]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";
      const clean = text.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      setBullets(Array.isArray(parsed) ? parsed : []);
    } catch(e) {
      setError("Could not generate bullets. Check your connection and try again.");
    }
    setLoading(false);
  };

  const inp = { fontSize:13, border:`1px solid ${C.navyBorder}`, borderRadius:8, padding:"9px 11px", width:"100%", background:C.navyMid, outline:"none", color:C.text };

  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:580,maxHeight:"92vh",overflow:"auto",border:`1px solid ${C.navyBorder}` }}>
        <div style={{ background:C.navy,padding:"15px 18px",borderBottom:`1px solid ${C.navyBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10 }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>🤖 AI {B.evalDoc} Bullet Generator</div>
            <div style={{ fontSize:11,color:C.textFaint,marginTop:1 }}>Powered by Claude AI · Requires internet</div>
          </div>
          <button onClick={onClose} style={{ background:C.navyMid,border:"none",color:C.textDim,width:30,height:30,borderRadius:"50%",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:18 }}>
          {!AI_ENABLED()&&(
            <div style={{ background:"rgba(124,99,255,.12)",border:`1px solid rgba(124,99,255,.3)`,borderRadius:9,padding:"12px 14px",marginBottom:14 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#A78BFA",marginBottom:6 }}>🤖 AI Key Required</div>
              <div style={{ fontSize:12,color:C.textDim,marginBottom:10,lineHeight:1.6 }}>To generate AI bullets you need a free Anthropic API key. Takes 2 minutes — free tier gives you plenty of credits for personal use.</div>
              <button onClick={()=>{ onClose(); }} style={{ background:"#A78BFA",color:"#000",border:"none",padding:"8px 16px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>Go to Profile → Enable AI</button>
            </div>
          )}
          {offline && AI_ENABLED() && (
            <div style={{ background:"rgba(245,166,35,.1)",border:`1px solid rgba(245,166,35,.3)`,borderRadius:8,padding:"10px 13px",marginBottom:14,fontSize:12,color:C.gold }}>
              📵 You're offline. Log your achievement now and generate bullets when connected.
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 }}>Describe your achievement in plain English</label>
            <textarea style={{...inp,height:90,resize:"vertical"}} value={input} onChange={e=>setInput(e.target.value)}
              placeholder={`e.g. "I led the DC training program overhaul. Qualification rates went from 54% to 91% across 47 ${B.membersTitle} in 8 weeks and we passed our inspection with zero discrepancies"`} />
            <div style={{ fontSize:11,color:C.textFaint,marginTop:4 }}>Include numbers, timeframes, and how many people were affected for best results.</div>
          </div>
          <button onClick={generate} disabled={loading||offline} style={{ width:"100%",padding:"11px",background:loading?"rgba(206,51,52,.4)":C.red,color:"#fff",border:"none",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:loading||offline?"not-allowed":"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
            {loading?<><span className="spin" style={{ display:"inline-block",width:16,height:16,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%" }} /> Generating...</>:"⚡ Generate Bullets"}
          </button>
          {error && <div style={{ background:"rgba(206,51,52,.1)",border:`1px solid rgba(206,51,52,.3)`,borderRadius:8,padding:"10px 13px",marginBottom:14,fontSize:12,color:C.redLight }}>{error}</div>}
          {bullets.length>0&&(
            <div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.text,marginBottom:10,letterSpacing:.5 }}>SELECT A BULLET TO USE:</div>
              {bullets.map((b,i)=>(
                <div key={i} style={{ background:C.navyMid,borderRadius:9,padding:"12px 14px",marginBottom:10,border:`1px solid ${C.navyBorder}`,cursor:"pointer" }}
                  onClick={()=>onApply&&onApply(b)}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.green;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.navyBorder;}}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10 }}>
                    <div style={{ fontSize:13,color:C.text,lineHeight:1.55,flex:1 }}>{b}</div>
                    <button onClick={e=>{e.stopPropagation(); navigator.clipboard.writeText(b).then(()=>{}); }}
                      style={{ background:"rgba(46,204,113,.15)",color:C.green,border:"none",borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0 }}>Copy</button>
                  </div>
                </div>
              ))}
              <div style={{ fontSize:11,color:C.textFaint,marginTop:8 }}>⚠️ Review all bullets for OPSEC compliance before using in official documents.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AWARDS MODAL ─────────────────────────────────────────────────────────────
function AwardModal({ award, onSave, onDelete, onClose, isEdit, B }) {
  const [form, setForm] = useState(award);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { fontSize:13, border:`1px solid ${C.navyBorder}`, borderRadius:8, padding:"9px 11px", width:"100%", background:C.navyMid, outline:"none", color:C.text };
  const lbl = { fontSize:11, fontWeight:600, color:C.textDim, display:"block", marginBottom:4 };
  const awardTypes = B.name==="Navy"||B.name==="Coast Guard"
    ? ["Navy Achievement Medal","Navy Commendation Medal","Meritorious Service Medal","Navy Marine Corps Medal","Letter of Commendation","Certificate of Commendation","Good Conduct Medal","Unit Citation","Other"]
    : B.name==="Army"
    ? ["Army Achievement Medal","Army Commendation Medal","Meritorious Service Medal","Army Medal","Letter of Commendation","Certificate of Achievement","Good Conduct Medal","Unit Citation","Other"]
    : B.name==="Marines"
    ? ["Marine Corps Achievement Medal","Navy Commendation Medal","Meritorious Service Medal","Letter of Commendation","Certificate of Commendation","Good Conduct Medal","Unit Citation","Other"]
    : ["Achievement Medal","Commendation Medal","Meritorious Service Medal","Letter of Commendation","Certificate of Achievement","Good Conduct Medal","Unit Award","Other"];
  const statusColors = {"Submitted":"rgba(62,137,255,.15)","Approved":"rgba(46,204,113,.15)","Presented":"rgba(124,99,255,.15)","Downgraded":"rgba(245,166,35,.15)","Disapproved":"rgba(206,51,52,.15)"};

  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:520,maxHeight:"92vh",overflow:"auto",border:`1px solid ${C.navyBorder}` }}>
        <div style={{ background:C.navy,padding:"15px 18px",borderBottom:`1px solid ${C.navyBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>{isEdit?"Edit Award":"Log Award"}</div>
          <button onClick={onClose} style={{ background:C.navyMid,border:"none",color:C.textDim,width:30,height:30,borderRadius:"50%",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:18,display:"flex",flexDirection:"column",gap:13 }}>
          <div><label style={lbl}>Award Name / Title *</label>
            <input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Navy Achievement Medal for excellence in..." />
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div><label style={lbl}>Award Type</label>
              <select style={{...inp,cursor:"pointer"}} value={form.type} onChange={e=>set("type",e.target.value)}>
                {awardTypes.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Status</label>
              <select style={{...inp,cursor:"pointer"}} value={form.status} onChange={e=>set("status",e.target.value)}>
                {["Submitted","Approved","Presented","Downgraded","Disapproved"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Date Submitted</label>
              <input style={inp} type="date" value={form.submittedDate} onChange={e=>set("submittedDate",e.target.value)} />
            </div>
            <div><label style={lbl}>Date Approved / Presented</label>
              <input style={inp} type="date" value={form.approvedDate} onChange={e=>set("approvedDate",e.target.value)} />
            </div>
          </div>
          <div><label style={lbl}>Nominated By</label>
            <input style={inp} value={form.nominatedBy} onChange={e=>set("nominatedBy",e.target.value)} placeholder={`Name, ${B?.rankLabel||"Rate/Rank"}`} />
          </div>
          <div><label style={lbl}>Description / What It Was For</label>
            <textarea style={{...inp,height:75,resize:"vertical"}} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Brief description of what this award recognizes..." />
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:`1px solid ${C.navyBorder}` }}>
            <div>{isEdit&&<button onClick={()=>{ if(window.confirm("Delete this award?")) onDelete(award.id); }} style={{ background:"rgba(206,51,52,.12)",color:C.redLight,border:`1px solid rgba(206,51,52,.3)`,padding:"9px 14px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>🗑 Delete</button>}</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={onClose} style={{ background:C.navyMid,color:C.textDim,border:"none",padding:"9px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>Cancel</button>
              <button onClick={()=>{ if(form.name.trim()) onSave(form); }} style={{ background:C.red,color:"#fff",border:"none",padding:"9px 22px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer" }}>{isEdit?"Save Changes":"Log Award"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KEY DATE MODAL ───────────────────────────────────────────────────────────
function KeyDateModal({ kd, onSave, onDelete, onClose, isEdit, B }) {
  const [form, setForm] = useState(kd);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { fontSize:13, border:`1px solid ${C.navyBorder}`, borderRadius:8, padding:"9px 11px", width:"100%", background:C.navyMid, outline:"none", color:C.text };
  const lbl = { fontSize:11, fontWeight:600, color:C.textDim, display:"block", marginBottom:4 };
  const dateTypes = ["PRD / ETS / EAOS","EVAL / OPR / EPR Due","Advancement Exam","PFA / PT Test","Reenlistment Window","Promotion Board","School / Course Start","Deployment","PCS / Transfer","Custom"];

  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:460,maxHeight:"92vh",overflow:"auto",border:`1px solid ${C.navyBorder}` }}>
        <div style={{ background:C.navy,padding:"15px 18px",borderBottom:`1px solid ${C.navyBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>{isEdit?"Edit Key Date":"Add Key Date"}</div>
          <button onClick={onClose} style={{ background:C.navyMid,border:"none",color:C.textDim,width:30,height:30,borderRadius:"50%",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:18,display:"flex",flexDirection:"column",gap:13 }}>
          <div><label style={lbl}>Label *</label>
            <input style={inp} value={form.label} onChange={e=>set("label",e.target.value)} placeholder="e.g. PRD, E-7 Exam, PFA Window..." />
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div><label style={lbl}>Type</label>
              <select style={{...inp,cursor:"pointer"}} value={form.type} onChange={e=>set("type",e.target.value)}>
                {dateTypes.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Date *</label>
              <input style={inp} type="date" value={form.date} onChange={e=>set("date",e.target.value)} />
            </div>
          </div>
          <div><label style={lbl}>Notes (optional)</label>
            <textarea style={{...inp,height:60,resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any additional context..." />
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:`1px solid ${C.navyBorder}` }}>
            <div>{isEdit&&<button onClick={()=>{ if(window.confirm("Delete this date?")) onDelete(kd.id); }} style={{ background:"rgba(206,51,52,.12)",color:C.redLight,border:`1px solid rgba(206,51,52,.3)`,padding:"9px 14px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>🗑 Delete</button>}</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={onClose} style={{ background:C.navyMid,color:C.textDim,border:"none",padding:"9px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>Cancel</button>
              <button onClick={()=>{ if(form.label.trim()&&form.date) onSave(form); }} style={{ background:C.red,color:"#fff",border:"none",padding:"9px 22px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer" }}>{isEdit?"Save Changes":"Add Date"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── AI CAREER COACH CHAT ─────────────────────────────────────────────────────
function CoachChat({ messages, setMessages, input, setInput, loading, setLoading, tasks, goals, awards, profile, B, branch }) {
  const bottomRef = useRef();
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    if (!AI_ENABLED()) { setMessages(m=>[...m,{role:"assistant",content:"⚙️ AI features need an API key to work. Add your Anthropic API key to the ANTHROPIC_API_KEY constant at the top of App.tsx. Get a free key at console.anthropic.com"}]); setInput(""); return; }
    if (!navigator.onLine) { setMessages(m=>[...m,{role:"assistant",content:"📵 I need an internet connection to respond. Log your question and ask me when you're back online."}]); setInput(""); return; }
    const userMsg = {role:"user",content:input};
    setMessages(m=>[...m,userMsg]);
    setInput("");
    setLoading(true);
    const done = tasks.filter(t=>t.status==="Complete");
    const pieP = done.filter(t=>t.pie==="P").length;
    const pieI = done.filter(t=>t.pie==="I").length;
    const pieE = done.filter(t=>t.pie==="E").length;
    const systemPrompt = [
  `You are a highly experienced U.S. ${B.name} career coach and mentor with 20+ years of service. You help ${B.membersTitle} advance their careers, write better ${B.evalDoc} evaluations, prepare for promotion boards, and transition to civilian life.`,
  ``,
  `Member Profile:`,
  `- Branch: U.S. ${B.name}`,
  `- Name: ${profile.name||"Not set"}`,
  `- Paygrade: ${profile.paygrade||"Not set"}`,
  `- ${B.rankLabel}: ${profile.rate||"Not set"}`,
  `- Unit: ${profile.ship||"Not set"}`,
  `- Achievements logged: ${tasks.length} total, ${done.length} complete`,
  `- PIE balance: ${pieP} Performance / ${pieI} Self-Improvement / ${pieE} Exposure`,
  `- Goals: ${goals.length} set, ${goals.filter(g=>g.status==="Complete").length} complete`,
  `- Awards: ${awards.length} logged`,
  ``,
  `Be direct, practical, and speak like a trusted senior mentor — not a textbook. Use ${B.name}-specific terminology. Keep responses under 200 words unless asked for detail. Always be encouraging but honest.`
].join("\n");

    try {
      const history = messages.slice(-10).map(m=>({role:m.role,content:m.content}));
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:AI_HEADERS(),
        body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:systemPrompt,messages:[...history,userMsg]})
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "I couldn't generate a response. Please try again.";
      setMessages(m=>[...m,{role:"assistant",content:reply}]);
    } catch(e) {
      setMessages(m=>[...m,{role:"assistant",content:"Connection error. Check your internet and try again."}]);
    }
    setLoading(false);
  };

  const STARTERS = [
    `What should I focus on to get promoted to the next rank?`,
    `Review my PIE balance and tell me what's missing`,
    `How do I write a stronger ${B.evalDoc} bullet?`,
    `What should I be doing in the next 90 days for my career?`,
    `Help me prepare for a ${B.name} advancement board`,
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"calc(100vh - 180px)",minHeight:400 }}>
      {/* Header */}
      <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:14,border:`1px solid ${C.navyBorder}` }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>🤖 AI Career Coach</div>
        <div style={{ fontSize:12,color:C.textDim,marginTop:2 }}>Your personal {B.name} career mentor. Powered by Claude AI — requires internet.</div>
      </div>

      {/* Messages */}
      <div style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,marginBottom:14,paddingRight:4 }}>
        {messages.length===0&&(
          <div>
            <div style={{ background:C.navyCard,borderRadius:12,padding:16,border:`1px solid ${C.navyBorder}`,marginBottom:14 }}>
              <div style={{ fontSize:22,marginBottom:8 }}>👋</div>
              <div style={{ fontSize:14,color:C.text,fontWeight:600,marginBottom:4 }}>I know your profile, your logged achievements, and your goals.</div>
              <div style={{ fontSize:13,color:C.textDim,lineHeight:1.6 }}>Ask me anything about your {B.name} career — promotions, evals, advancement strategy, transition planning, or what to focus on next.</div>
            </div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color:C.textDim,letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>Try asking:</div>
            <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
              {STARTERS.map((s,i)=>(
                <button key={i} onClick={()=>setInput(s)} style={{ background:C.navyMid,border:`1px solid ${C.navyBorder}`,borderRadius:9,padding:"10px 13px",textAlign:"left",fontSize:13,color:C.textDim,cursor:"pointer",transition:"all .15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.color=C.text;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.navyBorder;e.currentTarget.style.color=C.textDim;}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m,i)=>(
          <div key={i} style={{ display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            <div style={{ maxWidth:"85%",background:m.role==="user"?C.red:C.navyCard,borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",padding:"11px 14px",border:m.role==="user"?"none":`1px solid ${C.navyBorder}` }}>
              {m.role==="assistant"&&<div style={{ fontSize:10,color:C.textFaint,marginBottom:5,fontWeight:600,letterSpacing:.5 }}>AI COACH</div>}
              <div style={{ fontSize:13,color:C.text,lineHeight:1.65,whiteSpace:"pre-wrap" }}>{m.content}</div>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{ display:"flex",justifyContent:"flex-start" }}>
            <div style={{ background:C.navyCard,borderRadius:"12px 12px 12px 4px",padding:"11px 16px",border:`1px solid ${C.navyBorder}`,display:"flex",gap:5,alignItems:"center" }}>
              {[0,1,2].map(i=><span key={i} style={{ width:7,height:7,borderRadius:"50%",background:C.textDim,animation:`pulse 1.4s ease ${i*0.2}s infinite`,display:"inline-block" }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display:"flex",gap:9,alignItems:"flex-end" }}>
        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }}
          placeholder="Ask your career coach anything..."
          style={{ flex:1,fontSize:13,border:`1px solid ${C.navyBorder}`,borderRadius:10,padding:"10px 13px",background:C.navyMid,outline:"none",color:C.text,resize:"none",height:46,lineHeight:1.5 }} />
        <button onClick={send} disabled={loading||!input.trim()} style={{ width:46,height:46,borderRadius:10,background:input.trim()&&!loading?C.red:"rgba(206,51,52,.3)",border:"none",color:"#fff",fontSize:20,cursor:input.trim()&&!loading?"pointer":"not-allowed",flexShrink:0 }}>↑</button>
      </div>
      {messages.length>0&&<button onClick={()=>setMessages([])} style={{ background:"none",border:"none",color:C.textFaint,fontSize:11,cursor:"pointer",marginTop:8,textAlign:"center" }}>Clear conversation</button>}
    </div>
  );
}

// ─── CAREER TIMELINE ──────────────────────────────────────────────────────────
function CareerTimeline({ tasks, goals, awards, keyDates, profile, B }) {
  const allEvents = [
    ...tasks.map(t=>({date:t.createdAt,type:"achievement",icon:"✅",title:t.name,sub:t.commandObjective||"",color:PIE[t.pie]?.color||C.blue,pie:t.pie})),
    ...goals.filter(g=>g.status==="Complete"&&g.completionDate).map(g=>({date:g.completionDate,type:"goal",icon:"🎯",title:g.goal,sub:"Goal completed",color:C.green})),
    ...goals.filter(g=>g.startDate).map(g=>({date:g.startDate,type:"goal-start",icon:"🎯",title:g.goal,sub:"Goal started",color:C.textDim})),
    ...awards.filter(a=>a.approvedDate).map(a=>({date:a.approvedDate,type:"award",icon:"🏆",title:a.name,sub:a.type,color:C.gold})),
    ...awards.filter(a=>a.submittedDate&&!a.approvedDate).map(a=>({date:a.submittedDate,type:"award-sub",icon:"📋",title:a.name,sub:"Nomination submitted",color:C.textDim})),
    ...keyDates.filter(d=>new Date(d.date)<=new Date()).map(d=>({date:d.date,type:"milestone",icon:"📅",title:d.label,sub:d.type,color:"#60A5FA"})),
  ].filter(e=>e.date).sort((a,b)=>new Date(b.date)-new Date(a.date));

  const byYear = allEvents.reduce((acc,e)=>{ const y=e.date?.slice(0,4)||"?"; if(!acc[y])acc[y]=[]; acc[y].push(e); return acc; },{});

  return (
    <div>
      <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:20,border:`1px solid ${C.navyBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8 }}>
        <div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>📈 Career Timeline</div>
          <div style={{ fontSize:12,color:C.textDim,marginTop:2 }}>Every achievement, award, goal, and milestone — your full military career story.</div>
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:C.red }}>{allEvents.length} <span style={{ fontSize:12,fontWeight:600,color:C.textFaint }}>events</span></div>
      </div>

      {allEvents.length===0?(
        <div style={{ background:C.navyCard,borderRadius:12,padding:"48px 20px",textAlign:"center",border:`1px solid ${C.navyBorder}` }}>
          <div style={{ fontSize:40,marginBottom:10 }}>📈</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:C.text,marginBottom:6 }}>Your timeline starts here</div>
          <div style={{ fontSize:13,color:C.textDim }}>Log achievements, complete goals, and track awards to build your career story.</div>
        </div>
      ):(
        Object.entries(byYear).sort((a,b)=>b[0]-a[0]).map(([year,events])=>(
          <div key={year} style={{ marginBottom:28 }}>
            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:C.text }}>{year}</div>
              <div style={{ height:1,flex:1,background:C.navyBorder }} />
              <span style={{ fontSize:11,color:C.textDim }}>{events.length} event{events.length!==1?"s":""}</span>
            </div>
            <div style={{ position:"relative",paddingLeft:24 }}>
              <div style={{ position:"absolute",left:8,top:0,bottom:0,width:2,background:C.navyBorder,borderRadius:2 }} />
              {events.map((e,i)=>(
                <div key={i} style={{ position:"relative",marginBottom:14 }}>
                  <div style={{ position:"absolute",left:-20,top:10,width:12,height:12,borderRadius:"50%",background:e.color,border:`2px solid ${C.navy}`,flexShrink:0 }} />
                  <div className="card-hover" style={{ background:C.navyCard,borderRadius:10,padding:"11px 14px",border:`1px solid ${C.navyBorder}`,cursor:"default" }}>
                    <div style={{ display:"flex",alignItems:"flex-start",gap:10 }}>
                      <span style={{ fontSize:16,flexShrink:0 }}>{e.icon}</span>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontWeight:600,fontSize:13,color:C.text,lineHeight:1.3 }}>{e.title}</div>
                        {e.sub&&<div style={{ fontSize:11,color:C.textDim,marginTop:2 }}>{e.sub}</div>}
                      </div>
                      <div style={{ fontSize:10,color:C.textFaint,flexShrink:0,marginTop:2 }}>{new Date(e.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── TRANSITION ASSISTANT ─────────────────────────────────────────────────────
function TransitionAssistant({ tasks, awards, goals, profile, branch, B }) {
  const [resumeOutput, setResumeOutput] = useState("");
  const [linkedinOutput, setLinkedinOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("resume");
  const [targetRole, setTargetRole] = useState("");
  const [copied, setCopied] = useState("");

  const generate = async (type) => {
    if (!AI_ENABLED()) { alert("⚙️ AI features need an API key. Add your Anthropic API key to ANTHROPIC_API_KEY at the top of App.tsx. Get a free key at console.anthropic.com"); return; }
    if (!navigator.onLine) { alert("Internet connection required for AI generation."); return; }
    setLoading(true);
    const done = tasks.filter(t=>t.status==="Complete");
    const achievementsList = done.map(t=>`- ${t.name}: ${t.impact||t.description||""}`).join("\n");
    const awardsList = awards.filter(a=>a.status==="Presented"||a.status==="Approved").map(a=>`- ${a.name} (${a.type})`).join("\n")||"None logged";
    const member = [profile.paygrade||"", profile.rate||"", profile.name||""].filter(Boolean).join(" ");

    const resumePrompt = [
      `You are an expert military-to-civilian career transition coach helping a U.S. ${B.name} ${B.memberTitle}.`,
      `Member: ${member||"Not specified"}`,
      `Target Role: ${targetRole||"General professional roles"}`,
      "",
      "Convert these military achievements into powerful civilian resume bullet points.",
      "Group them by skill area (Leadership, Operations, Analytics, Communication, etc).",
      "Also write a 3-sentence professional summary.",
      "Use civilian language — no military jargon.",
      "",
      "Military Achievements:",
      achievementsList||"No achievements logged yet",
      "",
      "Awards: " + awardsList,
    ].join("\n");

    const linkedinPrompt = [
      `You are a LinkedIn profile expert helping a U.S. ${B.name} ${B.memberTitle} transition to civilian work.`,
      `Member: ${member||"Not specified"}`,
      `Target Role: ${targetRole||"General professional roles"}`,
      "",
      "Write:",
      "1. A compelling LinkedIn headline (under 120 characters)",
      "2. An 'About' section (3-4 paragraphs, conversational, value-focused)",
      "3. 5 skill recommendations relevant to their target role",
      "",
      "Military Achievements to draw from:",
      achievementsList||"No achievements logged yet",
    ].join("\n");

    const prompt = type==="resume" ? resumePrompt : linkedinPrompt;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:AI_HEADERS(),
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000, messages:[{role:"user",content:prompt}] })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "Could not generate content.";
      if (type==="resume") setResumeOutput(text);
      else setLinkedinOutput(text);
    } catch(e) {
      const err = "Error generating content. Check your connection and try again.";
      if (type==="resume") setResumeOutput(err);
      else setLinkedinOutput(err);
    }
    setLoading(false);
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(()=>{ setCopied(key); setTimeout(()=>setCopied(""),2500); });
  };

  const inp = { fontSize:13,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"9px 11px",width:"100%",background:C.navyMid,outline:"none",color:C.text };

  return (
    <div>
      <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:18,border:`1px solid ${C.navyBorder}` }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>🎓 Transition Assistant</div>
        <div style={{ fontSize:12,color:C.textDim,marginTop:2 }}>Convert your {B.name} career into civilian resume bullets, LinkedIn profile, and more. Powered by AI.</div>
      </div>

      <div style={{ background:C.navyCard,borderRadius:12,padding:"16px 18px",marginBottom:18,border:`1px solid ${C.navyBorder}` }}>
        <label style={{ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:6 }}>Target Civilian Role (optional — improves results)</label>
        <input style={inp} value={targetRole} onChange={e=>setTargetRole(e.target.value)} placeholder="e.g. Project Manager, IT Director, Operations Manager, Logistics Coordinator..." />
      </div>

      {/* Section tabs */}
      <div style={{ display:"flex",gap:8,marginBottom:16 }}>
        {[["resume","📄 Resume Bullets"],["linkedin","💼 LinkedIn Profile"]].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveSection(k)} style={{ flex:1,padding:"10px",borderRadius:9,border:`1px solid ${activeSection===k?C.red:C.navyBorder}`,background:activeSection===k?"rgba(206,51,52,.15)":C.navyMid,color:activeSection===k?C.redLight:C.textDim,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      {activeSection==="resume"&&(
        <div>
          <button onClick={()=>generate("resume")} disabled={loading} style={{ width:"100%",padding:"12px",background:loading?"rgba(206,51,52,.4)":C.red,color:"#fff",border:"none",borderRadius:9,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:loading?"not-allowed":"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
            {loading?<><span className="spin" style={{ display:"inline-block",width:16,height:16,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%" }} />Generating...</>:"⚡ Generate Resume Bullets"}
          </button>
          {resumeOutput&&(
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:C.text }}>Your Civilian Resume Content:</div>
                <button onClick={()=>copy(resumeOutput,"resume")} style={{ background:copied==="resume"?"rgba(46,204,113,.2)":C.navyMid,color:copied==="resume"?C.green:C.textDim,border:`1px solid ${C.navyBorder}`,padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer" }}>{copied==="resume"?"✓ Copied!":"📋 Copy All"}</button>
              </div>
              <div style={{ background:C.navyMid,borderRadius:10,padding:"14px 16px",border:`1px solid ${C.navyBorder}`,fontSize:13,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:500,overflowY:"auto" }}>{resumeOutput}</div>
            </div>
          )}
          {!resumeOutput&&!loading&&(
            <div style={{ background:C.navyMid,borderRadius:10,padding:"32px 20px",textAlign:"center",border:`1px dashed ${C.navyBorder}` }}>
              <div style={{ fontSize:28,marginBottom:8 }}>📄</div>
              <div style={{ fontSize:13,color:C.textDim,lineHeight:1.6 }}>Your {tasks.filter(t=>t.status==="Complete").length} completed achievements will be translated into civilian resume bullets, grouped by skill area, with a professional summary.</div>
            </div>
          )}
        </div>
      )}

      {activeSection==="linkedin"&&(
        <div>
          <button onClick={()=>generate("linkedin")} disabled={loading} style={{ width:"100%",padding:"12px",background:loading?"rgba(62,137,255,.4)":C.blue,color:"#fff",border:"none",borderRadius:9,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:loading?"not-allowed":"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
            {loading?<><span className="spin" style={{ display:"inline-block",width:16,height:16,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%" }} />Generating...</>:"⚡ Generate LinkedIn Profile"}
          </button>
          {linkedinOutput&&(
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:C.text }}>Your LinkedIn Content:</div>
                <button onClick={()=>copy(linkedinOutput,"linkedin")} style={{ background:copied==="linkedin"?"rgba(46,204,113,.2)":C.navyMid,color:copied==="linkedin"?C.green:C.textDim,border:`1px solid ${C.navyBorder}`,padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer" }}>{copied==="linkedin"?"✓ Copied!":"📋 Copy All"}</button>
              </div>
              <div style={{ background:C.navyMid,borderRadius:10,padding:"14px 16px",border:`1px solid ${C.navyBorder}`,fontSize:13,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:500,overflowY:"auto" }}>{linkedinOutput}</div>
            </div>
          )}
          {!linkedinOutput&&!loading&&(
            <div style={{ background:C.navyMid,borderRadius:10,padding:"32px 20px",textAlign:"center",border:`1px dashed ${C.navyBorder}` }}>
              <div style={{ fontSize:28,marginBottom:8 }}>💼</div>
              <div style={{ fontSize:13,color:C.textDim,lineHeight:1.6 }}>Generate a LinkedIn headline, "About" section, and skill recommendations tailored to your target civilian role.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── PACKAGE BUILDER ─────────────────────────────────────────────────────────
function PackageBuilder({ tasks, awards, goals, profile, keyDates, B }) {
  const [packageType, setPackageType] = useState("advancement");
  const [output,      setOutput]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [copied,      setCopied]      = useState(false);

  const packageTypes = [
    { id:"advancement", label:"Advancement Package", icon:"⬆️", desc:"E-board / promotion package with all achievements, awards, and qualifications" },
    { id:"award",       label:"Award Nomination",    icon:"🏆", desc:"Formal award write-up pulling from your most impactful achievements" },
    { id:"special",     label:"Special Program",     icon:"🎓", desc:"STA-21, SEAP, Enlisted to Officer, or special duty application package" },
    { id:"frocking",    label:"Frocking / Selection", icon:"📋", desc:"Selection board package with complete career narrative" },
  ];

  const generate = async () => {
    const done = tasks.filter(t=>t.status==="Complete");
    if (!done.length) { alert("Log some completed achievements first!"); return; }
    if (!AI_ENABLED()) { alert("⚙️ AI features need an API key. Add your Anthropic API key to ANTHROPIC_API_KEY at the top of App.tsx. Get a free key at console.anthropic.com"); return; }
    if (!navigator.onLine) { alert("Internet connection required."); return; }
    setLoading(true); setOutput("");
    try {
      const sailor = [profile.paygrade, profile.rate, profile.name].filter(Boolean).join(" ");
      const topAch = done.slice(0,10).map((t,i)=>`${i+1}. ${t.name}${t.impact?" — "+t.impact:""}`).join("\n");
      const topAwards = awards.filter(a=>a.status==="Presented"||a.status==="Approved").map(a=>a.name).join(", ")||"None logged";
      const selectedPkg = packageTypes.find(p=>p.id===packageType);

      const promptLines = [
        `You are a military career expert helping a U.S. ${B.name} ${B.memberTitle} build a ${selectedPkg?.label||packageType}.`,
        `Member: ${sailor||"Not specified"} | Branch: U.S. ${B.name}`,
        "",
        "Top Achievements:",
        topAch,
        "",
        `Awards Received: ${topAwards}`,
        `Goals Completed: ${goals.filter(g=>g.status==="Complete").length}`,
        "",
        `Generate a complete, professional ${selectedPkg?.label} narrative. Include:`,
        "1. Opening leadership/character statement (3-4 sentences)",
        "2. Performance highlights with specific bullet points",
        "3. Awards and recognition summary",
        "4. Community/service contributions",
        "5. Closing recommendation statement",
        "",
        `Use proper ${B.evalDoc} language and ${B.name}-appropriate terminology. Be specific and compelling.`,
      ];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:AI_HEADERS(),
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1500, messages:[{role:"user",content:promptLines.join("\n")}] })
      });
      const data = await res.json();
      setOutput(data.content?.[0]?.text || "Could not generate package.");
    } catch(e) { setOutput("Error generating package. Check your connection."); }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(output).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2500); });
  };

  return (
    <div>
      <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"14px 16px",marginBottom:18,border:`1px solid ${C.navyBorder}` }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text,marginBottom:4 }}>📦 Package Builder</div>
        <div style={{ fontSize:12,color:C.textDim,lineHeight:1.6 }}>
          AI generates a complete career package from your logged achievements, awards, and goals. Requires internet. Always review for OPSEC before submitting.
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginBottom:20 }}>
        {packageTypes.map(p=>(
          <div key={p.id} onClick={()=>setPackageType(p.id)}
            style={{ background:packageType===p.id?"rgba(62,137,255,.15)":C.navyCard,borderRadius:11,padding:"14px 15px",cursor:"pointer",border:`1px solid ${packageType===p.id?"rgba(62,137,255,.5)":C.navyBorder}`,transition:"all .15s" }}>
            <div style={{ fontSize:22,marginBottom:6 }}>{p.icon}</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:C.text,marginBottom:3 }}>{p.label}</div>
            <div style={{ fontSize:11,color:C.textDim,lineHeight:1.5 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <button onClick={generate} disabled={loading} style={{ width:"100%",padding:"13px",background:loading?"rgba(62,137,255,.4)":C.blue,color:"#fff",border:"none",borderRadius:9,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,cursor:loading?"not-allowed":"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:9 }}>
        {loading?<><span className="spin" style={{ display:"inline-block",width:18,height:18,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%" }} /> Building your package...</>:`⚡ Generate ${packageTypes.find(p=>p.id===packageType)?.label}`}
      </button>

      {output&&(
        <div className="fade-up">
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text }}>Your Package:</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={copy} style={{ background:copied?"rgba(46,204,113,.2)":C.navyMid,color:copied?C.green:C.textDim,border:`1px solid ${C.navyBorder}`,padding:"6px 13px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer" }}>{copied?"✓ Copied!":"📋 Copy"}</button>
            </div>
          </div>
          <div style={{ background:C.navyMid,borderRadius:10,padding:"16px 18px",border:`1px solid ${C.navyBorder}`,fontSize:13,color:C.text,lineHeight:1.75,whiteSpace:"pre-wrap",maxHeight:600,overflowY:"auto" }}>{output}</div>
          <div style={{ marginTop:10,fontSize:11,color:C.gold,display:"flex",gap:6,alignItems:"flex-start" }}>
            <span>⚠️</span><span>Review carefully for OPSEC compliance and accuracy before submitting to your chain of command.</span>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── API KEY SETUP MODAL ──────────────────────────────────────────────────────
function ApiKeyModal({ onClose, onSave }) {
  const [key,     setKey]     = useState(localStorage.getItem("lb_apikey")||"");
  const [testing, setTesting] = useState(false);
  const [status,  setStatus]  = useState(""); // "ok" | "fail" | ""

  const test = async () => {
    if (!key.startsWith("sk-ant")) { setStatus("fail"); return; }
    setTesting(true); setStatus("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:10, messages:[{role:"user",content:"Hi"}] })
      });
      const data = await res.json();
      setStatus(data.content ? "ok" : "fail");
    } catch { setStatus("fail"); }
    setTesting(false);
  };

  const save = () => { if (key.startsWith("sk-ant")) { onSave(key); onClose(); } };

  const inp = { fontSize:13, border:`1px solid ${C.navyBorder}`, borderRadius:8, padding:"10px 12px", width:"100%", background:C.navyMid, outline:"none", color:C.text, fontFamily:"monospace" };

  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:500,border:`1px solid ${C.navyBorder}` }}>
        {/* Header */}
        <div style={{ background:C.navy,padding:"16px 20px",borderRadius:"16px 16px 0 0",borderBottom:`1px solid ${C.navyBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>🤖 Enable AI Features</div>
            <div style={{ fontSize:11,color:C.textFaint,marginTop:1 }}>Your key stays on your device only — never shared</div>
          </div>
          <button onClick={onClose} style={{ background:C.navyMid,border:"none",color:C.textDim,width:28,height:28,borderRadius:"50%",cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ padding:20,display:"flex",flexDirection:"column",gap:16 }}>
          {/* How to get a key */}
          <div style={{ background:"rgba(62,137,255,.08)",borderRadius:10,padding:"13px 15px",border:`1px solid rgba(62,137,255,.2)` }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#60A5FA",marginBottom:8 }}>HOW TO GET YOUR FREE KEY</div>
            {[
              "1. Go to console.anthropic.com",
              "2. Sign up for a free account",
              "3. Click 'API Keys' in the left sidebar",
              "4. Click 'Create Key' and copy it",
              "5. Paste it below — free tier gives you $5 credit",
            ].map((s,i)=>(
              <div key={i} style={{ fontSize:12,color:C.textDim,lineHeight:1.7 }}>{s}</div>
            ))}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
              style={{ display:"inline-block",marginTop:8,background:C.blue,color:"#fff",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:600,textDecoration:"none" }}>
              Open console.anthropic.com →
            </a>
          </div>

          {/* Key input */}
          <div>
            <label style={{ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:6 }}>Your Anthropic API Key</label>
            <input style={inp} value={key} onChange={e=>setKey(e.target.value.trim())} placeholder="sk-ant-api03-..." type="password" />
            <div style={{ fontSize:11,color:C.textFaint,marginTop:4 }}>
              🔒 Stored only in your browser. Never sent to LetsBrag servers.
            </div>
          </div>

          {/* Test result */}
          {status==="ok" && (
            <div style={{ background:"rgba(46,204,113,.12)",border:`1px solid rgba(46,204,113,.3)`,borderRadius:8,padding:"10px 13px",fontSize:13,color:C.green,display:"flex",alignItems:"center",gap:8 }}>
              ✅ Key works! AI features are ready to use.
            </div>
          )}
          {status==="fail" && (
            <div style={{ background:"rgba(206,51,52,.12)",border:`1px solid rgba(206,51,52,.3)`,borderRadius:8,padding:"10px 13px",fontSize:13,color:C.redLight,display:"flex",alignItems:"center",gap:8 }}>
              ❌ Key didn't work. Make sure you copied the full key starting with sk-ant-
            </div>
          )}

          {/* Privacy note */}
          <div style={{ background:"rgba(245,166,35,.08)",borderRadius:8,padding:"10px 13px",border:`1px solid rgba(245,166,35,.2)`,fontSize:11,color:C.gold,lineHeight:1.6 }}>
            <strong>Privacy:</strong> Your API key and all AI conversations go directly between your device and Anthropic. LetsBrag never sees your key or your conversations. Each user pays only for their own usage — typically less than $0.01 per conversation.
          </div>

          {/* Buttons */}
          <div style={{ display:"flex",gap:9,paddingTop:4,borderTop:`1px solid ${C.navyBorder}` }}>
            <button onClick={test} disabled={testing||!key} style={{ flex:1,padding:"10px",background:C.navyMid,color:C.textDim,border:`1px solid ${C.navyBorder}`,borderRadius:8,fontWeight:600,fontSize:13,cursor:key?"pointer":"not-allowed",opacity:key?1:.5 }}>
              {testing?<span style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><span className="spin" style={{ display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:C.textDim,borderRadius:"50%" }} />Testing...</span>:"Test Key"}
            </button>
            <button onClick={save} disabled={!key.startsWith("sk-ant")} style={{ flex:2,padding:"10px",background:key.startsWith("sk-ant")?C.red:"rgba(206,51,52,.3)",color:"#fff",border:"none",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:key.startsWith("sk-ant")?"pointer":"not-allowed" }}>
              Save & Enable AI
            </button>
          </div>

          {/* Remove key option */}
          {localStorage.getItem("lb_apikey")&&(
            <button onClick={()=>{ localStorage.removeItem("lb_apikey"); onSave(""); onClose(); }} style={{ background:"none",border:"none",color:C.textFaint,fontSize:11,cursor:"pointer",textAlign:"center",textDecoration:"underline" }}>
              Remove saved key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── ONBOARDING WIZARD ───────────────────────────────────────────────────────
function OnboardingWizard({ onComplete, B, setBranch }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [paygrade, setPaygrade] = useState("E-5");
  const [rate, setRate] = useState("");
  const [unit, setUnit] = useState("");

  const steps = [
    {
      icon:"👋",
      title:"Welcome to LetsBrag™",
      subtitle:"Your military career tracker",
      content: (
        <div>
          <div style={{ fontSize:13,color:C.textDim,lineHeight:1.8,marginBottom:20,textAlign:"center" }}>
            LetsBrag helps you track achievements, goals, and awards all year long — so when eval season hits, you're ready.<br/><br/>
            This quick setup takes <strong style={{ color:C.text }}>under 2 minutes.</strong>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:8 }}>
            {[["✅","Log wins daily"],["⭐","Build your brag doc"],["🤖","AI Coach — Coming Soon"]].map(([icon,label])=>(
              <div key={label} style={{ background:C.navyMid,borderRadius:10,padding:"12px 8px",textAlign:"center",border:`1px solid ${C.navyBorder}` }}>
                <div style={{ fontSize:22,marginBottom:6 }}>{icon}</div>
                <div style={{ fontSize:11,color:C.textDim,lineHeight:1.4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      icon:"🪖",
      title:"Select Your Branch",
      subtitle:"The app adapts to your service's language",
      content: (
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          {Object.entries(BRANCHES).map(([key,b])=>(
            <button key={key} onClick={()=>setBranch(key)}
              style={{ background:B.name===b.name?"rgba(206,51,52,.15)":C.navyMid,border:`1.5px solid ${B.name===b.name?C.red:C.navyBorder}`,borderRadius:11,padding:"14px 10px",cursor:"pointer",textAlign:"center",transition:"all .15s" }}>
              <div style={{ fontSize:26,marginBottom:5 }}>{b.emoji}</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:C.text }}>{b.name}</div>
              <div style={{ fontSize:10,color:C.textDim,marginTop:2 }}>{b.evalDoc}</div>
            </button>
          ))}
        </div>
      )
    },
    {
      icon:"👤",
      title:"Your Profile",
      subtitle:"Takes 30 seconds — helps personalize your experience",
      content: (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {[
            {label:"Your Name",val:name,set:setName,ph:"e.g. Jane Smith"},
            {label:`Paygrade`,val:paygrade,set:null,ph:""},
            {label:`${B.rankLabel||"Rate / MOS"}`,val:rate,set:setRate,ph:"e.g. IT, 11B, 0311..."},
            {label:`${B.unitLabel||"Ship / Unit"}`,val:unit,set:setUnit,ph:"e.g. USS Nimitz, 1st Cavalry..."},
          ].map(({label,val,set,ph})=>{
            const inp = { fontSize:13,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"9px 11px",width:"100%",background:C.navyMid,outline:"none",color:C.text,boxSizing:"border-box" };
            if (label==="Paygrade") return (
              <div key={label}>
                <label style={{ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 }}>{label}</label>
                <select style={{...inp,cursor:"pointer"}} value={paygrade} onChange={e=>setPaygrade(e.target.value)}>
                  {(B.paygrades||PAYGRADES).map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
            );
            return (
              <div key={label}>
                <label style={{ fontSize:11,fontWeight:600,color:C.textDim,display:"block",marginBottom:4 }}>{label} <span style={{ color:C.textFaint,fontWeight:400 }}>(optional)</span></label>
                <input style={inp} value={val} onChange={e=>set(e.target.value)} placeholder={ph} />
              </div>
            );
          })}
        </div>
      )
    },
    {
      icon:"🎯",
      title:"Your 3 Core Tabs",
      subtitle:`Built for the ${B.name} evaluation system`,
      content: (
        <div>

          {[
            ["✅","Achievements",`Log every win, qual, and contribution. Your ${B.evalDoc} is built from what you log here.`],
            ["🎯","Goals",`Set ${B.name}-specific career goals — promotions, qualifications, education milestones.`],
            ["⭐","Brag Doc",`Auto-organized by PIE category. Copy and give to your ${B.name==="Army"?"Rater":B.name==="Air Force"||B.name==="Space Force"?"supervisor":B.name==="Marines"?"Reporting Senior":"Chief/LPO"} before ${B.evalDoc} season.`],
          ].map(([icon,tab,desc])=>(
            <div key={tab} style={{ display:"flex",gap:12,alignItems:"flex-start",marginBottom:10,background:C.navyMid,borderRadius:10,padding:"11px 13px",border:`1px solid ${C.navyBorder}` }}>
              <span style={{ fontSize:20,flexShrink:0 }}>{icon}</span>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.text,marginBottom:2 }}>{tab}</div>
                <div style={{ fontSize:11,color:C.textDim,lineHeight:1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
          <div style={{ background:"rgba(46,204,113,.1)",borderRadius:9,padding:"9px 12px",border:`1px solid rgba(46,204,113,.2)`,fontSize:11,color:C.green,lineHeight:1.6 }}>
            💡 Tap the 🎙️ mic or the red + button to log wins in 10 seconds — right after they happen.
          </div>
        </div>
      )
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const canNext = step !== 1 || B.name; // branch step requires selection

  const handleNext = () => {
    if (isLast) {
      onComplete({ name, paygrade, rate, ship: unit, command:"", prd:"", bio:"" });
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:500,border:`1px solid ${C.navyBorder}`,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        {/* Progress dots */}
        <div style={{ display:"flex",justifyContent:"center",gap:8,padding:"16px 20px 0" }}>
          {steps.map((_,i)=>(
            <div key={i} style={{ width:i===step?24:8,height:8,borderRadius:99,background:i===step?C.red:i<step?"rgba(206,51,52,.4)":C.navyBorder,transition:"all .3s" }} />
          ))}
        </div>
        {/* Header */}
        <div style={{ padding:"16px 20px 0",textAlign:"center" }}>
          <div style={{ fontSize:36,marginBottom:8 }}>{current.icon}</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:C.text,marginBottom:4 }}>{current.title}</div>
          <div style={{ fontSize:12,color:C.textDim,marginBottom:16 }}>{current.subtitle}</div>
        </div>
        {/* Content */}
        <div style={{ padding:"0 20px 16px" }}>{current.content}</div>
        {/* Navigation */}
        <div style={{ padding:"14px 20px",borderTop:`1px solid ${C.navyBorder}`,display:"flex",gap:10 }}>
          {step > 0 && (
            <button onClick={()=>setStep(s=>s-1)} style={{ padding:"10px 16px",background:C.navyMid,color:C.textDim,border:"none",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>← Back</button>
          )}
          <button onClick={handleNext} disabled={!canNext}
            style={{ flex:1,padding:"12px",background:canNext?C.red:"rgba(206,51,52,.3)",color:"#fff",border:"none",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:canNext?"pointer":"not-allowed",transition:"background .2s" }}>
            {isLast ? "Let's Brag! 🚀" : "Next →"}
          </button>
        </div>
        <div style={{ textAlign:"center",padding:"0 20px 14px",fontSize:10,color:C.textFaint }}>
          Step {step+1} of {steps.length} · You can always access all features later
        </div>
      </div>
    </div>
  );
}

// ─── GOAL MODAL ───────────────────────────────────────────────────────────────
function GoalModal({ goal, onSave, onDelete, onClose, isEdit }) {
  const [form, setForm] = useState(goal);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { fontSize:13, border:`1px solid ${C.navyBorder}`, borderRadius:8, padding:"9px 11px", width:"100%", background:C.navyMid, outline:"none", color:C.text };
  const lbl = { fontSize:11, fontWeight:600, color:C.textDim, display:"block", marginBottom:4 };

  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:12 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.navyCard,borderRadius:16,width:"100%",maxWidth:500,maxHeight:"92vh",overflow:"auto",border:`1px solid ${C.navyBorder}` }}>
        <div style={{ background:C.navy,padding:"15px 18px",borderBottom:`1px solid ${C.navyBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text }}>{isEdit?"Edit Goal":"Add New Goal"}</div>
          <button onClick={onClose} style={{ background:C.navyMid,border:"none",color:C.textDim,width:30,height:30,borderRadius:"50%",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:18, display:"flex", flexDirection:"column", gap:13 }}>

          <div><label style={lbl}>Goal *</label>
            <input style={inp} value={form.goal} onChange={e=>set("goal",e.target.value)} placeholder="What do you want to achieve?" />
          </div>

          <div><label style={lbl}>Description</label>
            <textarea style={{...inp,height:80,resize:"vertical"}} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Why is this goal important? What does success look like?" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label style={lbl}>Priority</label>
              <select style={{...inp,cursor:"pointer"}} value={form.priority} onChange={e=>set("priority",e.target.value)}>
                {["High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Status</label>
              <select style={{...inp,cursor:"pointer"}} value={form.status} onChange={e=>set("status",e.target.value)}>
                {["Not Started","In Progress","Complete"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Start Date</label>
              <input style={inp} type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)} />
            </div>
            <div><label style={lbl}>Target Completion Date</label>
              <input style={inp} type="date" value={form.completionDate} onChange={e=>set("completionDate",e.target.value)} />
            </div>
          </div>

          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:`1px solid ${C.navyBorder}` }}>
            <div>{isEdit&&<button onClick={()=>{ if(window.confirm("Delete this goal?")) onDelete(goal.id); }} style={{ background:"rgba(206,51,52,.12)",color:C.redLight,border:`1px solid rgba(206,51,52,.3)`,padding:"9px 14px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>🗑 Delete</button>}</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={onClose} style={{ background:C.navyMid,color:C.textDim,border:"none",padding:"9px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>Cancel</button>
              <button onClick={()=>{ if(form.goal.trim()) onSave(form); }} style={{ background:C.red,color:"#fff",border:"none",padding:"9px 22px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer" }}>{isEdit?"Save Changes":"Add Goal"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── PAYWALL MODAL ────────────────────────────────────────────────────────────
function PaywallModal({ onSubscribe, onLogout, checkingOut, subBilling, setSubBilling }) {
  return (
    <div className="fade-in" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:C.navyCard,borderRadius:20,width:"100%",maxWidth:420,border:`1px solid ${C.navyBorder}`,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.6)" }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${C.red},#8B0000)`,padding:"28px 24px",textAlign:"center" }}>
          <div style={{ fontSize:48,marginBottom:8 }}>🎖️</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:"#fff",marginBottom:4 }}>Start Your Free Trial</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.8)",lineHeight:1.5 }}>7 days free — then just $4.99/month.<br/>Cancel anytime. No commitment.</div>
        </div>

        <div style={{ padding:"20px 24px" }}>
          {/* What you get */}
          <div style={{ marginBottom:18 }}>
            {[
              ["✅","Achievement Log","Log wins with voice dictation — takes 10 seconds"],
              ["🎯","Goals Tracker","Track career goals with deadlines and priorities"],
              ["⭐","Brag Doc Builder","Auto-organized by PIE, copy and give to your supervisor"],
              ["🏆","Awards Tracker","Track every award from nomination to presentation"],
              ["⏰","Key Dates","Never miss a PRD, eval deadline, or PFA window"],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:10 }}>
                <span style={{ fontSize:16,flexShrink:0,marginTop:1 }}>{icon}</span>
                <div>
                  <div style={{ fontSize:12,fontWeight:600,color:C.text }}>{title}</div>
                  <div style={{ fontSize:11,color:C.textDim,lineHeight:1.4 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Billing toggle */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14 }}>
            {[
              {billing:"monthly",label:"Monthly",price:"$4.99",sub:"/month"},
              {billing:"annual", label:"Annual", price:"$39.99",sub:"/year · save 33%",best:true},
            ].map(({billing,label,price,sub,best})=>(
              <div key={billing} onClick={()=>setSubBilling(billing)}
                style={{ background:subBilling===billing?"rgba(220,38,38,.12)":C.navyMid,borderRadius:10,padding:"12px",border:`1.5px solid ${subBilling===billing?C.red:C.navyBorder}`,cursor:"pointer",position:"relative",textAlign:"center" }}>
                {best&&<div style={{ position:"absolute",top:-9,left:"50%",transform:"translateX(-50%)",background:C.red,color:"#fff",borderRadius:99,padding:"1px 10px",fontSize:9,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,whiteSpace:"nowrap" }}>BEST VALUE</div>}
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.text,marginBottom:2 }}>{label}</div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:subBilling===billing?C.red:C.text }}>{price}</div>
                <div style={{ fontSize:10,color:C.textDim }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <button onClick={()=>onSubscribe(subBilling)} disabled={checkingOut}
            style={{ width:"100%",padding:"14px",background:checkingOut?"rgba(220,38,38,.4)":C.red,color:"#fff",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,cursor:checkingOut?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10 }}>
            {checkingOut
              ? <><span className="spin" style={{ display:"inline-block",width:18,height:18,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%" }} /> Opening Checkout...</>
              : <>🔒 Start 7-Day Free Trial →</>}
          </button>

          <div style={{ textAlign:"center",fontSize:10,color:C.textFaint,lineHeight:1.7,marginBottom:14 }}>
            You won't be charged until your trial ends.<br/>
            Secure checkout powered by Stripe. Cancel anytime.
          </div>

          <button onClick={onLogout} style={{ width:"100%",padding:"9px",background:"none",color:C.textFaint,border:`1px solid ${C.navyBorder}`,borderRadius:8,fontSize:12,cursor:"pointer" }}>
            Sign out
          </button>
        </div>

        <div style={{ padding:"12px 24px",borderTop:`1px solid ${C.navyBorder}`,textAlign:"center",fontSize:10,color:C.textFaint }}>
          © 2026 LetsBrag™ · Not an official DoD product · letsbrag.netlify.app
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onGoogleLogin, onDemo, loading }) {
  return (
    <div className="fade-in" style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,background:C.navy,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,backgroundImage:`radial-gradient(circle at 20% 20%, rgba(206,51,52,.08) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(62,137,255,.06) 0%, transparent 60%)`,pointerEvents:"none" }} />
      <div style={{ position:"absolute",fontSize:300,opacity:.03,userSelect:"none",pointerEvents:"none",lineHeight:1 }}>🎖️</div>
      <div style={{ position:"relative",textAlign:"center",maxWidth:380,width:"100%" }}>
        <div style={{ width:72,height:72,borderRadius:18,background:`linear-gradient(135deg,${C.red},#8B0000)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 20px",boxShadow:"0 8px 32px rgba(206,51,52,.4)" }}>🎖️</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:52,color:C.text,letterSpacing:-1,lineHeight:1 }}>LetsBrag™</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,fontSize:16,color:C.textDim,letterSpacing:3,textTransform:"uppercase",marginTop:4,marginBottom:8 }}>for U.S. Service Members</div>
        <div style={{ fontSize:14,color:C.textDim,lineHeight:1.7,marginBottom:32 }}>Your year-round military career tracker.<br/>Log wins. Track goals. Build your brag doc.<br/><span style={{ fontSize:12, color:C.textFaint }}>Navy · Army · Marines · Air Force · Space Force · Coast Guard</span></div>

        <button onClick={onGoogleLogin} disabled={loading} style={{ width:"100%",padding:"14px 20px",background:"#fff",color:"#111",border:"none",borderRadius:10,fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12,boxShadow:"0 4px 16px rgba(0,0,0,.3)",opacity:loading?0.7:1 }}>
          {loading?<span className="spin" style={{ display:"inline-block",width:18,height:18,border:"2px solid #ccc",borderTopColor:"#333",borderRadius:"50%" }} />
            :<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>}
          {loading?"Signing in...":"Continue with Google"}
        </button>

        <button onClick={onDemo} style={{ width:"100%",padding:"12px 20px",background:"transparent",color:C.textDim,border:`1px solid ${C.navyBorder}`,borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer",marginBottom:12 }}>Try Demo (no login)</button>
        <div style={{ fontSize:10,color:C.textFaint,textAlign:"center",marginBottom:16,lineHeight:1.6 }}>
          Demo mode stores data on this device only.<br/>Sign in with Google to protect your data.
        </div>

        <div style={{ fontSize:11,color:C.textFaint,lineHeight:1.6 }}>
          🔒 Secure sign-in via Google · Your data stays on your device<br/>
          Works offline after first login · All 6 branches supported
        </div>
        <div style={{ marginTop:18,paddingTop:14,borderTop:`1px solid ${C.navyBorder}`,fontSize:10,color:C.textFaint,lineHeight:1.7,textAlign:"center" }}>
          © 2026 LetsBrag™ · All Rights Reserved<br/>
          Unauthorized copying or distribution is prohibited.<br/>
          Not an official DoD product.
        </div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
// TABS are now rendered dynamically in App using branch config
// ─── SOFT LAUNCH: Basic tier only — AI tabs added in v2 ──────────────────────
const TABS=[
  {id:"overview",  icon:"📊", label:"Overview"},
  {id:"goals",     icon:"🎯", label:"Goals"},
  {id:"tasks",     icon:"✅", label:"Achievements"},
  {id:"byquarter", icon:"📅", label:"By Quarter"},
  {id:"brag",      icon:"⭐", label:"Brag Doc"},
  {id:"awards",    icon:"🏆", label:"Awards"},
  {id:"dates",     icon:"⏰", label:"Key Dates"},
  {id:"iloveme",   icon:"🎖️",  label:"I Love Me"},
  {id:"docs",      icon:"📂", label:"Career Docs"},
  {id:"profile",   icon:"👤", label:"Profile"},
  {id:"help",      icon:"❓", label:"Help"},
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [lastSynced,    setLastSynced]    = useState(null);
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [user,          setUser]          = useState(null);
  const [authLoading,   setAuthLoading]   = useState(false);
  const [loggedIn,      setLoggedIn]      = useLocalStorage("lb_loggedIn", false);
  const [tasks,         setTasks]         = useLocalStorage("lb_tasks",    []);
  const [profile,       setProfile]       = useLocalStorage("lb_profile",  EMPTY_PROFILE);
  const [ilovemeFiles,  setIlovemeFiles]  = useLocalStorage("lb_ilove",    []);
  const [docFiles,      setDocFiles]      = useLocalStorage("lb_docs",     []);
  const [appYear,       setAppYear]       = useLocalStorage("lb_year",     new Date().getFullYear());
  const [goals,         setGoals]         = useLocalStorage("lb_goals",    []);
  const [goalModal,     setGoalModal]     = useState(null);
  const [branch,        setBranch]        = useLocalStorage("lb_branch",   "");
  const [tosAck,        setTosAck]        = useLocalStorage("lb_tos",      false);
  // Subscription state — checks URL param on return from Stripe
  const [subscribed,   setSubscribed]   = useLocalStorage("lb_subscribed", false);
  const [subBilling,   setSubBilling]   = useLocalStorage("lb_billing",    "monthly");
  const [checkingOut,  setCheckingOut]  = useState(false);
  const currentTier = TIERS.basic;
  const canAccess = () => true;
  const setShowPricing = ()=>{};
  const setUpgradePrompt = ()=>{};
  const [onboarded,     setOnboarded]     = useLocalStorage("lb_onboarded", false);
  const [allTabs,       setAllTabs]       = useState(true); // Basic launch — all tabs visible
  const [opsecAck,      setOpsecAck]      = useLocalStorage("lb_opsec",    false);
  const B = branch && BRANCHES[branch] ? BRANCHES[branch] : BRANCHES.Navy;
  const [activeTab,     setActiveTab]     = useState("overview");
  const [modal,         setModal]         = useState(null);
  const [copied,        setCopied]        = useState(false);
  const [filters,       setFilters]       = useState({status:"All",pie:"All",quarter:"All"});
  const [keyDates,      setKeyDates]      = useLocalStorage("lb_keydates",  []);
  const [awards,        setAwards]        = useLocalStorage("lb_awards",    []);
  const [keyDateModal,  setKeyDateModal]  = useState(null);
  const [awardModal,    setAwardModal]    = useState(null);
  const [habitNudge,    setHabitNudge]    = useState(false);
  // AI features removed for soft launch — added in v2
  const setBulletModal  = ()=>{};
  const setShowApiSetup = ()=>{};
  const showApiSetup    = false;
  const saveApiKey      = ()=>{};
  const [darkMode, setDarkMode] = useLocalStorage("lb_dark", true);
  // Override color tokens based on mode — used throughout the app
  const C = darkMode ? {
    navy:"#0A1628", navyMid:"#111E35", navyCard:"#152240", navyBorder:"#1E3050",
    red:"#DC2626", redLight:"#EF4444", gold:"#F59E0B", blue:"#3E89FF", green:"#2ECC71",
    text:"#E8EDF5", textDim:"#8FA3BC", textFaint:"#3A4E68",
  } : {
    navy:"#F0F4FF", navyMid:"#E2E8F4", navyCard:"#FFFFFF", navyBorder:"#CBD5E8",
    red:"#DC2626", redLight:"#EF4444", gold:"#D97706", blue:"#2563EB", green:"#16A34A",
    text:"#0F172A", textDim:"#475569", textFaint:"#94A3B8",
  };

  // Sync CSS variables for dark/light mode
  useEffect(()=>{
    const r = document.documentElement.style;
    r.setProperty("--c-navy",     C.navy);
    r.setProperty("--c-navymid",  C.navyMid);
    r.setProperty("--c-navycard", C.navyCard);
    r.setProperty("--c-border",   C.navyBorder);
    r.setProperty("--c-text",     C.text);
    r.setProperty("--c-textdim",  C.textDim);
    r.setProperty("--c-red",      C.red);
    document.body.style.background = C.navy;
    document.body.style.color = C.text;
  },[darkMode]);

  // Init on mount — restore auth session if user was previously logged in
  useEffect(()=>{
    setFirebaseReady(true);
    // Restore Firebase auth session on page reload
    let unsubscribe = ()=>{};
    // Check if returning from Google redirect sign-in
    checkRedirectResult().then(result => {
      if (result?.user) {
        setUser(result.user);
        setLoggedIn(true);
        syncFromCloud(result.user);
      }
    });

    // Handle redirect result for mobile browsers
    loadFirebase().then(async (fb) => {
      if (!fb) return;
      try {
        const result = await fb.auth.getRedirectResult();
        if (result?.user) {
          setUser(result.user);
          setLoggedIn(true);
          syncFromCloud(result.user);
        }
      } catch(e) {
        console.warn("Redirect result error:", e);
      }
    });

    onAuthReady((u) => {
      if (u) {
        setUser(u);
        setLoggedIn(true);
        syncFromCloud(u);
        // Show paywall if not subscribed
        if (!subscribed) setShowPaywall(true);
      }
    }).then(unsub => {
      if (unsub) unsubscribe = unsub;
    });
    // Check if returning from Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") === "true") {
      setSubscribed(true);
      setShowPaywall(false);
      window.history.replaceState({}, "", APP_URL);
    }
    if (params.get("checkout") === "cancelled") {
      window.history.replaceState({}, "", APP_URL);
    }
    // Cleanup auth listener on unmount
    return () => unsubscribe();
  },[]);

  // Auto-save to Firestore when data changes (debounced via 3s delay)
  useEffect(()=>{
    if (!user?.uid || !loggedIn || !navigator.onLine) return;
    const timer = setTimeout(()=>{
      pushToCloud(user.uid);
    }, 3000); // 3 second debounce
    return () => clearTimeout(timer);
  },[tasks, goals, awards, keyDates, profile, branch, darkMode, subscribed]);

  // Habit nudge check
  useEffect(()=>{
    // Weekly habit nudge — check if no achievements logged in 7 days
    const stored = localStorage.getItem("lb_tasks");
    if (stored) {
      const t = JSON.parse(stored);
      if (t.length > 0) {
        const latest = t.reduce((a,b)=> new Date(a.createdAt||0) > new Date(b.createdAt||0) ? a : b);
        const daysSince = Math.ceil((new Date() - new Date(latest.createdAt||0)) / (1000*60*60*24));
        if (daysSince >= 7) setHabitNudge(true);
      }
    }
  },[tasks]);

  // Load and merge cloud data after login
  const syncFromCloud = async (u) => {
    if (!u || !navigator.onLine) return;
    setSyncing(true);
    try {
      const cloudData = await loadUserData(u.uid);
      if (cloudData) {
        if (cloudData.profile)      { setProfile(cloudData.profile);     localStorage.setItem("lb_profile",  JSON.stringify(cloudData.profile)); }
        if (cloudData.tasks)        { setTasks(cloudData.tasks);          localStorage.setItem("lb_tasks",    JSON.stringify(cloudData.tasks)); }
        if (cloudData.goals)        { setGoals(cloudData.goals);          localStorage.setItem("lb_goals",    JSON.stringify(cloudData.goals)); }
        if (cloudData.awards)       { setAwards(cloudData.awards);        localStorage.setItem("lb_awards",   JSON.stringify(cloudData.awards)); }
        if (cloudData.keyDates)     { setKeyDates(cloudData.keyDates);    localStorage.setItem("lb_keydates", JSON.stringify(cloudData.keyDates)); }
        if (cloudData.branch)       { setBranch(cloudData.branch);        localStorage.setItem("lb_branch",   JSON.stringify(cloudData.branch)); }
        if (cloudData.darkMode !== undefined) { setDarkMode(cloudData.darkMode); }
        if (cloudData.subscribed)   { setSubscribed(cloudData.subscribed); }
        // Record trial start date if first login
        if (!cloudData.trialStarted) {
          await saveUserData(u.uid, { trialStarted: new Date().toISOString() });
        }
        setLastSynced(new Date());
      } else {
        // First login ever — record trial start
        const firstLoginData = {
          trialStarted: new Date().toISOString(),
          email: u.email,
          displayName: u.displayName,
        };
        await saveUserData(u.uid, firstLoginData);
        await pushToCloud(u.uid);
      }
    } catch(e) {
      console.warn("Sync error:", e);
    }
    setSyncing(false);
  };

  // Push all local data up to Firestore
  const pushToCloud = async (uid) => {
    if (!uid || !navigator.onLine) return;
    try {
      await saveUserData(uid, {
        profile, tasks, goals, awards, keyDates,
        branch, darkMode, subscribed,
        email: user?.email || "",
        displayName: user?.displayName || "",
      });
      setLastSynced(new Date());
    } catch(e) {
      console.warn("Push error:", e);
    }
  };

  // Real Google login via Firebase Auth
  const handleGoogleLogin = async () => {
    if (!navigator.onLine) {
      alert("Internet connection required to sign in. The app works offline once you're logged in.");
      return;
    }
    setAuthLoading(true);
    try {
      const result = await signInWithGoogle();
      const u = result.user;
      setUser(u);
      setLoggedIn(true);
      // Sync cloud data — restores their profile across devices
      await syncFromCloud(u);
      // Show paywall if not subscribed
      if (!subscribed) setShowPaywall(true);
      // Pre-fill profile name if still empty after sync
      if (u.displayName && !profile.name) {
        const updated = {...profile, name: u.displayName};
        setProfile(updated);
        try { localStorage.setItem("lb_profile", JSON.stringify(updated)); } catch {}
      }
    } catch(e) {
      console.error("Auth error full:", e);
      if (e.code === "auth/popup-closed-by-user") {
        // silent
      } else if (e.code === "auth/popup-blocked") {
        alert("Popup blocked. Please allow popups for this site and try again.");
      } else if (e.code === "auth/network-request-failed") {
        alert("Network error. Check your connection and try again.");
      } else if (e.code === "auth/unauthorized-domain") {
        alert("Domain not authorized. Make sure letsbrag.netlify.app is in your Firebase authorized domains list.");
      } else if (e.code === "auth/cancelled-popup-request") {
        // silent — another popup opened
      } else if (e.code === "auth/internal-error") {
        alert("Firebase internal error. Check that Google Auth is enabled in your Firebase console and the support email is saved.");
      } else {
        alert("Sign in failed: " + (e.code || e.message || "Unknown error") + "\n\nPlease screenshot this and share it.");
      }
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    try { await signOutUser(); } catch {}
    setUser(null);
    setLoggedIn(false);
    // Clear sensitive state on logout
    setOnboarded(false);
    setOpsecAck(false);
    setTosAck(false);
  };


  const generateBragPDF = async () => {
    // Load jsPDF dynamically
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"letter" });

    const sailor  = [profile.paygrade, profile.rate, profile.name].filter(Boolean).join(" ");
    const ship    = [profile.ship, profile.command].filter(Boolean).join(" | ");
    const date    = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
    const doneT   = tasks.filter(t=>t.status==="Complete");

    // Color palette for each PIE section
    const PIE_COLORS = {
      P: { header:[124,99,255], light:[245,243,255], label:"PERFORMANCE",      subtitle:"Job Duties · Qualifications · Mission Impact" },
      I: { header:[62,137,255], light:[240,246,255], label:"SELF-IMPROVEMENT", subtitle:"Education · Advancement · Certifications" },
      E: { header:[46,204,113], light:[240,255,247], label:"EXPOSURE",         subtitle:"Awards · Boards · Volunteering · Visibility" },
    };

    const pageW = 215.9; // letter width mm
    const pageH = 279.4;
    const marginL = 18;
    const marginR = 18;
    const contentW = pageW - marginL - marginR;
    let y = 20;

    const checkPage = (needed=10) => {
      if (y + needed > pageH - 18) { doc.addPage(); y = 20; }
    };

    // ── HEADER ──────────────────────────────────────────────────────────────
    // Red top bar
    doc.setFillColor(220, 38, 38);
    doc.rect(0, 0, pageW, 12, "F");

    // App name
    doc.setFont("helvetica","bold");
    doc.setFontSize(22);
    doc.setTextColor(255,255,255);
    doc.text("LetsBrag™", marginL, 8.5);

    // Right side — branch
    doc.setFontSize(9);
    doc.setTextColor(255,255,255);
    doc.text(`U.S. ${B.name} ${B.emoji}`, pageW - marginR, 8.5, {align:"right"});

    y = 22;

    // Title
    doc.setFont("helvetica","bold");
    doc.setFontSize(18);
    doc.setTextColor(20,30,50);
    doc.text("BRAG SHEET", marginL, y);
    y += 7;

    // Member info block
    if (sailor) {
      doc.setFont("helvetica","normal");
      doc.setFontSize(10);
      doc.setTextColor(80,100,130);
      doc.text(sailor, marginL, y);
      y += 5;
    }
    if (ship) {
      doc.setFontSize(9);
      doc.text(ship, marginL, y);
      y += 5;
    }
    doc.setFontSize(9);
    doc.text(`Generated: ${date}`, marginL, y);
    y += 3;

    // Divider line
    doc.setDrawColor(220,38,38);
    doc.setLineWidth(0.8);
    doc.line(marginL, y, pageW-marginR, y);
    y += 8;

    // ── PIE SECTIONS ─────────────────────────────────────────────────────────
    const sections = [
      { key:"P", ...PIE_COLORS.P },
      { key:"I", ...PIE_COLORS.I },
      { key:"E", ...PIE_COLORS.E },
    ];

    for (const sec of sections) {
      const items = doneT.filter(t=>t.pie===sec.key);
      if (!items.length) continue;

      checkPage(20);

      // Section header bar
      doc.setFillColor(...sec.header);
      doc.roundedRect(marginL, y, contentW, 10, 2, 2, "F");
      doc.setFont("helvetica","bold");
      doc.setFontSize(11);
      doc.setTextColor(255,255,255);
      doc.text(sec.label, marginL+4, y+7);
      doc.setFont("helvetica","normal");
      doc.setFontSize(8);
      doc.setTextColor(255,255,255);
      doc.text(sec.subtitle, pageW-marginR-4, y+7, {align:"right"});
      y += 14;

      // Achievement cards
      for (let i=0; i<items.length; i++) {
        const task = items[i];

        // Estimate card height
        const descLines = task.description ? doc.splitTextToSize(task.description, contentW-12).length : 0;
        const impactLines = task.impact ? doc.splitTextToSize(task.impact, contentW-12).length : 0;
        const feedbackLines = task.feedback ? doc.splitTextToSize(task.feedback, contentW-12).length : 0;
        const cardH = 10 + (descLines*4.5) + (impactLines*4.5) + (feedbackLines*4.5) + (task.skills?.length?8:0) + 6;

        checkPage(cardH + 6);

        // Card background (light tint)
        doc.setFillColor(...sec.light);
        doc.roundedRect(marginL, y, contentW, cardH, 2, 2, "F");
        // Left accent bar
        doc.setFillColor(...sec.header);
        doc.rect(marginL, y, 3, cardH, "F");

        let cy = y + 7;

        // Achievement name
        doc.setFont("helvetica","bold");
        doc.setFontSize(10);
        doc.setTextColor(20,30,50);
        const nameLines = doc.splitTextToSize(task.name.toUpperCase(), contentW-16);
        doc.text(nameLines, marginL+7, cy);
        cy += nameLines.length * 5;

        // Meta row — quarter, eval period, priority
        const meta = [
          task.quarter && Q_SHORT[task.quarter]||task.quarter,
          task.evalPeriod,
          task.commandObjective,
          task.priority==="High"?"⚠ HIGH PRIORITY":null,
        ].filter(Boolean).join("  ·  ");
        if (meta) {
          doc.setFont("helvetica","normal");
          doc.setFontSize(7.5);
          doc.setTextColor(...sec.header);
          doc.text(meta, marginL+7, cy);
          cy += 5;
        }

        // Description
        if (task.description) {
          doc.setFont("helvetica","italic");
          doc.setFontSize(8.5);
          doc.setTextColor(80,90,110);
          const dLines = doc.splitTextToSize(task.description, contentW-12);
          doc.text(dLines, marginL+7, cy);
          cy += dLines.length * 4.5;
        }

        // Impact box
        if (task.impact) {
          cy += 2;
          doc.setFont("helvetica","bold");
          doc.setFontSize(7.5);
          doc.setTextColor(...sec.header);
          doc.text("MEASURABLE IMPACT:", marginL+7, cy);
          cy += 4;
          doc.setFont("helvetica","normal");
          doc.setFontSize(8.5);
          doc.setTextColor(20,30,50);
          const iLines = doc.splitTextToSize(task.impact, contentW-12);
          doc.text(iLines, marginL+7, cy);
          cy += iLines.length * 4.5;
        } else {
          cy += 2;
          doc.setFont("helvetica","bold");
          doc.setFontSize(8);
          doc.setTextColor(200,100,50);
          doc.text("[ADD QUANTIFIABLE IMPACT — numbers, %, $, timeframe]", marginL+7, cy);
          cy += 5;
        }

        // Feedback quote
        if (task.feedback) {
          cy += 1;
          doc.setFont("helvetica","italic");
          doc.setFontSize(8);
          doc.setTextColor(100,110,130);
          const fLines = doc.splitTextToSize(`"${task.feedback}"`, contentW-12);
          doc.text(fLines, marginL+7, cy);
          cy += fLines.length * 4.5;
        }

        // Skills
        if (task.skills?.length) {
          cy += 1;
          doc.setFont("helvetica","normal");
          doc.setFontSize(7.5);
          doc.setTextColor(120,130,150);
          doc.text(`Competencies: ${task.skills.join(" / ")}`, marginL+7, cy);
          cy += 4;
        }

        y += cardH + 5;
      }

      y += 4;
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    checkPage(16);
    doc.setFillColor(10,22,40);
    doc.rect(0, pageH-14, pageW, 14, "F");
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140,163,188);
    doc.text("© 2026 LetsBrag™  ·  All Rights Reserved  ·  Not an official DoD product  ·  letsbrag.netlify.app", pageW/2, pageH-7, {align:"center"});

    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i=1; i<=pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica","normal");
      doc.setFontSize(7.5);
      doc.setTextColor(140,163,188);
      doc.text(`Page ${i} of ${pageCount}`, pageW-marginR, pageH-7, {align:"right"});
    }

    // Save
    const filename = `LetsBrag_BragSheet_${sailor.replace(/\s+/g,"_")||"Export"}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
  };

  // Task CRUD
  const nextId    = ()=>Math.max(0,...tasks.map(t=>t.id||0))+1;
  const openAdd   = ()=>setModal({task:{...EMPTY_TASK,id:nextId()},isEdit:false});
  const openEdit  = t =>setModal({task:{...t},isEdit:true});
  const closeModal= ()=>setModal(null);
  const saveTask  = form=>{ modal.isEdit?setTasks(ts=>ts.map(t=>t.id===form.id?form:t)):setTasks(ts=>[...ts,form]); closeModal(); };
  const delTask   = id =>{ setTasks(ts=>ts.filter(t=>t.id!==id)); closeModal(); };
  const quickSave = form=>setTasks(ts=>[...ts,{...form,id:nextId()}]);

  const nextGoalId  = ()=>Math.max(0,...goals.map(g=>g.id||0))+1;
  const openAddGoal = ()=>setGoalModal({goal:{...EMPTY_GOAL,id:nextGoalId()},isEdit:false});
  const openEditGoal= g =>setGoalModal({goal:{...g},isEdit:true});
  const closeGoalModal=()=>setGoalModal(null);
  const saveGoal = form=>{ goalModal.isEdit?setGoals(gs=>gs.map(g=>g.id===form.id?form:g)):setGoals(gs=>[...gs,form]); closeGoalModal(); };
  const delGoal  = id =>{ setGoals(gs=>gs.filter(g=>g.id!==id)); closeGoalModal(); };

  // Awards CRUD
  const nextAwardId   = ()=>Math.max(0,...awards.map(a=>a.id||0))+1;
  const openAddAward  = ()=>setAwardModal({award:{id:0,name:"",type:"Achievement Medal",status:"Submitted",submittedDate:"",approvedDate:"",description:"",nominatedBy:""},isEdit:false});
  const openEditAward = a=>setAwardModal({award:{...a},isEdit:true});
  const closeAwardModal=()=>setAwardModal(null);
  const saveAward  = form=>{ awardModal.isEdit?setAwards(as=>as.map(a=>a.id===form.id?form:a)):setAwards(as=>[...as,{...form,id:nextAwardId()}]); closeAwardModal(); };
  const delAward   = id=>{ setAwards(as=>as.filter(a=>a.id!==id)); closeAwardModal(); };

  // Key Dates CRUD
  const nextDateId    = ()=>Math.max(0,...keyDates.map(d=>d.id||0))+1;
  const openAddDate   = ()=>setKeyDateModal({kd:{id:0,label:"",date:"",type:"Custom",notes:""},isEdit:false});
  const openEditDate  = d=>setKeyDateModal({kd:{...d},isEdit:true});
  const closeDateModal=()=>setKeyDateModal(null);
  const saveDate   = form=>{ keyDateModal.isEdit?setKeyDates(ds=>ds.map(d=>d.id===form.id?form:d)):setKeyDates(ds=>[...ds,{...form,id:nextDateId()}]); closeDateModal(); };
  const delDate    = id=>{ setKeyDates(ds=>ds.filter(d=>d.id!==id)); closeDateModal(); };

  const handleCheckout = async (billing) => {
    setCheckingOut(true);
    const priceId = billing==="annual" ? STRIPE_PRICES.annual : STRIPE_PRICES.monthly;
    try {
      await goToCheckout(priceId);
    } catch(e) {
      alert("Could not open checkout. Please check your connection and try again.");
    }
    setCheckingOut(false);
  };

  const copyBragDoc = () => {
    const sailor = [profile.paygrade, profile.rate, profile.name].filter(Boolean).join(" ");
    const ship   = [profile.ship, profile.command].filter(Boolean).join(" | ");
    const date   = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
    const doneT  = tasks.filter(t=>t.status==="Complete");
    const SEP    = "========================================================";
    const DIV    = "--------------------------------------------------------";
    const lines  = [];
    lines.push(SEP);
    lines.push("              LETSBRAG BRAG SHEET");
    lines.push(SEP);
    if (sailor) lines.push("Sailor : " + sailor);
    if (ship)   lines.push("Command: " + ship);
    lines.push("Date   : " + date);
    lines.push(SEP);
    lines.push("");
    const sections = [
      { key:"P", title:"PERFORMANCE",       subtitle:"Job Duties / Qualifications / Watch Standing / Mission Impact" },
      { key:"I", title:"SELF-IMPROVEMENT",  subtitle:"Education / Advancement / Certifications / Physical Readiness" },
      { key:"E", title:"EXPOSURE",          subtitle:"Awards / Boards / Volunteering / Cross-Functional Visibility" },
    ];
    sections.forEach(({ key, title, subtitle }) => {
      const items = doneT.filter(t => t.pie === key);
      if (!items.length) return;
      lines.push("");
      lines.push(DIV);
      lines.push("  " + title);
      lines.push("  " + subtitle);
      lines.push(DIV);
      lines.push("");
      items.forEach((t, i) => {
        lines.push((i+1) + ". " + t.name.toUpperCase());
        if (t.commandObjective) lines.push("   Objective  : " + t.commandObjective);
        if (t.quarter)          lines.push("   Quarter    : " + (Q_SHORT[t.quarter]||t.quarter) + "  |  EVAL Period: " + t.evalPeriod);
        if (t.visibility)       lines.push("   Visibility : " + t.visibility);
        if (t.description)      { lines.push(""); lines.push("   What I Did:"); lines.push("   " + t.description); }
        if (t.impact)           { lines.push(""); lines.push("   IMPACT:"); lines.push("   " + t.impact); }
        else                    { lines.push(""); lines.push("   IMPACT: [ADD NUMBERS HERE]"); }
        if (t.feedback)         { lines.push(""); lines.push("   Feedback:"); lines.push("   " + t.feedback); }
        if (t.skills && t.skills.length) { lines.push(""); lines.push("   Competencies: " + t.skills.join(" / ")); }
        if (t.requestor)        lines.push("   Validated by: " + t.requestor);
        lines.push("");
      });
    });
    lines.push("");
    lines.push(DIV);
    lines.push("Generated by LetsBrag | letsbrag.netlify.app");
    lines.push(DIV);
    const out = lines.join("\n");
    navigator.clipboard.writeText(out)
      .then(()=>{ setCopied(true); setTimeout(()=>setCopied(false), 2500); })
      .catch(()=>{ const ta=document.createElement("textarea"); ta.value=out; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setCopied(true); setTimeout(()=>setCopied(false),2500); });
  };

  const filtered=useMemo(()=>tasks.filter(t=>{ const qs=Q_SHORT[t.quarter]||t.quarter; if(filters.status!=="All"&&t.status!==filters.status)return false; if(filters.pie!=="All"&&t.pie!==filters.pie)return false; if(filters.quarter!=="All"&&qs!==filters.quarter)return false; return true; }),[tasks,filters]);

  const done=tasks.filter(t=>t.status==="Complete"), inProg=tasks.filter(t=>t.status==="In Progress");
  const withImpact=tasks.filter(t=>t.impact?.trim()), doneNoImpact=done.filter(t=>!t.impact?.trim());
  const total=tasks.length;
  const pieCount={P:tasks.filter(t=>t.pie==="P").length,I:tasks.filter(t=>t.pie==="I").length,E:tasks.filter(t=>t.pie==="E").length};
  const qData=QUARTERS.map(q=>({q:Q_SHORT[q]||q,total:tasks.filter(t=>t.quarter===q).length,done:tasks.filter(t=>t.quarter===q&&t.status==="Complete").length}));

  // Show TOS first
  if (!tosAck) return (
    <div><style>{FONTS+CSS}</style><TosModal onAccept={()=>setTosAck(true)} /></div>
  );

  // Show OPSEC second
  if (!opsecAck) return (
    <div><style>{FONTS+CSS}</style>
      <OpsecModal onAccept={()=>setOpsecAck(true)} />
    </div>
  );

  // Show login
  if (!loggedIn) return (
    <div><style>{FONTS+CSS}</style>
      <LoginScreen onGoogleLogin={handleGoogleLogin} onDemo={()=>setLoggedIn(true)} loading={authLoading} />
    </div>
  );

  // Show onboarding wizard for first-time users (after branch set)
  if (branch && !onboarded) return (
    <div><style>{FONTS+CSS}</style>
      <OnboardingWizard
        B={B} setBranch={setBranch}
        onComplete={(profileData)=>{
          if (profileData.name||profileData.rate||profileData.ship) setProfile(p=>({...p,...profileData}));
          setOnboarded(true);
        }} />
    </div>
  );

  // Show branch selection if not set
  if (!branch) return (
    <div><style>{FONTS+CSS}</style>
      <BranchModal onSelect={b=>{ setBranch(b); }} />
    </div>
  );

  const fsel={ fontSize:12,border:`1px solid ${C.navyBorder}`,borderRadius:8,padding:"7px 10px",background:C.navyMid,cursor:"pointer",outline:"none",color:C.text };

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif",background:C.navy,minHeight:"100vh",paddingBottom:80 }}>
      <style>{FONTS+CSS}</style>
      <OfflineBanner />
      {habitNudge&&loggedIn&&(
        <div style={{ background:"rgba(124,99,255,.15)",borderBottom:`1px solid rgba(124,99,255,.3)`,padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap" }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <span style={{ fontSize:18 }}>💡</span>
            <div>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#A78BFA" }}>Weekly Habit Check — </span>
              <span style={{ fontSize:12,color:C.textDim }}>You haven't logged an achievement in a while. What did you accomplish this week?</span>
            </div>
          </div>
          <div style={{ display:"flex",gap:8,flexShrink:0 }}>
            <button onClick={openAdd} style={{ background:"#A78BFA",color:"#000",border:"none",padding:"6px 13px",borderRadius:7,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>Log Now</button>
            <button onClick={()=>setHabitNudge(false)} style={{ background:"none",border:"none",color:C.textDim,fontSize:18,cursor:"pointer",padding:"0 4px" }}>✕</button>
          </div>
        </div>
      )}

      {/* NAV */}
      <div style={{ background:C.navyMid,borderBottom:`1px solid ${C.navyBorder}`,position:"sticky",top:0,zIndex:100 }}>
        <div style={{ padding:"12px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:34,height:34,borderRadius:8,background:`linear-gradient(135deg,${C.red},#8B0000)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{branch?B.emoji:"🎖️"}</div>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text,letterSpacing:-.5,lineHeight:1 }}>LetsBrag™ <span style={{ color:C.red,fontSize:14 }}>{appYear}</span></div>
              <div style={{ fontSize:10,color:C.textFaint,lineHeight:1,marginTop:1 }}>{B.emoji} U.S. {B.name}</div>
              {(user?.displayName||profile.name)&&<div style={{ fontSize:10,color:C.textFaint,lineHeight:1 }}>{profile.paygrade} {profile.rate} {(profile.name||user?.displayName||"").split(" ").slice(-1)[0]}</div>}
              <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:1 }}>
                <span style={{ background:"rgba(220,38,38,.15)",color:C.red,borderRadius:99,padding:"1px 7px",fontSize:9,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:.5,cursor:"pointer" }} onClick={()=>setShowPricing(true)}>
                  {subscribed ? "✅ BASIC" : "LetsBrag™"}
                </span>
                {user&&<span style={{ fontSize:9,color:syncing?"#F59E0B":lastSynced?C.green:C.textFaint,fontWeight:600 }}>
                  {syncing?"⟳ Syncing…":lastSynced?"✓ Synced":"○ Local"}
                </span>}
              </div>
            </div>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <button onClick={()=>setDarkMode(d=>!d)} title={darkMode?"Switch to Light Mode":"Switch to Dark Mode"} style={{ background:C.navyMid,border:`1px solid ${C.navyBorder}`,color:C.textDim,width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>{darkMode?"☀️":"🌙"}</button>
            <button onClick={openAdd} style={{ background:C.red,color:"#fff",border:"none",padding:"8px 14px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",whiteSpace:"nowrap" }}>+ Log Win</button>
          </div>
        </div>
        <div style={{ display:"flex",overflowX:"auto",padding:"8px 10px 0",gap:2,scrollbarWidth:"none" }}>
          {TABS.map(({id,icon,label})=>(
            <button key={id} onClick={()=>setActiveTab(id)}
              style={{ padding:"8px 12px",borderRadius:"7px 7px 0 0",border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,background:activeTab===id?C.navy:"transparent",color:activeTab===id?C.text:"rgba(122,143,168,.7)",whiteSpace:"nowrap",flexShrink:0,transition:"all .15s",display:"flex",alignItems:"center",gap:5,borderBottom:activeTab===id?`2px solid ${C.red}`:"2px solid transparent" }}>
              <span>{icon}</span><span className="tab-text">{label}</span>
            </button>
          ))}

        </div>
      </div>

      <div style={{ padding:"20px 18px" }}>

        {activeTab==="overview"&&<>
          {habitNudge&&(
            <div className="fade-up" style={{ background:"rgba(124,99,255,.12)",border:`1px solid rgba(124,99,255,.3)`,borderRadius:10,padding:"12px 16px",marginBottom:18,display:"flex",alignItems:"flex-start",gap:10 }}>
              <span style={{ fontSize:18,flexShrink:0 }}>💡</span>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:"#A78BFA",marginBottom:3 }}>You haven't logged anything in a while</div>
                <div style={{ fontSize:12,color:C.textDim,lineHeight:1.6 }}>What did you accomplish this week? Even small wins add up. Log something now while it's fresh — your future self will thank you at EVAL time.</div>
                <div style={{ display:"flex",gap:8,marginTop:10 }}>
                  <button onClick={()=>{ setActiveTab("tasks"); setTimeout(()=>{ const btn=document.querySelector("[data-quicklog]"); if(btn)btn.click(); },100); }} style={{ background:"#A78BFA",color:"#000",border:"none",padding:"7px 14px",borderRadius:7,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>+ Log a Win</button>
                  <button onClick={()=>setHabitNudge(false)} style={{ background:"none",border:`1px solid rgba(124,99,255,.3)`,color:"#A78BFA",padding:"7px 12px",borderRadius:7,fontSize:12,cursor:"pointer" }}>Dismiss</button>
                </div>
              </div>
            </div>
          )}
          {doneNoImpact.length>0&&<div className="fade-up" style={{ background:"rgba(245,166,35,.1)",border:`1px solid rgba(245,166,35,.25)`,borderRadius:10,padding:"11px 14px",marginBottom:18,display:"flex",alignItems:"flex-start",gap:9 }}><span style={{ fontSize:16,flexShrink:0 }}>⚠️</span><div style={{ fontSize:12,color:C.gold }}><strong>EVAL bullets need numbers — </strong>{doneNoImpact.length} completed achievement{doneNoImpact.length>1?"s":""} missing impact: <em>{doneNoImpact.map(t=>t.name).join(", ")}</em></div></div>}
          <div className="stat-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18 }}>
            {[
              {label:"Total Logged", value:total, sub:"all quarters", accent:C.red, tab:"tasks", filter:{status:"All",pie:"All",quarter:"All"}, delay:0},
              {label:"Complete", value:done.length, sub:`${total?Math.round(done.length/total*100):0}%`, accent:C.green, tab:"tasks", filter:{status:"Complete",pie:"All",quarter:"All"}, delay:60},
              {label:"In Progress", value:inProg.length, accent:C.blue, tab:"tasks", filter:{status:"In Progress",pie:"All",quarter:"All"}, delay:120},
              {label:"EVAL-Ready", value:withImpact.length, sub:"have #s", accent:"#A78BFA", tab:"brag", filter:null, delay:180},
            ].map(({label,value,sub,accent,tab,filter,delay})=>(
              <div key={label} className="fade-up" onClick={()=>{ setActiveTab(tab); if(filter) setFilters(filter); }}
                style={{ background:C.navyCard,borderRadius:12,padding:"16px 18px",borderTop:`3px solid ${accent}`,animationDelay:`${delay}ms`,cursor:"pointer",transition:"transform .15s,box-shadow .15s" }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 24px rgba(0,0,0,.3)`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:30,color:C.text,lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:12,color:C.textDim,marginTop:5 }}>{label}</div>
                {sub&&<div style={{ fontSize:11,color:C.textFaint,marginTop:2 }}>{sub}</div>}
                <div style={{ fontSize:10,color:accent,marginTop:6,fontWeight:600 }}>Tap to view →</div>
              </div>
            ))}
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
                <div style={{ fontSize:11,color:C.textDim,lineHeight:1.65 }}>{B.pieGuidance||"Aim for ~60% P, ~25% I, ~15% E. Your leadership looks at all three."}</div>

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
          {/* Goal Tracker Widget — progress bars only */}
          <div className="fade-up" style={{ background:C.navyCard,borderRadius:14,padding:"16px 18px",marginBottom:18,border:`1px solid ${C.navyBorder}`,animationDelay:"160ms" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text }}>🎯 Goal Tracker</div>
                <div style={{ fontSize:11,color:C.textFaint,marginTop:1 }}>
                  {goals.length===0 ? "No goals set yet" : `${goals.filter(g=>g.status==="Complete").length} of ${goals.length} goals complete`}
                </div>
              </div>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <button onClick={()=>setActiveTab("goals")} style={{ fontSize:11,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600 }}>View all →</button>
                <button onClick={openAddGoal} style={{ background:C.red,color:"#fff",border:"none",padding:"5px 11px",borderRadius:6,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer" }}>+ Add</button>
              </div>
            </div>

            {goals.length===0 ? (
              <div style={{ textAlign:"center",padding:"18px 0" }}>
                <div style={{ fontSize:28,marginBottom:8 }}>🎯</div>
                <div style={{ fontSize:12,color:C.textDim,marginBottom:12 }}>Set goals to track your career growth.</div>
                <button onClick={openAddGoal} style={{ background:C.red,color:"#fff",border:"none",padding:"8px 18px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>Set Your First Goal</button>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:11 }}>
                {/* Overall progress bar */}
                <div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                    <span style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>Overall Progress</span>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:C.green }}>
                      {Math.round((goals.filter(g=>g.status==="Complete").length/goals.length)*100)}%
                    </span>
                  </div>
                  <div style={{ background:C.navyBorder,borderRadius:99,height:10,overflow:"hidden" }}>
                    <div style={{ width:`${Math.round((goals.filter(g=>g.status==="Complete").length/goals.length)*100)}%`,height:"100%",background:`linear-gradient(90deg,${C.red},${C.green})`,borderRadius:99,transition:"width .6s ease" }} />
                  </div>
                </div>

                {/* Per-priority progress bars */}
                {["High","Medium","Low"].map(pri=>{
                  const pg   = goals.filter(g=>g.priority===pri);
                  if (!pg.length) return null;
                  const done = pg.filter(g=>g.status==="Complete").length;
                  const pct  = Math.round((done/pg.length)*100);
                  const color= pri==="High"?C.redLight:pri==="Medium"?C.gold:C.textDim;
                  const bar  = pri==="High"?C.red:pri==="Medium"?C.gold:"#7A8FA8";
                  const overdue = pg.filter(g=>g.completionDate&&g.status!=="Complete"&&new Date(g.completionDate)<new Date()).length;
                  return (
                    <div key={pri}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                          <span style={{ background:PRIORITY[pri]?.bg,color,borderRadius:99,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{pri}</span>
                          <span style={{ fontSize:11,color:C.textDim }}>{done}/{pg.length} done</span>
                          {overdue>0&&<span style={{ fontSize:10,color:C.redLight,fontWeight:600 }}>⚠ {overdue} overdue</span>}
                        </div>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color }}>{pct}%</span>
                      </div>
                      <div style={{ background:C.navyBorder,borderRadius:99,height:7,overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`,height:"100%",background:bar,borderRadius:99,transition:"width .6s ease" }} />
                      </div>
                    </div>
                  );
                })}

                {/* Status summary pills */}
                <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginTop:4 }}>
                  {[
                    {label:"Complete",   count:goals.filter(g=>g.status==="Complete").length,    bg:"rgba(46,204,113,.12)",  color:C.green},
                    {label:"In Progress",count:goals.filter(g=>g.status==="In Progress").length, bg:"rgba(62,137,255,.12)",  color:"#60A5FA"},
                    {label:"Not Started",count:goals.filter(g=>g.status==="Not Started").length, bg:"rgba(122,143,168,.1)",  color:C.textDim},
                    {label:"Overdue",    count:goals.filter(g=>g.completionDate&&g.status!=="Complete"&&new Date(g.completionDate)<new Date()).length, bg:"rgba(206,51,52,.1)", color:C.redLight},
                  ].filter(s=>s.count>0).map(s=>(
                    <div key={s.label} style={{ background:s.bg,borderRadius:99,padding:"4px 11px",fontSize:11,color:s.color,fontWeight:600 }}>{s.label}: {s.count}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {keyDates.length>0&&(()=>{
            const upcoming = [...keyDates].sort((a,b)=>new Date(a.date)-new Date(b.date)).filter(d=>new Date(d.date)>=new Date()).slice(0,3);
            if (!upcoming.length) return null;
            return <div className="fade-up" style={{ background:C.navyCard,borderRadius:14,padding:"16px 18px",marginBottom:18,border:`1px solid ${C.navyBorder}`,animationDelay:"160ms" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text }}>⏰ Upcoming Key Dates</div>
                <button onClick={()=>setActiveTab("dates")} style={{ fontSize:11,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600 }}>View all →</button>
              </div>
              <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                {upcoming.map(d=>{ const days=Math.ceil((new Date(d.date)-new Date())/(1000*60*60*24)); const color=days<=30?C.redLight:days<=90?C.gold:C.green; return (
                  <div key={d.id} style={{ background:C.navyMid,borderRadius:9,padding:"10px 14px",flex:1,minWidth:120,border:`1px solid ${days<=30?"rgba(206,51,52,.3)":days<=90?"rgba(245,166,35,.25)":"rgba(46,204,113,.2)"}` }}>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color,lineHeight:1 }}>{days===0?"TODAY":days}</div>
                    {days!==0&&<div style={{ fontSize:9,color,letterSpacing:.5,marginBottom:4 }}>DAYS</div>}
                    <div style={{ fontSize:12,color:C.text,fontWeight:600 }}>{d.label}</div>
                    <div style={{ fontSize:10,color:C.textFaint,marginTop:2 }}>{new Date(d.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                  </div>
                );})}
              </div>
            </div>;
          })()}
          <div className="three-col fade-up" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,animationDelay:"200ms" }}>
            {[
              {icon:"⭐",val:tasks.filter(t=>t.status==="Complete"&&t.priority==="High").length,lbl:"High-priority wins",accent:C.red,tab:"tasks",filter:{status:"Complete",pie:"All",quarter:"All"}},
              {icon:"🎯",val:goals.filter(g=>g.status==="Complete").length+"/"+goals.length,lbl:"Goals complete",accent:"#4ADE80",tab:"goals",filter:null},
              {icon:"🏆",val:awards.length,lbl:"Awards tracked",accent:C.gold,tab:"awards",filter:null},
              {icon:"⏰",val:keyDates.length,lbl:"Key dates",accent:"#60A5FA",tab:"dates",filter:null},
            ].map(({icon,val,lbl,accent,tab,filter})=>(
              <div key={lbl} onClick={()=>{ setActiveTab(tab); if(filter) setFilters(filter); }}
                style={{ background:C.navyCard,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.navyBorder}`,display:"flex",gap:12,alignItems:"center",cursor:"pointer",transition:"transform .15s" }}
                onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                <span style={{ fontSize:22 }}>{icon}</span>
                <div><div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:C.text }}>{val}</div><div style={{ fontSize:11,color:C.textDim }}>{lbl}</div></div>
              </div>
            ))}
          </div>
        </>}

        {activeTab==="tasks"&&<>
          {B.juniorEnlistedNote&&["E-1","E-2","E-3"].some(pg=>profile.paygrade?.startsWith(pg))&&(
            <div style={{ background:"rgba(245,166,35,.1)",borderRadius:10,padding:"11px 14px",marginBottom:14,border:`1px solid rgba(245,166,35,.25)`,display:"flex",gap:10,alignItems:"flex-start" }}>
              <span style={{ fontSize:16,flexShrink:0 }}>📋</span>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color:C.gold,marginBottom:3 }}>NOTE FOR JUNIOR ENLISTED — {B.name.toUpperCase()}</div>
                <div style={{ fontSize:11,color:C.textDim,lineHeight:1.6 }}>{B.juniorEnlistedNote}</div>
              </div>
            </div>
          )}
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

        {activeTab==="brag"&&<>
          {/* Header bar */}
          <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:18,border:`1px solid ${C.navyBorder}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text }}>{`Brag Doc — ${B.evalDoc} Ready ⭐`}</div>
                <div style={{ fontSize:12,color:C.textDim,marginTop:2 }}>{`Organized by PIE. Copy and give to your ${B.name==='Army'?'Rater':B.name==='Air Force'||B.name==='Space Force'?'supervisor':B.name==='Marines'?'Reporting Senior':'Chief/LPO'} before ${B.evalDoc} close-out.`}</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:C.red }}>{done.length} <span style={{ fontSize:12,fontWeight:600,color:C.textFaint }}>completed</span></div>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  <button onClick={copyBragDoc} style={{ background:copied?"rgba(46,204,113,.2)":C.red,color:copied?"#4ADE80":"#fff",border:copied?`1px solid rgba(46,204,113,.4)`:"none",padding:"10px 16px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:7,transition:"all .3s",whiteSpace:"nowrap" }}>
                    {copied ? "✓ Copied!" : "📋 Copy Text"}
                  </button>
                  <button onClick={generateBragPDF} style={{ background:"rgba(62,137,255,.15)",color:"#60A5FA",border:"1px solid rgba(62,137,255,.3)",padding:"10px 16px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap" }}>
                    📄 Export PDF
                  </button>
                </div>
              </div>
            </div>
            {done.length>0&&<div style={{ marginTop:12,padding:"9px 12px",background:"rgba(62,137,255,.08)",borderRadius:8,border:`1px solid rgba(62,137,255,.2)`,fontSize:11,color:"#60A5FA",lineHeight:1.6 }}>
              💡 <strong>How to use:</strong> Tap <strong>"Copy Full Brag Doc"</strong> → open an email or Word doc → paste. Organized by PIE category.
            </div>}
            <div style={{ marginTop:10,padding:"9px 12px",background:"rgba(245,166,35,.08)",borderRadius:8,border:`1px solid rgba(245,166,35,.25)`,fontSize:11,color:C.gold,lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start" }}>
              <span style={{ flexShrink:0 }}>⚠️</span>
              <span><strong>OPSEC Reminder:</strong> Before sharing, ensure no classified information, unit locations, deployment details, or sensitive operational data is included. When in doubt — leave it out.</span>
            </div>
          </div>

          {/* PIE sections */}
          {[
            { key:"P", title:"Performance",      subtitle:"Job Duties · Qualifications · Watch Standing · Mission Impact", color:"#A78BFA", bg:"rgba(124,99,255,.1)", border:"rgba(124,99,255,.3)" },
            { key:"I", title:"Self-Improvement", subtitle:"Education · Advancement · Certifications · Physical Readiness",  color:"#60A5FA", bg:"rgba(62,137,255,.1)",  border:"rgba(62,137,255,.3)"  },
            { key:"E", title:"Exposure",         subtitle:"Awards · Boards · Volunteering · Cross-Functional Visibility",   color:"#4ADE80", bg:"rgba(46,204,113,.1)", border:"rgba(46,204,113,.3)" },
          ].map(({ key, title, subtitle, color, bg, border })=>{
            const sec = done.filter(t=>t.pie===key);
            if (!sec.length) return null;
            return (
              <div key={key} style={{ marginBottom:28 }} className="fade-up">
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
                  <div style={{ background:bg,border:`1px solid ${border}`,borderRadius:10,padding:"8px 16px",display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color,letterSpacing:.5 }}>{key}</span>
                    <div>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color,lineHeight:1 }}>{title}</div>
                      <div style={{ fontSize:10,color:C.textDim,marginTop:2 }}>{subtitle}</div>
                    </div>
                  </div>
                  <div style={{ height:1,flex:1,background:border }} />
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color }}>{sec.length} achievement{sec.length!==1?"s":""}</span>
                </div>
                <div className="brag-grid" style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:13 }}>
                  {sec.map((task,i)=>{ const mi=!task.impact?.trim(); return(
                    <div key={task.id} onClick={()=>openEdit(task)} className="card-hover fade-up"
                      style={{ background:`linear-gradient(145deg,${C.navyCard},#0D1829)`,borderRadius:14,padding:18,cursor:"pointer",position:"relative",boxShadow:"0 4px 20px rgba(0,0,0,.25)",border:`1px solid ${mi?"rgba(245,166,35,.4)":C.navyBorder}`,animationDelay:`${i*40}ms` }}>
                      {mi&&<div style={{ position:"absolute",top:12,right:12,background:C.gold,color:"#000",borderRadius:99,padding:"2px 9px",fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700 }}>⚠ ADD NUMBERS</div>}
                      <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" }}>
                        <span style={{ background:"rgba(255,255,255,.05)",color:C.textDim,borderRadius:99,padding:"2px 8px",fontSize:10 }}>{Q_SHORT[task.quarter]||task.quarter}</span>
                        <span style={{ background:"rgba(255,255,255,.05)",color:C.textDim,borderRadius:99,padding:"2px 8px",fontSize:10 }}>{task.evalPeriod}</span>
                        {task.priority==="High"&&<span style={{ background:"rgba(206,51,52,.2)",color:C.redLight,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:600 }}>HIGH PRI</span>}
                      </div>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text,marginBottom:4,lineHeight:1.3 }}>{task.name}</div>
                      {task.commandObjective&&<div style={{ fontSize:10,color:C.textFaint,marginBottom:12,textTransform:"uppercase",letterSpacing:.5 }}>↳ {task.commandObjective}</div>}
                      {task.impact
                        ?<div style={{ background:"rgba(206,51,52,.1)",borderRadius:9,padding:"10px 12px",marginBottom:11,borderLeft:`3px solid ${C.red}` }}>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:9,color:C.redLight,marginBottom:3,letterSpacing:1 }}>MEASURABLE IMPACT</div>
                          <div style={{ fontSize:12,color:"rgba(232,237,245,.88)",lineHeight:1.6 }}>{task.impact}</div>
                        </div>
                        :<div style={{ background:"rgba(245,166,35,.08)",borderRadius:9,padding:"9px 12px",marginBottom:11,borderLeft:`3px solid ${C.gold}` }}>
                          <div style={{ fontSize:12,color:C.gold,fontStyle:"italic" }}>No numbers yet — tap to add.</div>
                        </div>
                      }
                      {task.feedback&&<div style={{ background:"rgba(255,255,255,.04)",borderRadius:9,padding:"9px 12px",marginBottom:10 }}><div style={{ fontSize:11,color:"rgba(232,237,245,.65)",lineHeight:1.55,fontStyle:"italic" }}>{task.feedback}</div></div>}
                      {task.skills?.length>0&&<div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:8 }}>{task.skills.map(s=><span key={s} style={{ background:"rgba(62,137,255,.15)",color:"#60A5FA",borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:600 }}>{s}</span>)}</div>}
                      {task.receipts?.length>0&&(
                        <div style={{ display:"flex",gap:6,marginTop:8,flexWrap:"wrap" }}>
                          {task.receipts.map(r=>(
                            <div key={r.id} onClick={e=>{e.stopPropagation(); if(r.dataUrl){const a=document.createElement("a");a.href=r.dataUrl;a.target="_blank";a.rel="noopener noreferrer";document.body.appendChild(a);a.click();document.body.removeChild(a);}}}
                              style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(62,137,255,.1)",borderRadius:6,padding:"3px 8px",cursor:"pointer",border:`1px solid rgba(62,137,255,.2)` }}>
                              <span style={{ fontSize:11 }}>{r.type?.startsWith("image/")?"🖼️":r.type==="application/pdf"?"📄":"📎"}</span>
                              <span style={{ fontSize:10,color:"#60A5FA",fontWeight:600,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
          {done.length===0&&<div style={{ textAlign:"center",padding:50,color:C.textDim,fontSize:13,background:C.navyCard,borderRadius:12,border:`1px solid ${C.navyBorder}` }}>
            <div style={{ fontSize:32,marginBottom:10 }}>⚓</div>
            No completed achievements yet.<br/>
            <span style={{ fontSize:12,color:C.textFaint }}>Mark achievements Complete to build your Brag Doc.</span>
          </div>}
        </>}


        {activeTab==="goals"&&<>
          <div className="fade-up" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10 }}>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:C.text }}>Goals 🎯</div>
              <div style={{ fontSize:12,color:C.textDim,marginTop:2 }}>Track your personal and professional goals. Link them to your achievements.</div>
            </div>
            <button onClick={openAddGoal} style={{ background:C.red,color:"#fff",border:"none",padding:"9px 18px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>+ Add Goal</button>
          </div>

          {/* Summary pills */}
          <div style={{ display:"flex",gap:10,marginBottom:20,flexWrap:"wrap" }}>
            {[
              ["All",goals.length,"rgba(122,143,168,.15)","#7A8FA8"],
              ["In Progress",goals.filter(g=>g.status==="In Progress").length,"rgba(62,137,255,.15)","#60A5FA"],
              ["Complete",goals.filter(g=>g.status==="Complete").length,"rgba(46,204,113,.15)","#4ADE80"],
              ["Not Started",goals.filter(g=>g.status==="Not Started").length,"rgba(122,143,168,.1)","#5A7080"],
            ].map(([lbl,cnt,bg,col])=>(
              <div key={lbl} style={{ background:bg,borderRadius:99,padding:"6px 14px",fontSize:12,color:col,fontWeight:600 }}>{lbl}: {cnt}</div>
            ))}
          </div>

          {goals.length===0 ? (
            <div style={{ background:C.navyCard,borderRadius:14,padding:"50px 20px",textAlign:"center",border:`1px solid ${C.navyBorder}` }}>
              <div style={{ fontSize:40,marginBottom:12 }}>🎯</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:C.text,marginBottom:6 }}>No goals yet</div>
              <div style={{ fontSize:13,color:C.textDim,marginBottom:18 }}>Set goals to track your growth throughout the year.</div>
              <button onClick={openAddGoal} style={{ background:C.red,color:"#fff",border:"none",padding:"10px 22px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>Add Your First Goal</button>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {["High","Medium","Low"].map(pri=>{
                const pg = goals.filter(g=>g.priority===pri);
                if (!pg.length) return null;
                return (
                  <div key={pri}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                      <span style={{ background:PRIORITY[pri]?.bg,color:PRIORITY[pri]?.color,borderRadius:99,padding:"3px 11px",fontSize:11,fontWeight:700 }}>{pri} Priority</span>
                      <div style={{ height:1,flex:1,background:C.navyBorder }} />
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                      {pg.map(g=>{
                        const done = g.status==="Complete";
                        const overdue = g.completionDate && !done && new Date(g.completionDate) < new Date();
                        return (
                          <div key={g.id} onClick={()=>openEditGoal(g)} className="card-hover fade-up"
                            style={{ background:C.navyCard,borderRadius:12,padding:"16px 18px",cursor:"pointer",border:`1px solid ${overdue?"rgba(206,51,52,.4)":done?"rgba(46,204,113,.3)":C.navyBorder}`,display:"flex",gap:14,alignItems:"flex-start" }}>
                            {/* Checkbox */}
                            <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${done?C.green:C.navyBorder}`,background:done?"rgba(46,204,113,.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2 }}>
                              {done&&<span style={{ color:C.green,fontSize:13 }}>✓</span>}
                            </div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap" }}>
                                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:done?C.textDim:C.text,textDecoration:done?"line-through":"none",lineHeight:1.3 }}>{g.goal}</div>
                                <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                                  {overdue&&<span style={{ background:"rgba(206,51,52,.15)",color:C.redLight,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:600 }}>OVERDUE</span>}
                                  <span style={{ background:done?"rgba(46,204,113,.12)":"rgba(62,137,255,.12)",color:done?"#4ADE80":"#60A5FA",borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:600 }}>{g.status}</span>
                                </div>
                              </div>
                              {g.description&&<div style={{ fontSize:12,color:C.textDim,marginTop:5,lineHeight:1.55 }}>{g.description}</div>}
                              <div style={{ display:"flex",gap:14,marginTop:8,flexWrap:"wrap" }}>
                                {g.startDate&&<div style={{ fontSize:11,color:C.textFaint }}>📅 Start: {new Date(g.startDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
                                {g.completionDate&&<div style={{ fontSize:11,color:overdue?C.redLight:C.textFaint }}>🏁 Target: {new Date(g.completionDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>}


        {activeTab==="awards"&&<>
          <div className="fade-up" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10 }}>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:C.text }}>Awards Tracker 🏆</div>
              <div style={{ fontSize:12,color:C.textDim,marginTop:2 }}>Track nominations, approvals, and formal recognition. Every award belongs in your official record.</div>
            </div>
            <button onClick={openAddAward} style={{ background:C.gold,color:"#000",border:"none",padding:"9px 18px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>+ Log Award</button>
          </div>

          {awards.length===0 ? (
            <div style={{ background:C.navyCard,borderRadius:14,padding:"50px 20px",textAlign:"center",border:`1px solid ${C.navyBorder}` }}>
              <div style={{ fontSize:40,marginBottom:12 }}>🏆</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:C.text,marginBottom:6 }}>No awards logged yet</div>
              <div style={{ fontSize:13,color:C.textDim,marginBottom:18 }}>Log every nomination, commendation, and formal recognition — even pending ones.</div>
              <button onClick={openAddAward} style={{ background:C.gold,color:"#000",border:"none",padding:"10px 22px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>Log First Award</button>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {["Presented","Approved","Submitted","Downgraded","Disapproved"].map(status=>{
                const aw = awards.filter(a=>a.status===status);
                if (!aw.length) return null;
                const statusColor = status==="Presented"?"#A78BFA":status==="Approved"?"#4ADE80":status==="Submitted"?"#60A5FA":status==="Downgraded"?C.gold:C.redLight;
                const statusBg = status==="Presented"?"rgba(124,99,255,.12)":status==="Approved"?"rgba(46,204,113,.12)":status==="Submitted"?"rgba(62,137,255,.12)":status==="Downgraded"?"rgba(245,166,35,.12)":"rgba(206,51,52,.12)";
                return (
                  <div key={status}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                      <span style={{ background:statusBg,color:statusColor,borderRadius:99,padding:"3px 11px",fontSize:11,fontWeight:700 }}>{status}</span>
                      <div style={{ height:1,flex:1,background:C.navyBorder }} />
                    </div>
                    {aw.map(a=>(
                      <div key={a.id} onClick={()=>openEditAward(a)} className="card-hover fade-up"
                        style={{ background:C.navyCard,borderRadius:12,padding:"15px 17px",cursor:"pointer",border:`1px solid ${C.navyBorder}`,marginBottom:10,display:"flex",gap:14,alignItems:"flex-start" }}>
                        <div style={{ fontSize:24,flexShrink:0 }}>🏆</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text,lineHeight:1.3,marginBottom:4 }}>{a.name}</div>
                          <div style={{ fontSize:11,color:C.textDim,marginBottom:6 }}>{a.type}</div>
                          {a.description&&<div style={{ fontSize:12,color:C.textDim,lineHeight:1.5,marginBottom:6 }}>{a.description}</div>}
                          <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                            {a.submittedDate&&<div style={{ fontSize:11,color:C.textFaint }}>📋 Submitted: {new Date(a.submittedDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
                            {a.approvedDate&&<div style={{ fontSize:11,color:C.textFaint }}>✅ {status==="Presented"?"Presented":"Approved"}: {new Date(a.approvedDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
                            {a.nominatedBy&&<div style={{ fontSize:11,color:C.textFaint }}>👤 By: {a.nominatedBy}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>}

        {activeTab==="dates"&&<>
          <div className="fade-up" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10 }}>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:C.text }}>Key Dates ⏰</div>
              <div style={{ fontSize:12,color:C.textDim,marginTop:2 }}>Track PRD, EVAL due dates, advancement exams, PFA windows, and more.</div>
            </div>
            <button onClick={openAddDate} style={{ background:C.red,color:"#fff",border:"none",padding:"9px 18px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>+ Add Date</button>
          </div>

          {keyDates.length===0 ? (
            <div style={{ background:C.navyCard,borderRadius:14,padding:"50px 20px",textAlign:"center",border:`1px solid ${C.navyBorder}` }}>
              <div style={{ fontSize:40,marginBottom:12 }}>⏰</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:C.text,marginBottom:6 }}>No key dates added</div>
              <div style={{ fontSize:13,color:C.textDim,marginBottom:18 }}>Add your PRD, next EVAL due date, advancement exam, PFA window, and other important milestones.</div>
              <button onClick={openAddDate} style={{ background:C.red,color:"#fff",border:"none",padding:"10px 22px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer" }}>Add First Date</button>
            </div>
          ) : (
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12 }}>
              {[...keyDates].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(d=>{
                const days = Math.ceil((new Date(d.date)-new Date())/(1000*60*60*24));
                const isPast = days < 0;
                const urgent = days >= 0 && days <= 30;
                const warning = days > 30 && days <= 90;
                const color = isPast ? C.textFaint : urgent ? C.redLight : warning ? C.gold : C.green;
                const bg = isPast ? "rgba(122,143,168,.08)" : urgent ? "rgba(206,51,52,.12)" : warning ? "rgba(245,166,35,.1)" : "rgba(46,204,113,.1)";
                const border = isPast ? C.navyBorder : urgent ? "rgba(206,51,52,.4)" : warning ? "rgba(245,166,35,.3)" : "rgba(46,204,113,.3)";
                return (
                  <div key={d.id} onClick={()=>openEditDate(d)} className="card-hover fade-up"
                    style={{ background:C.navyCard,borderRadius:12,padding:"16px 18px",cursor:"pointer",border:`1px solid ${border}` }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                      <div>
                        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.text }}>{d.label}</div>
                        <div style={{ fontSize:11,color:C.textDim,marginTop:2 }}>{d.type}</div>
                      </div>
                      <div style={{ background:bg,borderRadius:99,padding:"4px 10px",textAlign:"center",flexShrink:0 }}>
                        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color,lineHeight:1 }}>{isPast ? "PAST" : days===0 ? "TODAY" : days}</div>
                        {!isPast&&days!==0&&<div style={{ fontSize:9,color,letterSpacing:.5 }}>DAYS</div>}
                      </div>
                    </div>
                    <div style={{ fontSize:12,color:C.textDim }}>{new Date(d.date).toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric",year:"numeric"})}</div>
                    {d.notes&&<div style={{ fontSize:11,color:C.textFaint,marginTop:5 }}>{d.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </>}


        {(activeTab==="coach"||activeTab==="transition"||activeTab==="package")&&!AI_ENABLED()&&(
          <div className="fade-up" style={{ background:"rgba(124,99,255,.12)",border:`1px solid rgba(124,99,255,.3)`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap" }}>
            <div style={{ display:"flex",alignItems:"center",gap:9 }}>
              <span style={{ fontSize:18 }}>🤖</span>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,color:"#A78BFA" }}>AI Features Need a Free API Key</div>
                <div style={{ fontSize:12,color:C.textDim }}>Takes 2 minutes to set up. Each user uses their own free Anthropic key.</div>
              </div>
            </div>
            <button onClick={()=>setShowApiSetup(true)} style={{ background:"#A78BFA",color:"#000",border:"none",padding:"8px 16px",borderRadius:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap" }}>Set Up Free API Key →</button>
          </div>
        )}
        {activeTab==="coach"&&(
          <CoachChat
            messages={coachMessages} setMessages={setCoachMessages}
            input={coachInput} setInput={setCoachInput}
            loading={coachLoading} setLoading={setCoachLoading}
            tasks={tasks} goals={goals} awards={awards}
            profile={profile} B={B} branch={branch} />
        )}

        {activeTab==="timeline"&&(
          <CareerTimeline tasks={tasks} goals={goals} awards={awards} keyDates={keyDates} profile={profile} B={B} />
        )}

        {activeTab==="transition"&&(
          <TransitionAssistant tasks={tasks} awards={awards} goals={goals} profile={profile} branch={branch} B={B} />
        )}

        {activeTab==="package"&&(
          <PackageBuilder tasks={tasks} awards={awards} goals={goals} profile={profile} keyDates={keyDates} B={B} />
        )}

        {activeTab==="iloveme"&&<>
          <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:18,borderLeft:`3px solid ${C.red}`,border:`1px solid ${C.navyBorder}` }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text,marginBottom:2 }}>🎖️ I Love Me Book</div>
            <div style={{ fontSize:12,color:C.textDim,lineHeight:1.6 }}>Upload awards, commendation letters, ceremony photos, qual cards, and NEC certs. Everything in one place — for boards, packages, and your own pride.</div>
          </div>
          <FileGallery files={ilovemeFiles} setFiles={setIlovemeFiles} categories={B.iloveCats||ILOVE_CATS} emptyIcon="🎖️" emptyMsg="Upload your awards, certs, photos, and commendation letters here." />
        </>}

        {activeTab==="docs"&&<>
          <div className="fade-up" style={{ background:C.navyCard,borderRadius:12,padding:"13px 16px",marginBottom:18,borderLeft:`3px solid ${C.blue}`,border:`1px solid ${C.navyBorder}` }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text,marginBottom:2 }}>📂 Career Documents</div>
            <div style={{ fontSize:12,color:C.textDim,lineHeight:1.6 }}>Store your career roadmap, rate training manual, NAVADMINs, orders, transfer docs, personal statement, and anything you need on the go.</div>
          </div>
          <FileGallery files={docFiles} setFiles={setDocFiles} categories={B.docCats||DOC_CATS} emptyIcon="📂" emptyMsg="Upload your career roadmap, rate manual, orders, and important career documents." />
        </>}


        {activeTab==="help"&&(
          <div className="fade-up">
            <div style={{ background:C.navyCard,borderRadius:12,padding:"14px 16px",marginBottom:20,border:`1px solid ${C.navyBorder}` }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.text,marginBottom:2 }}>❓ Help & Reference</div>
              <div style={{ fontSize:12,color:C.textDim }}>Everything you need to know about using LetsBrag effectively.</div>
            </div>

            {[
              {
                section:"🚀 Getting Started",
                items:[
                  ["How do I log my first achievement?","Tap the ✅ Achievements tab → tap '+ Log Achievement' or use the red + button floating at the bottom right of any screen. You can type or tap the 🎙️ mic to speak your achievement."],
                  ["What is PIE?","PIE stands for Performance, Self-Improvement, and Exposure. P = your job duties and mission impact. I = education, certs, and personal growth. E = awards, boards, volunteering, and visibility. Aim for ~60% P, ~25% I, ~15% E."],
                  ["How do I add the app to my home screen?","iPhone: Open in Safari → tap Share ↑ → 'Add to Home Screen'. Android: Open in Chrome → tap ⋮ → 'Add to Home Screen'. It will appear like a real app icon."],
                  ["Does the app work offline?","Yes. Log achievements, goals, and dates with no internet. Your data saves to your device automatically."],
                ]
              },
              {
                section:"✅ Achievements",
                items:[
                  ["What should I log?","Anything that demonstrates your value — training you led, qualifications earned, problems you solved, collateral duties, community service, PT scores, boards you sat on, courses completed."],
                  ["What makes a strong impact statement?","Use numbers. 'Increased DC qual rate from 54% to 91% across 47 personnel in 8 weeks' is far stronger than 'improved DC training.' Always ask: how many? how fast? what % improvement? how much $$ saved?"],
                  ["What is Visibility?","How high up the chain of command knows about this achievement. Higher visibility = stronger eval impact."],
                  ["Can I use voice to log?","Yes — tap the 🎙️ mic button on any text field and speak. Works on Chrome (Android) and Safari (iOS)."],
                ]
              },
              {
                section:"⭐ Brag Doc",
                items:[
                  ["How do I share my Brag Doc?","Go to the ⭐ Brag Doc tab → tap 'Copy Full Brag Doc' → open an email or Word doc → paste. Your achievements are organized by PIE category."],
                  ["Why are some cards flagged with ⚠?","Those completed achievements are missing an impact statement with numbers. Tap the card to add quantifiable results — your supervisor needs these to write strong eval bullets."],
                  ["When should I share my Brag Doc?","Share it with your supervisor 2-4 weeks before your eval is due. Don't wait until they ask."],
                ]
              },
              {
                section:"🤖 AI Features",
                items:[
                  ["When will AI features be available?","AI-powered features — including the Career Coach, Eval Bullet Generator, Package Builder, and Transition Assistant — are coming in the next version of LetsBrag. You'll be notified when they launch."],
              [`How does the ${B.evalDoc} system work?`, B.evalSystem||"Select your branch in Profile to see your branch-specific evaluation system information."],
                  ["Is my data safe with the AI?","Yes. Your conversations go directly from your device to Anthropic using your own key. LetsBrag never sees your AI conversations or API key."],
                  ["What can I ask the AI Coach?","Anything about your career — 'What should I focus on for promotion?', 'Review my PIE balance', 'Help me prepare for a board', 'What does my eval score mean?'"],
                  ["Does AI work offline?","No. AI features require an internet connection. You can still log everything offline — generate AI bullets when back online."],
                ]
              },
              {
                section:"💾 Data & Privacy",
                items:[
                  ["Where is my data stored?","On your device only, in your browser's localStorage. Nothing is sent to LetsBrag servers."],
                  ["Why did my data disappear after refreshing?","This can happen if your browser cleared storage (private/incognito mode, browser settings, or storage full from large file uploads). Avoid using private/incognito mode for best results."],
                  ["Why can't I open an uploaded file?","Large files (over 2MB) may exceed browser storage limits and not persist after refreshing. Try re-uploading the file or use a compressed version."],
                  ["How do I change my branch?","Go to Profile tab → tap 'Change Branch' button."],
                ]
              },
              {
                section:"⚠️ OPSEC Reminders",
                items:[
                  ["What should I NEVER put in LetsBrag?","Classified information, specific unit locations, deployment destinations, operation names or dates, troop numbers, equipment quantities, or future mission plans."],
                  ["Is LetsBrag an official DoD app?","No. LetsBrag is an independent tool built to help service members. It is not affiliated with, endorsed by, or connected to the DoD or any military branch."],
                ]
              },
            ].map(({section, items})=>(
              <div key={section} style={{ background:C.navyCard,borderRadius:12,padding:"16px 18px",marginBottom:14,border:`1px solid ${C.navyBorder}` }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:C.text,marginBottom:12 }}>{section}</div>
                {items.map(([q,a],i)=>(
                  <div key={i} style={{ marginBottom:i<items.length-1?14:0,paddingBottom:i<items.length-1?14:0,borderBottom:i<items.length-1?`1px solid ${C.navyBorder}`:"none" }}>
                    <div style={{ fontWeight:600,fontSize:13,color:C.text,marginBottom:4 }}>{q}</div>
                    <div style={{ fontSize:12,color:C.textDim,lineHeight:1.7 }}>{a}</div>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ background:"rgba(124,99,255,.08)",borderRadius:12,padding:"16px 18px",border:`1px solid rgba(124,99,255,.2)`,marginBottom:14 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:"#A78BFA",marginBottom:10 }}>🚀 Coming in Version 2</div>
              {[
                ["🤖","AI Career Coach","Chat with an AI mentor who knows your branch, rank, and logged achievements."],
                ["⚡","AI Eval Bullet Generator","Type your achievement in plain English — AI rewrites it as a polished eval bullet."],
                ["📦","Package Builder","AI builds your advancement package, award nomination, or selection board package."],
                ["🎓","Transition Assistant","Translates your military career into a civilian resume and LinkedIn profile."],
                ["📈","Career Timeline","A visual year-by-year story of your full military career."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:10,paddingBottom:10,borderBottom:`1px solid rgba(124,99,255,.1)` }}>
                  <span style={{ fontSize:18,flexShrink:0 }}>{icon}</span>
                  <div><div style={{ fontSize:12,fontWeight:600,color:C.text,marginBottom:2 }}>{title}</div><div style={{ fontSize:11,color:C.textDim,lineHeight:1.5 }}>{desc}</div></div>
                </div>
              ))}
              <div style={{ fontSize:11,color:"#A78BFA",textAlign:"center",marginTop:4 }}>These features are being built now. You'll be notified when they launch.</div>
            </div>
            <div style={{ background:"rgba(62,137,255,.08)",borderRadius:12,padding:"14px 16px",border:`1px solid rgba(62,137,255,.2)`,textAlign:"center" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:"#60A5FA",marginBottom:4 }}>Still need help?</div>
              <div style={{ fontSize:12,color:C.textDim,lineHeight:1.6 }}>Visit <strong style={{ color:C.text }}>letsbrag.netlify.app</strong> on a desktop for the full experience.<br/>Your feedback makes LetsBrag™ better for every service member.</div>
            </div>
          </div>
        )}

        {activeTab==="profile"&&<ProfileScreen profile={profile} setProfile={setProfile} user={user} onLogout={handleLogout} appYear={appYear} setAppYear={setAppYear} B={B} onChangeBranch={()=>setBranch("")} apiEnabled={false} onOpenApiSetup={()=>{}} subscribed={subscribed} subBilling={subBilling} setSubBilling={setSubBilling} handleCheckout={handleCheckout} checkingOut={checkingOut} onSyncNow={()=>user?.uid&&pushToCloud(user.uid)} syncStatus={syncing?"syncing":lastSynced?"synced":"local"} />}

      </div>


      {/* ── FOOTER WATERMARK ── */}
      <div style={{ textAlign:"center",padding:"20px 16px 80px",marginTop:4 }}>
        <div style={{ display:"inline-flex",flexDirection:"column",alignItems:"center",gap:5 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:13 }}>🎖️</span>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,color:C.textFaint,letterSpacing:.5 }}>LetsBrag™</span>
            <span style={{ fontSize:13 }}>🎖️</span>
          </div>
          <div style={{ fontSize:10,color:C.textFaint,lineHeight:1.7,textAlign:"center" }}>
            © 2026 LetsBrag · All Rights Reserved<br/>
            Unauthorized copying or distribution is prohibited
          </div>
          <div style={{ fontSize:10,color:C.textFaint }}>Navy · Army · Marines · Air Force · Space Force · Coast Guard</div>
          <button onClick={()=>setTosAck(false)} style={{ background:"none",border:"none",color:C.textFaint,fontSize:10,cursor:"pointer",textDecoration:"underline",marginTop:2,padding:0 }}>
            View Terms of Service
          </button>
        </div>
      </div>
      {activeTab!=="profile"&&<QuickLog onSave={quickSave} />}
      {modal&&<AchModal task={modal.task} isEdit={modal.isEdit} onSave={saveTask} onDelete={delTask} onClose={closeModal} B={B} />}
      {goalModal&&<GoalModal goal={goalModal.goal} isEdit={goalModal.isEdit} onSave={saveGoal} onDelete={delGoal} onClose={closeGoalModal} />}
      {awardModal&&<AwardModal award={awardModal.award} isEdit={awardModal.isEdit} onSave={saveAward} onDelete={delAward} onClose={closeAwardModal} B={B} />}
      {keyDateModal&&<KeyDateModal kd={keyDateModal.kd} isEdit={keyDateModal.isEdit} onSave={saveDate} onDelete={delDate} onClose={closeDateModal} B={B} />}
      {/* AI modals — enabled in v2 */}
      {showPaywall&&!subscribed&&loggedIn&&<PaywallModal onSubscribe={handleCheckout} onLogout={handleLogout} checkingOut={checkingOut} subBilling={subBilling} setSubBilling={setSubBilling} />}
    </div>
  );
}