import { Global } from './global.js'

/**
 * @param {Global} g
 * @param {String} currentNode
 * @param {Set<String>} hostArray Note: this is mutated
 * @returns {Set<String>} all scannable hosts. Note: Same as the `hostArray` param
 */
export function searchForHosts(g, currentNode = 'home', hostArray = new Set()) {
  hostArray.add(currentNode)
  const nodes = g.ns.scan(currentNode)

  for (const node of nodes) {
    if (!hostArray.has(node)) searchForHosts(g, node, hostArray)
  }
  return hostArray
}

/**
 * @param {Global} g
 * @param {Server} server
 * @returns {Boolean} true if server can be hacked and has money to hack
 */
export function isHackable(g, server) {
  return (
    !server.purchasedByPlayer &&
    server.hasAdminRights &&
    server.moneyMax > 0 &&
    server.requiredHackingSkill <= g.ns.getHackingLevel()
  )
}

/**
 * @param {Global} g
 * @returns {Set<Server>}
 */
export function getHackableServers(g) {
  const allHostNames = searchForHosts(g)
  const hackableHostNames = new Set()
  for (const hostName of allHostNames) {
    const server = g.ns.getServer(hostName)
    if (isHackable(g, server)) {
      hackableHostNames.add(server)
    }
  }
  return hackableHostNames
}

/**
 * @param {Global} g
 * @param {String} hostNameToHackOn
 * @param {Server=} singleServerToHack If undefined will hack all available hackable servers
 */
export async function hackOnServer(g, hostNameToHackOn, singleServerToHack) {
  let serversToHack
  if (singleServerToHack) {
    serversToHack = new Set()
    serversToHack.add(singleServerToHack)
  } else {
    serversToHack = getHackableServers(g)
  }
  g.ns.killall(hostNameToHackOn)
  await g.ns.scp('simple.js', hostNameToHackOn)
  const maxRam = g.ns.getServerMaxRam(hostNameToHackOn)
  if (maxRam == 0) {
    g.logf("[%s] Can't hack on this server. It has no ram.", hostNameToHackOn)
    return
  }
  const ramCost = g.ns.getScriptRam('simple.js', hostNameToHackOn)
  const instances = maxRam / ramCost
  const instancesPerServerToHack = instances / serversToHack.size
  g.logf(
    '[%s] Total instances: %i. Servers to hack: %i. Instances per server hack: %i',
    hostNameToHackOn,
    instances,
    serversToHack.size,
    instancesPerServerToHack
  )
  for (const serverToHack of serversToHack) {
    const pid = g.ns.exec('simple.js', hostNameToHackOn, instancesPerServerToHack, serverToHack.hostname)
    if (pid == 0) {
      g.logf(
        "[%s] Attempted to run %i to hack server %s, but couldn't.",
        hostNameToHackOn,
        instancesPerServerToHack,
        serverToHack.hostname
      )
      break
    }
  }
}
