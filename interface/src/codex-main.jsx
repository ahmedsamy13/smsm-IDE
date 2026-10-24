import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { composerAction } from "./codex-composer.cjs";
import { patchLines } from "./patch-lines.cjs";
import { shouldSend } from "./codex-input.cjs";
const host = acquireVsCodeApi();
const post = (type, data = {}) => host.postMessage({ type, ...data });
const initial = {
  connected: false,
  busy: false,
  account: null,
  models: [],
  model: "",
  effort: "medium",
  mode: "ask",
  network: false,
  sandbox: "unknown",
  root: "",
  messages: [],
  events: [],
  pending: [],
  review: [],
  attachments: [],
  error: "",
  status: "Disconnected",
};
const descriptions = {
  ask: "Read-only sandbox. Trusted read commands may run automatically; Codex asks to go beyond the sandbox.",
  project:
    "Files and commands may change this project. Sandbox escapes require approval.",
  full: "Commands can change files outside the project and use the network without approval prompts.",
};
function PatchPreview({diff}){
 const patch=patchLines(diff);
 return <><span className="ml-2 text-xs text-muted">+{patch.added} −{patch.removed}</span><div className="mt-2 max-h-72 overflow-auto rounded border border-line font-mono text-[11px] leading-5">{patch.lines.map((line,index)=><div key={index} className={"flex min-w-max "+(line.kind==="add"?"bg-emerald-500/10 text-emerald-200":line.kind==="remove"?"bg-red-500/10 text-red-200":"text-muted")}><span className="w-9 shrink-0 border-r border-line px-1 text-right">{line.oldLine??""}</span><span className="w-9 shrink-0 border-r border-line px-1 text-right">{line.newLine??""}</span><span className="whitespace-pre px-2">{line.text}</span></div>)}</div></>;
}
function Approval({ item }) {
  const [answers, setAnswers] = useState({});
  return (
    <section className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-4">
      <h3 className="font-semibold text-amber-200">
        {item.kind === "question"
          ? "Codex needs your input"
          : item.kind === "file"
            ? "Review proposed file changes"
            : item.network
              ? "Approve network access"
              : "Approve command"}
      </h3>
      {item.reason && <p className="mt-2 text-xs text-muted">{item.reason}</p>}
      {item.command && (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-ink p-3 text-xs">
          {item.command}
        </pre>
      )}
      {item.cwd && (
        <p className="mt-2 break-all text-xs text-muted">
          Working directory: {item.cwd}
        </p>
      )}
      {item.grantRoot && (
        <p className="mt-2 break-all text-xs text-amber-200">
          Requested write root: {item.grantRoot}
        </p>
      )}
      {item.network && (
        <pre className="mt-2 whitespace-pre-wrap text-xs">
          {JSON.stringify(item.network, null, 2)}
        </pre>
      )}
      {item.changes?.map((change) => (
        <details key={change.path} className="mt-3">
          <summary className="break-all text-xs">{change.path}</summary>
          <PatchPreview diff={change.diff}/>
        </details>
      ))}
      {item.questions?.map((q) => (
        <label key={q.id} className="mt-3 block text-sm">
          {q.question}
          {q.options?.length > 0 && !q.isSecret && (
            <select
              aria-label={q.header + " options"}
              value={answers[q.id] || ""}
              onChange={(e) =>
                setAnswers({ ...answers, [q.id]: e.target.value })
              }
              className="mt-2 block w-full rounded border border-line bg-surface p-2"
            >
              <option value="">Choose or enter an answer below</option>
              {q.options.map((o) => (
                <option key={o.label} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <input
            type={q.isSecret ? "password" : "text"}
            autoComplete="off"
            value={answers[q.id] || ""}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            className="mt-2 block w-full rounded border border-line bg-surface p-2"
            aria-label={q.header}
          />
        </label>
      ))}
      <div className="mt-4 flex gap-3">
        {item.kind === "question" ? (
          <button
            onClick={() => post("approval", { id: item.id, answers })}
            className="rounded bg-mint px-3 py-2 text-xs font-semibold text-ink"
          >
            Submit answers
          </button>
        ) : (
          <>
            <button
              disabled={item.kind === "file" && !item.changes?.length}
              onClick={() =>
                post("approval", { id: item.id, decision: "accept" })
              }
              className="rounded bg-mint px-3 py-2 text-xs font-semibold text-ink"
            >
              {item.kind === "file" ? "Approve edit" : "Allow once"}
            </button>
            <button
              onClick={() =>
                post("approval", { id: item.id, decision: "decline" })
              }
              className="rounded border border-line px-3 py-2 text-xs"
            >
              Decline
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function App() {
 const [state,setState]=useState(initial),[prompt,setPrompt]=useState(()=>host.getState()?.draft||""),[submitting,setSubmitting]=useState(false),[copied,setCopied]=useState(""),[atBottom,setAtBottom]=useState(true);
 const pendingSend=useRef(null),sequence=useRef(0),conversation=useRef(null),follow=useRef(true),input=useRef(null),copyTimer=useRef(null);
 useEffect(()=>{
  const receive=e=>{
   if(e.data?.type==="codexState")setState(e.data.state);
   if(e.data?.type==="copyResult"){setCopied(e.data.id);clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(""),1800);}
   if(e.data?.type==="sendResult"&&e.data.id===pendingSend.current?.id){
    const submitted=pendingSend.current;pendingSend.current=null;setSubmitting(false);
    if(e.data.accepted)setPrompt(current=>current===submitted.text?"":current);
   }
  };
  window.addEventListener("message",receive);post("ready");
  return()=>{window.removeEventListener("message",receive);clearTimeout(copyTimer.current);};
 },[]);
 useEffect(()=>{if(follow.current&&conversation.current)conversation.current.scrollTop=conversation.current.scrollHeight;},[state.messages.at(-1)?.text,state.pending.length]);
 useEffect(()=>{follow.current=true;setAtBottom(true);},[state.provider]);
 useEffect(()=>{host.setState({draft:prompt,provider:state.provider||"codex"});if(input.current){input.current.style.height="auto";input.current.style.height=Math.min(160,Math.max(72,input.current.scrollHeight))+"px";}},[prompt,state.provider]);
 const model=state.models.find(m=>m.id===state.model),primary=composerAction(state,prompt,submitting);
 const submit=()=>{
  if(primary.type!=="send"||primary.disabled||pendingSend.current)return;
  const request={id:String(++sequence.current),text:prompt};pendingSend.current=request;setSubmitting(true);follow.current=true;post("send",request);
 };
 const primaryClick=()=>{if(!primary.disabled){if(primary.type==="send")submit();else post(primary.type);}};
 const copy=(id,text)=>post("copy",{id,text});
 const latest=()=>{follow.current=true;setAtBottom(true);if(conversation.current)conversation.current.scrollTop=conversation.current.scrollHeight;};
 useEffect(()=>{const close=e=>{for(const menu of document.querySelectorAll(".codex-menu[open]"))if(e.type==="keydown"?e.key==="Escape":!menu.contains(e.target))menu.open=false;};document.addEventListener("pointerdown",close);document.addEventListener("keydown",close);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",close);};},[]);
 const agent="Codex";
 const files=state.pending.filter(p=>p.kind==="file"),requests=state.pending.filter(p=>p.kind!=="file");
 const status=state.busy?"Working":files.length?"Changes ready to accept":state.connected?"Ready":"Disconnected";
 return (
  <main className="codex-shell">
   <header className="codex-header">
    <div className="flex min-w-0 items-center gap-2"><span className="codex-mark"><Icon name="codex"/></span><span className="text-sm font-semibold">Codex</span><span className={"codex-status-dot "+(state.busy?"working":state.connected?"connected":"")} aria-hidden="true"/></div>
    <div className="flex items-center gap-1">
     <details className="codex-menu"><summary title="Account and connection" aria-label="Account and connection" className="codex-icon-button"><Icon name="more"/></summary>
      <div className="codex-popover">
       <p className="font-medium">{state.account?.email||agent+" connection"}</p><p className="mt-1 text-muted">{state.account?.planType||state.status}</p>
       {state.root&&<p className="mt-2 break-all text-muted">{state.root}</p>}
       <button onClick={()=>post(state.connected?"disconnect":"login")} className="codex-menu-action">{state.connected?"Disconnect":"Sign in with ChatGPT"}</button>
       {state.connected&&state.account?.type!=="chatgpt"&&<button className="codex-menu-action" onClick={()=>post("login")}>Sign in with ChatGPT</button>}
       {state.status.includes("browser")&&<button className="codex-menu-action" onClick={()=>post("cancelLogin")}>Cancel sign-in</button>}
       <p className="mt-2 text-muted">Uses your official Codex CLI subscription sign-in.</p>
      </div>
     </details>
     <button title="New conversation" aria-label="New conversation" disabled={state.busy} onClick={()=>post("newChat")} className="codex-icon-button"><Icon name="new"/></button>
     <button title="Close Codex sidebar" aria-label="Close Codex sidebar" onClick={()=>post("toggle")} className="codex-icon-button"><Icon name="close"/></button>
    </div>
   </header>
   <div className="codex-context"><span className="truncate">{state.messages.find(m=>m.role==="user")?.text.split("\n")[0].slice(0,70)||"New conversation"}</span><span className="codex-context-workspace" title={state.root}>{state.root?state.root.split(/[\\/]/).filter(Boolean).at(-1):"Your workspace"}</span></div>
   <section ref={conversation} onScroll={()=>{const el=conversation.current;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;setAtBottom(follow.current);}} aria-label="Conversation" className="codex-conversation">
    {!state.messages.length&&<div className="codex-empty"><span className="codex-empty-mark"><Icon name="codex"/></span><h2 className="mt-4 text-lg font-semibold">What are we building?</h2><p className="mt-2 text-sm leading-6 text-muted">Ask about your project or describe a change. Review proposed edits directly in the editor.</p><div className="codex-starters">{["Explain this project","Find and fix a bug","Review my code"].map(text=><button key={text} onClick={()=>{setPrompt(text);input.current?.focus();}}><Icon name="spark"/>{text}<Icon name="arrow"/></button>)}</div><p className="mt-4 text-xs text-muted">Attached context is sent to OpenAI when you send a message.</p></div>}
    {state.messages.map(m=><article key={m.id} className={"codex-message "+(m.role==="user"?"from-user":"from-agent")}><div className="mb-2 text-xs font-medium text-muted">{m.role==="user"?"You":agent}</div><Message text={m.text} id={m.id} copy={copy} copied={copied}/><button title="Copy message" aria-label="Copy message" className="codex-copy-message" onClick={()=>copy(m.id,m.text)}><Icon name={copied===m.id?"check":"copy"}/>{copied===m.id?"Copied":"Copy"}</button></article>)}
    {files.map(p=><button key={p.id} onClick={()=>post("openProposal",{id:p.id})} className="codex-file-link"><Icon name="file"/><span className="min-w-0 flex-1 truncate">{p.changes?.[0]?.path||"Proposed file"}</span><span className="text-xs text-muted">Review {p.remaining||""} →</span></button>)}
    {!state.busy&&files.length>0&&<div className="codex-final-review"><p>{files.length} file{files.length===1?"":"s"} changed. Review them in the editor or choose an action:</p><div><button className="codex-accept-all" onClick={()=>post("reviewAll",{decision:"accept"})}>✓ Accept all changes</button><button className="codex-reject-all" onClick={()=>post("reviewAll",{decision:"decline"})}>Reject all</button></div></div>}
   </section>
   <footer className="codex-footer">
    {!atBottom&&<button className="codex-jump" onClick={latest}><Icon name="down"/>Latest messages</button>}
    <div className="codex-tools">
     <span role="status" className="mr-auto flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">{state.busy&&<span className="codex-working-indicator"/>}{status}</span>
     <details className="codex-menu"><summary className="codex-tool-button">Changes {files.length+state.review.length}</summary><div className="codex-popover above">
      {!files.length&&!state.review.length&&<p className="text-muted">No pending or recent file changes.</p>}
      {files.length>0&&<div className="flex gap-2"><button className="codex-menu-action" onClick={()=>post("reviewAll",{decision:"accept"})}>Accept all changes</button><button className="codex-menu-action" onClick={()=>post("reviewAll",{decision:"decline"})}>Reject all changes</button></div>}
      {files.map(p=><button key={p.id} className="codex-menu-action" onClick={()=>post("openProposal",{id:p.id})}>{p.changes?.[0]?.path} · Review {p.remaining} change(s)</button>)}
      {state.review.map(r=><div key={r.id} className="mt-2"><button className="codex-menu-action" onClick={()=>post("diff",{id:r.id})}>{r.label} · View changes</button><button disabled={state.busy||r.userEdited} className="text-xs text-muted underline" onClick={()=>post("restore",{id:r.id})}>Restore previous contents</button></div>)}
     </div></details>
     <details className="codex-menu"><summary className="codex-tool-button">Activity</summary><div className="codex-popover above"><pre className="whitespace-pre-wrap break-all text-xs leading-5 text-muted">{state.events.join("\n\n")||"No command activity yet."}</pre></div></details>
    </div>
    {requests.length>0&&<div className="codex-requests">{requests.map(p=><Approval key={p.id} item={p}/>)}</div>}
    {state.trusted===false&&<div className="codex-notice"><span>Trust this project to connect.</span><button onClick={()=>post("trust")} className="underline">Manage trust</button></div>}
    {state.loginPending&&<div className="codex-notice"><span>Finish sign-in in your browser.</span><button className="underline" onClick={()=>post("cancelLogin")}>Cancel</button></div>}
    {state.error&&<p role="alert" className="codex-error">{state.error}</p>}
    <div className="codex-composer">
     {state.attachments.length>0&&<div className="codex-attachments">{state.attachments.map(a=><button key={a.id} title="Remove attachment" className="rounded border border-line px-2 py-1 text-xs text-muted" onClick={()=>post("removeAttachment",{id:a.id})}>{a.name} ×</button>)}</div>}
     <label className="sr-only" htmlFor="prompt">Message {agent}</label>
     <textarea ref={input} id="prompt" rows={3} maxLength={16000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={"Ask "+agent+" about your project…"} className="codex-input" onKeyDown={e=>{if(shouldSend(e)){e.preventDefault();submit();}}}/>
     <div className="codex-composer-actions">
      <button disabled={state.busy} onClick={()=>post("attach")} title="Attach current file or selection" aria-label="Attach current file or selection" className="codex-icon-button"><Icon name="attach"/></button>
      <span className="mr-auto text-[10px] text-muted">Enter to send · Shift+Enter for newline</span>
      <button disabled={primary.disabled} onClick={primaryClick} aria-describedby="composer-status" title={primary.hint} className={"codex-send "+(state.busy?"stop":"")}>{primary.type==="send"?<><span>Send</span><Icon name="arrow"/></>:primary.label}</button>
     </div>
    </div>
    <div className="codex-selectors" aria-label="Agent controls">
     <label className="codex-selector model"><span className="sr-only">Model</span><select aria-label={agent+" model"} title={agent+" model"} disabled={state.busy||!state.models.length} value={state.model} onChange={e=>post("model",{model:e.target.value,effort:state.effort})}>{!state.models.length&&<option value="">Connect to choose model</option>}{state.models.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
     <label className="codex-selector"><span className="sr-only">Reasoning effort</span><select aria-label="Reasoning effort" title="Reasoning effort" disabled={state.busy||!model} value={state.effort} onChange={e=>post("model",{model:state.model,effort:e.target.value})}>{!model&&<option value="medium">Medium</option>}{model?.efforts.map(e=><option key={e} value={e}>{e.charAt(0).toUpperCase()+e.slice(1)}</option>)}</select></label>
     <label className="codex-selector"><span className="sr-only">Agent access</span><select aria-label="Agent access" title="Agent access" disabled={state.busy} value={state.mode} onChange={e=>post("settings",{mode:e.target.value,network:state.network})}><option value="ask">Review first</option><option value="project">Project access</option><option value="full">Full access</option></select></label>
     <details className="codex-menu"><summary className="codex-icon-button" title="Access details" aria-label="Access details"><Icon name="settings"/></summary><div className="codex-popover above"><p className="leading-5 text-muted">{descriptions[state.mode]} Edits apply immediately. Accept keeps them; Reject undoes them. Changing access starts a new chat.</p><label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={state.commandApprovals===true} disabled={state.busy||state.mode==="full"} onChange={e=>post("settings",{mode:state.mode,network:state.network,commandApprovals:e.target.checked})}/> Ask before commands</label><p className="mt-1 text-xs text-muted">When off, commands run within the selected access limits without prompts. Blocked commands fail instead of requesting more access.</p><label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={state.network} disabled={state.busy||state.mode==="full"} onChange={e=>post("settings",{mode:state.mode,network:e.target.checked})}/> Allow network in sandbox</label>{state.connected&&state.sandbox!=="ready"&&state.mode!=="full"&&<button className="codex-menu-action" onClick={()=>post("setupSandbox")}>Set up Windows sandbox</button>}</div></details>
    </div>
    <Usage state={state}/>
    <p id="composer-status" className="codex-composer-hint">{primary.hint}</p>
   </footer>
  </main>
 );
}

function Usage({state}){
 const usage=state.usage,bucket=usage?.buckets.find(b=>b.id===usage.selectedId),windows=bucket?.windows||[];
 const reset=value=>value?new Date(value*1000).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Not provided";
 const description=state.account?.type!=="chatgpt"?"Sign in to view usage":state.usageLoading&&!usage?"Loading usage…":windows.length?"Account usage":"Usage unavailable";
 return <section className="codex-usage" aria-label="Codex account usage">
  {windows.length>0?<div className="codex-usage-windows">{windows.map((w,i)=><div key={i} className={"codex-quota "+(w.remainingPercent<=5?"depleted":w.remainingPercent<=20?"low":"")} title={w.label+" allowance · resets "+reset(w.resetsAt)}><div><span>{w.label}</span><strong>{w.remainingPercent}% left</strong></div><progress aria-label={w.label+" allowance remaining"} max="100" value={w.remainingPercent}/></div>)}</div>:<span className="codex-usage-empty">{description}</span>}
  <details className="codex-menu"><summary className="codex-icon-button" title="Usage details" aria-label="Usage details"><Icon name="usage"/></summary><div className="codex-popover above"><p className="font-medium">Account usage</p><p className="mt-1 text-muted">Shared across your Codex clients. Percentages show remaining allowance, not remaining tokens.</p>{usage?.ordinaryUsageAllowed===false&&<p className="codex-error">The service reports that ordinary usage is currently unavailable.</p>}{usage?.buckets.map(b=><div key={b.id} className="mt-3"><p className="font-medium">{b.label}</p>{b.windows.map((w,i)=><p key={i} className="mt-1 text-muted">{w.label}: {w.remainingPercent}% left · resets {reset(w.resetsAt)}</p>)}{!b.windows.length&&<p className="text-muted">No allowance window provided.</p>}</div>)}{state.usageError&&<p className="codex-error">{state.usageError}{usage?" Displaying the last successful reading.":""}</p>}{usage&&<p className="mt-3 text-muted">Updated {new Date(usage.updatedAt).toLocaleTimeString()}</p>}<button className="codex-menu-action" disabled={state.usageLoading||state.account?.type!=="chatgpt"} onClick={()=>post("refreshUsage")}>{state.usageLoading?"Refreshing…":"Refresh usage"}</button></div></details>
 </section>;
}
function Message({text,id,copy,copied}){
 const parts=(text||"…").split(/(```[\s\S]*?```)/g);
 return <div className="text-sm leading-6">{parts.map((part,index)=>{
  if(!part.startsWith("```"))return <p key={index} className="whitespace-pre-wrap break-words">{part}</p>;
  const code=part.replace(/^```[^\n]*\n?/,"").replace(/```$/,""),language=part.match(/^```([^\n]*)/)?.[1]||"Code",key=id+":code:"+index;
  return <div key={index} className="codex-code-block"><div className="codex-code-header"><span>{language}</span><button aria-label="Copy code" onClick={()=>copy(key,code)}><Icon name={copied===key?"check":"copy"}/>{copied===key?"Copied":"Copy"}</button></div><pre className="codex-code"><code>{code}</code></pre></div>;
 })}</div>;
}
function Icon({name}){
 const paths={usage:"M4 20V10m8 10V4m8 16v-7",codex:"M12 3 21 8v8l-9 5-9-5V8l9-5Zm0 0v6m9-1-5 3M3 8l5 3m4 10v-6m9 1-5-3M3 16l5-3",more:"M5 12h.01M12 12h.01M19 12h.01",new:"M12 5v14M5 12h14",close:"m6 6 12 12M6 18 18 6",arrow:"M12 19V5m-6 6 6-6 6 6",down:"M12 5v14m-6-6 6 6 6-6",copy:"M9 9h11v11H9zM15 9V4H4v11h5",check:"m5 12 4 4L19 6",file:"M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 13h8M8 17h6",attach:"m8 12 6-6a3 3 0 0 1 4 4L10 18a5 5 0 0 1-7-7l9-9",spark:"m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",settings:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"};
 return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.codex}/></svg>;
}
createRoot(document.getElementById("root")).render(<App />);
