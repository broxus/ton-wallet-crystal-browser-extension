import init, {
    AdnlConnection, TcpReceiver,
    TonInterface, unpackAddress,
} from "../../nekoton/pkg";
import {
    RequestConnect,
    ResponseClosed,
    Response,
    ResponseObject,
    ResponseType, RequestSend, Config, unpackData
} from "./common";

const LITECLIENT_EXTENSION_ID = 'fakpmbkocblneahenciednepadenbdpb';

const CONFIG_URL: string = 'https://freeton.broxus.com/mainnet.config.json';

chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => {
    const url = new URL(tab.url ?? '');

    chrome.browserAction.setBadgeText({text: url.host});
});

(async () => {
    await init('index_bg.wasm');

    const config: Config = await fetch(CONFIG_URL).then(data => data.json()).then(Config.parse);
    console.log("Config loaded:", config);

    const socket = new Socket(LITECLIENT_EXTENSION_ID);
    const connection = await socket.connect(config);

    const core = new TonInterface(connection);
    console.log(await core.getLatestMasterchainBlock());
    let addr = unpackAddress("EQCGFc7mlPWLihHoLkst3Yo9vkv-dQLpVNl8CgAt6juQFHqZ", true);
    console.log(addr.to_string());
})();

class Socket {
    private readonly port: chrome.runtime.Port;
    private receiver: TcpReceiver | null = null;

    private onConnected: (() => void) | null = null;
    private onClosed: (() => void) | null = null;
    private onReceived: ((data: ArrayBuffer) => void) | null = null;

    constructor(id: string) {
        this.port = chrome.runtime.connect(id);

        const dispatch: { [K in ResponseType]: (message: ResponseObject<K>) => void; } = {
            'connected': (_message) => {
                this.onConnected?.();
            },
            'received': (message) => {
                this.onReceived?.(unpackData(message.data));
            },
            'closed': (_message) => {
                this.onClosed?.();
            }
        };

        this.port.onMessage.addListener((message: Response,) => {
            const handler = dispatch[message.type];
            if (handler != null) {
                handler(message as any);
            }
        });
    }

    public async connect(config: Config): Promise<AdnlConnection> {
        const connect = new Promise<void>((resolve,) => {
            this.onConnected = () => resolve();
        });
        this.port.postMessage(new RequestConnect(config));
        await connect;
        this.onConnected = null;

        const connection = new AdnlConnection(new TcpSender((data) => {
            this.port.postMessage(new RequestSend(data));
        }));

        let initData!: ArrayBuffer;
        let resolveInitialization!: (data: ArrayBuffer) => void;
        const initialized = new Promise<void>((resolve,) => {
            resolveInitialization = (data) => {
                initData = data;
                resolve();
            }
        });

        this.onReceived = resolveInitialization;
        this.receiver = connection.init(config.key);
        await initialized;

        this.receiver.onReceive(new Uint8Array(initData));

        this.onReceived = this.onReceive;

        return connection;
    }

    public async close() {
        const close = new Promise<void>((resolve,) => {
            this.onClosed = () => resolve();
        });
        this.port.postMessage(new ResponseClosed());
        await close;
        this.onClosed = null;
    }

    private onReceive = (data: ArrayBuffer) => {
        if (this.receiver != null) {
            this.receiver.onReceive(new Uint8Array(data));
        }
    }
}

class TcpSender {
    constructor(private f: (data: Uint8Array) => void) {
    }

    send(data: Uint8Array) {
        this.f(data);
    }
}
