import React from 'react';
import { Language } from '../types';

interface LanguageSelectorProps {
    selectedLanguage: Language;
    supportedLanguages: Language[];
    onLanguageChange: (language: Language) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    selectedLanguage,
    supportedLanguages,
    onLanguageChange
}) => {
    const getLanguageLabel = (lang: Language): string => {
        return lang === 'java' ? 'Java' : 'Python3';
    };

    return (
        <div className="language-selector-container">
            <label htmlFor="language-select" className="language-label">
                Language:
            </label>
            <select
                id="language-select"
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value as Language)}
                className="language-selector"
            >
                {supportedLanguages.map(lang => (
                    <option key={lang} value={lang}>
                        {getLanguageLabel(lang)}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default LanguageSelector;
