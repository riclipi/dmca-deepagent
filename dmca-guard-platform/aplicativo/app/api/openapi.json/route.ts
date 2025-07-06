import { NextRequest, NextResponse } from 'next/server'
import { openApiDocument } from '@/lib/openapi/spec'

export async function GET(request: NextRequest) {
  return NextResponse.json(openApiDocument)
}