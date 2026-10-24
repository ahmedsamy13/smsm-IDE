const fs=require("node:fs"),crypto=require("node:crypto");
const {diffLines}=require("diff");
const proposals=require("./codex-proposals.cjs");
const digest=data=>data===null?null:crypto.createHash("sha256").update(data).digest("hex");
function create(root,args){
 const proposal=proposals.propose(root,args);
 const before=proposal.beforeHash===null?null:fs.readFileSync(proposal.file);
 const text=before?.toString("utf8")||"";
 if(before&&!Buffer.from(text).equals(before))throw Error("Review supports UTF-8 text files only.");
 const parts=diffLines(text,args.content,{timeout:1000,maxEditLength:10000});
 if(!parts)throw Error("Split this change into smaller proposals.");
 const hunks=[];let offset=0,oldLine=0,newLine=0,current=null;
 const finish=()=>{if(current){current.id=String(hunks.length);hunks.push(current);current=null;}};
 for(const part of parts){
  if(!part.added&&!part.removed){finish();offset+=part.value.length;oldLine+=part.count;newLine+=part.count;continue;}
  current||={start:offset,end:offset,before:"",after:"",oldLine,newLine,decision:null};
  if(part.removed){current.before+=part.value;offset+=part.value.length;current.end=offset;oldLine+=part.count;}
  else{current.after+=part.value;newLine+=part.count;}
 }
 finish();
 if(before===null&&!hunks.length)hunks.push({id:"0",start:0,end:0,before:"",after:"",oldLine:0,newLine:0,decision:null});
 return {...proposal,original:text,expectedHash:digest(before),hunks,accepted:0,rejected:0};
}
function render(review,includePending=false){
 let result="",cursor=0;
 for(const hunk of review.hunks){result+=review.original.slice(cursor,hunk.start);result+=(hunk.decision==="accept"||includePending&&hunk.decision===null)?hunk.after:hunk.before;cursor=hunk.end;}
 return result+review.original.slice(cursor);
}
function applyPending(root,review,dirtyFiles=[]){
 validate(root,review,dirtyFiles);
 review.createdDirectories=[];let dir=require("node:path").dirname(review.file);
 while(!fs.existsSync(dir)){review.createdDirectories.push(dir);dir=require("node:path").dirname(dir);}
 fs.mkdirSync(require("node:path").dirname(review.file),{recursive:true});
 const data=Buffer.from(render(review,true));fs.writeFileSync(review.file,data);review.expectedHash=digest(data);review.applied=true;
}
function validate(root,review,dirtyFiles){
 const target=proposals.resolveTarget(root,review.file);
 if(target!==review.file)throw Error("File location changed since the proposal.");
 if(dirtyFiles.some(file=>require("node:path").resolve(file).toLowerCase()===target.toLowerCase()))throw Error("Save or discard unsaved edits before reviewing.");
 const current=fs.existsSync(target)?fs.readFileSync(target):null;
 if(digest(current)!==review.expectedHash)throw Error("The file changed after this proposal. Later edits were preserved; restore the reviewed content before rejecting.");
}
function decide(root,review,hunkId,decision,dirtyFiles=[]){
 if(!["accept","decline"].includes(decision))throw Error("Invalid review decision");
 const selected=review.hunks.filter(h=>h.decision===null&&(hunkId===undefined||h.id===String(hunkId)));
 if(!selected.length)throw Error("This change has already been reviewed.");
 if(review.applied||decision==="accept")validate(root,review,dirtyFiles);
 for(const hunk of selected)hunk.decision=decision;
 try{
  if(!review.applied&&decision==="accept"||review.applied&&decision==="decline"){
   if(review.applied&&review.beforeHash===null&&review.hunks.every(h=>h.decision==="decline")){
    fs.unlinkSync(review.file);review.expectedHash=null;
    for(const dir of review.createdDirectories||[]){try{fs.rmdirSync(dir);}catch(error){if(["ENOTEMPTY","EEXIST"].includes(error.code))break;if(error.code!=="ENOENT")throw error;}}
   }else{
   const data=Buffer.from(render(review,!!review.applied));
   fs.mkdirSync(require("node:path").dirname(review.file),{recursive:true});
   fs.writeFileSync(review.file,data);review.expectedHash=digest(data);
   }
  }
 }catch(error){for(const hunk of selected)hunk.decision=null;throw error;}
 review.accepted=review.hunks.filter(h=>h.decision==="accept").length;
 review.rejected=review.hunks.filter(h=>h.decision==="decline").length;
 return {done:review.hunks.every(h=>h.decision!==null),success:review.accepted>0,text:review.label+": accepted "+review.accepted+" change(s), rejected "+review.rejected+" change(s). Rejected changes must not be applied or retried."};
}
function positions(review,proposed){
 let line=0,cursor=0;const result=[];
 const lines=text=>(text.match(/\n/g)||[]).length;
 for(const h of review.hunks){
  line+=lines(review.original.slice(cursor,h.start));
  const value=h.decision==="accept"||proposed&&h.decision===null?h.after:h.before;
  if(h.decision===null)result.push({id:h.id,line,count:Math.max(1,lines(value)),added:!!h.after,removed:!!h.before});
  line+=lines(value);cursor=h.end;
 }
 return result;
}
module.exports={create,applyPending,render,decide,positions};
