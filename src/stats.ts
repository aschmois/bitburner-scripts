import { Global } from './lib/global'

import { isHackable, scanForServers } from './lib/utils/scan'
import { getWeightedServerValue } from './lib/utils/stats'
import EasyTable from 'easy-table'
import { padCol, padRight, Printer, removeSeparator } from '/lib/easy-table'

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
    removeSeparator(table)
    enum Stats {
      Hostname = ' hostname ',
      MoneyPerSec = ' money/s ',
      Threads = '* threads ',
      TheoreticalMoneyPerSec = '= t$/s ',
      Weight = '* wght ',
      Adjustment = '+ adj ',
      Value = '= value ',
      Sep = ' | ',
      Chance = ' chance ',
      BaseDifficulty = ' diff ',
      HackingLevelRequired = ' lvl ',
      MoneyAvailable = ' $avail',
      MoneyMax = '/$max ',
    }
    for (const { log } of values) {
      const theoreticalMoneyPerS = log.moneyPerS * log.threads
      table.cell(Stats.Hostname, log.server.hostname, Printer.string(g))
      table.cell(Stats.MoneyPerSec, log.moneyPerS, Printer.currency(g, { post: '/s ' }))
      table.cell(Stats.Threads, log.threads, Printer.nNumber(g, { pre: '* ' }))
      table.cell(Stats.TheoreticalMoneyPerSec, theoreticalMoneyPerS, Printer.currency(g, { pre: '= ', post: '/s ' }))
      table.cell(Stats.Weight, log.weight, Printer.nNumber(g, { pre: '* ' }))
      table.cell(Stats.Adjustment, log.server.moneyMax / 1000000000, Printer.currency(g, { pre: '+ ' }))
      table.cell(Stats.Value, log.value, Printer.nNumber(g, { pre: '= ' }))
      table.cell(Stats.Sep, '|', Printer.string(g))
      table.cell(Stats.Chance, log.chance, Printer.percent(g))
      table.cell(Stats.BaseDifficulty, log.server.baseDifficulty, Printer.number(g))
      table.cell(Stats.HackingLevelRequired, log.server.requiredHackingSkill, Printer.number(g))
      table.cell(Stats.MoneyAvailable, log.server.moneyAvailable, Printer.currency(g, { post: '' }))
      table.cell(Stats.MoneyMax, log.server.moneyMax, Printer.currency(g, { pre: '/', pad: padRight }))
      table.newRow()
    }
    table.sort([Stats.Value])
    padCol(table, Stats.Hostname, 20, '-')
    padCol(table, Stats.MoneyPerSec, 12, '-')
    padCol(table, Stats.Threads, 10, '-')
    padCol(table, Stats.TheoreticalMoneyPerSec, 13, '-')
    padCol(table, Stats.Weight, 7, '-')
    padCol(table, Stats.Adjustment, 10, '-')
    padCol(table, Stats.Value, 10, '-')
    padCol(table, Stats.Sep, 3, '-')
    padCol(table, Stats.Chance, 6, '-')
    padCol(table, Stats.BaseDifficulty, 4, '-')
    padCol(table, Stats.HackingLevelRequired, 8, '-')
    padCol(table, Stats.MoneyAvailable, 9, '-')
    padCol(table, Stats.MoneyMax, 10, '-')
    table.newRow()
    g.ns.clearLog()
    g.printTable(table)
    if (a.con) await ns.sleep(100)
    else break
  }
}
