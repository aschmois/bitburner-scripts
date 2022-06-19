export async function main(ns: NS) {
  const host = '' + ns.args[0] || ns.getHostname()
  while (true) {
    while (true) {
      let chance = ns.hackAnalyzeChance(host) * 100
      if (chance > 50) break
      ns.printf('Chance to hack is %%%d, weakening...', chance)
      await ns.weaken(host)
    }
    const currentMoney = ns.getServerMoneyAvailable(host)
    const maxMoney = ns.getServerMaxMoney(host)
    if (currentMoney / maxMoney < 0.1) {
      await ns.grow(host)
    }
    await ns.hack(host)
  }
}
