import { scanForServers, hackOnServer, isHackable, nukeServer, canBeHackedOn } from './utils.js'
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
      if (!server.hasAdminRights) {
        if (!nukeServer(g, server, false, false)) continue
      }
      if (a.killall || server.ramUsed == 0) {
        if (isHackable(g, server)) {
          await hackOnServer(g, server, server) // hack itself
        } else if (canBeHackedOn(g, server)) {
          await hackOnServer(g, server) // hack others
        }
      }
    }
    await ns.sleep(10)
    if (a.killall) break
  }
}
