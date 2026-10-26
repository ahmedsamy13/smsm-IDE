const vscode=require("vscode"),path=require("node:path");
const hunks=require("./codex-hunks.cjs");
function registerInlineReview(context){
 const entries=new Map(),changed=new vscode.EventEmitter(),lenses=new vscode.EventEmitter();
 const scheme="personal-ide-proposal";
 const fs=require("node:fs");
 fs.mkdirSync(context.globalStorageUri.fsPath,{recursive:true});
 let storage=fs.realpathSync.native(context.globalStorageUri.fsPath);if(/^[a-z]:/.test(storage))storage=storage[0].toUpperCase()+storage.slice(1);
 const journal=path.join(storage,"pending-file-reviews.json");
 function persist(){
  fs.mkdirSync(path.dirname(journal),{recursive:true});
  const data=[...entries.values()].map(({id,root,review})=>({id,root,review}));
  fs.writeFileSync(journal+".tmp",JSON.stringify(data));fs.renameSync(journal+".tmp",journal);
 }
 try{if(fs.existsSync(journal))for(const entry of JSON.parse(fs.readFileSync(journal,"utf8"))){entries.set(entry.id,{...entry,onResolve:()=>{}});}}
 catch(error){vscode.window.showErrorMessage("Pending edit reviews could not be restored: "+error.message);}

 const inserted=vscode.window.createTextEditorDecorationType({isWholeLine:true,backgroundColor:"rgba(46,160,90,0.16)",overviewRulerColor:"#3fb950",overviewRulerLane:vscode.OverviewRulerLane.Right});
 const removed=vscode.window.createTextEditorDecorationType({isWholeLine:true,backgroundColor:"rgba(248,81,73,0.14)",overviewRulerColor:"#f85149",overviewRulerLane:vscode.OverviewRulerLane.Right});
 const uri=(entry,side)=>vscode.Uri.from({scheme,authority:side,path:"/"+entry.id+"/"+entry.review.label.replaceAll("\\","/")});
 const lookup=document=>[...entries.values()].find(entry=>document.uri.scheme===scheme?document.uri.path.startsWith("/"+entry.id+"/"):document.uri.scheme==="file"&&document.uri.fsPath.toLowerCase()===entry.review.file.toLowerCase());
 const content=entry=>({...entry.review,hunks:entry.review.hunks.map(h=>({...h}))});
 function list(root){return [...entries.values()].filter(entry=>!root||path.resolve(entry.root).toLowerCase()===path.resolve(root).toLowerCase()).map(entry=>({id:entry.id,kind:"file",reason:entry.review.summary||"Changes applied and ready to accept or reject.",changes:entry.review.changes,proposal:true,remaining:entry.review.hunks.filter(h=>h.decision===null).length}));}
 function refresh(entry){
  persist();
  if(entry){changed.fire(uri(entry,"before"));changed.fire(uri(entry,"after"));}
  lenses.fire();
  for(const editor of vscode.window.visibleTextEditors){
   const entry=lookup(editor.document);const added=[],deleted=[];
   if(entry){
    const proposed=editor.document.uri.scheme==="file"||editor.document.uri.authority==="after";
    for(const block of hunks.positions(entry.review,proposed)){
     const line=Math.min(block.line,editor.document.lineCount-1),last=Math.min(editor.document.lineCount-1,line+block.count-1);
     const range=new vscode.Range(line,0,last,editor.document.lineAt(last).text.length);
     (proposed?added:deleted).push(range);
    }
   }
   editor.setDecorations(inserted,added);editor.setDecorations(removed,deleted);
  }
 }
 async function open(id){
  const entry=entries.get(String(id));if(!entry)throw Error("This proposal is no longer pending.");
  await vscode.workspace.getConfiguration("diffEditor").update("codeLens",true,vscode.ConfigurationTarget.Global);
  await vscode.commands.executeCommand("vscode.diff",uri(entry,"before"),uri(entry,"after"),entry.review.label+" · Codex review",{preview:false,renderSideBySide:false});
  refresh(entry);
 }
 function remove(id){const entry=entries.get(String(id));if(!entry)return;if(entry.review.hunks.some(h=>h.decision===null)){entry.onResolve=()=>{};entry.onChange=undefined;persist();return;}entries.delete(String(id));changed.fire(uri(entry,"before"));changed.fire(uri(entry,"after"));refresh();}
 async function decide(id,decision,hunkId){
  const entry=entries.get(String(id));if(!entry)throw Error("This proposal is no longer pending.");
  if(!vscode.workspace.isTrusted)throw Error("Workspace trust is required.");
  const dirty=vscode.workspace.textDocuments.filter(doc=>doc.uri.scheme==="file"&&doc.isDirty).map(doc=>doc.uri.fsPath);
  const result=hunks.decide(entry.root,entry.review,hunkId,decision,dirty);
  refresh(entry);entry.onChange?.(entry.review);
  if(result.done){
   const active=lookup(vscode.window.activeTextEditor?.document||{uri:{scheme:""}});
   await entry.onResolve(result);remove(id);
   const tabs=vscode.window.tabGroups.all.flatMap(group=>group.tabs).filter(tab=>tab.input?.modified?.scheme===scheme&&tab.input.modified.path.startsWith("/"+entry.id+"/"));
   if(tabs.length)await vscode.window.tabGroups.close(tabs,true);
   if(active===entry&&require("node:fs").existsSync(entry.review.file))await vscode.window.showTextDocument(vscode.Uri.file(entry.review.file),{preview:false});
  }
  return result;
 }
 const safe=fn=>async(...args)=>{try{return await fn(...args);}catch(error){vscode.window.showErrorMessage(error.message);}};
 context.subscriptions.push(changed,lenses,inserted,removed,
  vscode.workspace.registerTextDocumentContentProvider(scheme,{onDidChange:changed.event,provideTextDocumentContent(value){const entry=[...entries.values()].find(e=>value.path.startsWith("/"+e.id+"/"));return entry?hunks.render(entry.review,value.authority==="after"):"This edit review has ended.";}}),
  vscode.languages.registerCodeLensProvider([{scheme},{scheme:"file"}],{onDidChangeCodeLenses:lenses.event,provideCodeLenses(document){
   const entry=lookup(document);if(!entry)return [];
   const result=[],range=new vscode.Range(0,0,0,0);
   if(entries.size>1)for(const [title,decision]of [["Accept all pending files","accept"],["Reject all pending files","decline"]])result.push(new vscode.CodeLens(range,{title,command:"personalIde.reviewAllFiles",arguments:[decision]}));
   for(const [title,decision]of [["✓ ACCEPT ALL CHANGES","accept"],["✕ REJECT ALL CHANGES","decline"]])result.push(new vscode.CodeLens(range,{title,command:"personalIde.reviewDecision",arguments:[entry.id,decision]}));
   if(document.uri.scheme==="file")result.push(new vscode.CodeLens(range,{title:"Open Codex inline diff",command:"personalIde.reviewProposedFile",arguments:[entry.id]}));
   const proposed=document.uri.scheme==="file"||document.uri.authority==="after";
   for(const block of hunks.positions(entry.review,proposed)){
    const at=new vscode.Range(Math.min(block.line,document.lineCount-1),0,Math.min(block.line,document.lineCount-1),0);
    for(const [title,decision]of [["✓ ACCEPT","accept"],["✕ REJECT","decline"]])result.push(new vscode.CodeLens(at,{title:title+" CHANGE "+(Number(block.id)+1),command:"personalIde.reviewDecision",arguments:[entry.id,decision,block.id]}));
   }
   return result;
  }}),
  vscode.commands.registerCommand("personalIde.reviewAllFiles",safe(async decision=>{if(!["accept","decline"].includes(decision))throw Error("Invalid review decision");for(const id of [...entries.keys()])if(entries.has(id))await decide(id,decision);})),
  vscode.commands.registerCommand("personalIde.reviewDecision",safe(decide)),
  vscode.commands.registerCommand("personalIde.reviewProposedFile",safe(open)),
  vscode.window.onDidChangeVisibleTextEditors(()=>refresh()),
  vscode.workspace.onDidChangeTextDocument(event=>{if(event.document.uri.scheme==="file")lenses.fire();}),
 );
 return {
  add(id,root,args,onResolve,onChange){
   id=String(id);if(entries.has(id))throw Error("Duplicate proposal.");
   const review=hunks.create(root,args);
   if([...entries.values()].some(e=>e.review.file.toLowerCase()===review.file.toLowerCase()))throw Error("Resolve the pending proposal for this file first.");
   if(!review.hunks.length){onResolve({done:true,success:true,text:"No changes needed."});return null;}
   const dirty=vscode.workspace.textDocuments.filter(doc=>doc.uri.scheme==="file"&&doc.isDirty).map(doc=>doc.uri.fsPath);
   hunks.applyPending(root,review,dirty);
   const entry={id,root,review,onResolve,onChange};entries.set(id,entry);refresh(entry);return review;
  },
  open,decide,remove,clear(){for(const entry of entries.values()){entry.onResolve=()=>{};entry.onChange=undefined;}refresh();},
  inspect(id){const entry=entries.get(String(id));return entry?content(entry):null;},list,
 };
}
module.exports={registerInlineReview};
