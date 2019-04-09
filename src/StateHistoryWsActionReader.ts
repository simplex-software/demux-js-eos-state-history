import { AbstractActionReader, NotInitializedError } from 'demux'
import { StateHistoryWsActionReaderOptions } from '../interfaces'
import { StateHistoryWebsocketConnection } from './StateHistoryWebsocketConnection'
import { StateHistoryBlock } from './StateHistoryMessageEncoder'

export class StateHistoryWsActionReader extends AbstractActionReader {
  private websocketConnection: StateHistoryWebsocketConnection

  constructor(options: StateHistoryWsActionReaderOptions) {
    super(options)
    this.websocketConnection = new StateHistoryWebsocketConnection(options.nodeosWSEndpoint, options.nodeosRPCEndpoint)
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
