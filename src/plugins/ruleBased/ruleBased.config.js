import { ClassifierName } from "../../config/classifiers.config.js";

/**
 * Keyword-Map fuer den regelbasierten Baseline-Klassifikator.
 *
 * @type {{ name: string, method: string, keywords: Record<string, string[]> }}
 */
export const ruleBasedConfig = {
  name: ClassifierName.RULE_BASED,
  method: "Case-insensitive keyword matching per STRIDE class (Binary Relevance)",

  keywords: {
    // S – Spoofing: Angreifer täuscht Identität vor.
    S: [
      "authentifizier", "authentifikation",
      "anmeldung", "login",
      "passwort", "kennwort",
      "identität", "benutzerkennung",
      "sso", "single-sign-on"
    ],

    // T – Tampering: Angreifer verändert Daten oder Konfiguration.
    T: [
      "integrität", "manipulation", "manipulationsschutz",
      "signatur", "hash", "prüfsumme", "hmac",
      "modifizier", "veränder", "konfiguration", "image"
    ],

    // R – Repudiation: Aktion ist nicht nachweisbar.
    R: [
      "protokollier", "protokoll", "auditlog", "audit-trail",
      "logging", "audit", "nachweis", "nachweisbar",
      "aufzeichnung", "rückverfolgung", "ereignisprotokoll",
      "quittung", "bestätigung", "sendewarteschlange"
    ],

    // I – Information Disclosure: Angreifer liest vertrauliche Daten.
    I: [
      "vertraulich", "verschlüssel", "geheim",
      "tls", "https", "ssl", "pki",
      "offenlegung", "datenschutz",
      "schlüssel", "zertifikat"
    ],

    // D – Denial of Service: Angreifer verhindert Verfügbarkeit.
    D: [
      "verfügbar", "ausfall", "überlast", "kapazität",
      "verbindung", "teilnehmer", "voip", "konferenz", "netz"
    ],

    // E – Elevation of Privilege: Angreifer erlangt unberechtigte Rechte.
    E: [
      "berechtigung", "rollenkonzept", "privileg",
      "zugriffsrecht", "autorisier", "rbac",
      "rechtevergabe", "rolle",
      "administrator", "administrat", "firewall", "verweiger", "sperr"
    ]
  }
};
