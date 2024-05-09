export interface OpaRequest<T> {
    input: T
}

export interface OpaResponse<T> {
    decision_id: string;
    metrics: Record<string, number>;
    result: T;
}