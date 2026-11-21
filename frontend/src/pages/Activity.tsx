import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ActivityCounts, ActivityFilter, DailyActivity, SubmissionPage } from '../../../backend/src/shared/activity';
import { getApiErrorMessage, problemsApi } from '../services/apiClient';
import SubmissionDialog, { submissionLabel } from '../components/SubmissionDialog';
import './Activity.css';

const metrics: [keyof ActivityCounts, string][] = [
    ['submissions', 'Submissions'], ['accepted', 'Accepted'], ['practicedProblems', 'Problems practiced'], ['solvedProblems', 'Problems solved'],
];

function localDate(date: Date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function ActivityResults({ filter, page, turnPage }: { filter: ActivityFilter; page: number; turnPage: (page: number) => void }) {
    const [data, setData] = useState<{ history: SubmissionPage; stats: DailyActivity } | null>(null);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        setError('');
        const load = async () => {
            try {
                const [history, stats] = await Promise.all([
                    problemsApi.submissions(filter, page, controller.signal), problemsApi.daily(filter, controller.signal),
                ]);
                if (controller.signal.aborted) return;
                setData({ history, stats });
                if (history.items.some(item => item.state === 'running')) timer = setTimeout(() => void load(), 1500);
            } catch (err) {
                if (!controller.signal.aborted) setError(getApiErrorMessage(err, 'Unable to load activity.'));
            }
        };
        void load();
        return () => { controller.abort(); clearTimeout(timer); };
    }, [filter, page, revision]);

    if (error) return <p className="error-message" role="alert">{error} <button className="activity-button"
        onClick={() => setRevision(value => value + 1)}>Retry</button></p>;
    if (!data) return <p role="status">Loading activity…</p>;
    const { stats, history } = data;
    const pages = Math.max(1, Math.ceil(history.total / history.limit));
    return <>
        {stats.hasLegacy && <p className="legacy-note">This range includes imported records. Earlier versions recorded only accepted submissions.</p>}
        <dl className="activity-counts" aria-label="Selected period totals">{metrics.map(([key, label]) =>
            <div key={key}><dt>{label}</dt><dd>{stats.totals[key].toLocaleString()}</dd></div>)}</dl>
        <section>
            <h2>Daily practice</h2>
            {stats.days.length ? <div className="activity-table-wrap"><table aria-label="Daily practice">
                <thead><tr><th>Date</th>{metrics.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
                <tbody>{stats.days.map(day => <tr key={day.date}><th scope="row">{day.date}</th>
                    {metrics.map(([key]) => <td key={key}>{day[key]}</td>)}</tr>)}</tbody>
            </table></div> : <p className="activity-empty">No practice recorded in this period.</p>}
        </section>
        <section>
            <h2>Submission history</h2>
            {history.items.length ? <div className="activity-table-wrap"><table aria-label="Submission history">
                <thead><tr><th>Submitted</th><th>Problem</th><th>Language</th><th>Result</th><th>Tests passed</th><th>Details</th></tr></thead>
                <tbody>{history.items.map(item => <tr key={item.id}>
                    <td><time dateTime={item.submittedAt}>{new Date(item.submittedAt).toLocaleString()}</time></td>
                    <th scope="row">{item.problemId}</th><td>{item.language === 'java' ? 'Java' : 'Python3'}</td>
                    <td><span className={item.verdict === 'AC' ? 'verdict-ac' : undefined}>{submissionLabel(item)}</span>
                        {item.source === 'legacy' && <small>Imported</small>}</td>
                    <td>{item.totalTestcases === null ? '—' : `${item.passedTestcases} / ${item.totalTestcases}`}</td>
                    <td><button type="button" className="activity-button" aria-label={`View ${item.problemId} submission`}
                        onClick={() => setSelected(item.id)}>View</button></td>
                </tr>)}</tbody>
            </table></div> : <p className="activity-empty">No submissions match this view.</p>}
            {(pages > 1 || page > 1) && <nav className="activity-pagination" aria-label="Submission pages">
                <button className="activity-button" disabled={page <= 1} onClick={() => turnPage(Math.min(page - 1, pages))}>Previous</button>
                <span>Page {page} of {pages}</span>
                <button className="activity-button" disabled={page >= pages} onClick={() => turnPage(page + 1)}>Next</button>
            </nav>}
        </section>
        {selected && <SubmissionDialog key={selected} id={selected} onClose={() => setSelected(null)} />}
    </>;
}

export default function Activity() {
    const [params, setParams] = useSearchParams();
    const [defaults] = useState(() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - 29);
        return { from: localDate(start), to: localDate(today) };
    });
    const filter = useMemo<ActivityFilter>(() => ({
        from: (params.get('from') ?? defaults.from) || undefined,
        to: (params.get('to') ?? defaults.to) || undefined,
        problemId: params.get('problemId') || undefined,
        language: (params.get('language') || undefined) as ActivityFilter['language'],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }), [params, defaults]);
    const page = Math.max(1, Number(params.get('page')) || 1);
    const apply = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const next = new URLSearchParams();
        for (const key of ['from', 'to', 'language', 'problemId']) {
            const value = String(values.get(key) ?? '').trim();
            if (value || key === 'from' || key === 'to') next.set(key, value);
        }
        setParams(next);
    };
    const turnPage = (next: number) => {
        const updated = new URLSearchParams(params);
        updated.set('page', String(next));
        setParams(updated);
    };
    return <main className="activity-page">
        <header><h1>Activity</h1><p>Dates and times in {filter.timezone}</p></header>
        <form key={'filters:' + params.toString()} className="activity-filters" onSubmit={apply}>
            <label>From<input type="date" name="from" defaultValue={filter.from} /></label>
            <label>Through<input type="date" name="to" defaultValue={filter.to} /></label>
            <label>Language<select name="language" defaultValue={filter.language ?? ''}>
                <option value="">All languages</option><option value="java">Java</option><option value="python3">Python3</option>
            </select></label>
            <label>Problem ID<input name="problemId" defaultValue={filter.problemId} placeholder="All problems" /></label>
            <button className="activity-button primary" type="submit">Apply filters</button>
            <button className="activity-button" type="button" onClick={() => setParams({})}>Reset filters</button>
        </form>
        <ActivityResults key={params.toString()} filter={filter} page={page} turnPage={turnPage} />
    </main>;
}
