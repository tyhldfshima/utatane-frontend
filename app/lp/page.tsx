'use client'
// app/lp/page.tsx — ランディングページ

import { useEffect, useRef, useState, FormEvent } from 'react'
import './lp.css'

// ── ロゴSVG ───────────────────────────────────────────────────
function LogoSVG({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" width={size} height={size}>
      <circle cx="20" cy="20" r="20" fill="#1B3A2D"/>
      <ellipse cx="20" cy="30" rx="7" ry="5" fill="#2D5A45" opacity=".9"/>
      <path d="M20 23 Q20 13 20 8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M20 18 Q15 15 12 17 Q15 21 20 18Z" fill="white" opacity=".85"/>
      <path d="M20 14 Q25 11 28 13 Q25 17 20 14Z" fill="white" opacity=".75"/>
      <circle cx="10" cy="10" r="1.5" fill="#5DA67E" opacity=".5"/>
      <circle cx="30" cy="8" r="1" fill="#5DA67E" opacity=".4"/>
      <circle cx="33" cy="18" r="1.2" fill="#5DA67E" opacity=".3"/>
    </svg>
  )
}

function HeroMark() {
  return (
    <svg viewBox="0 0 120 120" fill="none" width={120} height={120}>
      {/* 土（種床） */}
      <ellipse cx="60" cy="98" rx="22" ry="12" fill="#2D5A45" opacity=".7"/>
      {/* 種 */}
      <ellipse cx="60" cy="92" rx="6" ry="8" fill="#C47B2B" opacity=".6"/>
      {/* 茎 */}
      <path d="M60 85 Q60 50 60 24" stroke="#5DA67E" strokeWidth="3" strokeLinecap="round"/>
      {/* 左の葉 */}
      <path d="M60 55 Q45 45 36 50 Q45 60 60 55Z" fill="#5DA67E" opacity=".85"/>
      {/* 右の葉 */}
      <path d="M60 38 Q75 28 84 34 Q75 44 60 38Z" fill="#5DA67E" opacity=".7"/>
      {/* 先端の新芽 */}
      <path d="M60 24 Q55 18 58 12 Q60 16 62 12 Q65 18 60 24Z" fill="#E8A83E" opacity=".8"/>
      {/* 飾り粒子 */}
      <circle cx="24" cy="28" r="3" fill="#E8A83E" opacity=".45"/>
      <circle cx="96" cy="22" r="2.5" fill="#E8A83E" opacity=".35"/>
      <circle cx="102" cy="52" r="3" fill="#5DA67E" opacity=".25"/>
      <circle cx="18" cy="64" r="2.5" fill="#5DA67E" opacity=".25"/>
    </svg>
  )
}

// ── スクロールアニメフック ─────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const targets = el.querySelectorAll('.lp-reveal')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const siblings = e.target.parentElement?.querySelectorAll('.lp-reveal')
          siblings?.forEach((sib, i) => {
            setTimeout(() => sib.classList.add('visible'), i * 80)
          })
        }
      })
    }, { threshold: 0.1 })
    targets.forEach(t => observer.observe(t))
    return () => observer.disconnect()
  }, [])
  return ref
}

// ── ペルソナデータ ─────────────────────────────────────────────
const PERSONAS = [
  {
    emoji: '🎼', role: 'COMPOSER — 作曲家',
    title: <>曲を作れば、<br/>世界が育てる。</>,
    story: '売れていない作曲家も、伴奏をアップするだけ。世界中の作詞家がバースを書き、ミュージシャンが歌い、バージョンが増えるたびに収益が入り続ける。',
    flow: ['伴奏アップ', '世界中の詞', '無限バージョン'],
    end: '収益複利',
  },
  {
    emoji: '✍️', role: 'LYRICIST — 作詞家',
    title: <>詞を書けば、<br/>誰かが曲をつける。</>,
    story: '音楽スキルがなくても詞は書ける。詞が「刺さる」と評判になれば、作曲家が次々と曲をつけに来る。',
    flow: ['詞をアップ', '作曲家が応える', 'SNSで広まる'],
    end: '全バージョン収益',
  },
  {
    emoji: '🎤', role: 'MUSICIAN — ミュージシャン',
    title: <>歌うたびに、<br/>根が張る。</>,
    story: '演奏を投稿するだけで、購入・TYPの30%を受け取り続ける。YouTubeにバズれば、ウタタネへの流入が生まれ収益が自動分配される。',
    flow: ['演奏投稿', 'YouTube拡散', '収益自動分配'],
    end: 'スカウト',
  },
  {
    emoji: '🎵', role: 'LISTENER — リスナー・一般人',
    title: <>鼻歌から、<br/>プロへの扉がある。</>,
    story: '聴くだけでいい。カラオケモードで気軽に歌っていい。TYPを贈って「ありがとう」を届けることもできる。',
    flow: ['カラオケ', '投稿してみる', 'バズる'],
    end: '人生が動く',
  },
]

const TYP_CARDS = [
  { icon: '💝', bg: '#FAEEDA', title: '感謝を届ける', text: '素敵な曲、詞、歌への「ありがとう」を、TYPとして直接クリエイターに贈ることができます。メッセージと一緒に届くから、クリエイターの心に響く。' },
  { icon: '💰', bg: '#E1F5EE', title: 'クリエイターを直接支援する', text: 'TYPを受け取ったクリエイターは、それを現金に換えることができます。あなたの感謝が、クリエイターの音楽活動を支える糧になります。' },
  { icon: '🎧', bg: '#EEEDFE', title: '聴くだけで応援になる', text: '無料で聴くだけでも、動画広告収益の一部がクリエイターに届きます。もっと深く応援したければ、サブスクや1曲購入でさらに直接支援できます。' },
]

const PHASES = [
  {
    num: 'PHASE 01', tag: 'NOW', tagClass: 'tag-now',
    title: 'コアループの確立',
    items: ['作曲・作詞・演奏アップロード','バージョン作成・収益分配','TYPウォレット・送付・換金','フォロー・通知・カラオケモード','Stripe決済・サブスクリプション','YouTube動画リンク連携'],
  },
  {
    num: 'PHASE 02', tag: 'NEXT', tagClass: 'tag-next',
    title: '発見とバズの設計',
    items: ['才能スコア・週間ランキング','検索・コラボ募集ボード','SNSシェア用リンク・流入追跡','スカウトDM機能','法人ダッシュボード（B2B）','購入者限定コンテンツ'],
  },
  {
    num: 'PHASE 03', tag: 'FUTURE', tagClass: 'tag-future',
    title: 'NFTと Web3 統合',
    items: ['ハッシュチェーンDB → IPFS','Layer2（Polygon）NFTミント','NFT転売ロイヤリティ自動分配','バージョンNFT（EIP-2981）','グローバル展開（多言語対応）'],
  },
]

const REV_SEGMENTS = [
  { flex: .2, bg: '#534AB7', label: '作曲 20%' },
  { flex: .2, bg: '#1D9E75', label: '作詞 20%' },
  { flex: .3, bg: '#D85A30', label: '演奏 30%' },
  { flex: .05, bg: '#E8A83E', label: '視聴 5%', small: true },
  { flex: .25, bg: '#6B6358', label: 'PF 25%' },
]

const REV_LEGEND = [
  { pct: '20%', color: '#534AB7', role: '作曲家' },
  { pct: '20%', color: '#1D9E75', role: '作詞家' },
  { pct: '30%', color: '#D85A30', role: 'ミュージシャン' },
  { pct: '5%',  color: '#E8A83E', role: '視聴者（CB）' },
  { pct: '25%', color: '#6B6358', role: 'プラットフォーム' },
]

// ── メインコンポーネント ───────────────────────────────────────
export default function LPPage() {
  const wrapRef = useReveal()
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div ref={wrapRef} style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* ナビ */}
      <nav className="lp-nav">
        <div className="nav-logo">
          <LogoSVG />
          <span className="nav-logo-text">ウタタネ</span>
        </div>
        <div className="nav-links">
          <a href="#problem">課題</a>
          <a href="#solution">仕組み</a>
          <a href="#personas">誰のために</a>
          <a href="#revenue">収益</a>
          <a href="#phases">フェーズ</a>
        </div>
        <a href="/login" className="nav-cta">無料で参加する</a>
      </nav>

      {/* ヒーロー */}
      <section id="hero" className="lp-hero">
        <div className="hero-orb orb1" />
        <div className="hero-orb orb2" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            COMING SOON — utatane.music
          </div>
          <div className="hero-mark"><HeroMark /></div>
          <h1 className="hero-title">一粒の歌が、<em>森になる。</em></h1>
          <p className="hero-en">UTATANE — Music Collaboration Platform</p>
          <p className="hero-sub">
            作曲家・作詞家・ミュージシャン・一般人。<br/>
            誰でも種を蒔ける。市場が才能を選ぶ。<br/>
            ウタタネで生まれた作品が外へ広がり、関わった全員に収益が届く。
          </p>
          <div className="hero-actions">
            <a href="#cta" className="btn-primary">無料で参加する</a>
            <a href="#solution" className="btn-ghost">仕組みを見る</a>
          </div>
        </div>
        <div className="hero-scroll">
          <span>SCROLL</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* 問題提起 */}
      <section id="problem" className="lp-problem">
        <div className="lp-container">
          <span className="section-label lp-reveal">— THE PROBLEM</span>
          <h2 className="section-title lp-reveal">才能はある。届く場所が、ない。</h2>
          <p className="lp-reveal" style={{ fontSize: '.95rem', color: 'var(--muted)', maxWidth: 580, lineHeight: 1.85 }}>
            YouTubeでバズっても作曲家・作詞家には何も入らない。<br/>
            カラオケで歌っても収益はJOYSOUNDへ。<br/>
            TVオーディションは審査員が選ぶ。
          </p>
          <div className="problem-grid">
            {[
              { icon: '🎬', platform: 'YOUTUBE / SNS', title: 'バズっても作者に届かない', text: 'ミュージシャンがカバー動画で1,000万再生されても、作曲家・作詞家には著作権料以外何も入らない。' },
              { icon: '🎤', platform: 'KARAOKE', title: '歌っても収益はプラットフォームへ', text: 'JOYSOUND・DAMに年間数千億円が流れる。歌った人も、作った人も、その恩恵を受けられない。' },
              { icon: '📺', platform: 'TV / AUDITION', title: '審査員が才能を選ぶ', text: 'オーディション番組は年数回。選ばれるのはほんの一握り。眠った才能のほとんどは発掘されないまま。' },
            ].map((c) => (
              <div key={c.platform} className="problem-card lp-reveal">
                <div className="problem-icon">{c.icon}</div>
                <div className="problem-platform">{c.platform}</div>
                <div className="problem-title">{c.title}</div>
                <div className="problem-text">{c.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ソリューション */}
      <section id="solution" className="lp-solution">
        <div className="lp-container">
          <span className="section-label lp-reveal">— THE SOLUTION</span>
          <h2 className="section-title lp-reveal">市場が才能を選ぶ、<br/>収益が全員に届く。</h2>
          <p className="solution-lead lp-reveal">
            ウタタネは<strong>作曲・作詞・演奏・視聴</strong>を繋ぐ音楽コラボレーションプラットフォーム。<br/>
            1曲がバズれば、その曲に関わった全員に自動で収益が分配される。
          </p>

          <div className="tree-visual lp-reveal">
            <div className="tree-row">
              <div className="tree-dot root" />
              <div className="tree-label">
                詞「春の終わりに」<span className="tree-badge badge-lyric">作詞家 A</span>
                <span className="tree-badge badge-rev">作詞：20%/バージョン</span>
              </div>
            </div>
            <div className="tree-line" style={{ marginLeft: 5 }} />
            <div className="tree-row">
              <div className="tree-dot branch" />
              <div className="tree-label">
                曲 B がつけられる<span className="tree-badge badge-comp">作曲家 B</span>
                {' '}→ Ver.1 完成
                <span className="tree-badge badge-rev">作曲：20%</span>
              </div>
            </div>
            <div className="tree-line" style={{ marginLeft: 29 }} />
            <div className="tree-row">
              <div className="tree-dot leaf" />
              <div className="tree-label">
                ミュージシャン Hana が歌う<span className="tree-badge badge-music">演奏：30%</span>
                {' '}→ YouTubeで30万再生 → ウタタネで購入
              </div>
            </div>
            <div className="tree-line" style={{ marginLeft: 29 }} />
            <div className="tree-row">
              <div className="tree-dot leaf" />
              <div className="tree-label">
                別の作詞家 C が曲 B に新しい詞をつける → Ver.2
                <span className="tree-badge badge-rev">曲Bの作者にも20%</span>
              </div>
            </div>
          </div>

          <div className="solution-box lp-reveal">
            <p>
              <strong>これが収益複利の仕組みです。</strong><br/>
              詞Aの作者は Ver.1・Ver.2 両方から 20% を受け取り続ける。<br/>
              曲Bの作者は Ver.1・Ver.2・Ver.3 全部から 20% を受け取り続ける。<br/>
              1つの作品が、時間とともに資産として積み上がる。
            </p>
          </div>
        </div>
      </section>

      {/* ペルソナ */}
      <section id="personas" className="lp-personas">
        <div className="lp-container">
          <span className="section-label lp-reveal">— FOR EVERYONE</span>
          <h2 className="section-title lp-reveal">全員が、種を持っている。</h2>
          <div className="personas-grid">
            {PERSONAS.map((p) => (
              <div key={p.role} className="persona-card lp-reveal">
                <div className="persona-emoji">{p.emoji}</div>
                <div className="persona-role">{p.role}</div>
                <div className="persona-title">{p.title}</div>
                <p className="persona-story">{p.story}</p>
                <div className="persona-flow">
                  {p.flow.map((step, i) => (
                    <span key={i}>
                      {i > 0 && <span className="pf-arr">→</span>}
                      <span className="pf-step">{step}</span>
                    </span>
                  ))}
                  <span className="pf-arr">→</span>
                  <span className="pf-end">{p.end}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 収益モデル */}
      <section id="revenue" className="lp-revenue">
        <div className="lp-container">
          <span className="section-label lp-reveal">— REVENUE MODEL</span>
          <h2 className="section-title lp-reveal">透明な収益分配。<br/>誰が何%を受け取るか、一目瞭然。</h2>
          <div className="revenue-split lp-reveal">
            <div className="rev-bar">
              {REV_SEGMENTS.map((s) => (
                <div key={s.label} className="rev-seg"
                  style={{ flex: s.flex, background: s.bg, fontSize: s.small ? '.65rem' : undefined }}>
                  {s.label}
                </div>
              ))}
            </div>
            <div className="rev-legend">
              {REV_LEGEND.map((l) => (
                <div key={l.role} className="rev-item">
                  <div className="rev-pct" style={{ color: l.color }}>{l.pct}</div>
                  <div className="rev-role">{l.role}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="revenue-note lp-reveal">
            シンガーソングライターが作曲・作詞・演奏の3役を担う場合、<strong style={{ color: 'var(--forest)' }}>合計70%</strong>を受け取ります。
            無料で聴くだけでも、動画広告収益の一部がクリエイターと自分自身に還ってくる。もっと深く応援したければ、サブスクや1曲購入でさらにクリエイターを直接支援できる。
          </p>
        </div>
      </section>

      {/* TYP */}
      <section id="typ" className="lp-typ">
        <div className="lp-container">
          <span className="section-label lp-reveal">— THANK YOU POINT</span>
          <h2 className="section-title lp-reveal">あなたの感謝が、クリエイターの糧になる。</h2>
          <div className="typ-grid">
            {TYP_CARDS.map((c) => (
              <div key={c.title} className="typ-card lp-reveal">
                <div className="typ-icon" style={{ background: c.bg }}>{c.icon}</div>
                <div className="typ-title">{c.title}</div>
                <div className="typ-text">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="typ-highlight lp-reveal">
            <div className="typ-hl-title">ウタタネは「音楽プラットフォーム」ではなく、<br/>才能が自由に出会い、一緒に育つコラボレーションインフラです。</div>
            <div className="typ-hl-text">
              詞と曲が出会い、声が加わり、世界に届く——そのすべてがウタタネの中で完結します。
            </div>
          </div>
        </div>
      </section>

      {/* フェーズ */}
      <section id="phases" className="lp-phases">
        <div className="lp-container">
          <span className="section-label lp-reveal">— ROADMAP</span>
          <h2 className="section-title lp-reveal">3つのフェーズで、<br/>音楽の経済を変える。</h2>
          <div className="phases-grid">
            {PHASES.map((p) => (
              <div key={p.num} className="phase-card lp-reveal">
                <div className="phase-num">{p.num}</div>
                <span className={`phase-tag ${p.tagClass}`}>{p.tag}</span>
                <div className="phase-title">{p.title}</div>
                <ul className="phase-items">
                  {p.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="lp-cta">
        <div className="lp-container">
          <div className="cta-en lp-reveal">EARLY ACCESS</div>
          <h2 className="cta-title lp-reveal">
            あなたの<em>種</em>を、<br/>世界へ蒔こう。
          </h2>
          <p className="cta-sub lp-reveal">
            早期登録でアーリーアクセスをお届けします。<br/>
            作曲家・作詞家・ミュージシャン・リスナー、誰でも参加できます。
          </p>
          <form className="cta-form lp-reveal" onSubmit={handleSubmit}>
            <input type="email" className="cta-input" placeholder="your@email.com" required />
            <button type="submit" className="btn-primary">
              {submitted ? '登録完了 ✓' : '登録する'}
            </button>
          </form>
          <p className="lp-reveal" style={{ marginTop: '1.5rem', fontSize: '.85rem', color: 'rgba(247,242,232,.4)', position: 'relative', zIndex: 1 }}>
            すでにアカウントをお持ちの方は<a href="/login" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>ログイン</a>
          </p>
          <div className="cta-domain lp-reveal">
            <strong>utatane.music</strong> — 一粒の歌が、森になる。
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="lp-footer">
        <div className="footer-logo">ウタタネ</div>
        <div className="footer-copy">&copy; 2026 UTATANE. All rights reserved.</div>
      </footer>
    </div>
  )
}
