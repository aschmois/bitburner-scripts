import { Global } from './global.js'

let g: Global
export async function main(ns: NS, deleteServers = ns.args[0] || false) {
  g = new Global({ ns, printOnTerminal: false, logEnabled: true })
  const serverLimit = ns.getPurchasedServerLimit()
  while (ns.getPurchasedServers().length < serverLimit || deleteServers) {
    let ram = calcBestRam(g, Math.max(1, serverLimit - ns.getPurchasedServers().length))
    if (!ram || ram < 256) ram = 256
    if (deleteServers) {
      deleteWorstPurchasedServer(ram)
    }
    const cost = ns.getPurchasedServerCost(ram)
    if (ns.getServerMoneyAvailable('home') > cost) {
      const hostname = ns.purchaseServer('1337haxor', ram)
      g.logf('Bought %s with %sGB of ram. It costed $%s.', hostname, ram.toLocaleString(), cost.toLocaleString())
    }
    await ns.sleep(5000)
  }
}

function calcBestRam(g: Global, numServers: number): number {
  const ramList = []

  let i = 1
  while (ramList.length < 20) {
    const result = Math.pow(2, i)
    ramList.push(result)
    i++
  }
  const affordableRamList = ramList.filter(
    (ram) => numServers * g.ns.getPurchasedServerCost(ram) <= g.ns.getServerMoneyAvailable('home')
  )
  return ramList[affordableRamList.length - 1]
}

function deleteWorstPurchasedServer(newRam: number) {
  let worstServer
  let worstServerRam
  for (const hostname of g.ns.getPurchasedServers()) {
    const ram = g.ns.getServerMaxRam(hostname)
    if (ram < newRam && (!worstServer || !worstServerRam || ram < worstServerRam)) {
      worstServer = hostname
      worstServerRam = ram
    }
  }
  if (worstServer && worstServerRam) {
    g.logf(
      'Deleting server %s with %sGB to be replaced with a server with %sGB',
      worstServer,
      worstServerRam.toLocaleString(),
      newRam.toLocaleString()
    )
    g.ns.killall(worstServer)
    g.ns.deleteServer(worstServer)
  }
}
