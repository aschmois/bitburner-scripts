import { Global } from 'lib/global'

const doc: Document = eval('document')

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean } = ns.flags([['terminal', false]])
  g = new Global({ ns, printOnTerminal: a.terminal })
  const crimeText = ns.args[0]
  if (!_.isString(crimeText)) {
    throw 'First argument should be a string.'
  }
  const count = ns.args[1] > 0 ? ns.args[1] : Infinity
  getCity()?.click()
  getSlums()?.click()
  for (let i = 0; i < count; ++i) {
    const crime = getCrime(crimeText)
    if (crime == null) {
      ns.toast('Abort: cannot find element containing textContent: "' + crimeText + '".', 'error')
      return
    }
    const handler = Object.keys(crime)[1]
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    crime[handler].onClick({ isTrusted: true })
    let cancel
    while ((cancel = getCancelCrime()) !== null) {
      // let canBreak = false
      // cancel.onclick((ev: MouseEvent) => {
      //   canBreak = true
      // })
      // if (canBreak) break
      await ns.sleep(1000)
    }
  }
  ns.toast('Crime spree concluded.', 'info')
}

function getCity(): HTMLParagraphElement | null {
  for (const elem of Array.from(doc.querySelectorAll('p'))) {
    if (elem.textContent == 'City') {
      return elem
    }
  }
  return null
}

function getSlums(): HTMLSpanElement | null {
  return doc.querySelector('[aria-label="The Slums"]')
}

function getCrime(text: string): HTMLButtonElement | null {
  for (const elem of Array.from(doc.querySelectorAll('button'))) {
    if (elem.textContent?.toLowerCase().includes(text.toLowerCase())) {
      return elem
    }
  }
  return null
}

function getCancelCrime(): HTMLButtonElement | null {
  for (const elem of Array.from(doc.querySelectorAll('button'))) {
    if (elem.textContent?.includes('Cancel crime')) {
      return elem
    }
  }
  return null
}
