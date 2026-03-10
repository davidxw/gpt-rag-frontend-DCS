import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    PrimaryButton,
    DefaultButton,
    Checkbox,
    Spinner,
    SpinnerSize,
    Icon,
    IconButton,
    MessageBar,
    MessageBarType,
    IIconProps
} from "@fluentui/react";

import styles from "./App.module.css";
import { TestRow, TestStatus } from "./types";
import { callOrchestrator } from "./api";
import { parseCSV, generateCSV, parseReferences } from "./utils";
import { marked } from "marked";
import DOMPurify from "dompurify";

const CONCURRENCY_LIMIT = 3;

const playIcon: IIconProps = { iconName: "Play" };

const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const millis = ms % 1000;
    return `${seconds}.${String(millis).padStart(3, "0")}`;
};

const App: React.FC = () => {
    const [rows, setRows] = useState<TestRow[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const rowsRef = useRef<TestRow[]>([]);

    useEffect(() => {
        rowsRef.current = rows;
    }, [rows]);

    useEffect(() => {
        loadStarterQuestions();
    }, []);

    const loadStarterQuestions = async () => {
        try {
            const response = await fetch("/tester/starter_questions.csv");
            if (!response.ok) throw new Error("Failed to load starter questions");
            const text = await response.text();
            setRows(csvToRows(text));
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const csvToRows = (text: string): TestRow[] => {
        const parsed = parseCSV(text);
        const dataRows = parsed.slice(1).filter(row => row.length >= 3 && row[2]?.trim());
        return dataRows.map((row, index) => ({
            id: index + 1,
            documentName: row[1]?.trim() || "",
            question: row[2]?.trim() || "",
            expectedAnswer: row[3]?.trim() || "",
            location: row[4]?.trim() || "",
            response: "",
            responseReferences: [],
            responseTime: null,
            status: "idle" as TestStatus,
            selected: false
        }));
    };

    const runSingleTest = useCallback(async (rowId: number, question: string): Promise<void> => {
        setRows(prev =>
            prev.map(r =>
                r.id === rowId
                    ? { ...r, status: "running" as TestStatus, response: "", responseReferences: [], responseTime: null }
                    : r
            )
        );

        const startTime = Date.now();
        try {
            const result = await callOrchestrator(question);
            const elapsedMs = Date.now() - startTime;
            const { cleanText, references } = parseReferences(result.answer || "");

            setRows(prev =>
                prev.map(r =>
                    r.id === rowId
                        ? {
                              ...r,
                              status: "completed" as TestStatus,
                              response: cleanText,
                              responseReferences: references,
                              responseTime: elapsedMs
                          }
                        : r
                )
            );
        } catch (error) {
            const elapsedMs = Date.now() - startTime;
            setRows(prev =>
                prev.map(r =>
                    r.id === rowId
                        ? {
                              ...r,
                              status: "error" as TestStatus,
                              response: error instanceof Error ? error.message : "Unknown error",
                              responseTime: elapsedMs
                          }
                        : r
                )
            );
        }
    }, []);

    const runMultiple = useCallback(
        async (rowIds: number[]) => {
            if (rowIds.length === 0) return;
            setIsRunning(true);

            const snapshot = rowsRef.current;
            const queue = [...rowIds];

            const worker = async (): Promise<void> => {
                while (true) {
                    const id = queue.shift();
                    if (id === undefined) break;
                    const row = snapshot.find(r => r.id === id);
                    if (row) {
                        await runSingleTest(id, row.question);
                    }
                }
            };

            const workers = Array(Math.min(CONCURRENCY_LIMIT, rowIds.length))
                .fill(null)
                .map(() => worker());
            await Promise.all(workers);

            setIsRunning(false);
        },
        [runSingleTest]
    );

    const handleRunAll = () => runMultiple(rows.map(r => r.id));

    const handleRunSelected = () => runMultiple(rows.filter(r => r.selected).map(r => r.id));

    const handleClear = () => {
        setRows(prev => prev.map(r => ({ ...r, selected: false })));
        setSelectAll(false);
    };

    const handleExport = () => {
        const headers = ["#", "Document Name", "Question", "Expected Answer", "Location", "Response", "Response References", "Response Time (s)"];
        const csvRows = rows.map(r => [
            r.id.toString(),
            r.documentName,
            r.question,
            r.expectedAnswer,
            r.location,
            r.response,
            r.responseReferences.join("; "),
            r.responseTime !== null ? formatTime(r.responseTime) : ""
        ]);
        const csv = generateCSV(headers, csvRows);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
        link.download = `test_results_${stamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            const text = e.target?.result as string;
            setRows(csvToRows(text));
            setExpandedRows(new Set());
        };
        reader.readAsText(file);
        event.target.value = "";
    };

    const toggleSelectAll = () => {
        // Determine if all rows are currently selected and toggle accordingly.
        setRows(prev => {
            const allSelected = prev.length > 0 && prev.every(r => r.selected);
            const newVal = !allSelected;
            return prev.map(r => ({ ...r, selected: newVal }));
        });
    };

    const toggleSelect = (id: number) => {
        setRows(prev => prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r)));
    };

    useEffect(() => {
        // Keep the header "select all" checkbox in sync with the row selection state.
        const allSelected = rows.length > 0 && rows.every(r => r.selected);
        setSelectAll(allSelected);
    }, [rows, setSelectAll]);
    const toggleExpandRow = (rowId: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(rowId)) {
                next.delete(rowId);
            } else {
                next.add(rowId);
            }
            return next;
        });
    };

    const resetRow = (id: number) => {
        setRows(prev => prev.map(r => (r.id === id ? { ...r, status: "idle" as TestStatus } : r)));
    };

    const renderStatusIcon = (row: TestRow) => {
        switch (row.status) {
            case "running":
                return <Spinner size={SpinnerSize.small} />;
            case "completed":
                return <IconButton iconProps={{ iconName: "CompletedSolid" }} title="Click to reset" className={styles.successIconButton} onClick={() => resetRow(row.id)} />;
            case "error":
                return <IconButton iconProps={{ iconName: "StatusErrorFull" }} title="Click to reset" className={styles.errorIconButton} onClick={() => resetRow(row.id)} />;
            default:
                return <IconButton iconProps={playIcon} title="Run test" className={styles.runButton} disabled={isRunning} onClick={() => runMultiple([row.id])} />;
        }
    };

    const renderCell = (text: string, rowId: number) => {
        if (!text) return null;
        const expanded = expandedRows.has(rowId);
        return (
            <div className={expanded ? styles.cellTextExpanded : styles.cellText} onClick={() => toggleExpandRow(rowId)} title={expanded ? "Click to collapse" : "Click to expand"}>
                {text}
            </div>
        );
    };

    const renderMarkdownCell = (text: string, rowId: number) => {
        if (!text) return null;
        const expanded = expandedRows.has(rowId);
        const html = DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
        return (
            <div
                className={`${expanded ? styles.cellTextExpanded : styles.cellText} ${styles.markdownContent}`}
                onClick={() => toggleExpandRow(rowId)}
                title={expanded ? "Click to collapse" : "Click to expand"}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );
    };

    const selectedCount = rows.filter(r => r.selected).length;
    const completedCount = rows.filter(r => r.status === "completed").length;
    const runningCount = rows.filter(r => r.status === "running").length;

    if (loading) {
        return (
            <div className={styles.layout}>
                <div className={styles.loadingContainer}>
                    <Spinner size={SpinnerSize.large} label="Loading test questions..." />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            <header className={styles.header}>
                <div className={styles.headerContainer}>
                    <h3 className={styles.headerTitle}>Orchestrator Tester</h3>
                    <span className={styles.headerSubtitle}>
                        {rows.length} test{rows.length !== 1 ? "s" : ""} loaded
                        {completedCount > 0 && ` · ${completedCount} completed`}
                    </span>
                    <a href="/tester/health" className={styles.healthLink}>Health</a>
                </div>
            </header>

            <main className={styles.main}>
                <div className={styles.toolbar}>
                    <PrimaryButton text="Run All" iconProps={{ iconName: "FastForward" }} onClick={handleRunAll} disabled={isRunning || rows.length === 0} />
                    <PrimaryButton
                        text={`Run Selected (${selectedCount})`}
                        iconProps={{ iconName: "Play" }}
                        onClick={handleRunSelected}
                        disabled={isRunning || selectedCount === 0}
                    />
                    <DefaultButton text="Clear" iconProps={{ iconName: "ClearSelection" }} onClick={handleClear} disabled={isRunning} />
                    <div className={styles.toolbarSpacer} />
                    <DefaultButton text="Export" iconProps={{ iconName: "Download" }} onClick={handleExport} disabled={rows.length === 0} />
                    <DefaultButton text="Import" iconProps={{ iconName: "Upload" }} onClick={handleImport} disabled={isRunning} />
                    <input type="file" ref={fileInputRef} accept=".csv" onChange={handleFileChange} style={{ display: "none" }} />
                </div>

                {isRunning && (
                    <MessageBar messageBarType={MessageBarType.info} className={styles.statusBar}>
                        Tests are running... {runningCount} in progress, {completedCount} completed
                    </MessageBar>
                )}

                {loadError && (
                    <MessageBar messageBarType={MessageBarType.error} className={styles.statusBar}>
                        {loadError}
                    </MessageBar>
                )}

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.checkboxCol}>
                                    <Checkbox checked={selectAll} onChange={toggleSelectAll} />
                                </th>
                                <th className={styles.statusCol}></th>
                                <th className={styles.idCol}>#</th>
                                <th className={styles.docCol}>Document</th>
                                <th className={styles.questionCol}>Question</th>
                                <th className={styles.answerCol}>Expected Answer</th>
                                <th className={styles.locationCol}>Location</th>
                                <th className={styles.responseCol}>Response</th>
                                <th className={styles.refsCol}>Response References</th>
                                <th className={styles.timeCol}>Time (ss.mmm)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr
                                    key={row.id}
                                    className={[
                                        styles.row,
                                        row.status === "running" ? styles.rowRunning : "",
                                        row.status === "completed" ? styles.rowCompleted : "",
                                        row.status === "error" ? styles.rowError : ""
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    <td className={styles.checkboxCol}>
                                        <Checkbox checked={row.selected} onChange={() => toggleSelect(row.id)} />
                                    </td>
                                    <td className={styles.statusCol}>{renderStatusIcon(row)}</td>
                                    <td className={styles.idCol}>{row.id}</td>
                                    <td className={styles.docCol}>{renderCell(row.documentName, row.id)}</td>
                                    <td className={styles.questionCol}>{renderCell(row.question, row.id)}</td>
                                    <td className={styles.answerCol}>{renderCell(row.expectedAnswer, row.id)}</td>
                                    <td className={styles.locationCol}>{renderCell(row.location, row.id)}</td>
                                    <td className={styles.responseCol}>
                                        {row.status === "error" ? (
                                            <span className={styles.errorText}>{row.response}</span>
                                        ) : (
                                            renderMarkdownCell(row.response, row.id)
                                        )}
                                    </td>
                                    <td className={styles.refsCol}>
                                        {row.responseReferences.length > 0 && (
                                            <div className={styles.refsText}>
                                                {row.responseReferences.join("\n")}
                                            </div>
                                        )}
                                    </td>
                                    <td className={styles.timeCol}>{row.responseTime !== null ? formatTime(row.responseTime) : ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default App;
