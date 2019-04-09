import { ActionReaderOptions } from 'demux'

export interface StateHistoryWsActionReaderOptions extends ActionReaderOptions {
  nodeosRPCEndpoint: string,
  nodeosWSEndpoint: string,
}
