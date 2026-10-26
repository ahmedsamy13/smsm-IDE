import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

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
export function bundleInterface(exe,source=path.join(projectRoot,"interface","extension")){
 if(!fs.existsSync(path.join(source,"dist","codex.js")))throw Error("Build the Personal IDE interface before launching.");
 const hash=fingerprint(source).digest("hex");
 const target=path.join(path.dirname(exe),"resources","app","extensions","personal-ide-interface");
 const marker=path.join(target,".personal-ide-bundle.json");
 if(readJson(marker,{})?.hash!==hash){
  fs.cpSync(source,target,{recursive:true});
  fs.writeFileSync(marker,JSON.stringify({hash}));
 }
 return {target,hash};
}
export async function ensureInterface({exe,userData,extensions}){
 const source=path.join(projectRoot,"interface","extension");
 if(!fs.existsSync(path.join(source,"dist","codex.js")))throw Error("Build the Personal IDE interface before launching.");
 const manifest=readJson(path.join(source,"package.json"));
 const id=manifest.publisher+"."+manifest.name,version=manifest.version;
 const {hash}=bundleInterface(exe,source),marker=path.join(userData,"personal-ide-interface.json");
 const registry=path.join(extensions,"extensions.json"),installed=readJson(registry,[]);
 const previous=readJson(marker,{});
 let changed=previous.hash!==hash||previous.builtIn!==true||previous.deliveryVersion!==1;
 // The app owns its interface. Keep a recovery copy of the old registration,
 // then stop loading the duplicate user extension; account/chat storage stays in place.
 if(installed.some(item=>item.identifier.id===id)){
  const backup=path.join(path.dirname(userData),"interface-backups");fs.mkdirSync(backup,{recursive:true});
  fs.copyFileSync(registry,path.join(backup,"extensions-"+Date.now()+".json"));
  fs.writeFileSync(registry+".tmp",JSON.stringify(installed.filter(item=>item.identifier.id!==id)));
  try{fs.renameSync(registry+".tmp",registry);}catch(error){if(error.code!=="EXDEV")throw error;fs.copyFileSync(registry+".tmp",registry);fs.unlinkSync(registry+".tmp");}changed=true;
 }
 if(changed){
  const cacheRoot=path.join(userData,"CachedProfilesData");
  for(const profile of fs.existsSync(cacheRoot)?fs.readdirSync(cacheRoot,{withFileTypes:true}):[]){
   if(!profile.isDirectory())continue;
   for(const name of fs.readdirSync(path.join(cacheRoot,profile.name))){
    if(!/^extensions\.(builtin|user).*\.cache$/.test(name))continue;
    const cache=path.join(cacheRoot,profile.name,name),backup=path.join(path.dirname(userData),"interface-backups","scan-cache-"+Date.now());
    fs.mkdirSync(backup,{recursive:true});fs.copyFileSync(cache,path.join(backup,name));fs.unlinkSync(cache);
   }
  }
 }
 fs.writeFileSync(marker,JSON.stringify({hash,id,version,builtIn:true,deliveryVersion:1},null,2));
 return changed;
}
