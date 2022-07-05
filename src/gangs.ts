import { GangMemberAscension, GangMemberInfo } from '@ns'
import EasyTable from 'easy-table'

import { Global } from './lib/global.js'
import { Printer } from '/lib/easy-table.js'

let g: Global
export async function main(ns: NS) {
  const {
    terminal,
    favorMoney,
    favorTraining,
    noAscend,
  }: { terminal: boolean; favorMoney: boolean; favorTraining: boolean; noAscend: boolean } = ns.flags([
    ['terminal', false],
    ['favorMoney', false],
    ['favorTraining', false],
    ['noAscend', false],
  ])
  g = new Global({ ns, printOnTerminal: terminal })

  const gang = g.ns.gang
  while (true) {
    try {
      // canRecruitMember is not really needed but can help with performance. Replace with `true` to save on RAM
      while (gang.canRecruitMember()) {
        const newName = Math.random().toString(36).slice(2, 7)
        gang.recruitMember(newName)
      }
    } catch (e) {
      // don't care about errors here, we just recruit until we can't
    }

    const members = gang
      .getMemberNames()
      .map((name) => gang.getMemberInformation(name))
      .sort((a, b) => b.hack - a.hack) // sort highest hacking first
    const equipment = gang
      .getEquipmentNames()
      .reduce((acc, equipmentName) => {
        const piece = gang.getEquipmentStats(equipmentName)
        if (piece.cha || piece.hack) {
          acc.push({ name: equipmentName, cost: gang.getEquipmentCost(equipmentName) })
        }
        return acc
      }, [] as { name: string; cost: number }[])
      .sort((a, b) => a.cost - b.cost) // sort cheapest equipment first

    const preProcessGangInfo = gang.getGangInformation()
    const table = new EasyTable()

    for (const _member of members) {
      let member = _member
      table.cell('Name', member.name)
      table.cell('Hack', member.hack, Printer.nNumber(g))

      /* Ascension */
      const ascension = gang.getAscensionResult(member.name)
      const check = hackProps.some((prop) => {
        return getPropReadyToAscend(member, ascension, prop)
      })

      // hack
      const hackAsc = ascension?.hack ?? 0
      table.cell('Hack', member.hack, Printer.nNumber(g))
      table.cell('HAM', member.hack_asc_mult, Printer.nNumber(g))
      table.cell('HAR', hackAsc, Printer.nNumber(g))
      table.cell('CHAV', member.hack_asc_mult * hackAsc, Printer.nNumber(g))
      table.cell('HAV', getValueToAscend(member.hack_asc_mult), Printer.nNumber(g))

      // Should not ascend if we don't have at least 10b
      if (check && g.ns.getServerMoneyAvailable('home') >= 10_000_000_000) {
        if (noAscend) {
          table.cell('Asc', '✓')
        } else {
          table.cell('Asc', gang.ascendMember(member.name) ? '✓' : 'X')
          // since the member was ascended update the reference
          member = gang.getMemberInformation(member.name)
        }
      } else {
        table.cell('Asc', 'X')
      }

      /* Task management */
      const gangInfo = gang.getGangInformation()

      // By default launder money
      let task: HackingGangJob = HackingGangJob.MoneyLaundering

      // If our wanted penalty is too high, lower it
      if (
        gangInfo.respect > 0 &&
        ((member.task === HackingGangJob.EthicalHacking && gangInfo.wantedPenalty < 0.99) ||
          (gangInfo.wantedPenalty < 0.99 && gangInfo.wantedLevelGainRate >= 0))
      ) {
        task = HackingGangJob.EthicalHacking
      }

      // If the member is too weak, train them
      if (favorTraining || member.hack < 5000 || (!favorMoney && (ascension?.hack ?? 0) < 1.5)) {
        task = HackingGangJob.TrainHacking
      }

      gang.setMemberTask(member.name, task)

      /* Equipment */
      const currEquipment = new Set([...member.upgrades, ...member.augmentations])
      let equipCost = 0
      for (const { name, cost } of equipment) {
        if (!currEquipment.has(name) && !gang.purchaseEquipment(member.name, name)) {
          equipCost += cost
        }
      }
      table.cell('Equip Cost', equipCost, Printer.currency(g))

      if (member.task !== task) table.cell('Task', `${member.task} -> ${task}`)
      else table.cell('Task', task)
      table.newRow()
      await g.ns.sleep(1) // give cpu rest between members
    }
    g.ns.clearLog()
    g.printTable(table.sort(['Hack']))
    g.printf(
      '[%s][%s] $%s/s | Members: %s | Power: %s | Respect: %s;%s/s | Territory: %s | Wanted: %s;%s/s;%s%%',
      preProcessGangInfo.faction,
      preProcessGangInfo.isHacking ? 'HACKING' : 'COMBAT',
      g.n(preProcessGangInfo.moneyGainRate),
      g.n(members.length),
      g.n(preProcessGangInfo.power),
      g.n(preProcessGangInfo.respect),
      g.n(preProcessGangInfo.respectGainRate),
      g.n(preProcessGangInfo.territory),
      g.n(preProcessGangInfo.wantedLevel),
      g.n(preProcessGangInfo.wantedLevelGainRate),
      g.n(preProcessGangInfo.wantedPenalty * 100)
    )
    await g.ns.sleep(500)
  }
}

function getPropReadyToAscend(member: GangMemberInfo, ascension: GangMemberAscension | undefined, prop: GangTypeProps) {
  if (!ascension) return false // ascension is impossible
  const newMult = ascension[prop]
  if (newMult === 1) return false // not enough xp gained yet
  const currMult = member[`${prop}_asc_mult`]
  const resultedMult = currMult * newMult
  if (resultedMult <= currMult) return false // for whatever reason the resulting ascension would do nothing or negatively affect the value
  return resultedMult > getValueToAscend(currMult)
}

function getValueToAscend(currMult: number) {
  return Math.pow(2, Math.floor(Math.log(currMult) / Math.log(2)) + 1)
  // return Math.pow(2, Math.floor(Math.log(currMult) / Math.log(2)))
}

type GangTypeProps = 'str' | 'def' | 'dex' | 'agi' | 'hack' | 'cha'
// type GangCombatTypeProps = 'str' | 'def' | 'dex' | 'agi' | 'hack' | 'cha'
// const combatProps: GangCombatTypeProps[] = ['str', 'def', 'dex', 'agi', 'hack', 'cha']

type GangHackTypeProps = 'hack' | 'cha'
const hackProps: GangHackTypeProps[] = ['hack', 'cha']

enum HackingGangJob {
  Unassigned = 'Unassigned',
  Ransomware = 'Ransomware',
  Phishing = 'Phishing',
  IdentityTheft = 'Identity Theft',
  DDoSAttacks = 'DDoS Attacks',
  PlantVirus = 'Plant Virus',
  FraudCounterfeiting = 'Fraud & Counterfeiting',
  MoneyLaundering = 'Money Laundering',
  Cyberterrorism = 'Cyberterrorism',
  EthicalHacking = 'Ethical Hacking',
  VigilanteJustice = 'Vigilante Justice',
  TrainCombat = 'Train Combat',
  TrainHacking = 'Train Hacking',
  TrainCharisma = 'Train Charisma',
  TerritoryWarfare = 'Territory Warfare',
}
