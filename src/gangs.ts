import { GangMemberAscension, GangMemberInfo } from '@ns'

import { Global } from './lib/global.js'

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean; trainHacking: boolean; trainCharisma: boolean; money: boolean; noAscend: boolean } =
    ns.flags([
      ['terminal', false],
      ['trainHacking', false],
      ['trainCharisma', false],
      ['money', false],
      ['noAscend', false],
    ])
  g = new Global({ ns, printOnTerminal: a.terminal })

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

    const memberNames = gang.getMemberNames()
    const allEquipmentNames = gang.getEquipmentNames()
    const equipment: { name: string; cost: number }[] = []

    for (const equipmentName of allEquipmentNames) {
      const piece = gang.getEquipmentStats(equipmentName)
      if (piece.cha || piece.hack) {
        equipment.push({ name: equipmentName, cost: gang.getEquipmentCost(equipmentName) })
      }
    }
    equipment.sort((a, b) => a.cost - b.cost)

    const table: string[][] = [
      ['Name', 'Hack', 'hack_asc_mul', 'hack_exp', 'Cha', 'cha_asc_mul', 'cha_exp', 'Asc', 'Task', 'Equipped'],
    ]

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
      // cha
      log.push(g.n(member.cha))
      log.push(
        `${g.n(member.cha_asc_mult)} * ${g.n(ascension?.cha ?? 0)} > ${g.n(getValueToAscend(member.cha_asc_mult))}`
      )
      log.push(g.n(member.cha_exp))

      if (check) {
        if (a.noAscend) {
          log.push('✓')
        } else {
          log.push(gang.ascendMember(memberName) ? '✓' : 'X')
          member = gang.getMemberInformation(memberName)
        }
      } else {
        log.push('X')
      }

      /* Task management */
      let task = 'Money Laundering'
      if (!a.money && (a.trainHacking || member.hack < 100000)) {
        task = 'Train Hacking'
      } else if (!a.money && (a.trainCharisma || member.cha < 100000)) {
        task = 'Train Charisma'
      }
      gang.setMemberTask(memberName, task)
      if (member.task !== task) log.push(`${member.task} -> ${task}`)
      else log.push(task)

      /* Equipment */
      const currEquipment = getEquipmentFromMember(member)
      let needsEquip = false
      for (const { name, cost } of equipment) {
        if (!gang.purchaseEquipment(memberName, name) && !currEquipment.has(name)) {
          needsEquip = true
          // break
        }
      }
      log.push(needsEquip ? 'X' : '✓')
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
          'r', // Cha
          'r', // cha_asc_mul
          'r', // cha_exp
          'c', // Asc
          'l', // Task
          'c', // Equipped
        ],
      },
    })
    await g.ns.sleep(1000)
  }
}

function getEquipmentFromMember(member: GangMemberInfo) {
  return new Set([...member.upgrades, ...member.augmentations])
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
