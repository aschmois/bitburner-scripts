import { Global } from './lib/global.js'

let g: Global
export async function main(ns: NS) {
  ns.tail()
  g = new Global({ ns, printOnTerminal: false })
  while (true) {
    try {
      const ram = calcBestRam()
      if (!ram) continue // can't afford any server
      if (!deleteWorstPurchasedServer(ram) && ram == g.ns.getPurchasedServerMaxRam()) break // didn't delete any servers and can afford max ram
      const cost = ns.getPurchasedServerCost(ram)
      try {
        const hostname = ns.purchaseServer('1337haxor', ram)
        if (hostname)
          g.printf('Bought %s with %sGB of ram. It costed $%s.', hostname, ram.toLocaleString(), cost.toLocaleString())
      } catch (e) {
        g.printf(
          "Couldn't buy a server with %sGB of ram. It costed $%s. Error: %s",
          ram.toLocaleString(),
          cost.toLocaleString(),
          e
        )
      }
    } finally {
      await ns.sleep(1000)
    }
  }
}

function calcBestRam(): number | null {
  const ramList = [256, 1024, 32768, 262144, g.ns.getPurchasedServerMaxRam()]
  const affordableRamList = ramList.filter(
    (ram) => g.ns.getPurchasedServerCost(ram) <= g.ns.getServerMoneyAvailable('home')
  )
  return affordableRamList ? ramList[affordableRamList.length - 1] : null
}

/**
 * @param newRam The ram that will be purchased to replace this server
 * @returns true if a server was deleted
 */
function deleteWorstPurchasedServer(newRam: number): boolean {
  let worstServer: { hostname: string; ram: number } | undefined
  for (const hostname of g.ns.getPurchasedServers()) {
    const ram = g.ns.getServerMaxRam(hostname)
    if (ram < newRam && (!worstServer || ram < worstServer.ram)) {
      worstServer = { hostname, ram }
    }
  }
  if (worstServer) {
    g.printf(
      'Deleting server %s with %sGB to be replaced with a server with %sGB',
      worstServer.hostname,
      worstServer.ram.toLocaleString(),
      newRam.toLocaleString()
    )
    g.ns.killall(worstServer.hostname)
    g.ns.deleteServer(worstServer.hostname)
    return true
  }
  return false
}
