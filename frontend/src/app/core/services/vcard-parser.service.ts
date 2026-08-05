import { Injectable } from '@angular/core';

export interface QrParsedContact {
  name?: string;
  company?: string;
  designation?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  remarks?: string;
  rawText?: string;
  format?: 'vCard' | 'MECARD' | 'JSON' | 'PlainText';
}

@Injectable({
  providedIn: 'root'
})
export class VCardParserService {

  /**
   * Main entry point to parse any scanned QR payload or .vcf file string into a QrParsedContact.
   */
  parseQrPayload(rawPayload: string): QrParsedContact {
    if (!rawPayload || !rawPayload.trim()) {
      return {};
    }

    const trimmed = rawPayload.trim();

    // 1. Check for JSON format
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const jsonParsed = this.parseJsonFormat(trimmed);
      if (jsonParsed) {
        return jsonParsed;
      }
    }

    // 2. Check for standard vCard format (BEGIN:VCARD ... END:VCARD or containing VCARD keys)
    if (trimmed.toUpperCase().includes('BEGIN:VCARD') || trimmed.toUpperCase().includes('END:VCARD') || /^(N|FN|ORG|TITLE|TEL|EMAIL|URL|ADR):/mi.test(trimmed)) {
      return this.parseVCardFormat(trimmed);
    }

    // 3. Check for MECARD format (MECARD:N:...)
    if (trimmed.toUpperCase().startsWith('MECARD:')) {
      return this.parseMeCardFormat(trimmed);
    }

    // 4. Fallback to intelligent Plain Text parsing
    return this.parsePlainTextFormat(trimmed);
  }

  /**
   * Parse JSON encoded QR codes (e.g. from event registration apps)
   */
  private parseJsonFormat(payload: string): QrParsedContact | null {
    try {
      const obj = JSON.parse(payload);
      if (typeof obj === 'object' && obj !== null) {
        return {
          name: obj.name || obj.fullName || obj.FN || obj.visitorName || undefined,
          company: obj.company || obj.companyName || obj.organization || obj.ORG || undefined,
          designation: obj.designation || obj.title || obj.role || obj.TITLE || undefined,
          phone: obj.phone || obj.mobile || obj.cell || obj.TEL || obj.contact || undefined,
          email: obj.email || obj.mail || obj.EMAIL || undefined,
          website: obj.website || obj.url || obj.URL || undefined,
          address: obj.address || obj.location || obj.ADR || undefined,
          remarks: obj.remarks || obj.note || obj.NOTE || undefined,
          rawText: payload,
          format: 'JSON'
        };
      }
    } catch {
      // Not valid JSON
    }
    return null;
  }

  /**
   * Parse vCard (.vcf / vCard 2.1, 3.0, 4.0) strings
   */
  private parseVCardFormat(vcardStr: string): QrParsedContact {
    const result: QrParsedContact = {
      rawText: vcardStr,
      format: 'vCard'
    };

    // 1. Normalize line breaks and unfold folded lines (vCard 3.0/4.0 CRLF+Space and vCard 2.1 Quoted Printable softbreaks =)
    let normalized = vcardStr
      .replace(/=\r?\n/g, '') // Quoted Printable line wrap
      .replace(/\r\n[ \t]/g, '') // Line unfolding
      .replace(/\n[ \t]/g, '')
      .replace(/\r/g, '\n');

    const lines = normalized.split('\n');

    let fn: string | undefined;
    let nName: string | undefined;

    for (let line of lines) {
      line = line.trim();
      if (!line || line.toUpperCase().startsWith('BEGIN:') || line.toUpperCase().startsWith('END:')) {
        continue;
      }

      // Split key and value (handling parameters like TEL;TYPE=CELL:123456)
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const keyPart = line.substring(0, colonIdx).toUpperCase();
      let value = line.substring(colonIdx + 1).trim();
      value = this.unescapeVCardText(value);

      // Key base command (remove parameters after ;)
      const keyBase = keyPart.split(';')[0];

      switch (keyBase) {
        case 'FN':
          fn = this.decodeQuotedPrintable(value);
          break;
        case 'N':
          nName = this.parseNKey(value);
          break;
        case 'ORG':
          // ORG:Company Name;Department -> take main company part
          const orgValue = this.decodeQuotedPrintable(value);
          result.company = orgValue.split(';')[0].trim();
          break;
        case 'TITLE':
        case 'ROLE':
          result.designation = this.decodeQuotedPrintable(value);
          break;
        case 'TEL':
          const phoneVal = this.cleanPhone(value);
          if (!result.phone || keyPart.includes('CELL') || keyPart.includes('MOBILE') || keyPart.includes('PREF')) {
            result.phone = phoneVal;
          }
          break;
        case 'EMAIL':
          if (!result.email || keyPart.includes('PREF')) {
            result.email = value.toLowerCase();
          }
          break;
        case 'URL':
          result.website = this.cleanWebsite(value);
          break;
        case 'ADR':
          result.address = this.parseAdrKey(value);
          break;
        case 'NOTE':
          result.remarks = this.decodeQuotedPrintable(value);
          break;
      }
    }

    result.name = fn || nName;
    return result;
  }

  /**
   * Parse MECARD strings e.g. MECARD:N:Doe,John;ORG:Acme;TEL:123456;EMAIL:john@acme.com;;
   */
  private parseMeCardFormat(mecardStr: string): QrParsedContact {
    const result: QrParsedContact = {
      rawText: mecardStr,
      format: 'MECARD'
    };

    const content = mecardStr.substring(7);
    const fields = content.split(/(?<!\\);/);

    for (const field of fields) {
      if (!field.trim()) continue;
      const colonIdx = field.indexOf(':');
      if (colonIdx === -1) continue;

      const key = field.substring(0, colonIdx).toUpperCase().trim();
      const val = this.unescapeVCardText(field.substring(colonIdx + 1).trim());

      switch (key) {
        case 'N':
          if (val.includes(',')) {
            const parts = val.split(',');
            result.name = `${parts[1].trim()} ${parts[0].trim()}`.trim();
          } else {
            result.name = val;
          }
          break;
        case 'ORG':
          result.company = val;
          break;
        case 'TEL':
          result.phone = this.cleanPhone(val);
          break;
        case 'EMAIL':
          result.email = val.toLowerCase();
          break;
        case 'URL':
          result.website = this.cleanWebsite(val);
          break;
        case 'ADR':
          result.address = val.replace(/,/g, ', ').trim();
          break;
        case 'NOTE':
          result.remarks = val;
          break;
      }
    }

    return result;
  }

  /**
   * Fallback for plain text or key-value formatted badge strings
   */
  private parsePlainTextFormat(text: string): QrParsedContact {
    const result: QrParsedContact = {
      rawText: text,
      format: 'PlainText'
    };

    // Extract Email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
    if (emailMatch) {
      result.email = emailMatch[0].toLowerCase();
    }

    // Extract Website
    const webMatch = text.match(/(https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.(com|in|co|org|io|net|ai)\b(\/[^\s]*)?/i);
    if (webMatch && (!result.email || !webMatch[0].includes(result.email))) {
      result.website = this.cleanWebsite(webMatch[0]);
    }

    // Extract Phone
    const phoneMatch = text.match(/(?:\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/g);
    if (phoneMatch) {
      for (const p of phoneMatch) {
        const digitsOnly = p.replace(/\D/g, '');
        if (digitsOnly.length >= 8 && digitsOnly.length <= 14) {
          result.phone = p.trim();
          break;
        }
      }
    }

    // Extract Key-Value lines like "Name: John", "Company: Acme"
    const lines = text.split('\n');
    for (const line of lines) {
      const parts = line.split(/[:=]/);
      if (parts.length >= 2) {
        const key = parts[0].trim().toUpperCase();
        const val = parts.slice(1).join(':').trim();

        if (key.includes('NAME') && !result.name) result.name = val;
        if ((key.includes('COMPANY') || key.includes('ORG')) && !result.company) result.company = val;
        if ((key.includes('TITLE') || key.includes('ROLE') || key.includes('DESIGNATION')) && !result.designation) result.designation = val;
        if ((key.includes('PHONE') || key.includes('MOBILE') || key.includes('TEL')) && !result.phone) result.phone = this.cleanPhone(val);
        if (key.includes('EMAIL') && !result.email) result.email = val.toLowerCase();
        if (key.includes('ADDRESS') && !result.address) result.address = val;
      }
    }

    if (!result.name && lines.length > 0) {
      const firstLine = lines[0].trim();
      if (/^[a-zA-Z\s.'-]+$/.test(firstLine) && firstLine.length >= 3 && firstLine.length <= 35) {
        result.name = firstLine;
      }
    }

    return result;
  }

  private parseNKey(value: string): string {
    const parts = value.split(';').map(p => this.decodeQuotedPrintable(p).trim());
    const lastName = parts[0] || '';
    const firstName = parts[1] || '';
    const middleName = parts[2] || '';
    const prefix = parts[3] || '';

    const nameParts = [prefix, firstName, middleName, lastName].filter(p => p.length > 0);
    return nameParts.join(' ');
  }

  private parseAdrKey(value: string): string {
    const parts = value.split(';').map(p => this.decodeQuotedPrintable(p).trim());
    return parts.filter(p => p.length > 0).join(', ');
  }

  private unescapeVCardText(str: string): string {
    return str
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/gi, '\n');
  }

  private decodeQuotedPrintable(str: string): string {
    return str.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  private cleanPhone(phoneStr: string): string {
    let cleaned = phoneStr.replace(/tel:/i, '').trim();
    return cleaned;
  }

  private cleanWebsite(urlStr: string): string {
    let url = urlStr.trim().toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (!url.startsWith('www.')) {
        url = 'www.' + url;
      }
    }
    return url;
  }
}
