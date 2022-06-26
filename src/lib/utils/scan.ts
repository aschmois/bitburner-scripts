import { Global } from '../global.js'

import { Hostname } from '../utils.js'

export type Servers = Map<Hostname, Server>

export function scanForServers(
  g: Global,
  predicate: (g: Global, s: Server) => boolean = () => true,
  primaryServer: Server = g.ns.getServer('home'),
  servers: Servers = new Map(),
  delimeter: string = ''
): Servers {
  const secondaryHostnames = g.ns.scan(primaryServer.hostname)
  if (primaryServer.hostname != 'home') {
    secondaryHostnames.shift() // The first scan result is the server right above it
  }
  if (predicate(g, primaryServer)) {
    servers.set(primaryServer.hostname, primaryServer)
    g.printf_(
      'scanForServers',
      '%s>%s %t %i',
      delimeter,
      primaryServer.hostname,
      primaryServer.hasAdminRights,
      primaryServer.requiredHackingSkill
    )
  }
  for (const secondaryHostname of secondaryHostnames) {
    if (secondaryHostname === primaryServer.hostname) continue
    const secondaryServer = g.ns.getServer(secondaryHostname)
    scanForServers(g, predicate, secondaryServer, servers, delimeter != '' ? delimeter + '----|' : '|')
  }
  return servers
}

export function isHackable(g: Global, server: Server): boolean {
  return (
    !server.purchasedByPlayer &&
    server.hasAdminRights &&
    server.moneyMax > 0 &&
    server.requiredHackingSkill <= g.ns.getHackingLevel()
  )
}

export function canBeHackedOn(g: Global, server: Server): boolean {
  return (
    server.hasAdminRights &&
    server.maxRam > 0 &&
    (server.purchasedByPlayer || server.moneyMax == 0 || server.requiredHackingSkill > g.ns.getHackingLevel())
  )
}
