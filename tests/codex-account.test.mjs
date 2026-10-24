import test from"node:test";import assert from"node:assert/strict";import{createRequire}from"node:module";
const require=createRequire(import.meta.url);const {normalizeUsage,managedLoginUrl}=require("../interface/src/codex-usage.cjs");const {composerAction}=require("../interface/src/codex-composer.cjs");
test("quota bars report remaining allowance and prefer the account Codex bucket",()=>{
 const usage=normalizeUsage({rateLimitsByLimitId:{other:{primary:{usedPercent:10,windowDurationMins:60}},codex:{primary:{usedPercent:25,windowDurationMins:300,resetsAt:1800000000},secondary:{usedPercent:40,windowDurationMins:10080}}},ordinaryUsageAllowed:false},123);
 assert.equal(usage.selectedId,"codex");assert.equal(usage.updatedAt,123);assert.equal(usage.ordinaryUsageAllowed,false);const selected=usage.buckets.find(b=>b.id==="codex");assert.equal(selected.windows[0].remainingPercent,75);assert.equal(selected.windows[0].label,"5h");assert.equal(selected.windows[1].label,"7d");
});
test("missing quota fields remain unavailable and percentages cannot exceed bounds",()=>{
 assert.equal(normalizeUsage({}).buckets.length,0);
 const usage=normalizeUsage({rateLimits:{primary:{usedPercent:null},secondary:{usedPercent:120,windowDurationMins:null,resetsAt:null}}});assert.equal(usage.buckets[0].windows.length,1);assert.equal(usage.buckets[0].windows[0].remainingPercent,0);assert.equal(usage.buckets[0].windows[0].resetsAt,null);
});
test("managed OAuth only opens HTTPS pages on exact official sign-in hosts",()=>{
 assert.equal(new URL(managedLoginUrl({type:"chatgpt",authUrl:"https://auth.openai.com/authorize?state=fixture"})).hostname,"auth.openai.com");
 for(const url of ["http://auth.openai.com","https://auth.openai.com.evil.test","https://user:pass@auth.openai.com","javascript:alert(1)"])assert.throws(()=>managedLoginUrl({type:"chatgpt",authUrl:url}),/sign-in URL/);
 assert.throws(()=>managedLoginUrl({type:"apiKey",authUrl:"https://auth.openai.com"}),/unsupported/);
});
test("fresh installation offers browser sign-in and prevents duplicate pending logins",()=>{
 assert.equal(composerAction({connected:false},"draft").type,"login");const action=composerAction({connected:true,loginPending:true},"draft");assert.equal(action.disabled,true);assert.equal(action.type,"wait");
});

import fs from"node:fs";import path from"node:path";import os from"node:os";import vm from"node:vm";import{EventEmitter}from"node:events";
test("IDE browser sign-in works before trusting a project; quota failure never grants agent access",async()=>{
 const hostFile=new URL("../interface/src/codex-host.cjs",import.meta.url),localRequire=createRequire(hostFile);let client;const opened=[],subscriptions=[];const disposable=()=>({dispose(){}});
 class Rpc extends EventEmitter{
  constructor(){super();client=this;this.signedIn=false;this.starts=0;}
  async start(){}
  async request(method){
   if(method==="account/read")return{account:this.signedIn?{type:"chatgpt",planType:"plus",email:"fixture@example.invalid"}:null};
   if(method==="account/login/start"){this.starts++;return{type:"chatgpt",loginId:"fixture",authUrl:"https://auth.openai.com/authorize?state=fixture"};}
   if(method==="account/login/cancel")return{};
   if(method==="model/list")return{data:[{model:"fixture",displayName:"Fixture",supportedReasoningEfforts:[{reasoningEffort:"medium"}],defaultReasoningEffort:"medium",isDefault:true}]};
   if(method==="windowsSandbox/readiness")return{status:"ready"};
   if(method==="account/rateLimits/read")throw Error("Simulated unavailable service");
   throw Error("Unexpected request "+method);
  }
  close(){}
 }
 const rpcModule=localRequire("./codex-rpc.cjs");
 const vscode={window:{activeTextEditor:null,registerWebviewViewProvider:disposable,onDidChangeActiveTextEditor:disposable},workspace:{isTrusted:false,workspaceFolders:[],getConfiguration:()=>({get:()=>""}),registerTextDocumentContentProvider:disposable,onDidChangeTextDocument:disposable,onDidGrantWorkspaceTrust:disposable},commands:{registerCommand:disposable},Uri:{parse:url=>url},env:{openExternal:async uri=>{opened.push(uri);return true;}}};
 const box={module:{exports:{}},require:name=>name==="vscode"?vscode:name==="./codex-inline-review.cjs"?{registerInlineReview:()=>({clear(){},remove(){}})}:name==="./codex-rpc.cjs"?{...rpcModule,CodexRpc:Rpc,resolveCodex:()=>path.join(os.tmpdir(),"codex.exe")}:localRequire(name),setTimeout,clearTimeout,Buffer,URL};
 vm.runInNewContext(fs.readFileSync(hostFile,"utf8"),box);
 const api=box.module.exports.registerCodex({globalStorageUri:{fsPath:fs.mkdtempSync(path.join(os.tmpdir(),"ide-auth-"))},subscriptions,workspaceState:{get:()=>null,update:async()=>{}}});
 try{
  await api.handle({type:"login"});assert.equal(opened.length,1);assert.equal(api.getState().loginPending,true);assert.equal(api.getState().root,"");
  await api.handle({type:"login"});assert.equal(client.starts,1);
  client.signedIn=true;client.emit("notification",{method:"account/login/completed",params:{success:true}});
  for(let i=0;i<20&&!api.getState().usageError;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(api.getState().loginPending,false);assert.equal(api.getState().account.type,"chatgpt");assert.equal(api.getState().connected,true);assert.equal(api.getState().usage,null);assert.match(api.getState().usageError,/unavailable/);
  await assert.rejects(()=>api.send("Change a file"),/Trust the workspace/);
 }finally{for(const subscription of subscriptions)subscription.dispose();}
});
