import { Global } from './global.js'

export function scanForServers(
  g: Global,
  currentServer: Server = g.ns.getServer('home'),
  servers: Map<string, Server> = new Map<string, Server>()
): Map<string, Server> {
  servers.set(currentServer.hostname, currentServer)
  const serverHostNames = g.ns.scan(currentServer.hostname)

  for (const serverHostName of serverHostNames) {
    const server = g.ns.getServer(serverHostName)
    if (!servers.get(server.hostname)) scanForServers(g, server, servers)
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

export function getHackableServers(g: Global, servers: Map<string, Server> = scanForServers(g)): Map<string, Server> {
  const hackableServers = new Map()
  for (const [_hostnam, server] of servers.entries()) {
    if (isHackable(g, server)) {
      hackableServers.set(server.hostname, server)
    }
  }
  return hackableServers
}

export function getServersThatNeedBackdoor(
  g: Global,
  servers: Map<string, Server> = scanForServers(g)
): Map<string, Server> {
  const needBackdoor = new Map()
  for (const [_hostname, server] of servers.entries()) {
    if (!server.backdoorInstalled) {
      needBackdoor.set(server.hostname, server)
    }
  }
  return needBackdoor
}

export async function hackOnServer(
  g: Global,
  serverToHackOn: Server,
  singleServerToHack: Server | undefined = undefined,
  logErrors = true
) {
  let serversToHack: Map<string, Server>
  if (singleServerToHack) {
    serversToHack = new Map<string, Server>()
    serversToHack.set(singleServerToHack.hostname, singleServerToHack)
  } else {
    serversToHack = getHackableServers(g)
  }
  g.ns.killall(serverToHackOn.hostname)
  await g.ns.scp('simple.js', serverToHackOn.hostname)
  const maxRam = g.ns.getServerMaxRam(serverToHackOn.hostname)
  if (maxRam == 0) {
    if (logErrors) g.slogf(serverToHackOn, "Can't hack on this server. It has no ram.")
    return
  }
  const ramCost = g.ns.getScriptRam('simple.js', serverToHackOn.hostname)
  const instances = (maxRam / ramCost) | 0
  const instancesPerServerToHack = (instances / serversToHack.size) | 0
  const leftOverInstances = instances - instancesPerServerToHack * serversToHack.size
  g.slogf(
    serverToHackOn,
    'Total instances: %s. Servers to hack: %s. Instances per server hack: %s. Leftover %s',
    instances.toLocaleString(),
    serversToHack.size.toLocaleString(),
    instancesPerServerToHack.toLocaleString(),
    leftOverInstances.toLocaleString()
  )
  let highestDifficultyServer: Server | undefined
  for (const [_hostname, serverToHack] of serversToHack.entries()) {
    if (!highestDifficultyServer || highestDifficultyServer.baseDifficulty < serverToHack.baseDifficulty)
      highestDifficultyServer = serverToHack
    if (instancesPerServerToHack > 0) {
      const pid = g.ns.exec('simple.js', serverToHackOn.hostname, instancesPerServerToHack, serverToHack.hostname)
      if (pid == 0) {
        if (logErrors)
          g.slogf(
            serverToHackOn,
            "Attempted to run %s to hack server %s, but couldn't.",
            instancesPerServerToHack.toLocaleString(),
            serverToHack.hostname
          )
        break
      }
    }
  }
  if (highestDifficultyServer && leftOverInstances > 0) {
    g.ns.exec('simple.js', serverToHackOn.hostname, leftOverInstances, highestDifficultyServer.hostname, 'leftover')
  }
}

export function openPort(
  g: Global,
  server: Server,
  runOpenPortProgram: (hostname: string) => void,
  isPortOpen: (server: Server) => boolean,
  name: string,
  logSuccess: boolean = true,
  logErrors: boolean = true
) {
  if (server.numOpenPortsRequired > server.openPortCount && !isPortOpen(server)) {
    try {
      runOpenPortProgram(server.hostname)
      if (logSuccess) g.slogf(server, 'Opened port using %s.exe', name) // TODO: Why does runOpenPortProgram.name not work?
    } catch (e) {
      if (logErrors) g.slogf(server, "Don't have %s.exe installed", name) // TODO: Why does runOpenPortProgram.name not work?
    }
  }
}

export function nukeServer(g: Global, server: Server, logSuccess: boolean = true, logErrors: boolean = true): boolean {
  if (server.numOpenPortsRequired > server.openPortCount) {
    openPort(g, server, g.ns.brutessh, (s) => s.sshPortOpen, 'BruteSSH', logSuccess, logErrors)
    openPort(g, server, g.ns.ftpcrack, (s) => s.ftpPortOpen, 'FTPCrack', logSuccess, logErrors)
    openPort(g, server, g.ns.relaysmtp, (s) => s.smtpPortOpen, 'RelaySMTP', logSuccess, logErrors)
    openPort(g, server, g.ns.sqlinject, (s) => s.sqlPortOpen, 'SQLInject', logSuccess, logErrors)
    openPort(g, server, g.ns.httpworm, (s) => s.httpPortOpen, 'HTTPWorm', logSuccess, logErrors)
    server = g.ns.getServer(server.hostname)
  }
  if (!server.hasAdminRights && server.openPortCount >= server.numOpenPortsRequired) {
    g.ns.nuke(server.hostname)
    if (logSuccess) g.slogf(server, 'Nuked successfully')
    server = g.ns.getServer(server.hostname)
    return true
  }
  return false
}
