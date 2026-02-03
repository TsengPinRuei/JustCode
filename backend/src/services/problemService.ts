import { promises as fs } from 'fs';
import * as path from 'path';
import { Problem, ProblemMetadata, Testcase } from '../types';

const PROBLEMS_DIR = path.join(process.cwd(), '..', 'problems');

export class ProblemService {
    async getAllProblems(): Promise<ProblemMetadata[]> {
        // For now, just return the sort-array problem
        const problem = await this.getProblem('sort-array');
        return [problem.metadata];
    }

    async getProblem(problemId: string): Promise<Problem> {
        const problemDir = path.join(PROBLEMS_DIR, problemId);

        // Read problem metadata
        const metadataPath = path.join(problemDir, 'problem.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata: ProblemMetadata = JSON.parse(metadataContent);

        // Read template
        const templatePath = path.join(problemDir, 'template.java');
        const template = await fs.readFile(templatePath, 'utf-8');

        // Read visible testcases
        const visiblePath = path.join(problemDir, 'testcases_visible.json');
        const visibleContent = await fs.readFile(visiblePath, 'utf-8');
        const visibleTestcases: Testcase[] = JSON.parse(visibleContent);

        // Read hidden testcases (for submit)
        let hiddenTestcases: Testcase[] = [];
        try {
            const hiddenPath = path.join(problemDir, 'testcases_hidden.json');
            const hiddenContent = await fs.readFile(hiddenPath, 'utf-8');
            hiddenTestcases = JSON.parse(hiddenContent);
        } catch (error) {
            // Hidden testcases are optional, continue without them
        }

        // Read editorial (optional)
        let editorial: string | undefined;
        try {
            const editorialPath = path.join(problemDir, 'editorial.md');
            editorial = await fs.readFile(editorialPath, 'utf-8');
        } catch (error) {
            // Editorial is optional, continue without it
        }

        return {
            metadata,
            template,
            visibleTestcases,
            hiddenTestcases,
            editorial,
        };
    }

    async getVisibleTestcases(problemId: string): Promise<Testcase[]> {
        const problem = await this.getProblem(problemId);
        return problem.visibleTestcases;
    }

    async getAllTestcases(problemId: string): Promise<Testcase[]> {
        const problem = await this.getProblem(problemId);
        return [...problem.visibleTestcases, ...(problem.hiddenTestcases || [])];
    }
}
