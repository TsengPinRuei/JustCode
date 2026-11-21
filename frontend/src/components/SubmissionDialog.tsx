import { useEffect, useState } from 'react';
import type { SubmissionDetail, SubmissionSummary } from '../../../backend/src/shared/activity';
import { problemsApi, getApiErrorMessage } from '../services/apiClient';
import ModalDialog from './ModalDialog';
import ResultPanel, { STATUS_LABELS } from './ResultPanel';
import { CopyButton } from './CopyButton';

export const submissionLabel = (item: SubmissionSummary) => item.verdict ? STATUS_LABELS[item.verdict] :
    ({ running: 'Running', interrupted: 'Interrupted', error: 'Error', completed: 'Completed' })[item.state];
const duration = (ms: number | null) => ms === null ? '—' : Math.round(ms).toLocaleString() + ' ms';

export default function SubmissionDialog({ id, onClose }: { id: string; onClose: () => void }) {
    const [detail, setDetail] = useState<SubmissionDetail | null>(null);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        setError('');
        const load = async () => {
            try {
                const item = await problemsApi.submission(id, controller.signal);
                if (controller.signal.aborted) return;
                setDetail(item);
                if (item.state === 'running') timer = setTimeout(() => void load(), 1500);
            } catch (err) {
                if (!controller.signal.aborted) setError(getApiErrorMessage(err, 'Unable to load submission.'));
            }
        };
        void load();
        return () => { controller.abort(); clearTimeout(timer); };
    }, [id, revision]);

    return <ModalDialog titleId="submission-heading" busy={false} onClose={onClose} className="submission-dialog">
        <div className="import-modal-header">
            <h2 id="submission-heading">Submission details</h2>
            <button type="button" data-dialog-autofocus className="activity-button" onClick={onClose}>Close</button>
        </div>
        <div className="submission-body">
            {error && <p role="alert">{error} <button className="activity-button" onClick={() => setRevision(n => n + 1)}>Retry</button></p>}
            {!error && !detail && <p role="status">Loading submission…</p>}
            {detail && <>
                <h3>{detail.problemId}</h3>
                <p>{submissionLabel(detail)} · {detail.language === 'java' ? 'Java' : 'Python3'} · {new Date(detail.submittedAt).toLocaleString()}</p>
                <dl className="submission-timings">
                    <div><dt>Passed tests</dt><dd>{detail.totalTestcases === null ? '—' : `${detail.passedTestcases} / ${detail.totalTestcases}`}</dd></div>
                    <div><dt>Server judge</dt><dd>{duration(detail.judgeDurationMs)}</dd></div>
                    <div><dt>Browser request</dt><dd>{duration(detail.submitDurationMs)}</dd></div>
                    <div><dt>Attempt time</dt><dd>{duration(detail.durationMs)}</dd></div>
                </dl>
                {detail.error && <p role="status">{detail.error}</p>}
                {detail.source === 'legacy' && <p className="legacy-note">Imported from an older version. Only the accepted summary was recorded.</p>}
                <div className="submission-code-title"><h3>Submitted code</h3>
                    {detail.code !== null && <CopyButton getText={() => detail.code ?? ''} />}</div>
                {detail.code === null ? <p>Code was not recorded.</p> : <pre className="submission-code"><code>{detail.code}</code></pre>}
                {detail.result && <ResultPanel executing={false} result={detail.result} />}
            </>}
        </div>
    </ModalDialog>;
}
