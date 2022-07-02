import { Global } from 'lib/global.js'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean } = ns.flags([['terminal', false]])
  g = new Global({ ns, printOnTerminal: a.terminal })
  const maxNodes = ns.args[0]
  const maxMoney = ns.args[1]
  if (!_.isNumber(maxNodes) || !_.isNumber(maxMoney)) throw 'args need to be number'
  while (true) {
    const myMoney = ns.getServerMoneyAvailable('home')
    const allowance = myMoney * (maxMoney / 100)

    if (ns.hacknet.getPurchaseNodeCost() < allowance && ns.hacknet.numNodes() < maxNodes) {
      g.print('Purchasing new node')
      ns.hacknet.purchaseNode()
      continue
    }

    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
      const node = ns.hacknet.getNodeStats(i)
      const roi = []
      let topRoI = 0

      if (node.level < 200) {
        roi.push(
          ((node.level + 1) * 1.6 * Math.pow(1.035, node.ram - 1) * ((node.cores + 5) / 6)) /
            ns.hacknet.getLevelUpgradeCost(i, 1)
        )
      } else {
        roi.push(0)
      }

      if (node.ram < 64) {
        roi.push(
          (node.level * 1.6 * Math.pow(1.035, node.ram * 2 - 1) * ((node.cores + 5) / 6)) /
            ns.hacknet.getRamUpgradeCost(i, 1)
        )
      } else {
        roi.push(0)
      }

      if (node.cores < 16) {
        roi.push(
          (node.level * 1.6 * Math.pow(1.035, node.ram - 1) * ((node.cores + 6) / 6)) /
            ns.hacknet.getCoreUpgradeCost(i, 1)
        )
      } else {
        roi.push(0)
      }

      roi.forEach((value) => {
        if (value > topRoI) {
          topRoI = value
        }
      })

      if (i === maxNodes - 1 && topRoI === 0) {
        g.print('Desired number of nodes reached and upgraded')
        return ns.exit()
      } else if (topRoI === 0) {
        g.print('All upgrades maxed on node' + i)
      } else if (topRoI == roi[0] && ns.hacknet.getLevelUpgradeCost(i, 1) < allowance) {
        g.print('Upgrading Level on Node' + i)
        ns.hacknet.upgradeLevel(i, 1)
      } else if (topRoI == roi[1] && ns.hacknet.getRamUpgradeCost(i, 1) < allowance) {
        g.print('Upgrading Ram on Node' + i)
        ns.hacknet.upgradeRam(i, 1)
      } else if (topRoI == roi[2] && ns.hacknet.getCoreUpgradeCost(i, 1) < allowance) {
        g.print('Upgrading Core on Node' + i)
        ns.hacknet.upgradeCore(i, 1)
      }
    }

    await ns.sleep(10)
  }
}
