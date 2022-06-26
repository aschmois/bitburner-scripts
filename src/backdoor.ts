import { nukeServer, scanForServers } from './lib/utils.js'
import { Global } from './lib/global.js'

let g: Global
export async function main(ns: NS) {
  g = new Global({ ns, printOnTerminal: true })
  // ns.tail()
  const serversThatNeedBackdoor = scanForServers(g, (_g, server) => !server.backdoorInstalled)

  for (const [_hostname, server] of serversThatNeedBackdoor.entries()) {
    if (!server.purchasedByPlayer) {
      g.disableLog('openPort')
      nukeServer(g, server)
      if (server.hasAdminRights && ns.getHackingLevel() >= server.requiredHackingSkill) {
        g.printf(
          '[%s] Max Money: %s. Base Difficulty: %i. Max RAM %sGB.',
          server.hostname,
          server.moneyMax.toLocaleString(),
          server.baseDifficulty,
          server.maxRam.toLocaleString()
        )
      }
    }
  }
}
