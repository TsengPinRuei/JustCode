import { backupPractice, PROJECT_ROOT } from './services/practiceSchema';

backupPractice(PROJECT_ROOT).then(file => console.log(`Backup saved to ${file}`)).catch(error => {
    console.error('Backup failed:', error.message);
    process.exitCode = 1;
});
