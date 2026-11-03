// Background tabs throttle main-thread timers (Chrome: about once a minute after five minutes),
// which would look like a disconnection. Worker timers keep the exam heartbeat at its interval.
let timer: ReturnType<typeof setInterval> | undefined;
const scope = self as unknown as { onmessage: ((event: MessageEvent<number>) => void) | null; postMessage(message: string): void };
scope.onmessage = event => {
  clearInterval(timer);
  if (event.data > 0) timer = setInterval(() => scope.postMessage("tick"), event.data);
};
