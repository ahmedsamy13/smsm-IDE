import fs from"node:fs";import path from"node:path";import net from"node:net";import{spawn}from"node:child_process";import{projectRoot,applicationDataRoot,requireRuntime,prepareProfile,cleanEnvironment}from"./foundation.mjs";import{ensureInterface,installVsix}from"./install-interface.mjs";
async function port(){const server=net.createServer();await new Promise(r=>server.listen(0,"127.0.0.1",r));const value=server.address().port;await new Promise(r=>server.close(r));return value;}
const root=path.join(applicationDataRoot,"release-verification",new Date().toISOString().replace(/[:.]/g,"-"));fs.mkdirSync(root,{recursive:true});
const exe=requireRuntime(),{userData,extensions}=prepareProfile(root);
await ensureInterface({exe,userData,extensions});
const lock=JSON.parse(fs.readFileSync(path.join(projectRoot,"workflow.lock.json"),"utf8"));
for(const item of lock.extensions)await installVsix(exe,userData,extensions,path.join(applicationDataRoot,"extension-cache",item.id+"-"+item.version+".vsix"));
const settings=path.join(userData,"User/settings.json");const config=JSON.parse(fs.readFileSync(settings,"utf8"));config["[typescriptreact]"]={"editor.defaultFormatter":"esbenp.prettier-vscode"};config["extensions.autoUpdate"]=false;fs.writeFileSync(settings,JSON.stringify(config,null,2));
const front=await port(),back=await port(),workspace=path.join(projectRoot,"examples/fullstack-demo");
const npmCli=path.join(path.dirname(process.execPath),"node_modules/npm/bin/npm-cli.js");if(!fs.existsSync(npmCli))throw Error("npm CLI not found beside Node");
const child=spawn(exe,["--user-data-dir",userData,"--extensions-dir",extensions,"--new-window","--skip-welcome","--skip-release-notes","--disable-workspace-trust","--extensionDevelopmentPath="+path.join(projectRoot,"tests/release"),"--extensionTestsPath="+path.join(projectRoot,"tests/release/run.cjs"),workspace],{env:{...cleanEnvironment(),PERSONAL_IDE_RELEASE_ROOT:root,PERSONAL_IDE_RELEASE_NODE:process.execPath,PERSONAL_IDE_RELEASE_NPM:npmCli,PERSONAL_IDE_FRONT_PORT:String(front),PERSONAL_IDE_BACK_PORT:String(back)},stdio:["ignore","pipe","pipe"],windowsHide:true});
const log=fs.createWriteStream(path.join(root,"desktop.log"));child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
const measurement=spawn("pwsh.exe",["-NoProfile","-File",path.join(projectRoot,"scripts/measure-ide.ps1"),"-RootProcessId",String(child.pid),"-EvidenceRoot",root,"-DurationSeconds","210"],{windowsHide:true,stdio:["ignore","pipe","pipe"]});
const perfLog=fs.createWriteStream(path.join(root,"measurement.log"));measurement.stdout.pipe(perfLog,{end:false});measurement.stderr.pipe(perfLog,{end:false});
console.log(JSON.stringify({root,url:"http://127.0.0.1:"+front,pid:child.pid}));
const timeout=setTimeout(()=>{console.error("Release verification timed out");child.kill();},240000);
child.on("exit",async code=>{clearTimeout(timeout);await new Promise(resolve=>measurement.exitCode!==null?resolve():measurement.once("exit",resolve));log.end();perfLog.end();const result=JSON.parse(fs.readFileSync(path.join(root,"result.json"),"utf8"));console.log(JSON.stringify(result,null,2));if(code!==0||!result.passed)process.exitCode=1;});
