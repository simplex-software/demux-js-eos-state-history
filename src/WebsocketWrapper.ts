import { WebSocket } from '../interfaces'
import WsWebSocket from 'ws'

export class WebsocketWrapper implements WebSocket {
  private websocket: WsWebSocket | null = null
  private binaryMessageCallbacks: Array<(message: ArrayBuffer) => void> = []
  private textMessageCallbacks: Array<(message: string) => void> = []

  public connect(url: string): void {
    if (this.websocket) {
      this.websocket.close()
    }
    this.websocket = new WsWebSocket(url)
    this.websocket.on('message', this.onMessage.bind(this))
  }

  public send(data: any): void {
    if (!this.websocket) {
      throw new Error('WebSocket not connected')
    }
    this.websocket.send(data)
  }

  public onBinaryMessage(callback: (message: ArrayBuffer) => void): void {
    this.binaryMessageCallbacks.push(callback)
  }
  public onTextMessage(callback: (message: string) => void): void {
    this.textMessageCallbacks.push(callback)
  }

  public disconnect(): void {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
  }

  private onMessage(message: ArrayBuffer | string) {
    if (typeof message === 'string') {
      this.textMessageCallbacks.forEach((callback) => {
        callback(message)
      })
    } else {
      this.binaryMessageCallbacks.forEach((callback) => {
        callback(message)
      })
    }
  }
}
