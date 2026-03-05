export interface OrchestratorResponse {
    conversation_id: string;
    answer: string;
    thoughts: string | null;
    data_points?: string[];
    error?: string;
}

export async function callOrchestrator(question: string): Promise<OrchestratorResponse> {
    const conversationId = crypto.randomUUID();

    const response = await fetch("/chatgpt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            conversation_id: conversationId,
            query: question
        })
    });

    const parsedResponse: OrchestratorResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}
