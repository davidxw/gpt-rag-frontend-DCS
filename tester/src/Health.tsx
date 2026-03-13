import React, { useState, useEffect } from "react";
import { Spinner, SpinnerSize, DefaultButton } from "@fluentui/react";
import styles from "./Health.module.css";

interface HealthCheck {
    name: string;
    status: string;
    elapsedTime: string;
    error?: string;
}

interface Setting {
    name: string;
    value: string;
    description: string;
}

interface SettingGroup {
    group: string;
    settings: Setting[];
}

interface BackendResponse {
    overallStatus: string;
    healthChecks: HealthCheck[];
    settings: SettingGroup[];
}

interface AuthInfo {
    authenticationMode: string;
    authorized: boolean;
    principalId: string;
    principalName: string;
    groups: string[];
    hasAccessToken: boolean;
}

interface WebAppResponse {
    settings: Setting[];
    authInfo: AuthInfo;
    easyAuthHeaders: Record<string, string>;
    healthChecks: HealthCheck[];
}

const easyAuthHeaderDescriptions: Record<string, string> = {
    "X-MS-CLIENT-PRINCIPAL-ID": "An identifier that the identity provider sets for the caller",
    "X-MS-CLIENT-PRINCIPAL-NAME": "A human-readable name such as an email address or user principal name",
    "X-MS-CLIENT-PRINCIPAL-IDP": "The name of the identity provider that App Service authentication uses"
};

const HealthChecks: React.FC<{ checks: HealthCheck[] }> = ({ checks }) => (
    <>
        {checks.map((check, i) => (
            <tr key={i}>
                <td className={styles.checkNameCell}>
                    <span
                        className={`${styles.dot} ${
                            check.status === "passed" ? styles.dotPassed : styles.dotFailed
                        }`}
                    />
                    {check.name}
                </td>
                <td className={styles.checkTimeCell}>{check.elapsedTime}</td>
                <td className={styles.checkErrorCell}>{check.error || ""}</td>
            </tr>
        ))}
    </>
);

const SettingsRows: React.FC<{ settings: Setting[] }> = ({ settings }) => (
    <>
        {settings.map((s, i) => (
            <tr key={i}>
                <td>{s.name}</td>
                <td>{s.value || "—"}</td>
                <td>{s.description}</td>
            </tr>
        ))}
    </>
);

const Health: React.FC = () => {
    const [backend, setBackend] = useState<BackendResponse | null>(null);
    const [webapp, setWebapp] = useState<WebAppResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [backendError, setBackendError] = useState<string | null>(null);
    const [webappError, setWebappError] = useState<string | null>(null);

    const fetchAll = async () => {
        setLoading(true);
        setBackendError(null);
        setWebappError(null);

        const handleResponse = async (r: Response, label: string) => {
            if (!r.ok) throw new Error(`${label} returned HTTP ${r.status}`);
            const text = await r.text();
            if (!text) throw new Error(`Empty response from ${label}`);
            try { return JSON.parse(text); } catch { throw new Error(`Invalid JSON from ${label}`); }
        };

        const [beResult, waResult] = await Promise.allSettled([
            fetch("/api/health-check").then(async r => {
                const json = await handleResponse(r, "health-check");
                if (json.overallStatus !== undefined) return json;
                throw new Error(json.error || "Unexpected response from health-check");
            }),
            fetch("/api/webapp-health").then(async r => {
                const json = await handleResponse(r, "webapp-health");
                if (json.settings !== undefined) return json;
                throw new Error(json.error || "Unexpected response from webapp-health");
            })
        ]);

        if (beResult.status === "fulfilled") setBackend(beResult.value);
        else setBackendError(beResult.reason?.message || "Failed to load");

        if (waResult.status === "fulfilled") setWebapp(waResult.value);
        else setWebappError(waResult.reason?.message || "Failed to load");

        setLoading(false);
    };

    useEffect(() => {
        fetchAll();
    }, []);

    return (
        <div className={styles.layout}>
            <header className={styles.header}>
                <div className={styles.headerContainer}>
                    <h1 className={styles.headerTitle}>Health Check</h1>
                    <a href="/tester/" className={styles.backLink}>
                        ← Back to Tester
                    </a>
                </div>
            </header>
            <main className={styles.main}>
                {loading && (
                    <div className={styles.loadingContainer}>
                        <Spinner size={SpinnerSize.large} label="Loading health status..." />
                    </div>
                )}

                {!loading && (
                    <>
                        {/* Web Application Section */}
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span>Web Application</span>
                                {webapp && (() => {
                                    const allPassed = webapp.healthChecks.every(c => c.status === "passed");
                                    return (
                                        <span className={`${styles.overallStatus} ${allPassed ? styles.statusHealthy : styles.statusUnhealthy}`}>
                                            {allPassed ? "healthy" : "unhealthy"}
                                        </span>
                                    );
                                })()}
                                <DefaultButton text="Refresh" onClick={fetchAll} className={styles.refreshBtn} />
                            </div>
                            {webappError ? (
                                <div className={styles.errorContainer}>{webappError}</div>
                            ) : webapp && (
                                <table className={styles.settingsTable}>
                                    <colgroup>
                                        <col style={{ width: "18%" }} />
                                        <col style={{ width: "15%" }} />
                                        <col style={{ width: "67%" }} />
                                    </colgroup>
                                    <tbody>
                                        <tr><td colSpan={3} className={styles.groupHeader}>Health Checks</td></tr>
                                        <HealthChecks checks={webapp.healthChecks} />
                                        <tr><td colSpan={3} className={styles.groupHeader}>Settings</td></tr>
                                        <SettingsRows settings={webapp.settings} />
                                        <tr><td colSpan={3} className={styles.groupHeader}>Authenticated User</td></tr>
                                        <SettingsRows settings={[
                                            { name: "Authentication Mode", value: webapp.authInfo.authenticationMode, description: "Current authentication mode (none, builtin, or easyauth)" },
                                            { name: "Authorized", value: webapp.authInfo.authorized ? "Yes" : "No", description: "Whether the user is authorized to access the application" },
                                            { name: "Principal ID", value: webapp.authInfo.principalId, description: "The user's Entra ID object identifier (OID)" },
                                            { name: "Principal Name", value: webapp.authInfo.principalName, description: "The user's display name or UPN" },
                                            { name: "Groups", value: webapp.authInfo.groups.join(", ") || "—", description: "Entra ID group memberships" },
                                            { name: "Access Token", value: webapp.authInfo.hasAccessToken ? "Present" : "Not available", description: "Whether an access token is available for downstream calls" }
                                        ]} />
                                        <tr><td colSpan={3} className={styles.groupHeader}>Easy Auth Headers</td></tr>
                                        <SettingsRows
                                            settings={Object.entries(webapp.easyAuthHeaders).map(([name, value]) => ({
                                                name,
                                                value: value || "",
                                                description: easyAuthHeaderDescriptions[name] || ""
                                            }))}
                                        />
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Back End Section */}
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span>Back End</span>
                                {backend && (
                                    <span
                                        className={`${styles.overallStatus} ${
                                            backend.overallStatus === "healthy"
                                                ? styles.statusHealthy
                                                : styles.statusUnhealthy
                                        }`}
                                    >
                                        {backend.overallStatus}
                                    </span>
                                )}
                            </div>
                            {backendError ? (
                                <div className={styles.errorContainer}>{backendError}</div>
                            ) : backend && (
                                <table className={styles.settingsTable}>
                                    <colgroup>
                                        <col style={{ width: "18%" }} />
                                        <col style={{ width: "15%" }} />
                                        <col style={{ width: "67%" }} />
                                    </colgroup>
                                    <tbody>
                                        <tr><td colSpan={3} className={styles.groupHeader}>Health Checks</td></tr>
                                        <HealthChecks checks={backend.healthChecks} />
                                        {backend.settings.length > 0 && (
                                            <>
                                                <tr><td colSpan={3} className={styles.groupHeader}>Settings</td></tr>
                                                {backend.settings.map((group, gi) => (
                                                    <React.Fragment key={gi}>
                                                        <tr>
                                                            <td colSpan={3} className={styles.subGroupHeader}>{group.group}</td>
                                                        </tr>
                                                        {group.settings.map((s, si) => (
                                                            <tr key={si}>
                                                                <td>{s.name}</td>
                                                                <td>{s.value || "—"}</td>
                                                                <td>{s.description}</td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};

export default Health;
