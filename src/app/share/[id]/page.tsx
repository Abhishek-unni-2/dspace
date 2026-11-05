import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shares } from "@/db/schema";
import { signedFilePath } from "@/lib/file-links";
import "./share.css";

const YEAR = 60 * 60 * 24 * 365;
const isImage = (f: string) => /\.(png|jpe?g|webp|gif)$/i.test(f);
const isUrl = (s: string) => /^https?:\/\//.test(s);

async function load(id: string) {
  const [row] = await db.select().from(shares).where(eq(shares.id, id)).limit(1);
  return row?.payload ?? null;
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await load((await params).id);
  if (!p) return { title: "Not found" };
  const base = await origin();
  const firstImage = p.files.find((f) => isImage(f.file));
  const description = [p.subtitle, ...p.sections.flatMap((s) => s.lines).filter((l) => !isUrl(l)).slice(0, 3)].filter(Boolean).join(" · ");
  const images = firstImage ? [base + signedFilePath(firstImage.file, YEAR)] : [];
  return {
    title: `${p.title} | DSPACE`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: p.title, description, type: "website", siteName: "DSPACE", images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title: p.title, description, images },
  };
}

function Section({ heading, lines }: { heading: string; lines: string[] }) {
  const urls = lines.filter(isUrl);
  const rest = lines.filter((l) => !isUrl(l));
  const isChips = heading.toLowerCase() === "amenities";
  return (
    <div className="sh-card">
      <h2>{heading}</h2>
      {isChips ? (
        <div className="sh-chips">
          {rest.flatMap((l) => l.split(",")).map((a) => a.trim()).filter(Boolean).map((a) => (
            <span className="sh-chip" key={a}>{a}</span>
          ))}
        </div>
      ) : (
        rest.map((l, i) => {
          const m = l.match(/^([^:]{1,28}):\s*(.+)$/);
          return m ? (
            <div className="sh-row" key={i}><span>{m[1]}</span><span>{m[2]}</span></div>
          ) : (
            <p className="sh-text" key={i}>{l}</p>
          );
        })
      )}
      {urls.map((u) => (
        <a key={u} className="sh-btn" href={u} target="_blank" rel="noopener noreferrer" style={{ marginTop: 6 }}>
          View on Google Maps →
        </a>
      ))}
    </div>
  );
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id);
  if (!p) notFound();

  const images = p.files.filter((f) => isImage(f.file));
  const docs = p.files.filter((f) => !isImage(f.file));
  const hero = images[0];
  const gallery = images.slice(1);
  const [badge, ...subRest] = p.subtitle.split(" · ");

  return (
    <div className="sh">
      <header className="sh-bar">
        <div className="sh-bar-in">
          <div className="sh-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="square"><path d="M4 19L12 4L20 19" /></svg>
          </div>
          <div>
            <div className="sh-word">DSPΛCE</div>
            <div className="sh-tag">Building Spaces. Creating Futures.</div>
          </div>
        </div>
      </header>

      <section className="sh-hero">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signedFilePath(hero.file, YEAR)} alt={hero.name} />
        ) : (
          <div className="sh-hero-plain" />
        )}
        <div className="sh-hero-text">
          <div className="sh-hero-in">
            {badge && <span className="sh-badge">{badge}</span>}
            <h1>{p.title}</h1>
            {subRest.length > 0 && <p className="sh-sub">{subRest.join(" · ")}</p>}
          </div>
        </div>
      </section>

      <main className="sh-wrap">
        {p.clientName && <p className="sh-hello">Hello <b>{p.clientName}</b>, here are the details you asked for.</p>}

        {p.sections.length > 0 && (
          <div className="sh-grid">
            {p.sections.map((s) => <Section key={s.heading} {...s} />)}
          </div>
        )}

        {gallery.length > 0 && (
          <div className="sh-card" style={{ marginBottom: 16 }}>
            <h2>Gallery</h2>
            <div className="sh-gallery">
              {gallery.map((f) => (
                <a key={f.file} href={signedFilePath(f.file, YEAR)} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signedFilePath(f.file, YEAR)} alt={f.name} loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        )}

        {docs.length > 0 && (
          <div className="sh-card" style={{ marginBottom: 16 }}>
            <h2>Documents</h2>
            <div className="sh-docs">
              {docs.map((f) => (
                <a key={f.file} className="sh-btn alt" href={signedFilePath(f.file, YEAR)} target="_blank" rel="noopener noreferrer">
                  📄 {f.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {p.note && (
          <div className="sh-card">
            <h2>Note</h2>
            <p className="sh-note">{p.note}</p>
          </div>
        )}
      </main>

      <footer className="sh-foot">
        <b>DSPΛCE</b>
        <div style={{ marginTop: 6 }}>Building Spaces. Creating Futures.</div>
      </footer>
    </div>
  );
}
