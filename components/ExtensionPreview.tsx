import Link from "next/link";
import { ArrowLeft, Chrome, Lock, ShieldCheck } from "lucide-react";

export function ExtensionPreview() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-muted transition hover:text-primary">
          <ArrowLeft aria-hidden="true" size={18} />
          Back to Soryvo
        </Link>

        <section className="border-t border-border pt-6 sm:pt-8">
          <p className="mb-4 text-sm text-muted">Future optional extension</p>
          <h1 className="max-w-3xl text-4xl font-semibold sm:text-5xl">Extension Preview</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
            Soryvo&apos;s optional extension would only send high-level activity categories, such as study tool, writing tool, social media, or idle time. It would not save screenshots or send private page contents.
          </p>

          <div className="mt-8 grid gap-7 md:grid-cols-3">
            {[
              [ShieldCheck, "Opt-in only", "Students choose whether to share broad activity categories."],
              [Lock, "No private content", "No screenshots, page text, messages, passwords, or browsing history are stored."],
              [Chrome, "Broad categories", "The prototype demonstrates labels like study tool, writing tool, social media, or idle."]
            ].map(([Icon, title, copy]) => (
              <div key={title as string} className="border-t border-border pt-5">
                <Icon aria-hidden="true" className="mb-4 text-muted" />
                <h2 className="font-semibold">{title as string}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{copy as string}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-border pt-5">
            <p className="text-sm text-muted">Prototype boundary</p>
            <p className="mt-3 text-muted">
              The app works fully without the extension. The extension folder is included only to show how a privacy-first future integration could categorize the current site without stealth behavior or hidden monitoring.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
