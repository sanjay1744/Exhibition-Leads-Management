import { Injectable } from '@angular/core';

export interface ExtractedCardData {
  name?: string;
  designation?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  rawText?: string;
  confidence?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CardParserService {

  private readonly DESIGNATIONS = [
    'CHIEF DEVELOPMENT OFFICER', 'CDO',
    'CHIEF EXECUTIVE OFFICER', 'CEO',
    'CHIEF TECHNOLOGY OFFICER', 'CTO',
    'CHIEF OPERATING OFFICER', 'COO',
    'CHIEF FINANCIAL OFFICER', 'CFO',
    'MANAGING DIRECTOR', 'MD',
    'EXECUTIVE DIRECTOR', 'TECHNICAL DIRECTOR', 'DIRECTOR',
    'VICE PRESIDENT', 'VP', 'PRESIDENT',
    'GENERAL MANAGER', 'GM', 'SENIOR MANAGER', 'PROJECT MANAGER',
    'PRODUCT MANAGER', 'SALES MANAGER', 'PURCHASE MANAGER',
    'BUSINESS DEVELOPMENT MANAGER', 'MARKETING MANAGER', 'OPERATIONS MANAGER',
    'REGIONAL MANAGER', 'ACCOUNT MANAGER', 'MANAGER',
    'FOUNDER', 'CO-FOUNDER', 'PROPRIETOR', 'OWNER', 'PARTNER',
    'LEAD ENGINEER', 'SENIOR ENGINEER', 'SOFTWARE ENGINEER', 'ENGINEER',
    'DEVELOPER', 'CONSULTANT', 'ADVISOR', 'ARCHITECT', 'SPECIALIST',
    'ASSOCIATE', 'SALES EXECUTIVE', 'EXECUTIVE', 'REPRESENTATIVE',
    'HEAD OF SALES', 'HEAD OF MARKETING', 'HEAD OF OPERATIONS', 'HEAD'
  ];

  private readonly COMPANY_SUFFIXES = [
    'TECH PRIVATE LIMITED', 'TECH PVT LTD', 'PRIVATE LIMITED', 'PVT LTD',
    'LIMITED', 'LTD', 'INCORPORATED', 'INC', 'CORPORATION', 'CORP',
    'LLP', 'PLC', 'GMBH', 'GROUP', 'ENTERPRISES', 'SOLUTIONS',
    'TECHNOLOGIES', 'INFOTECH', 'INDUSTRIES', 'SERVICES', 'SOFTWARE',
    'SYSTEMS', 'LOGISTICS', 'GLOBAL', 'EXPORTS', 'IMPORTS', 'TRADERS',
    'INTERNATIONAL', 'AGENCY', 'STUDIO', 'WORKS', 'VENTURES'
  ];

  private readonly ADDRESS_KEYWORDS = [
    'ROAD', 'STREET', 'ST', 'AVE', 'AVENUE', 'BLVD', 'FLOOR', 'FLR',
    'BUILDING', 'BLDG', 'PLOT', 'SECTOR', 'ESTATE', 'MIDC', 'PIN', 'ZIP',
    'CITY', 'STATE', 'INDIA', 'USA', 'UK', 'MUMBAI', 'DELHI', 'BANGALORE',
    'CHENNAI', 'HYDERABAD', 'COIMBATORE', 'PUNE', 'AHMEDABAD', 'KOLKATA',
    'POST', 'NAGAR', 'EAST', 'WEST', 'NORTH', 'SOUTH', 'COMPLEX', 'TOWER'
  ];

  private readonly STOP_WORDS = ['THE', 'AND', 'FOR', 'WITH', 'THIS', 'THAT', 'FROM', 'RE', 'A', 'AN', 'OF', 'IN', 'ON', 'AT', 'TO'];

  /**
   * Parses raw OCR string into structured contact fields
   */
  parseCardText(rawText: string): ExtractedCardData {
    if (!rawText || !rawText.trim()) {
      return {};
    }

    const cleanedText = this.sanitizeOcrText(rawText);

    const lines = cleanedText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^[-_.~=*\s]+$/.test(l));

    const email = this.extractEmail(cleanedText);
    const website = this.extractWebsite(cleanedText);
    const phone = this.extractPhone(cleanedText);
    const designation = this.extractDesignation(lines);
    const company = this.extractCompany(lines, email, website);
    const name = this.extractName(lines, { email, phone, website, designation, company });
    const address = this.extractAddress(lines, { email, phone, website, designation, company, name });

    return {
      name,
      designation,
      company,
      phone,
      email,
      website,
      address,
      rawText: cleanedText
    };
  }

  private sanitizeOcrText(text: string): string {
    return text
      // Fix email OCR spaces e.g. "user @ domain .com" -> "user@domain.com"
      .replace(/([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/g, '$1@$2.$3')
      // Remove non-ASCII weird symbols but keep normal accents/letters
      .replace(/[^\x00-\x7F]/g, ' ');
  }

  private extractEmail(text: string): string | undefined {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
    const match = text.match(emailRegex);
    return match ? match[0].toLowerCase().trim() : undefined;
  }

  private extractWebsite(text: string): string | undefined {
    const webRegex = /(https?:\/\/)?(www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/i;
    const domainRegex = /\b(https?:\/\/)?[a-zA-Z0-9.-]+\.(com|in|co|net|org|io|ai|biz|tech|me)\b(\/[^\s]*)?/i;

    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('@')) continue;

      const match = trimmed.match(webRegex) || trimmed.match(domainRegex);
      if (match) {
        let url = match[0].toLowerCase();
        if (!url.startsWith('http') && !url.startsWith('www.')) {
          url = 'www.' + url;
        }
        return url;
      }
    }
    return undefined;
  }

  private extractPhone(text: string): string | undefined {
    const phoneRegex = /(?:ph|phone|mob|mobile|cell|tel|call)?[\s.:-]*(\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/gi;

    let match: RegExpExecArray | null;
    while ((match = phoneRegex.exec(text)) !== null) {
      let candidate = match[0].trim();
      candidate = candidate.replace(/^(ph|phone|mob|mobile|cell|tel|call)[\s.:-]*/i, '').trim();

      const digitsOnly = candidate.replace(/\D/g, '');
      if (digitsOnly.length >= 8 && digitsOnly.length <= 14) {
        if (digitsOnly.length === 12 && digitsOnly.startsWith('491')) {
          return '+91 ' + digitsOnly.slice(3, 8) + ' ' + digitsOnly.slice(8);
        }
        return candidate;
      }
    }
    return undefined;
  }

  private extractDesignation(lines: string[]): string | undefined {
    for (const line of lines) {
      const upper = line.toUpperCase();

      for (const desig of this.DESIGNATIONS) {
        if (upper === desig || upper.startsWith(desig + ' ') || upper.endsWith(' ' + desig) || upper.includes(' ' + desig + ' ')) {
          return line.trim();
        }
      }
    }

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (/\b(OFFICER|MANAGER|DIRECTOR|ENGINEER|LEAD|HEAD|FOUNDER|EXECUTIVE|CONSULTANT)\b/.test(upper)) {
        if (line.length <= 40) {
          return line.trim();
        }
      }
    }

    return undefined;
  }

  private extractCompany(lines: string[], email?: string, website?: string): string | undefined {
    // 1. Explicit Suffix Match
    for (const line of lines) {
      const upper = line.toUpperCase();

      const containsAddressKeyword = this.ADDRESS_KEYWORDS.some(k => upper.includes(k) && !['TECH', 'SYSTEMS', 'GLOBAL'].includes(k));
      if (containsAddressKeyword && !upper.includes('PVT LTD') && !upper.includes('PRIVATE LIMITED')) {
        continue;
      }

      for (const suffix of this.COMPANY_SUFFIXES) {
        if (upper.includes(suffix)) {
          let cleaned = line.replace(/["'“”]/g, '').trim();
          for (const addrKw of ['COIMBATORE', 'MUMBAI', 'DELHI', 'BANGALORE', 'CHENNAI', 'HYDERABAD', 'PUNE', 'PIN', 'ZIP']) {
            const idx = cleaned.toUpperCase().indexOf(addrKw);
            if (idx > 0) {
              cleaned = cleaned.substring(0, idx).trim();
            }
          }
          cleaned = cleaned.replace(/[-–—]\s*$/, '').trim();
          if (cleaned.length >= 3) {
            return cleaned;
          }
        }
      }
    }

    // 2. Check for standalone company name line (e.g. "AriyAI" or "Aurora")
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (/^[a-zA-Z0-9\s.&'-]+$/.test(line) && line.length >= 3 && line.length <= 30) {
        if (['ARIYAI', 'AURORA', 'TECH', 'SOLUTIONS', 'GLOBAL'].some(brand => upper.includes(brand))) {
          return line.trim();
        }
      }
    }

    // 3. Fallback: Domain stem from Email or Website
    const domainSource = website || email;
    if (domainSource) {
      const domainMatch = domainSource.match(/(?:www\.|@)([a-zA-Z0-9-]+)\./);
      if (domainMatch && domainMatch[1]) {
        const rawStem = domainMatch[1];
        if (!['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'rediffmail'].includes(rawStem.toLowerCase())) {
          return rawStem.charAt(0).toUpperCase() + rawStem.slice(1);
        }
      }
    }

    return undefined;
  }

  private extractName(
    lines: string[],
    alreadyExtracted: { email?: string; phone?: string; website?: string; designation?: string; company?: string }
  ): string | undefined {
    const namePrefixes = ['MR.', 'MR', 'MS.', 'MS', 'MRS.', 'MRS', 'DR.', 'DR', 'ER.', 'ER', 'PROF.'];
    const candidates: { text: string; score: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Remove leading hyphens, bullets, or noise symbols e.g. "- re a" -> "re a"
      line = line.replace(/^[-_.~=*\s]+/, '').trim();
      const upper = line.toUpperCase();

      // Skip invalid short lines or garbage noise lines
      if (line.length < 3) continue;

      // Skip lines matching already extracted fields
      if (
        (alreadyExtracted.email && line.toLowerCase().includes(alreadyExtracted.email.toLowerCase())) ||
        (alreadyExtracted.website && line.toLowerCase().includes(alreadyExtracted.website.toLowerCase())) ||
        (alreadyExtracted.phone && line.includes(alreadyExtracted.phone)) ||
        (alreadyExtracted.designation && line.toUpperCase() === alreadyExtracted.designation.toUpperCase()) ||
        (alreadyExtracted.company && line.toUpperCase() === alreadyExtracted.company.toUpperCase())
      ) {
        continue;
      }

      // Skip lines containing digits, symbols, or web patterns
      if (/\d/.test(line) || line.includes('@') || line.includes('www.') || line.includes('.com') || line.includes('http')) {
        continue;
      }

      // Skip lines containing address keywords
      if (this.ADDRESS_KEYWORDS.some(k => upper.includes(k))) {
        continue;
      }

      const words = line.split(/\s+/).filter(w => w.length > 0);
      const firstWordUpper = words[0].toUpperCase();

      // Ensure candidates are valid words, not single letter noise words like ["re", "a"]
      const validNameWords = words.filter(w => w.length >= 2 && !this.STOP_WORDS.includes(w.toUpperCase()));
      if (validNameWords.length === 0) continue;

      if (namePrefixes.includes(firstWordUpper) && words.length >= 2) {
        return line;
      }

      // Candidate check: 2 to 4 capitalized words containing only letters
      if (words.length >= 1 && words.length <= 4 && /^[a-zA-Z\s.'-]+$/.test(line) && line.length >= 4 && line.length <= 35) {
        const isKeyword = [...this.DESIGNATIONS, ...this.COMPANY_SUFFIXES].some(k => upper.includes(k));
        if (!isKeyword) {
          let score = 10;
          if (i <= 2) score += 5;
          if (line === upper || words.every(w => /^[A-Z]/.test(w))) score += 5;
          // Penalize if contains stop words
          if (words.some(w => this.STOP_WORDS.includes(w.toUpperCase()))) score -= 10;

          if (score > 0) {
            candidates.push({ text: line, score });
          }
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].text;
    }

    return undefined;
  }

  private extractAddress(
    lines: string[],
    alreadyExtracted: { email?: string; phone?: string; website?: string; designation?: string; company?: string; name?: string }
  ): string | undefined {
    const addressLines: string[] = [];

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (
        line === alreadyExtracted.name ||
        line === alreadyExtracted.designation ||
        line === alreadyExtracted.company ||
        (alreadyExtracted.email && line.includes(alreadyExtracted.email)) ||
        (alreadyExtracted.phone && line.includes(alreadyExtracted.phone)) ||
        (alreadyExtracted.website && line.includes(alreadyExtracted.website))
      ) {
        continue;
      }

      if (this.ADDRESS_KEYWORDS.some(k => upper.includes(k)) || /\b\d{5,6}\b/.test(line)) {
        addressLines.push(line);
      }
    }

    return addressLines.length > 0 ? addressLines.join(', ') : undefined;
  }
}
