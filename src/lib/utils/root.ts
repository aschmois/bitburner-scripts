import { Global } from 'lib/global.js'

import { Hostname } from 'lib/utils.js'

export function openPort(
  g: Global,
  server: Server,
  runOpenPortProgram: (hostname: Hostname) => void,
  isPortOpen: (server: Server) => boolean,
  name: string
): Server {
  if (server.numOpenPortsRequired > server.openPortCount && !isPortOpen(server)) {
    try {
      runOpenPortProgram(server.hostname)
      g.printf_('openPort', '[%s] Opened port using %s.exe', server.hostname, name)
      return g.ns.getServer(server.hostname)
    } catch (e) {
      g.printf_('openPort', "[%s] Don't have %s.exe installed", server.hostname, name)
    }
  }
  return server
}

export function nukeServer(g: Global, _server: Server): Server {
  let server = _server
  const ports = [
    { runOpenPortProgram: g.ns.brutessh, isPortOpen: (s: Server) => s.sshPortOpen, name: 'BruteSSH' },
    { runOpenPortProgram: g.ns.ftpcrack, isPortOpen: (s: Server) => s.ftpPortOpen, name: 'FTPCrack' },
    { runOpenPortProgram: g.ns.relaysmtp, isPortOpen: (s: Server) => s.smtpPortOpen, name: 'RelaySMTP' },
    { runOpenPortProgram: g.ns.sqlinject, isPortOpen: (s: Server) => s.sqlPortOpen, name: 'SQLInject' },
    { runOpenPortProgram: g.ns.httpworm, isPortOpen: (s: Server) => s.httpPortOpen, name: 'HTTPWorm' },
  ]
  for (const port of ports) {
    if (server.openPortCount >= server.numOpenPortsRequired) {
      break
    }
    server = openPort(g, server, port.runOpenPortProgram, port.isPortOpen, port.name)
  }
  if (!server.hasAdminRights && server.openPortCount >= server.numOpenPortsRequired) {
    g.ns.nuke(server.hostname)
    server = g.ns.getServer(server.hostname)
    if (server.hasAdminRights) g.printf_('nukeServer', '[%s] Nuked successfully', server.hostname)
  }
  return server
}
