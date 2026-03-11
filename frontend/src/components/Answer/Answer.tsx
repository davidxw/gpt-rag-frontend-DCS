import { useMemo, useRef, useCallback, useEffect } from "react";
import { Stack, IconButton } from "@fluentui/react";
import DOMPurify from "dompurify";

import styles from "./Answer.module.css";

import { AskResponse, getCitationFilePath, parseCitation } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";

import { getLanguageText } from '../../utils/languageUtils'; 

const citation_label_text = getLanguageText('citationLabel');


interface Props {
    answer: AskResponse;
    isSelected?: boolean;
    onCitationClicked: (filePath: string, filename: string, page?: number) => void;
    onThoughtProcessClicked: () => void;
    onSupportingContentClicked: () => void;
    onFollowupQuestionClicked?: (question: string) => void;
    showFollowupQuestions?: boolean;
    showSources?: boolean;
}

function truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    const startLength = Math.ceil((maxLength - 3) / 2);
    const endLength = Math.floor((maxLength - 3) / 2);
    return str.substring(0, startLength) + "..." + str.substring(str.length - endLength);
  }

export const Answer = ({
    answer,
    isSelected,
    onCitationClicked,
    onThoughtProcessClicked,
    onSupportingContentClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions,
    showSources
}: Props) => {
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer.answer, !!showSources, onCitationClicked), [answer]);

    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

    const answerTextRef = useRef<HTMLDivElement>(null);

    const handleInlineCitationClick = useCallback((e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest(".citation-link") as HTMLAnchorElement | null;
        if (!target) return;
        e.preventDefault();
        const citationData = target.getAttribute("data-citation") || "";
        const { fileName: citFileName, page: citPage } = parseCitation(citationData);
        const path = getCitationFilePath(citFileName);
        onCitationClicked(path, citFileName, citPage);
    }, [onCitationClicked]);

    useEffect(() => {
        const el = answerTextRef.current;
        if (!el) return;
        el.addEventListener("click", handleInlineCitationClick);
        return () => el.removeEventListener("click", handleInlineCitationClick);
    }, [handleInlineCitationClick]);

    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon />
                    <div>
                        <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: "Lightbulb" }}
                            title="Show thought process"
                            ariaLabel="Show thought process"
                            onClick={() => {
                                console.log('Thought process button clicked');
                                onThoughtProcessClicked();
                            }}
                            disabled={false} 
                        />
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow>
                <div ref={answerTextRef} className={styles.answerText} dangerouslySetInnerHTML={{ __html: sanitizedAnswerHtml }}></div>
            </Stack.Item>

            {!!parsedAnswer.citations.length && showSources && (
                <Stack.Item>
                    <Stack horizontal wrap tokens={{ childrenGap: 5 }}>
                        <span className={styles.citationLearnMore}>{citation_label_text}:</span>
                        {parsedAnswer.citations.map((x, i) => {
                            const { fileName: citFileName, page: citPage, pageEnd: citPageEnd } = parseCitation(x);
                            const path = getCitationFilePath(citFileName);
                            const pageLabel = citPage
                                ? (citPageEnd ? `Pages ${citPage}-${citPageEnd}` : `Page ${citPage}`)
                                : undefined;
                            const displayText = pageLabel
                                ? `${truncateString(citFileName, 15)} / ${pageLabel}`
                                : truncateString(citFileName, 15);
                            return (
                                <a key={i} className={styles.citation} title={citFileName} onClick={() => onCitationClicked(path, citFileName, citPage)}>
                                    {`${++i}. ${displayText}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}

            {!!parsedAnswer.followupQuestions.length && showFollowupQuestions && onFollowupQuestionClicked && (
                <Stack.Item>
                    <Stack horizontal wrap className={`${!!parsedAnswer.citations.length ? styles.followupQuestionsList : ""}`} tokens={{ childrenGap: 6 }}>
                        <span className={styles.followupQuestionLearnMore}>Follow-up questions:</span>
                        {parsedAnswer.followupQuestions.map((x, i) => {
                            return (
                                <a key={i} className={styles.followupQuestion} title={x} onClick={() => onFollowupQuestionClicked(x)}>
                                    {`${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}
        </Stack>
    );
};
