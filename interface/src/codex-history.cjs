const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function createHistory(storage){
 const directory=path.join(storage,'chat-history');fs.mkdirSync(directory,{recursive:true});
 const valid=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id);
 function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
 function write(file,value){
  const temporary=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value));
  try{fs.renameSync(temporary,file);}catch(error){if(error.code!=='EXDEV')throw error;fs.copyFileSync(temporary,file);fs.unlinkSync(temporary);}
 }
 function save(chat){
  if(!valid(chat.id))throw Error('Invalid chat ID');
  const title=chat.messages?.find(message=>message.role==='user')?.text?.split('\n')[0].trim().slice(0,100)||'New conversation';
  const updatedAt=Date.now(),value={...chat,title,updatedAt};
  write(path.join(directory,chat.id+'.json'),value);
  write(path.join(directory,chat.id+'.meta.json'),{id:chat.id,title,root:chat.root||'',updatedAt,messageCount:chat.messages?.length||0});
  return value;
 }
 function load(id){if(!valid(id))throw Error('Invalid chat ID');return read(path.join(directory,id+'.json'));}
 function list(){
  return fs.readdirSync(directory).filter(name=>name.endsWith('.meta.json')).flatMap(name=>{try{const value=read(path.join(directory,name));return value&&valid(value.id)&&typeof value.title==='string'&&typeof value.root==='string'&&Number.isFinite(value.updatedAt)?[value]:[];}catch{return [];}}).sort((a,b)=>b.updatedAt-a.updatedAt);
 }
 return {save,load,list};
}
module.exports={createHistory};
