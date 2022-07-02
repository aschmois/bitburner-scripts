import { Server } from '@ns'

export function isHome(server: Server) {
  return server.hostname === 'home'
}

export type Hostname = string
