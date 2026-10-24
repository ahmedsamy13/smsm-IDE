const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

exports.run = async () => {
  const evidence = { checks: [], editorVersion: vscode.version };
  const root = process.env.PERSONAL_IDE_SMOKE_ROOT;
  const workspace = path.join(root, 'workspace');
  const resultFile = path.join(root, 'result.json');
  let terminalTask;
  try {
    assert.equal(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath.toLowerCase(), workspace.toLowerCase());
    evidence.checks.push('project folder opened');
    const ui=vscode.extensions.getExtension('personal-ide.workspace-interface');
    if(ui){
      await vscode.commands.executeCommand('personalIde.codex');
      evidence.checks.push('Codex command available from a properly installed extension');
      const api=await ui.activate();
      await vscode.commands.executeCommand('personalIde.home');
      const deadline=Date.now()+20000;
      while(!api.isPanelReady() && Date.now()<deadline) await new Promise(r=>setTimeout(r,200));
      assert.equal(api.isPanelReady(),true,'React panel handshake');
      assert.equal(vscode.workspace.getConfiguration().get('workbench.colorTheme'),'Personal IDE Midnight');
      evidence.checks.push('custom theme applied and React webview loaded successfully');
    }


    const file = path.join(workspace, 'app.js');
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    await vscode.window.showTextDocument(document);
    assert.match(document.getText(), /foundation smoke fixture/);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, document.positionAt(document.getText().length), '\n// saved by the desktop editor\n');
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    assert.equal(await document.save(), true);
    assert.match(fs.readFileSync(file, 'utf8'), /saved by the desktop editor/);
    evidence.checks.push('editor opened, modified, and saved a real file');

    const terminalEvidencePath = path.join(root, 'terminal-result.json');
    const task = new vscode.Task(
      { type: 'personal-ide-verification' }, vscode.TaskScope.Workspace,
      'Foundation terminal verification', 'personal-ide',
      new vscode.ProcessExecution(process.env.PERSONAL_IDE_SMOKE_NODE,
        [path.join(__dirname, 'terminal-probe.cjs'), terminalEvidencePath], { cwd: workspace }),
    );
    task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Dedicated };
    let subscription;
    let timer;
    const completed = new Promise((resolve, reject) => {
      subscription = vscode.tasks.onDidEndTaskProcess(event => {
        if (event.execution.task.name === task.name) resolve(event.exitCode);
      });
      timer = setTimeout(() => reject(new Error('Integrated terminal task timed out after 60 seconds')), 60_000);
    });
    try {
      terminalTask = await vscode.tasks.executeTask(task);
      const exitCode = await completed;
      assert.equal(exitCode, 0);
    } finally {
      subscription.dispose();
      clearTimeout(timer);
    }
    evidence.terminal = JSON.parse(fs.readFileSync(terminalEvidencePath, 'utf8'));
    assert.equal(evidence.terminal.marker, 'personal-ide-integrated-terminal-ok');
    assert.equal(evidence.terminal.cwd.toLowerCase(), workspace.toLowerCase());
    assert.equal(evidence.terminal.stdoutIsTTY, true);
    evidence.checks.push('real process ran successfully in the integrated terminal PTY');
    if(process.env.PERSONAL_IDE_WORKFLOW_TEST==='1') await require('./workflow-checks.cjs').run(root,evidence);

    if (process.env.PERSONAL_IDE_CODEX_DESKTOP === '1') {
      const api = await vscode.extensions.getExtension('personal-ide.workspace-interface').activate();
      api.codex.show();
      const deadline = Date.now() + 30000;
      while (!api.codex.isPanelReady() && Date.now() < deadline) await new Promise(r => setTimeout(r, 200));
      assert.equal(api.codex.isPanelReady(), true, 'Codex React panel handshake');
      await api.codex.handle({type:'attach'});
      assert.ok(api.codex.getState().attachments.some(a=>a.name==='app.js'), 'Selected project context attached');
      await api.codex.connect();
      assert.equal(api.codex.getState().account.type, 'chatgpt');
      assert.equal(api.codex.getState().mode, 'ask');
      evidence.checks.push('Codex panel loaded and connected to a ChatGPT subscription with Ask first');
      await api.codex.send('Reply exactly PERSONAL_IDE_CODEX_UI_OK. Do not use tools.');
      const completeDeadline = Date.now() + 120000;
      while (api.codex.getState().busy && Date.now() < completeDeadline) await new Promise(r => setTimeout(r, 300));
      assert.equal(api.codex.getState().busy, false, 'Codex desktop turn completed');
      assert.equal(api.codex.getState().status, 'completed', api.codex.getState().error);
      assert.ok(api.codex.getState().messages.some(m=>m.role==='assistant'&&m.text.includes('PERSONAL_IDE_CODEX_UI_OK')));
      evidence.checks.push('Live streaming response reached the Codex desktop chat');
      await api.codex.handle({type:'disconnect'});
      assert.equal(api.codex.getState().connected,false);
      evidence.checks.push('Codex disconnect closed only the IDE connection');

      await api.codex.connect();
      await api.codex.send('Reply exactly PERSONAL_IDE_CODEX_RECONNECTED_OK. Do not use tools.');
      const reconnectDeadline=Date.now()+120000;
      while(api.codex.getState().busy&&Date.now()<reconnectDeadline)await new Promise(r=>setTimeout(r,300));
      assert.equal(api.codex.getState().status,'completed',api.codex.getState().error);
      assert.ok(api.codex.getState().messages.some(m=>m.role==='assistant'&&m.text.includes('PERSONAL_IDE_CODEX_RECONNECTED_OK')));
      evidence.checks.push('Codex conversation resumed after disconnect and reconnect');
      await api.codex.handle({type:'disconnect'});

    }

    if(process.env.PERSONAL_IDE_TOOLBOX_TEST==="1")await require("./toolbox-checks.cjs").run(root,evidence);
    evidence.passed = true;
  } catch (error) {
    terminalTask?.terminate();
    evidence.passed = false;
    evidence.error = error.stack || String(error);
    throw error;
  } finally {
    console.log(`PERSONAL_IDE_SMOKE_RESULT ${JSON.stringify(evidence)}`);
    try {
      await vscode.workspace.fs.writeFile(vscode.Uri.file(resultFile), Buffer.from(JSON.stringify(evidence, null, 2)));
    } catch (error) {
      console.error(`Could not persist desktop evidence: ${error.message}`);
    }
  }
};
