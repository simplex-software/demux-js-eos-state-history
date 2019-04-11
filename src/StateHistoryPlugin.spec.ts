
import { StateHistoryPlugin } from './StateHistoryPlugin'
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { WebsocketMock } from '../testHelpers/WebsocketMock'
import { MessageEncoder } from './MessageEncoder'
import fs from 'fs'
import { NotInitializedError } from 'demux'

use(chaiAsPromised)

const abi = fs.readFileSync('testHelpers/abi.json').toString()
const messageEncoder = new MessageEncoder('')
messageEncoder.setupAbi(abi)
const ws = new WebsocketMock()
const stateHistoryPlugin = new StateHistoryPlugin(ws, '', messageEncoder)

describe('#getInfo', () => {

  it('should throw an exception if the instance was not initilized yet', async () => {
    const newStateHistoryPlugin = new StateHistoryPlugin(new WebsocketMock(), '', new MessageEncoder(''))
    expect(newStateHistoryPlugin.getInfo()).to.eventually.be.rejectedWith(NotInitializedError)
  })

  it('should send a get status request and return the decoded response from EOS', async () => {
    ws.clearSentData()
    const promise = stateHistoryPlugin.getInfo()
    const sentMessage = ws.sentData.pop()

    expect(sentMessage).to.eql(messageEncoder.getStatusRequest())

    const buffer = Buffer.alloc(89)
    buffer.writeUInt8(0, 0)
    buffer.writeUInt32LE(10, 1) // Head block num
    buffer.writeUInt32LE(5, 37) // Head last irreversible block num
    ws.fakeMessage(buffer)
    const response = await promise
    expect(response.head).to.equal(10)
    expect(response.lastIrreversible).to.equal(5)
  })

})
