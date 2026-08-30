import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

const dbPath = path.join(process.cwd(), 'data', 'db.json')

async function readDb() {
  try {
    const text = await fs.readFile(dbPath, 'utf8')
    return JSON.parse(text)
  } catch {
    return { records: [] }
  }
}

export async function GET() {
  const data = await readDb()
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const body = await request.json()
  await fs.mkdir(path.dirname(dbPath), { recursive: true })
  await fs.writeFile(dbPath, JSON.stringify(body, null, 2), 'utf8')

  return NextResponse.json({ ok: true })
}
