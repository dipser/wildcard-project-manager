/**
 * Ein Muster mit `*` als Platzhalter für beliebig viele Zeichen.
 *
 * Ein `*` bleibt dabei innerhalb einer Ebene und überspringt kein `/`. Für
 * einzelne Verzeichnisnamen macht das keinen Unterschied – die enthalten ohnehin
 * nie ein `/`. Es zählt bei den mehrstufigen Namen aus `hidden` und `settings`
 * wie "domain.com/logs": dort hätte "domain.com" mit einem übergreifenden
 * Platzhalter sonst auch alles darunter getroffen.
 */
export function globMatch(pattern: string, value: string): boolean {
  // Alles außer `*` ist gewöhnlicher Text. Das `?` gehört ausdrücklich dazu:
  // es ist kein Platzhalter, in einem regulären Ausdruck aber ein Sonderzeichen
  // – ohne Maskierung würde aus "projekt?" ein optionales "t".
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(value);
}
