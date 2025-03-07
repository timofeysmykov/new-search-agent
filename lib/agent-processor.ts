import { generatePlan, analyzeSearchResults, generateFinalResponse } from './claude-api';
import { search } from './perplexity-api';

/**
 * Класс для обработки запросов пользователя и координации работы агента
 */
export class AgentProcessor {
  /**
   * Обработка сообщения пользователя
   */
  async handleMessage(message: string) {
    console.log('Обработка запроса:', message);
    
    // Генерация плана действий
    const plan = await generatePlan(message);
    console.log('Сгенерирован план:', plan);
    
    // Контекст для накопления информации
    let context = `Исходный запрос: ${message}\n\n`;
    
    // Выполнение шагов плана
    for (const step of plan.steps) {
      if (step.needsSearch) {
        console.log('Выполняем поиск для запроса:', step.query);
        
        // Выполнение поиска
        const results = await search(step.query);
        console.log('Получены результаты поиска:', results.length);
        
        // Анализ результатов поиска
        const analysisResult = await analyzeSearchResults(results, context);
        console.log('Анализ результатов завершен');
        
        // Добавление результатов анализа в контекст
        context += `\nРезультаты поиска по запросу "${step.query}":\n${analysisResult}\n\n`;
      } else {
        // Если поиск не нужен, просто добавляем шаг в контекст
        context += `\nШаг плана: ${step.description}\n`;
      }
    }
    
    // Генерация финального ответа на основе собранного контекста
    const finalResponse = await generateFinalResponse(context);
    console.log('Сгенерирован финальный ответ');
    
    return {
      response: finalResponse,
      context,
      plan
    };
  }
}

// Экспорт экземпляра процессора
export const agentProcessor = new AgentProcessor();
