import { promises as fs } from 'fs';
import * as path from 'path';
import { Problem, ProblemMetadata, Testcase } from '../types';

const PROBLEMS_DIR = path.join(process.cwd(), '..', 'problems');

export class ProblemService {
    async getAllProblems(): Promise<ProblemMetadata[]> {
        // Scan all subdirectories in the problems folder
        const entries = await fs.readdir(PROBLEMS_DIR, { withFileTypes: true });
        const problems: ProblemMetadata[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                try {
                    const problem = await this.getProblem(entry.name);
                    problems.push(problem.metadata);
                } catch (error) {
                    // Skip directories without valid problem.json
                    console.warn(`Skipping invalid problem directory: ${entry.name}`);
                }
            }
        }

        // Sort by title so numbering is in order
        problems.sort((a, b) => a.title.localeCompare(b.title));

        return problems;
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

    async saveProblem(problemId: string, data: {
        metadata: ProblemMetadata;
        templates: Record<string, string>;
        visibleTestcases: Testcase[];
    }): Promise<void> {
        const problemDir = path.join(PROBLEMS_DIR, problemId);
        await fs.mkdir(problemDir, { recursive: true });

        // Write problem.json
        await fs.writeFile(
            path.join(problemDir, 'problem.json'),
            JSON.stringify(data.metadata, null, 4),
            'utf-8'
        );

        // Write templates
        for (const [lang, template] of Object.entries(data.templates)) {
            const ext = lang === 'java' ? 'java' : 'py';
            await fs.writeFile(
                path.join(problemDir, `template.${ext}`),
                template,
                'utf-8'
            );
        }

        // Write visible testcases
        await fs.writeFile(
            path.join(problemDir, 'testcases_visible.json'),
            JSON.stringify(data.visibleTestcases, null, 4),
            'utf-8'
        );

        // Write empty hidden testcases
        await fs.writeFile(
            path.join(problemDir, 'testcases_hidden.json'),
            JSON.stringify([], null, 4),
            'utf-8'
        );
    }
}
