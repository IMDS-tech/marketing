export function log(level, message, fields = {}) {
  process.stdout.write(`${JSON.stringify({ level, message, time: new Date().toISOString(), ...fields })}\n`);
}
