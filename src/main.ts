import { Global } from './lib/global'

import { isHome } from './lib/utils'
import { isHackable, scanForServers } from './lib/utils/scan'
import {
  RunningScripts,
  Script,
  executeScripts,
  PID,
  ScriptExecution,
  getRunningCount,
  getMaxWeakens,
  getMaxGrows,
  getMaxHacks,
  isScript,
  scriptNames,
} from './lib/utils/exec'
import { nukeServer } from './lib/utils/root'

import { Printer } from '/lib/easy-table'
import EasyTable from 'easy-table'

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
  }
  if (g.ns.fileExists(Script.Hack, 'home')) {
    await g.ns.write(Script.Hack, 'export async function main(ns) {await ns.hack(ns.args[0])}', 'w')
  }
  if (g.ns.fileExists(Script.Grow, 'home')) {
    await g.ns.write(Script.Grow, 'export async function main(ns) {await ns.grow(ns.args[0])}', 'w')
  }
  if (g.ns.fileExists(Script.Weaken, 'home')) {
    await g.ns.write(Script.Weaken, 'export async function main(ns) {await ns.weaken(ns.args[0])}', 'w')
  }
  if (g.ns.fileExists(Script.Share, 'home')) {
    await g.ns.write(Script.Share, 'export async function main(ns) {await ns.share()}', 'w')
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

        for (const scriptExecution of scriptExecutions) {
          const existingScriptRuns =
            runningScripts.get(scriptExecution.hacking.hostname) ?? new Map<PID, ScriptExecution>()
          existingScriptRuns.set(scriptExecution.pid, scriptExecution)
          runningScripts.set(scriptExecution.hacking.hostname, existingScriptRuns)
        }
      }
      await ns.sleep(30)
    }
    logRunningScripts(runningScripts)
    await ns.sleep(30)
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
  const table = new EasyTable()
  const forcedTable = new EasyTable()
  let accShareInstances = 0
  for (const [hostname, runningScriptExecutions] of runningScripts.entries()) {
    const server = g.ns.getServer(hostname)
    const { runningCount, forced } = getRunningCount(g, runningScriptExecutions)
    if (runningCount.size > 0) {
      let runningWeakens = runningCount.get(Script.Weaken) ?? 0
      let runningGrows = runningCount.get(Script.Grow) ?? 0
      let runningHacks = runningCount.get(Script.Hack) ?? 0
      if (runningWeakens > 0 || runningGrows > 0 || runningHacks > 0) {
        const maxWeakens = getMaxWeakens(g, server)
        const maxGrows = getMaxGrows(g, server)
        const maxHacks = getMaxHacks(g, server)
        table.cell('Hostname', server.hostname)
        table.cell('RW', runningWeakens, Printer.nNumber(g, { pre: runningWeakens > maxWeakens ? '!!' : '' }))
        table.cell('MW', maxWeakens, Printer.nNumber(g))
        table.cell('RG', runningGrows, Printer.nNumber(g, { pre: runningGrows > maxGrows ? '!!' : '' }))
        table.cell('MG', maxGrows, Printer.nNumber(g))
        table.cell('RH', runningHacks, Printer.nNumber(g, { pre: runningHacks > maxHacks ? '!!' : '' }))
        table.cell('MH', maxHacks, Printer.nNumber(g))
        table.newRow()
        if (runningGrows > maxGrows || runningWeakens > maxWeakens || runningHacks > maxHacks) {
          for (const [pid, exe] of runningScriptExecutions.entries()) {
            if (exe.forced) continue
            if (runningGrows <= maxGrows && runningWeakens <= maxWeakens && runningHacks <= maxHacks) break
            switch (exe.script) {
              case Script.Weaken:
                if (runningWeakens > maxWeakens) {
                  g.ns.kill(pid)
                  runningWeakens -= exe.instances
                }
                break
              case Script.Grow:
                if (runningGrows > maxGrows) {
                  g.ns.kill(pid)
                  runningGrows -= exe.instances
                }
                break
              case Script.Hack:
                if (runningHacks > maxHacks) {
                  g.ns.kill(pid)
                  runningHacks -= exe.instances
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
        forcedTable.cell('Hostname', server.hostname)
        forcedTable.cell('FW', runningWeakens, Printer.nNumber(g))
        forcedTable.cell('FG', runningGrows, Printer.nNumber(g))
        forcedTable.cell('FH', runningHacks, Printer.nNumber(g))
        forcedTable.newRow()
      }
    }
  }
  g.ns.clearLog()
  if (forcedTable.columns().length > 0) {
    g.printTable(forcedTable.sort(['Hostname']))
  }
  if (table.columns().length > 0) {
    g.printTable(table.sort(['Hostname']))
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
