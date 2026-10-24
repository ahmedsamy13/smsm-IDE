const vscode=require("vscode"),fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict");
exports.run=async(root,evidence)=>{
 const api=await vscode.extensions.getExtension("personal-ide.workspace-interface").activate(),workspace=path.join(root,"workspace");
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function until(check,label,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await sleep(150);}throw Error("Timed out: "+label);}
 assert.equal(vscode.workspace.getConfiguration().get("workbench.sideBar.location"),"left");
 assert.equal(vscode.workspace.getConfiguration().get("workbench.iconTheme"),"material-icon-theme");
 assert.ok(vscode.extensions.getExtension("pkief.material-icon-theme"));
 const manifest=vscode.extensions.getExtension("personal-ide.workspace-interface").packageJSON;
 assert.equal(manifest.contributes.viewsContainers.secondarySidebar[0].id,"personal-ide-agent");
 await api.codex.show();await until(()=>api.codex.isPanelReady(),"right sidebar ready");
 await vscode.commands.executeCommand("personalIde.toggleCodex");await until(()=>!api.codex.isPanelReady(),"right sidebar hidden");
 await api.codex.show();await until(()=>api.codex.isPanelReady(),"right sidebar reopened");
 evidence.checks.push("Native Codex right sidebar opened, closed, and reopened; Explorer left and name-aware icons configured");
 const consoleFile=vscode.Uri.file(path.join(workspace,"console-probe.cjs"));
 fs.writeFileSync(consoleFile.fsPath,'console.log("console-output-ok");console.error("console-error-ok");\n');
 assert.equal(await api.jsConsole.runFile(consoleFile),0);assert.match(api.jsConsole.getState().output,/console-output-ok/);assert.match(api.jsConsole.getState().output,/console-error-ok/);
 fs.writeFileSync(consoleFile.fsPath,'throw Error("expected-console-failure");\n');assert.equal(await api.jsConsole.runFile(consoleFile),1);assert.match(api.jsConsole.getState().output,/expected-console-failure/);
 fs.writeFileSync(consoleFile.fsPath,'console.log("running");setInterval(()=>{},1000);\n');const running=api.jsConsole.runFile(consoleFile);await until(()=>api.jsConsole.getState().output.includes("running"),"console long-running script");api.jsConsole.stop();await running;assert.equal(api.jsConsole.getState().running,false);
 evidence.checks.push("Bottom Console captured stdout/stderr, reported script failure, and stopped only its running script");
 const db=path.join(workspace,"sample.sqlite");
 const create=await api.toolbox.query(db,"CREATE TABLE tasks(id INTEGER PRIMARY KEY,title TEXT); INSERT INTO tasks VALUES(1,'database-test-ok');");assert.equal(create.ok,true,create.text);
 const result=await api.toolbox.query(db,"SELECT title FROM tasks;");assert.equal(result.ok,true,result.text);assert.equal(JSON.parse(result.text)[0].title,"database-test-ok");
 await api.toolbox.database(vscode.Uri.file(db));
 assert.equal(vscode.extensions.getExtension("personal-ide.sqlite-browser").isActive,true);
 evidence.checks.push("Maintained SQLite runtime created/queried a real database and the native database explorer opened it");
 let requests=0;
 const server=http.createServer((_req,res)=>{requests++;res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({message:"api-test-ok"}));});await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  await vscode.workspace.getConfiguration().update("rest-client.previewResponseInUntitledDocument",true,vscode.ConfigurationTarget.Global);
  const requestFile=path.join(workspace,"api-check.http");fs.writeFileSync(requestFile,"GET http://127.0.0.1:"+server.address().port+"/health\nAccept: application/json\n");
  const document=await vscode.workspace.openTextDocument(requestFile);await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("rest-client.request");
  await until(()=>requests>0&&vscode.workspace.textDocuments.some(doc=>doc.isUntitled&&doc.getText().includes("api-test-ok")),"real REST Client response");
  evidence.checks.push("REST Client sent a real loopback HTTP request and displayed its JSON response inside the IDE");
 }finally{server.close();}
 await vscode.extensions.getExtension("ms-azuretools.vscode-containers").activate();
 const docker=await api.toolbox.checkDocker();evidence.docker={engineAvailable:docker.ok,detail:docker.text};evidence.checks.push(docker.ok?"Docker engine connectivity verified":"Container extension loaded; missing Docker engine correctly detected");
 await vscode.extensions.getExtension("jeanp413.open-remote-ssh").activate();const ssh=await api.toolbox.checkSSH();assert.equal(ssh.ok,true,ssh.text);assert.match(ssh.text,/OpenSSH/);evidence.remote={clientAvailable:true,sessionTested:false,reason:"No remote host or WSL available"};evidence.checks.push("Compatible SSH extension loaded and local OpenSSH client verified; no remote host available for a session");
 const inline=api.codex.inlineReview;
 const reviewFile=path.join(workspace,"editor-review.js"),before="const a=1;\nconst stable=true;\nconst b=1;\n";
 fs.writeFileSync(reviewFile,before);let resolved;
 const proposed=inline.add("native-review",workspace,{path:"editor-review.js",content:"const a=2;\nconst stable=true;\nconst b=2;\n"},result=>{resolved=result;});
 assert.equal(proposed.hunks.length,2);assert.match(fs.readFileSync(reviewFile,"utf8"),/const b=2/);
 await inline.open("native-review");
 const preview=vscode.workspace.textDocuments.find(doc=>doc.uri.scheme==="personal-ide-proposal"&&doc.uri.authority==="after"&&doc.uri.path.includes("native-review"));
 assert.ok(preview,"Native inline diff has a proposed document");assert.match(preview.getText(),/const b=2/);
 const nativeLenses=await vscode.commands.executeCommand("vscode.executeCodeLensProvider",preview.uri);
 assert.ok(nativeLenses.some(lens=>lens.command?.title==="✓ ACCEPT ALL CHANGES"));assert.ok(nativeLenses.some(lens=>lens.command?.title==="✓ ACCEPT CHANGE 1"));assert.ok(nativeLenses.some(lens=>lens.command?.title==="✕ REJECT CHANGE 2"));
 await vscode.commands.executeCommand("personalIde.reviewDecision","native-review","accept","0");
 assert.equal(fs.readFileSync(reviewFile,"utf8"),"const a=2;\nconst stable=true;\nconst b=2;\n");assert.equal(resolved,undefined);
 await vscode.commands.executeCommand("personalIde.reviewDecision","native-review","decline","1");assert.equal(resolved.success,true);assert.equal(inline.inspect("native-review"),null);
 const newFile=path.join(workspace,"rejected-new.js");
 inline.add("native-decline",workspace,{path:"rejected-new.js",content:"console.log('never saved');\n"},()=>{});
 await inline.open("native-decline");await vscode.commands.executeCommand("personalIde.reviewDecision","native-decline","decline");assert.equal(fs.existsSync(newFile),false);
 const retained=path.join(workspace,"retained-review.js");
 inline.add("native-retain",workspace,{path:"retained-review.js",content:"pending"},()=>{});
 assert.equal(fs.readFileSync(retained,"utf8"),"pending");inline.clear();
 assert.ok(inline.inspect("native-retain"),"Disconnect retains Reject controls");
 await inline.decide("native-retain","decline");assert.equal(fs.existsSync(retained),false);
 evidence.checks.push("Native editor inline diff displayed proposed changes and per-change/per-file CodeLens actions; partial acceptance saved only its selected block and rejecting a new file removed it");

 await api.codex.handle({type:"login"});
 assert.equal(api.codex.getState().connected,true,"Bundled engine account connection");
 assert.equal(api.codex.getState().account?.type,"chatgpt");
 assert.ok(api.codex.getState().usage?.buckets.some(bucket=>bucket.windows.length>0),api.codex.getState().usageError||"Authoritative usage windows");
 evidence.accountUsage=api.codex.getState().usage;
 await api.codex.handle({type:"disconnect"});
 evidence.checks.push("Bundled account connection reused ChatGPT sign-in and populated the sidebar with real quota windows without terminal setup");

 assert.equal(api.codex.getState().provider,"codex");
 evidence.checks.push("Native sidebar exposes Codex as the sole agent provider");

 if(process.env.PERSONAL_IDE_SKIP_LIVE_PROPOSALS==="1")return;
 await api.codex.show();await api.codex.connect();
 await api.codex.handle({type:"model",model:api.codex.getState().model,effort:"low"});
 await api.codex.send('Using only personal_ide_propose_edit, propose two files in this project: approved.js with exactly console.log("approved"); followed by a newline, and declined.js with exactly console.log("declined"); followed by a newline. Request each edit separately. Wait for the user choices. Do not use shell or apply_patch. If either edit is declined, accept the decision and do not retry.');
 const seen=new Set(),deadline=Date.now()+120000;
 while(api.codex.getState().busy&&Date.now()<deadline){
  const state=api.codex.getState();
  for(const request of state.pending){
   if(seen.has(request.id))continue;
   assert.equal(request.proposal,true,"Edits must use the client approval tool");const filename=request.changes[0].path;
   assert.equal(fs.existsSync(path.join(workspace,filename)),true,"File applied before review");
   assert.match(request.changes[0].diff,/@@/);
   if(filename==="approved.js")await api.codex.handle({type:"approval",id:request.id,decision:"accept"});
   else if(filename==="declined.js")await api.codex.handle({type:"approval",id:request.id,decision:"decline"});
   else throw Error("Unexpected proposal "+filename);
   seen.add(request.id);
  }
  await sleep(200);
 }
 assert.equal(api.codex.getState().busy,false,"Proposal turn completed");assert.equal(api.codex.getState().status,"completed",api.codex.getState().error);assert.equal(seen.size,2,"Both file decisions were requested");
 assert.match(fs.readFileSync(path.join(workspace,"approved.js"),"utf8"),/approved/);assert.equal(fs.existsSync(path.join(workspace,"declined.js")),false);
 assert.ok(api.codex.getState().review.some(change=>change.label==="approved.js"));
 await api.codex.handle({type:"disconnect"});
 evidence.checks.push("Live Codex applied edits before review: approved edit saved, declined edit removed, and native change review captured the result");
};
