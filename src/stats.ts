import { Global } from './lib/global'

import { isHackable, scanForServers } from './lib/utils/scan'
import { getWeightedServerValue } from './lib/utils/stats'
import EasyTable from 'easy-table'
import { Printer } from '/lib/easy-table'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean; con: boolean } = ns.flags([
    ['terminal', false],
    ['con', false],
  ])
  g = new Global({ ns, printOnTerminal: a.terminal })
  g.disableLog('scanForServers')
  while (true) {
    scanForServers(g, (g, s) => !s.purchasedByPlayer)
    const servers = scanForServers(g, isHackable)
    const values = []
    for (const [_hostname, _server] of servers.entries()) {
      values.push(getWeightedServerValue(g, _server))
    }
    const table = new EasyTable()
    for (const { log } of values) {
      const theoreticalMoneyPerS = log.moneyPerS * log.threads
      table.cell('hostname', log.server.hostname)
      table.cell('$/s', log.moneyPerS, Printer.currency(g, { post: '/s' }))
      table.cell('threads', log.threads, Printer.number(g, { pre: '*' }))
      table.cell('t$/s', theoreticalMoneyPerS, Printer.currency(g, { pre: '=', post: '/s' }))
      table.cell('weight', log.weight, Printer.nNumber(g, { pre: '*' }))
      table.cell('$max/1b', log.server.moneyMax / 1000000000, Printer.currency(g, { pre: '+' }))
      table.cell('value', log.value, Printer.nNumber(g, { pre: '=' }))
      table.cell('chance', log.chance, Printer.percent(g))
      table.cell('diff', log.server.baseDifficulty, Printer.number(g))
      table.cell('lvl', log.server.requiredHackingSkill, Printer.number(g))
      table.cell('$avail', log.server.moneyAvailable, Printer.currency(g))
      table.cell('$max', log.server.moneyMax, Printer.currency(g))
      table.newRow()
    }
    g.ns.clearLog()
    g.printTable(table.sort(['value']))
    if (a.con) await ns.sleep(100)
    else break
  }
}
