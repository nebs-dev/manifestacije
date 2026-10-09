import { BadRequestException } from "@nestjs/common";
import { Transform } from "class-transformer";
import { ValidateBy, ValidationOptions } from "class-validator";

/**
 * User-supplied links (ticket, source, image, website URLs) end up in `href`
 * and `src` attributes, so only http(s) is ever allowed through. Anything
 * else — `javascript:`, `data:`, `vbscript:`, `file:`, relative paths — is
 * rejected. Keep in sync with apps/web/src/lib/safe-url.ts.
 */
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);
const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// "www.entrio.hr:8080/x" looks like scheme "www.entrio.hr" to the regex above.
const HOST_WITH_PORT = /^[^\s:/?#]+:\d+(?:[/?#]|$)/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
// Ticket links may also be a phone number or e-mail for reservations
// (production has e.g. "tel:099-488-9294"). Neither scheme can run script.
const TEL_LINK = /^tel:\+?[0-9][0-9 ().\/-]{2,30}$/i;
const MAILTO_LINK = /^mailto:[^\s<>"'@/]+@[^\s<>"'@/]+\.[^\s<>"'@/]+$/i;

export type SafeUrlOptions = { allowContactLinks?: boolean };

/**
 * Returns an absolute http(s) URL for `value`, or null when it is empty,
 * unparseable or uses any other scheme. Scheme-less links that look like a
 * host ("www.entrio.hr/koncert") get `https://` prepended; protocol-relative
 * links ("//cdn.example.com/a.jpg") become https. Otherwise the input is
 * returned as typed (only trimmed), so legitimate links are not rewritten.
 */
export function normalizeSafeHttpUrl(value: unknown, options: SafeUrlOptions = {}): string | null {
  if (typeof value !== "string") return null;
  // Browsers strip tab/CR/LF anywhere in a URL; strip them first so the
  // scheme check sees what the browser will see.
  const trimmed = value.replace(/[\t\n\r]/g, "").trim();
  if (!trimmed || CONTROL_CHARS.test(trimmed) || trimmed.includes("\\")) return null;
  if (options.allowContactLinks && (TEL_LINK.test(trimmed) || MAILTO_LINK.test(trimmed))) return trimmed;

  let candidate: string;
  let schemeless = false;
  if (trimmed.startsWith("//")) {
    candidate = `https:${trimmed}`;
  } else if (EXPLICIT_SCHEME.test(trimmed) && !HOST_WITH_PORT.test(trimmed)) {
    candidate = trimmed;
  } else if (trimmed.startsWith("/")) {
    return null;
  } else {
    candidate = `https://${trimmed}`;
    schemeless = true;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!SAFE_PROTOCOLS.has(url.protocol) || !url.hostname) return null;
  // A bare word such as "TBA" or "blagajna" is not a link.
  if (schemeless && !url.hostname.includes(".")) return null;
  return candidate;
}

/** Empty/blank strings, null and undefined are "no value" and pass through. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/**
 * Normalizes an optional URL field for storage: blank values pass through
 * unchanged (so "" / null keep their existing "clear this field" meaning),
 * anything else must be a safe http(s) URL or the request is rejected.
 */
export function requireSafeHttpUrl<T extends string | null | undefined>(value: T, field: string, options?: SafeUrlOptions): T | string {
  if (isBlank(value)) return value;
  const safe = normalizeSafeHttpUrl(value, options);
  if (!safe) throw new BadRequestException(`${field} mora biti valjana poveznica (http:// ili https://).`);
  return safe;
}

/** Lenient variant for untrusted parsed/legacy data: unsafe links are dropped. */
export function safeHttpUrlOrUndefined(value: string | null | undefined, options?: SafeUrlOptions): string | undefined {
  return normalizeSafeHttpUrl(value, options) ?? undefined;
}

/**
 * DTO decorator that only normalizes (scheme-less host -> https://) and
 * never rejects. Used on event content fields, whose safety is enforced in
 * EventsService because only the service knows the stored value: an
 * unchanged legacy value (e.g. "racesmanager") must not block saving
 * unrelated changes, while any new or changed value must be safe.
 */
export function NormalizeSafeHttpUrl(urlOptions?: SafeUrlOptions): PropertyDecorator {
  return Transform(({ value }) => (isBlank(value) ? value : normalizeSafeHttpUrl(value, urlOptions) ?? value));
}

/**
 * DTO decorator: prepends https:// to scheme-less links (needs the global
 * ValidationPipe's `transform: true`) and rejects anything that is not a
 * safe http(s) URL (or, with allowContactLinks, a tel:/mailto: link).
 * Blank values are left to @IsOptional / the service.
 */
export function IsSafeHttpUrl(urlOptions?: SafeUrlOptions, options?: ValidationOptions): PropertyDecorator {
  const transform = Transform(({ value }) => (isBlank(value) ? value : normalizeSafeHttpUrl(value, urlOptions) ?? value));
  const validate = ValidateBy(
    {
      name: "isSafeHttpUrl",
      validator: {
        validate: (value: unknown) => isBlank(value) || normalizeSafeHttpUrl(value, urlOptions) !== null,
        defaultMessage: () => "$property must be a valid http(s) URL",
      },
    },
    options,
  );
  return (target, propertyKey) => {
    transform(target, propertyKey);
    validate(target, propertyKey);
  };
}
