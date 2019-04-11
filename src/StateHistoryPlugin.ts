import { WebSocket } from '../interfaces'
import { MessageEncoder } from './MessageEncoder'
import { NotInitializedError } from 'demux'
import { StateHistoryInfo, StateHistoryBlock } from '../interfaces'

export class StateHistoryPlugin {
  private initializedCallback: () => void = () => null
  private getInfoPromises: any[] = []
  private getBlockPromises: { [blockNum: number]: any[] } = {}

  constructor(private ws: WebSocket, private nodeosWSEndpoint: string, private messageEncoder: MessageEncoder) {
    ws.onBinaryMessage(this.processResult.bind(this))
    ws.onTextMessage(this.setupAbi.bind(this))
  }

  public initialize() {
    this.ws.connect(this.nodeosWSEndpoint)
    return new Promise<void>((resolve) => {
      this.initializedCallback = resolve
    })
  }

  public getInfo(): Promise<StateHistoryInfo> {
    if (!this.messageEncoder.isInitialized()) {
      return Promise.reject(new NotInitializedError('Trying to send a message before initilizing'))
    }
    this.ws.send(this.messageEncoder.getStatusRequest())
    return new Promise<StateHistoryInfo>((resolve) => {
      this.getInfoPromises.push(resolve)
    })
  }

  public getBlock(blockNumber: number) {
    if (!this.messageEncoder.isInitialized()) {
      return Promise.reject(new NotInitializedError('Trying to send a message before initilizing'))
    }
    this.ws.send(this.messageEncoder.getBlocksRequest(blockNumber, blockNumber + 1))
    return new Promise<StateHistoryBlock>((resolve) => {
      if (this.getBlockPromises[blockNumber] instanceof Array) {
        this.getBlockPromises[blockNumber].push(resolve)
      } else {
        this.getBlockPromises[blockNumber] = [resolve]
      }
    })
  }

  public async processResult(data: ArrayBuffer) {
    if (!this.messageEncoder.isInitialized()) {
      throw new NotInitializedError('Trying to parse message before initilizing message decoder')
    }
    const message = await this.messageEncoder.parseResult(data)
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

  private isStateHistoryInfo(message: any): message is StateHistoryInfo {
    return message && message.lastIrreversible !== undefined && typeof(message.lastIrreversible) === 'number'
  }

  private setupAbi(abi: string) {
    if (!this.messageEncoder.isInitialized()) {
      this.messageEncoder.setupAbi(abi)
      this.initializedCallback()
    }
  }
}
