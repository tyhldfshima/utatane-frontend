'use client'
// app/upload/page.tsx — 投稿ページ（作曲 / 作詞 / 歌唱の3タイプ対応）

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

// ── 型定義 ────────────────────────────────────────────────

type UploadType = 'melody' | 'lyrics' | 'performance' | null

const GENRES = ['ポップ','バラード','ロック','ジャズ','R&B','フォーク','クラシック','アニソン','ボカロ','その他']
const MOODS  = ['切ない','明るい','力強い','失恋','恋愛','友情','希望','ノスタルジー','神秘的']
const TEMPOS = ['スロー（〜80BPM）','ミディアム（80〜120BPM）','アップテンポ（120BPM〜）']
const KEYS   = ['C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab','A','A#/Bb','B']

// ── メインページ ──────────────────────────────────────────

export default function UploadPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [uploadType, setUploadType] = useState<UploadType>(null)

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">投稿にはログインが必要です</p>
        <button onClick={() => router.push('/login')}
          className="px-6 py-2.5 rounded-2xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700">
          ログイン
        </button>
      </div>
    )
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              s === step ? 'bg-purple-600 text-white' :
              s < step  ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-400'
            }`}>{s}</div>
            {s < 3 && <div className={`flex-1 h-px w-8 ${s < step ? 'bg-purple-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
        <span className="text-xs text-gray-400 ml-1">
          {step === 1 ? '種類を選ぶ' : step === 2 ? '内容を入力' : '確認・公開'}
        </span>
      </div>

      {step === 1 && (
        <StepOne onSelect={(t) => { setUploadType(t); setStep(2) }} />
      )}
      {step === 2 && uploadType === 'melody' && (
        <MelodyForm onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 2 && uploadType === 'lyrics' && (
        <LyricsForm onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 2 && uploadType === 'performance' && (
        <PerformanceForm onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <StepThree uploadType={uploadType} onBack={() => setStep(2)} onPublish={() => router.push('/')} />
      )}
    </main>
  )
}

// ── ステップ1：種類選択 ───────────────────────────────────

function StepOne({ onSelect }: { onSelect: (t: UploadType) => void }) {
  return (
    <div>
      <h1 className="text-xl font-medium text-gray-900 mb-2">何を投稿しますか？</h1>
      <p className="text-sm text-gray-400 mb-8">投稿タイプを選ぶと、専用フォームが表示されます</p>

      <div className="space-y-3">
        <TypeCard
          color="purple"
          icon="♪"
          title="作曲（メロディ）"
          desc="伴奏MP3を投稿して作詞家・ミュージシャンのコラボを募集する"
          tags={['MP3 / WAV', '楽譜は任意', 'コラボ募集']}
          onClick={() => onSelect('melody')}
        />
        <TypeCard
          color="teal"
          icon="✦"
          title="作詞（歌詞）"
          desc="歌詞テキストを投稿して作曲家・ミュージシャンのコラボを募集する"
          tags={['テキスト入力', 'タイトル必須', 'コラボ募集']}
          onClick={() => onSelect('lyrics')}
        />
        <TypeCard
          color="orange"
          icon="♬"
          title="歌唱（パフォーマンス）"
          desc="既存の曲×詞のバージョンをカラオケ感覚で歌って投稿する"
          tags={['音声 or 動画', '既存バージョンに紐付け', '即時公開・販売可']}
          onClick={() => onSelect('performance')}
        />
      </div>
    </div>
  )
}

function TypeCard({ color, icon, title, desc, tags, onClick }: {
  color: string; icon: string; title: string; desc: string; tags: string[]; onClick: () => void
}) {
  const bg = color === 'purple' ? 'hover:border-purple-300 hover:bg-purple-50' :
             color === 'teal'   ? 'hover:border-teal-300 hover:bg-teal-50' :
                                  'hover:border-orange-300 hover:bg-orange-50'
  const iconBg = color === 'purple' ? 'bg-purple-100 text-purple-700' :
                 color === 'teal'   ? 'bg-teal-100 text-teal-700' :
                                      'bg-orange-100 text-orange-700'
  return (
    <button onClick={onClick}
      className={`w-full text-left p-5 rounded-2xl border border-gray-100 transition-all ${bg} group`}>
      <div className="flex gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900 mb-1">{title}</p>
          <p className="text-sm text-gray-500 mb-3">{desc}</p>
          <div className="flex gap-2 flex-wrap">
            {tags.map((t) => (
              <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </div>
        <div className="self-center text-gray-300 group-hover:text-gray-500 text-lg">›</div>
      </div>
    </button>
  )
}

// ── ステップ2A：作曲フォーム ──────────────────────────────

function MelodyForm({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLInputElement>(null)
  const midiRef  = useRef<HTMLInputElement>(null)
  const [title, setTitle]         = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [bpm, setBpm]             = useState('')
  const [key, setKey]             = useState('')
  const [genres, setGenres]       = useState<string[]>([])
  const [openCollab, setOpenCollab] = useState(true)

  const toggleGenre = (g: string) =>
    setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 mb-6 hover:text-gray-600">
        ‹ もどる
      </button>
      <h2 className="text-lg font-medium text-gray-900 mb-6">作曲（メロディ）の投稿</h2>

      <div className="space-y-5">
        {/* 作業タイトル */}
        <Field label="作業タイトル" required>
          <input type="text" placeholder="例：春のバラード、無題#7" value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400" />
          <p className="text-xs text-gray-400 mt-1">バージョンの最終タイトルとは別。管理しやすい名前でOK。</p>
        </Field>

        {/* 伴奏MP3 */}
        <Field label="伴奏MP3 / WAV（カラオケ音源）" required>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-colors">
            {audioFile ? (
              <p className="text-sm font-medium text-purple-700">{audioFile.name}</p>
            ) : (
              <>
                <p className="text-2xl mb-2">♪</p>
                <p className="text-sm text-gray-500">クリックしてファイルを選択</p>
                <p className="text-xs text-gray-400 mt-1">MP3 / WAV・最大50MB・ボーカルなしの伴奏のみ</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".mp3,.wav" className="hidden"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
        </Field>

        {/* BPM / Key */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="BPM（任意）">
            <input type="number" placeholder="例：80" value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400" />
          </Field>
          <Field label="キー（任意）">
            <select value={key} onChange={(e) => setKey(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400 bg-white">
              <option value="">選択</option>
              {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
        </div>

        {/* ジャンル */}
        <Field label="ジャンル（任意・複数可）">
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button key={g} onClick={() => toggleGenre(g)} type="button"
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  genres.includes(g) ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{g}</button>
            ))}
          </div>
        </Field>

        {/* 楽譜 / MIDI */}
        <Field label="楽譜 / コード譜（任意）">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => sheetRef.current?.click()} type="button"
              className="px-4 py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-300 text-left">
              PDF・MusicXML
            </button>
            <button onClick={() => midiRef.current?.click()} type="button"
              className="px-4 py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-300 text-left">
              MIDIファイル
            </button>
          </div>
          <input ref={sheetRef} type="file" accept=".pdf,.xml,.mxl" className="hidden" />
          <input ref={midiRef}  type="file" accept=".mid,.midi"     className="hidden" />
          <p className="text-xs text-gray-400 mt-1">なくてもOK。あると作詞家・ミュージシャンが参加しやすくなる。</p>
        </Field>

        {/* コラボ募集 */}
        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-purple-900">作詞コラボを募集する</p>
            <p className="text-xs text-purple-600 mt-0.5">ONにすると作詞フィードに表示される</p>
          </div>
          <button onClick={() => setOpenCollab(!openCollab)} type="button"
            className={`w-12 h-6 rounded-full transition-colors relative ${openCollab ? 'bg-purple-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${openCollab ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <button onClick={onNext} disabled={!title || !audioFile}
          className="w-full py-3.5 rounded-2xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed">
          次へ → 確認画面
        </button>
      </div>
    </div>
  )
}

// ── ステップ2B：作詞フォーム ──────────────────────────────

const STRUCTURE_TAGS = ['[イントロ]','[Aメロ]','[Bメロ]','[サビ]','[Cメロ]','[アウトロ]','[ブリッジ]']

function LyricsForm({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [title, setTitle]       = useState('')
  const [lyrics, setLyrics]     = useState('')
  const [moods, setMoods]       = useState<string[]>([])
  const [tempo, setTempo]       = useState('')
  const [openCollab, setOpenCollab] = useState(true)

  const insertTag = (tag: string) => setLyrics((prev) => prev + (prev ? '\n' : '') + tag + '\n')
  const toggleMood = (m: string) =>
    setMoods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 mb-6 hover:text-gray-600">
        ‹ もどる
      </button>
      <h2 className="text-lg font-medium text-gray-900 mb-6">作詞（歌詞）の投稿</h2>

      <div className="space-y-5">
        {/* 詞のタイトル */}
        <Field label="詞のタイトル" required>
          <input type="text" placeholder="例：春の終わりに、さよならの前に" value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-400" />
          <p className="text-xs text-gray-400 mt-1">このタイトルがバージョンの正式タイトルになります。</p>
        </Field>

        {/* 歌詞 */}
        <Field label="歌詞" required>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {STRUCTURE_TAGS.map((tag) => (
              <button key={tag} onClick={() => insertTag(tag)} type="button"
                className="text-xs px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-mono">
                {tag}
              </button>
            ))}
          </div>
          <textarea
            placeholder={'[Aメロ]\n桜の花びらが〜\n\n[サビ]\n春の終わりに〜'}
            value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={10}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-400 resize-none font-mono leading-relaxed" />
          <p className="text-xs text-gray-400 mt-1">構造タグを入れると詳細画面での表示が見やすくなります。</p>
        </Field>

        {/* 雰囲気タグ */}
        <Field label="雰囲気（任意・複数可）">
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button key={m} onClick={() => toggleMood(m)} type="button"
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  moods.includes(m) ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{m}</button>
            ))}
          </div>
        </Field>

        {/* 希望テンポ */}
        <Field label="希望テンポ感（任意）">
          <div className="grid grid-cols-3 gap-2">
            {TEMPOS.map((t) => (
              <button key={t} onClick={() => setTempo(t)} type="button"
                className={`p-2.5 rounded-xl text-xs text-center transition-colors ${
                  tempo === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{t}</button>
            ))}
          </div>
        </Field>

        {/* コラボ募集 */}
        <div className="flex items-center justify-between p-4 bg-teal-50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-teal-900">作曲コラボを募集する</p>
            <p className="text-xs text-teal-600 mt-0.5">ONにすると作曲フィードに表示される</p>
          </div>
          <button onClick={() => setOpenCollab(!openCollab)} type="button"
            className={`w-12 h-6 rounded-full transition-colors relative ${openCollab ? 'bg-teal-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${openCollab ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <button onClick={onNext} disabled={!title || !lyrics}
          className="w-full py-3.5 rounded-2xl bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed">
          次へ → 確認画面
        </button>
      </div>
    </div>
  )
}

// ── ステップ2C：歌唱フォーム ──────────────────────────────

function PerformanceForm({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const audioRef = useRef<HTMLInputElement>(null)
  const [versionId, setVersionId]   = useState('')
  const [audioFile, setAudioFile]   = useState<File | null>(null)
  const [videoUrl, setVideoUrl]     = useState('')
  const [subtitle, setSubtitle]     = useState('')
  const [comment, setComment]       = useState('')
  const [price, setPrice]           = useState(1200)

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 mb-6 hover:text-gray-600">
        ‹ もどる
      </button>
      <h2 className="text-lg font-medium text-gray-900 mb-2">歌唱（パフォーマンス）の投稿</h2>
      <p className="text-sm text-gray-400 mb-6">カラオケ感覚で録音した音声を登録しましょう</p>

      <div className="space-y-5">
        {/* バージョン選択 */}
        <Field label="歌うバージョン（曲×詞）" required>
          <input type="text" placeholder="バージョンIDまたはタイトルで検索…" value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400" />
          <p className="text-xs text-gray-400 mt-1">フィードから「この曲を歌う」ボタンで自動入力されます。</p>
        </Field>

        {/* 音声ファイル */}
        <Field label="歌唱音声" required>
          <div onClick={() => audioRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-colors">
            {audioFile ? (
              <p className="text-sm font-medium text-orange-700">{audioFile.name}</p>
            ) : (
              <>
                <p className="text-2xl mb-2">♬</p>
                <p className="text-sm text-gray-500">録音した音声をアップロード</p>
                <p className="text-xs text-gray-400 mt-1">MP3 / WAV・最大100MB・伴奏込みのミックス推奨</p>
              </>
            )}
          </div>
          <input ref={audioRef} type="file" accept=".mp3,.wav" className="hidden"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
        </Field>

        {/* YouTube動画URL（Phase1） */}
        <Field label="YouTube動画URL（任意 / Phase1）">
          <input type="url" placeholder="https://youtube.com/watch?v=..." value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400" />
          <p className="text-xs text-gray-400 mt-1">歌唱動画があると投げ銭・購入が増えやすい。Phase2からアプリ内アップロード対応予定。</p>
        </Field>

        {/* サブタイトル */}
        <Field label="サブタイトル（任意）">
          <input type="text" placeholder="例：アコースティックver. / 男声キー転調" value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400" />
          <p className="text-xs text-gray-400 mt-1">なければ「〜[あなたの名前] ver.」が自動設定されます。</p>
        </Field>

        {/* ひとこと */}
        <Field label="ひとこと（任意）">
          <textarea placeholder="この詞に感動して歌わせてもらいました…" value={comment}
            onChange={(e) => setComment(e.target.value)} rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400 resize-none" />
        </Field>

        {/* 販売価格 */}
        <Field label="販売価格（ミュージシャンが設定）">
          <div className="flex gap-2 flex-wrap">
            {[300, 600, 1200, 2000, 5000].map((p) => (
              <button key={p} onClick={() => setPrice(p)} type="button"
                className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                  price === p ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>¥{p.toLocaleString()}</button>
            ))}
          </div>
          <input type="number" min={300} max={30000} value={price}
            onChange={(e) => setPrice(+e.target.value)}
            className="mt-2 w-36 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400" />
          <p className="text-xs text-gray-400 mt-1">¥300〜¥30,000 の範囲で自由設定。後から変更も可能。</p>
        </Field>

        <button onClick={onNext} disabled={!versionId || !audioFile}
          className="w-full py-3.5 rounded-2xl bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
          次へ → 確認画面
        </button>
      </div>
    </div>
  )
}

// ── ステップ3：確認・公開 ─────────────────────────────────

function StepThree({ uploadType, onBack, onPublish }: {
  uploadType: UploadType; onBack: () => void; onPublish: () => void
}) {
  const [publishing, setPublishing] = useState(false)
  const label = uploadType === 'melody' ? '作曲（メロディ）' :
                uploadType === 'lyrics' ? '作詞（歌詞）' : '歌唱（パフォーマンス）'
  const color = uploadType === 'melody' ? 'purple' :
                uploadType === 'lyrics' ? 'teal' : 'orange'
  const bg    = color === 'purple' ? 'bg-purple-600 hover:bg-purple-700' :
                color === 'teal'   ? 'bg-teal-600 hover:bg-teal-700' :
                                     'bg-orange-500 hover:bg-orange-600'

  const handlePublish = async () => {
    setPublishing(true)
    // TODO: 実際のAPIコール
    await new Promise((r) => setTimeout(r, 1500))
    onPublish()
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 mb-6 hover:text-gray-600">
        ‹ もどる
      </button>
      <h2 className="text-lg font-medium text-gray-900 mb-2">確認・公開</h2>
      <p className="text-sm text-gray-400 mb-6">内容を確認して公開しましょう</p>

      <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">投稿タイプ</span>
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">公開設定</span>
          <span className="font-medium text-green-600">即時公開</span>
        </div>
        {uploadType === 'performance' && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">収益分配</span>
            <span className="font-medium">作曲20% / 作詞20% / 演奏30% / 視聴者5% / PF25%</span>
          </div>
        )}
      </div>

      <div className="bg-amber-50 rounded-xl p-4 mb-6">
        <p className="text-sm text-amber-800">
          公開後、フォロワーに通知が届きます。購入・TYP送付が即座に可能になります。
        </p>
      </div>

      <button onClick={handlePublish} disabled={publishing}
        className={`w-full py-4 rounded-2xl text-white font-medium ${bg} disabled:opacity-70`}>
        {publishing ? '公開中…' : '公開する'}
      </button>
    </div>
  )
}

// ── 共通フィールドコンポーネント ──────────────────────────

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1 text-xs">必須</span>}
      </label>
      {children}
    </div>
  )
}
