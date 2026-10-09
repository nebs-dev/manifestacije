export function AuthHelp({ emailExpected = false }: { emailExpected?: boolean }) {
  return (
    <div className="mt-5 space-y-2 text-center text-sm text-muted-foreground">
      {emailExpected && <p>Ako poruka ne stigne za nekoliko minuta, provjerite neželjenu poštu i jeste li unijeli točnu email adresu. Zatražite novu poveznicu ako je prethodna istekla.</p>}
      <p>Trebate pomoć? Pišite na <a href="mailto:info@manifestacije.hr" className="break-words text-primary underline">info@manifestacije.hr</a>.</p>
    </div>
  )
}
