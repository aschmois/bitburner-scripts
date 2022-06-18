import { getServersThatNeedBackdoor, nukeServer } from './utils.js'
import { Global } from './global.js'

/** @type {Global} */
let g
/** @param {NS} ns */
export async function main(ns, killall = ns.args[0] || false) {
  g = new Global({ ns, printOnTerminal: true, logEnabled: true })
  // ns.tail()
  const serversThatNeedBackdoor = getServersThatNeedBackdoor(g)

  for (const [_, server] of serversThatNeedBackdoor.entries()) {
    if (!server.purchasedByPlayer) {
      nukeServer(g, server, true, false)
      if (server.hasAdminRights && ns.getHackingLevel() >= server.requiredHackingSkill) {
        g.slogf(
          server,
          'Max Money: %s. Base Difficulty: %i. Max RAM %sGB.',
          server.moneyMax.toLocaleString(),
          server.baseDifficulty,
          server.maxRam.toLocaleString()
        )
      }
    }
  }
}
