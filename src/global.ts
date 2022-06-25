/* eslint-disable @typescript-eslint/no-explicit-any */
export class Global {
  public ns: NS
  public printOnTerminal: boolean
  private disableFunctions: Set<string> = new Set()

  constructor({ ns, printOnTerminal }: { ns: NS; printOnTerminal: boolean }) {
    this.ns = ns
    this.printOnTerminal = printOnTerminal
    ns.disableLog('ALL')
    ns.clearLog()
  }

  enableLog(f: string) {
    this.disableFunctions.delete(f)
  }

  disableLog(f: string) {
    this.disableFunctions.add(f)
  }

  printf(format: string, ...args: any[]) {
    if (this.printOnTerminal) {
      this.ns.tprintf(format, ...args)
    } else {
      this.ns.printf(format, ...args)
    }
  }

  printf_(caller: string, format: string, ...args: any[]) {
    if (!this.disableFunctions.has(caller)) {
      this.printf(format, ...args)
    }
  }

  print(...args: any[]) {
    if (this.printOnTerminal) {
      this.ns.tprintf('%s', args)
    } else {
      this.ns.print(...args)
    }
  }

  print_(caller: string, ...args: any[]) {
    if (!this.disableFunctions.has(caller)) {
      this.print(...args)
    }
  }
}
