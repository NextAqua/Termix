import { Client } from 'ssh2';
import net from 'net';

// Create a custom transport factory
function createHTTPConnectTransport(options: any) {
  const {
    proxyHost,
    proxyPort,
    targetHost,
    targetPort,
    proxyAuth
  } = options;

  return function transport() {
    console.log(`Connecting to proxy ${proxyHost}:${proxyPort}...`);

    const socket = net.createConnection({
      host: proxyHost,
      port: proxyPort
    });

    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
      console.error('Connection timed out after 30 seconds');
      socket.destroy(new Error('Connection timeout'));
    }, 30000);

    // Handle socket events
    socket.on('connect', () => {
      console.log('Connected to proxy server');

      // Build HTTP CONNECT request
      let connectRequest = [
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1`,
        `Host: ${targetHost}:${targetPort}`,
        'Connection: keep-alive',
        'User-Agent: SSH-Client'
      ];

      // Add proxy authentication if provided
      if (proxyAuth) {
        const authHeader = `Basic ${Buffer.from(proxyAuth).toString('base64')}`;
        connectRequest.push(`Proxy-Authorization: ${authHeader}`);
      }

      // Finalize request
      connectRequest.push('', '');

      console.log('Sending HTTP CONNECT request to proxy...');
      socket.write(connectRequest.join('\r\n'));

      // Set up one-time handler for proxy response
      let buffer = '';
      let headersParsed = false;

      const responseHandler = (data: any) => {
        // Clear the connection timeout once we get a response
        clearTimeout(connectionTimeout);

        buffer += data.toString();

        // Only log the headers if we haven't parsed them yet
        if (!headersParsed && buffer.includes('\r\n\r\n')) {
          const headers = buffer.split('\r\n\r\n')[0];
          console.log('Proxy response headers:', headers);
          headersParsed = true;
        }

        if (buffer.includes('\r\n\r\n')) {
          // Check if connection was successful
          if (buffer.includes('HTTP/1.1 200')) {
            console.log('HTTP CONNECT successful, establishing SSH connection...');

            // Remove the handler as we're now connected
            socket.removeListener('data', responseHandler);

            // If there's any data after the headers, emit it
            const parts = buffer.split('\r\n\r\n');
            if (parts.length > 1 && parts[1].length > 0) {
              process.nextTick(() => {
                socket.emit('data', Buffer.from(parts[1]));
              });
            }
          } else {
            // Connection failed
            const statusLine = buffer.split('\r\n')[0];
            console.error('HTTP CONNECT failed:', statusLine);

            // Provide more helpful error messages based on status code
            if (statusLine.includes('407')) {
              console.error('Proxy authentication required. Add proxy credentials.');
            } else if (statusLine.includes('403')) {
              console.error('Proxy access forbidden. Check proxy permissions.');
            } else if (statusLine.includes('404')) {
              console.error('Target host not found by proxy.');
            } else if (statusLine.includes('502') || statusLine.includes('504')) {
              console.error('Proxy could not connect to target host.');
            }

            socket.destroy(new Error(`HTTP CONNECT failed: ${statusLine}`));
          }
        }
      };

      socket.on('data', responseHandler);
    });

    socket.on('error', (err: any) => {
      clearTimeout(connectionTimeout);
      console.error('Socket error:', err.message);

      // Provide more specific error messages
      if (err.code === 'ECONNREFUSED') {
        console.error('Could not connect to proxy server. Check if the proxy is running and accessible.');
      } else if (err.code === 'ETIMEDOUT') {
        console.error('Connection to proxy timed out. Check network connectivity or proxy server status.');
      } else if (err.code === 'ENOTFOUND') {
        console.error('Proxy hostname could not be resolved. Check the proxy hostname.');
      }
    });

    socket.on('end', () => {
      console.log('Proxy connection ended');
    });

    socket.on('close', (hadError) => {
      console.log(`Proxy connection closed${hadError ? ' with error' : ''}`);
    });

    return socket;
  };
}

// Extend the SSH2 Client class
export class HTTPConnectClient extends Client {
  proxyOptions: any;
  constructor() {
    super();
    this.proxyOptions = {
      proxyHost: process.env.PROXY_HOST || "",
      proxyPort: process.env.PROXY_PORT || 80,
      proxyAuth: ""
    };
  }

  connect(config: any) {

    if (config.host && config.host.indexOf(this.proxyOptions.proxyHost) > -1) {
      // Create transport function
      const transport = createHTTPConnectTransport({
        proxyHost: this.proxyOptions.proxyHost,
        proxyPort: this.proxyOptions.proxyPort,
        targetHost: config.host,
        targetPort: config.port,
        proxyAuth: this.proxyOptions.proxyAuth
      });
      // Create a socket using our transport
      const sock = transport();

      // Override the config to use our socket
      const newConfig = {
        ...config,
        sock
      };
      // Remove host and port as we're using a custom socket
      delete newConfig.host;
      delete newConfig.port;

      // Call the parent connect method with our modified config

      return super.connect(newConfig);
    }
    return super.connect(config);
  }
}


export const tcpPingProxy =async (options: any) => {
  const {
    targetHost,
    targetPort
  } = options;

  return new Promise((resolve) => {
    const proxyHost = process.env.PROXY_HOST || "";
    const proxyPort = process.env.PROXY_PORT || 80;
    const proxyAuth = process.env.PROXY_AUTH || "";
    const socket = net.createConnection({
      host: proxyHost,
      port: Number(proxyPort)
    });

    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
      console.error('Connection timed out after 30 seconds');
      socket.destroy(new Error('Connection timeout'));
    }, 30000);

    // Handle socket events
    socket.on('connect', () => {
      console.log('Connected to proxy server');

      // Build HTTP CONNECT request
      let connectRequest = [
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1`,
        `Host: ${targetHost}:${targetPort}`,
        'Connection: keep-alive',
        'User-Agent: SSH-Client'
      ];

      // Add proxy authentication if provided
      if (proxyAuth) {
        const authHeader = `Basic ${Buffer.from(proxyAuth).toString('base64')}`;
        connectRequest.push(`Proxy-Authorization: ${authHeader}`);
      }

      // Finalize request
      connectRequest.push('', '');

      console.log('Sending HTTP CONNECT request to proxy...');
      socket.write(connectRequest.join('\r\n'));

      // Set up one-time handler for proxy response
      let buffer = '';
      let headersParsed = false;

      const responseHandler = (data: any) => {
        // Clear the connection timeout once we get a response
        clearTimeout(connectionTimeout);

        buffer += data.toString();

        // Only log the headers if we haven't parsed them yet
        if (!headersParsed && buffer.includes('\r\n\r\n')) {
          const headers = buffer.split('\r\n\r\n')[0];
          console.log('Proxy response headers:', headers);
          headersParsed = true;
        }

        if (buffer.includes('\r\n\r\n')) {
          // Check if connection was successful
          if (buffer.includes('HTTP/1.1 200')) {
            console.log('HTTP CONNECT successful, establishing SSH connection...');

            // Remove the handler as we're now connected
            socket.removeListener('data', responseHandler);
            clearTimeout(connectionTimeout);
            socket.destroy();
            resolve(true);
          } else {
            clearTimeout(connectionTimeout);
            socket.destroy();
            resolve(false);
          }
        }
      };

      socket.on('data', responseHandler);
    });

    socket.on('error', (err: any) => {
     clearTimeout(connectionTimeout);
            socket.destroy();
            resolve(false);
    });

    socket.on('end', () => {
      console.log('Proxy connection ended');
      clearTimeout(connectionTimeout);
            socket.destroy();
            resolve(false);
    });

    socket.on('close', (hadError) => {
      console.log(`Proxy connection closed${hadError ? ' with error' : ''}`);
      clearTimeout(connectionTimeout);
    });


  });
}