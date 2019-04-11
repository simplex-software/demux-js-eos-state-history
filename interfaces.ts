import { ActionReaderOptions, Action, Block } from 'demux'

export interface StateHistoryWsActionReaderOptions extends ActionReaderOptions {
  nodeosRPCEndpoint: string,
  nodeosWSEndpoint: string,
}

export interface StateHistoryInfo {
  head: number
  lastIrreversible: number
}

export interface StateHistoryActionPayload {
  actionIndex: number
  transactionId: string
  account: string
  name: string
  authorization: any[]
  data: string
  producer: string
}

export interface StateHistoryAction extends Action {
  payload: StateHistoryActionPayload
}

export interface StateHistoryBlock extends Block {
  actions: StateHistoryAction[]
}

export interface WebSocket {
  connect(url: string): void
  onBinaryMessage(callback: (message: ArrayBuffer) => void): void
  onTextMessage(callback: (message: string) => void): void
  disconnect(): void
  send(data: any): void
}
