import _ from 'lodash'
import * as bitburner from './NetscriptDefinitions'
import React from 'react'
import ReactDOM from 'react-dom'

export {}

declare global {
  const _: typeof _
  const React: typeof React
  const ReactDOM: typeof ReactDOM

  interface NS extends bitburner.NS {
    heart: {
      /** hidden function
       * @returns player karma */
      break(): number
    }
    openDevMenu(): void
    exploit(): void
    bypass(doc: Document): void
    alterReality(): void
    rainbow(guess: string): void
  }

  type AutocompleteConfig = [string, string | number | boolean | string[]][]

  interface AutocompleteData {
    servers: string[]
    txts: string[]
    scripts: string[]
    flags: (config: AutocompleteConfig) => any
  }
}
