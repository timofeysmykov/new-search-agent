"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { useChat } from "ai/react";
import { SearchResults } from "@/components/SearchResults";

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
    system: systemPrompt,
    tools,
  });

  // Хук для интеграции с Chat API
  const { messages, input, handleSubmit, handleInputChange, isLoading } = useChat({
    api: "/api/chat",
    initialMessages: [],
    system: systemPrompt,
    onResponse: (response) => {
      // Обработка ответа от API
      console.log("Получен ответ от API:", response);
    },
    onError: (error) => {
      console.error("Ошибка при запросе:", error);
    },
  });

  // Рендер UI с поддержкой генеративных компонентов
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh flex-col bg-gray-50">
        <header className="border-b border-gray-200 bg-white p-4">
          <h1 className="text-xl font-semibold text-gray-800">AI Ассистент с Claude 3.5 и Perplexity</h1>
        </header>
        
        <div className="grid flex-1 grid-cols-[240px_1fr] overflow-hidden">
          {/* Боковая панель с историей чатов */}
          <aside className="border-r border-gray-200 bg-white p-3 overflow-y-auto">
            <ThreadList />
          </aside>
          
          {/* Основная область чата */}
          <main className="flex flex-col overflow-hidden p-0">
            <Thread 
              renderToolCall={(toolCall) => {
                // Отображение результатов поиска через генеративный UI
                if (toolCall.name === 'search') {
                  return (
                    <SearchResults 
                      data={{
                        query: toolCall.arguments.query,
                        results: toolCall.result || []
                      }} 
                    />
                  );
                }
                return null;
              }}
            />
          </main>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
};
