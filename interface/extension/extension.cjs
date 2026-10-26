const vscode=require('vscode');
const crypto=require('node:crypto');
let panel;
let panelReady=false;
exports.activate=async context=>{
 const workflow=require('./workflow.cjs').registerWorkflow(context);
 const codex=require('./codex.cjs').registerCodex(context);
 const jsConsole=require('./console.cjs').registerConsole(context);
 const toolbox=require('./toolbox.cjs').registerToolbox(context);
 const path=require('node:path');
 if(vscode.extensions.getExtension('personal-ide.sqlite-browser')) await vscode.workspace.getConfiguration().update('sqlite.sqlite3',path.join(context.extensionPath,'tools','sqlite3.exe'),vscode.ConfigurationTarget.Global);
 const actions={folder:'workbench.action.files.openFolder',files:'workbench.view.explorer',search:'workbench.action.findInFiles',git:'workbench.view.scm',settings:'workbench.action.openSettings',terminal:'workbench.action.terminal.new',scripts:'personalIde.scripts',debug:'personalIde.debug',import:'personalIde.import',codex:'personalIde.codex'};
 const layout=async()=>{for(const [key,value] of Object.entries({'workbench.colorTheme':'Personal IDE Midnight','workbench.sideBar.location':'left','workbench.iconTheme':'material-icon-theme','explorer.compactFolders':false,'editor.minimap.enabled':false,'breadcrumbs.enabled':false,'workbench.layoutControl.enabled':false}))await vscode.workspace.getConfiguration().update(key,value,vscode.ConfigurationTarget.Global);};
 const show=()=>{
  if(panel){panel.reveal();return;}
  panel=vscode.window.createWebviewPanel('personalIde.overview','Workspace',vscode.ViewColumn.One,{enableScripts:true,localResourceRoots:[context.extensionUri],retainContextWhenHidden:false});
  const nonce=crypto.randomBytes(24).toString('hex');
  const resource=name=>panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'dist',name));
  panel.webview.html=`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${resource('panel.css')}"><title>Personal IDE</title></head><body><div id="root"></div><script nonce="${nonce}" src="${resource('panel.js')}"></script></body></html>`;
  const state=()=>panel?.webview.postMessage({type:'state',workspace:vscode.workspace.name||'No project open',folders:(vscode.workspace.workspaceFolders||[]).map(f=>f.name),trusted:vscode.workspace.isTrusted});
  const listener=panel.webview.onDidReceiveMessage(async message=>{
   if(!message||typeof message!=='object')return;
   if(message.type==='ready'){panelReady=true;state();return;}
   if(message.type!=='action'||!Object.hasOwn(actions,message.action))return;
   if(message.action==='terminal'&&!vscode.workspace.isTrusted){vscode.window.showInformationMessage('Terminal access requires a trusted workspace.');return;}
   try{await vscode.commands.executeCommand(actions[message.action]);}catch(error){vscode.window.showErrorMessage(`Could not open ${message.action}: ${error.message}`);}
  });
  const folders=vscode.workspace.onDidChangeWorkspaceFolders(state),trust=vscode.workspace.onDidGrantWorkspaceTrust(state);
  panel.onDidDispose(()=>{listener.dispose();folders.dispose();trust.dispose();panel=undefined;panelReady=false;});
 };
 context.subscriptions.push(vscode.commands.registerCommand('personalIde.home',show),vscode.commands.registerCommand('personalIde.applyLayout',layout));
 const chatItem=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right,10000);chatItem.name='Codex sidebar';chatItem.accessibilityInformation={label:'Open or close Codex chat'};chatItem.text='$(hubot) Codex';chatItem.tooltip='Toggle Codex sidebar (Ctrl+Alt+I)';chatItem.command='personalIde.toggleCodex';chatItem.show();context.subscriptions.push(chatItem);
 if(context.globalState.get('layoutVersion')!==3){await layout();await context.globalState.update('layoutVersion',3);await vscode.commands.executeCommand('workbench.view.explorer');}
 const item=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,100);item.text='$(code) Personal IDE';item.tooltip='Open workspace overview';item.command='personalIde.home';item.show();context.subscriptions.push(item);
 if(!context.globalState.get('interfaceInitialized')){await layout();await context.globalState.update('interfaceInitialized',true);show();}
 if(!context.globalState.get('codexSidebarIntroduced')){await codex.show();await context.globalState.update('codexSidebarIntroduced',true);}
 return {isPanelReady:()=>panelReady,workflow,codex,jsConsole,toolbox};
};
