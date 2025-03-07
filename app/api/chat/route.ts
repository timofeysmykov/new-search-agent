import { Message } from 'ai';
import anthropic from '@/lib/claude-api';
import agentProcessor from '@/lib/agent-processor';
import { search } from '@/lib/perplexity-api';

// Переменные окружения автоматически загружаются Next.js

// Конфигурация среды выполнения для Edge
export const runtime = 'edge';
export const maxDuration = 60; // Увеличиваем до 60 секунд, так как агент может делать несколько API-запросов

export async function POST(req: Request) {
  try {
    // Парсим запрос
    const { messages, system } = await req.json();
    
    // Получаем последнее сообщение пользователя
    const lastUserMessage = messages.filter(
      (m: Message) => m.role === 'user'
    ).pop();
    
    if (!lastUserMessage || !lastUserMessage.content) {
      return new Response('Сообщение пользователя отсутствует', { status: 400 });
    }
    
    // Проверяем наличие специальных команд для поиска
    const userQuery = lastUserMessage.content.toString();
    const isSearchQuery = userQuery.toLowerCase().includes('найди') || 
                         userQuery.toLowerCase().includes('поиск') ||
                         userQuery.toLowerCase().includes('узнай');
    
    // Обработка специального случая прямого поискового запроса
    if (isSearchQuery) {
      // Создаем поток для поискового запроса
      // Сохраняем результаты поиска для передачи в заголовках
      let searchResultsData: { query: string; results: unknown } | null = null;
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Индикатор загрузки в формате ai
            controller.enqueue("data: Выполняем поиск...\n\n");
            
            // Выполняем поиск
            const searchResults = await search(userQuery);
            
            // Сохраняем данные для заголовка
            searchResultsData = {
              query: userQuery,
              results: searchResults
            };
            
            // Используем Claude для ответа на основе результатов
            const response = await anthropic.messages.create({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1024,
              messages: [
                ...messages.slice(0, -1),
                {
                  role: 'user',
                  content: `Вот мой запрос: "${userQuery}"\n\nИ вот результаты поиска: ${JSON.stringify(searchResults)}\n\nПожалуйста, ответь на мой запрос на основе этих результатов. Будь краток и информативен. Ответ давай на русском языке.`,
                },
              ],
              system: system || 'Ты AI-помощник с доступом к поисковым результатам. Твоя задача - давать точные, полезные ответы на запросы пользователей на русском языке.',
            });
            
            // Получаем текст из ответа Claude
            if (response.content[0].type === 'text') {
              const claudeResponse = response.content[0].text;
              controller.enqueue(`data: ${claudeResponse.replace(/\n/g, '\ndata: ')}\n\n`);
            } else {
              controller.enqueue("data: Не удалось получить текстовый ответ от модели.\n\n");
            }
            
            // Завершаем поток
            controller.close();
          } catch (error) {
            console.error('Ошибка при поиске:', error);
            controller.enqueue("data: Произошла ошибка при выполнении поиска. Пожалуйста, попробуйте позже.\n\n");
            controller.close();
          }
        }
      });
      
      // Добавляем заголовки для результатов поиска, если они есть
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no'
      };
      
      if (searchResultsData) {
        headers['X-Search-Results'] = JSON.stringify(searchResultsData);
      }
      
      // Возвращаем Response в формате для AI streaming
      return new Response(stream, { 
        headers: {
          ...headers,
          'Content-Type': 'text/event-stream',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache, no-transform',
          'X-Content-Type-Options': 'nosniff',
        } 
      });
    }
    
    // Обработка обычного запроса через агент
    // Сохраняем данные поиска для заголовка, если агент решит запустить поиск
    let searchResultsData: { query: string; results: unknown } | null = null;
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Индикатор загрузки в формате ai
          controller.enqueue("data: Обрабатываю ваш запрос...\n\n");
          
          // Обрабатываем сообщение через агент
          const result = await agentProcessor.handleMessage(userQuery);
          
          // Проверяем наличие результатов поиска в результате работы агента
          // Используем типизацию для предполагаемых дополнительных полей
          const resultWithSearch = result as { response: string; searchResults?: unknown; searchQuery?: string };
          
          if (resultWithSearch.searchResults) {
            searchResultsData = {
              query: resultWithSearch.searchQuery || userQuery,
              results: resultWithSearch.searchResults
            };
          }
          
          // Получаем ответ от Claude напрямую
          const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            messages: [
              ...messages.slice(0, -1),
              { role: 'user', content: userQuery },
            ],
            system: system || 'Ты полезный AI-ассистент с доступом к внешней информации. Отвечай точно и лаконично на русском языке.',
          });
          
          // Получаем текст из ответа Claude и отправляем его
          if (response.content[0].type === 'text') {
            const claudeResponse = response.content[0].text;
            controller.enqueue(`data: ${(claudeResponse || result.response).replace(/\n/g, '\ndata: ')}\n\n`);
          } else {
            controller.enqueue(`data: ${(result.response || "Не удалось получить текстовый ответ от модели.").replace(/\n/g, '\ndata: ')}\n\n`);
          }
          
          // Завершаем поток
          controller.close();
        } catch (error) {
          console.error('Ошибка при обработке запроса:', error);
          controller.enqueue("data: Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.\n\n");
          controller.close();
        }
      }
    });
    
    // Добавляем заголовки для результатов поиска, если они есть
    const headers: Record<string, string> = {};
    
    if (searchResultsData) {
      headers['X-Search-Results'] = JSON.stringify(searchResultsData);
    }
    
    // Возвращаем Response в формате для AI streaming
    return new Response(stream, { 
      headers: {
        ...headers,
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      } 
    });
  } catch (err) {
    console.error('Ошибка в API роуте:', err);
    return new Response('Внутренняя ошибка сервера', { status: 500 });
  }
}
