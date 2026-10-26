import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const hostUrl=new URL('../interface/src/codex-host.cjs',import.meta.url),require=createRequire(hostUrl);
const {createHistory}=require('./codex-history.cjs');
const source=fs.readFileSync(hostUrl,'utf8');
function memento(initial={}){const values=new Map(Object.entries(initial));return {get:key=>values.get(key),async update(key,value){values.set(key,value);}};}
function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'ide-history-'));
 const project=path.join(base,'project one'),other=path.join(base,'project two'),storage=path.join(base,'storage');
 fs.mkdirSync(project);fs.mkdirSync(other);const globalState=memento();const disposables=[];
 t.after(()=>{for(const item of disposables)item.dispose();fs.rmSync(base,{recursive:true,force:true});});
 function open(root=project,saved={},trusted=true){
  const dialogs=[],commands=[];let selected;
  const disposable=()=>({dispose(){}});
  const vscode={Uri:{file:fsPath=>({fsPath})},window:{showOpenDialog:async options=>{dialogs.push(options);return selected;},registerWebviewViewProvider:disposable,onDidChangeActiveTextEditor:disposable},workspace:{isTrusted:trusted,workspaceFolders:[{uri:{fsPath:root}}],registerTextDocumentContentProvider:disposable,onDidGrantWorkspaceTrust:disposable,onDidChangeTextDocument:disposable},commands:{registerCommand:disposable,async executeCommand(...args){commands.push(args);}}};
  const context={subscriptions:[],globalStorageUri:{fsPath:storage},globalState,workspaceState:memento({'personalIde.codexChat':saved})};
  const module={exports:{}};
  const load=name=>name==='vscode'?vscode:name==='./codex-inline-review.cjs'?{registerInlineReview:()=>({list:()=>[],clear(){}})}:require(name);
  vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:hostUrl.pathname})(load,module,module.exports);
  const api=module.exports.registerCodex(context);disposables.push(...context.subscriptions);
  return {api,context,dialogs,commands,pick(folder){selected=folder?[{fsPath:folder}]:undefined;}};
 }
 return {base,project,other,storage,globalState,open};
}
test('history persists separate chats, project metadata, and rejects path traversal',t=>{
 const f=fixture(t),history=createHistory(f.storage);
 history.save({id:'chat-one',root:f.project,messages:[{role:'user',text:'Build a dashboard\nDetails'}],threadId:'thread-one'});
 history.save({id:'chat-two',root:f.other,messages:[]});
 const restored=createHistory(f.storage);
 assert.equal(restored.list().length,2);assert.equal(restored.load('chat-one').title,'Build a dashboard');
 assert.equal(restored.load('chat-one').threadId,'thread-one');assert.equal(restored.list().find(c=>c.id==='chat-two').root,f.other);
 assert.throws(()=>restored.load('../private'),/Invalid chat/);
 fs.writeFileSync(path.join(f.storage,'chat-history','broken.meta.json'),'{');assert.equal(restored.list().length,2);
});
test('New Chat always asks for a folder; Cancel preserves the current conversation',async t=>{
 const f=fixture(t),ui=f.open(f.project,{messages:[{role:'user',text:'Keep this conversation'}],root:f.project,threadId:'thread-original',toolVersion:1});
 const before=ui.api.getState();await ui.api.handle({type:'newChat'});
 assert.equal(ui.dialogs.length,1);assert.equal(ui.dialogs[0].canSelectFolders,true);assert.equal(ui.dialogs[0].canSelectFiles,false);
 assert.equal(ui.api.getState().chatId,before.chatId);assert.equal(ui.api.getState().messages[0].text,'Keep this conversation');assert.equal(ui.commands.length,0);
});
test('migrating the existing saved conversation keeps one stable history entry across restarts',async t=>{
 const f=fixture(t),ui=f.open(f.project,{messages:[{role:'user',text:'Existing chat'}],root:f.project});
 await new Promise(resolve=>setImmediate(resolve));
 const reopened=f.open(f.project,ui.context.workspaceState.get('personalIde.codexChat'));
 assert.equal(reopened.api.getState().chatId,ui.api.getState().chatId);
 assert.equal(reopened.api.getState().history.length,1);
});
test('same-project new chat archives the old chat and history restores its messages and thread',async t=>{
 const f=fixture(t),ui=f.open(f.project,{messages:[{role:'user',text:'Original chat'}],root:f.project,threadId:'thread-original',toolVersion:1});
 const originalId=ui.api.getState().chatId;ui.pick(f.project);await ui.api.handle({type:'newChat'});
 assert.equal(ui.api.getState().error,'');assert.notEqual(ui.api.getState().chatId,originalId);assert.equal(ui.api.getState().messages.length,0);
 assert.equal(ui.api.getState().history.length,2);assert.equal(ui.commands.length,0);
 await ui.api.handle({type:'openChat',id:originalId});assert.equal(ui.api.getState().chatId,originalId);assert.equal(ui.api.getState().messages[0].text,'Original chat');
 assert.equal(ui.context.workspaceState.get('personalIde.codexChat').threadId,'thread-original');
});
test('a different project opens in the editor and hands off the selected chat without inheriting trust',async t=>{
 const f=fixture(t),ui=f.open();ui.pick(f.other);await ui.api.handle({type:'newChat'});
 assert.equal(ui.api.getState().error,'');assert.equal(ui.commands[0][0],'vscode.openFolder');assert.equal(ui.commands[0][1].fsPath,f.other);
 assert.deepEqual(ui.commands[0][2],{forceReuseWindow:true});
 const selection=f.globalState.get('personalIde.chatSelection');assert.equal(selection.root,f.other);
 const reopened=f.open(f.other,{},false);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(reopened.api.getState().chatId,selection.id);assert.equal(reopened.api.getState().root,f.other);assert.equal(reopened.api.getState().trusted,false);
 assert.equal(f.globalState.get('personalIde.chatSelection'),undefined);
 assert.equal(reopened.context.workspaceState.get('personalIde.codexChat').id,selection.id);
});
