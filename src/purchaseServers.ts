import { hackOnServer } from './utils.js'
import { Global } from './global.js'

let g: Global
export async function main(ns: NS, deleteServers = ns.args[0] || false) {
  g = new Global({ ns, printOnTerminal: false, logEnabled: true })
  const serverLimit = ns.getPurchasedServerLimit()
  let ram = calcBestRam(g, serverLimit)
  if (!ram || ram < 256) ram = 256
  if (deleteServers) {
    deletePurchasedServers(ram)
  }
  g.logf(
    'Will attempt to buy %s servers with %sGB of ram. Each costing $%s',
    (serverLimit - ns.getPurchasedServers().length).toLocaleString(),
    ram.toLocaleString(),
    ns.getPurchasedServerCost(ram).toLocaleString()
  )
  while (ns.getPurchasedServers().length < serverLimit) {
    const cost = ns.getPurchasedServerCost(ram)
    if (ns.getServerMoneyAvailable('home') > cost) {
      const host = ns.purchaseServer('1337haxor', ram)
      const server = ns.getServer(host)
      await hackOnServer(g, server)
      await ns.sleep(10)
    } else {
      g.logf(
        'Cannot afford a new server with %sGB of ram. It costs $%s. Waiting 5s before trying again...',
        ram.toLocaleString(),
        cost.toLocaleString()
      )
      await ns.sleep(5000)
    }
  }
}

function calcBestRam(g: Global, numServers: number): number {
  let ramList = []

  let i = 1
  while (ramList.length < 20) {
    let result = Math.pow(2, i)
    ramList.push(result)
    i++
  }
  const affordableRamList = ramList.filter(
    (ram) => numServers * g.ns.getPurchasedServerCost(ram) <= g.ns.getServerMoneyAvailable('home')
  )
  return ramList[affordableRamList.length - 1]
}

function deletePurchasedServers(newRam: number) {
  const purchasedServers = g.ns.getPurchasedServers()
  for (const hostname of purchasedServers) {
    const currentRam = g.ns.getServerMaxRam(hostname)
    if (currentRam < newRam) {
      g.logf(
        'Deleting server %s with %sGB to be replaced with a server with %sGB',
        hostname,
        currentRam.toLocaleString(),
        newRam.toLocaleString()
      )
      g.ns.killall(hostname)
      g.ns.deleteServer(hostname)
    }
  }
}
