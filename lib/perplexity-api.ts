// Простая реализация клиента для Perplexity API

/**
 * Тип для параметров поискового запроса
 */
export type PerplexitySearchParams = {
  query: string;
  focus?: 'technical' | 'general' | 'news' | 'writing';
  includeCitations?: boolean;
  sourceFilter?: 'reliable_sources_only' | 'all_sources';
};

/**
 * Тип для результата поиска
 */
export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
};

/**
 * Класс для работы с Perplexity API
 */
export class Perplexity {
  private apiKey: string;
  private model: string;
  private sourceFilter: string;
  private baseUrl: string = 'https://api.perplexity.ai';

  constructor(config: {
    apiKey: string;
    model?: string;
    sourceFilter?: string;
  }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'sonar-pro';
    this.sourceFilter = config.sourceFilter || 'reliable_sources_only';
  }

  /**
   * Метод для выполнения поискового запроса
   */
  async search(params: PerplexitySearchParams): Promise<SearchResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query: params.query,
          model: this.model,
          focus: params.focus || 'technical',
          source_filter: params.sourceFilter || this.sourceFilter,
          include_citations: params.includeCitations ?? true,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API ошибка: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Форматируем полученные результаты
      return this.formatResults(data);

    } catch (error) {
      console.error('Ошибка при запросе к Perplexity API:', error);
      throw error;
    }
  }

  /**
   * Форматирование сырых результатов API в удобный формат
   */
  private formatResults(rawData: any): SearchResult[] {
    // Если API ответ не содержит results, возвращаем пустой массив
    if (!rawData.results || !Array.isArray(rawData.results)) {
      return [];
    }

    // Преобразуем ответ API в формат SearchResult
    return rawData.results.map((result: any) => ({
      title: result.title || 'Без названия',
      url: result.url || '',
      snippet: result.snippet || result.content || '',
      source: result.source || ''
    }));
  }
}

/**
 * Создание экземпляра клиента Perplexity
 */
export const perplexityClient = new Perplexity({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  model: 'sonar-pro',
  sourceFilter: 'reliable_sources_only'
});

/**
 * Функция для выполнения поиска
 */
export async function search(query: string, focus: 'technical' | 'general' | 'news' | 'writing' = 'technical') {
  try {
    return await perplexityClient.search({
      query,
      focus,
      includeCitations: true
    });
  } catch (error) {
    console.error('Ошибка при поиске:', error);
    throw error;
  }
}
