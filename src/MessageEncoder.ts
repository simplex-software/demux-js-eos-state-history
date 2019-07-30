import { Serialize, JsonRpc, Api } from 'eosjs'
import { TextEncoder, TextDecoder } from 'util'
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig'
import fetch from 'node-fetch'
import { StateHistoryInfo, StateHistoryBlock, StateHistoryAction } from '../interfaces'

// Wrapper to deal with differences between the definitions of fetch for the browser built-in
// and the node-fetch polyfill for node
const fetchWrapper = (input?: string | Request, init?: RequestInit): Promise<Response> => {
  const anyInput = input as any
  const anyInit = init as any
  return fetch(anyInput, anyInit) as any
}

export class MessageEncoder {
  private types: Map<string, Serialize.Type> = new Map()
  private textEncoder: any = new TextEncoder()
  private textDecoder: any = new TextDecoder()
  private api: Api
  private initialized: boolean = false

  constructor(nodeosEndpoint: string) {
    const signatureProvider = new JsSignatureProvider([])

    const rpc = new JsonRpc(nodeosEndpoint, { fetch: fetchWrapper } )
    this.api = new Api({
      rpc,
      signatureProvider,
      textDecoder: this.textDecoder,
      textEncoder: this.textEncoder
    })
  }

  public isInitialized() {
    return this.initialized
  }

  public setupAbi(abi: string) {
    this.types = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), JSON.parse(abi))
    this.initialized = true
  }

  public getStatusRequest(): Uint8Array {
    if (!this.initialized) {
      throw new Error('MessageEncoder was not initialized')
    }
    const buffer = this.newBuffer()
    Serialize.getType(this.types, 'request').serialize(buffer, ['get_status_request_v0', {}])
    return buffer.asUint8Array()
  }

  public getBlocksRequest(startBlockNum: number, endBlockNum: number): Uint8Array {
    if (!this.initialized) {
      throw new Error('MessageEncoder was not initialized')
    }
    const buffer = this.newBuffer()
    Serialize.getType(this.types, 'request').serialize(buffer, ['get_blocks_request_v0', {
      start_block_num: startBlockNum,
      end_block_num: endBlockNum,
      fetch_block: true,
      fetch_traces: true,
      fetch_deltas: false,
      max_messages_in_flight: endBlockNum - startBlockNum,
      have_positions: [],
      irreversible_only: false}])
    return buffer.asUint8Array()
  }

  public async parseResult(rawResult: ArrayBuffer): Promise<StateHistoryInfo | StateHistoryBlock> {
    if (!this.initialized) {
      throw new Error('MessageEncoder was not initialized')
    }
    const buffer = this.newBuffer()
    buffer.pushArray(new Uint8Array(rawResult))
    const parsedResult = Serialize.getType(this.types, 'result').deserialize(buffer)

    switch (parsedResult[0]) {
    case 'get_status_result_v0':
      return {
        head: parsedResult[1].head.block_num,
        lastIrreversible: parsedResult[1].last_irreversible.block_num
      }
    case 'get_blocks_result_v0':
      return await this.parseGetBlockResult(parsedResult[1])
    default:
      throw new Error('Unknown result type')
    }
  }

  private async parseGetBlockResult(result: any): Promise<StateHistoryBlock> {
    let actions: StateHistoryAction[] = []

    if (result.block) {
      result.block = await this.inflateBlock(result.block)
    }

    if (result.traces) {
      result.traces = await this.inflateTraces(result.traces)
      const actionPromises: Array<Promise<StateHistoryAction[]>> = []
      result.traces.forEach((transactionTrace: any) => {
        let index = 0
        actionPromises.push(... transactionTrace.action_traces.map(async ([, actionTrace]: [any, any]) => {
          let deserializedActions: any[]
          const txActions = [actionTrace.act]
          try {
            deserializedActions = await this.api.deserializeActions(txActions)
          } catch (e) {
            // If transaction data cannot be deserialized we send the raw data instead
            deserializedActions = txActions
          }
          return deserializedActions.map((deserializedAction: any) => {
            return {
              type: `${actionTrace.act.account}::${actionTrace.act.name}`,
              payload: {
                actionIndex: index ++,
                transactionId: transactionTrace.id,
                producer: result.block.producer,
                ... deserializedAction
              }
            }
          })
        }))
      })
      const actionArrays: StateHistoryAction[][] = await Promise.all(actionPromises)
      actions = actionArrays.reduce((
        previous: StateHistoryAction[],
        current: StateHistoryAction[]):
        StateHistoryAction[] => {
        return previous.concat(current)
      }, [])
    }

    return {
      blockInfo: {
        blockNumber: result.this_block.block_num,
        blockHash: result.this_block.block_id.toLowerCase(),
        previousBlockHash: result.block.previous.toLowerCase(),
        timestamp: result.block.timestamp
      },
      actions
    }
  }

  private async inflateBlock(rawBlock: any) {
    const buffer = this.newBufferFromHex(rawBlock)
    const block = Serialize.getType(this.types, 'signed_block').deserialize(buffer)
    return block
  }

  private async inflateTraces(rawTraces: any) {
    const traces = []
    rawTraces = Buffer.from(rawTraces, 'hex')
    const buffer = this.newBuffer()
    buffer.pushArray(new Uint8Array(rawTraces))
    const tracesCount = buffer.getVaruint32()
    for (let i = 0; i < tracesCount; i++) {
      const trace = Serialize.getType(this.types, 'transaction_trace').deserialize(buffer)[1]
      traces.push(trace)
    }
    return traces
  }

  private newBuffer() {
    return new Serialize.SerialBuffer({ textEncoder: this.textEncoder, textDecoder: this.textDecoder })
  }

  private newBufferFromHex(hexData: string) {
    const buffer = this.newBuffer()
    buffer.pushArray(new Uint8Array(Buffer.from(hexData, 'hex')))
    return buffer
  }
}
