import { Global } from '/lib/global'

import EasyTable from 'easy-table'

export type Opts = { pre?: string; post?: string; transform?: (str: string) => string }
export abstract class Printer {
  public static currency(g: Global, opts?: Opts) {
    return (val: number, width: number) => {
      const str = applyOpts(g.n(val, '$0.00a'), opts)
      return width ? EasyTable.padLeft(str, width) : str
    }
  }
  public static number(g: Global, opts?: Opts) {
    return (val: number, width: number) => {
      const str = applyOpts(g.n(val, '0,0'), opts)
      return width ? EasyTable.padLeft(str, width) : str
    }
  }
  public static nNumber(g: Global, opts?: Opts) {
    return (val: number, width: number) => {
      const str = applyOpts(g.n(val, '0.00a'), opts)
      return width ? EasyTable.padLeft(str, width) : str
    }
  }
  public static percent(g: Global, opts?: Opts) {
    return (val: number, width: number) => {
      const str = applyOpts(g.n(val * 100, '0,0') + '%', opts)
      return width ? EasyTable.padLeft(str, width) : str
    }
  }
}

function applyOpts(_str: string, opts?: Opts) {
  const pre = opts?.pre || ''
  const post = opts?.post || ''
  let str = _str
  if (opts?.transform) {
    str = opts.transform(str)
  }
  return pre + str + post
}
