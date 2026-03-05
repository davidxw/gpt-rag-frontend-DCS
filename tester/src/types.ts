export type TestStatus = "idle" | "running" | "completed" | "error";

export interface TestRow {
    id: number;
    documentName: string;
    question: string;
    expectedAnswer: string;
    location: string;
    response: string;
    responseReferences: string[];
    responseTime: number | null;
    status: TestStatus;
    selected: boolean;
}
