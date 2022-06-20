import { Global } from './global.js'

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
    if (predicate(g, primaryServer)) {
      servers.set(primaryServer.hostname, primaryServer)
      // g.logf('%s>%s', delimeter, primaryServer.hostname)
    }
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

export function getWeightedServerValue(g: Global, server: Server): { value: number; log: string } {
  const moneyPerS = g.ns.hackAnalyze(server.hostname) / (g.ns.getHackTime(server.hostname) / 1000)
  const chance = g.ns.hackAnalyzeChance(server.hostname)
  let weight = chance * 1000
  // Prefer servers with higher chance to hack
  if (chance > 0.5) weight += 100
  if (chance > 0.8) weight += 200
  if (chance === 1) weight += 500
  const value = moneyPerS * weight
  const log = `[${server.hostname}] $${moneyPerS.toFixed(4)}/s * ${weight.toLocaleString()} = ${value.toFixed(4)} | ${(
    chance * 100
  ).toFixed(
    0
  )}% ${server.baseDifficulty.toLocaleString()} $${server.moneyAvailable.toLocaleString()}/$${server.moneyMax.toLocaleString()}`
  return { value, log } // TODO: Figure out the best value, running it as is makes it so that very easy servers are always done first. Might be fine? Needs more investigation.
}

export function maximizeScriptExec(
  g: Global,
  hackingFrom: Server,
  script: Scripts,
  hacking: Server,
  max: number = Number.MAX_SAFE_INTEGER
): ScriptExecution | null {
  if (g.ns.getRunningScript(script, hackingFrom.hostname) !== null) return null
  const instances = Math.min(getMaxInstances(g, hackingFrom, script), max)
  if (instances > 0) {
    g.slogf(
      hackingFrom,
      'Executing %s/%s instances of %s on %s',
      instances.toLocaleString(),
      max === Number.MAX_SAFE_INTEGER ? Infinity.toLocaleString() : max.toLocaleString(),
      script,
      hacking.hostname
    )
    const pid: PID = g.ns.exec(script, hackingFrom.hostname, instances, hacking.hostname, hackingFrom.hostname)
    if (pid !== 0) {
      return new ScriptExecution(script, hackingFrom, hacking, instances, pid)
    }
  }
  return null
}

export function getMaxInstances(g: Global, server: Server, script: Scripts): number {
  const freeRam = g.ns.getServerMaxRam(server.hostname) - g.ns.getServerUsedRam(server.hostname)
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
  const max = g.ns.growthAnalyze(server.hostname, server.moneyMax)
  return Math.floor(max === Infinity ? 0 : max)
}

export function getMaxWeakens(g: Global, _server: Server) {
  const server = g.ns.getServer(_server.hostname)
  const max = (server.hackDifficulty - server.minDifficulty - 5) / 0.05
  return Math.floor(max === Infinity ? 0 : max)
}

export function getRunningCount(g: Global, runningScriptExecutions: Map<PID, ScriptExecution>): Map<Scripts, number> {
  const runningCount = new Map<Scripts, number>()
  for (const [pid, scriptExecution] of runningScriptExecutions.entries()) {
    if (g.ns.getRunningScript(pid)) {
      const existingCount = runningCount.get(scriptExecution.script) ?? 0
      runningCount.set(scriptExecution.script, existingCount + scriptExecution.instances)
      continue
    }
    runningScriptExecutions.delete(pid)
  }
  return runningCount
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
    const runningCount = getRunningCount(g, runningScriptExecutions)
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

export async function executeScripts(
  g: Global,
  server: Server,
  runningScripts: RunningScripts
): Promise<Array<ScriptExecution> | ScriptExecutionStatus> {
  if (server.maxRam === 0) {
    return ScriptExecutionStatus.CantHackOnServer
  }
  await g.ns.scp(Object.values(Scripts), server.hostname)
  const bestServer = findBestServerToHack(g, runningScripts)

  // There isn't enough work to do with the amount of server capacity we have
  if (!bestServer) return ScriptExecutionStatus.NoServersToHack

  const serverToHack = bestServer.serverToHack
  const runningCount = bestServer.runningCount

  const scriptExecutions: Array<ScriptExecution> = []

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
  let runningHacks = runningCount.get(Scripts.Hack) ?? 0
  const maxHacks = getMaxHacks(g, serverToHack)
  const hackExe = maximizeScriptExec(g, server, Scripts.Hack, serverToHack, maxHacks - runningHacks)
  if (hackExe) {
    scriptExecutions.push(hackExe)
    runningHacks += hackExe.instances
  }

  if (scriptExecutions.length > 0) {
    g.slogf(
      serverToHack,
      '%sGrow %s/%s | %sWeaken %s/%s | %sHacked %s/%s',
      runningGrows > maxGrows ? '!!' : '  ',
      runningGrows,
      maxGrows,
      runningWeakens > maxWeakens ? '!!' : '  ',
      runningWeakens,
      maxWeakens,
      runningHacks > maxHacks ? '!!' : '  ',
      runningHacks,
      maxHacks
    )
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
  name: string,
  logSuccess: boolean = true,
  logErrors: boolean = true
): Server {
  if (server.numOpenPortsRequired > server.openPortCount && !isPortOpen(server)) {
    try {
      runOpenPortProgram(server.hostname)
      if (logSuccess) g.slogf(server, 'Opened port using %s.exe', name)
      return g.ns.getServer(server.hostname)
    } catch (e) {
      if (logErrors) g.slogf(server, "Don't have %s.exe installed", name)
    }
  }
  return server
}

export function nukeServer(g: Global, _server: Server, logSuccess: boolean = true, logErrors: boolean = true): Server {
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
    server = openPort(g, server, port.runOpenPortProgram, port.isPortOpen, port.name, logSuccess, logErrors)
  }
  if (!server.hasAdminRights && server.openPortCount >= server.numOpenPortsRequired) {
    g.ns.nuke(server.hostname)
    server = g.ns.getServer(server.hostname)
    if (logSuccess && server.hasAdminRights) g.slogf(server, 'Nuked successfully')
  }
  return server
}

// Useful types

export type PID = number
export type Hostname = string
export type Servers = Map<Hostname, Server>
export type RunningScripts = Map<Hostname, Map<PID, ScriptExecution>>

export class ScriptExecution {
  public script: Scripts
  public hackingFrom: Server
  public hacking: Server
  public instances: number
  public pid: PID

  constructor(script: Scripts, hackingFrom: Server, hacking: Server, instances: number, pid: PID) {
    this.script = script
    this.hackingFrom = hackingFrom
    this.hacking = hacking
    this.instances = instances
    this.pid = pid
  }
}

export enum Scripts {
  Grow = '/hacking/grow.js',
  Hack = '/hacking/hack.js',
  Weaken = '/hacking/weaken.js',
}

export enum ScriptExecutionStatus {
  NoServersToHack = 'NoServersToHack', // couldn't find any servers to hack
  CantHackOnServer = 'CantHackOnServer', // see canBeHackedOn
  ScriptRun = 'ScriptRun', // one of Scripts was run on the best server
  Busy = 'Busy', // server is busy, no ram available
}
