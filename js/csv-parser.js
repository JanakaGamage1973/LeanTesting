export function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const questions = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        if (values.length < 7) {
            errors.push({ row: i + 1, message: `Expected 7 columns, got ${values.length}` });
            continue;
        }

        const q = {
            question: values[0],
            optionA: values[1],
            optionB: values[2],
            optionC: values[3],
            optionD: values[4],
            correctAnswer: values[5].toUpperCase().trim(),
            difficulty: values[6].toLowerCase().trim()
        };

        const validation = validateQuestion(q, i + 1);
        if (validation) {
            errors.push(validation);
            continue;
        }

        questions.push(q);
    }

    return { questions, errors };
}

export function parseJSON(jsonText) {
    const data = JSON.parse(jsonText);
    if (!Array.isArray(data)) throw new Error('JSON must be an array of question objects');

    const questions = [];
    const errors = [];

    data.forEach((item, idx) => {
        const q = {
            question: item.question || item.Question || '',
            optionA: item.option_a || item.optionA || item.OptionA || '',
            optionB: item.option_b || item.optionB || item.OptionB || '',
            optionC: item.option_c || item.optionC || item.OptionC || '',
            optionD: item.option_d || item.optionD || item.OptionD || '',
            correctAnswer: (item.correct_answer || item.correctAnswer || item.CorrectAnswer || '').toUpperCase().trim(),
            difficulty: (item.difficulty || item.Difficulty || '').toLowerCase().trim()
        };

        const validation = validateQuestion(q, idx + 1);
        if (validation) {
            errors.push(validation);
            return;
        }

        questions.push(q);
    });

    return { questions, errors };
}

function validateQuestion(q, row) {
    if (!q.question) return { row, message: 'Missing question text' };
    if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) return { row, message: 'Missing one or more options' };
    if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) return { row, message: `Invalid correct answer "${q.correctAnswer}" (must be A, B, C, or D)` };
    if (!['easy', 'medium', 'hard'].includes(q.difficulty)) return { row, message: `Invalid difficulty "${q.difficulty}" (must be easy, medium, or hard)` };
    return null;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (line[i] === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += line[i];
        }
    }
    result.push(current.trim());
    return result;
}
