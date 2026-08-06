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
    expect(parsed.company).toBe('AriyAI Tech Private Limited');
    expect(parsed.email).toBe('pushparaj.s@ariyitech.com');
    expect(parsed.phone).toBe('+91 93444 21012');
    expect(parsed.website).toBe('https://ariyitech.com/');
    expect(parsed.address).toContain('Coimbatore');
  });

  it('should parse Business Development Head card (T.R. Manikandan / SRIDHARSHINI ENTERPRISE) accurately', () => {
    const rawCardText = `
      T.R. Manikandan
      Business Development Head
      SRIDHARSHINI ENTERPRISE
      +91 99449 23516
      sdemarketing@dkbelt.com
      www.dkbelt.com
      # 123/10E, Kasthuri Building, Dr. Nanjappa Road
      Coimbatore - 641018 Tamil Nadu. INDIA
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('T.R. Manikandan');
    expect(parsed.designation).toBe('Business Development Head');
    expect(parsed.company).toBe('SRIDHARSHINI ENTERPRISE');
    expect(parsed.phone).toContain('99449 23516');
    expect(parsed.email).toBe('sdemarketing@dkbelt.com');
    expect(parsed.website).toBe('www.dkbelt.com');
  });

  it('should pattern match dynamic Head of and fuzzy designation OCR typos', () => {
    const parsed1 = service.parseCardText('John Doe\nHead of Operations\nAcme Corp\n+91 9876543210');
    expect(parsed1.designation).toBe('Head of Operations');

    const parsed2 = service.parseCardText('Jane Smith\nBusness Develpment Manager\nTech Solutions\n+91 9876543210');
    expect(parsed2.designation).toBe('Business Development Manager');
  });

  it('should clean trailing OCR noise from designation and correctly parse R. SUNDARRAJ / Managing Director / NAREN GROUP OF COMPANIES', () => {
    const rawCardText = `
      Lo LW
      R. SUNDARRAJ
      Managing Director carat Ju Tv 260 TO
      98422 16086
      +91 422 2967078 / 2967127
      +91 9965516076 / 98429 91141
      sundar1870@gmail.com
      NAREN GROUP OF COMPANIES
      9/10, Periar Nagar, Nehru Nagar East, Civil Aerodrome Post, Coimbatore - 641 014.
      www.narengroup.in
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('R. SUNDARRAJ');
    expect(parsed.designation).toBe('Managing Director');
    expect(parsed.company).toBe('NAREN GROUP OF COMPANIES');
    expect(parsed.email).toBe('sundar1870@gmail.com');
    expect(parsed.website).toBe('www.narengroup.in');
  });

  it('should parse salutations and format initials cleanly without relying on email username', () => {
    const rawCardText = `
      Dr. Rajesh V. Sharma
      Chief Executive Officer
      AriyAI Solutions
      rajesh.s@ariyai.com
      +91 9876543210
    `;
    const parsed1 = service.parseCardText(rawCardText);
    expect(parsed1.name).toBe('Dr. Rajesh V. Sharma');
    expect(parsed1.designation).toBe('Chief Executive Officer');

    const rawCardText2 = `
      T R Manikandan
      Business Development Head
      Sridharshini Enterprise
      +91 99449 23516
    `;
    const parsed2 = service.parseCardText(rawCardText2);
    expect(parsed2.name).toBe('T.R. Manikandan');
  });
});
