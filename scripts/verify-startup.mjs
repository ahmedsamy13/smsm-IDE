import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {projectRoot,requireRuntime,prepareProfile,cleanEnvironment} from './foundation.mjs';
import {bundleInterface} from './install-interface.mjs';
const root=path.join(projectRoot,'.verification','builtin-startup-'+Date.now());
const workspace=path.join(root,'workspace');fs.mkdirSync(workspace,{recursive:true});
const exe=requireRuntime(),{userData,extensions}=prepareProfile(root);
bundleInterface(exe);
for(const pass of [1,2]){
 await new Promise((resolve,reject)=>{
  const log=fs.createWriteStream(path.join(root,'desktop-'+pass+'.log'));
  const child=spawn(exe,['--user-data-dir',userData,'--extensions-dir',extensions,'--new-window','--skip-welcome','--skip-release-notes','--disable-workspace-trust','--extensionDevelopmentPath='+path.join(projectRoot,'tests','startup'),'--extensionTestsPath='+path.join(projectRoot,'tests','startup','run.cjs'),workspace],{env:{...cleanEnvironment(),PERSONAL_IDE_STARTUP_ROOT:root,PERSONAL_IDE_STARTUP_PASS:String(pass)},stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  const timeout=setTimeout(()=>{child.kill();reject(Error('Startup check timed out: '+root));},60000);
  child.on('error',error=>{clearTimeout(timeout);log.end();reject(error);});
  child.on('exit',code=>{clearTimeout(timeout);log.end();if(code!==0)return reject(Error('Startup check failed; inspect '+root));resolve();});
 });
 console.log('Cold launch '+pass+': '+fs.readFileSync(path.join(root,'result-'+pass+'.json'),'utf8'));
}
console.log('Built-in interface loaded on both launches with an empty user extensions directory. Evidence: '+root);
