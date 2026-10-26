const vscode=require('vscode'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
exports.run=async()=>{
 const extension=vscode.extensions.getExtension('personal-ide.workspace-interface');
 assert.ok(extension,'Personal IDE must load without an installed user extension');
 assert.match(extension.extensionPath.replaceAll('\\','/'),/\/resources\/app\/extensions\/personal-ide-interface$/i);
 const api=await extension.activate();
 await api.codex.handle({type:'history'});assert.ok(Array.isArray(api.codex.getState().history),'Chat history is available in the installed host');
 const deadline=Date.now()+20000;
 while(!api.codex.isPanelReady()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,200));
 assert.equal(api.codex.isPanelReady(),true,'Codex sidebar opens on first launch and restores on relaunch');
 assert.ok((await vscode.commands.getCommands()).includes('personalIde.toggleCodex'));
 assert.equal(vscode.workspace.getConfiguration().get('workbench.colorTheme'),'Personal IDE Midnight');
 fs.writeFileSync(path.join(process.env.PERSONAL_IDE_STARTUP_ROOT,'result-'+process.env.PERSONAL_IDE_STARTUP_PASS+'.json'),JSON.stringify({passed:true,extensionPath:extension.extensionPath,codexVisible:true}));
};
