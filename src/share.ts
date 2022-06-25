import { scanForServers, Scripts, maximizeScriptExec } from './utils.js'
import { Global } from './global.js'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean; tail: boolean } = ns.flags([
    ['terminal', false],
    ['tail', false],
  ])
  if (a.tail) ns.tail()
  g = new Global({ ns, printOnTerminal: a.terminal })
  g.disableLog('maximizeScriptExec')
  g.disableLog('scanForServers')
  const servers = scanForServers(g)
  while (true) {
    for (const [_hostname, server] of servers.entries()) {
      if (server.hasAdminRights && server.maxRam > 0) {
        maximizeScriptExec(g, server, Scripts.Share)
      }
    }
    await ns.sleep(10)
  }
}
