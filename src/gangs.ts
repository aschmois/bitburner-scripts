import { GangMemberAscension, GangMemberInfo } from '@ns'

import { Global } from './lib/global.js'

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

    const table: string[][] = [['Name', 'Hack', 'hack_asc_mul', 'hack_exp', 'Asc', 'Task', 'Equip Cost']]

    for (const memberName of memberNames) {
      let member = gang.getMemberInformation(memberName)
      const log = [memberName]

      /* Ascension */
      const ascension = gang.getAscensionResult(memberName)
      const check = hackProps.some((prop) => {
        return getPropReadyToAscend(member, ascension, prop)
      })

      // hack
      log.push(g.n(member.hack))
      log.push(
        `${g.n(member.hack_asc_mult)} * ${g.n(ascension?.hack ?? 0)} > ${g.n(getValueToAscend(member.hack_asc_mult))}`
      )
      log.push(g.n(member.hack_exp))

      // Should not ascend if we don't have at least 10b
      if (check && g.ns.getServerMoneyAvailable('home') >= 10_000_000_000) {
        if (noAscend) {
          log.push('✓')
        } else {
          log.push(gang.ascendMember(memberName) ? '✓' : 'X')
          member = gang.getMemberInformation(memberName)
        }
      } else {
        log.push('X')
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

      gang.setMemberTask(memberName, task)

      if (member.task !== task) log.push(`${member.task} -> ${task}`)
      else log.push(task)

      /* Equipment */
      const currEquipment = new Set([...member.upgrades, ...member.augmentations])
      let equipCost = 0
      for (const { name, cost } of equipment) {
        if (!currEquipment.has(name) && !gang.purchaseEquipment(member.name, name)) {
          equipCost += cost
        }
      }
      log.push(equipCost > 0 ? g.n(equipCost, '$0.00a') : '✓')
      table.push(log)
    }
    g.ns.clearLog()
    g.printTable({
      rows: table,
      opts: {
        align: [
          'l', // Name
          'r', // Hack
          'r', // hack_asc_mul
          'r', // hack_exp
          'c', // Asc
          'l', // Task
          'r', // Equip Cost
        ],
      },
    })
    await g.ns.sleep(1000)
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
