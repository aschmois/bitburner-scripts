import {
  scanForServers,
  executeScripts,
  nukeServer,
  PID,
  ScriptExecution,
  RunningScripts,
  isHackable,
  Scripts,
  isHome,
} from './utils.js'
import { Global } from './global.js'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean; tail: boolean; optimize: boolean; share: boolean } = ns.flags([
    ['terminal', false],
    ['tail', false],
    ['optimize', false],
    ['share', false],
  ])
  if (a.tail) ns.tail()
  g = new Global({ ns, printOnTerminal: a.terminal })
  if (a.optimize) {
    g.disableLog('openPort')
    g.disableLog('maximizeScriptExec')
    g.disableLog('scanForServers')
  }
  const runningScripts: RunningScripts = new Map()
  let optimizedServers = scanForServers(g)
  let optimizedHackableServers = scanForServers(g, isHackable)
  let loopNum = 0
  while (true) {
    loopNum++
    if (loopNum === 100) {
      // ~10s
      optimizedHackableServers = scanForServers(g, isHackable)
      optimizedServers = scanForServers(g)
      logRunningScripts(runningScripts)
      loopNum = 0
    }
    const servers = optimizedServers
    for (const [_hostname, _server] of servers.entries()) {
      let server = _server
      if (!server.hasAdminRights) {
        server = nukeServer(g, server)
        servers.set(server.hostname, server)
      }
      if (server.hasAdminRights && server.maxRam > 0) {
        if (!isHome(server) && !g.ns.fileExists(Scripts.Hack, server.hostname)) {
          await g.ns.scp(Object.values(Scripts), server.hostname)
        }
        const scriptExecutions = executeScripts(g, server, runningScripts, a.share, new Map(optimizedHackableServers))
        if (Array.isArray(scriptExecutions)) {
          for (const scriptExecution of scriptExecutions) {
            const existingScriptRuns =
              runningScripts.get(scriptExecution.hacking.hostname) ?? new Map<PID, ScriptExecution>()
            existingScriptRuns.set(scriptExecution.pid, scriptExecution)
            runningScripts.set(scriptExecution.hacking.hostname, existingScriptRuns)
          }
        } else {
          // Do nothing for now
          // switch (scriptExecutions) {
          //   case ScriptExecutionStatus.Busy:
          //     // This is normal behavior. Don't spam the log with this
          //     break
          //   default:
          //     g.slogf(server, 'Failed to execute scripts: %s', scriptExecutions.toString())
          //     break
          // }
        }
      }
    }
    await ns.sleep(100)
  }
}

function logRunningScripts(runningScripts: RunningScripts) {
  // g.slogf(
  //   serverToHack,
  //   '%sGrow %s/%s | %sWeaken %s/%s | %sHacked %s/%s',
  //   runningGrows > maxGrows ? '!!' : '  ',
  //   runningGrows,
  //   maxGrows,
  //   runningWeakens > maxWeakens ? '!!' : '  ',
  //   runningWeakens,
  //   maxWeakens,
  //   runningHacks > maxHacks ? '!!' : '  ',
  //   runningHacks,
  //   maxHacks
  // )
}
