import { describe, it, expect } from 'vitest';
import {
  compareOperations,
  parseDocumentedOperations,
  type Operation,
} from '../../scripts/check-api-contract.ts';

describe('API Contract Checker', () => {
  describe('parseDocumentedOperations', () => {
    it('safely rejects non-object roots', () => {
      const invalidDocs = ['null', '[]', '"string"'];
      for (const doc of invalidDocs) {
        expect(() => parseDocumentedOperations(doc)).toThrow(
          'OpenAPI document is not a valid object',
        );
      }
    });

    it('safely rejects missing or non-object paths property', () => {
      expect(() => parseDocumentedOperations('openapi: 3.0.0')).toThrow(
        'OpenAPI document .paths is missing or not a valid object',
      );
      expect(() => parseDocumentedOperations('paths: []')).toThrow(
        'OpenAPI document .paths is missing or not a valid object',
      );
      expect(() => parseDocumentedOperations('paths: "abc"')).toThrow(
        'OpenAPI document .paths is missing or not a valid object',
      );
      expect(() => parseDocumentedOperations('paths: null')).toThrow(
        'OpenAPI document .paths is missing or not a valid object',
      );
    });

    it('parses valid operations', () => {
      const validDoc = `
paths:
  /api/users:
    get: {}
    post: {}
  /api/users/{id}:
    get: {}
    delete: {}
`;
      const ops = parseDocumentedOperations(validDoc);
      expect(ops).toHaveLength(4);
      expect(ops).toEqual(
        expect.arrayContaining([
          { path: '/api/users', method: 'get' },
          { path: '/api/users', method: 'post' },
          { path: '/api/users/{id}', method: 'get' },
          { path: '/api/users/{id}', method: 'delete' },
        ]),
      );
    });
  });

  describe('compareOperations', () => {
    it('reports missing methods on an existing path', () => {
      const documented: Operation[] = [
        { path: '/api/test', method: 'get' },
        { path: '/api/test', method: 'post' },
      ];
      // Implemented only has GET, missing POST
      const implemented: Operation[] = [{ path: '/api/test', method: 'get' }];

      const result = compareOperations(documented, implemented);
      expect(result.hasError).toBe(true);
      expect(result.errors).toContain('❌ Documented operation is not implemented: POST /api/test');
    });

    it('reports extra methods on an existing path', () => {
      const documented: Operation[] = [{ path: '/api/test', method: 'get' }];
      // Implemented has extra POST
      const implemented: Operation[] = [
        { path: '/api/test', method: 'get' },
        { path: '/api/test', method: 'post' },
      ];

      const result = compareOperations(documented, implemented);
      expect(result.hasError).toBe(true);
      expect(result.errors).toContain('❌ Undocumented implemented operation: POST /api/test');
    });

    it('passes when exactly matched', () => {
      const documented: Operation[] = [
        { path: '/api/test', method: 'get' },
        { path: '/api/test', method: 'post' },
      ];
      const implemented: Operation[] = [
        { path: '/api/test', method: 'get' },
        { path: '/api/test', method: 'post' },
      ];

      const result = compareOperations(documented, implemented);
      expect(result.hasError).toBe(false);
      expect(result.errors).toHaveLength(0);
    });
  });
});
