import { Global } from './global.js'

export function isHome(server: Server) {
  return server.hostname === 'home'
}

export function scanForServers(
  g: Global,
  predicate: (g: Global, s: Server) => boolean = () => true,
  primaryServer: Server = g.ns.getServer('home'),
  servers: Servers = new Map(),
  delimeter: string = ''
): Servers {
  const secondaryHostnames = g.ns.scan(primaryServer.hostname)
  if (primaryServer.hostname != 'home') {
    secondaryHostnames.shift() // The first scan result is the server right above it
  }
  if (predicate(g, primaryServer)) {
    servers.set(primaryServer.hostname, primaryServer)
    g.printf_(
      'scanForServers',
      '%s>%s %t %i',
      delimeter,
      primaryServer.hostname,
      primaryServer.hasAdminRights,
      primaryServer.requiredHackingSkill
    )
  }
  for (const secondaryHostname of secondaryHostnames) {
    if (secondaryHostname === primaryServer.hostname) continue
    const secondaryServer = g.ns.getServer(secondaryHostname)
    scanForServers(g, predicate, secondaryServer, servers, delimeter != '' ? delimeter + '----|' : '|')
  }
  return servers
}

export function isHackable(g: Global, server: Server): boolean {
  return (
    !server.purchasedByPlayer &&
    server.hasAdminRights &&
    server.moneyMax > 0 &&
    server.requiredHackingSkill <= g.ns.getHackingLevel()
  )
}

export function canBeHackedOn(g: Global, server: Server): boolean {
  return (
    server.hasAdminRights &&
    server.maxRam > 0 &&
    (server.purchasedByPlayer || server.moneyMax == 0 || server.requiredHackingSkill > g.ns.getHackingLevel())
  )
}

export function getWeightedServerValue(g: Global, server: Server): { value: number; log: Stats } {
  const moneyAvailable = g.ns.getServerMoneyAvailable(server.hostname)
  const moneyPerS = (g.ns.hackAnalyze(server.hostname) * moneyAvailable) / (g.ns.getHackTime(server.hostname) / 1000)
  let threads = g.ns.hackAnalyzeThreads(server.hostname, moneyAvailable)
  if (!threads || threads === Infinity || isNaN(threads)) {
    threads = 0
  }
  const chance = g.ns.hackAnalyzeChance(server.hostname)
  let weight = chance
  // Prefer servers with higher chance to hack
  if (chance > 0.5) weight += 0.1
  if (chance > 0.8) weight += 0.2
  if (chance === 1) weight += 0.5
  const adjustment = server.moneyMax / 1000000000
  const value = moneyPerS * threads * weight + adjustment
  return { value, log: { moneyPerS, threads, weight, adjustment, value, chance, server } }
}

export function maximizeScriptExec(
  g: Global,
  hackingFrom: Server,
  script: Scripts,
  hacking: Server = hackingFrom,
  _max: number | undefined = undefined,
  force: boolean | undefined = undefined
): ScriptExecution | null {
  const max: number = _max !== undefined ? _max : Number.MAX_SAFE_INTEGER
  const instances = Math.min(getMaxInstances(g, hackingFrom, script), max)
  if (instances > 0) {
    g.printf_(
      'maximizeScriptExec',
      'Executing %s/%s instances of %s on %s running on %s',
      instances.toLocaleString(),
      max === Number.MAX_SAFE_INTEGER ? Infinity.toLocaleString() : max.toLocaleString(),
      script,
      hacking.hostname,
      hackingFrom.hostname
    )
    let pid: PID
    if (force === undefined)
      pid = g.ns.exec(script, hackingFrom.hostname, instances, hacking.hostname, hackingFrom.hostname)
    else pid = g.ns.exec(script, hackingFrom.hostname, instances, hacking.hostname, hackingFrom.hostname, true)
    if (pid !== 0) {
      return new ScriptExecution(script, hackingFrom, hacking, instances, pid, force ? force : false)
    }
  }
  return null
}

export function getMaxInstances(g: Global, server: Server, script: Scripts): number {
  let freeRam = g.ns.getServerMaxRam(server.hostname) - g.ns.getServerUsedRam(server.hostname)
  if (isHome(server)) freeRam = Math.max(0, freeRam - 32)
  const ramCost = g.ns.getScriptRam(script, server.hostname)
  return Math.floor(freeRam / ramCost)
}

export function getMaxHacks(g: Global, _server: Server) {
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
): { runningCount: Map<Scripts, number>; forced: Map<Scripts, number> } {
  const runningCount = new Map<Scripts, number>()
  const runningCountForced = new Map<Scripts, number>()
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

export type BestServer = { serverToHack: Server; runningCount: Map<Scripts, number> }

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
      (runningCount.get(Scripts.Hack) ?? 0) >= getMaxHacks(g, serverToHack) &&
      (runningCount.get(Scripts.Grow) ?? 0) >= getMaxGrows(g, serverToHack) &&
      (runningCount.get(Scripts.Weaken) ?? 0) >= getMaxWeakens(g, serverToHack)
    ) {
      // The best server has been maxed out, look for the next available one
      hackableServers.delete(serverToHack.hostname)
      return findBestServerToHack(g, runningScripts, hackableServers)
    }
    return { serverToHack, runningCount }
  }
  return null
}

export function executeScripts(
  g: Global,
  server: Server,
  runningScripts: RunningScripts,
  share: boolean,
  money: boolean,
  _hackableServers: Servers
): Array<ScriptExecution> | ScriptExecutionStatus {
  if (server.maxRam === 0) {
    return ScriptExecutionStatus.CantHackOnServer
  }
  const hackableServers = new Map(_hackableServers)
  const bestServer = findBestServerToHack(g, runningScripts, hackableServers)

  // There isn't enough work to do with the amount of server capacity we have
  if (!bestServer) {
    let exe
    if (share) exe = maximizeScriptExec(g, server, Scripts.Share)
    else exe = maximizeScriptExec(g, server, Scripts.Weaken, g.ns.getServer('joesguns'), undefined, true)
    if (exe) {
      exe.forced = true
      return [exe]
    }
    return ScriptExecutionStatus.NoServersToHack
  }
  const serverToHack = bestServer.serverToHack
  const runningCount = bestServer.runningCount

  const scriptExecutions: Array<ScriptExecution> = []

  let runningHacks = runningCount.get(Scripts.Hack) ?? 0
  if (money) {
    if (g.ns.hackAnalyzeChance(serverToHack.hostname) > 0.5) {
      const maxHacks = getMaxHacks(g, serverToHack)
      const hackExe = maximizeScriptExec(g, server, Scripts.Hack, serverToHack, maxHacks - runningHacks)
      if (hackExe) {
        scriptExecutions.push(hackExe)
        runningHacks += hackExe.instances
      }
    }
    if (getMaxInstances(g, server, Scripts.Hack) > 0) {
      for (const [_hostname, nextHackableServer] of hackableServers.entries()) {
        if (g.ns.hackAnalyzeChance(nextHackableServer.hostname) > 0.5) {
          const runningScriptExecutions =
            runningScripts.get(nextHackableServer.hostname) ?? new Map<PID, ScriptExecution>()
          const runningCount = getRunningCount(g, runningScriptExecutions).runningCount
          const runningHacks = runningCount.get(Scripts.Hack) ?? 0
          const maxHacks = getMaxHacks(g, nextHackableServer)
          const hackExe = maximizeScriptExec(g, server, Scripts.Hack, nextHackableServer, maxHacks - runningHacks)
          if (hackExe) {
            scriptExecutions.push(hackExe)
          }
        }
      }
    }
  }

  // Weaken Server
  let runningWeakens = runningCount.get(Scripts.Weaken) ?? 0
  const maxWeakens = getMaxWeakens(g, serverToHack)
  const weakenExe = maximizeScriptExec(g, server, Scripts.Weaken, serverToHack, maxWeakens - runningWeakens)
  if (weakenExe) {
    scriptExecutions.push(weakenExe)
    runningWeakens += weakenExe.instances
  }

  // Grow Server
  let runningGrows = runningCount.get(Scripts.Grow) ?? 0
  const maxGrows = getMaxGrows(g, serverToHack)
  const growExe = maximizeScriptExec(g, server, Scripts.Grow, serverToHack, maxGrows - runningGrows)
  if (growExe) {
    scriptExecutions.push(growExe)
    runningGrows += growExe.instances
  }

  // Hack Server
  const maxHacks = getMaxHacks(g, serverToHack)
  const hackExe = maximizeScriptExec(g, server, Scripts.Hack, serverToHack, maxHacks - runningHacks)
  if (hackExe) {
    scriptExecutions.push(hackExe)
    runningHacks += hackExe.instances
  }

  if (scriptExecutions.length > 0) {
    return scriptExecutions
  }

  // Server is out of ram but the best server still has capacity for scripts to be run
  return ScriptExecutionStatus.Busy
}

export function openPort(
  g: Global,
  server: Server,
  runOpenPortProgram: (hostname: Hostname) => void,
  isPortOpen: (server: Server) => boolean,
  name: string
): Server {
  if (server.numOpenPortsRequired > server.openPortCount && !isPortOpen(server)) {
    try {
      runOpenPortProgram(server.hostname)
      g.printf_('openPort', '[%s] Opened port using %s.exe', server.hostname, name)
      return g.ns.getServer(server.hostname)
    } catch (e) {
      g.printf_('openPort', "[%s] Don't have %s.exe installed", server.hostname, name)
    }
  }
  return server
}

export function nukeServer(g: Global, _server: Server): Server {
  let server = _server
  const ports = [
    { runOpenPortProgram: g.ns.brutessh, isPortOpen: (s: Server) => s.sshPortOpen, name: 'BruteSSH' },
    { runOpenPortProgram: g.ns.ftpcrack, isPortOpen: (s: Server) => s.ftpPortOpen, name: 'FTPCrack' },
    { runOpenPortProgram: g.ns.relaysmtp, isPortOpen: (s: Server) => s.smtpPortOpen, name: 'RelaySMTP' },
    { runOpenPortProgram: g.ns.sqlinject, isPortOpen: (s: Server) => s.sqlPortOpen, name: 'SQLInject' },
    { runOpenPortProgram: g.ns.httpworm, isPortOpen: (s: Server) => s.httpPortOpen, name: 'HTTPWorm' },
  ]
  for (const port of ports) {
    if (server.openPortCount >= server.numOpenPortsRequired) {
      break
    }
    server = openPort(g, server, port.runOpenPortProgram, port.isPortOpen, port.name)
  }
  if (!server.hasAdminRights && server.openPortCount >= server.numOpenPortsRequired) {
    g.ns.nuke(server.hostname)
    server = g.ns.getServer(server.hostname)
    if (server.hasAdminRights) g.printf_('nukeServer', '[%s] Nuked successfully', server.hostname)
  }
  return server
}

// Useful types

export type PID = number
export type Hostname = string
export type Servers = Map<Hostname, Server>
export type RunningScripts = Map<Hostname, Map<PID, ScriptExecution>>
export type Stats = {
  moneyPerS: number
  threads: number
  weight: number
  adjustment: number
  value: number
  chance: number
  server: Server
}

export class ScriptExecution {
  public script: Scripts
  public hackingFrom: Server
  public hacking: Server
  public instances: number
  public pid: PID
  public forced: boolean

  constructor(script: Scripts, hackingFrom: Server, hacking: Server, instances: number, pid: PID, forced: boolean) {
    this.script = script
    this.hackingFrom = hackingFrom
    this.hacking = hacking
    this.instances = instances
    this.pid = pid
    this.forced = forced
  }
}

export enum Scripts {
  Grow = '/hacking/grow.js',
  Hack = '/hacking/hack.js',
  Weaken = '/hacking/weaken.js',
  Share = '/hacking/share.js',
}

export enum ScriptExecutionStatus {
  NoServersToHack = 'NoServersToHack', // couldn't find any servers to hack
  CantHackOnServer = 'CantHackOnServer', // see canBeHackedOn
  Busy = 'Busy', // server is busy, no ram available
}
