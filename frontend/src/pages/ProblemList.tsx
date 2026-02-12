import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { problemsApi } from '../services/apiClient';
import { ProblemMetadata } from '../types';

const ProblemList: React.FC = () => {
    const [problems, setProblems] = useState<ProblemMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadProblems();
    }, []);

    const loadProblems = async () => {
        try {
            const data = await problemsApi.getProblems();
            setProblems(data);
        } catch (error) {
            // Error handled silently
        } finally {
            setLoading(false);
        }
    };

    const handleProblemClick = (problemId: string) => {
        navigate(`/problems/${problemId}`);
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <span>Loading problems...</span>
            </div>
        );
    }

    return (
        <div className="problem-list-container">
            <h1 className="problem-list-header">Problems</h1>
            <div className="problem-table">
                <table>
                    <thead>
                        <tr>
                            <th className="col-status">Status</th>
                            <th>Title</th>
                            <th className="col-difficulty">Difficulty</th>
                            <th className="col-tags">Tags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {problems.map((problem) => (
                            <tr key={problem.id} onClick={() => handleProblemClick(problem.id)}>
                                <td></td>
                                <td className="problem-title">{problem.title}</td>
                                <td>
                                    <span className={`difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`}>
                                        {problem.difficulty}
                                    </span>
                                </td>
                                <td>
                                    {problem.tags.slice(0, 3).map((tag, index) => (
                                        <span key={index} className="tag">
                                            {tag}
                                        </span>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProblemList;
