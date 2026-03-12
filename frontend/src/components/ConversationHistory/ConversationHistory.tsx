import { useState, useEffect } from "react";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { fetchConversations, fetchConversationDetail } from "../../api";
import { ConversationSummary, AskResponse } from "../../api/models";
import styles from "./ConversationHistory.module.css";

interface Props {
    isOpen: boolean;
    onDismiss: () => void;
    onConversationLoad: (conversationId: string, answers: [string, AskResponse][]) => void;
}

export const ConversationHistory = ({ isOpen, onDismiss, onConversationLoad }: Props) => {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadConversations();
        }
    }, [isOpen]);

    const loadConversations = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchConversations(20);
            setConversations(result.conversations || []);
        } catch {
            setError("Failed to load conversation history.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleConversationClick = async (conversation: ConversationSummary) => {
        setIsLoadingDetail(true);
        try {
            const detail = await fetchConversationDetail(conversation.id);
            const answers: [string, AskResponse][] = [];
            const history = detail.history || [];

            for (let i = 0; i < history.length; i++) {
                const msg = history[i];
                if (msg.role === "user") {
                    const nextMsg = history[i + 1];
                    const botAnswer = nextMsg && nextMsg.role === "assistant" ? nextMsg.content : "";
                    answers.push([
                        msg.content,
                        {
                            answer: botAnswer,
                            thoughts: null,
                            data_points: []
                        }
                    ]);
                    if (nextMsg && nextMsg.role === "assistant") {
                        i++;
                    }
                }
            }

            onConversationLoad(detail.conversation_id, answers);
            onDismiss();
        } catch {
            setError("Failed to load conversation.");
        } finally {
            setIsLoadingDetail(false);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr + "Z");
            return date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return dateStr;
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className={styles.overlay} onClick={onDismiss} />
            <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ""}`}>
                <div className={styles.header}>
                    <h2 className={styles.headerTitle}>Conversation History</h2>
                    <button className={styles.closeButton} onClick={onDismiss} aria-label="Close">
                        <Dismiss24Regular />
                    </button>
                </div>
                <div className={styles.content}>
                    {isLoading || isLoadingDetail ? (
                        <div className={styles.loading}>
                            {isLoadingDetail ? "Loading conversation..." : "Loading history..."}
                        </div>
                    ) : error ? (
                        <div className={styles.error}>{error}</div>
                    ) : conversations.length === 0 ? (
                        <div className={styles.empty}>No previous conversations found.</div>
                    ) : (
                        conversations.map(conv => (
                            <div
                                key={conv.id}
                                className={styles.conversationItem}
                                onClick={() => handleConversationClick(conv)}
                            >
                                <p className={styles.conversationQuestion}>{conv.first_question}</p>
                                <div className={styles.conversationMeta}>
                                    <span>{formatDate(conv.start_date)}</span>
                                    <span>{conv.interaction_count} message{conv.interaction_count !== 1 ? "s" : ""}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};
