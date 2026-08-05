const injectionPatterns=[/ignore (all|any|the) previous instructions/i,/reveal (the )?(system|developer) prompt/i,/show (me )?(credentials|secrets|api keys)/i,/bypass (security|permissions|policy)/i];
const secretPatterns=[/(bearer\s+)[a-z0-9._-]{16,}/gi,/(sk-[a-z0-9_-]{12,})/gi,/(api[_ -]?key["'=:\s]+)[a-z0-9._-]{12,}/gi];
export function assessInput(input:string){const flags=injectionPatterns.filter(pattern=>pattern.test(input)).map(pattern=>pattern.source);return{blocked:false,flagged:flags.length>0,flags}}
export function redactSecrets(value:string){return secretPatterns.reduce((output,pattern)=>output.replace(pattern,'[REDACTED]'),value)}
export function assertTools(requested:string[],allowed:Set<string>){const unknown=requested.filter(tool=>!allowed.has(tool));if(unknown.length)throw new Error(`TOOLS_NOT_ALLOWED: ${unknown.join(', ')}`)}
