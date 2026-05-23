import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL   = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON  = import.meta.env.VITE_SUPABASE_ANON;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const supabase       = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const PARAMETERS = [
  { key:"empathy",          label:"Empathy",          icon:"🤝", desc:"Did the doctor show compassion, listen actively, and acknowledge patient concerns?" },
  { key:"clinical_accuracy",label:"Clinical Accuracy", icon:"🧠", desc:"Were diagnoses, medications, and medical advice accurate and evidence-based?" },
  { key:"communication",    label:"Communication",     icon:"💬", desc:"Was the doctor clear, free of jargon, and easy for the patient to understand?" },
  { key:"history_taking",   label:"History Taking",   icon:"📋", desc:"Did the doctor gather a thorough patient history including symptoms and past conditions?" },
  { key:"safety",           label:"Patient Safety",   icon:"🛡️", desc:"Were red flags, allergies, drug interactions, and contraindications properly addressed?" },
  { key:"followup",         label:"Follow-up Plan",   icon:"📅", desc:"Were next steps, referrals, and tests clearly communicated?" },
  { key:"patient_education",label:"Patient Education",icon:"📚", desc:"Did the doctor explain the diagnosis in a way the patient can act on?" },
  { key:"professionalism",  label:"Professionalism",  icon:"⚖️", desc:"Was the consultation respectful, within ethical standards, and professional?" },
];

const ROLES = [
  { id:"doctor", label:"Doctor",       icon:"⚕",  desc:"View your consultation scores",    color:"#0a6640", bg:"#e6f4ed" },
  { id:"owner",  label:"Clinic Owner", icon:"🏥", desc:"Manage your clinic's performance", color:"#1a4fa0", bg:"#e8eef8" },
  { id:"admin",  label:"Admin",        icon:"⚙",  desc:"Full platform access",             color:"#7a3800", bg:"#fdf0e6" },
];

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --green:#0a6640; --green-light:#e6f4ed; --light:#f7faf8; --white:#ffffff;
    --border:#dde8e2; --text:#0f1f16; --muted:#6b8070; --error:#c0392b;
    --amber:#b45309; --amber-bg:#fffbea;
  }
  body { background:var(--light); font-family:'DM Sans',sans-serif; color:var(--text); min-height:100vh; }
  input,button { font-family:'DM Sans',sans-serif; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes shake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes shimmer{ 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  .fade-up   { animation:fadeUp  0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .fade-in   { animation:fadeIn  0.35s ease both; }
  .shake     { animation:shake   0.4s ease; }
  .spinner   { width:34px;height:34px;border:3px solid #d1e8dc;border-top-color:var(--green);border-radius:50%;animation:spin 0.9s linear infinite; }
  .pulse-dot { width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 1.4s infinite; }
  .shimmer   { background:linear-gradient(90deg,#e8f0ec 25%,#f0f7f4 50%,#e8f0ec 75%);
               background-size:200% 100%;animation:shimmer 1.4s infinite; }
  .score-card{ transition:transform 0.18s,box-shadow 0.18s; }
  .score-card:hover{ transform:translateY(-2px);box-shadow:0 6px 20px rgba(10,102,64,0.1) !important; }
  .hist-row  { transition:background 0.12s; cursor:default; }
  .hist-row:hover { background:#f0f7f3 !important; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-thumb { background:var(--border);border-radius:2px; }
`;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const scoreColor = n => n>=8?"#0a6640":n>=6?"#b45309":"#c0392b";
const scoreBg    = n => n>=8?"#e6f4ed":n>=6?"#fffbea":"#fdf0f0";
const scoreLabel = n => n>=8?"Excellent":n>=6?"Good":n>=4?"Fair":"Needs work";

function fmt(iso, type="date") {
  if (!iso) return "";
  const d = new Date(iso);
  if (type==="date") return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
}

function download(content, name) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([content],{type:"text/plain"})),
    download: name || "transcript.txt",
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ─────────────────────────────────────────────────────────────
// GEMINI
// ─────────────────────────────────────────────────────────────
async function analyseWithGemini(transcript) {
  const paramList = PARAMETERS.map((p,i)=>`${i+1}. ${p.label}: ${p.desc}`).join("\n");
  const prompt = `You are an expert medical consultation quality reviewer.
Analyse the doctor-patient consultation transcript below and score it on each of these 8 parameters from 1 to 10.

${paramList}

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "overall_score": <1-100>,
  "summary": "<2-3 sentence overall assessment>",
  "parameters": {
    "empathy":           {"score":<1-10>,"feedback":"<one sentence>"},
    "clinical_accuracy": {"score":<1-10>,"feedback":"<one sentence>"},
    "communication":     {"score":<1-10>,"feedback":"<one sentence>"},
    "history_taking":    {"score":<1-10>,"feedback":"<one sentence>"},
    "safety":            {"score":<1-10>,"feedback":"<one sentence>"},
    "followup":          {"score":<1-10>,"feedback":"<one sentence>"},
    "patient_education": {"score":<1-10>,"feedback":"<one sentence>"},
    "professionalism":   {"score":<1-10>,"feedback":"<one sentence>"}
  },
  "strengths":    ["<strength 1>","<strength 2>"],
  "improvements": ["<improvement 1>","<improvement 2>"]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    { method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2}}) }
  );

  if (!res.ok) {
    const e = await res.json().catch(()=>({}));
    throw new Error(`Gemini error (${res.status}): ${e?.error?.message||"Unknown error"}`);
  }

  const data = await res.json();
  let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  raw = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
  try { return JSON.parse(raw); }
  catch { throw new Error(`Gemini returned invalid JSON. Try again.`); }
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: ErrorBanner
// ─────────────────────────────────────────────────────────────
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="fade-in" style={{padding:"10px 13px",borderRadius:9,background:"#fdf0f0",
      border:"1px solid #f5c6c6",fontSize:12,color:"var(--error)",
      display:"flex",alignItems:"flex-start",gap:9,marginBottom:12}}>
      <span style={{flexShrink:0}}>⚠️</span>
      <span style={{flex:1,lineHeight:1.5}}>{message}</span>
      {onDismiss&&<button onClick={onDismiss} style={{background:"none",border:"none",
        cursor:"pointer",color:"var(--error)",fontSize:15,flexShrink:0}}>×</button>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: ScoreGrid
// Shows average of all 8 parameters across all scored transcripts
// Refreshes automatically when refreshKey changes
// ─────────────────────────────────────────────────────────────
function ScoreGrid({ username, refreshKey }) {
  const [avgs,    setAvgs]    = useState({});
  const [overall, setOverall] = useState(null);
  const [count,   setCount]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true); setError("");
    try {
      const { data, error:err } = await supabase
        .from("consultations")
        .select("ai_feedback, overall_score")
        .eq("doctor_username", username)
        .eq("status", "scored");

      if (err) { setError(`Could not load scores: ${err.message}`); return; }

      const rows = data || [];
      if (rows.length === 0) { setAvgs({}); setOverall(null); setCount(0); return; }

      // Parse ai_feedback JSON for each row
      const parsed = rows.map(r => {
        try {
          return typeof r.ai_feedback==="string" ? JSON.parse(r.ai_feedback) : r.ai_feedback;
        } catch { return null; }
      }).filter(Boolean);

      // Average each parameter
      const computed = {};
      PARAMETERS.forEach(p => {
        const vals = parsed.map(d=>d?.parameters?.[p.key]?.score).filter(v=>v!=null&&!isNaN(v));
        computed[p.key] = vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : null;
      });

      // Overall average
      const ov = rows.map(r=>r.overall_score).filter(v=>v!=null);
      setAvgs(computed);
      setOverall(ov.length ? Math.round(ov.reduce((a,b)=>a+b,0)/ov.length) : null);
      setCount(rows.length);
    } catch(e) { setError(`Network error: ${e.message}`); }
    finally    { setLoading(false); }
  }, [username]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // ── Skeleton ──
  if (loading) return (
    <div style={{background:"var(--white)",borderRadius:14,border:"0.5px solid var(--border)",
      padding:"18px 20px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div className="shimmer" style={{width:160,height:11,borderRadius:6}}/>
        <div className="shimmer" style={{width:70,height:11,borderRadius:6}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {PARAMETERS.map(p=>(
          <div key={p.key} style={{background:"var(--light)",borderRadius:10,padding:"16px 12px",
            border:"0.5px solid var(--border)",textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:8,opacity:0.4}}>{p.icon}</div>
            <div className="shimmer" style={{width:"70%",height:9,borderRadius:5,margin:"0 auto 7px"}}/>
            <div className="shimmer" style={{width:"45%",height:20,borderRadius:5,margin:"0 auto 7px"}}/>
            <div className="shimmer" style={{width:"100%",height:4,borderRadius:99}}/>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div style={{background:"#fdf0f0",borderRadius:12,border:"1px solid #f5c6c6",
      padding:"12px 16px",marginBottom:14,fontSize:12,color:"var(--error)",
      display:"flex",alignItems:"center",gap:10}}>
      ⚠️ {error}
      <button onClick={load} style={{marginLeft:"auto",color:"var(--green)",background:"none",
        border:"none",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>Retry</button>
    </div>
  );

  // ── No data yet ──
  if (count === 0) return (
    <div style={{background:"var(--white)",borderRadius:14,border:"1px dashed var(--border)",
      padding:"16px 20px",marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",
        letterSpacing:"0.07em",marginBottom:12}}>Average Quality Scores</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {PARAMETERS.map(p=>(
          <div key={p.key} style={{background:"var(--light)",borderRadius:10,padding:"16px 12px",
            border:"0.5px solid var(--border)",textAlign:"center",opacity:0.55}}>
            <div style={{fontSize:20,marginBottom:6}}>{p.icon}</div>
            <div style={{fontSize:10,color:"var(--muted)",marginBottom:6,fontWeight:500}}>{p.label}</div>
            <div style={{fontSize:24,fontWeight:700,color:"var(--border)",
              fontFamily:"'Playfair Display',serif"}}>—</div>
            <div style={{fontSize:9,color:"var(--muted)",marginTop:4}}>no data</div>
          </div>
        ))}
      </div>
      <div style={{textAlign:"center",marginTop:12,fontSize:12,color:"var(--muted)"}}>
        Upload and analyse your first transcript to see averages here
      </div>
    </div>
  );

  // ── Grid with data ──
  return (
    <div className="fade-in" style={{background:"var(--white)",borderRadius:14,
      border:"0.5px solid var(--border)",
      boxShadow:"0 2px 16px rgba(10,102,64,0.06)",
      padding:"18px 20px",marginBottom:14}}>

      {/* Header row */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,fontWeight:600,color:"var(--muted)",
            textTransform:"uppercase",letterSpacing:"0.07em"}}>
            Average Quality Scores
          </span>
          <span style={{fontSize:11,color:"var(--muted)",background:"var(--light)",
            border:"0.5px solid var(--border)",padding:"2px 9px",borderRadius:20}}>
            {count} transcript{count!==1?"s":""}
          </span>
        </div>

        {/* Overall avg badge */}
        {overall!==null && (
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:"var(--muted)"}}>Overall avg</span>
            <div style={{width:44,height:44,borderRadius:"50%",
              background:scoreBg(overall/10),border:`2.5px solid ${scoreColor(overall/10)}`,
              display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
              <span style={{fontSize:15,fontWeight:700,color:scoreColor(overall/10),
                fontFamily:"'Playfair Display',serif",lineHeight:1}}>{overall}</span>
              <span style={{fontSize:8,color:"var(--muted)"}}>/ 100</span>
            </div>
          </div>
        )}
      </div>

      {/* 4 + 4 grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {PARAMETERS.map((p,i) => {
          const val    = avgs[p.key];
          const hasVal = val!=null;
          const col    = hasVal ? scoreColor(val) : "var(--muted)";
          const bg     = hasVal ? scoreBg(val)    : "var(--light)";

          return (
            <div key={p.key} className="score-card fade-in"
              style={{animationDelay:`${i*0.04}s`,background:"var(--light)",
                borderRadius:12,padding:"16px 12px",textAlign:"center",
                border:`0.5px solid ${hasVal?col+"33":"var(--border)"}`,
                boxShadow:"0 1px 6px rgba(0,0,0,0.04)",position:"relative",overflow:"hidden"}}>

              {/* Top accent */}
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,
                background:hasVal?`linear-gradient(90deg,${col}66,${col})`:"var(--border)",
                borderRadius:"12px 12px 0 0"}}/>

              {/* Icon */}
              <div style={{fontSize:22,marginTop:4,marginBottom:6}}>{p.icon}</div>

              {/* Parameter name */}
              <div style={{fontSize:10,fontWeight:600,color:"var(--muted)",
                lineHeight:1.3,marginBottom:8,letterSpacing:"0.01em"}}>
                {p.label}
              </div>

              {/* Score number */}
              <div style={{fontSize:26,fontWeight:700,color:col,
                fontFamily:"'Playfair Display',serif",lineHeight:1,marginBottom:2}}>
                {hasVal ? val : "—"}
              </div>
              <div style={{fontSize:9,color:"var(--muted)",marginBottom:8}}>
                {hasVal?"/ 10":"no data"}
              </div>

              {/* Progress bar */}
              <div style={{height:4,background:"#e8f0ec",borderRadius:99,overflow:"hidden",marginBottom:6}}>
                <div style={{height:"100%",width:hasVal?`${val*10}%`:"0%",
                  background:col,borderRadius:99,
                  transition:"width 1.2s cubic-bezier(0.22,1,0.36,1)"}}/>
              </div>

              {/* Label */}
              <div style={{fontSize:9,fontWeight:600,color:col,
                textTransform:"uppercase",letterSpacing:"0.05em"}}>
                {hasVal?scoreLabel(val):"–"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: HistoryPanel
// ─────────────────────────────────────────────────────────────
function HistoryPanel({ username, activeId, onViewAnalysis, onNewAnalysis, refreshKey }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true); setError("");
    try {
      const { data, error:err } = await supabase
        .from("consultations")
        .select("id,file_name,overall_score,status,uploaded_at,transcript,ai_feedback")
        .eq("doctor_username", username)
        .order("uploaded_at",{ascending:false})
        .limit(15);

      if (err) {
        const msgs = {
          "42P01": "Table 'consultations' not found. Run the Supabase SQL setup.",
          "PGRST301": "Permission denied. Check RLS policies in Supabase.",
          "PGRST125": "Invalid URL. Check VITE_SUPABASE_URL in Vercel env vars.",
        };
        setError(msgs[err.code] || `Supabase error (${err.code}): ${err.message}`);
        return;
      }
      setItems(data||[]);
    } catch(e) { setError(`Network error: ${e.message}`); }
    finally    { setLoading(false); }
  }, [username]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div style={{width:280,flexShrink:0,background:"var(--white)",border:"0.5px solid var(--border)",
      borderRadius:14,display:"flex",flexDirection:"column",overflow:"hidden",maxHeight:700}}>

      {/* Header */}
      <div style={{padding:"14px 14px 10px",borderBottom:"1px solid var(--border)"}}>
        <div style={{fontSize:12,fontWeight:600,marginBottom:1}}>📁 Recent Transcripts</div>
        <div style={{fontSize:10,color:"var(--muted)"}}>Last 15 uploads</div>
      </div>

      {/* New upload btn */}
      <div style={{padding:"9px 10px",borderBottom:"1px solid var(--border)"}}>
        <button onClick={onNewAnalysis}
          style={{width:"100%",padding:"8px",borderRadius:7,border:"none",
            background:"var(--green)",color:"#fff",fontSize:11,fontWeight:500,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          + Upload New Transcript
        </button>
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:"auto"}}>
        {loading && (
          <div style={{padding:"24px 14px",textAlign:"center"}}>
            <div className="spinner" style={{margin:"0 auto 10px"}}/>
            <div style={{fontSize:11,color:"var(--muted)"}}>Loading...</div>
          </div>
        )}

        {!loading && error && (
          <div style={{padding:"12px 10px"}}>
            <div style={{padding:"10px",borderRadius:8,background:"#fdf0f0",
              border:"1px solid #f5c6c6",fontSize:10,color:"var(--error)",lineHeight:1.5}}>
              ⚠️ {error}
              <button onClick={load} style={{display:"block",marginTop:6,fontSize:10,
                color:"var(--green)",background:"none",border:"none",
                cursor:"pointer",textDecoration:"underline"}}>Retry</button>
            </div>
          </div>
        )}

        {!loading && !error && items.length===0 && (
          <div style={{padding:"28px 14px",textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:8}}>📂</div>
            <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.6}}>
              No transcripts yet.<br/>Upload your first one!
            </div>
          </div>
        )}

        {!loading && !error && items.map(item => {
          const isActive = item.id===activeId;
          const hasScore = item.overall_score!=null;
          const isPending= ["analysing","pending"].includes(item.status);
          const isFailed = item.status==="error";

          return (
            <div key={item.id} className="hist-row"
              style={{padding:"11px 12px",borderBottom:"0.5px solid var(--border)",
                borderLeft:`3px solid ${isActive?"var(--green)":"transparent"}`,
                background:isActive?"var(--green-light)":"transparent"}}>

              <div style={{display:"flex",alignItems:"center",
                justifyContent:"space-between",marginBottom:3}}>
                <div style={{fontSize:11,fontWeight:500,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,paddingRight:6}}>
                  {item.file_name||"Untitled"}
                </div>
                {hasScore && (
                  <span style={{fontSize:10,fontWeight:700,color:scoreColor(item.overall_score/10),
                    background:scoreBg(item.overall_score/10),padding:"1px 6px",borderRadius:4,flexShrink:0}}>
                    {item.overall_score}
                  </span>
                )}
                {isPending && <span style={{fontSize:9,color:"var(--amber)",background:"var(--amber-bg)",
                  padding:"1px 6px",borderRadius:4,flexShrink:0}}>pending</span>}
                {isFailed  && <span style={{fontSize:9,color:"var(--error)",background:"#fdf0f0",
                  padding:"1px 6px",borderRadius:4,flexShrink:0}}>failed</span>}
              </div>

              <div style={{fontSize:9,color:"var(--muted)",marginBottom:8}}>
                {fmt(item.uploaded_at)} · {fmt(item.uploaded_at,"time")}
              </div>

              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>download(item.transcript,item.file_name)}
                  style={{flex:1,padding:"5px 0",borderRadius:6,border:"1px solid var(--border)",
                    background:"var(--light)",fontSize:10,cursor:"pointer",color:"var(--muted)",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:3}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="var(--green)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                  ⬇ Download
                </button>

                <button
                  disabled={!hasScore}
                  onClick={()=>{
                    if(!item.ai_feedback){
                      alert("No analysis found. This transcript may still be processing.");
                      return;
                    }
                    try {
                      const p = typeof item.ai_feedback==="string"
                        ? JSON.parse(item.ai_feedback) : item.ai_feedback;
                      onViewAnalysis(item,p);
                    } catch { alert("Could not load analysis. Data may be corrupted."); }
                  }}
                  style={{flex:1,padding:"5px 0",borderRadius:6,
                    border:`1px solid ${hasScore?"var(--green)":"var(--border)"}`,
                    background:hasScore?"var(--green-light)":"var(--light)",
                    fontSize:10,cursor:hasScore?"pointer":"not-allowed",
                    color:hasScore?"var(--green)":"var(--muted)",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:3,
                    opacity:hasScore?1:0.45}}
                  onMouseEnter={e=>{if(hasScore)e.currentTarget.style.background="#c8ead8";}}
                  onMouseLeave={e=>{if(hasScore)e.currentTarget.style.background="var(--green-light)";}}>
                  📊 Analysis
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!loading&&!error&&items.length>0&&(
        <div style={{padding:"7px 12px",borderTop:"1px solid var(--border)",
          fontSize:9,color:"var(--muted)",textAlign:"center"}}>
          {items.length} of last 15 · stored in Supabase
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: ResultsView
// ─────────────────────────────────────────────────────────────
function ResultsView({ result, fileName, savedId, onReset }) {
  const [showFeedback, setShowFeedback] = useState(false);
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:"var(--white)",borderRadius:14,border:"0.5px solid var(--border)",
        boxShadow:"0 2px 16px rgba(10,102,64,0.05)",padding:"20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:72,height:72,borderRadius:"50%",flexShrink:0,
            background:scoreBg(result.overall_score/10),
            border:`3px solid ${scoreColor(result.overall_score/10)}`,
            display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
            <span style={{fontSize:22,fontWeight:700,color:scoreColor(result.overall_score/10),
              fontFamily:"'Playfair Display',serif",lineHeight:1}}>{result.overall_score}</span>
            <span style={{fontSize:9,color:"var(--muted)"}}>/100</span>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>
              {fileName||"Analysis complete"} ✓
            </div>
            <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.6}}>{result.summary}</div>
            {savedId&&<div style={{marginTop:5,fontSize:10,color:"var(--green)"}}>
              ✓ Saved · averages updated above
            </div>}
          </div>
        </div>
      </div>

      <button onClick={()=>setShowFeedback(!showFeedback)}
        style={{width:"100%",padding:"12px",borderRadius:10,border:"none",
          background:"var(--green)",color:"#fff",fontSize:13,fontWeight:600,
          cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
        onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
        onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
        {showFeedback?"▲ Hide Detailed Feedback":"▼ View Detailed AI Feedback"}
      </button>

      {showFeedback&&(
        <div className="fade-in" style={{background:"var(--white)",borderRadius:14,
          border:"0.5px solid var(--border)",padding:"18px",
          display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",
            textTransform:"uppercase",letterSpacing:"0.07em"}}>
            Parameter Breakdown
          </div>

          {PARAMETERS.map(p=>{
            const pd=result.parameters?.[p.key];
            if(!pd) return null;
            return (
              <div key={p.key} style={{display:"flex",alignItems:"flex-start",gap:10,
                padding:"11px 12px",borderRadius:9,background:"var(--light)",
                border:"0.5px solid var(--border)"}}>
                <span style={{fontSize:16,marginTop:1,flexShrink:0}}>{p.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:500}}>{p.label}</span>
                    <span style={{fontSize:11,fontWeight:700,color:scoreColor(pd.score),
                      background:scoreBg(pd.score),padding:"1px 7px",borderRadius:4,flexShrink:0}}>
                      {pd.score}/10
                    </span>
                  </div>
                  <div style={{height:3,background:"#e8f0ec",borderRadius:2,marginBottom:5}}>
                    <div style={{height:"100%",width:`${pd.score*10}%`,
                      background:scoreColor(pd.score),borderRadius:2,transition:"width 0.8s ease"}}/>
                  </div>
                  <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.5}}>{pd.feedback}</div>
                </div>
              </div>
            );
          })}

          {result.strengths?.length>0&&(
            <div style={{padding:"12px",borderRadius:9,background:"#e6f4ed",border:"0.5px solid #b2ddc4"}}>
              <div style={{fontSize:10,fontWeight:600,color:"var(--green)",textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:7}}>✓ Strengths</div>
              {result.strengths.map((s,i)=>(
                <div key={i} style={{fontSize:12,color:"var(--text)",lineHeight:1.6,
                  paddingLeft:9,borderLeft:"2px solid var(--green)",
                  marginBottom:i<result.strengths.length-1?5:0}}>{s}</div>
              ))}
            </div>
          )}

          {result.improvements?.length>0&&(
            <div style={{padding:"12px",borderRadius:9,background:"var(--amber-bg)",border:"0.5px solid #f0d060"}}>
              <div style={{fontSize:10,fontWeight:600,color:"var(--amber)",textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:7}}>↑ Areas for Improvement</div>
              {result.improvements.map((s,i)=>(
                <div key={i} style={{fontSize:12,color:"var(--text)",lineHeight:1.6,
                  paddingLeft:9,borderLeft:"2px solid var(--amber)",
                  marginBottom:i<result.improvements.length-1?5:0}}>{s}</div>
              ))}
            </div>
          )}

          {onReset&&(
            <button onClick={onReset}
              style={{padding:"10px",borderRadius:8,border:"1px solid var(--border)",
                background:"var(--light)",fontSize:12,cursor:"pointer",
                color:"var(--muted)",fontFamily:"'DM Sans',sans-serif"}}>
              ← Analyse another transcript
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [step,        setStep]        = useState("role");
  const [role,        setRole]        = useState(null);
  const [username,    setUsername]    = useState("");
  const [password,    setPassword]    = useState("");
  const [loginErr,    setLoginErr]    = useState("");
  const [shake,       setShake]       = useState(false);
  const [loginLoad,   setLoginLoad]   = useState(false);

  // Upload/analysis
  const [uploadState, setUploadState] = useState("idle"); // idle|analysing|done|error
  const [transcript,  setTranscript]  = useState("");
  const [fileName,    setFileName]    = useState("");
  const [result,      setResult]      = useState(null);
  const [analysisErr, setAnalysisErr] = useState("");
  const [savedId,     setSavedId]     = useState(null);
  const [refreshKey,  setRefreshKey]  = useState(0);

  // History panel
  const [histActiveId, setHistActiveId] = useState(null);
  const [histResult,   setHistResult]   = useState(null);
  const [histFileName, setHistFileName] = useState("");

  const fileRef      = useRef();
  const selectedRole = ROLES.find(r=>r.id===role);

  // ── Handlers ──
  function triggerLoginError(msg) {
    setLoginErr(msg); setShake(true); setTimeout(()=>setShake(false),500);
  }

  function handleLogin(e) {
    e.preventDefault();
    if(!username.trim()){triggerLoginError("Please enter a username.");return;}
    if(!password.trim()){triggerLoginError("Please enter a password.");return;}
    setLoginLoad(true);
    setTimeout(()=>{setLoginLoad(false);setStep("dashboard");},800);
  }

  function handleSignOut() {
    setStep("role");setRole(null);setUsername("");setPassword("");setLoginErr("");
    resetUpload();
  }

  function handleFileChange(e) {
    const file=e.target.files?.[0];
    if(!file) return;
    if(!file.name.endsWith(".txt")){setAnalysisErr("❌ Please upload a .txt file only.");return;}
    setAnalysisErr("");setFileName(file.name);
    setHistActiveId(null);setHistResult(null);
    const reader=new FileReader();
    reader.onload=ev=>setTranscript(ev.target.result);
    reader.onerror=()=>setAnalysisErr("❌ Could not read file. Please try again.");
    reader.readAsText(file);
  }

  async function handleAnalyse() {
    if(!transcript.trim()){setAnalysisErr("❌ No transcript loaded. Upload a .txt file first.");return;}
    setUploadState("analysing");
    setAnalysisErr("");setResult(null);setSavedId(null);
    setHistActiveId(null);setHistResult(null);
    let dbId=null;

    try {
      // 1. Save to Supabase
      const {data,error:insErr}=await supabase
        .from("consultations")
        .insert({doctor_username:username,role,file_name:fileName,transcript,status:"analysing"})
        .select("id").single();
      if(insErr) console.warn(`DB insert warning (${insErr.code}):`,insErr.message);
      else { dbId=data?.id; setSavedId(dbId); }

      // 2. Analyse
      const analysis=await analyseWithGemini(transcript);
      setResult(analysis);

      // 3. Save score
      if(dbId){
        const {error:updErr}=await supabase
          .from("consultations")
          .update({overall_score:analysis.overall_score,ai_feedback:JSON.stringify(analysis),status:"scored"})
          .eq("id",dbId);
        if(updErr) console.warn(`Score save warning (${updErr.code}):`,updErr.message);
      }

      setUploadState("done");
      setRefreshKey(k=>k+1); // ← triggers ScoreGrid + HistoryPanel to refresh

    } catch(err) {
      console.error(err);
      setAnalysisErr(`❌ ${err.message}`);
      setUploadState("error");
      if(dbId) await supabase.from("consultations").update({status:"error"}).eq("id",dbId).catch(()=>{});
    }
  }

  function resetUpload() {
    setUploadState("idle");setTranscript("");setFileName("");
    setResult(null);setAnalysisErr("");setSavedId(null);
    setHistActiveId(null);setHistResult(null);
    if(fileRef.current) fileRef.current.value="";
  }

  function handleViewAnalysis(item,parsed) {
    setHistActiveId(item.id);setHistResult(parsed);setHistFileName(item.file_name||"Transcript");
    setUploadState("idle");setResult(null);
  }

  // ── Render ──
  return (
    <>
      <style>{CSS}</style>
      <div style={{position:"fixed",inset:0,zIndex:0,background:"var(--light)",
        backgroundImage:`radial-gradient(circle at 15% 15%,rgba(10,102,64,0.06) 0%,transparent 50%),
                         radial-gradient(circle at 85% 85%,rgba(10,102,64,0.04) 0%,transparent 50%)`}}/>

      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",padding:"32px 16px",position:"relative",zIndex:1}}>

        {/* Logo */}
        <div className="fade-up" style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:5}}>
            <div style={{width:34,height:34,borderRadius:9,background:"var(--green)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>⚕</div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,
              letterSpacing:"-0.01em"}}>DocRate</span>
          </div>
          <p style={{fontSize:11,color:"var(--muted)"}}>Healthcare consultation quality platform</p>
        </div>

        {/* ════ ROLE SELECTION ════ */}
        {step==="role"&&(
          <div className="fade-up" style={{animationDelay:"80ms",width:"100%",maxWidth:420}}>
            <div style={{background:"var(--white)",borderRadius:20,border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",overflow:"hidden"}}>
              <div style={{padding:"24px 24px 16px"}}>
                <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600,marginBottom:4}}>
                  Sign in to DocRate
                </h1>
                <p style={{fontSize:13,color:"var(--muted)"}}>Select your role to continue</p>
              </div>
              <div style={{padding:"0 16px 16px",display:"flex",flexDirection:"column",gap:9}}>
                {ROLES.map((r,i)=>(
                  <button key={r.id} className="fade-up"
                    onClick={()=>{setRole(r.id);setStep("login");setLoginErr("");}}
                    style={{animationDelay:`${120+i*60}ms`,display:"flex",alignItems:"center",gap:12,
                      padding:"14px 15px",borderRadius:11,border:`1px solid ${r.color}22`,
                      background:r.bg,cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=r.color+"55";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 14px ${r.color}14`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=r.color+"22";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                    <div style={{width:40,height:40,borderRadius:10,background:"#fff",
                      border:`1px solid ${r.color}22`,display:"flex",alignItems:"center",
                      justifyContent:"center",fontSize:18,flexShrink:0}}>{r.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:r.color,marginBottom:1}}>{r.label}</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>{r.desc}</div>
                    </div>
                    <div style={{color:r.color,fontSize:16,opacity:0.4}}>›</div>
                  </button>
                ))}
              </div>
              <div style={{margin:"0 16px 16px",padding:"9px 12px",borderRadius:8,
                background:"var(--amber-bg)",border:"1px solid #f0d060",fontSize:12,color:"var(--amber)"}}>
                🧪 <strong>Testing mode</strong> — any username and password will work
              </div>
            </div>
          </div>
        )}

        {/* ════ LOGIN ════ */}
        {step==="login"&&selectedRole&&(
          <div className={`fade-up ${shake?"shake":""}`} style={{width:"100%",maxWidth:390}}>
            <div style={{background:"var(--white)",borderRadius:20,border:"0.5px solid var(--border)",
              boxShadow:"0 4px 40px rgba(10,102,64,0.06)",overflow:"hidden"}}>
              <div style={{padding:"16px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <button onClick={()=>{setStep("role");setLoginErr("");}}
                  style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:13}}>← Back</button>
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:99,
                  background:selectedRole.bg,border:`1px solid ${selectedRole.color}22`}}>
                  <span>{selectedRole.icon}</span>
                  <span style={{fontSize:11,fontWeight:500,color:selectedRole.color}}>{selectedRole.label}</span>
                </div>
              </div>
              <div style={{padding:"14px 20px 4px"}}>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,marginBottom:3}}>Welcome back</h2>
                <p style={{fontSize:12,color:"var(--muted)"}}>Signing in as <strong>{selectedRole.label}</strong></p>
              </div>
              <form onSubmit={handleLogin} style={{padding:"12px 20px 20px",display:"flex",flexDirection:"column",gap:12}}>
                {[["Username","text",username,setUsername,"Enter any username"],
                  ["Password","password",password,setPassword,"Enter any password"]].map(([lbl,type,val,set,ph])=>(
                  <div key={lbl}>
                    <label style={{fontSize:11,fontWeight:500,color:"var(--muted)",display:"block",marginBottom:4}}>{lbl}</label>
                    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                      style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid var(--border)",
                        fontSize:13,outline:"none",background:"var(--light)",transition:"border 0.2s"}}
                      onFocus={e=>e.target.style.borderColor=selectedRole.color}
                      onBlur={e=>e.target.style.borderColor="var(--border)"}/>
                  </div>
                ))}
                <ErrorBanner message={loginErr} onDismiss={()=>setLoginErr("")}/>
                <div style={{padding:"8px 12px",borderRadius:8,background:"var(--amber-bg)",
                  border:"1px solid #f0d060",fontSize:11,color:"var(--amber)"}}>
                  🧪 Testing mode — any credentials work
                </div>
                <button type="submit" disabled={loginLoad}
                  style={{padding:"11px",borderRadius:9,border:"none",
                    background:loginLoad?"#a0c4b4":selectedRole.color,
                    color:"#fff",fontSize:13,fontWeight:500,
                    cursor:loginLoad?"not-allowed":"pointer",
                    fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
                  onMouseEnter={e=>{if(!loginLoad)e.currentTarget.style.opacity="0.88";}}
                  onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  {loginLoad?"Signing in...":`Continue as ${selectedRole.label} →`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ════ DASHBOARD ════ */}
        {step==="dashboard"&&selectedRole&&(
          <div className="fade-up" style={{width:"100%",maxWidth:1020}}>

            {/* Top header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{selectedRole.icon}</span>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600}}>
                  {role==="doctor"?"Doctor Dashboard":role==="owner"?"Clinic Dashboard":"Admin Dashboard"}
                </span>
                <span style={{fontSize:11,color:"var(--muted)",marginLeft:4}}>· {username}</span>
              </div>
              <button onClick={handleSignOut}
                style={{padding:"6px 14px",borderRadius:7,border:"1px solid var(--border)",
                  background:"var(--white)",fontSize:12,cursor:"pointer",color:"var(--muted)"}}>
                Sign out
              </button>
            </div>

            {/* ── DOCTOR ── */}
            {role==="doctor"&&(
              <>
                {/* ★ AVERAGE SCORES GRID — full width below header */}
                <ScoreGrid username={username} refreshKey={refreshKey}/>

                {/* Two-panel layout */}
                <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>

                  {/* LEFT — History */}
                  <HistoryPanel
                    username={username}
                    activeId={histActiveId}
                    refreshKey={refreshKey}
                    onViewAnalysis={handleViewAnalysis}
                    onNewAnalysis={resetUpload}
                  />

                  {/* RIGHT — Content */}
                  <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12}}>

                    {/* Viewing a history item */}
                    {histResult&&(
                      <div>
                        <div style={{fontSize:11,color:"var(--muted)",marginBottom:10,
                          display:"flex",alignItems:"center",gap:8}}>
                          <button onClick={()=>{setHistActiveId(null);setHistResult(null);}}
                            style={{background:"none",border:"none",cursor:"pointer",
                              color:"var(--green)",fontSize:12}}>← Back to upload</button>
                          <span>· <strong>{histFileName}</strong></span>
                        </div>
                        <ResultsView result={histResult} fileName={histFileName} savedId={null} onReset={null}/>
                      </div>
                    )}

                    {/* New upload flow */}
                    {!histResult&&(
                      <>
                        {/* IDLE */}
                        {uploadState==="idle"&&(
                          <div className="fade-in" style={{background:"var(--white)",borderRadius:14,
                            border:"0.5px solid var(--border)",
                            boxShadow:"0 2px 16px rgba(10,102,64,0.05)",padding:"24px"}}>
                            <div style={{fontSize:14,fontWeight:600,marginBottom:3}}>📄 Upload Consultation Transcript</div>
                            <div style={{fontSize:12,color:"var(--muted)",marginBottom:18,lineHeight:1.6}}>
                              Upload a <strong>.txt</strong> file. AI will score it across <strong>8 quality parameters</strong> and update your averages.
                            </div>
                            <ErrorBanner message={analysisErr} onDismiss={()=>setAnalysisErr("")}/>
                            <div onClick={()=>fileRef.current?.click()}
                              style={{border:"2px dashed var(--border)",borderRadius:11,padding:"26px 20px",
                                textAlign:"center",cursor:"pointer",transition:"all 0.2s",
                                marginBottom:13,background:"var(--light)"}}
                              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--green)";e.currentTarget.style.background="#f0f9f4";}}
                              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--light)";}}>
                              <div style={{fontSize:26,marginBottom:7}}>{fileName?"✅":"📂"}</div>
                              <div style={{fontSize:13,fontWeight:500,color:"var(--green)",marginBottom:3}}>
                                {fileName?fileName:"Click to select a .txt file"}
                              </div>
                              <div style={{fontSize:11,color:"var(--muted)"}}>
                                {fileName?"File ready — click Analyse below":"Only .txt files supported"}
                              </div>
                            </div>
                            <input ref={fileRef} type="file" accept=".txt"
                              onChange={handleFileChange} style={{display:"none"}}/>
                            <button onClick={handleAnalyse} disabled={!transcript.trim()}
                              style={{width:"100%",padding:"12px",borderRadius:9,border:"none",
                                background:transcript.trim()?"var(--green)":"#c8ddd4",
                                color:"#fff",fontSize:13,fontWeight:600,
                                cursor:transcript.trim()?"pointer":"not-allowed",
                                fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.2s"}}
                              onMouseEnter={e=>{if(transcript.trim())e.currentTarget.style.opacity="0.88";}}
                              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                              🔍 Analyse Transcript
                            </button>
                            <div style={{marginTop:16,padding:"13px",borderRadius:10,
                              background:"var(--light)",border:"0.5px solid var(--border)"}}>
                              <div style={{fontSize:10,fontWeight:600,color:"var(--muted)",
                                textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:9}}>
                                8 Quality Parameters
                              </div>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                                {PARAMETERS.map(p=>(
                                  <div key={p.key} style={{display:"flex",alignItems:"center",
                                    gap:6,fontSize:11,color:"var(--text)"}}>
                                    <span style={{fontSize:13}}>{p.icon}</span><span>{p.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ANALYSING */}
                        {uploadState==="analysing"&&(
                          <div className="fade-in" style={{background:"var(--white)",borderRadius:14,
                            border:"0.5px solid var(--border)",padding:"48px 28px",textAlign:"center"}}>
                            <div style={{display:"flex",justifyContent:"center",marginBottom:18}}>
                              <div className="spinner"/>
                            </div>
                            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,
                              fontWeight:600,marginBottom:7}}>Analysis in progress</div>
                            <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.8}}>
                              Gemini AI is reviewing your transcript<br/>across 8 quality parameters...
                            </div>
                            <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:18}}>
                              {[0,1,2].map(i=>(
                                <div key={i} className="pulse-dot" style={{animationDelay:`${i*0.3}s`}}/>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ERROR */}
                        {uploadState==="error"&&(
                          <div className="fade-in" style={{background:"var(--white)",borderRadius:14,
                            border:"1px solid #f5c6c6",padding:"26px",textAlign:"center"}}>
                            <div style={{fontSize:30,marginBottom:10}}>⚠️</div>
                            <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>Analysis failed</div>
                            <div style={{fontSize:12,color:"var(--muted)",marginBottom:6,lineHeight:1.6}}>
                              {analysisErr}
                            </div>
                            <div style={{fontSize:11,color:"var(--muted)",marginBottom:18,
                              padding:"10px 12px",background:"var(--light)",borderRadius:8,textAlign:"left"}}>
                              <strong>Common fixes:</strong><br/>
                              · Check VITE_GEMINI_API_KEY in Vercel env vars<br/>
                              · Make sure the Gemini key is active at aistudio.google.com<br/>
                              · Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON are correct<br/>
                              · Ensure the consultations table exists in Supabase
                            </div>
                            <button onClick={resetUpload}
                              style={{padding:"9px 22px",borderRadius:8,border:"1px solid var(--border)",
                                background:"var(--light)",fontSize:12,cursor:"pointer"}}>
                              Try again
                            </button>
                          </div>
                        )}

                        {/* DONE */}
                        {uploadState==="done"&&result&&(
                          <ResultsView result={result} fileName={fileName}
                            savedId={savedId} onReset={resetUpload}/>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Owner / Admin placeholder */}
            {(role==="owner"||role==="admin")&&(
              <div className="fade-in" style={{background:"var(--white)",borderRadius:14,
                border:"0.5px solid var(--border)",padding:"48px 28px",textAlign:"center"}}>
                <div style={{fontSize:38,marginBottom:14}}>{selectedRole.icon}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,marginBottom:8}}>
                  {selectedRole.label} Dashboard
                </div>
                <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.8}}>
                  Coming in the next step.<br/>
                  Will show clinic-wide scores, doctor leaderboards and analytics.
                </div>
              </div>
            )}
          </div>
        )}

        <p className="fade-up" style={{animationDelay:"400ms",marginTop:22,fontSize:11,color:"var(--muted)"}}>
          DocRate MVP · Testing mode · Portfolio project
        </p>
      </div>
    </>
  );
}
