import { searchForHosts, hackOnServer, isHackable } from './utils.js'
import { Global } from './global.js'

/** @type {Global} */
let g
/** @param {NS} ns */
export async function main(ns, killall = ns.args[0] || false) {
  g = new Global({ ns, printOnTerminal: true, logEnabled: true })
  // ns.tail()
  const hostNames = searchForHosts(g)
  hostNames.delete('home')
  for (const hostName of hostNames) {
    let server = ns.getServer(hostName)
    if (server.purchasedByPlayer) {
      g.logf('[%s] Custom server with %iGB of ram', server.hostname, server.maxRam)
      if (killall || server.ramUsed == 0) await hackOnServer(g, server.hostname)
    } else {
      g.logf(
        '[%s] Root %t. Backdoor: %t. Ports Needed: %i. Ports Opened: %i. Hacking Needed: %i',
        server.hostname,
        server.hasAdminRights,
        server.backdoorInstalled,
        server.numOpenPortsRequired,
        server.openPortCount,
        server.requiredHackingSkill
      )
      if (server.numOpenPortsRequired > server.openPortCount) {
        openPort(server.hostname, ns.brutessh, (s) => s.sshPortOpen, 'BruteSSH')
        openPort(server.hostname, ns.ftpcrack, (s) => s.ftpPortOpen, 'FTPCrack')
        openPort(server.hostname, ns.relaysmtp, (s) => s.smtpPortOpen, 'RelaySMTP')
        openPort(server.hostname, ns.sqlinject, (s) => s.sqlPortOpen, 'SQLInject')
        openPort(server.hostname, ns.httpworm, (s) => s.httpPortOpen, 'HTTPWorm')
        server = ns.getServer(server.hostname)
      }
      if (!server.hasAdminRights && server.openPortCount >= server.numOpenPortsRequired) {
        // g.logf("[%s] Nuking...", server.hostname)
        ns.nuke(server.hostname)
        g.logf('[%s] Nuked successfully', server.hostname)
        server = ns.getServer(server.hostname)
      }
      if (!server.hasAdminRights) {
        g.logf('[%s] Not rooted', server.hostname)
        continue
      }
      if (isHackable(g, server)) {
        if (killall || server.ramUsed == 0) await hackOnServer(g, server.hostname, server)
      }
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
 * @param {String} hostName
 * @param {runOpenPortProgram} runOpenPortProgram
 * @param {isPortOpen} isPortOpen
 * @param {String} name
 */
function openPort(hostName, runOpenPortProgram, isPortOpen, name) {
  const server = g.ns.getServer(hostName)
  if (server.numOpenPortsRequired > server.openPortCount && !isPortOpen(server)) {
    try {
      runOpenPortProgram(server.hostname)
      g.logf('[%s] Opened port using %s.exe', server.hostname, name) // TODO: Why does fn.name not work?
    } catch (e) {
      g.logf("[%s] Don't have %s.exe installed", server.hostname, name) // TODO: Why does fn.name not work?
    }
  }
}
