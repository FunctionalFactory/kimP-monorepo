import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      'http://localhost:4000/api/backtest/datasets',
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch datasets' },
      { status: 500 },
    );
  }
}
