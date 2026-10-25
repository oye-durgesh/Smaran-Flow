export class VaultError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "VaultError";
  }
}
