function composerAction(state, prompt, submitting = false) {
  if (state.busy)
    return {
      type: "stop",
      label: "Stop",
      disabled: false,
      hint: "The agent is working. You can stop this turn.",
    };
  if (submitting)
    return {
      type: "wait",
      label: "Sending…",
      disabled: true,
      hint: "Starting your turn. Your draft is kept until the agent accepts it.",
    };
  if(state.loginPending)return {type:"wait",label:"Waiting for sign-in…",disabled:true,hint:"Complete sign-in in your browser, or cancel below."};
  if (state.status === "Connecting")
    return {
      type: "wait",
      label: "Connecting…",
      disabled: true,
      hint: "Connecting to your account…",
    };
  if (!state.connected)
    return {
      type: "login",
      label: "Sign in with ChatGPT",
      disabled: false,
      hint: "Sign in through your browser. Your draft will stay here.",
    };
  if (state.account?.type !== "chatgpt")
    return {
      type: "login",
      label: "Sign in with ChatGPT",
      disabled: false,
      hint: "Complete sign-in, then send your message.",
    };
  if (state.mode !== "full" && state.sandbox !== "ready")
    return {
      type: "setupSandbox",
      label: "Set up sandbox",
      disabled: false,
      hint: "Codex needs its Windows sandbox before you can send in this access mode.",
    };
  return {
    type: "send",
    label: "Send",
    disabled: !prompt.trim(),
    hint: prompt.trim()
      ? "Ready to send · Enter"
      : "Type a message to enable Send.",
  };
}
module.exports = { composerAction };
