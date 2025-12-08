import * as prettier from 'prettier';

export interface FormatResult {
  success: boolean;
  formatted?: string;
  error?: string;
  note?: string;
}

const PRETTIER_SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'json',
  'css',
  'scss',
  'html',
  'markdown',
];

function getPrettierParser(language: string): string | null {
  const parserMap: Record<string, string> = {
    javascript: 'babel',
    typescript: 'typescript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    markdown: 'markdown',
  };
  return parserMap[language] || null;
}

export async function formatCode(code: string, language: string): Promise<FormatResult> {
  const normalizedLanguage = language.toLowerCase();

  if (PRETTIER_SUPPORTED_LANGUAGES.includes(normalizedLanguage)) {
    const parser = getPrettierParser(normalizedLanguage);
    if (!parser) {
      return {
        success: false,
        error: `No parser found for language: ${language}`,
      };
    }

    try {
      const formatted = await prettier.format(code, {
        parser,
        semi: true,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
        printWidth: 80,
        bracketSpacing: true,
        arrowParens: 'always',
      });
      return {
        success: true,
        formatted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown formatting error';
      return {
        success: false,
        error: `Formatting failed: ${errorMessage}`,
      };
    }
  }

  if (normalizedLanguage === 'python') {
    return {
      success: true,
      formatted: code,
      note: 'Python formatting requires external tools (e.g., Black, autopep8). Code returned as-is.',
    };
  }

  return {
    success: true,
    formatted: code,
    note: `Formatting not supported for ${language}. Code returned as-is.`,
  };
}

export function getSupportedLanguages(): string[] {
  return [...PRETTIER_SUPPORTED_LANGUAGES, 'python'];
}
