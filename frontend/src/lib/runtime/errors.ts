export type ErrorMetadata = Record<string, unknown>;

type ErrorWithCause = Error & { cause?: unknown };

export class DomainError extends Error {
  public readonly code: string;
  public readonly metadata?: ErrorMetadata;

  constructor(message: string, params?: { code?: string; metadata?: ErrorMetadata; cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    this.code = params?.code ?? "DOMAIN_ERROR";
    this.metadata = params?.metadata;
    if (params?.cause !== undefined) (this as ErrorWithCause).cause = params.cause;
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string, params?: { metadata?: ErrorMetadata; cause?: unknown }) {
    super(message, { code: "AUTHORIZATION_ERROR", metadata: params?.metadata, cause: params?.cause });
  }
}

export class ScopeViolationError extends DomainError {
  constructor(message: string, params?: { metadata?: ErrorMetadata; cause?: unknown }) {
    super(message, { code: "SCOPE_VIOLATION", metadata: params?.metadata, cause: params?.cause });
  }
}

export class InvariantViolationError extends DomainError {
  constructor(message: string, params?: { metadata?: ErrorMetadata; cause?: unknown }) {
    super(message, { code: "INVARIANT_VIOLATION", metadata: params?.metadata, cause: params?.cause });
  }
}

export class LifecycleViolationError extends DomainError {
  constructor(message: string, params?: { metadata?: ErrorMetadata; cause?: unknown }) {
    super(message, { code: "LIFECYCLE_VIOLATION", metadata: params?.metadata, cause: params?.cause });
  }
}

export class RateLimitExceededError extends DomainError {
  constructor(message: string, params?: { metadata?: ErrorMetadata; cause?: unknown }) {
    super(message, { code: "RATE_LIMIT_EXCEEDED", metadata: params?.metadata, cause: params?.cause });
  }
}

export class EnvironmentError extends DomainError {
  constructor(message: string, params?: { metadata?: ErrorMetadata; cause?: unknown }) {
    super(message, { code: "ENVIRONMENT_ERROR", metadata: params?.metadata, cause: params?.cause });
  }
}

export function asDomainError(err: unknown): DomainError {
  if (err instanceof DomainError) return err;
  if (err instanceof Error) {
    return new DomainError(err.message, { cause: err, metadata: { name: err.name } });
  }
  return new DomainError("Unknown error", { metadata: { value: err } });
}
