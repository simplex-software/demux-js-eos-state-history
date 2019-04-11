
import { MessageEncoder } from './MessageEncoder'
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'

import 'mocha'
import fs from 'fs'
import { StateHistoryInfo } from '../interfaces'

use(chaiAsPromised)
const abi = fs.readFileSync('testHelpers/abi.json').toString()
const messageEncoder = new MessageEncoder('')
messageEncoder.setupAbi(abi)

describe('#setupAbi', () => {

  it('should move the encoder to initialized state', () => {
    const newEncoder = new MessageEncoder('')
    expect(newEncoder.isInitialized()).to.equal(false)

    newEncoder.setupAbi(abi)
    expect(newEncoder.isInitialized()).to.equal(true)
  })

})

describe('#getStatusRequest', () => {

  it('should throw and exception if the encoder was not initialized yet', () => {
    const newEncoder = new MessageEncoder('')
    expect(() => {newEncoder.getStatusRequest()}).to.throw()
  })

  it('should return a buffer containing a get_status_request encoded message', () => {
    const result = messageEncoder.getStatusRequest()

    expect(result).to.eql(new Uint8Array(Buffer.from('00', 'hex')))
  })

})

describe('#getBlocksRequest', () => {
  it('should throw and exception if the encoder was not initialized yet', () => {
    const newEncoder = new MessageEncoder('')
    expect(() => {newEncoder.getBlocksRequest(1, 2)}).to.throw()
  })

  it('should return a buffer containing a get_blocks_request encoded message', () => {
    const result = messageEncoder.getBlocksRequest(157, 188)
    const resultBuffer = Buffer.from(result.buffer)
    expect(resultBuffer.readUInt8(0)).to.eql(1) // Type should be 1 (get_blocks_request_v0)
    expect(resultBuffer.readUInt32LE(1)).to.eql(157) // start_block_num
    expect(resultBuffer.readUInt32LE(5)).to.eql(188) // end_block_num
  })

})

describe('#parseResult', () => {
  it('should throw and exception if the encoder was not initialized yet', async () => {
    const newEncoder = new MessageEncoder('')
    expect(newEncoder.parseResult(Buffer.alloc(89))).to.be.rejectedWith('MessageEncoder was not initialized')
  })

  it('should be able to parse a get status result message', async () => {
    const buffer = Buffer.alloc(89)
    buffer.writeUInt8(0, 0) // type = get_status_result_v0
    buffer.writeUInt32LE(10, 1) // Head block num 10
    buffer.writeUInt32LE(5, 37) // Head last irreversible block num 5
    const result: unknown = await messageEncoder.parseResult(buffer)

    expect((result as StateHistoryInfo).lastIrreversible).to.equal(5)
    expect((result as StateHistoryInfo).head).to.equal(10)
  })

})
