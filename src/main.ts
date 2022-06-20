import { scanForServers, executeScripts, nukeServer, PID, ScriptExecution, RunningScripts, ScriptExecutionStatus } from './utils.js'
import { Global } from './global.js'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean; tail: boolean } = ns.flags([
    ['terminal', false],
    ['tail', false],
  ])
  if (a.tail) ns.tail()
  g = new Global({ ns, printOnTerminal: a.terminal, logEnabled: true })
  const runningScripts: RunningScripts = new Map()
  while (true) {
    const servers = scanForServers(g)
    for (const [_hostname, _server] of servers.entries()) {
      let server = _server
      if (server.hostname == 'home') continue
      if (!server.hasAdminRights) {
        server = nukeServer(g, server, false, false)
        if (!server.hasAdminRights) continue
      }
      if (server.hasAdminRights && server.maxRam > 0) {
        const scriptExecutions = await executeScripts(g, server, runningScripts)
        if (scriptExecutions instanceof Array<ScriptExecution>) {
          for (const scriptExecution of scriptExecutions) {
            const existingScriptRuns =
              runningScripts.get(scriptExecution.hacking.hostname) ?? new Map<PID, ScriptExecution>()
            existingScriptRuns.set(scriptExecution.pid, scriptExecution)
            runningScripts.set(scriptExecution.hacking.hostname, existingScriptRuns)
          }
        } else {
          switch (scriptExecutions) {
            case ScriptExecutionStatus.Busy:
              // This is normal behavior. Don't spam the log with this
              break;

            default:
              g.slogf(server, 'Failed to execute scripts: %s', scriptExecutions.toString())
              break;
          }
        }
      }
    }
    await ns.sleep(100)
  }
}
