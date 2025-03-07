"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { useState, useEffect } from "react";
import { SearchResults } from "@/components/SearchResults";
import { Message } from "ai";

// Определение инструментов для AI агента
const tools = {
  search: {
    description: "Поиск информации в интернете с помощью Perplexity",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Поисковый запрос"
        },
        focus: {
          type: "string",
          enum: ["technical", "general", "news", "writing"],
          description: "Фокус поиска (technical, general, news, writing)"
        }
      },
      required: ["query"]
    }
  }
};

// Тип для результата поиска, соответствует типу в компоненте SearchResults
type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
};

// Тип для сообщения с результатами поиска
interface SearchMessage extends Omit<Message, 'role'> {
  role: string;
  searchResults?: {
    query: string;
    results: SearchResult[];
  };
}

// Системный промпт для модели
const systemPrompt = `Ты полезный AI-ассистент с доступом к поиску Perplexity. 
Ты можешь отвечать на вопросы пользователя, используя свои знания или выполняя поиск информации онлайн.
Отвечай на русском языке, кратко и точно.

Если пользователь просит найти информацию или ты не знаешь ответа, используй инструмент поиска.
Всегда цитируй источники информации, если используешь поиск.`;

// Компонент AI ассистента с интеграцией Claude и Perplexity
export const Assistant = () => {
  // Инициализация чат-рантайма с настройками API
  const runtime = useChatRuntime({
    api: "/api/chat",
    initialMessages: [{ role: 'system', content: systemPrompt }],
    // tools не является частью API UseChatRuntimeOptions
    // используем body вместо этого
    body: {
      tools
    }
  });

  // Реализация своего обработчика потоковых данных
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [localInput, setLocalInput] = useState("");
  const [localIsLoading, setLocalIsLoading] = useState(false);

  // Функция для отправки запроса вручную
  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;

    // Добавляем сообщение пользователя
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: localInput
    };

    setLocalMessages((prev) => [...prev, userMessage]);
    setLocalIsLoading(true);
    
    try {
      // Подготавливаем данные для запроса
      const payload = {
        messages: [...localMessages, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      };

      // Отправляем запрос
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.body) {
        throw new Error('Получен пустой ответ');
      }

      // Создаем сообщение для ответа ассистента
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: ''
      };

      // Добавляем пустое сообщение ассистента, которое будем заполнять
      setLocalMessages((prev) => [...prev, assistantMessage]);

      // Обрабатываем потоковые данные
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialData = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        // Декодируем новый фрагмент данных и добавляем к оставшимся данным
        const chunk = decoder.decode(value, { stream: true });
        partialData += chunk;
        
        // Обрабатываем строки, начинающиеся с 'data: '
        const lines = partialData.split('\n');
        let remainingData = '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim() !== '') {
              // Обновляем последнее сообщение ассистента с новым контентом
              setLocalMessages((prev) => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = lastMessage.content 
                    ? `${lastMessage.content}\n${data}` 
                    : data;
                }
                return updatedMessages;
              });
            }
          } else {
            // Если строка не начинается с 'data: ', сохраняем ее для следующей итерации
            remainingData += line + '\n';
          }
        }
        
        // Сохраняем неполные данные для следующей итерации
        partialData = remainingData;
      }
      
      // Обрабатываем оставшиеся данные после завершения потока
      if (partialData.trim()) {
        const lines = partialData.split('\n');
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim() !== '') {
              setLocalMessages((prev) => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = lastMessage.content 
                    ? `${lastMessage.content}\n${data}` 
                    : data;
                }
                return updatedMessages;
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке запроса:', error);
      
      // Добавляем сообщение об ошибке
      setLocalMessages((prev) => [
        ...prev, 
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз.'
        }
      ]);
    } finally {
      setLocalIsLoading(false);
      setLocalInput("");
    }
  };

  const handleLocalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalInput(e.target.value);
  };
  
  // Инициализация сообщений при первой загрузке
  useEffect(() => {
    setLocalMessages([]);
  }, []);

  // Рендер UI с поддержкой генеративных компонентов
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh flex-col bg-gray-50">
        <header className="border-b border-gray-200 bg-white p-4">
          <h1 className="text-xl font-semibold text-gray-800">AI Search Agent</h1>
        </header>
        
        <div className="grid flex-1 grid-cols-[240px_1fr] overflow-hidden">
          {/* Боковая панель с историей чатов */}
          <aside className="border-r border-gray-200 bg-white p-3 overflow-y-auto">
            <ThreadList />
          </aside>
          
          {/* Основная область чата */}
          <main className="flex flex-col overflow-hidden p-0">
            {/* Заменяем компонент Thread на более простую реализацию */}
            <div className="flex-1 overflow-y-auto p-4">
              {localMessages.map((message) => {
                // Проверяем, есть ли у сообщения результаты поиска
                const messageWithSearch = message as unknown as SearchMessage;
                
                if (messageWithSearch.searchResults) {
                  return (
                    <div key={message.id} className="mt-4 mb-4">
                      <SearchResults 
                        data={{
                          query: messageWithSearch.searchResults.query,
                          results: messageWithSearch.searchResults.results || []
                        }} 
                      />
                    </div>
                  );
                }
                
                // Обычное сообщение
                return (
                  <div key={message.id} className={`p-3 rounded-lg mb-4 max-w-3xl ${message.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'}`}>
                    <div className="font-semibold mb-1">{message.role === 'user' ? 'Вы' : 'AI Ассистент'}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                  </div>
                );
              })}
              
              {/* Индикатор загрузки */}
              {localIsLoading && (
                <div className="p-3 rounded-lg mb-4 bg-gray-100 max-w-3xl">
                  <div className="font-semibold mb-1">AI Ассистент</div>
                  <div>Обрабатываю ваш запрос...</div>
                </div>
              )}
            </div>
            
            {/* Форма ввода */}
            <div className="border-t border-gray-200 p-4">
              <form onSubmit={handleLocalSubmit} className="flex space-x-2">
                <input
                  className="flex-1 p-2 border border-gray-300 rounded"
                  value={localInput}
                  onChange={handleLocalInputChange}
                  placeholder="Введите сообщение..."
                  disabled={localIsLoading}
                />
                <button 
                  type="submit" 
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                  disabled={localIsLoading}
                >
                  Отправить
                </button>
              </form>
            </div>
          </main>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
};
