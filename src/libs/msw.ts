export async function startMSW() {
  if (import.meta.env.MODE === 'internal') {
    const { server } = await import('../mocks/server');
    server.listen();
  }
}
