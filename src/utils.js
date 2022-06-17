import { Global } from './global.js'

/**
 * @param {Global} g
 * @param {Server} currentServer
 * @param {Map<String,Server>} servers Note: this is mutated
 * @returns {Map<String,Server>} all scannable hosts. Note: Same as the `servers` param
 */
export function scanForServers(g, currentServer = g.ns.getServer('home'), servers = new Map()) {
  servers.set(currentServer.hostname, currentServer)
  const serverHostNames = g.ns.scan(currentServer.hostname)

  for (const serverHostName of serverHostNames) {
    const server = g.ns.getServer(serverHostName)
    if (!servers.get(server.hostname)) scanForServers(g, server, servers)
  }
  return servers
}

/**
 * @param {Global} g
 * @param {Server} server
 * @returns {Boolean} true if server can be hacked and has money to hack
 */
export function isHackable(g, server) {
  return (
    !server.purchasedByPlayer &&
    server.hasAdminRights &&
    server.moneyMax > 0 &&
    server.requiredHackingSkill <= g.ns.getHackingLevel()
  )
}

/**
 * @param {Global} g
 * @param {Map<String,Server>} servers defaults to all servers
 * @returns {Map<String,Server>}
 */
export function getHackableServers(g, servers = scanForServers(g)) {
  const hackableServers = new Map()
  for (const [_, server] of servers.entries()) {
    if (isHackable(g, server)) {
      hackableServers.set(server.hostname, server)
    }
  }
  return hackableServers
}

/**
 * @param {Global} g
 * @param {Map<String,Server>} servers defaults to all servers
 * @returns {Map<String,Server>}
 */
export function getServersThatNeedBackdoor(g, servers = scanForServers(g)) {
  const needBackdoor = new Map()
  for (const [_, server] of servers.entries()) {
    if (!server.backdoorInstalled) {
      needBackdoor.set(server.hostname, server)
    }
  }
  return needBackdoor
}

/**
 * @param {Global} g
 * @param {Server} serverToHackOn
 * @param {Server=} singleServerToHack If undefined will hack all available hackable servers
 */
export async function hackOnServer(g, serverToHackOn, singleServerToHack) {
  let serversToHack
  if (singleServerToHack) {
    serversToHack = new Map()
    serversToHack.set(singleServerToHack.hostname, singleServerToHack)
  } else {
    serversToHack = getHackableServers(g)
  }
  g.ns.killall(serverToHackOn.hostname)
  await g.ns.scp('simple.js', serverToHackOn.hostname)
  const maxRam = g.ns.getServerMaxRam(serverToHackOn.hostname)
  if (maxRam == 0) {
    g.logf(
      "[%s][%s] Can't hack on this server. It has no ram.",
      serverToHackOn.organizationName,
      serverToHackOn.hostname
    )
    return
  }
  const ramCost = g.ns.getScriptRam('simple.js', serverToHackOn.hostname)
  const instances = maxRam / ramCost
  const instancesPerServerToHack = instances / serversToHack.size
  g.logf(
    '[%s][%s] Total instances: %i. Servers to hack: %i. Instances per server hack: %i',
    serverToHackOn.organizationName,
    serverToHackOn.hostname,
    instances,
    serversToHack.size,
    instancesPerServerToHack
  )
  for (const [_, serverToHack] of serversToHack.entries()) {
    const pid = g.ns.exec('simple.js', serverToHackOn.hostname, instancesPerServerToHack, serverToHack.hostname)
    if (pid == 0) {
      g.logf(
        "[%s][%s] Attempted to run %i to hack server %s, but couldn't.",
        serverToHackOn.organizationName,
        serverToHackOn.hostname,
        instancesPerServerToHack,
        serverToHack.hostname
      )
      break
    }
  }
}

/**
 * @callback isPortOpen
 * @param {Server} server
 * @returns {boolean} true if port opened
 */
/**
 * @callback runOpenPortProgram
 * @param {String} hostname
 */
/**
 * @param {Global} g
 * @param {Server} server
 * @param {runOpenPortProgram} runOpenPortProgram
 * @param {isPortOpen} isPortOpen
 * @param {Boolean} logErrors
 * @param {String} name
 */
export function openPort(g, server, runOpenPortProgram, isPortOpen, name, logErrors = true) {
  if (server.numOpenPortsRequired > server.openPortCount && !isPortOpen(server)) {
    try {
      runOpenPortProgram(server.hostname)
      g.logf('[%s][%s] Opened port using %s.exe', server.organizationName, server.hostname, name) // TODO: Why does runOpenPortProgram.name not work?
    } catch (e) {
      if (logErrors) g.logf("[%s][%s] Don't have %s.exe installed", server.organizationName, server.hostname, name) // TODO: Why does runOpenPortProgram.name not work?
    }
  }
}

/**
 * @param {Global} g
 * @param {Server} server
 * @param {Boolean} logErrors
 * @returns {Boolean} true if server was nuked
 */
export function nukeServer(g, server, logErrors = true) {
  if (server.numOpenPortsRequired > server.openPortCount) {
    openPort(g, server, g.ns.brutessh, (s) => s.sshPortOpen, 'BruteSSH', logErrors)
    openPort(g, server, g.ns.ftpcrack, (s) => s.ftpPortOpen, 'FTPCrack', logErrors)
    openPort(g, server, g.ns.relaysmtp, (s) => s.smtpPortOpen, 'RelaySMTP', logErrors)
    openPort(g, server, g.ns.sqlinject, (s) => s.sqlPortOpen, 'SQLInject', logErrors)
    openPort(g, server, g.ns.httpworm, (s) => s.httpPortOpen, 'HTTPWorm', logErrors)
    server = g.ns.getServer(server.hostname)
  }
  if (!server.hasAdminRights && server.openPortCount >= server.numOpenPortsRequired) {
    g.ns.nuke(server.hostname)
    g.logf('[%s][%s] Nuked successfully', server.organizationName, server.hostname)
    server = g.ns.getServer(server.hostname)
    return true
  }
  return false
}
