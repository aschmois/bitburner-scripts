import { getWeightedServerValue, isHackable, scanForServers } from './utils.js'
import { Global } from './global.js'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean; tail: boolean; c: boolean } = ns.flags([
    ['terminal', false],
    ['tail', false],
    ['c', false],
  ])
  if (a.tail) ns.tail()
  g = new Global({ ns, printOnTerminal: a.terminal, logEnabled: true })
  while (true) {
    const servers = scanForServers(g, isHackable)
    const values = []
    for (const [_hostname, _server] of servers.entries()) {
      values.push(getWeightedServerValue(g, _server))
    }
    values.sort((a, b) => a.value - b.value)
    for (const { log } of values) {
      g.log(log)
    }
    if (a.c) await ns.sleep(10000)
    else break
  }
}
