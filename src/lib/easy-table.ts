import { Global } from '/lib/global'

import EasyTable from 'easy-table'

export type Opts = {
  pre?: string
  post?: string
  pad?(val: string, width: number): string
  transform?: (val: string) => string
}
export abstract class Printer {
  public static currency(g: Global, opts?: Opts) {
    return (val: number, width: number) => {
      return applyOpts(g.n(val, '$0.00a'), width, opts?.pad || padLeft, opts)
    }
  }
  public static number(g: Global, opts?: Opts) {
    return (val: number, width: number) => {
      return applyOpts(g.n(val, '0,0'), width, opts?.pad || padLeft, opts)
    }
  }
  public static nNumber(g: Global, opts?: Opts) {
    return (val: number, width: number) => {
      return applyOpts(g.n(val, '0.00a'), width, opts?.pad || padLeft, opts)
    }
  }
  public static percent(g: Global, opts?: Opts) {
    return (val: number, width: number) => {
      return applyOpts(g.n(val * 100, '0,0') + '%', width, opts?.pad || padLeft, opts)
    }
  }
  public static string(g: Global, opts?: Opts) {
    return (val: string, width: number) => {
      return applyOpts(val, width, opts?.pad || padRight, opts)
    }
  }
}

function applyOpts(_val: string, _width: number, pad: (val: string, width: number) => string, opts?: Opts): string {
  const pre = opts?.pre === undefined ? ' ' : opts.pre
  const post = opts?.post === undefined ? ' ' : opts.post
  let val = _val
  if (opts?.transform) {
    val = opts.transform(val)
  }
  const width = _width - pre.length - post.length
  return `${pre}${pad(val, width)}${post}`
}

export function padRight(val: string, _width: number) {
  return val
}

export function padLeft(val: string, width: number) {
  return EasyTable.padLeft(val, width)
}

export function padCol(table: EasyTable, col: string, minWidth: number, separator: string) {
  table.cell(col, separator.repeat(Math.max(minWidth, col.length)))
}

export function removeSeparator(table: EasyTable) {
  table.separator = '​' // Note the use of invisible character!
}
