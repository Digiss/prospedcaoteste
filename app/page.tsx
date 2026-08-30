'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Download, ExternalLink, FileText, ListFilter as Filter, LayoutGrid, List, Mail, MoveHorizontal as MoreHorizontal, Plus, Search, Send, Trash2, Upload, Video } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Status = 'nao_contatado' | 'contatado' | 'respondeu' | 'fechado' | 'recusado'
type Kind = 'canal' | 'video' | 'busca'
type GroupColor = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul' | 'roxo' | 'rosa' | 'cinza'
type Origin = 'auto' | 'manual' | 'nao_encontrado' | 'conflito'
type Source = 'sobre' | 'video' | 'manual' | null
type Candidate = { id: string; value: string; source: Source; video_id?: string | null }
type VideoDesc = { id: string; video_id: string; description: string }

type Channel = {
  id: string
  canal_nome: string
  link_original: string
  links_relacionados: string[]
  tipo_link: Kind
  channel_id: string | null
  handle: string
  email: string
  email_origem: Origin
  telegram_grupo: string
  telegram_origem: Origin
  fonte_dado: Source
  status: Status
  data_contato: string | null
  observacoes: string
  cor_agrupamento: GroupColor | null
  raw: boolean
  origin: Origin
  emailCandidates: Candidate[]
  telegramCandidates: Candidate[]
  videoDescriptions: VideoDesc[]
}

type ChannelRow = {
  id: string
  canal_nome: string | null
  link_original: string
  links_relacionados: string[]
  tipo_link: Kind
  channel_id: string | null
  handle: string
  email: string | null
  email_origem: Origin
  telegram_grupo: string | null
  telegram_origem: Origin
  fonte_dado: Source
  status: Status
  data_contato: string | null
  observacoes: string | null
  cor_agrupamento: GroupColor | null
  raw: boolean
  origin: Origin
}

const statuses: { key: Status; label: string; tone: string }[] = [
  { key: 'nao_contatado', label: 'Não contatado', tone: 'bg-muted text-muted-foreground' },
  { key: 'contatado', label: 'Contatado', tone: 'bg-blue-500/15 text-blue-300' },
  { key: 'respondeu', label: 'Respondeu', tone: 'bg-emerald-500/15 text-emerald-300' },
  { key: 'fechado', label: 'Fechado', tone: 'bg-violet-500/15 text-violet-300' },
  { key: 'recusado', label: 'Recusado', tone: 'bg-red-500/15 text-red-300' },
]

const groupColors: GroupColor[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa', 'cinza']
const colorClass: Record<GroupColor, string> = {
  vermelho: 'bg-red-400', laranja: 'bg-orange-400', amarelo: 'bg-amber-400', verde: 'bg-emerald-400',
  azul: 'bg-blue-400', roxo: 'bg-violet-400', rosa: 'bg-pink-400', cinza: 'bg-slate-500',
}

function toChannel(r: ChannelRow, emails: Candidate[], telegrams: Candidate[], videos: VideoDesc[]): Channel {
  return {
    id: r.id,
    canal_nome: r.canal_nome ?? '',
    link_original: r.link_original,
    links_relacionados: r.links_relacionados ?? [],
    tipo_link: r.tipo_link,
    channel_id: r.channel_id,
    handle: r.handle ?? '',
    email: r.email ?? '',
    email_origem: r.email_origem,
    telegram_grupo: r.telegram_grupo ?? '',
    telegram_origem: r.telegram_origem,
    fonte_dado: r.fonte_dado,
    status: r.status,
    data_contato: r.data_contato,
    observacoes: r.observacoes ?? '',
    cor_agrupamento: r.cor_agrupamento,
    raw: r.raw,
    origin: r.origin,
    emailCandidates: emails,
    telegramCandidates: telegrams,
    videoDescriptions: videos,
  }
}

function toRow(c: Channel): ChannelRow {
  return {
    id: c.id,
    canal_nome: c.canal_nome || null,
    link_original: c.link_original,
    links_relacionados: c.links_relacionados,
    tipo_link: c.tipo_link,
    channel_id: c.channel_id,
    handle: c.handle,
    email: c.email || null,
    email_origem: c.email_origem,
    telegram_grupo: c.telegram_grupo || null,
    telegram_origem: c.telegram_origem,
    fonte_dado: c.fonte_dado,
    status: c.status,
    data_contato: c.data_contato,
    observacoes: c.observacoes || null,
    cor_agrupamento: c.cor_agrupamento,
    raw: c.raw,
    origin: c.origin,
  }
}

export default function Page() {
  const [items, setItems] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | 'todos'>('todos')
  const [kindFilter, setKindFilter] = useState<Kind | 'todos'>('todos')
  const [importText, setImportText] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; field: 'canal_nome' | 'email' | 'telegram_grupo' | 'observacoes' } | null>(null)
  const [conflict, setConflict] = useState<{ id: string; field: 'email' | 'telegram_grupo' } | null>(null)

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase.from('channels').select('*').order('criado_em', { ascending: false })
      if (error) { console.error(error); setLoading(false); return }
      const channelRows = rows as ChannelRow[]
      if (!channelRows.length) { setItems([]); setLoading(false); return }

      const ids = channelRows.map(r => r.id)
      const [emailsRes, telegramsRes, videosRes] = await Promise.all([
        supabase.from('email_candidates').select('*').in('channel_id', ids),
        supabase.from('telegram_candidates').select('*').in('channel_id', ids),
        supabase.from('video_descriptions').select('*').in('channel_id', ids),
      ])

      const emailsByChannel = new Map<string, Candidate[]>()
      for (const e of (emailsRes.data ?? []) as Array<{ id: string; channel_id: string; value: string; source: Source; video_id: string | null }>) {
        if (!emailsByChannel.has(e.channel_id)) emailsByChannel.set(e.channel_id, [])
        emailsByChannel.get(e.channel_id)!.push({ id: e.id, value: e.value, source: e.source, video_id: e.video_id })
      }
      const telegramsByChannel = new Map<string, Candidate[]>()
      for (const t of (telegramsRes.data ?? []) as Array<{ id: string; channel_id: string; value: string; source: Source; video_id: string | null }>) {
        if (!telegramsByChannel.has(t.channel_id)) telegramsByChannel.set(t.channel_id, [])
        telegramsByChannel.get(t.channel_id)!.push({ id: t.id, value: t.value, source: t.source, video_id: t.video_id })
      }
      const videosByChannel = new Map<string, VideoDesc[]>()
      for (const v of (videosRes.data ?? []) as Array<{ id: string; channel_id: string; video_id: string; description: string }>) {
        if (!videosByChannel.has(v.channel_id)) videosByChannel.set(v.channel_id, [])
        videosByChannel.get(v.channel_id)!.push({ id: v.id, video_id: v.video_id, description: v.description })
      }

      setItems(channelRows.map(r => toChannel(r, emailsByChannel.get(r.id) ?? [], telegramsByChannel.get(r.id) ?? [], videosByChannel.get(r.id) ?? [])))
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => items.filter(x => {
    const matchesQuery = !query || `${x.canal_nome} ${x.handle} ${x.email} ${x.link_original} ${x.links_relacionados.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'todos' || x.status === statusFilter
    const matchesKind = kindFilter === 'todos' || x.tipo_link === kindFilter
    return matchesQuery && matchesStatus && matchesKind
  }), [items, query, statusFilter, kindFilter])

  const update = useCallback((id: string, patch: Partial<Channel>) => {
    setItems(old => old.map(x => x.id === id ? { ...x, ...patch } : x))
    const current = items.find(x => x.id === id)
    if (!current) return
    const merged = { ...current, ...patch }
    supabase.from('channels').update(toRow(merged)).eq('id', id).then(({ error }) => { if (error) console.error(error) })
  }, [items])

  const changeStatus = (id: string, status: Status) => {
    const patch: Partial<Channel> = { status }
    if (status === 'contatado') patch.data_contato = new Date().toISOString().slice(0, 10)
    update(id, patch)
  }

  function importLinks() {
    const urls = importText.split(/\s+/).map(x => x.trim()).filter(x => x.startsWith('http') && x.includes('youtube.com'))
    const fresh: Channel[] = urls.filter(url => !items.some(x => x.link_original === url)).map((url, i) => {
      const channel = url.includes('/@') || url.includes('/channel/')
      return {
        id: `import-${Date.now()}-${i}`,
        canal_nome: channel ? url.split('/').pop() || 'Canal importado' : '',
        link_original: url,
        links_relacionados: [],
        tipo_link: channel ? 'canal' as Kind : url.includes('results') ? 'busca' as Kind : 'video' as Kind,
        channel_id: null,
        handle: channel ? `@${url.split('/@')[1] || ''}` : '',
        email: '', email_origem: 'nao_encontrado' as Origin,
        telegram_grupo: '', telegram_origem: 'nao_encontrado' as Origin,
        fonte_dado: null, status: 'nao_contatado' as Status, data_contato: null,
        observacoes: '', cor_agrupamento: null, raw: !channel, origin: 'auto' as const,
        emailCandidates: [], telegramCandidates: [], videoDescriptions: [],
      }
    })
    if (fresh.length) {
      setItems(old => [...fresh, ...old])
      supabase.from('channels').insert(fresh.map(toRow)).then(({ error }) => { if (error) console.error(error) })
    }
    setImportText(''); setImportOpen(false)
  }

  async function syncChildTables(channelId: string, channel: Channel) {
    await supabase.from('email_candidates').delete().eq('channel_id', channelId)
    await supabase.from('telegram_candidates').delete().eq('channel_id', channelId)
    await supabase.from('video_descriptions').delete().eq('channel_id', channelId)
    if (channel.emailCandidates.length) {
      await supabase.from('email_candidates').insert(channel.emailCandidates.map(c => ({ channel_id: channelId, value: c.value, source: c.source, video_id: c.video_id ?? null })))
    }
    if (channel.telegramCandidates.length) {
      await supabase.from('telegram_candidates').insert(channel.telegramCandidates.map(c => ({ channel_id: channelId, value: c.value, source: c.source, video_id: c.video_id ?? null })))
    }
    if (channel.videoDescriptions.length) {
      await supabase.from('video_descriptions').insert(channel.videoDescriptions.map(v => ({ channel_id: channelId, video_id: v.video_id, description: v.description })))
    }
  }

  function enrichFile(file: File) {
    file.text().then(async text => {
      let parsed: Array<Record<string, unknown>> = []
      try { parsed = JSON.parse(text) as Array<Record<string, unknown>> } catch {
        const lines = text.split(/\r?\n/).filter(Boolean)
        if (!lines.length) return
        const headers = lines[0].split(',').map(x => x.replaceAll('"', '').trim().toLowerCase())
        const rows = lines.slice(1).map(line => line.split(',').map(x => x.replace(/^"|"$/g, '').trim()))
        parsed = rows.map(values => {
          const obj: Record<string, unknown> = {}
          headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
          return obj
        })
      }

      const updated = items.map(item => mergeEnrichment(item, parsed.find(row => String(row.channel_id ?? '') === (item.channel_id ?? '') && item.channel_id) || parsed.find(row => String(row.link_original ?? '') === item.link_original) || {}))
      setItems(updated)
      for (const ch of updated) {
        await supabase.from('channels').upsert(toRow(ch), { onConflict: 'id' }).eq('id', ch.id)
        await syncChildTables(ch.id, ch)
      }
      setImportOpen(false)
    })
  }

  function mergeEnrichment(item: Channel, row: Record<string, unknown>): Channel {
    const list = (value: unknown) => Array.isArray(value) ? value.filter(Boolean).map(String) : String(value || '').split(/[|;\n]/).map(x => x.trim()).filter(Boolean)
    const emails = [...new Set([...list(row.email), ...list(row.email_encontrados_video)])]
    const telegrams = [...new Set([...list(row.telegram), ...list(row.telegram_encontrados_video)])]
    const manualEmail = item.email_origem === 'manual'
    const manualTelegram = item.telegram_origem === 'manual'
    const autoEmail = emails.length === 1 ? emails[0] : ''
    const autoTelegram = telegrams.length === 1 ? telegrams[0] : ''
    const rowChannelId = String(row.channel_id || '') || null
    return {
      ...item,
      canal_nome: item.origin === 'manual' ? item.canal_nome : String(row.canal_nome || item.canal_nome),
      channel_id: item.channel_id || rowChannelId,
      email: manualEmail ? item.email : autoEmail,
      telegram_grupo: manualTelegram ? item.telegram_grupo : autoTelegram,
      email_origem: manualEmail ? 'manual' : emails.length > 1 ? 'conflito' : emails.length ? 'auto' : 'nao_encontrado',
      telegram_origem: manualTelegram ? 'manual' : telegrams.length > 1 ? 'conflito' : telegrams.length ? 'auto' : 'nao_encontrado',
      fonte_dado: manualEmail || manualTelegram ? 'manual' : row.email ? 'sobre' : 'video',
      emailCandidates: emails.map((value, i) => ({ id: `ec-${item.id}-${i}`, value, source: (row.email ? 'sobre' : 'video') as Source, video_id: String(row.video_id || '') || null })),
      telegramCandidates: telegrams.map((value, i) => ({ id: `tc-${item.id}-${i}`, value, source: (row.telegram ? 'sobre' : 'video') as Source, video_id: String(row.video_id || '') || null })),
      videoDescriptions: row.video_id ? [...item.videoDescriptions, { id: `vd-${item.id}-${item.videoDescriptions.length}`, video_id: String(row.video_id), description: String(row.video_descricao_bruta || '') }] : item.videoDescriptions,
      raw: false, origin: item.origin === 'manual' ? 'manual' : 'auto',
    }
  }

  function exportFile(type: 'csv' | 'txt') {
    const headers = ['id', 'canal_nome', 'link_original', 'links_relacionados', 'tipo_link', 'channel_id', 'email', 'email_origem', 'telegram_grupo', 'telegram_origem', 'status', 'data_contato', 'observacoes', 'cor_agrupamento']
    const body = type === 'csv'
      ? [headers.join(','), ...items.map(x => [x.id, x.canal_nome, x.link_original, x.links_relacionados.join('|'), x.tipo_link, x.channel_id ?? '', x.email, x.email_origem, x.telegram_grupo, x.telegram_origem, x.status, x.data_contato ?? '', x.observacoes, x.cor_agrupamento ?? ''].map(v => `"${String(v).replaceAll('"', '""')}"`).join(','))].join('\n')
      : items.map(x => `${x.canal_nome || 'Sem nome'} | ${x.link_original} | ${x.email || 'email: não encontrado'} | ${x.telegram_grupo || 'telegram: não encontrado'} | status: ${x.status}`).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' })); a.download = `youtube-crm.${type}`; a.click()
  }

  function deleteChannel(id: string) {
    if (!confirm('Excluir este registro?')) return
    setItems(old => old.filter(y => y.id !== id))
    supabase.from('channels').delete().eq('id', id).then(({ error }) => { if (error) console.error(error) })
  }

  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card/70 px-6 py-4"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Video /></div><div><h1 className="font-semibold tracking-tight">Signal<span className="text-amber-400">/</span>CRM</h1><p className="text-xs text-muted-foreground">Prospecção de canais no YouTube</p></div></div><div className="flex items-center gap-2"><button onClick={() => setImportOpen(true)} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"><Upload data-icon="inline-start" /> Importar</button><button onClick={() => exportFile('csv')} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"><Download data-icon="inline-start" /> Exportar</button></div></div></header>
    <section className="mx-auto max-w-[1500px] px-6 py-6"><div className="mb-6 flex items-end justify-between"><div><p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-400">Central de prospecção</p><h2 className="text-2xl font-semibold tracking-tight">Canais em operação</h2></div><div className="flex rounded-lg border border-border bg-card p-1"><button onClick={() => setView('table')} className={`rounded-md px-3 py-1.5 text-sm ${view === 'table' ? 'bg-accent' : 'text-muted-foreground'}`}><List className="mr-2 inline size-4" />Tabela</button><button onClick={() => setView('kanban')} className={`rounded-md px-3 py-1.5 text-sm ${view === 'kanban' ? 'bg-accent' : 'text-muted-foreground'}`}><LayoutGrid className="mr-2 inline size-4" />Kanban</button></div></div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">{([['Total', items.length, FileText], ['Resolvidos', items.filter(x => !x.raw).length, Check], ['Contato completo', items.filter(x => x.email || x.telegram_grupo).length, Mail], ['Linhas cruas', items.filter(x => x.raw).length, FileText], ['Contatados', items.filter(x => x.status === 'contatado').length, Send]] as [string, number, typeof FileText][]).map(([label, value, Icon]) => <div key={String(label)} className="rounded-lg border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span>{<Icon className="size-4" />}</div><strong className="text-2xl font-semibold">{value}</strong></div>)}</div>
      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando canais...</p>}
      <div className="mb-4 flex flex-wrap items-center gap-3"><div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar canal, contato ou URL..." className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></div><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | 'todos')} className="rounded-md border border-border bg-card px-3 py-2 text-sm"><option value="todos">Todos os status</option>{statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select><select value={kindFilter} onChange={e => setKindFilter(e.target.value as Kind | 'todos')} className="rounded-md border border-border bg-card px-3 py-2 text-sm"><option value="todos">Todos os tipos</option><option value="canal">Canal</option><option value="video">Vídeo</option><option value="busca">Busca</option></select><span className="flex items-center gap-1 text-xs text-muted-foreground"><Filter className="size-3" /> {filtered.length} resultados</span></div>
      {view === 'table' ? <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground"><tr>{['Canal', 'Tipo / link', 'Contato', 'Telegram', 'Status', 'Data', 'Observações', 'Grupo', ''].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{filtered.map(x => <tr key={x.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20"><td className="relative px-4 py-3"><span className={`absolute inset-y-0 left-0 w-1 ${x.cor_agrupamento ? colorClass[x.cor_agrupamento] : 'bg-transparent'}`} /><div className="pl-2"><div className="font-medium">{x.canal_nome || 'Sem nome'}</div><div className="text-xs text-muted-foreground">{x.handle || x.id}</div></div></td><td className="px-4 py-3"><a className="flex max-w-44 items-center gap-1 truncate text-xs text-amber-300 hover:underline" href={x.link_original} target="_blank" rel="noreferrer">{x.raw && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">BRUTO</span>}{x.tipo_link}<ExternalLink className="size-3 shrink-0" /></a></td><td className="px-4 py-3"><div className="flex flex-col gap-1"><Inline id={x.id} field="email" value={x.email} editing={editing} setEditing={setEditing} update={update} placeholder="Adicionar email" /><ContactBadge item={x} field="email" onConflict={() => setConflict({ id: x.id, field: 'email' })} /></div></td><td className="px-4 py-3"><div className="flex flex-col gap-1"><Inline id={x.id} field="telegram_grupo" value={x.telegram_grupo} editing={editing} setEditing={setEditing} update={update} placeholder="Adicionar Telegram" /><ContactBadge item={x} field="telegram_grupo" onConflict={() => setConflict({ id: x.id, field: 'telegram_grupo' })} /></div></td><td className="px-4 py-3"><select value={x.status} onChange={e => changeStatus(x.id, e.target.value as Status)} className={`rounded-full border-0 px-2 py-1 text-xs ${statuses.find(s => s.key === x.status)?.tone}`} aria-label="Status">{statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{x.data_contato ?? ''}</td><td className="max-w-48 px-4 py-3"><Inline id={x.id} field="observacoes" value={x.observacoes} editing={editing} setEditing={setEditing} update={update} placeholder="Adicionar nota" /></td><td className="px-4 py-3"><div className="flex gap-1">{groupColors.map(c => <button key={c} aria-label={`Grupo ${c}`} onClick={() => update(x.id, { cor_agrupamento: c })} className={`size-3 rounded-full ${colorClass[c]} ${x.cor_agrupamento === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'opacity-35 hover:opacity-100'}`} />)}</div></td><td className="px-4 py-3"><button aria-label="Excluir canal" onClick={() => deleteChannel(x.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></td></tr>)}</tbody></table></div> : <div className="grid min-w-[1100px] grid-cols-5 gap-3 overflow-x-auto">{statuses.map(s => <section key={s.key} className="min-h-96 rounded-lg border border-border bg-card/60 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">{s.label}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{filtered.filter(x => x.status === s.key).length}</span></div><div className="flex flex-col gap-2">{filtered.filter(x => x.status === s.key).map(x => <article key={x.id} className="rounded-md border border-border bg-card p-3"><div className="mb-2 flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{x.canal_nome || 'Sem nome'}</p><p className="text-xs text-muted-foreground">{x.handle || x.tipo_link}</p></div><span className={`size-2 rounded-full ${x.cor_agrupamento ? colorClass[x.cor_agrupamento] : 'bg-slate-600'}`} /></div><p className="mb-3 truncate text-xs text-muted-foreground">{x.email || x.telegram_grupo || 'Sem contato'}</p><select value={x.status} onChange={e => changeStatus(x.id, e.target.value as Status)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" aria-label="Mover status">{statuses.map(z => <option key={z.key} value={z.key}>{z.label}</option>)}</select></article>)}</div></section>)}</div>}
    </section>
    {conflict && (() => { const item = items.find(x => x.id === conflict.id); const candidates = conflict.field === 'email' ? item?.emailCandidates : item?.telegramCandidates; return <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"><h2 className="font-semibold">Escolha o {conflict.field === 'email' ? 'email' : 'Telegram'}</h2><p className="mt-1 text-sm text-muted-foreground">Encontramos múltiplos valores automáticos.</p><div className="mt-4 flex flex-col gap-2">{candidates?.map(candidate => <button key={candidate.value} onClick={() => { update(conflict.id, { [conflict.field]: candidate.value, [`${conflict.field}_origem`]: 'manual', fonte_dado: 'manual' }); setConflict(null) }} className="rounded-md border border-border p-3 text-left text-sm hover:bg-accent">{candidate.value}<span className="block text-xs text-muted-foreground">{candidate.source === 'video' ? `auto · via vídeo ${candidate.video_id || ''}` : 'auto · via descrição do canal'}</span></button>)}</div><button onClick={() => setConflict(null)} className="mt-4 rounded-md px-3 py-2 text-sm hover:bg-accent">Cancelar</button></div></div> })()}
    {importOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Importar links brutos</h2><p className="text-sm text-muted-foreground">Cole uma URL por linha. A importação é aditiva.</p></div><button onClick={() => setImportOpen(false)} aria-label="Fechar"><MoreHorizontal /></button></div><input type="file" accept=".csv,.txt" onChange={e => e.target.files?.[0] && enrichFile(e.target.files[0])} className="mb-3 block w-full text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:text-foreground" /><textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="https://www.youtube.com/@seucanal" className="min-h-40 w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setImportOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">Cancelar</button><button onClick={importLinks} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="mr-2 inline size-4" />Adicionar links</button></div></div></div>}
  </main>
}

function ContactBadge({ item, field, onConflict }: { item: Channel; field: 'email' | 'telegram_grupo'; onConflict: () => void }) {
  const origin = field === 'email' ? item.email_origem : item.telegram_origem
  const source = item.fonte_dado === 'video' ? 'auto · via vídeo' : item.fonte_dado === 'sobre' ? 'auto · via canal' : item.fonte_dado === 'manual' ? 'manual' : ''
  if (origin === 'conflito') return <button onClick={onConflict} className="w-fit rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] text-orange-300">conflito</button>
  if (origin === 'nao_encontrado') return <span className="w-fit rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">não encontrado</span>
  return <span className="text-[10px] text-muted-foreground">{origin} · {source}</span>
}

function Inline({ id, field, value, editing, setEditing, update, placeholder }: { id: string; field: 'canal_nome' | 'email' | 'telegram_grupo' | 'observacoes'; value: string; editing: { id: string; field: string } | null; setEditing: (v: { id: string; field: 'canal_nome' | 'email' | 'telegram_grupo' | 'observacoes' } | null) => void; update: (id: string, patch: Partial<Channel>) => void; placeholder: string }) {
  const active = editing?.id === id && editing.field === field
  if (active) return <input autoFocus defaultValue={value} placeholder={placeholder} onBlur={e => { update(id, { [field]: e.target.value, origin: e.target.value ? 'manual' : 'nao_encontrado' }); setEditing(null) }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null) }} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
  return <button onClick={() => setEditing({ id, field })} className="max-w-40 truncate text-left text-xs text-muted-foreground hover:text-foreground">{value || placeholder}</button>
}
