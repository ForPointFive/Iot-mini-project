export enum PredictionType {
    HEALTHY = "healthy",
    DISEASES = "multiple_diseases",
    RUST = "rust",
    SCAB = "scab",
}

export interface Prediction {
    predict: PredictionType;
    probs: {
        healthy: number;
        multiple_diseases: number;
        rust: number;
        scab: number;
    }
}