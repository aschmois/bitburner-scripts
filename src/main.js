import { scanForServers, hackOnServer, isHackable, nukeServer } from './utils.js'
import { Global } from './global.js'

/** @type {Global} */
let g
/** @param {NS} ns */
export async function main(ns) {
  /** @type {{killall: Boolean, tail: Boolean}}  */
  const a = ns.flags([
    ['killall', false],
    ['tail', false],
  ])
  if (a.tail) ns.tail()
  g = new Global({ ns, printOnTerminal: a.killall, logEnabled: true })
  while (true) {
    const servers = scanForServers(g)
    for (const [_, server] of servers.entries()) {
      if (server.hostname == 'home') continue
      if (server.purchasedByPlayer) {
        if (a.killall || server.ramUsed == 0) await hackOnServer(g, server)
      } else {
        nukeServer(g, server, false, false)
        if (!server.hasAdminRights) {
          continue
        }
        if (isHackable(g, server) && (a.killall || server.ramUsed == 0)) {
          await hackOnServer(g, server, server)
        }
      }
    }
    await ns.sleep(10)
    if (a.killall) break
  }
}
