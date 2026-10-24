function shouldSend(event){return event.key==="Enter"&&!event.shiftKey&&!event.isComposing&&!event.nativeEvent?.isComposing&&event.keyCode!==229;}module.exports={shouldSend};
