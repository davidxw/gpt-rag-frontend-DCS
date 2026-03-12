import { AskRequest, AskResponse, AskResponseGpt, AuthInfo, ChatRequest, ChatRequestGpt, ConversationDetailResponse, ConversationsResponse } from "./models";



export async function chatApiGpt(options: ChatRequestGpt): Promise<AskResponseGpt> {
    const response = await fetch("/chatgpt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            history: options.history,
            approach: options.approach,
            conversation_id: options.conversation_id,
            query: options.query,
            overrides: {
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory,
                suggest_followup_questions: options.overrides?.suggestFollowupQuestions
            }
        })
    });

    const parsedResponse: AskResponseGpt = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export function parseCitation(citation: string): { fileName: string; page?: number; pageEnd?: number; title?: string } {
    const match = citation.match(/^(.+?)#page=(\d+)(?:-(\d+))?(?:#title=(.+))?$/);
    if (match) {
        return {
            fileName: match[1],
            page: parseInt(match[2], 10),
            pageEnd: match[3] ? parseInt(match[3], 10) : undefined,
            title: match[4] || undefined
        };
    }
    return { fileName: citation };
}

export function getCitationFilePath(citation: string): string {
    var storage_account = "please_check_if_storage_account_is_in_frontend_app_settings";
    
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/get-storage-account", false);
    xhr.send();

    if (xhr.status > 299) {
        console.log("Please check if STORAGE_ACCOUNT is in frontend app settings");
        return storage_account
    } else {
        const parsedResponse = JSON.parse(xhr.responseText);
        storage_account = parsedResponse['storageaccount'];
    }
    const file_path = `https://${storage_account}.blob.core.windows.net/documents/${citation}`
    console.log('Citation file path:' + file_path);
    return `https://${storage_account}.blob.core.windows.net/documents/${citation}`;
}

export async function fetchAuthInfo(): Promise<AuthInfo> {
    const response = await fetch("/api/auth-info");
    if (!response.ok) {
        return { authenticated: false, principalId: "", principalName: "" };
    }
    return response.json();
}

export async function fetchConversations(limit: number = 20): Promise<ConversationsResponse> {
    const response = await fetch(`/api/conversations?limit=${limit}`);
    if (!response.ok) {
        throw new Error("Failed to fetch conversations");
    }
    return response.json();
}

export async function fetchConversationDetail(conversationId: string): Promise<ConversationDetailResponse> {
    const response = await fetch(`/api/conversation-detail?conversation_id=${encodeURIComponent(conversationId)}`);
    if (!response.ok) {
        throw new Error("Failed to fetch conversation detail");
    }
    return response.json();
}