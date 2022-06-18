import { hackOnServer } from './utils.js'
import { Global } from './global.js'

/** @type {Global} */
let g

/**
 * @param {NS} ns
 **/
export async function main(ns, deleteServers = ns.args[0] || false) {
  g = new Global({ ns, printOnTerminal: false, logEnabled: true })
  // ns.tail()
  const serverLimit = ns.getPurchasedServerLimit()
  let ram = calcBestRam(g, serverLimit)
  if (!ram || ram < 256) ram = 256
  if (deleteServers) {
    deletePurchasedServers(ram)
  }
  g.logf(
    'Will attempt to buy %i servers with %iGB of ram. Each costing $%i',
    serverLimit - ns.getPurchasedServers().length,
    ram,
    ns.getPurchasedServerCost(ram)
  )
  while (ns.getPurchasedServers().length < serverLimit) {
    const cost = ns.getPurchasedServerCost(ram)
    if (ns.getServerMoneyAvailable('home') > cost) {
      const host = ns.purchaseServer('1337haxor', ram)
      const server = ns.getServer(host)
      await hackOnServer(g, server)
    } else {
      g.logf('Cannot afford a new server with %iGB of ram. It costs $%i. Waiting 5s before trying again...', ram, cost)
      await ns.sleep(5000)
    }
  }
}

/**
 * @param {Global} g
 * @param {number} numServers
 * @returns {number}
 **/
function calcBestRam(g, numServers) {
  let ramList = []

  let i = 1
  while (ramList.length < 20) {
    let result = Math.pow(2, i)
    ramList.push(result)
    i++
  }
  g.log(ramList)
  const affordableRamList = ramList.filter(
    (ram) => numServers * g.ns.getPurchasedServerCost(ram) <= g.ns.getServerMoneyAvailable('home')
  )
  return ramList[affordableRamList.length - 1]
}

/**
 * @param {number} newRam
 **/
function deletePurchasedServers(newRam) {
  const purchasedServers = g.ns.getPurchasedServers()
  for (const hostname of purchasedServers) {
    const currentRam = g.ns.getServerMaxRam(hostname)
    if (currentRam < newRam) {
      g.logf('Deleting server %s with %iGB to be replaced with a server with %iGB', hostname, currentRam, newRam)
      g.ns.killall(hostname)
      g.ns.deleteServer(hostname)
    }
  }
}
