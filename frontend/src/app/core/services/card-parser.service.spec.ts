import { TestBed } from '@angular/core/testing';
import { CardParserService } from './card-parser.service';

describe('CardParserService', () => {
  let service: CardParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CardParserService);
  });

  it('should parse Maria Olivia card accurately including domain company fallback', () => {
    const rawCardText = `
      MARIA OLIVIA
      Manager
      +011 123 456 789
      maria.olivia@aurora.com
      www.aurora.com
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('MARIA OLIVIA');
    expect(parsed.designation).toBe('Manager');
    expect(parsed.email).toBe('maria.olivia@aurora.com');
    expect(parsed.phone).toBe('+011 123 456 789');
    expect(parsed.website).toBe('www.aurora.com');
    expect(parsed.company).toBe('Aurora');
  });

  it('should parse Pushparaj Subramaniam card accurately without address leaking into company', () => {
    const rawCardText = `
      AriyAI
      Tech Private Limited
      PUSHPARAJ SUBRAMANIAM
      Chief Development Officer
      9/10-B, First Floor, Pariyar Nagar,
      Coimbatore - 641014
      +91 93444 21012
      pushparaj.s@ariyitech.com
      https://ariyitech.com/
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('PUSHPARAJ SUBRAMANIAM');
    expect(parsed.designation).toBe('Chief Development Officer');
    expect(parsed.company).toBe('Tech Private Limited');
    expect(parsed.email).toBe('pushparaj.s@ariyitech.com');
    expect(parsed.phone).toBe('+91 93444 21012');
    expect(parsed.website).toBe('https://ariyitech.com/');
    expect(parsed.address).toContain('Coimbatore');
  });
});
