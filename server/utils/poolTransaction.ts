export type TransactionClient = {
  query: (text: string, values?: any[]) => Promise<any>;
  release: (error?: Error) => void;
};

export type TransactionPool = {
  connect: () => Promise<TransactionClient>;
};

export async function withPoolTransaction<T>(
  dbPool: TransactionPool,
  fn: (client: TransactionClient) => Promise<T>
): Promise<T> {
  const client = await dbPool.connect();
  let began = false;
  let releaseError: Error | undefined;

  try {
    await client.query("BEGIN");
    began = true;
    const result = await fn(client);
    await client.query("COMMIT");
    began = false;
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query("ROLLBACK");
        began = false;
      } catch (rollbackError) {
        // A client with an uncertain transaction state must not return to the pool.
        releaseError =
          rollbackError instanceof Error
            ? rollbackError
            : new Error(String(rollbackError));
      }
    } else if (error instanceof Error) {
      // BEGIN or COMMIT may have failed because the session is no longer usable.
      releaseError = error;
    }
    throw error;
  } finally {
    client.release(releaseError);
  }
}
