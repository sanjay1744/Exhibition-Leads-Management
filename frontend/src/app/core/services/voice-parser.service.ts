import { Injectable } from '@angular/core';
import { PREDEFINED_DESIGNATIONS } from './card-parser.service';

export interface ParsedVoiceLeadData {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  designation?: string;
  interestLevel?: 'Hot' | 'Warm' | 'Cold';
  remarks?: string;
}

@Injectable({ providedIn: 'root' })
export class VoiceParserService {
  /**
   * Parse a spoken voice transcript string into structured Lead Form fields.
   */
  parseVoiceTranscript(transcript: string): ParsedVoiceLeadData {
    if (!transcript || !transcript.trim()) {
      return {};
    }

    const result: ParsedVoiceLeadData = {};
    const text = transcript.trim();

    // 1. Extract Phone Number (Spoken digits or raw digits)
    const phone = this.extractPhone(text);
    if (phone) result.phone = phone;

    // 2. Extract Email Address (standard or "at ... dot ...")
    const email = this.extractEmail(text);
    if (email) result.email = email;

    // 3. Extract Full Name
    const name = this.extractName(text);
    if (name) result.name = name;

    // 4. Extract Company Name
    const company = this.extractCompany(text, result.name);
    if (company) result.company = company;

    // 5. Extract Designation
    const designation = this.extractDesignation(text);
    if (designation) result.designation = designation;

    // 6. Extract Interest Level
    const interest = this.extractInterestLevel(text);
    if (interest) result.interestLevel = interest;

    return result;
  }

  private extractName(text: string): string | undefined {
    // Patterns for natural speech introduction:
    // "hi I am Sanjay", "I am Sanjay Kumar", "my name is Sanjay", "this is Sanjay", "name is Sanjay"
    const patterns = [
      /(?:my name is|name is|name|this is|speaking with|visitor name is|met with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:i am|i'm|im)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:here|from|working|representing)/i,
    ];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const candidate = match[1].trim();
        // Ignore common filler words if captured by mistake
        if (!['here', 'from', 'with', 'this', 'that', 'there', 'user', 'client', 'visitor', 'lead'].includes(candidate.toLowerCase())) {
          return this.capitalizeWords(candidate);
        }
      }
    }

    // Fallback: If text starts with greetings e.g. "Hi Sanjay", "Hello Sanjay"
    const greetingMatch = text.match(/(?:hi|hello|hey)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (greetingMatch && greetingMatch[1]) {
      return this.capitalizeWords(greetingMatch[1].trim());
    }

    return undefined;
  }

  private extractCompany(text: string, extractedName?: string): string | undefined {
    const patterns = [
      /(?:from|working at|company is|representing|company|org|organization|firm)\s+([A-Z0-9][a-zA-Z0-9&.\s]{1,25})(?=\s*,|\s*phone|\s*mobile|\s*email|\s*designation|\s*$|\s*and)/i,
      /(?:with)\s+([A-Z0-9][a-zA-Z0-9&.\s]{1,20})\s+(?:company|pvt|ltd|inc|corp|technologies|solutions|services)/i,
    ];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        let comp = match[1].trim();
        if (extractedName && comp.toLowerCase().includes(extractedName.toLowerCase())) {
          continue;
        }
        if (comp.length > 2) {
          return this.capitalizeWords(comp);
        }
      }
    }

    return undefined;
  }

  private extractDesignation(text: string): string | undefined {
    const lowerText = text.toLowerCase();

    // Check predefined designations list first
    for (const desig of PREDEFINED_DESIGNATIONS) {
      if (lowerText.includes(desig.toLowerCase())) {
        return desig;
      }
    }

    // Common short designations
    const shortDesigs = ['CEO', 'CTO', 'COO', 'CFO', 'VP', 'MD', 'GM', 'PM'];
    for (const sd of shortDesigs) {
      const regex = new RegExp(`\\b${sd}\\b`, 'i');
      if (regex.test(text)) {
        return sd;
      }
    }

    // Natural speech patterns: "I am a manager", "working as CEO"
    const match = text.match(/(?:designation is|working as|role is|position is|i am a|i am an)\s+([a-z\s]{3,20})/i);
    if (match && match[1]) {
      return this.capitalizeWords(match[1].trim());
    }

    return undefined;
  }

  private extractPhone(text: string): string | undefined {
    // 1. Raw digits 10-digit Indian phone pattern
    const digitMatch = text.match(/(?:\+?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}|\b[6-9]\d{9}\b/);
    if (digitMatch) {
      return digitMatch[0].trim();
    }

    // 2. Convert spoken word digits e.g. "nine eight seven six five four three two one zero"
    const wordDigitMap: { [key: string]: string } = {
      zero: '0', oh: '0',
      one: '1', two: '2',
      three: '3', four: '4', five: '5',
      six: '6', seven: '7', eight: '8',
      nine: '9'
    };

    const words = text.toLowerCase().split(/\s+/);
    let collectedDigits = '';
    for (const w of words) {
      const cleanW = w.replace(/[^a-z]/g, '');
      if (wordDigitMap[cleanW] !== undefined) {
        collectedDigits += wordDigitMap[cleanW];
      }
    }

    if (collectedDigits.length >= 10) {
      return collectedDigits.slice(0, 10);
    }

    return undefined;
  }

  private extractEmail(text: string): string | undefined {
    // Standard email regex
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      return emailMatch[0].toLowerCase();
    }

    // Spoken email: "sanjay at techcorp dot com"
    const spokenEmailMatch = text.match(/([a-zA-Z0-9._]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+(com|in|org|net|co|io)/i);
    if (spokenEmailMatch) {
      const prefix = spokenEmailMatch[1].trim();
      const domain = spokenEmailMatch[2].trim();
      const tld = spokenEmailMatch[3].trim();
      return `${prefix}@${domain}.${tld}`.toLowerCase();
    }

    return undefined;
  }

  private extractInterestLevel(text: string): 'Hot' | 'Warm' | 'Cold' | undefined {
    const lower = text.toLowerCase();
    if (lower.includes('hot') || lower.includes('urgent') || lower.includes('high budget') || lower.includes('immediately') || lower.includes('ready to buy')) {
      return 'Hot';
    }
    if (lower.includes('cold') || lower.includes('not interested') || lower.includes('no requirement')) {
      return 'Cold';
    }
    if (lower.includes('warm') || lower.includes('interested') || lower.includes('send proposal') || lower.includes('quotation')) {
      return 'Warm';
    }
    return undefined;
  }

  private capitalizeWords(str: string): string {
    return str
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}
