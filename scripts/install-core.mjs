import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";import{projectRoot,applicationDataRoot}from"./foundation.mjs";import{installVsix}from"./install-interface.mjs";
export async function ensureCore({exe,userData,extensions}){
 const lock=JSON.parse(fs.readFileSync(path.join(projectRoot,"workflow.lock.json"),"utf8"));
 const toolboxPath=path.join(projectRoot,"toolbox.lock.json");
 const toolbox=fs.existsSync(toolboxPath)?JSON.parse(fs.readFileSync(toolboxPath,"utf8")).extensions:[];
 for(const item of [...lock.extensions,...toolbox]){
  const registry=fs.existsSync(path.join(extensions,"extensions.json"))?JSON.parse(fs.readFileSync(path.join(extensions,"extensions.json"),"utf8")):[];
  const obsolete=fs.existsSync(path.join(extensions,".obsolete"))?JSON.parse(fs.readFileSync(path.join(extensions,".obsolete"),"utf8")):{};
  if(registry.some(entry=>entry.identifier.id.toLowerCase()===item.id.toLowerCase()&&entry.version===item.version)&&!obsolete[item.id+"-"+item.version])continue;
  const filename=item.id+"-"+item.version+".vsix";
  const archive=[path.join(projectRoot,"resources/extensions",filename),path.join(path.dirname(userData),"extension-cache",filename),path.join(applicationDataRoot,"extension-cache",filename)].find(file=>fs.existsSync(file));
  if(!archive){console.warn("Core extension "+item.id+" is not installed. Run npm run setup:workflow.");continue;}
  if(crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex")!==item.sha256)throw Error("Core extension checksum mismatch: "+item.id);
  await installVsix(exe,userData,extensions,archive);
 }
}
