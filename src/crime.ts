import { Global } from 'lib/global'
import * as React from 'react'
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
    if (crime === null) {
      throw `Can't find crime ${crimeText}`
    }
    const crimeR = getReactElement(crime)
    if (crimeR === null) {
      throw `Can't find react element for crime ${crimeText}`
    }
    clickReactElement(crimeR)
    let shouldBreak = false
    while (true) {
      const cancelButton = findCancelCrimeButton()
      if (cancelButton === null) break
      cancelButton.onclick = () => {
        shouldBreak = true
      }
      const timeRemaining = getCrimeTimeRemaining()
      if (!timeRemaining || timeRemaining < 2) {
        findBackdrop()?.click()
      }
      await ns.sleep(500)
    }
    if (shouldBreak) return
  }
}

function getCrimeTimeRemaining(): number | null {
  for (const elem of Array.from(doc.querySelectorAll('p'))) {
    if (elem.textContent?.includes('seconds remaining')) {
      const re = /(?:([0-9]+)\sminutes?\s)?([0-9]+)\sseconds remaining/
      const match = re.exec(elem.textContent)
      if (match && match.length === 3) {
        const m = _.toInteger(match[1] || '0')
        const s = _.toInteger(match[2])
        if (!_.isNaN(s)) {
          return m * 60 + s
        }
      }
    }
  }
  return null
}

function getReactElement(elem: HTMLElement): React.HTMLAttributes<HTMLElement> | null {
  const handler = Object.keys(elem)[1]
  if (!handler) return null
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const reactElem = elem[handler] as React.HTMLAttributes<HTMLElement>
  return reactElem ? reactElem : null
}

function clickReactElement(elem: React.HTMLAttributes<HTMLElement>) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  elem.onClick?.({ isTrusted: true })
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

function findBackdrop(): HTMLDivElement | null {
  return doc.querySelector('.MuiBackdrop-root')
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
