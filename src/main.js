import { scanForServers, hackOnServer, isHackable, nukeServer } from './utils.js'
import { Global } from './global.js'

/** @type {Global} */
let g
/** @param {NS} ns */
export async function main(ns, killall = ns.args[0] || false) {
  g = new Global({ ns, printOnTerminal: true, logEnabled: true })
  // ns.tail()
  const servers = scanForServers(g)
  for (const [_, server] of servers.entries()) {
    if (server.hostname == 'home') continue
    if (server.purchasedByPlayer) {
      g.logf('[%s][%s] Custom server with %iGB of ram', server.organizationName, server.hostname, server.maxRam)
      if (killall || server.ramUsed == 0) await hackOnServer(g, server)
    } else {
      g.logf(
        '[%s][%s] Root %t. Backdoor: %t. Ports Needed: %i. Ports Opened: %i. Hacking Needed: %i',
        server.organizationName,
        server.hostname,
        server.hasAdminRights,
        server.backdoorInstalled,
        server.numOpenPortsRequired,
        server.openPortCount,
        server.requiredHackingSkill
      )
      nukeServer(g, server)
      if (!server.hasAdminRights) {
        g.logf('[%s][%s] Not rooted', server.organizationName, server.hostname)
        continue
      }
      if (isHackable(g, server)) {
        if (killall || server.ramUsed == 0) await hackOnServer(g, server, server)
      }
    }
  }
}
