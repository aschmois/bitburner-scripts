import { Global } from 'lib/global'
const doc: Document = eval('document')

let g: Global
export async function main(ns: NS) {
  const a: { terminal: boolean } = ns.flags([['terminal', false]])
  g = new Global({ ns, printOnTerminal: a.terminal })
  const crimeText = ns.args[0] + ''
  if (!clickOnHtmlElement(findCityButton())) throw "Couldn't click on city button"
  if (!clickOnHtmlElement(findSlumsButton())) throw "Couldn't click on slums button"
  while (true) {
    const crime = findCrimeButton(crimeText)
    if (crime == null) {
      throw `Can't find crime ${crimeText}`
    }
    const handler = Object.keys(crime)[1]
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    crime[handler].onClick({ isTrusted: true })
    let cancelButton
    while ((cancelButton = findCancelCrimeButton()) !== null) {
      // let canBreak = false
      // cancelButton.onclick((ev: MouseEvent) => {
      //   canBreak = true
      // })
      // if (canBreak) break
      await ns.sleep(1000)
    }
  }
}

function clickOnHtmlElement(elem: HTMLElement | null) {
  if (elem) {
    elem.click()
    return true
  }
  return false
}

function findCityButton(): HTMLParagraphElement | null {
  for (const elem of Array.from(doc.querySelectorAll('p'))) {
    if (elem.textContent == 'City') {
      return elem
    }
  }
  return null
}

function findSlumsButton(): HTMLSpanElement | null {
  return doc.querySelector('[aria-label="The Slums"]')
}

function findCrimeButton(text: string): HTMLButtonElement | null {
  for (const elem of Array.from(doc.querySelectorAll('button'))) {
    if (elem.textContent?.toLowerCase().includes(text.toLowerCase())) {
      return elem
    }
  }
  return null
}

function findCancelCrimeButton(): HTMLButtonElement | null {
  for (const elem of Array.from(doc.querySelectorAll('button'))) {
    if (elem.textContent?.includes('Cancel crime')) {
      return elem
    }
  }
  return null
}
