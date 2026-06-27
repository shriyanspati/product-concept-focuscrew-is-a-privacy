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
          <p className="mb-4 text-sm text-muted">Optional extension prototype</p>
          <h1 className="max-w-3xl text-4xl font-semibold sm:text-5xl">Extension Preview</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
            Soryvo&apos;s opt-in extension sends only a high-level activity category and a session tab-switch count to your private Focus Check. It does not send URLs, titles, searches, screenshots, or page contents.
          </p>

          <div className="mt-8 grid gap-7 md:grid-cols-3">
            {[
              [ShieldCheck, "Opt-in only", "Students explicitly start and stop each private signal session."],
              [Lock, "No private content", "No URLs, titles, searches, screenshots, messages, passwords, or browsing history are shared."],
              [Chrome, "Broad signals", "Focus Check receives only a category and the number of tab switches in this session."]
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
              The app works fully without the extension. Signal data stays in Chrome&apos;s session memory, is cleared when sharing stops, and is never written to Soryvo&apos;s database.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
