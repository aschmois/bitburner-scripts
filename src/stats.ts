import { Global } from './lib/global.js'

import { isHackable, scanForServers } from './lib/utils/scan.js'
import { getWeightedServerValue } from './lib/utils/stats.js'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean; con: boolean } = ns.flags([
    ['terminal', false],
    ['con', false],
  ])
  g = new Global({ ns, printOnTerminal: a.terminal })
  while (true) {
    g.enableLog('scanForServers')
    scanForServers(g, (g, s) => !s.purchasedByPlayer)
    g.disableLog('scanForServers')
    const servers = scanForServers(g, isHackable)
    const values = []
    for (const [_hostname, _server] of servers.entries()) {
      values.push(getWeightedServerValue(g, _server))
    }
    values.sort((a, b) => a.value - b.value)
    const table: string[][] = [
      [
        'hostname',
        '$/s',
        '*',
        'threads',
        '=',
        't$/s',
        '*',
        'weight',
        '+',
        '$max/1b',
        '=',
        'value',
        '|',
        'chance',
        'diff',
        'lvl',
        '$avail/$max',
      ],
      [
        '--------',
        '---',
        '-',
        '-------',
        '-',
        '----',
        '-',
        '------',
        '-',
        '-------',
        '-',
        '-----',
        '-',
        '------',
        '----',
        '---',
        '-----------',
      ],
    ]
    for (const { log } of values) {
      const theoreticalMoneyPerS = log.moneyPerS * log.threads
      table.push([
        log.server.hostname,
        `${g.ns.nFormat(log.moneyPerS, '$0.00a')}/s`,
        '*',
        g.ns.nFormat(log.threads, '0,0'),
        '=',
        `${g.ns.nFormat(theoreticalMoneyPerS, '$0.00a')}/s`,
        '*',
        g.ns.nFormat(log.weight, '0.00a'),
        '+',
        g.ns.nFormat(log.server.moneyMax / 1000000000, '$0.00a'),
        '=',
        g.ns.nFormat(log.value, '0.00a'),
        '|',
        (log.chance * 100).toFixed(0) + '%',
        g.ns.nFormat(log.server.baseDifficulty, '0,0'),
        g.ns.nFormat(log.server.requiredHackingSkill, '0,0'),
        g.ns.nFormat(log.server.moneyAvailable, '$0.00a') + '/' + g.ns.nFormat(log.server.moneyMax, '$0.00a'),
      ])
    }
    g.ns.clearLog()
    g.printTable({
      rows: table,
      opts: {
        align: ['l', ...Array(table[0].length - 1).fill('r')],
      },
    })
    if (a.con) await ns.sleep(100)
    else break
  }
}
