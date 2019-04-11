import { AbstractActionReader, NotInitializedError } from 'demux'
import { StateHistoryWsActionReaderOptions, StateHistoryBlock } from '../interfaces'
import { StateHistoryPlugin } from './StateHistoryPlugin'
import { WebsocketWrapper } from './WebsocketWrapper'
import { MessageEncoder } from './MessageEncoder'

export class StateHistoryWsActionReader extends AbstractActionReader {
  private websocketConnection: StateHistoryPlugin

  constructor(options: StateHistoryWsActionReaderOptions) {
    super(options)
    const messageEncoder = new MessageEncoder(options.nodeosRPCEndpoint)
    this.websocketConnection = new StateHistoryPlugin(new WebsocketWrapper(), options.nodeosWSEndpoint, messageEncoder)
  }

  public async getHeadBlockNumber(): Promise<number> {
    const info = await this.websocketConnection.getInfo()
    return Number(info.head)
  }

  public async getLastIrreversibleBlockNumber(): Promise<number> {
    const info = await this.websocketConnection.getInfo()
    return Number(info.lastIrreversible)
  }

  public async getBlock(blockNumber: number): Promise<StateHistoryBlock> {
    const block = await this.websocketConnection.getBlock(blockNumber)
    return block
  }

  protected async setup(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      await this.websocketConnection.initialize()
      this.initialized = true
    } catch (err) {
      throw new NotInitializedError('', err)
    }
  }
}
