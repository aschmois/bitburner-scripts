import { Server } from '@ns'

import { Global } from 'lib/global.js'

export type Stats = {
  moneyPerS: number
  threads: number
  weight: number
  adjustment: number
  value: number
  chance: number
  server: Server
}

export function getWeightedServerValue(g: Global, server: Server): { value: number; log: Stats } {
  const moneyAvailable = g.ns.getServerMoneyAvailable(server.hostname)
  const moneyPerS = (g.ns.hackAnalyze(server.hostname) * moneyAvailable) / (g.ns.getHackTime(server.hostname) / 1000)
  let threads = g.ns.hackAnalyzeThreads(server.hostname, moneyAvailable)
  if (!threads || threads === Infinity || isNaN(threads)) {
    threads = 0
  }
  const chance = g.ns.hackAnalyzeChance(server.hostname)
  let weight = chance
  // Prefer servers with higher chance to hack
  if (chance > 0.5) weight += 0.1
  if (chance > 0.8) weight += 0.2
  if (chance === 1) weight += 0.5
  const adjustment = server.moneyMax / 1000000000
  const value = moneyPerS * threads * weight + adjustment
  return { value, log: { moneyPerS, threads, weight, adjustment, value, chance, server } }
}
