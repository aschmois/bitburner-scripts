import { Global } from './lib/global.js'

import table from './ext-lib/text-table.js'

import { isHome } from './lib/utils.js'
import { isHackable, scanForServers } from './lib/utils/scan.js'
import {
  RunningScripts,
  Scripts,
  executeScripts,
  PID,
  ScriptExecution,
  ScriptExecutionStatus,
  getRunningCount,
  getMaxWeakens,
  getMaxGrows,
  getMaxHacks,
} from './lib/utils/exec.js'
import { nukeServer } from './lib/utils/root.js'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean; noOptimize: boolean; share: boolean; money: boolean } = ns.flags([
    ['terminal', false],
    ['noOptimize', false],
    ['share', false],
    ['money', false],
  ])
  g = new Global({ ns, printOnTerminal: a.terminal })
  if (!a.noOptimize) {
    g.disableLog('openPort')
    g.disableLog('maximizeScriptExec')
    g.disableLog('scanForServers')
  }
  const runningScripts: RunningScripts = new Map()
  let servers = scanForServers(g)
  let hackableServers = scanForServers(g, isHackable)
  let loopNum = 0
  while (true) {
    if (a.noOptimize) {
      hackableServers = scanForServers(g, isHackable)
      servers = scanForServers(g)
    } else {
      loopNum++
      if (loopNum >= 40) {
        hackableServers = scanForServers(g, isHackable)
        servers = scanForServers(g)
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
        if (!isHome(server) && !g.ns.fileExists(Scripts.Hack, server.hostname)) {
          await g.ns.scp(Object.values(Scripts), server.hostname)
        }
        const scriptExecutions = executeScripts(g, server, runningScripts, a.share, a.money, hackableServers)
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
            case ScriptExecutionStatus.Busy:
              // This is normal behavior. Don't spam the log with this
              break
            default:
              g.printf('[%s] Failed to execute scripts: %s', server.hostname, status.toString())
              break
          }
        }
      }
      await ns.sleep(30)
    }
    logRunningScripts(runningScripts)
    await ns.sleep(30)
  }
}

function logRunningScripts(runningScripts: RunningScripts) {
  const runningArray = []
  const forcedArray = []
  for (const [hostname, runningScriptExecutions] of runningScripts.entries()) {
    const server = g.ns.getServer(hostname)
    const { runningCount, forced } = getRunningCount(g, runningScriptExecutions)
    if (runningCount.size > 0) {
      let runningWeakens = runningCount.get(Scripts.Weaken) ?? 0
      const maxWeakens = getMaxWeakens(g, server)
      let runningGrows = runningCount.get(Scripts.Grow) ?? 0
      const maxGrows = getMaxGrows(g, server)
      let runningHacks = runningCount.get(Scripts.Hack) ?? 0
      const maxHacks = getMaxHacks(g, server)
      runningArray.push([
        server.hostname,
        `${runningGrows > maxGrows ? '!!' : ''}${g.ns.nFormat(runningGrows, '0,0')}/${g.ns.nFormat(maxGrows, '0,0')}`,
        `${runningWeakens > maxWeakens ? '!!' : ''}${g.ns.nFormat(runningWeakens, '0,0')}/${g.ns.nFormat(
          maxWeakens,
          '0,0'
        )}`,
        `${runningHacks > maxHacks ? '!!' : ''}${g.ns.nFormat(runningHacks, '0,0')}/${g.ns.nFormat(maxHacks, '0,0')}`,
      ])
      if (runningGrows > maxGrows || runningWeakens > maxWeakens || runningHacks > maxHacks) {
        for (const [pid, exe] of runningScriptExecutions.entries()) {
          if (exe.forced) continue
          switch (exe.script) {
            case Scripts.Weaken:
              if (runningWeakens > maxWeakens) {
                g.ns.kill(pid)
                runningWeakens -= exe.instances
              }
              break
            case Scripts.Grow:
              if (runningGrows > maxGrows) {
                g.ns.kill(pid)
                runningGrows -= exe.instances
              }
              break
            case Scripts.Hack:
              if (runningHacks > maxHacks) {
                g.ns.kill(pid)
                runningHacks -= exe.instances
              }
              break
            case Scripts.Share:
              continue
          }
        }
      }
    }
    if (forced.size > 0) {
      forcedArray.push([
        server.hostname,
        g.ns.nFormat(forced.get(Scripts.Grow) ?? 0, '0,0'),
        g.ns.nFormat(forced.get(Scripts.Weaken) ?? 0, '0,0'),
        g.ns.nFormat(forced.get(Scripts.Hack) ?? 0, '0,0'),
        g.ns.nFormat(forced.get(Scripts.Share) ?? 0, '0,0'),
      ])
    }
  }
  g.ns.clearLog()
  if (runningArray.length > 0) {
    const txtTable = [['Hostname', 'Grow', 'Weaken', 'Hack'], ['--------', '----', '------', '----'], ...runningArray]
    g.printf(
      '%s',
      table(txtTable, {
        align: ['l', ...Array(txtTable[0].length - 1).fill('r')],
      })
    )
  }
  if (forcedArray.length > 0) {
    const txtTable = [
      ['Hostname', 'Grow', 'Weaken', 'Hack', 'Share'],
      ['--------', '----', '------', '----', '-----'],
      ...forcedArray,
    ]
    g.printf(
      '%s',
      table(txtTable, {
        align: ['l', ...Array(txtTable[0].length - 1).fill('r')],
      })
    )
  }
  g.printf(
    '$%s/s | %sxp/s | Share Power: %s',
    g.ns.nFormat(g.ns.getScriptIncome('main.js', 'home'), '0.00a'),
    g.ns.nFormat(g.ns.getScriptExpGain('main.js', 'home'), '0,0'),
    g.ns.nFormat(g.ns.getSharePower(), '0.00a')
  )
}
