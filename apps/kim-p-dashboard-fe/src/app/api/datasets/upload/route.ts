import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const response = await fetch('http://localhost:4000/datasets/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '업로드에 실패했습니다.');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error uploading dataset:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}
