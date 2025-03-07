import { NextRequest, NextResponse } from 'next/server';
import { perplexityClient } from '../../../lib/perplexity-api';

export const runtime = 'edge';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { query, focus } = await req.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Отсутствует поисковый запрос' },
        { status: 400 }
      );
    }
    
    const searchResults = await perplexityClient.search({
      query,
      focus: focus || 'technical',
      includeCitations: true
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
