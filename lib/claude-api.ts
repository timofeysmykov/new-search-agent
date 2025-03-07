import Anthropic from '@anthropic-ai/sdk';

// Инициализация клиента Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export { anthropic };
export default anthropic;

export type ClaudeMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

/**
 * Функция для генерации ответа с использованием Claude 3.5 Haiku
 */
export async function generateClaudeResponse(
  messages: ClaudeMessage[],
  systemPrompt?: string
) {
  try {
    // Отделяем системное сообщение, так как оно не может быть в массиве messages
    // согласно API Anthropic
    const filteredMessages = messages.filter(msg => msg.role !== 'system');
    
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', max_tokens: 1024,
      system: systemPrompt || "Ты AI агент с доступом к поиску. Отвечай точно, кратко и по существу.",
      messages: filteredMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
    });

    return response;
  } catch (error) {
    console.error('Ошибка при запросе к Claude API:', error);
    throw error;
  }
}

/**
 * Функция для анализа поисковых результатов
 */
export async function analyzeSearchResults(searchResults: any, context: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', max_tokens: 1024,
      system: "Твоя задача - проанализировать результаты поиска и выделить наиболее важную информацию.",
      messages: [
        { 
          role: 'user', 
          content: `Контекст: ${context}\n\nРезультаты поиска: ${JSON.stringify(searchResults)}\n\nПроанализируй эти результаты и выдели ключевую информацию, относящуюся к контексту.` 
        }
      ],
    });

    // Проверка типа contentBlock и безопасный доступ к тексту
    if (response.content[0].type === 'text') {
      return response.content[0].text;
    }
    
    return "Не удалось получить текстовый ответ от API";
  } catch (error) {
    console.error('Ошибка при анализе результатов поиска:', error);
    throw error;
  }
}

/**
 * Функция для генерации плана действий
 */
export async function generatePlan(query: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', max_tokens: 1024,
      system: "Ты помощник, который анализирует запросы и составляет план действий для ответа на них.",
      messages: [
        { 
          role: 'user', 
          content: `Запрос пользователя: ${query}\n\nСоставь план действий для ответа на этот запрос. Если нужен поиск, укажи это явно.` 
        }
      ],
    });

    // Проверка типа contentBlock и безопасный доступ к тексту
    if (response.content[0].type !== 'text') {
      return { steps: [] };
    }

    // Парсинг плана из ответа
    const planText = response.content[0].text;
    const steps = planText.split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => {
        // Простая эвристика для определения необходимости поиска
        const needsSearch = line.toLowerCase().includes('поиск') || 
                           line.toLowerCase().includes('найти') ||
                           line.toLowerCase().includes('информац');
        
        return {
          description: line,
          needsSearch,
          query: needsSearch ? extractSearchQuery(line) : ''
        };
      });

    return { steps };
  } catch (error) {
    console.error('Ошибка при генерации плана:', error);
    throw error;
  }
}

/**
 * Вспомогательная функция для извлечения поискового запроса из шага плана
 */
function extractSearchQuery(stepText: string): string {
  // Простая эвристика - берем текст после "поиск" или "найти"
  const searchTerms = ['поиск', 'найти', 'информац'];
  
  for (const term of searchTerms) {
    const index = stepText.toLowerCase().indexOf(term);
    if (index !== -1) {
      return stepText.substring(index + term.length).trim().replace(/^[:\s]+/, '');
    }
  }
  
  return stepText; // Возвращаем весь текст шага, если не нашли ключевых слов
}

/**
 * Функция для генерации финального ответа
 */
export async function generateFinalResponse(context: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', max_tokens: 1024,
      system: "Составь информативный и полезный ответ на основе предоставленного контекста.",
      messages: [
        { 
          role: 'user', 
          content: `Контекст: ${context}\n\nСоставь финальный ответ для пользователя на основе этого контекста.` 
        }
      ],
    });

    // Проверка типа contentBlock и безопасный доступ к тексту
    if (response.content[0].type === 'text') {
      return response.content[0].text;
    }
    
    return "Не удалось получить текстовый ответ от API";
  } catch (error) {
    console.error('Ошибка при генерации финального ответа:', error);
    throw error;
  }
}
