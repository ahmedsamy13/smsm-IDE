import http from "node:http";import fs from "node:fs";import path from "node:path";
const root=path.resolve("interface/extension/dist");
const state={usage:{"updatedAt":1792796637845,"selectedId":"codex","ordinaryUsageAllowed":true,"buckets":[{"id":"codex","label":"Codex (UI fixture)","windows":[{"label":"5h","usedPercent":27,"remainingPercent":73,"resetsAt":1792803837},{"label":"7d","usedPercent":46,"remainingPercent":54,"resetsAt":1792969437}]}]},trusted:true,connected:true,busy:false,account:{type:"chatgpt",email:"Local UI fixture",planType:"Plus"},models:[{id:"fixture-codex",label:"Codex · UI fixture",efforts:["low","medium","high"]}],model:"fixture-codex",effort:"medium",mode:"ask",network:false,sandbox:"ready",root:"Demo project",messages:Array.from({length:18},(_,i)=>({id:String(i),role:i%2?"assistant":"user",text:i%2?"I have prepared the change for review. Open the file in the editor to inspect each change before accepting it.":"Review the project and improve the error handling."})),events:["Local preview only. No account connection or model requests."],pending:[{id:"demo-file",kind:"file",proposal:true,remaining:2,changes:[{path:"src/users.service.ts"}]}],review:[],attachments:[],error:"",status:"Connected"};
const shim=`const state=${JSON.stringify(state)};let draft={};const emit=()=>window.dispatchEvent(new MessageEvent("message",{data:{type:"codexState",state:structuredClone(state)}}));window.acquireVsCodeApi=()=>({getState:()=>draft,setState:value=>{draft=value},postMessage:message=>{
 if(message.type==="ready")emit();
 if(message.type==="send"){state.messages.push({id:String(Date.now()),role:"user",text:message.text});window.dispatchEvent(new MessageEvent("message",{data:{type:"sendResult",id:message.id,accepted:true}}));emit();}
 if(message.type==="copy"){window.dispatchEvent(new MessageEvent("message",{data:{type:"copyResult",id:message.id}}));}
 if(message.type==="model"){state.model=message.model;state.effort=message.effort;emit();}
 if(message.type==="settings"){state.mode=message.mode;state.network=message.network;emit();}
 if(message.type==="newChat"){state.messages=[];state.pending=[];emit();}
 if(message.type==="openProposal"){document.getElementById("fixture-note").textContent="Editor review requested for "+message.id;}
}});`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://localhost");
 if(url.pathname==="/"){
  const width=Math.min(600,Math.max(280,Number(url.searchParams.get("width"))||420));
  res.writeHead(200,{"Content-Type":"text/html"});
  res.end('<!doctype html><html><head><meta charset="utf-8"><title>Codex UI verification</title><link rel="stylesheet" href="/panel.css"><style>body{display:flex;justify-content:center;background:#090c12}#root{width:'+width+'px;max-width:100%;border-left:1px solid #293144;border-right:1px solid #293144}#fixture-note{position:fixed;top:0;left:0;font:11px Segoe UI;color:#9aa8c2;max-width:140px}</style></head><body><span id="fixture-note">Local UI fixture</span><div id="root"></div><script>'+shim+'</script><script src="/codex.js"></script></body></html>');return;
 }
 const allowed={"/panel.css":"text/css","/codex.js":"text/javascript"};if(!allowed[url.pathname]){res.writeHead(404);res.end();return;}res.writeHead(200,{"Content-Type":allowed[url.pathname]});fs.createReadStream(path.join(root,path.basename(url.pathname))).pipe(res);
});
server.listen(0,"127.0.0.1",()=>console.log("UI_PREVIEW http://127.0.0.1:"+server.address().port));
