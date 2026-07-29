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

  // Dictionary of standard business designations
  private readonly DESIGNATIONS = [
    'CEO', 'CHIEF EXECUTIVE OFFICER', 'FOUNDER', 'CO-FOUNDER', 'MANAGING DIRECTOR',
    'DIRECTOR', 'GENERAL MANAGER', 'GM', 'VICE PRESIDENT', 'VP', 'PRESIDENT',
    'SENIOR MANAGER', 'PROJECT MANAGER', 'PRODUCT MANAGER', 'SALES MANAGER',
    'BUSINESS DEVELOPMENT MANAGER', 'MARKETING MANAGER', 'OPERATIONS MANAGER',
    'REGIONAL MANAGER', 'ACCOUNT MANAGER', 'TECHNICAL DIRECTOR', 'CHIEF TECHNOLOGY OFFICER',
    'CTO', 'CHIEF FINANCIAL OFFICER', 'CFO', 'EXECUTIVE DIRECTOR', 'LEAD ENGINEER',
    'SENIOR ENGINEER', 'SOFTWARE ENGINEER', 'CONSULTANT', 'ADVISOR', 'PARTNER',
    'PROPRIETOR', 'OWNER', 'SALES EXECUTIVE', 'EXECUTIVE', 'REPRESENTATIVE',
    'ARCHITECT', 'SPECIALIST', 'ASSOCIATE', 'HEAD OF SALES', 'HEAD OF MARKETING'
  ];

  // Company legal entities & suffixes
  private readonly COMPANY_SUFFIXES = [
    'PVT LTD', 'PRIVATE LIMITED', 'LTD', 'LIMITED', 'INC', 'INCORPORATED',
    'CORP', 'CORPORATION', 'LLP', 'PLC', 'GMBH', 'GROUP', 'ENTERPRISES',
    'SOLUTIONS', 'TECHNOLOGIES', 'INFOTECH', 'INDUSTRIES', 'SERVICES',
    'SOFTWARE', 'SYSTEMS', 'LOGISTICS', 'GLOBAL', 'EXPORTS', 'IMPORTS',
    'TRADERS', 'INTERNATIONAL', 'AGENCY', 'STUDIO', 'WORKS', 'VENTURES'
  ];

  /**
   * Parses raw OCR string into structured contact data
   */
  parseCardText(rawText: string): ExtractedCardData {
    if (!rawText || !rawText.trim()) {
      return {};
    }

    const lines = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const email = this.extractEmail(rawText);
    const website = this.extractWebsite(rawText);
    const phone = this.extractPhone(rawText);
    const designation = this.extractDesignation(lines);
    const company = this.extractCompany(lines);
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
      rawText
    };
  }

  private extractEmail(text: string): string | undefined {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
    const match = text.match(emailRegex);
    return match ? match[0].toLowerCase() : undefined;
  }

  private extractWebsite(text: string): string | undefined {
    const webRegex = /(https?:\/\/)?(www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/i;
    const domainRegex = /\b(www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i;
    
    let match = text.match(webRegex) || text.match(domainRegex);
    if (match) {
      return match[0].toLowerCase();
    }

    // Fallback: look for lines ending in .com, .in, .org, .net, etc., that are not emails
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.includes('@') && /\b[a-zA-Z0-9-]+\.(com|in|co|net|org|io|ai|biz|tech)\b/i.test(trimmed)) {
        const urlMatch = trimmed.match(/[a-zA-Z0-9-]+\.(com|in|co|net|org|io|ai|biz|tech)/i);
        if (urlMatch) return 'www.' + urlMatch[0].toLowerCase();
      }
    }
    return undefined;
  }

  private extractPhone(text: string): string | undefined {
    // Matches formats: +91 9876543210, (022) 2837465, +1-800-555-0199, 98765 43210, Mobile: 9876543210
    const phoneRegexes = [
      /(?:ph|phone|mob|mobile|cell|tel|call)?[\s.:]*(\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/gi
    ];

    const candidates: string[] = [];

    for (const regex of phoneRegexes) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const cleaned = match[0].replace(/[^\d+]/g, '');
        // Valid phones typically have between 8 and 14 digits
        const digitCount = (cleaned.match(/\d/g) || []).length;
        if (digitCount >= 8 && digitCount <= 14) {
          candidates.push(match[0].trim());
        }
      }
    }

    return candidates.length > 0 ? candidates[0] : undefined;
  }

  private extractDesignation(lines: string[]): string | undefined {
    for (const line of lines) {
      const upper = line.toUpperCase();
      for (const desig of this.DESIGNATIONS) {
        if (upper.includes(desig)) {
          return line.trim();
        }
      }
    }
    return undefined;
  }

  private extractCompany(lines: string[]): string | undefined {
    // 1. Look for explicit company suffix match
    for (const line of lines) {
      const upper = line.toUpperCase();
      for (const suffix of this.COMPANY_SUFFIXES) {
        if (upper.includes(suffix)) {
          return line.trim();
        }
      }
    }

    // 2. Look for website domain name as company fallback
    return undefined;
  }

  private extractName(
    lines: string[], 
    alreadyExtracted: { email?: string; phone?: string; website?: string; designation?: string; company?: string }
  ): string | undefined {
    const namePrefixes = ['MR.', 'MR', 'MS.', 'MS', 'MRS.', 'MRS', 'DR.', 'DR', 'ER.', 'ER', 'PROF.'];

    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const line = lines[i].trim();
      const upper = line.toUpperCase();

      // Skip lines that match known contacts or company names
      if (
        (alreadyExtracted.email && line.toLowerCase().includes(alreadyExtracted.email.toLowerCase())) ||
        (alreadyExtracted.website && line.toLowerCase().includes(alreadyExtracted.website.toLowerCase())) ||
        (alreadyExtracted.phone && line.includes(alreadyExtracted.phone)) ||
        (alreadyExtracted.designation && line === alreadyExtracted.designation) ||
        (alreadyExtracted.company && line === alreadyExtracted.company)
      ) {
        continue;
      }

      // Skip lines with digits or email symbols
      if (/\d/.test(line) || line.includes('@') || line.includes('www.') || line.includes('.com')) {
        continue;
      }

      // Check for prefix
      const words = line.split(/\s+/);
      if (words.length >= 1 && words.length <= 4) {
        const firstWordUpper = words[0].toUpperCase();
        if (namePrefixes.includes(firstWordUpper)) {
          return line;
        }

        // If line is near top (index 0 or 1) and contains only letters & spaces, candidate for Name
        if (/^[a-zA-Z\s.'-]+$/.test(line) && line.length >= 3 && line.length <= 35) {
          // Verify it's not a common designation or company keyword
          const isKeyword = [...this.DESIGNATIONS, ...this.COMPANY_SUFFIXES].some(k => upper.includes(k));
          if (!isKeyword) {
            return line;
          }
        }
      }
    }

    return undefined;
  }

  private extractAddress(
    lines: string[],
    alreadyExtracted: { email?: string; phone?: string; website?: string; designation?: string; company?: string; name?: string }
  ): string | undefined {
    const addressKeywords = ['ROAD', 'STREET', 'ST', 'AVE', 'AVENUE', 'BLVD', 'FLOOR', 'FLR', 'BUILDING', 'BLDG', 'PLOT', 'SECTOR', 'ESTATE', 'MIDC', 'PIN', 'ZIP', 'CITY', 'STATE', 'INDIA', 'USA', 'UK'];

    const addressLines: string[] = [];

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (
        line === alreadyExtracted.name ||
        line === alreadyExtracted.designation ||
        line === alreadyExtracted.company ||
        (alreadyExtracted.email && line.includes(alreadyExtracted.email)) ||
        (alreadyExtracted.phone && line.includes(alreadyExtracted.phone))
      ) {
        continue;
      }

      if (addressKeywords.some(k => upper.includes(k)) || /\b\d{6}\b/.test(line)) {
        addressLines.push(line);
      }
    }

    return addressLines.length > 0 ? addressLines.join(', ') : undefined;
  }
}
