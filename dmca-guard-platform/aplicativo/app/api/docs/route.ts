import { NextResponse } from 'next/server'
import { swaggerSpec } from '@/lib/swagger-config'

export const dynamic = 'force-dynamic'

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the OpenAPI/Swagger specification for the DMCA Guard Platform API
 *     tags:
 *       - Documentation
 *     responses:
 *       200:
 *         description: OpenAPI specification in JSON format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
  return NextResponse.json(swaggerSpec)
}