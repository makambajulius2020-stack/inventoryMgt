export type OperationalMutationEventBase = {
    traceId: string;
    actorId: string;
    actorRole: string;
    locationId?: string;
    entityType: string;
    action: string;
    executionTimeMs: number;
    timestamp: string;
};

export type OperationalMutationStartEvent = OperationalMutationEventBase & {
    event: "MUTATION_START";
};

export type OperationalMutationSuccessEvent = OperationalMutationEventBase & {
    event: "MUTATION_SUCCESS";
};

export type OperationalMutationFailureEvent = OperationalMutationEventBase & {
    event: "MUTATION_FAILURE";
    errorType: string;
};

export type OperationalMutationEvent =
    | OperationalMutationStartEvent
    | OperationalMutationSuccessEvent
    | OperationalMutationFailureEvent;

function emit(event: OperationalMutationEvent) {
    // Intentionally no-op.
    // This module defines a structured logging contract.
    void event;
}

export function logMutationStart(event: Omit<OperationalMutationStartEvent, "event">) {
    emit({ ...event, event: "MUTATION_START" });
}

export function logMutationSuccess(event: Omit<OperationalMutationSuccessEvent, "event">) {
    emit({ ...event, event: "MUTATION_SUCCESS" });
}

export function logMutationFailure(event: Omit<OperationalMutationFailureEvent, "event">) {
    emit({ ...event, event: "MUTATION_FAILURE" });
}
