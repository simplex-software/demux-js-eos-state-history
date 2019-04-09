import WebSocket from 'ws'
import { StateHistoryMessageEncoder, StateHistoryInfo, StateHistoryBlock } from './StateHistoryMessageEncoder'
import { NotInitializedError } from 'demux'

export class StateHistoryWebsocketConnection {
  private ws: WebSocket | null = null
  private messageEncoder: StateHistoryMessageEncoder | null = null
  private initialized: () => void = () => null
  private getInfoPromises: any[] = []
  private getBlockPromises: { [blockNum: number]: any[] } = {}

  constructor(private nodeosWSEndpoint: string, private nodeosRPCEndpoint: string) {
  }

  public initialize() {
    this.ws = new WebSocket(this.nodeosWSEndpoint)
    this.ws.on('message', this.incoming.bind(this))
    return new Promise<void>((resolve) => {
      this.initialized = resolve
    })
  }

  public getInfo(): Promise<StateHistoryInfo> {
    if (!this.ws || !this.messageEncoder) {
      throw new NotInitializedError('Trying to send a message before initilizing the Websocket')
    }
    this.ws.send(this.messageEncoder.getStatusRequest().asUint8Array())
    return new Promise<StateHistoryInfo>((resolve) => {
      this.getInfoPromises.push(resolve)
    })
  }

  public getBlock(blockNumber: number) {
    if (!this.ws || !this.messageEncoder) {
      throw new NotInitializedError('Trying to send a message before initilizing the Websocket')
    }
    this.ws.send(this.messageEncoder.getBlocksRequest(blockNumber, blockNumber + 1).asUint8Array())
    return new Promise<StateHistoryBlock>((resolve) => {
      if (this.getBlockPromises[blockNumber] instanceof Array) {
        this.getBlockPromises[blockNumber].push(resolve)
      } else {
        this.getBlockPromises[blockNumber] = [resolve]
      }
    })
  }

  public async incoming(data: string | ArrayBuffer) {
    if (typeof data === 'string') {
      this.setupAbi(data)
    } else {
      if (!this.messageEncoder) {
        throw new NotInitializedError('Trying to parse message before initilizing message decoder')
      }
      const message = await this.messageEncoder.parseResult(data)
      // console.log(JSON.stringify(message, null, 2))
      if (this.isStateHistoryInfo(message)) {
        while (this.getInfoPromises.length) {
          this.getInfoPromises.pop()(message)
        }
      } else {
        const blockNum = message.blockInfo.blockNumber
        if (this.getBlockPromises[blockNum]) {
          while (this.getBlockPromises[blockNum].length) {
            this.getBlockPromises[blockNum].pop()(message)
          }
          delete this.getBlockPromises[blockNum]
        }
      }
    }
  }

  private isStateHistoryInfo(message: any): message is StateHistoryInfo {
    return message && message.lastIrreversible && typeof(message.lastIrreversible) === 'number'
  }

  private setupAbi(abi: string) {
    if (this.messageEncoder === null) {
      this.messageEncoder = new StateHistoryMessageEncoder(abi, this.nodeosRPCEndpoint)
      this.initialized()
    }
  }
}
