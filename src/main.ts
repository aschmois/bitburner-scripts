import { Global } from './lib/global.js'

import { isHome } from './lib/utils.js'
import { isHackable, scanForServers } from './lib/utils/scan.js'
import {
  RunningScripts,
  Script,
  executeScripts,
  PID,
  ScriptExecution,
  ScriptExecutionStatus,
  getRunningCount,
  getMaxWeakens,
  getMaxGrows,
  getMaxHacks,
  isScript,
  scriptNames,
} from './lib/utils/exec.js'
import { nukeServer } from './lib/utils/root.js'

let g: Global
export async function main(ns: NS) {
  const { terminal, noOptimize, share }: { terminal: boolean; noOptimize: boolean; share: boolean } = ns.flags([
    ['terminal', false],
    ['noOptimize', false],
    ['share', false],
  ])
  g = new Global({ ns, printOnTerminal: terminal })
  if (!noOptimize) {
    g.disableLog('openPort')
    g.disableLog('maximizeScriptExec')
    g.disableLog('scanForServers')
    g.disableLog('logRunningScripts')
  }
  const runningScripts: RunningScripts = new Map()
  let servers = scan()
  // Load running scripts
  for (const [hostname, server] of servers.entries()) {
    g.ns.ps(hostname).forEach((ps) => {
      const script = isScript(ps.filename)
      if (ps.args.length !== 3 || !script) return
      const hackingHostname = ps.args[0]
      const execs = runningScripts.get(hackingHostname) ?? new Map<PID, ScriptExecution>()
      const hacking = servers.get(hackingHostname) ?? g.ns.getServer(hackingHostname)
      const exec = new ScriptExecution(script, server, hacking, ps.threads, ps.pid, ps.args[2] === 'true')
      execs.set(ps.pid, exec)
      runningScripts.set(hackingHostname, execs)
    })
  }
  let hackableServers = scanForServers(g, isHackable)
  let loopNum = 0
  while (true) {
    if (noOptimize) {
      hackableServers = scanForServers(g, isHackable)
      servers = scan()
    } else {
      loopNum++
      if (loopNum >= 40) {
        hackableServers = scanForServers(g, isHackable)
        servers = scan()
        loopNum = 0
      }
    }
    for (const [_hostname, _server] of servers.entries()) {
      let server = _server
      if (!server.hasAdminRights) {
        server = nukeServer(g, server)
        servers.set(server.hostname, server)
      }
      if (server.hasAdminRights && server.maxRam > 0) {
        if (!isHome(server) && !g.ns.fileExists(Script.Hack, server.hostname)) {
          await g.ns.scp(scriptNames, server.hostname)
        }
        const scriptExecutions = executeScripts(g, server, runningScripts, share, hackableServers)
        if (Array.isArray(scriptExecutions)) {
          for (const scriptExecution of scriptExecutions) {
            const existingScriptRuns =
              runningScripts.get(scriptExecution.hacking.hostname) ?? new Map<PID, ScriptExecution>()
            existingScriptRuns.set(scriptExecution.pid, scriptExecution)
            runningScripts.set(scriptExecution.hacking.hostname, existingScriptRuns)
          }
        } else {
          const status = scriptExecutions
          switch (status) {
            case ScriptExecutionStatus.NoServersToHack:
            case ScriptExecutionStatus.Busy:
              // This is normal behavior. Don't spam the log with this
              break
            default:
              g.printf('[%s] Failed to execute scripts: %s', server.hostname, status.toString())
              break
          }
        }
      }
      await ns.sleep(10)
    }
    logRunningScripts(runningScripts)
    await ns.sleep(10)
  }
}

function scan() {
  const servers = scanForServers(g)
  const purchased = g.ns.getPurchasedServers()
  for (const p of purchased) {
    const server = g.ns.getServer(p)
    servers.set(p, server)
  }
  return servers
}

function logRunningScripts(runningScripts: RunningScripts) {
  const runningArray = []
  const forcedArray = []
  let accShareInstances = 0
  for (const [hostname, runningScriptExecutions] of runningScripts.entries()) {
    const server = g.ns.getServer(hostname)
    const { runningCount, forced } = getRunningCount(g, runningScriptExecutions)
    if (runningCount.size > 0) {
      let runningWeakens = runningCount.get(Script.Weaken) ?? 0
      let runningGrows = runningCount.get(Script.Grow) ?? 0
      let runningHacks = runningCount.get(Script.Hack) ?? 0
      if (runningGrows > 0 || runningWeakens > 0 || runningHacks > 0) {
        const maxWeakens = getMaxWeakens(g, server)
        const maxGrows = getMaxGrows(g, server)
        const maxHacks = getMaxHacks(g, server)
        runningArray.push([
          server.hostname,
          `${runningGrows > maxGrows ? '!!' : ''}${g.n(runningGrows, '0,0')}/${g.n(maxGrows, '0,0')}`,
          `${runningWeakens > maxWeakens ? '!!' : ''}${g.n(runningWeakens, '0,0')}/${g.n(maxWeakens, '0,0')}`,
          `${runningHacks > maxHacks ? '!!' : ''}${g.n(runningHacks, '0,0')}/${g.n(maxHacks, '0,0')}`,
        ])
        if (runningGrows > maxGrows || runningWeakens > maxWeakens || runningHacks > maxHacks) {
          for (const [pid, exe] of runningScriptExecutions.entries()) {
            if (exe.forced) continue
            if (runningGrows <= maxGrows && runningWeakens <= maxWeakens && runningHacks <= maxHacks) break
            switch (exe.script) {
              case Script.Weaken:
                if (runningWeakens > maxWeakens) {
                  g.ns.kill(pid)
                  runningWeakens -= exe.instances
                  g.printf_(
                    'logRunningScripts',
                    '[%s] Killed weaken script. Removed %s instances',
                    exe.hacking.hostname,
                    g.n(exe.instances, '0,0')
                  )
                }
                break
              case Script.Grow:
                if (runningGrows > maxGrows) {
                  g.ns.kill(pid)
                  runningGrows -= exe.instances
                  g.printf_(
                    'logRunningScripts',
                    '[%s] Killed weaken script. Removed %s instances',
                    exe.hacking.hostname,
                    g.n(exe.instances, '0,0')
                  )
                }
                break
              case Script.Hack:
                if (runningHacks > maxHacks) {
                  g.ns.kill(pid)
                  runningHacks -= exe.instances
                  g.printf_(
                    'logRunningScripts',
                    '[%s] Killed weaken script. Removed %s instances',
                    exe.hacking.hostname,
                    g.n(exe.instances, '0,0')
                  )
                }
                break
              case Script.Share:
                continue
            }
          }
        }
      }
    }
    if (forced.size > 0) {
      const runningWeakens = forced.get(Script.Weaken) ?? 0
      const runningGrows = forced.get(Script.Grow) ?? 0
      const runningHacks = forced.get(Script.Hack) ?? 0
      accShareInstances += forced.get(Script.Share) ?? 0
      if (runningGrows > 0 || runningWeakens > 0 || runningHacks > 0) {
        forcedArray.push([
          server.hostname,
          g.n(forced.get(Script.Grow) ?? 0, '0,0'),
          g.n(forced.get(Script.Weaken) ?? 0, '0,0'),
          g.n(forced.get(Script.Hack) ?? 0, '0,0'),
        ])
      }
    }
  }
  g.ns.clearLog()
  if (runningArray.length > 0) {
    runningArray.sort(function (a, b) {
      return a[0].localeCompare(b[0])
    })
    const rows = [['Hostname', 'Weaken', 'Grow', 'Hack'], ['--------', '------', '----', '----'], ...runningArray]
    g.printTable({
      rows,
      opts: {
        align: ['l', ...Array(rows[0].length - 1).fill('r')],
      },
    })
  }
  if (forcedArray.length > 0) {
    forcedArray.sort(function (a, b) {
      return a[0].localeCompare(b[0])
    })
    const rows = [['Hostname', 'Weaken', 'Grow', 'Hack'], ['--------', '------', '----', '----'], ...forcedArray]
    g.printTable({
      rows,
      opts: {
        align: ['l', ...Array(rows[0].length - 1).fill('r')],
      },
    })
  }
  g.printf(
    '$%s/s | %sxp/s | Share Power/Instances: %s/%s | Karma: %s',
    g.n(g.ns.getScriptIncome('main.js', 'home', ...g.ns.args.map((v) => v + ''))),
    g.n(g.ns.getScriptExpGain('main.js', 'home', ...g.ns.args.map((v) => v + '')), '0,0'),
    g.n(g.ns.getSharePower()),
    g.n(accShareInstances),
    g.n(g.ns.heart.break())
  )
}
