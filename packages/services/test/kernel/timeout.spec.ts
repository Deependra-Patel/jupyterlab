import { UUID } from '@lumino/coreutils';
import { KernelConnection } from '../../src';
import { SocketTester, KernelTester, handleRequest } from '../utils';

describe('kernel timeout', () => {
  let tester: SocketTester;

  afterEach(() => {
    if (tester) {
      tester.dispose();
    }
  });

  it('should close socket if kernel_info_reply is not received', async () => {
    jest.useFakeTimers();

    // Use SocketTester which does NOT reply to kernel_info_request
    tester = new SocketTester();
    const serverSettings = tester.serverSettings;
    const id = UUID.uuid4();

    // Mock the POST request to create a kernel (if needed by KernelConnection constructor or subsequent calls)
    handleRequest(tester, 201, { name: 'test', id });

    const kernel = new KernelConnection({
      model: { id, name: 'test' },
      serverSettings,
      clientId: UUID.uuid4()
    });

    // Wait for the websocket to be open (connected status)
    await tester.ready;

    // Fast-forward time to trigger the timeout
    jest.advanceTimersByTime(4000);

    // The socket should be closed now.
    // We can't directly check the socket, but we can check if the connection status
    // is set to 'connecting' (which happens after a close to try reconnecting)
    // or if the socket is actually closed.
    // Since we can't access private members, we can check the connection status.
    expect(kernel.connectionStatus).toBe('connecting');

    jest.useRealTimers();
    kernel.dispose();
  });

  it('should NOT close socket if kernel_info_reply is received', async () => {
    jest.useFakeTimers();

    // Use KernelTester which automatically replies to kernel_info_request
    tester = new KernelTester();
    const serverSettings = tester.serverSettings;
    const id = UUID.uuid4();

    handleRequest(tester, 201, { name: 'test', id });

    const kernel = new KernelConnection({
      model: { id, name: 'test' },
      serverSettings,
      clientId: UUID.uuid4()
    });

    await tester.ready;

    // Yield to let the reply be processed
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    // Fast-forward time to verify timeout is NOT triggered
    jest.advanceTimersByTime(4000);

    // The socket should NOT be closed.
    // Connection status should be 'connected' (finished connecting)
    expect(kernel.connectionStatus).toBe('connected');

    jest.useRealTimers();
    kernel.dispose();
  });
});

