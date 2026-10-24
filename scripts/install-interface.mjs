import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectRoot, cleanEnvironment } from "./foundation.mjs";

async function run(exe,args,env=cleanEnvironment()){
 await new Promise((resolve,reject)=>{
  const child=spawn(exe,args,{env,windowsHide:true,stdio:"inherit"});
  child.on("error",reject);
  child.on("exit",code=>code===0?resolve():reject(Error("Extension installer exited "+code)));
 });
}
export async function installVsix(exe,userData,extensions,archive){
 await run(exe,[path.join(path.dirname(exe),"resources","app","out","cli.js"),"--user-data-dir",userData,"--extensions-dir",extensions,"--install-extension",archive,"--force"],{...cleanEnvironment(),ELECTRON_RUN_AS_NODE:"1"});
}
function fingerprint(dir,hash=crypto.createHash("sha256"),relative=""){
 for(const item of fs.readdirSync(path.join(dir,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const name=path.join(relative,item.name);
  if(item.isSymbolicLink())throw Error("Interface package must not contain symbolic links");
  if(item.isDirectory())fingerprint(dir,hash,name);
  else if(item.isFile())hash.update(name.replaceAll("\\","/")).update("\0").update(fs.readFileSync(path.join(dir,name))).update("\0");
 }
 return hash;
}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch(error){if(error.code==="ENOENT")return fallback;throw error;}}
export async function ensureInterface({exe,userData,extensions}){
 const source=path.join(projectRoot,"interface","extension");
 if(!fs.existsSync(path.join(source,"dist","codex.js")))throw Error("Build the Personal IDE interface before launching.");
 const manifest=readJson(path.join(source,"package.json"));
 const id=manifest.publisher+"."+manifest.name,version=manifest.version;
 const hash=fingerprint(source).digest("hex"),marker=path.join(userData,"personal-ide-interface.json");
 const installed=readJson(path.join(extensions,"extensions.json"),[]);
 const obsolete=readJson(path.join(extensions,".obsolete"),{});
 const current=installed.find(item=>item.identifier.id===id&&item.version===version);
 const folder=id+"-"+version;
 if(current&&!obsolete[folder]&&readJson(marker,{})?.hash===hash&&fs.existsSync(path.join(extensions,folder,"codex.cjs")))return false;
 const cache=path.join(path.dirname(userData),"extension-cache");
 fs.mkdirSync(cache,{recursive:true});
 const archive=path.join(cache,folder+"-"+hash.slice(0,16)+".vsix");
 const packageScript=fileURLToPath(new URL("./package-interface.ps1",import.meta.url));
 const bundled=path.join(projectRoot,"resources/extensions/personal-ide-interface.vsix");
 if(fs.existsSync(bundled))fs.copyFileSync(bundled,archive);
 else try{await run("pwsh.exe",["-NoProfile","-File",packageScript,"-Source",source,"-Output",archive]);}
 catch(error){if(error.code!=="ENOENT")throw error;await run("powershell.exe",["-NoProfile","-File",packageScript,"-Source",source,"-Output",archive]);}
 await installVsix(exe,userData,extensions,archive);
 const registered=readJson(path.join(extensions,"extensions.json"),[]).some(item=>item.identifier.id===id&&item.version===version);
 if(!registered)throw Error("Personal IDE interface installation was not registered.");
 fs.writeFileSync(marker,JSON.stringify({hash,id,version},null,2));
 return true;
}
