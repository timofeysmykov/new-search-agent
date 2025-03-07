import { NextRequest, NextResponse } from 'next/server';
import { perplexityClient } from '../../../lib/perplexity-api';

export const runtime = 'edge';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { query, system, temperature } = await req.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Отсутствует поисковый запрос' },
        { status: 400 }
      );
    }
    
    const systemPrompt = system || 'Найди актуальную информацию о запросе пользователя. Для каждого результата укажи заголовок, URL источника и основное содержание.';
    
    const searchResults = await perplexityClient.search({
      query,
      system: systemPrompt,
      temperature: temperature || 0.7
    });
    
    return NextResponse.json({ results: searchResults });
  } catch (error) {
    console.error('Ошибка в API Perplexity:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
