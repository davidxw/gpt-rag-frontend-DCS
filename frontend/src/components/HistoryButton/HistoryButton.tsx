import { Text } from "@fluentui/react";
import { History24Regular } from "@fluentui/react-icons";
import styles from "./HistoryButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const HistoryButton = ({ className, disabled, onClick }: Props) => {
    return (
        <div className={`${styles.container} ${className ?? ""} ${disabled ? styles.disabled : ""}`} onClick={!disabled ? onClick : undefined}>
            <History24Regular />
            <Text>History</Text>
        </div>
    );
};
