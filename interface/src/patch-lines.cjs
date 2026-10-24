function patchLines(diff){
 let oldLine=null,newLine=null,added=0,removed=0;
 const lines=String(diff||"").split("\n").slice(0,5000).map(text=>{
  const hunk=/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
  if(hunk){oldLine=Number(hunk[1]);newLine=Number(hunk[2]);return{text,kind:"meta",oldLine:null,newLine:null};}
  if(/^(---|\+\+\+|Index:|===|\\ No newline)/.test(text))return{text,kind:"meta",oldLine:null,newLine:null};
  if(text.startsWith("+")){added++;return{text,kind:"add",oldLine:null,newLine:newLine===null?null:newLine++};}
  if(text.startsWith("-")){removed++;return{text,kind:"remove",oldLine:oldLine===null?null:oldLine++,newLine:null};}
  if(text.startsWith(" "))return{text,kind:"context",oldLine:oldLine===null?null:oldLine++,newLine:newLine===null?null:newLine++};
  return{text,kind:"meta",oldLine:null,newLine:null};
 });
 return {lines,added,removed};
}
module.exports={patchLines};
