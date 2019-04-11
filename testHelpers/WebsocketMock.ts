import { WebSocket } from '../interfaces'

export class WebsocketMock implements WebSocket {
  private binaryMessageCallbacks: Array<(message: ArrayBuffer) => void> = []
  private textMessageCallbacks: Array<(message: string) => void> = []
  public sentData: any[] = []
  public url: string | null = null

  public connect(url: string): void {
    this.url = url
  }

  public send(data: any): void {
    this.sentData.push(data)
  }

  public onBinaryMessage(callback: (message: ArrayBuffer) => void): void {
    this.binaryMessageCallbacks.push(callback)
  }
  public onTextMessage(callback: (message: string) => void): void {
    this.textMessageCallbacks.push(callback)
  }

  public disconnect(): void {
    this.url = null
  }

  public clearSentData() {
    this.sentData = []
  }

  public fakeMessage(message: ArrayBuffer | string) {
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
