import React from 'react';
import { cn } from "@/lib/utils";

type SearchResultData = {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source?: string;
  }>;
};

export function SearchResults({ data }: { data: SearchResultData }) {
  // Обработка случая отсутствия данных
  if (!data || !data.query) {
    return <div className="rounded-md bg-yellow-50 p-4 my-3">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">Отсутствуют данные для отображения результатов поиска.</h3>
        </div>
      </div>
    </div>;
  }

  // Проверка наличия результатов
  const hasResults = data.results && data.results.length > 0;

  return (
    <div className={cn(
      "search-results rounded-lg p-4 my-3",
      "border border-gray-200 shadow-sm transition-all",
      hasResults ? "bg-white" : "bg-gray-50"
    )}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold">
          <span className="text-gray-500 mr-2">Поиск:</span>
          <span className="text-indigo-600">{data.query}</span>
        </h4>
        
        {hasResults && (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
            {data.results.length} результатов
          </span>
        )}
      </div>

      {!hasResults ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-gray-500">По вашему запросу ничего не найдено</p>
          <p className="text-sm text-gray-400 mt-1">Попробуйте изменить запрос или уточнить критерии поиска</p>
        </div>
      ) : (
        <ul className="space-y-4 mt-4">
          {data.results.map((result, i) => (
            <li 
              key={i} 
              className="border-b border-gray-100 pb-4 last:border-0 transition-all hover:bg-gray-50 rounded-md p-2"
            >
              <a 
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium block mb-1 hover:underline"
              >
                {result.title || "Без названия"}
              </a>
              
              <div className="flex items-center text-xs text-gray-500 mb-2">
                <span className="truncate max-w-[300px]">{result.url}</span>
                {result.source && (
                  <span className="ml-2 bg-gray-100 px-2 py-0.5 rounded">{result.source}</span>
                )}
              </div>
              
              <p className="text-sm text-gray-700">{result.snippet}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
