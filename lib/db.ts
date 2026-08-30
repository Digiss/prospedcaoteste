// TODO: trocar este JSON local por Supabase/Postgres quando for necessário persistir entre dispositivos.
export type Status = 'nao_contatado' | 'contatado' | 'respondido' | 'fechado' | 'recusado'

export type CRMRecord = {
  id: string
  name: string
  url: string
  kind: 'canal' | 'video'
  status: Status
  email: string
  telegram: string
  notes: string
  color: string
  raw: boolean
  createdAt: string
  updatedAt: string
}

export type CRMDatabase = {
  records: CRMRecord[]
}

async function apiRequest<T>(method: 'GET' | 'PUT', body?: unknown): Promise<T> {
  const response = await fetch('/api/db', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Erro ao ler ou salvar o JSON do banco')
  }

  return (await response.json()) as T
}

export async function getDb(): Promise<CRMDatabase> {
  return apiRequest<CRMDatabase>('GET')
}

export async function saveDb(data: CRMDatabase): Promise<void> {
  await apiRequest<void>('PUT', data)
}
