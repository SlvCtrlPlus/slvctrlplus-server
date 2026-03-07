import { ButtplugNodeWebsocketClientConnector } from 'buttplug';

// This is needed to make try/catch around connect() work until upgraded to buttplug@4.0.0
export default class SlvCtrlPlusButtplugWebsocketClientConnector extends ButtplugNodeWebsocketClientConnector {
    private _url2;

    public constructor(_url: string) {
        super(_url);
        this._url2 = _url;
    }

    public connect = async () => {
        return new Promise<void>((resolve, reject) => {
            const ws = new (this._websocketConstructor ?? WebSocket)(this._url2);
            const onErrorCallback = (event: Event) => {reject(event)}
            const onCloseCallback = (event: CloseEvent) => reject(event.reason)
            ws.addEventListener('open', async () => {
                this._ws = ws;
                try {
                    await this.initialize();
                    this._ws.addEventListener('message', (msg) => {
                        this.parseIncomingMessage(msg);
                    });
                    this._ws.removeEventListener('close', onCloseCallback);
                    this._ws.removeEventListener('error', onErrorCallback);
                    this._ws.addEventListener('close', this.disconnect);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
            // In websockets, our error rarely tells us much, as for security reasons
            // browsers usually only throw Error Code 1006. It's up to those using this
            // library to state what the problem might be.

            ws.addEventListener('error', onErrorCallback)
            ws.addEventListener('close', onCloseCallback);
        });
    }
}
