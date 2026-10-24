function windowData(value){
 if(!value||typeof value.usedPercent!=="number"||!Number.isFinite(value.usedPercent))return null;
 const used=Math.min(100,Math.max(0,value.usedPercent));
 const duration=Number.isFinite(value.windowDurationMins)&&value.windowDurationMins>0?value.windowDurationMins:null;
 const label=duration===null?"Allowance":duration%1440===0?duration/1440+"d":duration%60===0?duration/60+"h":duration+"m";
 return {usedPercent:used,remainingPercent:Math.round((100-used)*10)/10,label,resetsAt:Number.isFinite(value.resetsAt)&&value.resetsAt>0?value.resetsAt:null};
}
function normalizeUsage(result,now=Date.now()){
 const entries=result?.rateLimitsByLimitId&&Object.keys(result.rateLimitsByLimitId).length?Object.entries(result.rateLimitsByLimitId):result?.rateLimits?[["codex",result.rateLimits]]:[];
 const buckets=entries.filter(([,s])=>s&&typeof s==="object").map(([id,snapshot])=>({id,label:snapshot.limitName||snapshot.limitId||id,windows:[windowData(snapshot.primary),windowData(snapshot.secondary)].filter(Boolean)}));
 const selected=buckets.find(b=>b.id==="codex")||buckets.find(b=>b.windows.length)||buckets[0];
 return {updatedAt:now,buckets,selectedId:selected?.id||null,ordinaryUsageAllowed:typeof result?.ordinaryUsageAllowed==="boolean"?result.ordinaryUsageAllowed:null};
}
function managedLoginUrl(result){
 if(result?.type!=="chatgpt"||typeof result.authUrl!=="string")throw Error("The sign-in provider returned an unsupported response.");
 const url=new URL(result.authUrl);
 if(url.protocol!=="https:"||url.username||url.password||!["auth.openai.com","chatgpt.com","auth0.openai.com"].includes(url.hostname))throw Error("Unexpected sign-in URL.");
 return url.href;
}
module.exports={normalizeUsage,windowData,managedLoginUrl};
