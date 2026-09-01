export type AdminProvisioningTransactionDatabase = {
  transaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
};

export type AtomicAdminProvisioningInput<TValidated, TResult> = {
  database: AdminProvisioningTransactionDatabase;
  validate: (tx: any) => Promise<TValidated>;
  mutate: (tx: any, validated: TValidated) => Promise<TResult>;
  afterCommit?: (result: TResult) => Promise<void>;
};

/**
 * Keeps policy/eligibility reads ahead of every durable provisioning write.
 * `afterCommit` is deliberately outside the transaction for email and other
 * irreversible integrations; it is never called when validation or mutation
 * rolls back.
 */
export async function executeAdminProvisioningAtomically<TValidated, TResult>(
  input: AtomicAdminProvisioningInput<TValidated, TResult>
): Promise<TResult> {
  const result = await input.database.transaction(async (tx) => {
    const validated = await input.validate(tx);
    return input.mutate(tx, validated);
  });

  if (input.afterCommit) {
    await input.afterCommit(result);
  }

  return result;
}

export class AdminProvisioningRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "AdminProvisioningRequestError";
  }
}
