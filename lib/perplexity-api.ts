// Реализация клиента для Perplexity API

/**
 * Тип для параметров поискового запроса
 */
export type PerplexitySearchParams = {
  query: string;
  temperature?: number;
  system?: string;
};

/**
 * Тип для результата поиска
 */
export type SearchResult = {
  title?: string;
  url?: string;
  snippet: string;
  source?: string;
};

/**
 * Класс для работы с Perplexity API
 */
export class Perplexity {
  private apiKey: string;
  private model: string;
  private baseUrl: string = 'https://api.perplexity.ai';

  constructor(config: {
    apiKey: string;
    model?: string;
  }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'sonar-pro';
  }

  /**
   * Метод для выполнения поискового запроса через chat/completions API
   */
  async search(params: PerplexitySearchParams): Promise<SearchResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          temperature: params.temperature || 0.7,
          messages: [
            {
              role: 'system',
              content: params.system || 'Найди актуальную информацию о запросе пользователя. Для каждого результата укажи заголовок, URL источника и основное содержание.'
            },
            {
              role: 'user',
              content: params.query
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API ошибка: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Извлекаем результаты из ответа API
      return this.extractSearchResults(data);

    } catch (error) {
      console.error('Ошибка при запросе к Perplexity API:', error);
      throw error;
    }
  }

  /**
   * Извлечение поисковых результатов из ответа API
   */
  private extractSearchResults(data: any): SearchResult[] {
    // Проверяем, что у нас есть ответ от API
    if (!data.choices || !data.choices[0]?.message?.content) {
      return [];
    }

    // Получаем текст ответа
    const responseText = data.choices[0].message.content;
    
    // Пытаемся найти ссылки и соответствующие им описания
    const results: SearchResult[] = [];

    // Простая эвристика для извлечения результатов
    const lines = responseText.split('\n');
    let currentResult: Partial<SearchResult> = { snippet: '' };
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Пропускаем пустые строки
      if (!trimmedLine) continue;
      
      // Проверяем, содержит ли строка URL
      const urlMatch = trimmedLine.match(/https?:\/\/[^\s)]+/g);
      if (urlMatch) {
        // Если у нас уже был начат результат, добавляем его в список
        if (currentResult.snippet) {
          results.push(currentResult as SearchResult);
        }
        
        // Начинаем новый результат
        currentResult = {
          url: urlMatch[0],
          snippet: trimmedLine.replace(urlMatch[0], '').trim()
        };
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || /^\d+\./.test(trimmedLine)) {
        // Если это маркированный список, считаем это новым результатом
        if (currentResult.snippet) {
          results.push(currentResult as SearchResult);
        }
        
        currentResult = { snippet: trimmedLine };
      } else {
        // Дополняем текущий результат
        currentResult.snippet += ' ' + trimmedLine;
      }
    }
    
    // Добавляем последний результат, если он существует
    if (currentResult.snippet) {
      results.push(currentResult as SearchResult);
    }
    
    // Если не удалось извлечь отдельные результаты, возвращаем весь ответ как один результат
    if (results.length === 0) {
      return [{ snippet: responseText }];
    }
    
    return results;
  }
}

/**
 * Создание экземпляра клиента Perplexity
 */
const perplexityClient = new Perplexity({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  model: 'sonar-pro'
});

export { perplexityClient };
export default perplexityClient;

/**
 * Функция для выполнения поиска
 */
async function search(query: string, system?: string) {
  try {
    return await perplexityClient.search({
      query,
      system: system || 'Ты поисковый агент. Найди актуальную информацию о запросе пользователя. Для ответа используй только факты из интернета.'
    });
  } catch (error) {
    console.error('Ошибка при поиске:', error);
    throw error;
  }
}

export { search };
