import { EquipmentStats, GangMemberAscension, GangMemberInfo } from '@ns'
import EasyTable from 'easy-table'

import { Global } from './lib/global.js'
import { Printer } from '/lib/easy-table.js'

const territoryWarfareMax = 2

let g: Global
export async function main(ns: NS) {
  const { terminal, noAscend }: { terminal: boolean; noAscend: boolean } = ns.flags([
    ['terminal', false],
    ['noAscend', false],
  ])
  g = new Global({ ns, printOnTerminal: terminal })
  let hasFormulaApi = false

  const gang = g.ns.gang

  while (true) {
    if (!hasFormulaApi) {
      hasFormulaApi = g.ns.fileExists('Formulas.exe', 'home')
    }
    const preProcessGangInfo = gang.getGangInformation()
    const maxMembers = preProcessGangInfo.isHacking ? 12 : 12 // TODO: combat
    try {
      while (gang.canRecruitMember()) {
        const newName = Math.random().toString(36).slice(2, 7)
        if (!gang.recruitMember(newName)) break
        await g.ns.sleep(1)
      }
    } catch (e) {
      // don't care about errors here, we just recruit until we can't
    }
    const needMoreMembers = gang.getMemberNames().length < maxMembers
    const combatMemberNames = new Set<string>()
    const combatMembers = []
    const members = gang
      .getMemberNames()
      .map((name) => gang.getMemberInformation(name))
      .sort(
        (a, b) =>
          a.agi_asc_mult +
          a.def_asc_mult +
          a.dex_asc_mult +
          a.str_asc_mult -
          (b.agi_asc_mult + b.def_asc_mult + b.dex_asc_mult + b.str_asc_mult)
      ) // Sort by highest combat last
    for (let index = 0; index < territoryWarfareMax; index++) {
      const member = members.pop() // Remove combat members from main array
      if (!member) break
      combatMemberNames.add(member.name)
      combatMembers.push(member)
    }
    // sort main array by highest hacking first
    members.sort((a, b) => b.hack_asc_mult - a.hack_asc_mult)
    // Re add combat members to the end of the array
    members.push(...combatMembers)

    let maxCombatEquipCost = 0
    let maxHackEquipCost = 0
    const equipment = gang
      .getEquipmentNames()
      .reduce((acc, equipmentName) => {
        const type = gang.getEquipmentType(equipmentName)
        const stats = gang.getEquipmentStats(equipmentName)
        const cost = gang.getEquipmentCost(equipmentName)
        if (type !== 'Augmentation') {
          if (stats.agi || stats.def || stats.dex || stats.str || stats.hack || stats.cha) maxCombatEquipCost += cost
          if (stats.hack || stats.cha) maxHackEquipCost += cost
        }
        acc.push({ name: equipmentName, cost, stats, type })
        return acc
      }, [] as { name: string; cost: number; stats: EquipmentStats; type: EquipmentType }[])
      .sort((a, b) => a.cost - b.cost) // sort cheapest equipment first

    const table = new EasyTable()
    const hackTable = new EasyTable()
    const chaTable = new EasyTable()
    const agiTable = new EasyTable()
    const defTable = new EasyTable()
    const dexTable = new EasyTable()
    const strTable = new EasyTable()
    const preProcessMembers: Map<
      string,
      { equipCost: number; augCost: number; shouldAsc: boolean; ascResults?: GangMemberAscension }
    > = new Map()

    let aMemberNeedsEquipmentMoney = false
    let aMemberNeedsMoney = false
    /* Pre process members */
    for (const member of members) {
      const isCombat = isCombatMember(g, member.name, combatMemberNames)
      const currEquipment = new Set([...member.upgrades, ...member.augmentations])
      const ascResults = gang.getAscensionResult(member.name)
      const propsToCheck = isCombat ? combatProps : hackProps
      const shouldAsc = propsToCheck.some((prop) => {
        return getPropReadyToAscend(member, ascResults, prop)
      })
      let equipCost = 0
      let augCost = 0
      for (const { name, cost, stats, type } of equipment) {
        if (!shouldAsc || type === 'Augmentation') {
          if (
            stats.hack ||
            (isCombat && (stats.agi || stats.def || stats.dex || stats.str)) || // Only purchase combat if needs territory
            (stats.cha && member.hack >= 5000) // Don't purchase charisma stuff until hack level is sufficient
          ) {
            if (!currEquipment.has(name) && !gang.purchaseEquipment(member.name, name)) {
              if (type === 'Augmentation') augCost += cost
              else equipCost += cost
            }
          }
        }
      }
      if (equipCost > 0) {
        // This member still needs to buy some equipment
        aMemberNeedsMoney = true
        aMemberNeedsEquipmentMoney = true
      }
      if (
        shouldAsc &&
        !hasEnoughMoneyToAscend(
          g,
          isCombat ? maxCombatEquipCost : maxHackEquipCost,
          equipCost,
          aMemberNeedsEquipmentMoney
        )
      ) {
        // This member can ascend but needs enough money to cover equipment costs
        aMemberNeedsMoney = true
      }
      preProcessMembers.set(member.name, { equipCost, augCost, shouldAsc, ascResults })
    }
    for (const _member of members) {
      let member = _member
      const isCombat = isCombatMember(g, member.name, combatMemberNames)
      const memberPreProcess = preProcessMembers.get(member.name)
      const equipCost = memberPreProcess?.equipCost ?? 0
      const augCost = memberPreProcess?.augCost ?? 0
      const ascResults = memberPreProcess?.ascResults
      const shouldAsc = memberPreProcess?.shouldAsc ?? false

      let forceMoney = false
      let moneyGain: number | null = null
      if (hasFormulaApi) {
        // If members still need equipment (no augments for now) and this member can make a lot of money
        // force them to money launder (if they can)
        moneyGain = g.ns.formulas.gang.moneyGain(
          gang.getGangInformation(),
          member,
          gang.getTaskStats(HackingGangJob.MoneyLaundering)
        )
        if (aMemberNeedsMoney && moneyGain > 150_000) {
          forceMoney = true
        }
      }

      table.cell('Name', member.name)
      if (moneyGain !== null) {
        table.cell('$/s', moneyGain * 5, Printer.currency(g))
      }
      table.cell('Equip Cost', equipCost, Printer.currency(g))
      table.cell('Aug Cost', augCost, Printer.currency(g))

      // Log ascension values
      logProp(hackTable, member, ascResults, 'hack')
      logProp(chaTable, member, ascResults, 'cha')
      if (isCombat) {
        logProp(agiTable, member, ascResults, 'agi')
        logProp(defTable, member, ascResults, 'def')
        logProp(dexTable, member, ascResults, 'dex')
        logProp(strTable, member, ascResults, 'str')
      }
      if (shouldAsc) {
        if (
          hasEnoughMoneyToAscend(
            g,
            isCombat ? maxCombatEquipCost : maxHackEquipCost,
            equipCost,
            aMemberNeedsEquipmentMoney
          )
        ) {
          if (!isCombat && member.hack > 5000 && member.earnedRespect > 0 && needMoreMembers) {
            table.cell('Asc', 'Respect: ' + g.n(member.earnedRespect))
          } else {
            if (noAscend) {
              table.cell('Asc', 'No Ascend')
            } else {
              table.cell('Asc', gang.ascendMember(member.name) ? '✓' : 'Failed to ascend')
              // since the member was ascended update the reference
              member = gang.getMemberInformation(member.name)
            }
          }
        } else {
          table.cell('Asc', 'Need $Money')
        }
      } else {
        table.cell('Asc', 'Need Skills')
      }

      /* Task management */
      const gangInfo = gang.getGangInformation()
      let task = HackingGangJob.Unassigned

      if (isCombat) {
        task = HackingGangJob.TerritoryWarfare
        if ([member.str, member.agi, member.def, member.dex].every((v) => v < 1000)) {
          task = HackingGangJob.TrainCombat
        }
      } else {
        // By default launder money
        task = HackingGangJob.MoneyLaundering

        if (!forceMoney) {
          if (needMoreMembers) {
            task = HackingGangJob.Cyberterrorism
          }

          const hackingLevel = getLevelToStopTraining(member, 'hack')
          if (member.hack < hackingLevel) {
            // Hacking level should reach hackingLevel before being member is useful
            task = HackingGangJob.TrainHacking
          }
        }

        // If our wanted penalty is too high, lower it
        if (
          gangInfo.respect > 1 && // avoid lowering when respect is zero and penalty is stuck at 0.5
          ((member.task === HackingGangJob.EthicalHacking && gangInfo.wantedPenalty < 0.99) ||
            gangInfo.wantedPenalty < 0.95)
        ) {
          // Begin hacking when penalty is under 0.95 and don't stop until penalty is under 0.99
          task = HackingGangJob.EthicalHacking
        }
      }
      gang.setMemberTask(member.name, task)
      table.cell('Task', member.task)
      table.cell('New Task', task)
      table.newRow()
      await g.ns.sleep(1) // give cpu rest between members
    }
    const lowestWinClash = getLowestWinClash(g)
    gang.setTerritoryWarfare(lowestWinClash > 0.5)
    g.ns.clearLog()
    g.printTable(strTable)
    g.printTable(dexTable)
    g.printTable(defTable)
    g.printTable(agiTable)
    g.printTable(chaTable)
    g.printTable(hackTable)
    g.printTable(table)
    g.printf(
      '[%s] Members: %s | $%s/s | Respect: %s;%s/s | Wanted: %s;%s/s;%s | Max Combat Equip: $%s | Max Hack Equip: $%s',
      preProcessGangInfo.faction,
      g.n(members.length),
      g.n(preProcessGangInfo.moneyGainRate * 5),
      g.n(preProcessGangInfo.respect),
      g.n(preProcessGangInfo.respectGainRate * 5),
      g.n(preProcessGangInfo.wantedLevel),
      g.n(preProcessGangInfo.wantedLevelGainRate * 5),
      g.n(preProcessGangInfo.wantedPenalty, '0.0%'),
      g.n(maxCombatEquipCost),
      g.n(maxHackEquipCost)
    )
    g.printf(
      '[%s] Power: %s | Territory: %s | Lowest clash win: %s | Clash: %s%s',
      preProcessGangInfo.faction,
      g.n(preProcessGangInfo.power),
      g.n(preProcessGangInfo.territory, '0.00%'),
      g.n(lowestWinClash, '0.00%'),
      g.n(preProcessGangInfo.territoryClashChance, '0%'),
      preProcessGangInfo.territoryWarfareEngaged ? ' | ENGAGED' : ''
    )
    await g.ns.sleep(500)
  }
}

function isCombatMember(g: Global, memberName: string, combatMembers: Set<string>) {
  if (!combatMembers.has(memberName)) return false
  if (g.ns.gang.getGangInformation().territory > 0.6) return false
  return true
}

function getLevelToStopTraining(member: GangMemberInfo, prop: GangTypeProps): number {
  if (member[`${prop}_asc_mult`] < 10) return 5000
  if (member[`${prop}_asc_mult`] < 20) return 6000
  if (member[`${prop}_asc_mult`] < 30) return 7000
  if (member[`${prop}_asc_mult`] < 40) return 10000
  if (member[`${prop}_asc_mult`] < 50) return 15000
  return 15000
}

enum GangName {
  SlumSnakes = 'Slum Snakes',
  Tetrads = 'Tetrads',
  TheSyndicate = 'The Syndicate',
  TheDarkArmy = 'The Dark Army',
  SpeakersForTheDead = 'Speakers for the Dead',
  NiteSec = 'NiteSec',
  TheBlackHand = 'The Black Hand',
}

const gangNames = Object.values(GangName)

function getLowestWinClash(g: Global): number {
  const currGangName = g.ns.gang.getGangInformation().faction
  let lowest = null
  for (const gangName of gangNames) {
    if (currGangName === gangName) continue
    const chanceToWin = g.ns.gang.getChanceToWinClash(gangName)
    if (!lowest || chanceToWin < lowest) {
      lowest = chanceToWin
    }
  }
  return lowest || 0
  // return gangNames.some(
  // (gangName) => g.ns.gang.getGangInformation().faction !== gangName && g.ns.gang.getChanceToWinClash(gangName) < 0.8
  // )
}

function hasEnoughMoneyToAscend(
  g: Global,
  maxEquipCost: number,
  memberEquipCost: number,
  aMemberNeedsEquipmentMoney: boolean
) {
  const purchasedMinimalEquipment =
    memberEquipCost === 0 ? false : (maxEquipCost - memberEquipCost) / maxEquipCost >= 0.8
  const hasEnoughMoneyToBuyEquipment = g.ns.getServerMoneyAvailable('home') >= maxEquipCost
  return (!aMemberNeedsEquipmentMoney && purchasedMinimalEquipment) || hasEnoughMoneyToBuyEquipment
}

function logProp(
  table: EasyTable,
  member: GangMemberInfo,
  ascension: GangMemberAscension | undefined,
  prop: GangTypeProps
) {
  const asc = ascension?.[prop] ?? 0
  const currMult = member[`${prop}_asc_mult`]
  table.cell('Name', member.name)
  table.cell(_.capitalize(prop), member[prop], Printer.nNumber(g))
  table.cell('Asc Mul', currMult, Printer.nNumber(g))
  table.cell('Asc Res', asc, Printer.nNumber(g))
  const ascResVal = currMult * asc
  const valToAsc = getValueToAscend(currMult)
  table.cell('Asc Res Val', ascResVal, Printer.nNumber(g))
  table.cell('Asc Val Need', valToAsc, Printer.nNumber(g))
  table.cell('Ready', ascResVal > valToAsc ? '✓' : 'X')
  table.newRow()
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
type GangCombatTypeProps = 'str' | 'def' | 'dex' | 'agi' | 'hack' | 'cha'
const combatProps: GangCombatTypeProps[] = ['str', 'def', 'dex', 'agi', 'hack', 'cha']

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
