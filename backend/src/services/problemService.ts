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

        // Read templates for all supported languages
        const templates: Record<string, string> = {};
        for (const lang of metadata.supportedLanguages) {
            const ext = lang === 'java' ? 'java' : 'py';
            const templatePath = path.join(problemDir, `template.${ext}`);
            try {
                templates[lang] = await fs.readFile(templatePath, 'utf-8');
            } catch (error) {
                console.error(`Template not found for ${lang}:`, error);
                // If template doesn't exist, use empty string
                templates[lang] = '';
            }
        }

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
            templates: templates as Record<'java' | 'python3', string>,
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
