import { Server } from '@ns'

import { Global } from 'lib/global.js'

import { Hostname, isHome } from 'lib/utils.js'
import { isHackable, scanForServers, Servers } from 'lib/utils/scan.js'
import { getWeightedServerValue } from 'lib/utils/stats.js'

export type BestServer = { serverToHack: Server; runningCount: Map<Script, number> }
export type PID = number
export type RunningScripts = Map<Hostname, Map<PID, ScriptExecution>>

export class ScriptExecution {
  public script: Script
  public hackingFrom: Server
  public hacking: Server
  public instances: number
  public pid: PID
  public forced: boolean

  constructor(script: Script, hackingFrom: Server, hacking: Server, instances: number, pid: PID, forced: boolean) {
    this.script = script
    this.hackingFrom = hackingFrom
    this.hacking = hacking
    this.instances = instances
    this.pid = pid
    this.forced = forced
  }
}

export function isScript(script: string | Script): Script | null {
  return (scriptNames as string[]).includes(script) ? (script as Script) : null
}

export enum Script {
  Grow = '/hacking/grow.js',
  Hack = '/hacking/hack.js',
  Weaken = '/hacking/weaken.js',
  Share = '/hacking/share.js',
}

export const scriptNames = Object.values(Script)

export function executeScripts(
  g: Global,
  server: Server,
  runningScripts: RunningScripts,
  share: boolean,
  _hackableServers: Servers
): ScriptExecution[] {
  if (server.maxRam === 0) {
    return []
  }
  const hackableServers = new Map(_hackableServers)
  const bestServer = findBestServerToHack(g, runningScripts, hackableServers)

  // There isn't enough work to do with the amount of server capacity we have
  if (!bestServer) {
    let exe
    if (!share) {
      let xpServer = g.ns.getServer('joesguns')
      if (g.ns.getHackingLevel() < xpServer.requiredHackingSkill) {
        xpServer = g.ns.getServer('n00dles')
      }
      if (xpServer.hasAdminRights) {
        if (xpServer.hackDifficulty > xpServer.minDifficulty + 5) {
          // weaken if not minDifficulty
          exe = maximizeScriptExec(g, server, Script.Weaken, xpServer, undefined, true)
        } else {
          // hack if min difficulty for faster xp
          exe = maximizeScriptExec(g, server, Script.Hack, xpServer, undefined, true)
        }
      }
    } else {
      exe = maximizeScriptExec(g, server, Script.Share, undefined, undefined, true)
    }
    if (exe) {
      return [exe]
    }
    return []
  }
  const serverToHack = bestServer.serverToHack
  const runningCount = bestServer.runningCount

  const scriptExecutions: Array<ScriptExecution | null> = []

  // Weaken Server
  scriptExecutions.push(maximizeScriptExec(g, server, Script.Weaken, serverToHack, runningCount))

  // Grow Server
  scriptExecutions.push(maximizeScriptExec(g, server, Script.Grow, serverToHack, runningCount))

  // Hack Server
  scriptExecutions.push(maximizeScriptExec(g, server, Script.Hack, serverToHack, runningCount))

  const scriptExecutionsNonNull: ScriptExecution[] = []
  for (const exe of scriptExecutions) {
    if (exe != null) scriptExecutionsNonNull.push(exe)
  }
  if (Object.keys(Script).some((script) => getMaxInstances(g, server, script as Script) > 0)) {
    // Server still has capacity for scripts to be run, let's delete the current server and continue
    hackableServers.delete(serverToHack.hostname)
    return [...scriptExecutionsNonNull, ...executeScripts(g, server, runningScripts, share, hackableServers)]
  }
  return scriptExecutionsNonNull
}

export function maximizeScriptExec(
  g: Global,
  server: Server,
  script: Script,
  serverToHack: Server = server,
  runningCount: Map<Script, number> | undefined = undefined,
  force: boolean = false
): ScriptExecution | null {
  let max: number = Number.MAX_SAFE_INTEGER
  if (runningCount) {
    const running = runningCount.get(script) ?? 0
    switch (script) {
      case Script.Weaken:
        max = getMaxWeakens(g, serverToHack) - running
        break
      case Script.Grow:
        max = getMaxGrows(g, serverToHack) - running
        break
      case Script.Hack:
        max = getMaxHacks(g, serverToHack) - running
        break
    }
  }
  const instances = Math.min(getMaxInstances(g, server, script), max)
  if (instances > 0) {
    g.printf_(
      'maximizeScriptExec',
      'Executing %s/%s instances of %s on %s running on %s',
      instances.toLocaleString(),
      max === Number.MAX_SAFE_INTEGER ? Infinity.toLocaleString() : max.toLocaleString(),
      script,
      serverToHack.hostname,
      server.hostname
    )
    const pid: PID = g.ns.exec(script, server.hostname, instances, serverToHack.hostname, server.hostname, force)
    if (pid !== 0) {
      return new ScriptExecution(script, server, serverToHack, instances, pid, force)
    }
  }
  return null
}

export function getMaxInstances(g: Global, server: Server, script: Script): number {
  let freeRam = g.ns.getServerMaxRam(server.hostname) - g.ns.getServerUsedRam(server.hostname)
  if (isHome(server)) freeRam = Math.max(0, freeRam - 64)
  const ramCost = g.ns.getScriptRam(script, server.hostname)
  return Math.floor(freeRam / ramCost)
}

export function getMaxHacks(g: Global, _server: Server) {
  // don't allow hacking on servers that essentially do nothing
  if (g.ns.hackAnalyzeChance(_server.hostname) <= 0.3) return 0
  const server = g.ns.getServer(_server.hostname)
  const max = g.ns.hackAnalyzeThreads(server.hostname, server.moneyAvailable)
  return Math.floor(max === Infinity ? 0 : max)
}

export function getMaxGrows(g: Global, _server: Server) {
  const server = g.ns.getServer(_server.hostname)
  if (server.moneyMax == server.moneyAvailable) return 0
  const max = g.ns.growthAnalyze(server.hostname, server.moneyMax)
  return Math.floor(max === Infinity ? 0 : max)
}

export function getMaxWeakens(g: Global, _server: Server) {
  const server = g.ns.getServer(_server.hostname)
  if (g.ns.hackAnalyzeChance(server.hostname) === 1) return 0
  if (server.hackDifficulty <= server.minDifficulty + 6) return 0
  const max = (server.hackDifficulty - server.minDifficulty - 5) / 0.05
  return Math.floor(max === Infinity ? 0 : max)
}

export function getRunningCount(
  g: Global,
  runningScriptExecutions: Map<PID, ScriptExecution>
): { runningCount: Map<Script, number>; forced: Map<Script, number> } {
  const runningCount = new Map<Script, number>()
  const runningCountForced = new Map<Script, number>()
  for (const [pid, scriptExecution] of runningScriptExecutions.entries()) {
    if (g.ns.getRunningScript(pid)) {
      if (!scriptExecution.forced) {
        const existingCount = runningCount.get(scriptExecution.script) ?? 0
        runningCount.set(scriptExecution.script, existingCount + scriptExecution.instances)
      } else {
        const existingCount = runningCountForced.get(scriptExecution.script) ?? 0
        runningCountForced.set(scriptExecution.script, existingCount + scriptExecution.instances)
      }
      continue
    }
    runningScriptExecutions.delete(pid)
  }
  return { runningCount, forced: runningCountForced }
}

export function findBestServerToHack(
  g: Global,
  runningScripts: RunningScripts,
  hackableServers: Servers = scanForServers(g, isHackable)
): BestServer | null {
  let serverToHack
  for (const [_hostname, hackableServer] of hackableServers.entries()) {
    if (!serverToHack) serverToHack = hackableServer
    if (getWeightedServerValue(g, hackableServer).value > getWeightedServerValue(g, serverToHack).value) {
      serverToHack = hackableServer
    }
  }
  if (serverToHack) {
    const runningScriptExecutions = runningScripts.get(serverToHack.hostname) ?? new Map<PID, ScriptExecution>()
    const runningCount = getRunningCount(g, runningScriptExecutions).runningCount
    if (runningScriptExecutions.size > 0) {
      runningScripts.set(serverToHack.hostname, runningScriptExecutions)
    } else {
      runningScripts.delete(serverToHack.hostname)
    }
    if (
      (runningCount.get(Script.Hack) ?? 0) >= getMaxHacks(g, serverToHack) &&
      (runningCount.get(Script.Grow) ?? 0) >= getMaxGrows(g, serverToHack) &&
      (runningCount.get(Script.Weaken) ?? 0) >= getMaxWeakens(g, serverToHack)
    ) {
      // The best server has been maxed out, look for the next available one
      hackableServers.delete(serverToHack.hostname)
      return findBestServerToHack(g, runningScripts, hackableServers)
    }
    return { serverToHack, runningCount }
  }
  return null
}
