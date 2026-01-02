/**
 * Unit tests for Reviews database utilities and validation
 * Тесты для утилит работы с отзывами
 */

import { describe, it, expect } from 'vitest';
import {
	hashToken,
	generateToken,
	getReviewWindow,
	isNowWithinWindow,
} from '$lib/server/db/reviews';
import {
	reviewCreateSchema,
	publicReviewCreateSchema,
	reviewModerationSchema,
	reviewPublicLinkCreateSchema,
} from '$lib/server/validation/schemas';

describe('Reviews Database Utilities', () => {
	describe('hashToken', () => {
		it('should return a deterministic hash for the same input', async () => {
			const token = 'test-token-123';
			const hash1 = await hashToken(token);
			const hash2 = await hashToken(token);

			expect(hash1).toBe(hash2);
		});

		it('should return a 64-character hex string (SHA-256)', async () => {
			const token = 'test-token-123';
			const hash = await hashToken(token);

			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});

		it('should return different hashes for different inputs', async () => {
			const hash1 = await hashToken('token-1');
			const hash2 = await hashToken('token-2');

			expect(hash1).not.toBe(hash2);
		});

		it('should handle empty string', async () => {
			const hash = await hashToken('');

			// SHA-256 of empty string
			expect(hash).toHaveLength(64);
			expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
		});

		it('should handle unicode characters', async () => {
			const hash = await hashToken('токен-тест-🎉');

			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});
	});

	describe('generateToken', () => {
		it('should generate a base64url encoded token', () => {
			const token = generateToken();

			// Base64url should not contain +, /, or =
			expect(token).not.toMatch(/[+/=]/);
			// Should only contain alphanumeric, -, and _
			expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		});

		it('should generate tokens of consistent length', () => {
			const token1 = generateToken();
			const token2 = generateToken();

			// 32 bytes -> ~43 characters in base64url (without padding)
			expect(token1.length).toBeGreaterThanOrEqual(42);
			expect(token1.length).toBeLessThanOrEqual(44);
			expect(token2.length).toBeGreaterThanOrEqual(42);
			expect(token2.length).toBeLessThanOrEqual(44);
		});

		it('should generate unique tokens', () => {
			const tokens = new Set<string>();
			for (let i = 0; i < 100; i++) {
				tokens.add(generateToken());
			}

			// All 100 tokens should be unique
			expect(tokens.size).toBe(100);
		});
	});

	describe('getReviewWindow', () => {
		it('should calculate review window correctly', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const window = getReviewWindow(endDate);

			// Start: 45 minutes before end
			const expectedStart = new Date('2025-12-01T17:15:00Z');
			expect(window.start.getTime()).toBe(expectedStart.getTime());

			// End: 7 days after start
			const expectedEnd = new Date('2025-12-08T17:15:00Z');
			expect(window.end.getTime()).toBe(expectedEnd.getTime());
		});

		it('should handle different timezones in ISO string', () => {
			const endDate = '2025-12-01T18:00:00+02:00';
			const window = getReviewWindow(endDate);

			// Start should be 45 minutes before end
			const endDateTime = new Date(endDate);
			const expectedStart = new Date(endDateTime.getTime() - 45 * 60 * 1000);
			expect(window.start.getTime()).toBe(expectedStart.getTime());
		});

		it('should create a 7-day + 45 minutes window', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const window = getReviewWindow(endDate);

			const windowDuration = window.end.getTime() - window.start.getTime();
			const expectedDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

			expect(windowDuration).toBe(expectedDuration);
		});
	});

	describe('isNowWithinWindow', () => {
		it('should return true when now is within the window', () => {
			// Event ends at 18:00, window starts at 17:15
			const endDate = '2025-12-01T18:00:00Z';
			const now = new Date('2025-12-01T17:30:00Z'); // Within window

			expect(isNowWithinWindow(now, endDate)).toBe(true);
		});

		it('should return true at the exact start of the window', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const windowStart = new Date('2025-12-01T17:15:00Z');

			expect(isNowWithinWindow(windowStart, endDate)).toBe(true);
		});

		it('should return true at the exact end of the window', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const windowEnd = new Date('2025-12-08T17:15:00Z');

			expect(isNowWithinWindow(windowEnd, endDate)).toBe(true);
		});

		it('should return false before the window starts', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const beforeWindow = new Date('2025-12-01T17:00:00Z'); // 15 minutes before window

			expect(isNowWithinWindow(beforeWindow, endDate)).toBe(false);
		});

		it('should return false after the window ends', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const afterWindow = new Date('2025-12-08T18:00:00Z'); // After 7-day window

			expect(isNowWithinWindow(afterWindow, endDate)).toBe(false);
		});

		it('should return true during the event (last 45 minutes)', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const duringEvent = new Date('2025-12-01T17:45:00Z'); // 15 minutes before end

			expect(isNowWithinWindow(duringEvent, endDate)).toBe(true);
		});

		it('should return true one day after event', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const oneDayAfter = new Date('2025-12-02T18:00:00Z');

			expect(isNowWithinWindow(oneDayAfter, endDate)).toBe(true);
		});

		it('should return true six days after event', () => {
			const endDate = '2025-12-01T18:00:00Z';
			const sixDaysAfter = new Date('2025-12-07T18:00:00Z');

			expect(isNowWithinWindow(sixDaysAfter, endDate)).toBe(true);
		});
	});
});

describe('Reviews Validation Schemas', () => {
	describe('reviewCreateSchema', () => {
		it('should validate correct review data', () => {
			const validData = {
				event_id: 1,
				rating: 8,
				comment: 'Great event! I learned a lot about career options.',
				is_anonymous: false,
			};

			const result = reviewCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject rating below 1', () => {
			const invalidData = {
				event_id: 1,
				rating: 0,
				comment: 'Great event! I learned a lot.',
				is_anonymous: false,
			};

			const result = reviewCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject rating above 10', () => {
			const invalidData = {
				event_id: 1,
				rating: 11,
				comment: 'Great event! I learned a lot.',
				is_anonymous: false,
			};

			const result = reviewCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject comment shorter than 10 characters', () => {
			const invalidData = {
				event_id: 1,
				rating: 8,
				comment: 'Good!',
				is_anonymous: false,
			};

			const result = reviewCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject comment longer than 2000 characters', () => {
			const invalidData = {
				event_id: 1,
				rating: 8,
				comment: 'A'.repeat(2001),
				is_anonymous: false,
			};

			const result = reviewCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should accept exactly 10 character comment', () => {
			const validData = {
				event_id: 1,
				rating: 5,
				comment: 'Good event',
				is_anonymous: true,
			};

			const result = reviewCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should accept exactly 2000 character comment', () => {
			const validData = {
				event_id: 1,
				rating: 5,
				comment: 'A'.repeat(2000),
				is_anonymous: true,
			};

			const result = reviewCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should accept all valid ratings from 1 to 10', () => {
			for (let rating = 1; rating <= 10; rating++) {
				const validData = {
					event_id: 1,
					rating,
					comment: 'This is a valid comment for testing.',
					is_anonymous: false,
				};

				const result = reviewCreateSchema.safeParse(validData);
				expect(result.success).toBe(true);
			}
		});

		it('should reject non-integer rating', () => {
			const invalidData = {
				event_id: 1,
				rating: 7.5,
				comment: 'Good event with nice activities.',
				is_anonymous: false,
			};

			const result = reviewCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should default is_anonymous to false', () => {
			const dataWithoutAnonymous = {
				event_id: 1,
				rating: 8,
				comment: 'Great event! Very informative.',
			};

			const result = reviewCreateSchema.safeParse(dataWithoutAnonymous);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.is_anonymous).toBe(false);
			}
		});
	});

	describe('publicReviewCreateSchema', () => {
		it('should validate correct public review data', () => {
			const validData = {
				token: 'abc123token',
				rating: 9,
				comment: 'Amazing event! Would recommend to everyone.',
				is_anonymous: true,
			};

			const result = publicReviewCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should accept optional public_display_name', () => {
			const validData = {
				token: 'abc123token',
				rating: 9,
				comment: 'Amazing event! Would recommend.',
				is_anonymous: false,
				public_display_name: 'John D.',
			};

			const result = publicReviewCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject public_display_name longer than 80 characters', () => {
			const invalidData = {
				token: 'abc123token',
				rating: 9,
				comment: 'Amazing event! Would recommend.',
				is_anonymous: false,
				public_display_name: 'A'.repeat(81),
			};

			const result = publicReviewCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should require token', () => {
			const invalidData = {
				rating: 9,
				comment: 'Amazing event! Would recommend.',
				is_anonymous: true,
			};

			const result = publicReviewCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject empty token', () => {
			const invalidData = {
				token: '',
				rating: 9,
				comment: 'Amazing event! Would recommend.',
				is_anonymous: true,
			};

			const result = publicReviewCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});
	});

	describe('reviewModerationSchema', () => {
		it('should validate moderation with review_ids', () => {
			const validData = {
				review_ids: [1, 2, 3],
				status: 'approved' as const,
			};

			const result = reviewModerationSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should validate moderation with all_pending', () => {
			const validData = {
				all_pending: true,
				status: 'rejected' as const,
			};

			const result = reviewModerationSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject without review_ids or all_pending', () => {
			const invalidData = {
				status: 'approved' as const,
			};

			const result = reviewModerationSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject empty review_ids array without all_pending', () => {
			const invalidData = {
				review_ids: [],
				status: 'approved' as const,
			};

			const result = reviewModerationSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject invalid status', () => {
			const invalidData = {
				review_ids: [1],
				status: 'pending',
			};

			const result = reviewModerationSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should only accept approved or rejected status', () => {
			const approved = {
				review_ids: [1],
				status: 'approved' as const,
			};

			const rejected = {
				review_ids: [1],
				status: 'rejected' as const,
			};

			expect(reviewModerationSchema.safeParse(approved).success).toBe(true);
			expect(reviewModerationSchema.safeParse(rejected).success).toBe(true);
		});
	});

	describe('reviewPublicLinkCreateSchema', () => {
		it('should validate correct public link data', () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 7);

			const validData = {
				event_id: 1,
				expires_at: futureDate.toISOString(),
			};

			const result = reviewPublicLinkCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject expires_at in the past', () => {
			const pastDate = new Date();
			pastDate.setDate(pastDate.getDate() - 1);

			const invalidData = {
				event_id: 1,
				expires_at: pastDate.toISOString(),
			};

			const result = reviewPublicLinkCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject invalid date format', () => {
			const invalidData = {
				event_id: 1,
				expires_at: '2025-13-01', // Invalid month
			};

			const result = reviewPublicLinkCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject invalid event_id', () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 7);

			const invalidData = {
				event_id: -1,
				expires_at: futureDate.toISOString(),
			};

			const result = reviewPublicLinkCreateSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should accept datetime-local format', () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 7);
			// Format: 2025-12-01T18:00 (without seconds and timezone)
			const datetimeLocal = futureDate.toISOString().slice(0, 16);

			const validData = {
				event_id: 1,
				expires_at: datetimeLocal,
			};

			const result = reviewPublicLinkCreateSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});
	});
});
