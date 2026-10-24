import fs from"node:fs";import path from"node:path";import{createRequire}from"node:module";import{applicationDataRoot,projectRoot}from"./foundation.mjs";
const require=createRequire(import.meta.url);const{CodexRpc}=require("../interface/src/codex-rpc.cjs");const{normalizeUsage,managedLoginUrl}=require("../interface/src/codex-usage.cjs");
const root=path.join(applicationDataRoot,"account-verification",new Date().toISOString().replace(/[:.]/g,"-"));fs.mkdirSync(root,{recursive:true});
const executable=path.join(projectRoot,".runtime/codex-0.160.1/bin/codex.exe"),evidence={engine:executable,checks:[]};
let live,isolated;
function client(env){const rpc=new CodexRpc({executable,cwd:root,env});rpc.on("request",request=>rpc.reject(request.id,"Read-only account probe"));rpc.on("disconnected",()=>{});return rpc;}
try{
 live=client();await live.start();const account=await live.request("account/read",{refreshToken:false});evidence.accountType=account.account?.type||null;
 if(evidence.accountType!=="chatgpt")throw Error("Existing subscription sign-in not available");
 const result=await live.request("account/rateLimits/read",{excludeResetCreditDetails:true});const usage=normalizeUsage(result);evidence.usage=usage;evidence.checks.push("Bundled engine reused subscription sign-in and returned authoritative quota windows");
 const isolatedHome=path.join(root,"isolated-home");fs.mkdirSync(isolatedHome,{recursive:true});
 isolated=client({...process.env,CODEX_HOME:isolatedHome});await isolated.start();
 const signedOut=await isolated.request("account/read",{refreshToken:false});if(signedOut.account)throw Error("Isolation did not produce a signed-out account");
 const login=await isolated.request("account/login/start",{type:"chatgpt"});const url=new URL(managedLoginUrl(login));evidence.signInHost=url.hostname;
 await isolated.request("account/login/cancel",{loginId:login.loginId});evidence.checks.push("Fresh signed-out profile started and cancelled official browser OAuth without touching the existing sign-in");
 evidence.passed=true;
}catch(error){evidence.passed=false;evidence.error=error.message;process.exitCode=1;}
finally{isolated?.close();live?.close();fs.writeFileSync(path.join(root,"result.json"),JSON.stringify(evidence,null,2));console.log(JSON.stringify({root,...evidence},null,2));}
