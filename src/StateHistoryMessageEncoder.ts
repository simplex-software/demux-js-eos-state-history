import zlib from 'zlib'
import { Serialize, JsonRpc, Api } from 'eosjs'
import { TextEncoder, TextDecoder } from 'util'
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig'
import { Action, Block } from 'demux'
import fetch from 'node-fetch'

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

// Wrapper to deal with differences between the definitions of fetch for the browser built-in
// and the node-fetch polyfill for node
const fetchWrapper = (input?: string | Request, init?: RequestInit): Promise<Response> => {
  const anyInput = input as any
  const anyInit = init as any
  return fetch(anyInput, anyInit) as any
}

export class StateHistoryMessageEncoder {
  private types: Map<string, Serialize.Type>
  private textEncoder: any = new TextEncoder()
  private textDecoder: any = new TextDecoder()
  private api: Api

  constructor(abi: string, nodeosEndpoint: string) {
    this.types = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), JSON.parse(abi))
    const signatureProvider = new JsSignatureProvider([])

    const rpc = new JsonRpc(nodeosEndpoint, { fetch: fetchWrapper } )
    this.api = new Api({
      rpc,
      signatureProvider,
      textDecoder: this.textDecoder,
      textEncoder: this.textEncoder
    })
  }

  public getStatusRequest() {
    const buffer = this.newBuffer()
    Serialize.getType(this.types, 'request').serialize(buffer, ['get_status_request_v0', {}])
    return buffer
  }

  public getBlocksRequest(startBlockNum: number, endBlockNum: number) {
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
    return buffer
  }

  public async parseResult(rawResult: ArrayBuffer): Promise<StateHistoryInfo | StateHistoryBlock> {
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
      const actionPromises: Array<Promise<StateHistoryAction>> = []
      result.traces.forEach((transactionTrace: any) => {
        let index = 0
        actionPromises.push(... transactionTrace.action_traces.map(async ([, actionTrace]: [any, any]) => {
          const [deserializedAction] = await this.api.deserializeActions([actionTrace.act])
          return {
            type: `${actionTrace.act.account}::${actionTrace.act.name}`,
            payload: {
              actionIndex: index ++,
              transactionId: transactionTrace.id,
              producer: result.block.producer,
              ... deserializedAction
            }
          }
        }))
      })
      actions = await Promise.all(actionPromises)
    }

    return {
      blockInfo: {
        blockNumber: result.this_block.block_num,
        blockHash: result.this_block.block_id,
        previousBlockHash: result.block.previous,
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
    rawTraces = await this.inflate(rawTraces)
    const buffer = this.newBuffer()
    buffer.pushArray(new Uint8Array(rawTraces))
    const tracesCount = buffer.getVaruint32()
    for (let i = 0; i < tracesCount; i++) {
      const trace = Serialize.getType(this.types, 'transaction_trace').deserialize(buffer)[1]
      traces.push(trace)
    }
    return traces
  }

  private inflate(hexData: string) {
    return new Promise((resolve, reject) => {
      zlib.inflate(Buffer.from(hexData, 'hex'), (err, result) => {
        if (!err) {
          resolve(result)
        } else {
          reject(err)
        }
      })
    })
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
