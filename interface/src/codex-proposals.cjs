const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const{createTwoFilesPatch}=require("diff");
const limit=1024*1024;
function resolveTarget(root,name){
 if(typeof name!=="string"||!name.trim()||name.includes("\0"))throw Error("A project file path is required");
 const base=fs.realpathSync(root),file=path.resolve(base,name);let existing=file,tail=[];
 while(!fs.existsSync(existing)){const parent=path.dirname(existing);if(parent===existing)throw Error("Invalid file path");tail.unshift(path.basename(existing));existing=parent;}
 const real=path.join(fs.realpathSync(existing),...tail),relative=path.relative(base,real);
 if(!relative||relative===".."||relative.startsWith(".."+path.sep)||path.isAbsolute(relative))throw Error("File proposals must stay inside the project");
 if(relative.split(path.sep).some(part=>[".git","node_modules",".runtime"].includes(part)))throw Error("This directory cannot be edited through file proposals");
 if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error("Symbolic link targets are not edited");
 return real;
}
function read(file){if(!fs.existsSync(file))return null;const stat=fs.statSync(file);if(!stat.isFile()||stat.size>limit)throw Error("Review supports text files up to 1 MiB");const data=fs.readFileSync(file);if(data.includes(0))throw Error("Binary files cannot be reviewed");return data;}
const hash=data=>data===null?null:crypto.createHash("sha256").update(data).digest("hex");
function propose(root,args){
 if(!args||typeof args.content!=="string"||Buffer.byteLength(args.content)>limit)throw Error("Proposed content must be text of at most 1 MiB");
 const file=resolveTarget(root,args.path),before=read(file),after=Buffer.from(args.content),label=path.relative(fs.realpathSync(root),file);
 const diff=createTwoFilesPatch(label,label,before?.toString("utf8")||"",args.content,"before","proposed",{context:3,timeout:1000,maxEditLength:10000});
 if(typeof diff!=="string")throw Error("This change is too large to review automatically; split it into smaller changes");
 return {file,label,beforeHash:hash(before),after,changes:[{path:label,diff}],summary:typeof args.summary==="string"?args.summary.slice(0,500):""};
}
function apply(root,proposal,dirtyFiles=[]){
 const target=resolveTarget(root,proposal.file);
 if(target!==proposal.file)throw Error("File location changed since the proposal");
 if(dirtyFiles.some(file=>resolveTarget(root,file).toLowerCase()===target.toLowerCase()))throw Error("Save or discard unsaved edits before approving");
 if(hash(read(target))!==proposal.beforeHash)throw Error("The file changed after this proposal. Ask for a fresh proposal.");
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,proposal.after);
 return "Approved and saved "+proposal.label;
}
function response(success,text){return {success,contentItems:[{type:"inputText",text}]};}
const tool={type:"function",name:"personal_ide_propose_edit",description:"Apply a complete UTF-8 project file immediately, then return so the agent can continue through all requested files and folders. The IDE creates missing parent folders. The user reviews the full set after the turn with Accept all changes or Reject all; changes remain visible in the editor meanwhile. Use for every file addition or modification; do not write project files through shell commands or apply_patch.",inputSchema:{type:"object",properties:{path:{type:"string",description:"Path relative to the project; missing parent folders are created"},content:{type:"string",description:"Complete new file text"},summary:{type:"string"}},required:["path","content"],additionalProperties:false}};
module.exports={propose,apply,response,tool,resolveTarget};
