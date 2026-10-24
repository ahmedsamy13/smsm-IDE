import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";import path from "node:path";import os from "node:os";import {createRequire}from"node:module";
const require=createRequire(import.meta.url),hunks=require("../interface/src/codex-hunks.cjs"),{shouldSend}=require("../interface/src/codex-input.cjs");
function fixture(before,after){const root=fs.mkdtempSync(path.join(os.tmpdir(),"ide-inline-"));if(before!==null)fs.writeFileSync(path.join(root,"app.js"),before);return {root,review:hunks.create(root,{path:"app.js",content:after}),file:path.join(root,"app.js")};}
test("individual decisions save only accepted hunks, and the response describes partial acceptance",()=>{
 const {root,review,file}=fixture("const a=1;\nconst stable=true;\nconst b=1;\n","const a=2;\nconst stable=true;\nconst b=2;\n");
 assert.equal(review.hunks.length,2);assert.equal(fs.readFileSync(file,"utf8"),review.original);
 const first=hunks.decide(root,review,"0","accept");assert.equal(first.done,false);assert.equal(fs.readFileSync(file,"utf8"),"const a=2;\nconst stable=true;\nconst b=1;\n");
 assert.equal(hunks.render(review,true),"const a=2;\nconst stable=true;\nconst b=2;\n");
 const last=hunks.decide(root,review,"1","decline");assert.equal(last.done,true);assert.equal(last.success,true);assert.match(last.text,/accepted 1.*rejected 1/);assert.equal(hunks.render(review,true),fs.readFileSync(file,"utf8"));
 assert.throws(()=>hunks.decide(root,review,"1","accept"),/already/);
});
test("reject all never creates a proposed new file; accepting all handles CRLF and Unicode",()=>{
 let f=fixture(null,"export const label='مرحبا';\r\n");hunks.decide(f.root,f.review,undefined,"decline");assert.equal(fs.existsSync(f.file),false);
 f=fixture("const a=1;\r\nconst keep=true;\r\nconst b=1;","const a='✓';\r\nconst keep=true;\r\nconst b=3;");hunks.decide(f.root,f.review,undefined,"accept");assert.equal(fs.readFileSync(f.file,"utf8"),"const a='✓';\r\nconst keep=true;\r\nconst b=3;");
});
test("later partial acceptance refuses external or unsaved edits without consuming the pending choice",()=>{
 const {root,review,file}=fixture("a\nkeep\nb\n","A\nkeep\nB\n");hunks.decide(root,review,"0","accept");
 assert.throws(()=>hunks.decide(root,review,"1","accept",[file]),/unsaved/);assert.equal(review.hunks[1].decision,null);
 fs.writeFileSync(file,"manual change");assert.throws(()=>hunks.decide(root,review,"1","accept"),/preserved/);assert.equal(fs.readFileSync(file,"utf8"),"manual change");hunks.decide(root,review,"1","decline");assert.equal(fs.readFileSync(file,"utf8"),"manual change");
});
test("review line positions stay correct after accepting insertions and rejecting deletions",()=>{
 const {root,review}=fixture("first\nkeep\nlast\n","first\nadded\nkeep\n");
 assert.equal(review.hunks.length,2);assert.deepEqual(hunks.positions(review,true).map(h=>h.line),[1,3]);hunks.decide(root,review,"0","accept");assert.equal(hunks.positions(review,false)[0].line,3);
});
test("Enter sends, Shift+Enter inserts a line, and IME composition never sends",()=>{
 assert.equal(shouldSend({key:"Enter"}),true);assert.equal(shouldSend({key:"Enter",shiftKey:true}),false);assert.equal(shouldSend({key:"Enter",isComposing:true}),false);assert.equal(shouldSend({key:"Enter",nativeEvent:{isComposing:true}}),false);assert.equal(shouldSend({key:"Enter",keyCode:229}),false);assert.equal(shouldSend({key:"x"}),false);
});

test("an empty new file still requires an explicit decision",()=>{const {root,review,file}=fixture(null,"");assert.equal(review.hunks.length,1);assert.equal(fs.existsSync(file),false);hunks.decide(root,review,undefined,"accept");assert.equal(fs.readFileSync(file,"utf8"),"");});

test("apply-first keeps pending hunks until rejected and restores original bytes",()=>{
 const f=fixture("a\r\nkeep\r\nb\r\n","A\r\nkeep\r\nB\r\n");
 hunks.applyPending(f.root,f.review);
 assert.equal(fs.readFileSync(f.file,"utf8"),"A\r\nkeep\r\nB\r\n");
 hunks.decide(f.root,f.review,"0","accept");
 assert.equal(fs.readFileSync(f.file,"utf8"),"A\r\nkeep\r\nB\r\n");
 hunks.decide(f.root,f.review,"1","decline");
 assert.equal(fs.readFileSync(f.file,"utf8"),"A\r\nkeep\r\nb\r\n");
});
test("apply-first removes new files and only empty owned parent folders",()=>{
 const f=fixture(null,"");
 f.review=hunks.create(f.root,{path:"new/nested/empty.ts",content:""});
 hunks.applyPending(f.root,f.review);assert.equal(fs.existsSync(f.review.file),true);
 fs.writeFileSync(path.join(f.root,"new","keep.txt"),"user");
 hunks.decide(f.root,f.review,undefined,"decline");
 assert.equal(fs.existsSync(f.review.file),false);
 assert.equal(fs.existsSync(path.join(f.root,"new","nested")),false);
 assert.equal(fs.readFileSync(path.join(f.root,"new","keep.txt"),"utf8"),"user");
});
test("apply-first rejection refuses later manual or unsaved edits",()=>{
 const f=fixture("before","after");hunks.applyPending(f.root,f.review);
 assert.throws(()=>hunks.decide(f.root,f.review,undefined,"decline",[f.file]),/unsaved/);
 fs.writeFileSync(f.file,"manual");
 assert.throws(()=>hunks.decide(f.root,f.review,undefined,"decline"),/preserved/);
 assert.equal(fs.readFileSync(f.file,"utf8"),"manual");assert.equal(f.review.hunks[0].decision,null);
});
