export async function startMSW() {
  if (import.meta.env.DEV) {
    const { server } = await import('../mocks/server');
    server.listen();
  }
}
