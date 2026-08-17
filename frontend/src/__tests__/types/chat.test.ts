import { extractFieldsFromResponse, parseDocumentType, ChatResponse } from '@/types/chat';
import { DocumentType } from '@/types/documents';

describe('chat types and utilities', () => {
  describe('parseDocumentType', () => {
    it('parses mutual_nda correctly', () => {
      expect(parseDocumentType('mutual_nda')).toBe(DocumentType.MUTUAL_NDA);
      expect(parseDocumentType('MUTUAL_NDA')).toBe(DocumentType.MUTUAL_NDA);
      expect(parseDocumentType('mutual-nda')).toBe(DocumentType.MUTUAL_NDA);
    });

    it('parses other document types', () => {
      expect(parseDocumentType('cloud_service')).toBe(DocumentType.CLOUD_SERVICE);
      expect(parseDocumentType('pilot')).toBe(DocumentType.PILOT);
      expect(parseDocumentType('design_partner')).toBe(DocumentType.DESIGN_PARTNER);
      expect(parseDocumentType('sla')).toBe(DocumentType.SLA);
      expect(parseDocumentType('software_license')).toBe(DocumentType.SOFTWARE_LICENSE);
    });

    it('returns null for undefined or invalid types', () => {
      expect(parseDocumentType(undefined)).toBeNull();
      expect(parseDocumentType('')).toBeNull();
      expect(parseDocumentType('non_existent_type')).toBeNull();
    });
  });

  describe('extractFieldsFromResponse', () => {
    it('extracts Mutual NDA fields from response', () => {
      const response: ChatResponse = {
        response: 'Got it!',
        documentType: 'mutual_nda',
        purpose: 'Exploring strategic partnership',
        effectiveDate: '2026-09-01',
        governingLaw: 'Delaware',
        jurisdiction: 'New Castle County, Delaware',
        mndaTermType: 'expires',
        mndaTermYears: 2,
        confidentialityTermType: 'years',
        confidentialityTermYears: 3,
        modifications: 'None',
        party1: {
          name: 'Alice Smith',
          title: 'CEO',
          company: 'Acme Corp',
          noticeAddress: 'alice@acme.com',
          date: '2026-09-01',
        },
        party2: {
          name: 'Bob Jones',
          title: 'CTO',
          company: 'Beta Inc',
          noticeAddress: 'bob@beta.com',
          date: '2026-09-01',
        },
        isComplete: true,
      };

      const extracted = extractFieldsFromResponse(response);

      expect(extracted.purpose).toBe('Exploring strategic partnership');
      expect(extracted.effectiveDate).toBe('2026-09-01');
      expect(extracted.governingLaw).toBe('Delaware');
      expect(extracted.jurisdiction).toBe('New Castle County, Delaware');
      expect(extracted.mndaTermType).toBe('expires');
      expect(extracted.mndaTermYears).toBe(2);
      expect(extracted.confidentialityTermType).toBe('years');
      expect(extracted.confidentialityTermYears).toBe(3);
      expect(extracted.modifications).toBe('None');
      expect(extracted.party1).toEqual({
        name: 'Alice Smith',
        title: 'CEO',
        company: 'Acme Corp',
        noticeAddress: 'alice@acme.com',
        date: '2026-09-01',
      });
      expect(extracted.party2).toEqual({
        name: 'Bob Jones',
        title: 'CTO',
        company: 'Beta Inc',
        noticeAddress: 'bob@beta.com',
        date: '2026-09-01',
      });
    });

    it('handles empty / undefined optional fields', () => {
      const response: ChatResponse = {
        response: 'Hello! What document do you need?',
        isComplete: false,
      };

      const extracted = extractFieldsFromResponse(response);
      expect(Object.keys(extracted).length).toBe(0);
    });

    it('extracts partial party info with defaults for missing attributes', () => {
      const response: ChatResponse = {
        response: 'Got party 1 info',
        party1: {
          company: 'Acme Corp',
        },
        isComplete: false,
      };

      const extracted = extractFieldsFromResponse(response);
      expect(extracted.party1).toEqual({
        name: '',
        title: '',
        company: 'Acme Corp',
        noticeAddress: '',
        date: '',
      });
      expect(extracted.party2).toBeUndefined();
    });
  });
});
