/** @type Global */
export class Global {
  /**
   * @param {Object} args
   * @param {NS} args.ns
   * @param {Boolean} args.printOnTerminal
   * @param {Boolean} args.logEnabled
   */
  constructor({ ns, printOnTerminal, logEnabled }) {
    /**
     * @public
     * @type {NS}
     */
    this.ns = ns
    /**
     * @public
     * @type {Boolean}
     */
    this.printOnTerminal = printOnTerminal
    /**
     * @public
     * @type {Boolean}
     */
    this.logEnabled = logEnabled
  }

  /**
   * @param {String} format
   * @param {...*} args
   * @see NS.printf
   */
  logf(format, ...args) {
    if (this.logEnabled) {
      if (this.printOnTerminal) {
        this.ns.tprintf(format, ...args)
      } else {
        this.ns.printf(format, ...args)
      }
    }
  }

  /**
   * @param {...*} args
   * @see NS.printf
   */
  log(...args) {
    if (this.logEnabled) {
      if (this.printOnTerminal) {
        this.ns.tprint(...args)
      } else {
        this.ns.print(...args)
      }
    }
  }
}
