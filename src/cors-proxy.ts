import Conn = Deno.Conn;
import HttpConn = Deno.HttpConn;
import Listener = Deno.Listener;
import RequestEvent = Deno.RequestEvent;
import { createDebugFunction } from './log/create-debug-function.ts';

const debug = createDebugFunction(20);

/*-------------------*/

function addCorsIfNeeded(
  headers: Headers,
): Headers {
  if (!headers.has('access-control-allow-origin')) {
    headers.set('access-control-allow-origin', '*');
  }

  if (!headers.has('access-control-allow-headers')) {
    headers.set('access-control-allow-headers', '*');
  }

  return headers;
}

/*----*/

async function handleRequestEvent(
  requestEvent: RequestEvent,
): Promise<void> {
  const request: Request = requestEvent.request;

  if (request.method.toUpperCase() === 'OPTIONS') {
    return requestEvent.respondWith(
      new Response(null, {
        headers: addCorsIfNeeded(new Headers()),
      }),
    );
  }

  const requestUrl: URL = new URL(requestEvent.request.url);

  if (!requestUrl.searchParams.has('url')) {
    return requestEvent.respondWith(
      new Response(`missing ?url= param`, {
        status: 501,
      }),
    );
  }

  const targetUrl: string = requestUrl.searchParams.get('url') as string;

  const response: Response = await fetch(targetUrl, request);

  const headers = addCorsIfNeeded(new Headers(response.headers));

  return requestEvent.respondWith(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

async function handleConnection(
  connection: Conn,
): Promise<void> {
  const httpConnection: HttpConn = Deno.serveHttp(connection);

  for await (const requestEvent of httpConnection) {
    handleRequestEvent(requestEvent)
      .catch((error: unknown) => {
        console.log(`Failed to handle requestEvent`);
        console.error(error);
      });
  }
}

export interface IStartCorsProxyServerOptions {
  port?: number;
}

export async function startCorsProxyServer(
  {
    port = 8082,
  }: IStartCorsProxyServerOptions = {},
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
