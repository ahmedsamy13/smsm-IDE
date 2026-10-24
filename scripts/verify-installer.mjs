import fs from"node:fs";import path from"node:path";import{spawn}from"node:child_process";import{projectRoot,applicationDataRoot,cleanEnvironment}from"./foundation.mjs";
const evidenceRoot=path.join(applicationDataRoot,"installer-verification",new Date().toISOString().replace(/[:.]/g,"-"));fs.mkdirSync(evidenceRoot,{recursive:true});
const installation=path.join("D:/personal-ide-build-cache","installed-verification-"+Date.now()),data=path.join(installation+"-data"),workspace=path.join(evidenceRoot,"workspace");fs.mkdirSync(workspace,{recursive:true});
const result={installation,data,checks:[],started:new Date().toISOString()};const setup=path.join(projectRoot,"release/PersonalIDE-0.6.1-x64-setup.exe");
async function run(exe,args,env=cleanEnvironment()){await new Promise((resolve,reject)=>{const child=spawn(exe,args,{env,windowsHide:true,stdio:"inherit"});child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(Error(path.basename(exe)+" exit "+code)));});}
try{
 await run(setup,["/VERYSILENT","/SUPPRESSMSGBOXES","/NORESTART","/SP-","/DIR="+installation,"/GROUP=Personal IDE Verification","/TASKS=","/LOG="+path.join(evidenceRoot,"install.log")]);result.checks.push("Windows installer completed in a disposable custom directory");
 const runtime=path.join(installation,".runtime/vscodium-1.140.06880/VSCodium.exe");
 await run(runtime,[path.join(installation,"scripts/start-ide.mjs"),"--prepare-only"],{...cleanEnvironment(),ELECTRON_RUN_AS_NODE:"1",PERSONAL_IDE_DATA_ROOT:data});
 result.checks.push("Installed launcher prepared a fresh profile using the bundled Electron/Node runtime");
 const descriptor=JSON.parse(fs.readFileSync(path.join(data,"profile/personal-ide-runtime.json"),"utf8"));
 const engine=descriptor.bundledCodex;
 if(!engine||!engine.toLowerCase().startsWith(installation.toLowerCase()+path.sep)||!fs.existsSync(engine))throw Error("Installed bundled engine is missing or points outside the installation");
 await run(engine,["--version"]);
 result.checks.push("Installed Codex engine ran from the application bundle, without a separate CLI installation");
 const registry=JSON.parse(fs.readFileSync(path.join(data,"extensions/extensions.json"),"utf8"));
 for(const id of ["personal-ide.workspace-interface","esbenp.prettier-vscode","dbaeumer.vscode-eslint","bradlc.vscode-tailwindcss","pkief.material-icon-theme","humao.rest-client","personal-ide.sqlite-browser","jeanp413.open-remote-ssh","ms-azuretools.vscode-containers"])if(!registry.some(entry=>entry.identifier.id.toLowerCase()===id.toLowerCase()))throw Error("Installed package is missing "+id);
 result.checks.push("Custom interface and eight checksum-verified workflow/toolbox extensions installed offline");
 fs.writeFileSync(path.join(workspace,"app.js"),'// foundation smoke fixture\nconsole.log("ready");\n');
 fs.writeFileSync(path.join(data,"keep-user-data.txt"),"preserved");
 const log=fs.createWriteStream(path.join(evidenceRoot,"desktop.log"));
 await new Promise((resolve,reject)=>{
  const child=spawn(runtime,["--user-data-dir",path.join(data,"profile"),"--extensions-dir",path.join(data,"extensions"),"--new-window","--skip-welcome","--skip-release-notes","--disable-workspace-trust","--extensionDevelopmentPath="+path.join(projectRoot,"tests/desktop"),"--extensionTestsPath="+path.join(projectRoot,"tests/desktop/run.cjs"),workspace],{env:{...cleanEnvironment(),PERSONAL_IDE_SMOKE_ROOT:evidenceRoot,PERSONAL_IDE_SMOKE_NODE:process.execPath,PERSONAL_IDE_TOOLBOX_TEST:"1",PERSONAL_IDE_SKIP_LIVE_PROPOSALS:"1"},windowsHide:true,stdio:["ignore","pipe","pipe"]});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});const timer=setTimeout(()=>{child.kill();reject(Error("Installed desktop test timed out"));},180000);
  child.on("error",reject);child.on("exit",code=>{clearTimeout(timer);log.end();code===0?resolve():reject(Error("Installed desktop test failed "+code));});
 });
 if(/Failed to open database/.test(fs.readFileSync(path.join(evidenceRoot,"desktop.log"),"utf8")))throw Error("Installed database explorer logged a schema-opening failure");
 const desktop=JSON.parse(fs.readFileSync(path.join(evidenceRoot,"result.json"),"utf8"));if(!desktop.passed)throw Error(desktop.error);result.desktop=desktop;result.checks.push("Installed IDE opened, edited, saved, registered Codex, ran its real terminal, and passed the installed toolbox checks");
 await run(path.join(installation,"unins000.exe"),["/VERYSILENT","/SUPPRESSMSGBOXES","/NORESTART","/LOG="+path.join(evidenceRoot,"uninstall.log")]);
 if(fs.existsSync(runtime))throw Error("Uninstaller left its runtime installed");
 if(fs.readFileSync(path.join(data,"keep-user-data.txt"),"utf8")!=="preserved")throw Error("User data not preserved");
 result.checks.push("Uninstaller removed application files and preserved separate user data");
 result.passed=true;
}catch(error){result.passed=false;result.error=error.stack||String(error);process.exitCode=1;}
finally{result.completed=new Date().toISOString();fs.writeFileSync(path.join(evidenceRoot,"installer-result.json"),JSON.stringify(result,null,2));console.log(JSON.stringify({evidenceRoot,...result},null,2));}
