import { IStartWebsocketProxyServerOptions, startWebsocketProxyServer } from './websocket-proxy.ts';

function extractOptions(): IStartWebsocketProxyServerOptions {
  let port: number | undefined;

  for (let i = 0, l = Deno.args.length; i < l; i++) {
    const arg: string = Deno.args[i];
    let match: RegExpExecArray | null;

    if ((match = /^s*--ports*=s*(\d+)s*$/.exec(arg)) !== null) {
      port = Number(match[1]);
    } else {
      throw new Error(`Invalid arg: ${arg}`);
    }
  }

  return {
    port,
  };
}

startWebsocketProxyServer(
  extractOptions(),
);
