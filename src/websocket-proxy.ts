import Conn = Deno.Conn;
import HttpConn = Deno.HttpConn;
import Listener = Deno.Listener;
import RequestEvent = Deno.RequestEvent;
import TlsConn = Deno.TlsConn;
import WebSocketUpgrade = Deno.WebSocketUpgrade;
import { createDebugFunction } from './log/create-debug-function.ts';
import { head } from './log/head.ts';
import { info } from './log/info.ts';
import { warn } from './log/warn.ts';

/*----*/

export interface IConnectTLSOptions {
  port: number;
  hostname: string;
  protocol?: string;
  caCerts?: string[];
}

function extractRequestConfig(
  request: Request,
): IConnectTLSOptions {
  const url: URL = new URL(request.url);
  if (url.searchParams.has('config')) {
    const {
      port,
      hostname,
      protocol,
      caCerts,
    }: IConnectTLSOptions = JSON.parse(url.searchParams.get('config') as string);

    if (typeof port !== 'number') {
      throw new Error(`Expected number as 'port'`);
    } else if (typeof hostname !== 'string') {
      throw new Error(`Expected string as 'hostname'`);
    } else if (
      (protocol !== void 0)
      && (typeof protocol !== 'string')
    ) {
      throw new Error(`Expected string or undefined as 'protocol'`);
    } else if (
      (caCerts !== void 0)
      && (
        !Array.isArray(caCerts)
        || caCerts.some((caCert: string): boolean => (typeof caCert !== 'string'))
      )
    ) {
      throw new Error(`Expected string[] or undefined as 'caCerts'`);
    } else {
      return {
        port,
        hostname,
        protocol,
        caCerts,
      };
    }
  } else {
    throw new Error(`Missing searchParams 'config'`);
  }
}

/*----*/

function errorToMessage(
  error: unknown,
): string {
  return (error instanceof Error)
    ? error.message
    : `Unknown error`;
}

const debug = createDebugFunction(20);

/*-------------------*/

async function handleConnection(
  connection: Conn,
): Promise<void> {
  debug(10, head('GOT REQUEST'));
  const httpConnection: HttpConn = Deno.serveHttp(connection);
  const event: RequestEvent | null = await httpConnection.nextRequest();

  if (event === null) {
    connection.close();
  } else {
    const request: Request = event.request;
    if (request.headers.get('upgrade') === 'websocket') {
      debug(10, info('IS WEBSOCKET'));
      try {

        /* NEW CONNECTION */
        const config: IConnectTLSOptions = extractRequestConfig(request);
        debug(20, `connecting to -> ${config.hostname}:${config.port}`);
        const newConnection: TlsConn = await Deno.connectTls(config);

        debug(10, info('CONNECTION ESTABLISHED'));

        // WRITE
        let writePromise: Promise<number> = Promise.resolve(0);

        const write = (
          buffer: Uint8Array,
        ): Promise<number> => {
          return writePromise = writePromise.then((): Promise<number> => {
            return newConnection.write(buffer);
          });
        };

        // READ
        const readBuffer = new Uint8Array(1e6);

        const readLoop = (): Promise<void> => {
          return newConnection.read(readBuffer)
            .then((size: number | null): Promise<void> | void => {
              if (size !== null) {
                const data: Uint8Array = readBuffer.slice(0, size);
                // console.log('IN', data);
                socket.send(data);
                // const text = new TextDecoder().decode(data);
                // console.log(data);
                // console.log(text);
                return readLoop();
              }
            });
        };

        readLoop()
          .catch((error: unknown) => {
            return socket.close(1001, errorToMessage(error));
          });

        /* CLOSE */

        const close = (): void => {
          debug(20, `closing -> ${config.hostname}:${config.port}`);
          newConnection.close();
        };

        /* WEBSOCKET */

        const { socket, response }: WebSocketUpgrade = Deno.upgradeWebSocket(request, {
          protocol: config.protocol,
        });

        socket.addEventListener('close', (): void => {
          debug(10, 'socket received close');
          close();
        });

        socket.addEventListener('error', (): void => {
          debug(10, 'socket received error');
          close();
        });

        socket.addEventListener('message', (event: MessageEvent<any>): void => {
          const data: ArrayBuffer | string = event.data;
          let _data: Uint8Array;

          if (data instanceof ArrayBuffer) {
            _data = new Uint8Array(data);
          } else if (typeof data === 'string') {
            _data = new TextEncoder().encode(data);
          } else {
            return socket.close(1003, `Expected string or ArrayBuffer`);
          }

          // console.log('OUT', _data);

          write(_data)
            .catch((error: unknown) => {
              return socket.close(1001, errorToMessage(error));
            });
        });

        return event.respondWith(response);
      } catch (error: unknown) {
        debug(20, warn('CONNECTION FAILED'));
        return event.respondWith(new Response(errorToMessage(error), { status: 400 }));
      }
    } else {
      return event.respondWith(new Response(null, { status: 501 }));
    }
  }
}

export interface IStartWebsocketProxyServerOptions {
  port?: number;
}

export async function startWebsocketProxyServer(
  {
    port = 8081,
  }: IStartWebsocketProxyServerOptions = {},
): Promise<void> {
  const listener: Listener = Deno.listen({ port });

  let connection: Conn;
  while (connection = await listener.accept()) {
    handleConnection(connection)
      .catch((error: unknown) => {
        console.log(`Failed to handle connection`);
        console.error(error);
      });
  }
}
