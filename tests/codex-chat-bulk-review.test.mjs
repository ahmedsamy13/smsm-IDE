import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";

const hostUrl=new URL("../interface/src/codex-host.cjs",import.meta.url);
const hostRequire=createRequire(hostUrl);
const source=fs.readFileSync(hostUrl,"utf8");

function fixture(){
 const reviews=new Map([['applied-file',{id:'applied-file',kind:'file'}],['restored-file',{id:'restored-file',kind:'file'}]]);
 const decisions=[];
 const inlineReview={
  list:()=>[...reviews.values()],inspect:id=>reviews.get(id),
  async decide(id,decision){decisions.push({id,decision});reviews.delete(id);},
 };
 const disposable=()=>({dispose(){}});
 const vscode={
  window:{registerWebviewViewProvider:disposable,onDidChangeActiveTextEditor:disposable},
  workspace:{isTrusted:true,registerTextDocumentContentProvider:disposable,onDidGrantWorkspaceTrust:disposable,onDidChangeTextDocument:disposable},
  commands:{registerCommand:disposable},
 };
 const context={subscriptions:[],workspaceState:{get:()=>undefined}};
 const module={exports:{}};
 const load=name=>name==='vscode'?vscode:name==='./codex-inline-review.cjs'?{registerInlineReview:()=>inlineReview}:hostRequire(name);
 vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:hostUrl.pathname})(load,module,module.exports);
 const api=module.exports.registerCodex(context);
 return {api,reviews,decisions,dispose:()=>context.subscriptions.forEach(item=>item.dispose())};
}

for(const decision of ['accept','decline']){
 test(`chat bulk ${decision} resolves applied and restored reviews without a live approval request`,async()=>{
  const f=fixture();
  try{
   // Applied edits return to the agent immediately and are absent from the RPC approval queue.
   await f.api.handle({type:'reviewAll',decision});
   assert.equal(f.api.getState().error,'');
   assert.deepEqual(f.decisions,[{id:'applied-file',decision},{id:'restored-file',decision}]);
   assert.equal(f.reviews.size,0);
   await f.api.handle({type:'reviewAll',decision});
   assert.equal(f.decisions.length,2,'Repeated clicks must not decide a file twice');
  }finally{f.dispose();}
 });
}
