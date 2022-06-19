export class Global {
  public ns: NS
  public printOnTerminal: boolean
  public logEnabled: boolean

  constructor({ ns, printOnTerminal, logEnabled }: { ns: NS; printOnTerminal: boolean; logEnabled: boolean }) {
    this.ns = ns
    this.printOnTerminal = printOnTerminal
    this.logEnabled = logEnabled
    ns.disableLog('ALL')
    ns.clearLog()
  }

  logf(format: string, ...args: any[]) {
    if (this.logEnabled) {
      if (this.printOnTerminal) {
        this.ns.tprintf(format, ...args)
      } else {
        this.ns.printf(format, ...args)
      }
    }
  }

  slogf(server: Server, format: string, ...args: any[]) {
    if (this.logEnabled) {
      if (this.printOnTerminal) {
        this.ns.tprintf('[%s] ' + format, server.hostname, ...args)
      } else {
        this.ns.printf('[%s] ' + format, server.hostname, ...args)
      }
    }
  }

  log(...args: any[]) {
    if (this.logEnabled) {
      if (this.printOnTerminal) {
        this.ns.tprint(...args)
      } else {
        this.ns.print(...args)
      }
    }
  }
}
