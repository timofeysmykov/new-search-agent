import { StreamingTextResponse, Message, createStreamableUI } from 'ai';
import { anthropic } from '../../lib/claude-api';
import { agentProcessor } from '../../lib/agent-processor';
import { search } from '../../lib/perplexity-api';

// Убедимся, что переменные окружения загружены
import 'dotenv/config';

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
    
    // Создаем стрим для ответа
    const { stream, handlers } = createStreamableUI();
    
    // Обработка специального случая прямого поискового запроса
    if (isSearchQuery) {
      // Выполняем прямой поиск
      handlers.done(); // Завершаем стриминг метаданных
      
      try {
        // Индикатор загрузки
        handlers.update(<div>Выполняем поиск...</div>);
        
        // Выполняем поиск
        const searchResults = await search(userQuery);
        
        // Отображаем результаты
        handlers.update(
          <div>
            <h4>Результаты поиска по запросу: {userQuery}</h4>
            <ul>
              {searchResults.map((result, index) => (
                <li key={index}>
                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                    {result.title}
                  </a>
                  <p>{result.snippet}</p>
                </li>
              ))}
            </ul>
          </div>
        );
        
        // Используем Claude для ответа на основе результатов
        const response = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20240307',
          max_tokens: 1024,
          messages: [
            ...messages.slice(0, -1),
            {
              role: 'user',
              content: `Вот мой запрос: "${userQuery}"

И вот результаты поиска: ${JSON.stringify(searchResults)}

Пожалуйста, ответь на мой запрос на основе этих результатов. Будь краток и информативен. Ответ давай на русском языке.`,
            },
          ],
          system: system || 'Ты AI-помощник с доступом к поисковым результатам. Твоя задача - давать точные, полезные ответы на запросы пользователей на русском языке.',
        });
        
        // Получаем текст из ответа Claude
        const claudeResponse = response.content[0].text;
        
        // Возвращаем стриминговый ответ
        return new StreamingTextResponse(stream, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      } catch (searchError) {
        console.error('Ошибка при поиске:', searchError);
        handlers.update(
          <div className="error">
            Произошла ошибка при выполнении поиска. Пожалуйста, попробуйте позже.
          </div>
        );
        return new StreamingTextResponse(stream, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }
    
    // Обработка обычного запроса через агент
    try {
      // Индикатор загрузки
      handlers.update(<div>Обрабатываю ваш запрос...</div>);
      
      // Обрабатываем сообщение через агент
      const result = await agentProcessor.handleMessage(userQuery);
      
      // Получаем ответ от Claude напрямую
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20240307',
        max_tokens: 1024,
        messages: [
          ...messages.slice(0, -1),
          { role: 'user', content: userQuery },
        ],
        system: system || 'Ты полезный AI-ассистент с доступом к внешней информации. Отвечай точно и лаконично на русском языке.',
      });
      
      // Получаем текст из ответа Claude
      const claudeResponse = response.content[0].text;
      
      // Обновляем UI компонент с полученным ответом
      handlers.update(
        <div dangerouslySetInnerHTML={{ __html: claudeResponse || result.response }} />
      );

      // Отправляем ответ
      return new StreamingTextResponse(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (error) {
      console.error('Ошибка при обработке запроса:', error);
      
      // Обрабатываем ошибку и возвращаем понятное сообщение
      handlers.update(
        <div className="error">
          Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.
        </div>
      );
      
      return new StreamingTextResponse(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  } catch (err) {
    console.error('Ошибка в API роуте:', err);
    return new Response('Внутренняя ошибка сервера', { status: 500 });
  }
}
