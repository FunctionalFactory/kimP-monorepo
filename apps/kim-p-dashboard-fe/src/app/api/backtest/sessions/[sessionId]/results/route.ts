import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const response = await fetch(`http://localhost:4000/api/backtest/sessions/${sessionId}/results`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || '백테스팅 결과 조회에 실패했습니다.' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('백테스팅 결과 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: '백테스팅 결과 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
