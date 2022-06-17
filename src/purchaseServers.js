import { hackOnServer } from './utils.js'
import { Global } from './global.js'

/** @type {Global} */
let g

/**
 * @param {NS} ns
 **/
export async function main(ns) {
  g = new Global({ ns, printOnTerminal: false, logEnabled: true })
  // ns.tail()
  const serverLimit = ns.getPurchasedServerLimit()
  let ram = calcBestRam(g, serverLimit)
  if (ram < 256) ram = 256
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
      ns.sleep(5000)
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

// const totalServers = ns.getPurchasedServers().length + numServers
// const maxServers = (ns.getPurchasedServerLimit() < totalServers) ? ns.getPurchasedServerLimit() : totalServers

// if (totalServers > ns.getPurchasedServerLimit()) {
// 	if (await ns.prompt('The number of servers requested is not available. Delete existing servers with the smallest ram to make room?')) {
// 		deletePurchasedServers(ns, totalServers - ns.getPurchasedServerLimit(), ram)
// 			.forEach(name => {
// 				if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
// 					ns.purchaseServer(name, ram)
// 				}
// 			})

// 		while (ns.getPurchasedServers().length < maxServers) {
// 			if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
// 				let host = serverNameTemplate + ns.getPurchasedServers().length
// 				ns.purchaseServer(host, ram)
// 			}
// 		}
// 	}
// } else {
// 	while (ns.getPurchasedServers().length < maxServers) {
// 		if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
// 			let host = serverNameTemplate + ns.getPurchasedServers().length
// 			ns.purchaseServer(host, ram)
// 		}
// 	}
// }

// /**
//  * @param {NS} ns
//  * @param {number} numServers
//  * @param {number} newRam
//  * @returns {string[]}
//  **/
// function deletePurchasedServers(ns, numServers, newRam) {
// 	let serverNames = []
// 	let servers = ns.getPurchasedServers()
// 		.map(server => ({ 'name': server, 'ram': ns.getServerMaxRam(server) }))
// 		.sort((a, b) => a.ram - b.ram)
// 		.forEach((server, index) => {
// 			if (ns.getServerMaxRam(server.name) >= newRam) {
// 				return
// 			} else if (index < numServers) {
// 				ns.killall(server.name)
// 				ns.deleteServer(server.name)
// 				return serverNames.push(server.name)
// 			}
// 		})
// 	return serverNames
// }
