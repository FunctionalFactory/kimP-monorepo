import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://localhost:4000/datasets', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json(
      { success: false, message: '데이터셋 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
